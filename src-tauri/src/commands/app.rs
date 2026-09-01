use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::Instant,
};
use tauri::{
    AppHandle, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

const CONTROL_CENTER_LABEL: &str = "control-center";
const PET_WINDOW_LABEL: &str = "main";
const SYSTEM_STATUS_LABEL: &str = "system-status";
const KEYBOARD_HISTORY_LABEL: &str = "keyboard-history";
const MOUSE_VISUALIZER_LABEL: &str = "mouse-visualizer";
const WINDOW_POSITIONS_FILE: &str = "window-positions.json";
const MAX_WINDOW_SIZE: f64 = 1600.0;
const MAX_DEFAULT_OFFSET: f64 = 4000.0;

static WINDOW_OPERATION_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayWindowOptions {
    label: String,
    visible: bool,
    click_through: bool,
    always_on_top: bool,
    follow_pet: bool,
    default_offset_x: f64,
    default_offset_y: f64,
    width: f64,
    height: f64,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
struct StoredWindowPosition {
    x: i32,
    y: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    relative_x: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    relative_y: Option<f64>,
}

type StoredWindowPositions = HashMap<String, StoredWindowPosition>;

#[derive(Clone, Copy, Debug)]
struct OverlayBlueprint {
    title: &'static str,
    minimum_width: f64,
    minimum_height: f64,
}

fn overlay_blueprint(label: &str) -> Option<OverlayBlueprint> {
    match label {
        SYSTEM_STATUS_LABEL => Some(OverlayBlueprint {
            title: "withXiaoyu12 系统状态",
            minimum_width: 140.0,
            minimum_height: 80.0,
        }),
        KEYBOARD_HISTORY_LABEL => Some(OverlayBlueprint {
            title: "withXiaoyu12 键盘历史",
            minimum_width: 96.0,
            minimum_height: 48.0,
        }),
        MOUSE_VISUALIZER_LABEL => Some(OverlayBlueprint {
            title: "withXiaoyu12 鼠标输入",
            minimum_width: 72.0,
            minimum_height: 96.0,
        }),
        _ => None,
    }
}

fn validate_overlay_options(options: &OverlayWindowOptions) -> Result<OverlayBlueprint, String> {
    let blueprint = overlay_blueprint(&options.label)
        .ok_or_else(|| format!("Unknown overlay window: {}", options.label))?;
    validate_window_size(options.width, options.height)?;
    if !options.default_offset_x.is_finite()
        || !options.default_offset_y.is_finite()
        || options.default_offset_x.abs() > MAX_DEFAULT_OFFSET
        || options.default_offset_y.abs() > MAX_DEFAULT_OFFSET
    {
        return Err("Overlay default offset is invalid.".to_string());
    }
    Ok(blueprint)
}

fn validate_overlay_label(label: &str) -> Result<(), String> {
    overlay_blueprint(label)
        .map(|_| ())
        .ok_or_else(|| format!("Unknown overlay window: {label}"))
}

fn validate_window_size(width: f64, height: f64) -> Result<(), String> {
    if width.is_finite()
        && height.is_finite()
        && (1.0..=MAX_WINDOW_SIZE).contains(&width)
        && (1.0..=MAX_WINDOW_SIZE).contains(&height)
    {
        Ok(())
    } else {
        Err(format!(
            "Window size must be between 1 and {MAX_WINDOW_SIZE} logical pixels."
        ))
    }
}

fn lock_window_operations() -> Result<std::sync::MutexGuard<'static, ()>, String> {
    WINDOW_OPERATION_LOCK
        .lock()
        .map_err(|_| "Window coordinator lock was poisoned.".to_string())
}

/// Reconciles one allow-listed overlay window. The main window calls this
/// through a single latest-state queue, while this backend lock also protects
/// position-file updates coming from overlay windows.
#[tauri::command]
pub async fn sync_overlay_window(
    app: AppHandle,
    options: OverlayWindowOptions,
) -> Result<(), String> {
    let _guard = lock_window_operations()?;
    let blueprint = validate_overlay_options(&options)?;

    if !options.visible {
        if let Some(window) = app.get_webview_window(&options.label) {
            window
                .hide()
                .map_err(|error| format!("Failed to hide {}: {error}", options.label))?;
        }
        return Ok(());
    }

    let (window, was_created) = match app.get_webview_window(&options.label) {
        Some(window) => (window, false),
        None => {
            let window = WebviewWindowBuilder::new(
                &app,
                &options.label,
                WebviewUrl::App("index.html".into()),
            )
            .title(blueprint.title)
            .inner_size(options.width, options.height)
            .min_inner_size(blueprint.minimum_width, blueprint.minimum_height)
            .resizable(false)
            .decorations(false)
            .shadow(false)
            .transparent(true)
            .always_on_top(options.always_on_top)
            .skip_taskbar(true)
            .focused(false)
            .visible(false)
            .build()
            .map_err(|error| format!("Failed to create {}: {error}", options.label))?;
            (window, true)
        }
    };

    if was_created {
        window
            .set_size(LogicalSize::new(options.width, options.height))
            .map_err(|error| format!("Failed to resize {}: {error}", options.label))?;
    }
    window
        .set_always_on_top(options.always_on_top)
        .map_err(|error| format!("Failed to update {} always-on-top: {error}", options.label))?;
    window
        .set_ignore_cursor_events(options.click_through)
        .map_err(|error| format!("Failed to update {} click-through: {error}", options.label))?;

    if was_created || options.follow_pet {
        position_overlay(
            &app,
            &window,
            &options.label,
            options.follow_pet,
            options.default_offset_x,
            options.default_offset_y,
        )?;
    }

    window
        .show()
        .map_err(|error| format!("Failed to show {}: {error}", options.label))?;
    Ok(())
}

#[tauri::command]
pub async fn resize_overlay_window(
    app: AppHandle,
    label: String,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let _guard = lock_window_operations()?;
    validate_overlay_label(&label)?;
    validate_window_size(width, height)?;
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Overlay window {label} is not open."))?;
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|error| format!("Failed to resize {label}: {error}"))
}

/// Aligns following overlays from the pet's current absolute position. Using
/// absolute targets avoids cumulative delta and mixed-DPI drift.
#[tauri::command]
pub async fn follow_overlay_windows(app: AppHandle, labels: Vec<String>) -> Result<(), String> {
    let _guard = lock_window_operations()?;
    let pet = pet_window(&app)?;
    let pet_position = pet
        .outer_position()
        .map_err(|error| format!("Failed to read pet window position: {error}"))?;
    let pet_scale = pet
        .scale_factor()
        .map_err(|error| format!("Failed to read pet window scale factor: {error}"))?;
    let positions = load_window_positions(&app)?;

    for label in labels {
        validate_overlay_label(&label)?;
        let Some(window) = app.get_webview_window(&label) else {
            continue;
        };
        if !window.is_visible().unwrap_or(false) {
            continue;
        }
        let Some(saved) = positions.get(&label) else {
            continue;
        };
        let target = relative_target(pet_position, pet_scale, *saved);
        window
            .set_position(target)
            .map_err(|error| format!("Failed to follow pet with {label}: {error}"))?;
    }
    Ok(())
}

/// Saves both an absolute position (free mode) and a logical pet-relative
/// offset (follow mode). This is called after native dragging settles.
#[tauri::command]
pub async fn save_overlay_window_position(app: AppHandle, label: String) -> Result<(), String> {
    let _guard = lock_window_operations()?;
    validate_overlay_label(&label)?;
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Overlay window {label} is not open."))?;
    let saved = capture_window_position(&app, &window)?;
    let mut positions = load_window_positions(&app)?;
    positions.insert(label, saved);
    write_window_positions(&app, &positions)
}

#[tauri::command]
pub async fn reset_overlay_window_position(
    app: AppHandle,
    label: String,
    default_offset_x: f64,
    default_offset_y: f64,
) -> Result<(), String> {
    let _guard = lock_window_operations()?;
    validate_overlay_label(&label)?;
    if !default_offset_x.is_finite()
        || !default_offset_y.is_finite()
        || default_offset_x.abs() > MAX_DEFAULT_OFFSET
        || default_offset_y.abs() > MAX_DEFAULT_OFFSET
    {
        return Err("Overlay default offset is invalid.".to_string());
    }

    let mut positions = load_window_positions(&app)?;
    positions.remove(&label);
    if let Some(window) = app.get_webview_window(&label) {
        let saved =
            set_default_overlay_position(&app, &window, default_offset_x, default_offset_y)?;
        positions.insert(label, saved);
    }
    write_window_positions(&app, &positions)
}

fn position_overlay(
    app: &AppHandle,
    window: &WebviewWindow,
    label: &str,
    follow_pet: bool,
    default_offset_x: f64,
    default_offset_y: f64,
) -> Result<(), String> {
    let mut positions = load_window_positions(app)?;
    if let Some(mut saved) = positions.get(label).copied() {
        let target = if follow_pet {
            let pet = pet_window(app)?;
            let pet_position = pet
                .outer_position()
                .map_err(|error| format!("Failed to read pet window position: {error}"))?;
            let pet_scale = pet
                .scale_factor()
                .map_err(|error| format!("Failed to read pet window scale factor: {error}"))?;
            if saved.relative_x.is_none() || saved.relative_y.is_none() {
                saved.relative_x = Some(f64::from(saved.x - pet_position.x) / pet_scale);
                saved.relative_y = Some(f64::from(saved.y - pet_position.y) / pet_scale);
                positions.insert(label.to_string(), saved);
                write_window_positions(app, &positions)?;
            }
            relative_target(pet_position, pet_scale, saved)
        } else {
            PhysicalPosition::new(saved.x, saved.y)
        };
        window
            .set_position(target)
            .map_err(|error| format!("Failed to restore {label} position: {error}"))?;
        return Ok(());
    }

    let saved = set_default_overlay_position(app, window, default_offset_x, default_offset_y)?;
    positions.insert(label.to_string(), saved);
    write_window_positions(app, &positions)
}

fn set_default_overlay_position(
    app: &AppHandle,
    window: &WebviewWindow,
    offset_x: f64,
    offset_y: f64,
) -> Result<StoredWindowPosition, String> {
    let pet = pet_window(app)?;
    let pet_position = pet
        .outer_position()
        .map_err(|error| format!("Failed to read pet window position: {error}"))?;
    let pet_scale = pet
        .scale_factor()
        .map_err(|error| format!("Failed to read pet window scale factor: {error}"))?;
    let target = PhysicalPosition::new(
        pet_position.x + (offset_x * pet_scale).round() as i32,
        pet_position.y + (offset_y * pet_scale).round() as i32,
    );
    window
        .set_position(target)
        .map_err(|error| format!("Failed to place overlay window: {error}"))?;
    Ok(StoredWindowPosition {
        x: target.x,
        y: target.y,
        relative_x: Some(offset_x),
        relative_y: Some(offset_y),
    })
}

fn capture_window_position(
    app: &AppHandle,
    window: &WebviewWindow,
) -> Result<StoredWindowPosition, String> {
    let pet = pet_window(app)?;
    let pet_position = pet
        .outer_position()
        .map_err(|error| format!("Failed to read pet window position: {error}"))?;
    let pet_scale = pet
        .scale_factor()
        .map_err(|error| format!("Failed to read pet window scale factor: {error}"))?;
    let position = window
        .outer_position()
        .map_err(|error| format!("Failed to read overlay window position: {error}"))?;
    Ok(StoredWindowPosition {
        x: position.x,
        y: position.y,
        relative_x: Some(f64::from(position.x - pet_position.x) / pet_scale),
        relative_y: Some(f64::from(position.y - pet_position.y) / pet_scale),
    })
}

fn relative_target(
    pet_position: PhysicalPosition<i32>,
    pet_scale: f64,
    saved: StoredWindowPosition,
) -> PhysicalPosition<i32> {
    PhysicalPosition::new(
        pet_position.x
            + (saved
                .relative_x
                .unwrap_or_else(|| f64::from(saved.x - pet_position.x) / pet_scale)
                * pet_scale)
                .round() as i32,
        pet_position.y
            + (saved
                .relative_y
                .unwrap_or_else(|| f64::from(saved.y - pet_position.y) / pet_scale)
                * pet_scale)
                .round() as i32,
    )
}

fn pet_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(PET_WINDOW_LABEL)
        .ok_or_else(|| "Main pet window was not found.".to_string())
}

fn positions_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(WINDOW_POSITIONS_FILE))
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))
}

fn load_window_positions(app: &AppHandle) -> Result<StoredWindowPositions, String> {
    let path = positions_path(app)?;
    match fs::read_to_string(path) {
        Ok(contents) => serde_json::from_str(&contents)
            .map_err(|error| format!("Failed to parse window positions: {error}")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(HashMap::new()),
        Err(error) => Err(format!("Failed to read window positions: {error}")),
    }
}

fn write_window_positions(
    app: &AppHandle,
    positions: &StoredWindowPositions,
) -> Result<(), String> {
    let path = positions_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create app data directory: {error}"))?;
    }
    let contents = serde_json::to_string_pretty(positions)
        .map_err(|error| format!("Failed to serialize window positions: {error}"))?;
    atomic_replace(&path, contents.as_bytes())
}

fn atomic_replace(path: &Path, contents: &[u8]) -> Result<(), String> {
    let temp_path = path.with_extension("json.tmp");
    let backup_path = path.with_extension("json.bak");
    fs::write(&temp_path, contents)
        .map_err(|error| format!("Failed to write temporary window positions: {error}"))?;
    if fs::rename(&temp_path, path).is_ok() {
        return Ok(());
    }

    if path.exists() {
        let _ = fs::remove_file(&backup_path);
        fs::rename(path, &backup_path)
            .map_err(|error| format!("Failed to back up window positions: {error}"))?;
    }
    if let Err(error) = fs::rename(&temp_path, path) {
        if backup_path.exists() {
            let _ = fs::rename(&backup_path, path);
        }
        return Err(format!("Failed to replace window positions: {error}"));
    }
    let _ = fs::remove_file(backup_path);
    Ok(())
}

#[tauri::command]
pub async fn open_control_center(app: AppHandle) -> Result<(), String> {
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
) -> Result<(), String> {
    if !(0.5..=2.0).contains(&pet_scale) {
        return Err("petScale must be between 0.5 and 2.0.".to_string());
    }
    let window = pet_window(&app)?;
    let size = 200.0 * pet_scale.max(1.0);
    window
        .set_size(LogicalSize::new(size, size))
        .map_err(|error| format!("Failed to resize pet window: {error}"))?;
    window
        .set_always_on_top(always_on_top)
        .map_err(|error| format!("Failed to update always-on-top: {error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_exactly_three_overlay_blueprints() {
        assert!(overlay_blueprint(SYSTEM_STATUS_LABEL).is_some());
        assert!(overlay_blueprint(KEYBOARD_HISTORY_LABEL).is_some());
        assert!(overlay_blueprint(MOUSE_VISUALIZER_LABEL).is_some());
        assert!(overlay_blueprint("input-monitor").is_none());
        assert!(overlay_blueprint(PET_WINDOW_LABEL).is_none());
    }

    #[test]
    fn absolute_follow_target_does_not_accumulate_deltas() {
        let saved = StoredWindowPosition {
            x: 0,
            y: 0,
            relative_x: Some(210.0),
            relative_y: Some(-25.0),
        };
        assert_eq!(
            relative_target(PhysicalPosition::new(100, 200), 2.0, saved),
            PhysicalPosition::new(520, 150),
        );
        assert_eq!(
            relative_target(PhysicalPosition::new(-30, 40), 1.0, saved),
            PhysicalPosition::new(180, 15),
        );
    }

    #[test]
    fn validates_window_sizes() {
        assert!(validate_window_size(240.0, 320.0).is_ok());
        assert!(validate_window_size(0.0, 320.0).is_err());
        assert!(validate_window_size(f64::NAN, 320.0).is_err());
        assert!(validate_window_size(1601.0, 320.0).is_err());
    }

    #[test]
    fn accepts_v042_absolute_only_position_records() {
        let saved: StoredWindowPosition = serde_json::from_str(r#"{"x":120,"y":80}"#)
            .expect("v0.4.2 position record should remain readable");
        assert_eq!(saved.x, 120);
        assert_eq!(saved.y, 80);
        assert_eq!(saved.relative_x, None);
        assert_eq!(saved.relative_y, None);
        assert_eq!(
            relative_target(PhysicalPosition::new(100, 50), 2.0, saved),
            PhysicalPosition::new(120, 80),
        );
    }
}
