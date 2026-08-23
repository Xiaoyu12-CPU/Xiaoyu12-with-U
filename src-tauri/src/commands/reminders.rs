use serde_json::Value;
use std::fs;
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const REMINDERS_FILE_NAME: &str = "reminders.json";
const REMINDERS_TEMP_FILE_NAME: &str = "reminders.json.tmp";
const REMINDERS_BACKUP_FILE_NAME: &str = "reminders.json.bak";

#[tauri::command]
pub fn load_reminders(app: AppHandle) -> Result<Option<String>, String> {
    load_from_directory(&reminders_directory(&app)?)
}

#[tauri::command]
pub fn save_reminders(app: AppHandle, contents: String) -> Result<(), String> {
    save_to_directory(&reminders_directory(&app)?, &contents)
}

fn reminders_directory(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))
}

fn load_from_directory(directory: &Path) -> Result<Option<String>, String> {
    let reminders_path = directory.join(REMINDERS_FILE_NAME);
    match fs::read_to_string(&reminders_path) {
        Ok(contents) => match validate_reminders(&contents) {
            Ok(()) => Ok(Some(contents)),
            Err(error) => {
                preserve_corrupt_file(&reminders_path)?;
                eprintln!("Invalid reminders.json was preserved; using an empty list: {error}");
                Ok(None)
            }
        },
        Err(error) if error.kind() == ErrorKind::NotFound => load_backup(directory),
        Err(error) => Err(format!("Failed to read reminders.json: {error}")),
    }
}

fn load_backup(directory: &Path) -> Result<Option<String>, String> {
    let backup_path = directory.join(REMINDERS_BACKUP_FILE_NAME);
    match fs::read_to_string(&backup_path) {
        Ok(contents) => {
            validate_reminders(&contents)?;
            Ok(Some(contents))
        }
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Failed to read reminders backup: {error}")),
    }
}

fn save_to_directory(directory: &Path, contents: &str) -> Result<(), String> {
    validate_reminders(contents)?;
    fs::create_dir_all(directory)
        .map_err(|error| format!("Failed to create reminders directory: {error}"))?;

    let reminders_path = directory.join(REMINDERS_FILE_NAME);
    let temp_path = directory.join(REMINDERS_TEMP_FILE_NAME);
    let backup_path = directory.join(REMINDERS_BACKUP_FILE_NAME);
    write_synced(&temp_path, contents.as_bytes())?;

    if fs::rename(&temp_path, &reminders_path).is_ok() {
        let _ = fs::remove_file(&backup_path);
        return Ok(());
    }

    if reminders_path.exists() {
        let _ = fs::remove_file(&backup_path);
        fs::rename(&reminders_path, &backup_path)
            .map_err(|error| format!("Failed to stage reminders backup: {error}"))?;
    }

    if let Err(error) = fs::rename(&temp_path, &reminders_path) {
        if backup_path.exists() {
            let _ = fs::rename(&backup_path, &reminders_path);
        }
        return Err(format!("Failed to replace reminders.json: {error}"));
    }

    let _ = fs::remove_file(backup_path);
    Ok(())
}

fn preserve_corrupt_file(path: &Path) -> Result<(), String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let corrupt_path = path.with_file_name(format!("{REMINDERS_FILE_NAME}.corrupt-{timestamp}"));
    fs::rename(path, corrupt_path)
        .map_err(|error| format!("Failed to preserve invalid reminders.json: {error}"))
}

fn validate_reminders(contents: &str) -> Result<(), String> {
    let document: Value = serde_json::from_str(contents)
        .map_err(|error| format!("Reminders are not valid JSON: {error}"))?;

    if document.get("schemaVersion").and_then(Value::as_u64) != Some(1) {
        return Err("Unsupported reminders schemaVersion.".to_string());
    }
    if !document.get("reminders").is_some_and(Value::is_array) {
        return Err("Reminders must contain a reminders array.".to_string());
    }

    Ok(())
}

fn write_synced(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = fs::File::create(path)
        .map_err(|error| format!("Failed to create temporary reminders file: {error}"))?;
    file.write_all(bytes)
        .map_err(|error| format!("Failed to write temporary reminders file: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("Failed to flush temporary reminders file: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_directory(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "desktop-pet-reminders-{name}-{}",
            std::process::id()
        ))
    }

    #[test]
    fn persists_and_reloads_reminders() {
        let directory = test_directory("roundtrip");
        let _ = fs::remove_dir_all(&directory);
        let contents = r#"{"schemaVersion":1,"reminders":[]}"#;

        save_to_directory(&directory, contents).unwrap();
        assert_eq!(
            load_from_directory(&directory).unwrap().as_deref(),
            Some(contents)
        );

        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn preserves_corrupt_json_and_returns_empty_storage() {
        let directory = test_directory("corrupt");
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).unwrap();
        fs::write(directory.join(REMINDERS_FILE_NAME), "not json").unwrap();

        assert!(load_from_directory(&directory).unwrap().is_none());
        let preserved = fs::read_dir(&directory)
            .unwrap()
            .flatten()
            .find(|entry| entry.file_name().to_string_lossy().contains(".corrupt-"));
        assert_eq!(
            fs::read_to_string(preserved.unwrap().path()).unwrap(),
            "not json"
        );

        fs::remove_dir_all(directory).unwrap();
    }
}
