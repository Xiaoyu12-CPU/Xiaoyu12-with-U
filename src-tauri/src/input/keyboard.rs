use serde::Serialize;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};

use super::platform::{self, PermissionState, PlatformKeyboardMonitor};

const MAIN_WINDOW_LABEL: &str = "main";
pub const KEYBOARD_INPUT_EVENT: &str = "desktop-pet://keyboard-input";
pub const KEYBOARD_STATUS_EVENT: &str = "desktop-pet://keyboard-status";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum KeyboardMonitorStatus {
    Disabled,
    Starting,
    PermissionRequired,
    Active,
    Error,
    Unsupported,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum KeyboardEventType {
    Down,
    Up,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardInputEvent {
    pub event_type: KeyboardEventType,
    pub key: String,
    pub timestamp: u64,
}

impl KeyboardInputEvent {
    pub(crate) fn new(event_type: KeyboardEventType, key: String) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
            .try_into()
            .unwrap_or(u64::MAX);

        Self {
            event_type,
            key,
            timestamp,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardMonitorSnapshot {
    pub status: KeyboardMonitorStatus,
    pub message: Option<String>,
}

struct KeyboardMonitorInner {
    listener: Option<PlatformKeyboardMonitor>,
    status: KeyboardMonitorStatus,
    message: Option<String>,
    permission_requested: bool,
}

impl Default for KeyboardMonitorInner {
    fn default() -> Self {
        Self {
            listener: None,
            status: KeyboardMonitorStatus::Disabled,
            message: None,
            permission_requested: false,
        }
    }
}

#[derive(Default)]
pub struct KeyboardMonitor {
    inner: Mutex<KeyboardMonitorInner>,
}

impl KeyboardMonitor {
    fn start(&self, app: &AppHandle) -> KeyboardMonitorSnapshot {
        let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
        if inner.listener.is_some() {
            return snapshot(&inner);
        }

        inner.status = KeyboardMonitorStatus::Starting;
        inner.message = None;
        emit_status(app, &snapshot(&inner));

        match platform::permission_state() {
            PermissionState::Unsupported => {
                inner.status = KeyboardMonitorStatus::Unsupported;
                inner.message = Some(
                    "Global keyboard monitoring is not implemented on this platform yet."
                        .to_string(),
                );
            }
            PermissionState::Required => {
                if !inner.permission_requested {
                    inner.permission_requested = true;
                    platform::request_permission();
                }

                if platform::permission_state() != PermissionState::Granted {
                    inner.status = KeyboardMonitorStatus::PermissionRequired;
                    inner.message = Some(
                        "Allow DesktopPet in System Settings > Privacy & Security > Input Monitoring."
                            .to_string(),
                    );
                } else {
                    start_platform_listener(app, &mut inner);
                }
            }
            PermissionState::Granted => start_platform_listener(app, &mut inner),
        }

        let result = snapshot(&inner);
        emit_status(app, &result);
        result
    }

    fn stop(&self, app: &AppHandle) -> KeyboardMonitorSnapshot {
        let listener = {
            let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
            let listener = inner.listener.take();
            inner.status = KeyboardMonitorStatus::Disabled;
            inner.message = None;
            listener
        };

        if let Some(mut listener) = listener {
            listener.stop();
        }

        let result = KeyboardMonitorSnapshot {
            status: KeyboardMonitorStatus::Disabled,
            message: None,
        };
        emit_status(app, &result);
        result
    }
}

impl Drop for KeyboardMonitor {
    fn drop(&mut self) {
        if let Ok(inner) = self.inner.get_mut() {
            if let Some(mut listener) = inner.listener.take() {
                listener.stop();
            }
        }
    }
}

fn start_platform_listener(app: &AppHandle, inner: &mut KeyboardMonitorInner) {
    let event_app = app.clone();
    match platform::start(move |event| {
        if let Some(window) = event_app.get_webview_window(MAIN_WINDOW_LABEL) {
            let _ = window.emit(KEYBOARD_INPUT_EVENT, event);
        }
    }) {
        Ok(listener) => {
            inner.listener = Some(listener);
            inner.status = KeyboardMonitorStatus::Active;
            inner.message = None;
        }
        Err(error) => {
            inner.status = if platform::permission_state() == PermissionState::Required {
                KeyboardMonitorStatus::PermissionRequired
            } else {
                KeyboardMonitorStatus::Error
            };
            inner.message = Some(error);
        }
    }
}

fn snapshot(inner: &KeyboardMonitorInner) -> KeyboardMonitorSnapshot {
    KeyboardMonitorSnapshot {
        status: inner.status,
        message: inner.message.clone(),
    }
}

fn emit_status(app: &AppHandle, status: &KeyboardMonitorSnapshot) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.emit(KEYBOARD_STATUS_EVENT, status);
    }
}

#[tauri::command]
pub fn start_keyboard_monitor(
    app: AppHandle,
    monitor: State<'_, KeyboardMonitor>,
) -> KeyboardMonitorSnapshot {
    monitor.start(&app)
}

#[tauri::command]
pub fn stop_keyboard_monitor(
    app: AppHandle,
    monitor: State<'_, KeyboardMonitor>,
) -> KeyboardMonitorSnapshot {
    monitor.stop(&app)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_stable_keyboard_event_schema() {
        let event = KeyboardInputEvent {
            event_type: KeyboardEventType::Down,
            key: "A".to_string(),
            timestamp: 42,
        };
        let serialized = serde_json::to_value(event).unwrap();

        assert_eq!(serialized["eventType"], "down");
        assert_eq!(serialized["key"], "A");
        assert_eq!(serialized["timestamp"], 42);
    }

    #[test]
    fn serializes_permission_required_status() {
        let serialized = serde_json::to_value(KeyboardMonitorSnapshot {
            status: KeyboardMonitorStatus::PermissionRequired,
            message: None,
        })
        .unwrap();

        assert_eq!(serialized["status"], "permission-required");
    }
}
