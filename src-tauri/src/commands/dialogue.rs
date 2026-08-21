use serde_json::Value;
use std::fs;
use std::io::{ErrorKind, Write};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const DIALOGUE_FILE_NAME: &str = "dialogue.json";

#[tauri::command]
pub fn load_dialogue_catalog(app: AppHandle) -> Result<Option<String>, String> {
    let path = dialogue_file_path(&app)?;

    match fs::read_to_string(path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Failed to read dialogue JSON: {error}")),
    }
}

#[tauri::command]
pub fn save_dialogue_catalog(app: AppHandle, contents: String) -> Result<(), String> {
    validate_dialogue_document(&contents)?;
    let path = dialogue_file_path(&app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "Dialogue storage path has no parent directory.".to_string())?;

    fs::create_dir_all(parent)
        .map_err(|error| format!("Failed to create dialogue storage directory: {error}"))?;

    let mut file = fs::File::create(path)
        .map_err(|error| format!("Failed to open dialogue JSON for writing: {error}"))?;
    file.write_all(contents.as_bytes())
        .map_err(|error| format!("Failed to write dialogue JSON: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("Failed to flush dialogue JSON: {error}"))?;

    Ok(())
}

fn dialogue_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(DIALOGUE_FILE_NAME))
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))
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
