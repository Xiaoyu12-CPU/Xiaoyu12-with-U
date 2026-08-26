// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;
mod input;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(commands::battery::BatterySampler::default())
        .manage(commands::cpu::CpuSampler::default())
        .manage(commands::memory::MemorySampler::default())
        .manage(commands::network::NetworkSampler::default())
        .manage(commands::storage::StorageSampler::default())
        .manage(input::monitor::InputMonitor::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::app::open_control_center,
            commands::app::exit_app,
            commands::app::apply_pet_window_settings,
            commands::battery::sample_battery_status,
            commands::cpu::sample_cpu_usage,
            commands::memory::sample_memory_usage,
            commands::network::sample_network_throughput,
            commands::storage::sample_storage_usage,
            commands::dialogue::load_dialogue_catalog,
            commands::dialogue::save_dialogue_catalog,
            commands::pet_assets::load_user_pet_manifest,
            commands::pet_assets::save_user_pet_manifest,
            commands::pet_assets::upload_user_pet_png,
            commands::pet_assets::load_user_pet_png,
            commands::pet_assets::delete_user_pet_png,
            commands::reminders::load_reminders,
            commands::reminders::save_reminders,
            commands::settings::load_settings,
            commands::settings::save_settings,
            input::keyboard::start_keyboard_monitor,
            input::keyboard::stop_keyboard_monitor,
            input::mouse::start_mouse_monitor,
            input::mouse::stop_mouse_monitor,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
