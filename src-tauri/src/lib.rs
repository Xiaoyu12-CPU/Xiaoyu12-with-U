// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;
mod input;

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
        .setup(|app| {
            if let Err(error) = commands::app::restore_pet_window_position(app.handle()) {
                eprintln!("Unable to restore the pet window position; using the platform default: {error}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::open_control_center,
            commands::app::exit_app,
            commands::app::apply_pet_window_settings,
            commands::app::sync_overlay_window,
            commands::app::resize_overlay_window,
            commands::app::follow_overlay_windows,
            commands::app::save_overlay_window_position,
            commands::app::save_pet_window_position,
            commands::app::reset_overlay_window_position,
            commands::battery::sample_battery_status,
            commands::cpu::sample_cpu_usage,
            commands::control_center_assets::upload_control_center_background,
            commands::control_center_assets::load_control_center_background,
            commands::control_center_assets::delete_control_center_background,
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
            commands::pointer::primary_mouse_button_pressed,
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
