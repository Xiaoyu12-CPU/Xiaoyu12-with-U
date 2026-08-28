use serde::Serialize;
use tauri::{AppHandle, State};

use super::keyboard::current_timestamp;
use super::monitor::InputMonitor;

pub const MOUSE_INPUT_EVENT: &str = "desktop-pet://mouse-input";
pub const MOUSE_STATUS_EVENT: &str = "desktop-pet://mouse-status";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MouseMonitorStatus {
    Disabled,
    Starting,
    PermissionRequired,
    Active,
    Error,
    Unsupported,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MouseEventType {
    Down,
    Up,
    Scroll,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MouseButton {
    Left,
    Right,
    Middle,
    Mouse4,
    Mouse5,
    Other,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ScrollDirection {
    Up,
    Down,
    Left,
    Right,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MouseInputEvent {
    pub event_type: MouseEventType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub button: Option<MouseButton>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scroll_direction: Option<ScrollDirection>,
    pub timestamp: u64,
}

impl MouseInputEvent {
    pub(crate) fn button(event_type: MouseEventType, button: MouseButton) -> Self {
        Self {
            event_type,
            button: Some(button),
            scroll_direction: None,
            timestamp: current_timestamp(),
        }
    }

    pub(crate) fn scroll(direction: ScrollDirection) -> Self {
        Self {
            event_type: MouseEventType::Scroll,
            button: None,
            scroll_direction: Some(direction),
            timestamp: current_timestamp(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MouseMonitorSnapshot {
    pub status: MouseMonitorStatus,
    pub message: Option<String>,
}

// NOTE: must stay async - see the comment on the keyboard monitor commands.
#[tauri::command]
pub async fn start_mouse_monitor(
    app: AppHandle,
    monitor: State<'_, InputMonitor>,
) -> Result<MouseMonitorSnapshot, String> {
    Ok(monitor.start_mouse(&app))
}

#[tauri::command]
pub async fn stop_mouse_monitor(
    app: AppHandle,
    monitor: State<'_, InputMonitor>,
) -> Result<MouseMonitorSnapshot, String> {
    Ok(monitor.stop_mouse(&app))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_button_event_without_private_context() {
        let event = MouseInputEvent {
            event_type: MouseEventType::Down,
            button: Some(MouseButton::Mouse4),
            scroll_direction: None,
            timestamp: 42,
        };
        let serialized = serde_json::to_value(event).unwrap();

        assert_eq!(serialized["eventType"], "down");
        assert_eq!(serialized["button"], "mouse4");
        assert_eq!(serialized["timestamp"], 42);
        assert!(serialized.get("scrollDirection").is_none());
        assert!(serialized.get("x").is_none());
        assert!(serialized.get("y").is_none());
    }

    #[test]
    fn serializes_scroll_event_without_button() {
        let event = MouseInputEvent {
            event_type: MouseEventType::Scroll,
            button: None,
            scroll_direction: Some(ScrollDirection::Up),
            timestamp: 84,
        };
        let serialized = serde_json::to_value(event).unwrap();

        assert_eq!(serialized["eventType"], "scroll");
        assert_eq!(serialized["scrollDirection"], "up");
        assert!(serialized.get("button").is_none());
    }
}
