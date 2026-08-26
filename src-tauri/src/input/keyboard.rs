use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State};

use super::monitor::InputMonitor;

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
        Self {
            event_type,
            key,
            timestamp: current_timestamp(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardMonitorSnapshot {
    pub status: KeyboardMonitorStatus,
    pub message: Option<String>,
}

#[tauri::command]
pub fn start_keyboard_monitor(
    app: AppHandle,
    monitor: State<'_, InputMonitor>,
) -> KeyboardMonitorSnapshot {
    monitor.start_keyboard(&app)
}

#[tauri::command]
pub fn stop_keyboard_monitor(
    app: AppHandle,
    monitor: State<'_, InputMonitor>,
) -> KeyboardMonitorSnapshot {
    monitor.stop_keyboard(&app)
}

pub(crate) fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
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
