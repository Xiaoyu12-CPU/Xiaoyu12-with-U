use serde_json::Value;
use std::fs;
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const DIALOGUE_FILE_NAME: &str = "dialogue.json";
const DIALOGUE_TEMP_FILE_NAME: &str = "dialogue.json.tmp";
const DIALOGUE_BACKUP_FILE_NAME: &str = "dialogue.json.bak";

#[tauri::command]
pub fn load_dialogue_catalog(app: AppHandle) -> Result<Option<String>, String> {
    let directory = dialogue_directory(&app)?;
    let dialogue_path = directory.join(DIALOGUE_FILE_NAME);

    match fs::read_to_string(&dialogue_path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == ErrorKind::NotFound => {
            let backup_path = directory.join(DIALOGUE_BACKUP_FILE_NAME);
            match fs::read_to_string(&backup_path) {
                Ok(contents) => Ok(Some(contents)),
                Err(backup_error) if backup_error.kind() == ErrorKind::NotFound => Ok(None),
                Err(backup_error) => Err(format!("Failed to read dialogue backup: {backup_error}")),
            }
        }
        Err(error) => Err(format!("Failed to read dialogue JSON: {error}")),
    }
}

#[tauri::command]
pub fn save_dialogue_catalog(app: AppHandle, contents: String) -> Result<(), String> {
    validate_dialogue_document(&contents)?;
    let directory = dialogue_directory(&app)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Failed to create dialogue storage directory: {error}"))?;

    let dialogue_path = directory.join(DIALOGUE_FILE_NAME);
    let temp_path = directory.join(DIALOGUE_TEMP_FILE_NAME);
    let backup_path = directory.join(DIALOGUE_BACKUP_FILE_NAME);
    write_synced(&temp_path, contents.as_bytes())?;

    // Same durable replace strategy as settings.rs: atomic rename fast path,
    // with a backup round-trip for filesystems that refuse overwriting renames.
    if fs::rename(&temp_path, &dialogue_path).is_ok() {
        let _ = fs::remove_file(&backup_path);
        return Ok(());
    }

    if dialogue_path.exists() {
        let _ = fs::remove_file(&backup_path);
        fs::rename(&dialogue_path, &backup_path)
            .map_err(|error| format!("Failed to stage dialogue backup: {error}"))?;
    }

    if let Err(error) = fs::rename(&temp_path, &dialogue_path) {
        if backup_path.exists() {
            let _ = fs::rename(&backup_path, &dialogue_path);
        }
        return Err(format!("Failed to replace dialogue JSON: {error}"));
    }

    let _ = fs::remove_file(backup_path);
    Ok(())
}

fn dialogue_directory(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))
}

fn write_synced(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = fs::File::create(path)
        .map_err(|error| format!("Failed to create temporary dialogue file: {error}"))?;
    file.write_all(bytes)
        .map_err(|error| format!("Failed to write temporary dialogue file: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("Failed to flush temporary dialogue file: {error}"))
}

fn validate_dialogue_document(contents: &str) -> Result<(), String> {
    let document: Value = serde_json::from_str(contents)
        .map_err(|error| format!("Dialogue storage is not valid JSON: {error}"))?;

    if document.get("schemaVersion").and_then(Value::as_u64) != Some(1) {
        return Err("Unsupported dialogue schema version.".to_string());
    }

    if !document.get("events").is_some_and(Value::is_object) {
        return Err("Dialogue JSON must contain an events object.".to_string());
    }

    Ok(())
}
