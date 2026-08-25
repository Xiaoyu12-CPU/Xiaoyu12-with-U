#[cfg(target_os = "macos")]
mod macos;

#[cfg(target_os = "macos")]
pub use macos::{permission_state, request_permission, start, PlatformKeyboardMonitor};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[allow(dead_code)] // Every variant is used across supported target builds.
pub enum PermissionState {
    Granted,
    Required,
    Unsupported,
}

#[cfg(not(target_os = "macos"))]
pub struct PlatformKeyboardMonitor;

#[cfg(not(target_os = "macos"))]
impl PlatformKeyboardMonitor {
    pub fn stop(&mut self) {}
}

#[cfg(not(target_os = "macos"))]
pub fn permission_state() -> PermissionState {
    PermissionState::Unsupported
}

#[cfg(not(target_os = "macos"))]
pub fn request_permission() {}

#[cfg(not(target_os = "macos"))]
pub fn start(
    _on_event: impl Fn(super::super::keyboard::KeyboardInputEvent) + Send + Sync + 'static,
) -> Result<PlatformKeyboardMonitor, String> {
    Err("Global keyboard monitoring is not implemented on this platform yet.".to_string())
}
