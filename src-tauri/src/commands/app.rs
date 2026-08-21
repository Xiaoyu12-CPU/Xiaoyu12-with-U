use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const CONTROL_CENTER_LABEL: &str = "control-center";

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
        WebviewUrl::App("index.html?window=control-center".into()),
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
