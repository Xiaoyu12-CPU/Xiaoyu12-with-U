use tauri::{AppHandle, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder};

const CONTROL_CENTER_LABEL: &str = "control-center";
const PET_WINDOW_LABEL: &str = "main";

#[tauri::command]
pub fn open_control_center(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(CONTROL_CENTER_LABEL) {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        CONTROL_CENTER_LABEL,
        WebviewUrl::App("index.html".into()),
    )
    .title("DesktopPet 控制中心")
    .inner_size(760.0, 600.0)
    .min_inner_size(620.0, 480.0)
    .resizable(true)
    .decorations(true)
    .transparent(false)
    .center()
    .build()
    .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn exit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn apply_pet_window_settings(
    app: AppHandle,
    pet_scale: f64,
    always_on_top: bool,
    window_width: Option<f64>,
    window_height: Option<f64>,
    position_delta_x: Option<f64>,
    position_delta_y: Option<f64>,
) -> Result<(), String> {
    if !(0.5..=2.0).contains(&pet_scale) {
        return Err("petScale must be between 0.5 and 2.0.".to_string());
    }

    let window = app
        .get_webview_window(PET_WINDOW_LABEL)
        .ok_or_else(|| "Main pet window was not found.".to_string())?;
    let fallback_size = 200.0 * pet_scale.max(1.0);
    let width = window_width.unwrap_or(fallback_size);
    let height = window_height.unwrap_or(fallback_size);

    if !width.is_finite()
        || !height.is_finite()
        || !(1.0..=1200.0).contains(&width)
        || !(1.0..=1200.0).contains(&height)
    {
        return Err("Pet window layout must be between 1 and 1200 logical pixels.".to_string());
    }

    let delta_x = position_delta_x.unwrap_or(0.0);
    let delta_y = position_delta_y.unwrap_or(0.0);
    if !delta_x.is_finite()
        || !delta_y.is_finite()
        || delta_x.abs() > 1000.0
        || delta_y.abs() > 1000.0
    {
        return Err("Pet window position delta is invalid.".to_string());
    }

    if delta_x != 0.0 || delta_y != 0.0 {
        let scale_factor = window
            .scale_factor()
            .map_err(|error| format!("Failed to read pet window scale factor: {error}"))?;
        let current_position = window
            .outer_position()
            .map_err(|error| format!("Failed to read pet window position: {error}"))?;
        let next_position = PhysicalPosition::new(
            current_position.x + (delta_x * scale_factor).round() as i32,
            current_position.y + (delta_y * scale_factor).round() as i32,
        );

        window
            .set_position(next_position)
            .map_err(|error| format!("Failed to reposition pet window: {error}"))?;
    }

    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|error| format!("Failed to resize pet window: {error}"))?;
    window
        .set_always_on_top(always_on_top)
        .map_err(|error| format!("Failed to update always-on-top: {error}"))?;

    Ok(())
}
