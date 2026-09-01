#[cfg(target_os = "windows")]
#[link(name = "user32")]
extern "system" {
    fn GetAsyncKeyState(virtual_key: i32) -> i16;
    fn GetSystemMetrics(index: i32) -> i32;
}

#[cfg(target_os = "windows")]
const VK_LBUTTON: i32 = 0x01;
#[cfg(target_os = "windows")]
const VK_RBUTTON: i32 = 0x02;
#[cfg(target_os = "windows")]
const SM_SWAPBUTTON: i32 = 23;

/// Returns whether the Windows primary mouse button is physically pressed.
///
/// Native caption dragging temporarily owns the Windows mouse stream, so the
/// WebView does not always receive its final pointerup/mouseup. Other platforms
/// return None and keep using the existing DOM release events.
#[tauri::command]
pub fn primary_mouse_button_pressed() -> Option<bool> {
    #[cfg(target_os = "windows")]
    {
        let virtual_key = if unsafe { GetSystemMetrics(SM_SWAPBUTTON) } != 0 {
            VK_RBUTTON
        } else {
            VK_LBUTTON
        };
        let state = unsafe { GetAsyncKeyState(virtual_key) } as u16;
        return Some(state & 0x8000 != 0);
    }

    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

#[cfg(test)]
mod tests {
    #[cfg(not(target_os = "windows"))]
    #[test]
    fn unsupported_platforms_leave_release_detection_to_the_webview() {
        assert_eq!(super::primary_mouse_button_pressed(), None);
    }
}
