use serde_json::Value;
use std::fs;
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const SETTINGS_FILE_NAME: &str = "settings.json";
const SETTINGS_TEMP_FILE_NAME: &str = "settings.json.tmp";
const SETTINGS_BACKUP_FILE_NAME: &str = "settings.json.bak";

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<Option<String>, String> {
    let directory = settings_directory(&app)?;
    let settings_path = directory.join(SETTINGS_FILE_NAME);

    match fs::read_to_string(&settings_path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == ErrorKind::NotFound => {
            let backup_path = directory.join(SETTINGS_BACKUP_FILE_NAME);
            match fs::read_to_string(backup_path) {
                Ok(contents) => Ok(Some(contents)),
                Err(backup_error) if backup_error.kind() == ErrorKind::NotFound => Ok(None),
                Err(backup_error) => Err(format!("Failed to read settings backup: {backup_error}")),
            }
        }
        Err(error) => Err(format!("Failed to read settings.json: {error}")),
    }
}

#[tauri::command]
pub fn save_settings(app: AppHandle, contents: String) -> Result<(), String> {
    validate_settings(&contents)?;
    let directory = settings_directory(&app)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Failed to create settings directory: {error}"))?;

    let settings_path = directory.join(SETTINGS_FILE_NAME);
    let temp_path = directory.join(SETTINGS_TEMP_FILE_NAME);
    let backup_path = directory.join(SETTINGS_BACKUP_FILE_NAME);
    write_synced(&temp_path, contents.as_bytes())?;

    if fs::rename(&temp_path, &settings_path).is_ok() {
        let _ = fs::remove_file(&backup_path);
        return Ok(());
    }

    if settings_path.exists() {
        let _ = fs::remove_file(&backup_path);
        fs::rename(&settings_path, &backup_path)
            .map_err(|error| format!("Failed to stage settings backup: {error}"))?;
    }

    if let Err(error) = fs::rename(&temp_path, &settings_path) {
        if backup_path.exists() {
            let _ = fs::rename(&backup_path, &settings_path);
        }
        return Err(format!("Failed to replace settings.json: {error}"));
    }

    let _ = fs::remove_file(backup_path);
    Ok(())
}

fn settings_directory(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))
}

fn validate_settings(contents: &str) -> Result<(), String> {
    let document: Value = serde_json::from_str(contents)
        .map_err(|error| format!("Settings are not valid JSON: {error}"))?;

    if document.get("schemaVersion").and_then(Value::as_u64) != Some(1) {
        return Err("Unsupported settings schemaVersion.".to_string());
    }

    for section in [
        "appearance",
        "dialogue",
        "animation",
        "systemMonitor",
        "input",
        "reminder",
    ] {
        if !document.get(section).is_some_and(Value::is_object) {
            return Err(format!("Settings section \"{section}\" must be an object."));
        }
    }

    Ok(())
}

fn write_synced(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = fs::File::create(path)
        .map_err(|error| format!("Failed to create temporary settings file: {error}"))?;
    file.write_all(bytes)
        .map_err(|error| format!("Failed to write temporary settings file: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("Failed to flush temporary settings file: {error}"))
}
