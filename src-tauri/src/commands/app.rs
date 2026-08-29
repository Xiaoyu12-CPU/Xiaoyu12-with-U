use std::time::Instant;
use tauri::{AppHandle, LogicalSize, LogicalPosition, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder};

const CONTROL_CENTER_LABEL: &str = "control-center";
const PET_WINDOW_LABEL: &str = "main";
const SYSTEM_STATUS_LABEL: &str = "system-status";
const INPUT_MONITOR_LABEL: &str = "input-monitor";

/// Overlay window blueprints. Sizes and titles are fixed on the Rust side so
/// the frontend cannot open arbitrary windows; each window loads the same
/// index.html and routes by its label.
fn overlay_blueprint(label: &str) -> Option<(&'static str, &'static str, f64, f64)> {
    match label {
        SYSTEM_STATUS_LABEL => Some((SYSTEM_STATUS_LABEL, "withXiaoyu12 系统状态", 230.0, 320.0)),
        INPUT_MONITOR_LABEL => Some((INPUT_MONITOR_LABEL, "withXiaoyu12 键鼠监视", 240.0, 360.0)),
        _ => None,
    }
}

/// Opens one of the floating overlay windows (system-status / input-monitor).
/// Must stay async: on Windows, WebviewWindowBuilder::build() deadlocks when
/// called from a synchronous command or event handler.
#[tauri::command]
pub async fn open_overlay_window(app: AppHandle, label: String) -> Result<(), String> {
    let (label, title, width, height) =
        overlay_blueprint(&label).ok_or_else(|| format!("Unknown overlay window: {label}"))?;

    if let Some(window) = app.get_webview_window(label) {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    let built = WebviewWindowBuilder::new(&app, label, WebviewUrl::App("index.html".into()))
        .title(title)
        .inner_size(width, height)
        .min_inner_size(160.0, 160.0)
        .resizable(true)
        .decorations(false)
        .shadow(false)
        .transparent(true)
        .always_on_top(true)
        .build();
    built.map_err(|error| error.to_string())?;

    Ok(())
}

/// Repositions an overlay window relative to the pet window (follow-pet mode).
#[tauri::command]
pub async fn move_overlay_window(
    app: AppHandle,
    label: String,
    delta_x: f64,
    delta_y: f64,
) -> Result<(), String> {
    if !delta_x.is_finite() || !delta_y.is_finite() {
        return Err("Overlay position delta must be finite.".to_string());
    }
    if delta_x.abs() > 2000.0 || delta_y.abs() > 2000.0 {
        return Err("Overlay position delta is too large.".to_string());
    }

    let (label, ..) =
        overlay_blueprint(&label).ok_or_else(|| format!("Unknown overlay window: {label}"))?;
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("Overlay window {label} is not open."))?;

    let scale_factor = window
        .scale_factor()
        .map_err(|error| format!("Failed to read scale factor: {error}"))?;
    let current = window
        .outer_position()
        .map_err(|error| format!("Failed to read overlay position: {error}"))?;
    window
        .set_position(PhysicalPosition::new(
            current.x + (delta_x * scale_factor).round() as i32,
            current.y + (delta_y * scale_factor).round() as i32,
        ))
        .map_err(|error| format!("Failed to move overlay window: {error}"))?;

    Ok(())
}

/// Enables or disables mouse click-through for an overlay window.
#[tauri::command]
pub async fn set_overlay_click_through(
    app: AppHandle,
    label: String,
    enabled: bool,
) -> Result<(), String> {
    let (label, ..) =
        overlay_blueprint(&label).ok_or_else(|| format!("Unknown overlay window: {label}"))?;
    let window = app.get_webview_window(label);

    match window {
        Some(window) => window
            .set_ignore_cursor_events(enabled)
            .map_err(|error| format!("Failed to update click-through: {error}")),
        // Window not open: nothing to do; the flag is applied on open.
        None => Ok(()),
    }
}

const WINDOW_POSITIONS_FILE: &str = "window-positions.json";

fn validate_overlay_label(label: &str) -> Result<(), String> {
    if overlay_blueprint(label).is_none() {
        return Err(format!("Unknown overlay window: {label}"));
    }
    Ok(())
}

fn positions_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))
}

/// Persists an overlay window position so it reopens where the user left it.
#[tauri::command]
pub fn save_window_position(app: AppHandle, label: String, x: i32, y: i32) -> Result<(), String> {
    validate_overlay_label(&label)?;

    let path = positions_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create app data directory: {error}"))?;
    }

    let mut positions = match std::fs::read_to_string(&path) {
        Ok(contents) => serde_json::from_str::<serde_json::Value>(&contents)
            .unwrap_or_else(|_| serde_json::json!({})),
        Err(_) => serde_json::json!({}),
    };

    if !positions.is_object() {
        positions = serde_json::json!({});
    }
    positions[&label] = serde_json::json!({ "x": x, "y": y });

    std::fs::write(&path, serde_json::to_string(&positions).unwrap_or_default())
        .map_err(|error| format!("Failed to save window positions: {error}"))?;
    Ok(())
}

/// Loads a previously saved overlay window position, if any.
#[tauri::command]
pub fn load_window_position(
    app: AppHandle,
    label: String,
) -> Result<Option<(i32, i32)>, String> {
    validate_overlay_label(&label)?;

    let path = positions_path(&app)?;
    let contents = match std::fs::read_to_string(&path) {
        Ok(contents) => contents,
        Err(_) => return Ok(None),
    };

    let positions: serde_json::Value = match serde_json::from_str(&contents) {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };

    let entry = positions.get(&label)?.clone();
    let x = entry.get("x").and_then(serde_json::Value::as_i64)?;
    let y = entry.get("y").and_then(serde_json::Value::as_i64)?;
    Ok(Some((x as i32, y as i32)))
}

#[tauri::command]
pub async fn open_control_center(app: AppHandle) -> Result<(), String> {
    // NOTE: must stay async. On Windows, WebviewWindowBuilder::build()
    // deadlocks when called from a synchronous command or event handler
    // (see tauri docs on WebviewWindowBuilder / Webview2 issue); async
    // commands run outside the main thread, which avoids the deadlock.
    if let Some(window) = app.get_webview_window(CONTROL_CENTER_LABEL) {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    let started_at = Instant::now();
    let built = WebviewWindowBuilder::new(
        &app,
        CONTROL_CENTER_LABEL,
        WebviewUrl::App("index.html".into()),
    )
    .title("withXiaoyu12 控制中心")
    .inner_size(760.0, 600.0)
    .min_inner_size(620.0, 480.0)
    .resizable(true)
    .decorations(true)
    .transparent(false)
    .center()
    .build();
    eprintln!(
        "open-control-center: build finished in {:?} result={}",
        started_at.elapsed(),
        if built.is_ok() { "ok" } else { "error" }
    );
    built.map_err(|error| error.to_string())?;

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
