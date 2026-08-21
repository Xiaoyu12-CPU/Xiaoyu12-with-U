// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::app::open_control_center,
            commands::app::exit_app,
            commands::dialogue::load_dialogue_catalog,
            commands::dialogue::save_dialogue_catalog,
            commands::pet_assets::load_user_pet_manifest,
            commands::pet_assets::save_user_pet_manifest,
            commands::pet_assets::upload_user_pet_png,
            commands::pet_assets::load_user_pet_png,
            commands::pet_assets::delete_user_pet_png,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
