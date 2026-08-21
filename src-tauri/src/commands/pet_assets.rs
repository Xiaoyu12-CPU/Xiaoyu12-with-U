use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::fs::OpenOptions;
use std::io::{ErrorKind, Write};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const MANIFEST_FILE_NAME: &str = "pet.json";
const MAX_PNG_BYTES: usize = 20 * 1024 * 1024;
const VALID_STATES: [&str; 7] = [
    "idle", "happy", "sleep", "tired", "alert", "working", "dragging",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadedUserAsset {
    stored_name: String,
    file_name: String,
    width: u32,
    height: u32,
}

#[tauri::command]
pub fn load_user_pet_manifest(app: AppHandle, pet_id: String) -> Result<Option<String>, String> {
    let path = pet_root(&app, &pet_id)?.join(MANIFEST_FILE_NAME);
    match fs::read_to_string(path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Failed to read user pet manifest: {error}")),
    }
}

#[tauri::command]
pub fn save_user_pet_manifest(
    app: AppHandle,
    pet_id: String,
    contents: String,
) -> Result<(), String> {
    let document = validate_manifest(&contents, &pet_id)?;

    if document
        .pointer("/states/idle/frames")
        .and_then(Value::as_array)
        .is_some_and(Vec::is_empty)
    {
        return Err("idle state override must keep at least one frame.".to_string());
    }

    let root = pet_root(&app, &pet_id)?;
    fs::create_dir_all(&root)
        .map_err(|error| format!("Failed to create user pet directory: {error}"))?;
    write_synced(root.join(MANIFEST_FILE_NAME), contents.as_bytes())
}

#[tauri::command]
pub fn upload_user_pet_png(
    app: AppHandle,
    pet_id: String,
    state: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<UploadedUserAsset, String> {
    validate_state(&state)?;
    validate_original_png_name(&file_name)?;

    if bytes.len() > MAX_PNG_BYTES {
        return Err("PNG exceeds the 20 MB upload limit.".to_string());
    }

    let (width, height) = inspect_png(&bytes)?;
    let directory = state_directory(&app, &pet_id, &state)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Failed to create state asset directory: {error}"))?;

    let stem = safe_file_stem(&file_name);
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("System clock error: {error}"))?
        .as_millis();

    for suffix in 0..1000_u16 {
        let stored_name = if suffix == 0 {
            format!("{stem}-{timestamp}.png")
        } else {
            format!("{stem}-{timestamp}-{suffix}.png")
        };
        let path = directory.join(&stored_name);
        let file = OpenOptions::new().write(true).create_new(true).open(path);

        match file {
            Ok(mut file) => {
                file.write_all(&bytes)
                    .map_err(|error| format!("Failed to write uploaded PNG: {error}"))?;
                file.sync_all()
                    .map_err(|error| format!("Failed to flush uploaded PNG: {error}"))?;
                return Ok(UploadedUserAsset {
                    stored_name,
                    file_name,
                    width,
                    height,
                });
            }
            Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(format!("Failed to create uploaded PNG: {error}")),
        }
    }

    Err("Could not allocate a collision-free PNG filename.".to_string())
}

#[tauri::command]
pub fn load_user_pet_png(
    app: AppHandle,
    pet_id: String,
    state: String,
    stored_name: String,
) -> Result<Vec<u8>, String> {
    validate_state(&state)?;
    validate_stored_name(&stored_name)?;
    let bytes = fs::read(state_directory(&app, &pet_id, &state)?.join(stored_name))
        .map_err(|error| format!("Failed to read user PNG: {error}"))?;
    inspect_png(&bytes)?;
    Ok(bytes)
}

#[tauri::command]
pub fn delete_user_pet_png(
    app: AppHandle,
    pet_id: String,
    state: String,
    stored_name: String,
) -> Result<(), String> {
    validate_state(&state)?;
    validate_stored_name(&stored_name)?;
    let path = state_directory(&app, &pet_id, &state)?.join(stored_name);
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Failed to delete user PNG: {error}")),
    }
}

fn app_pets_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join("pets"))
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))
}

fn pet_root(app: &AppHandle, pet_id: &str) -> Result<PathBuf, String> {
    validate_identifier(pet_id, "pet id")?;
    Ok(app_pets_root(app)?.join(pet_id))
}

fn state_directory(app: &AppHandle, pet_id: &str, state: &str) -> Result<PathBuf, String> {
    validate_state(state)?;
    Ok(pet_root(app, pet_id)?.join(state))
}

fn validate_manifest(contents: &str, pet_id: &str) -> Result<Value, String> {
    validate_identifier(pet_id, "pet id")?;
    let document: Value = serde_json::from_str(contents)
        .map_err(|error| format!("User pet manifest is invalid JSON: {error}"))?;

    if document.get("schemaVersion").and_then(Value::as_u64) != Some(1)
        || document.get("petId").and_then(Value::as_str) != Some(pet_id)
        || !document.get("states").is_some_and(Value::is_object)
    {
        return Err("User pet manifest has an unsupported format.".to_string());
    }

    Ok(document)
}

fn validate_state(state: &str) -> Result<(), String> {
    if VALID_STATES.contains(&state) {
        Ok(())
    } else {
        Err(format!("Unknown pet state: {state}"))
    }
}

fn validate_identifier(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err(format!("Invalid {label}."));
    }
    Ok(())
}

fn validate_original_png_name(file_name: &str) -> Result<(), String> {
    let path = Path::new(file_name);
    if path.components().count() != 1
        || !matches!(path.components().next(), Some(Component::Normal(_)))
        || !path
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("png"))
    {
        return Err("Only a plain lowercase .png filename is accepted.".to_string());
    }
    Ok(())
}

fn validate_stored_name(stored_name: &str) -> Result<(), String> {
    validate_original_png_name(stored_name)?;
    if stored_name.len() > 180 {
        return Err("Stored PNG filename is too long.".to_string());
    }
    Ok(())
}

fn safe_file_stem(file_name: &str) -> String {
    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("frame");
    let sanitized: String = stem
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '_'
            }
        })
        .take(60)
        .collect();

    if sanitized.is_empty() {
        "frame".to_string()
    } else {
        sanitized
    }
}

fn inspect_png(bytes: &[u8]) -> Result<(u32, u32), String> {
    const SIGNATURE: [u8; 8] = [137, 80, 78, 71, 13, 10, 26, 10];
    if bytes.len() < 33 || bytes[..8] != SIGNATURE {
        return Err("File does not contain a valid PNG signature.".to_string());
    }

    let mut offset = 8_usize;
    let mut dimensions = None;
    let mut saw_iend = false;

    while offset + 12 <= bytes.len() {
        let length = u32::from_be_bytes(
            bytes[offset..offset + 4]
                .try_into()
                .map_err(|_| "Invalid PNG chunk length.")?,
        ) as usize;
        let chunk_end = offset
            .checked_add(12)
            .and_then(|value| value.checked_add(length))
            .ok_or_else(|| "PNG chunk length overflow.".to_string())?;
        if chunk_end > bytes.len() {
            return Err("PNG contains a truncated chunk.".to_string());
        }

        let chunk_type = &bytes[offset + 4..offset + 8];
        if chunk_type == b"acTL" {
            return Err("APNG is not supported in the current phase.".to_string());
        }
        if chunk_type == b"IHDR" {
            if length != 13 {
                return Err("PNG IHDR has an invalid length.".to_string());
            }
            let width = u32::from_be_bytes(
                bytes[offset + 8..offset + 12]
                    .try_into()
                    .map_err(|_| "Invalid PNG width.")?,
            );
            let height = u32::from_be_bytes(
                bytes[offset + 12..offset + 16]
                    .try_into()
                    .map_err(|_| "Invalid PNG height.")?,
            );
            if width == 0 || height == 0 || width > 8192 || height > 8192 {
                return Err("PNG dimensions must be between 1 and 8192 pixels.".to_string());
            }
            dimensions = Some((width, height));
        }

        offset = chunk_end;
        if chunk_type == b"IEND" {
            saw_iend = true;
            break;
        }
    }

    if !saw_iend {
        return Err("PNG does not contain a complete IEND chunk.".to_string());
    }

    dimensions.ok_or_else(|| "PNG does not contain a valid IHDR chunk.".to_string())
}

fn write_synced(path: PathBuf, bytes: &[u8]) -> Result<(), String> {
    let mut file = fs::File::create(path)
        .map_err(|error| format!("Failed to open user pet manifest: {error}"))?;
    file.write_all(bytes)
        .map_err(|error| format!("Failed to write user pet manifest: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("Failed to flush user pet manifest: {error}"))
}
