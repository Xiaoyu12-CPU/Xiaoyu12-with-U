use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

use super::keyboard::{
    KeyboardInputEvent, KeyboardMonitorSnapshot, KeyboardMonitorStatus, KEYBOARD_INPUT_EVENT,
    KEYBOARD_STATUS_EVENT,
};
use super::mouse::{
    MouseInputEvent, MouseMonitorSnapshot, MouseMonitorStatus, MOUSE_INPUT_EVENT,
    MOUSE_STATUS_EVENT,
};
use super::platform::{self, PermissionState, PlatformInputMonitor};

const MAIN_WINDOW_LABEL: &str = "main";

pub(crate) enum NativeInputEvent {
    Keyboard(KeyboardInputEvent),
    Mouse(MouseInputEvent),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum SharedMonitorStatus {
    Disabled,
    Starting,
    PermissionRequired,
    Active,
    Error,
    Unsupported,
}

struct InputMonitorInner {
    listener: Option<PlatformInputMonitor>,
    status: SharedMonitorStatus,
    message: Option<String>,
    permission_requested: bool,
}

impl Default for InputMonitorInner {
    fn default() -> Self {
        Self {
            listener: None,
            status: SharedMonitorStatus::Disabled,
            message: None,
            permission_requested: false,
        }
    }
}

pub struct InputMonitor {
    inner: Mutex<InputMonitorInner>,
    keyboard_enabled: Arc<AtomicBool>,
    mouse_enabled: Arc<AtomicBool>,
}

impl Default for InputMonitor {
    fn default() -> Self {
        Self {
            inner: Mutex::new(InputMonitorInner::default()),
            keyboard_enabled: Arc::new(AtomicBool::new(false)),
            mouse_enabled: Arc::new(AtomicBool::new(false)),
        }
    }
}

impl InputMonitor {
    pub fn start_keyboard(&self, app: &AppHandle) -> KeyboardMonitorSnapshot {
        self.keyboard_enabled.store(true, Ordering::Release);
        self.ensure_started(app, InputChannel::Keyboard);
        let result = self.keyboard_snapshot();
        emit_keyboard_status(app, &result);
        result
    }

    pub fn stop_keyboard(&self, app: &AppHandle) -> KeyboardMonitorSnapshot {
        self.keyboard_enabled.store(false, Ordering::Release);
        self.stop_if_unused();
        let result = KeyboardMonitorSnapshot {
            status: KeyboardMonitorStatus::Disabled,
            message: None,
        };
        emit_keyboard_status(app, &result);
        result
    }

    pub fn start_mouse(&self, app: &AppHandle) -> MouseMonitorSnapshot {
        self.mouse_enabled.store(true, Ordering::Release);
        self.ensure_started(app, InputChannel::Mouse);
        let result = self.mouse_snapshot();
        emit_mouse_status(app, &result);
        result
    }

    pub fn stop_mouse(&self, app: &AppHandle) -> MouseMonitorSnapshot {
        self.mouse_enabled.store(false, Ordering::Release);
        self.stop_if_unused();
        let result = MouseMonitorSnapshot {
            status: MouseMonitorStatus::Disabled,
            message: None,
        };
        emit_mouse_status(app, &result);
        result
    }

    fn ensure_started(&self, app: &AppHandle, channel: InputChannel) {
        let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
        if inner.listener.is_some() {
            return;
        }

        inner.status = SharedMonitorStatus::Starting;
        inner.message = None;
        match channel {
            InputChannel::Keyboard => emit_keyboard_status(app, &keyboard_snapshot(&inner)),
            InputChannel::Mouse => emit_mouse_status(app, &mouse_snapshot(&inner)),
        }

        match platform::permission_state() {
            PermissionState::Unsupported => {
                inner.status = SharedMonitorStatus::Unsupported;
                inner.message = Some(
                    "Global input monitoring is not implemented on this platform yet.".to_string(),
                );
            }
            PermissionState::Required => {
                if !inner.permission_requested {
                    inner.permission_requested = true;
                    platform::request_permission();
                }

                if platform::permission_state() != PermissionState::Granted {
                    inner.status = SharedMonitorStatus::PermissionRequired;
                    inner.message = Some(
                        "Allow DesktopPet in System Settings > Privacy & Security > Input Monitoring."
                            .to_string(),
                    );
                } else {
                    self.start_platform_listener(app, &mut inner);
                }
            }
            PermissionState::Granted => self.start_platform_listener(app, &mut inner),
        }
    }

    fn start_platform_listener(&self, app: &AppHandle, inner: &mut InputMonitorInner) {
        let event_app = app.clone();
        let keyboard_enabled = Arc::clone(&self.keyboard_enabled);
        let mouse_enabled = Arc::clone(&self.mouse_enabled);
        match platform::start(move |event| match event {
            NativeInputEvent::Keyboard(event) => {
                if keyboard_enabled.load(Ordering::Acquire) {
                    if let Some(window) = event_app.get_webview_window(MAIN_WINDOW_LABEL) {
                        let _ = window.emit(KEYBOARD_INPUT_EVENT, event);
                    }
                }
            }
            NativeInputEvent::Mouse(event) => {
                if mouse_enabled.load(Ordering::Acquire) {
                    if let Some(window) = event_app.get_webview_window(MAIN_WINDOW_LABEL) {
                        let _ = window.emit(MOUSE_INPUT_EVENT, event);
                    }
                }
            }
        }) {
            Ok(listener) => {
                inner.listener = Some(listener);
                inner.status = SharedMonitorStatus::Active;
                inner.message = None;
            }
            Err(error) => {
                inner.status = if platform::permission_state() == PermissionState::Required {
                    SharedMonitorStatus::PermissionRequired
                } else {
                    SharedMonitorStatus::Error
                };
                inner.message = Some(error);
            }
        }
    }

    fn stop_if_unused(&self) {
        if shared_listener_required(
            self.keyboard_enabled.load(Ordering::Acquire),
            self.mouse_enabled.load(Ordering::Acquire),
        ) {
            return;
        }

        let listener = {
            let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
            let listener = inner.listener.take();
            inner.status = SharedMonitorStatus::Disabled;
            inner.message = None;
            listener
        };
        if let Some(mut listener) = listener {
            listener.stop();
        }
    }

    fn keyboard_snapshot(&self) -> KeyboardMonitorSnapshot {
        let inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
        keyboard_snapshot(&inner)
    }

    fn mouse_snapshot(&self) -> MouseMonitorSnapshot {
        let inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
        mouse_snapshot(&inner)
    }
}

fn shared_listener_required(keyboard_enabled: bool, mouse_enabled: bool) -> bool {
    keyboard_enabled || mouse_enabled
}

impl Drop for InputMonitor {
    fn drop(&mut self) {
        if let Ok(inner) = self.inner.get_mut() {
            if let Some(mut listener) = inner.listener.take() {
                listener.stop();
            }
        }
    }
}

#[derive(Clone, Copy)]
enum InputChannel {
    Keyboard,
    Mouse,
}

fn keyboard_snapshot(inner: &InputMonitorInner) -> KeyboardMonitorSnapshot {
    KeyboardMonitorSnapshot {
        status: match inner.status {
            SharedMonitorStatus::Disabled => KeyboardMonitorStatus::Disabled,
            SharedMonitorStatus::Starting => KeyboardMonitorStatus::Starting,
            SharedMonitorStatus::PermissionRequired => KeyboardMonitorStatus::PermissionRequired,
            SharedMonitorStatus::Active => KeyboardMonitorStatus::Active,
            SharedMonitorStatus::Error => KeyboardMonitorStatus::Error,
            SharedMonitorStatus::Unsupported => KeyboardMonitorStatus::Unsupported,
        },
        message: inner.message.clone(),
    }
}

fn mouse_snapshot(inner: &InputMonitorInner) -> MouseMonitorSnapshot {
    MouseMonitorSnapshot {
        status: match inner.status {
            SharedMonitorStatus::Disabled => MouseMonitorStatus::Disabled,
            SharedMonitorStatus::Starting => MouseMonitorStatus::Starting,
            SharedMonitorStatus::PermissionRequired => MouseMonitorStatus::PermissionRequired,
            SharedMonitorStatus::Active => MouseMonitorStatus::Active,
            SharedMonitorStatus::Error => MouseMonitorStatus::Error,
            SharedMonitorStatus::Unsupported => MouseMonitorStatus::Unsupported,
        },
        message: inner.message.clone(),
    }
}

fn emit_keyboard_status(app: &AppHandle, status: &KeyboardMonitorSnapshot) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.emit(KEYBOARD_STATUS_EVENT, status);
    }
}

fn emit_mouse_status(app: &AppHandle, status: &MouseMonitorSnapshot) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.emit(MOUSE_STATUS_EVENT, status);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_status_maps_to_independent_frontend_status_types() {
        let inner = InputMonitorInner {
            listener: None,
            status: SharedMonitorStatus::PermissionRequired,
            message: Some("permission".to_string()),
            permission_requested: true,
        };

        assert_eq!(
            keyboard_snapshot(&inner).status,
            KeyboardMonitorStatus::PermissionRequired
        );
        assert_eq!(
            mouse_snapshot(&inner).status,
            MouseMonitorStatus::PermissionRequired
        );
    }

    #[test]
    fn shared_listener_stops_only_when_both_channels_are_disabled() {
        assert!(shared_listener_required(true, false));
        assert!(shared_listener_required(false, true));
        assert!(shared_listener_required(true, true));
        assert!(!shared_listener_required(false, false));
    }
}
