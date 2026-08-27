use serde::Serialize;
use std::fs;
use std::fs::OpenOptions;
use std::io::{ErrorKind, Write};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const MAX_BACKGROUND_BYTES: usize = 20 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadedControlCenterBackground {
    stored_name: String,
    file_name: String,
    mime_type: String,
}

#[tauri::command]
pub fn upload_control_center_background(
    app: AppHandle,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<UploadedControlCenterBackground, String> {
    let image_type = validate_background(&file_name, &bytes)?;
    let directory = background_directory(&app)?;
    fs::create_dir_all(&directory).map_err(|error| {
        format!("Failed to create Control Center background directory: {error}")
    })?;
    write_background(&directory, &file_name, &bytes, image_type)
}

#[tauri::command]
pub fn load_control_center_background(
    app: AppHandle,
    stored_name: String,
) -> Result<Vec<u8>, String> {
    validate_stored_name(&stored_name)?;
    let bytes = fs::read(background_directory(&app)?.join(&stored_name))
        .map_err(|error| format!("Failed to read Control Center background: {error}"))?;
    validate_background(&stored_name, &bytes)?;
    Ok(bytes)
}

#[tauri::command]
pub fn delete_control_center_background(app: AppHandle, stored_name: String) -> Result<(), String> {
    validate_stored_name(&stored_name)?;
    match fs::remove_file(background_directory(&app)?.join(stored_name)) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "Failed to remove Control Center background: {error}"
        )),
    }
}

fn background_directory(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join("control-center").join("background"))
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))
}

#[derive(Clone, Copy)]
enum BackgroundImageType {
    Png,
    Jpeg,
    Webp,
}

impl BackgroundImageType {
    fn extension(self) -> &'static str {
        match self {
            Self::Png => "png",
            Self::Jpeg => "jpg",
            Self::Webp => "webp",
        }
    }

    fn mime_type(self) -> &'static str {
        match self {
            Self::Png => "image/png",
            Self::Jpeg => "image/jpeg",
            Self::Webp => "image/webp",
        }
    }
}

fn validate_background(file_name: &str, bytes: &[u8]) -> Result<BackgroundImageType, String> {
    validate_original_name(file_name)?;
    if bytes.len() > MAX_BACKGROUND_BYTES {
        return Err("Background image exceeds the 20 MB upload limit.".to_string());
    }

    let extension = Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    match extension.as_str() {
        "png" if bytes.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10]) => {
            Ok(BackgroundImageType::Png)
        }
        "jpg" | "jpeg"
            if bytes.len() >= 4
                && bytes.starts_with(&[0xff, 0xd8, 0xff])
                && bytes.ends_with(&[0xff, 0xd9]) =>
        {
            Ok(BackgroundImageType::Jpeg)
        }
        "webp" if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" => {
            Ok(BackgroundImageType::Webp)
        }
        "png" | "jpg" | "jpeg" | "webp" => {
            Err("Background image contents do not match its file type.".to_string())
        }
        _ => Err("Background image must be PNG, JPG, JPEG, or WebP.".to_string()),
    }
}

fn validate_original_name(file_name: &str) -> Result<(), String> {
    let path = Path::new(file_name);
    if file_name.is_empty()
        || file_name.len() > 180
        || path.components().count() != 1
        || !matches!(path.components().next(), Some(Component::Normal(_)))
    {
        return Err("Invalid background image filename.".to_string());
    }
    Ok(())
}

fn validate_stored_name(stored_name: &str) -> Result<(), String> {
    validate_original_name(stored_name)?;
    if !stored_name
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_'))
    {
        return Err("Invalid managed background reference.".to_string());
    }
    Ok(())
}

fn safe_file_stem(file_name: &str) -> String {
    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("background");
    let safe: String = stem
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
        .take(48)
        .collect();
    if safe.is_empty() {
        "background".to_string()
    } else {
        safe
    }
}

fn write_background(
    directory: &Path,
    file_name: &str,
    bytes: &[u8],
    image_type: BackgroundImageType,
) -> Result<UploadedControlCenterBackground, String> {
    let stem = safe_file_stem(file_name);
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("System clock error: {error}"))?
        .as_millis();

    for suffix in 0..1000_u16 {
        let unique = if suffix == 0 {
            timestamp.to_string()
        } else {
            format!("{timestamp}-{suffix}")
        };
        let stored_name = format!("{stem}-{unique}.{}", image_type.extension());
        let file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(directory.join(&stored_name));
        match file {
            Ok(mut file) => {
                file.write_all(bytes).map_err(|error| {
                    format!("Failed to write Control Center background: {error}")
                })?;
                file.sync_all().map_err(|error| {
                    format!("Failed to flush Control Center background: {error}")
                })?;
                return Ok(UploadedControlCenterBackground {
                    stored_name,
                    file_name: file_name.to_string(),
                    mime_type: image_type.mime_type().to_string(),
                });
            }
            Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(format!(
                    "Failed to create Control Center background: {error}"
                ));
            }
        }
    }
    Err("Could not allocate a managed background filename.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_supported_signatures_and_rejects_wrong_types() {
        assert!(validate_background("bg.png", &[137, 80, 78, 71, 13, 10, 26, 10]).is_ok());
        assert!(validate_background("bg.jpg", &[0xff, 0xd8, 0xff, 0xd9]).is_ok());
        assert!(validate_background("bg.webp", b"RIFF0000WEBP").is_ok());
        assert!(validate_background("bg.gif", b"GIF89a").is_err());
        assert!(validate_background("bg.png", b"not png").is_err());
    }

    #[test]
    fn stored_name_never_accepts_paths() {
        assert!(validate_stored_name("background-1.png").is_ok());
        assert!(validate_stored_name("../background.png").is_err());
        assert!(validate_stored_name("folder/background.png").is_err());
    }

    #[test]
    fn writes_a_managed_copy_with_a_safe_generated_name() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "withxiaoyu12-background-test-{}-{unique}",
            std::process::id()
        ));
        fs::create_dir_all(&directory).expect("create test directory");
        let bytes = [137, 80, 78, 71, 13, 10, 26, 10];
        let asset = write_background(
            &directory,
            "My Background.png",
            &bytes,
            BackgroundImageType::Png,
        )
        .expect("write managed copy");

        assert_ne!(asset.stored_name, "My Background.png");
        assert!(validate_stored_name(&asset.stored_name).is_ok());
        assert_eq!(
            fs::read(directory.join(&asset.stored_name)).expect("read managed copy"),
            bytes
        );
        fs::remove_dir_all(directory).expect("clean test directory");
    }
}
