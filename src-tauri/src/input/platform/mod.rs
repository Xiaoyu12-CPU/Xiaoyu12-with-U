#[cfg(target_os = "macos")]
mod macos;

#[cfg(target_os = "macos")]
pub use macos::{permission_state, request_permission, start, PlatformInputMonitor};

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
mod windows_keymap;

#[cfg(target_os = "windows")]
pub use windows::{permission_state, request_permission, start, PlatformInputMonitor};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[allow(dead_code)] // Every variant is used across supported target builds.
pub enum PermissionState {
    Granted,
    Required,
    Unsupported,
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub struct PlatformInputMonitor;

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
impl PlatformInputMonitor {
    pub fn stop(&mut self) {}
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn permission_state() -> PermissionState {
    PermissionState::Unsupported
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn request_permission() {}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn start(
    _on_event: impl Fn(super::monitor::NativeInputEvent) + Send + Sync + 'static,
) -> Result<PlatformInputMonitor, String> {
    Err("Global input monitoring is not implemented on this platform yet.".to_string())
}
