// Windows global input monitoring via Win32 low-level hooks.
//
// Design notes:
// - Both hooks (WH_KEYBOARD_LL / WH_MOUSE_LL) are installed on one dedicated
//   thread that pumps messages; Windows delivers low-level hook callbacks on
//   the installing thread, so a message loop is mandatory.
// - The hook callback must return quickly. If it stalls, Windows silently
//   removes the hook after a timeout (LowLevelHooksTimeout). Callbacks only
//   copy the raw event into a channel; every bit of real work (key-name
//   mapping, filtering) happens on a separate forwarder thread.
// - A graceful stop posts WM_APP+1 to the hook thread so GetMessageW wakes
//   up, uninstalls both hooks and lets the thread exit.
// - Windows low-level hooks see other user-mode processes, but NOT elevated
//   (admin) windows - that is a UIPI architectural limit every listener on
//   Windows shares. No permission prompt exists on this platform.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use super::super::keyboard::{KeyboardEventType, KeyboardInputEvent};
use super::super::monitor::NativeInputEvent;
use super::super::mouse::{MouseButton, MouseEventType, MouseInputEvent, ScrollDirection};
use super::PermissionState;
use crate::input::platform::windows_keymap::key_name;

struct RawKeyboardEvent {
    message: u32,
    vk_code: u32,
}

struct RawMouseEvent {
    message: u32,
    mouse_data: u32,
}

enum RawInputEvent {
    Keyboard(RawKeyboardEvent),
    Mouse(RawMouseEvent),
}

static EVENT_CHANNEL: Mutex<Option<mpsc::Sender<RawInputEvent>>> = Mutex::new(None);

const WM_KEYDOWN: u32 = 0x0100;
const WM_KEYUP: u32 = 0x0101;
const WM_SYSKEYDOWN: u32 = 0x0104;
const WM_SYSKEYUP: u32 = 0x0105;
const WM_LBUTTONDOWN: u32 = 0x0201;
const WM_LBUTTONUP: u32 = 0x0202;
const WM_RBUTTONDOWN: u32 = 0x0204;
const WM_RBUTTONUP: u32 = 0x0205;
const WM_MBUTTONDOWN: u32 = 0x0207;
const WM_MBUTTONUP: u32 = 0x0208;
const WM_XBUTTONDOWN: u32 = 0x020B;
const WM_XBUTTONUP: u32 = 0x020C;
const WM_MOUSEWHEEL: u32 = 0x020A;
const WM_MOUSEHWHEEL: u32 = 0x020E;

const WH_KEYBOARD_LL: i32 = 13;
const WH_MOUSE_LL: i32 = 14;

const LLKHF_INJECTED: u32 = 0x10;

const HOOK_STOP_MESSAGE: u32 = 0x8000 + 0x0001; // WM_APP + 1, reserved range

#[repr(C)]
struct KbdLlHookStruct {
    vk_code: u32,
    scan_code: u32,
    flags: u32,
    time: u32,
    extra_info: usize,
}

#[repr(C)]
struct MsLlHookStruct {
    pt_x: i32,
    pt_y: i32,
    mouse_data: u32,
    flags: u32,
    time: u32,
    extra_info: usize,
}

#[repr(C)]
#[derive(Default)]
struct Msg {
    hwnd: isize,
    message: u32,
    w_param: usize,
    l_param: isize,
    time: u32,
    pt_x: i32,
    pt_y: i32,
}

extern "system" {
    fn SetWindowsHookExW(
        id_hook: i32,
        lpfn: unsafe extern "system" fn(i32, usize, isize) -> isize,
        hmod: isize,
        thread_id: u32,
    ) -> isize;
    fn UnhookWindowsHookEx(hhk: isize) -> i32;
    fn CallNextHookEx(hhk: isize, code: i32, w_param: usize, l_param: isize) -> isize;
    fn GetMessageW(msg: *mut Msg, hwnd: isize, min: u32, max: u32) -> i32;
    fn PostThreadMessageW(thread_id: u32, message: u32, w_param: usize, l_param: isize) -> i32;
    fn GetCurrentThreadId() -> u32;
}

pub struct PlatformInputMonitor {
    stop_requested: Arc<AtomicBool>,
    hook_thread_id: u32,
    thread: Option<JoinHandle<()>>,
}

impl PlatformInputMonitor {
    pub fn stop(&mut self) {
        self.stop_requested.store(true, Ordering::Release);
        // Drop the sender so the forwarder unblocks and future starts work.
        EVENT_CHANNEL
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        // Wake the GetMessageW loop; joining alone would deadlock because the
        // hook thread is blocked in GetMessageW, not polling the flag.
        unsafe {
            PostThreadMessageW(self.hook_thread_id, HOOK_STOP_MESSAGE, 0, 0);
        }
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

pub fn permission_state() -> PermissionState {
    // Windows has no privacy gate for global listeners.
    PermissionState::Granted
}

pub fn request_permission() {}

extern "system" fn keyboard_hook_proc(code: i32, w_param: usize, l_param: isize) -> isize {
    if code >= 0 {
        if let Some(sender) = EVENT_CHANNEL.lock().unwrap_or_else(|error| error.into_inner()).as_ref() {
            let info = unsafe { &*(l_param as *const KbdLlHookStruct) };
            if info.flags & LLKHF_INJECTED == 0 {
                let _ = sender.send(RawInputEvent::Keyboard(RawKeyboardEvent {
                    message: w_param as u32,
                    vk_code: info.vk_code,
                }));
            }
        }
    }
    CallNextHookEx(0, code, w_param, l_param)
}

extern "system" fn mouse_hook_proc(code: i32, w_param: usize, l_param: isize) -> isize {
    if code >= 0 {
        if let Some(sender) = EVENT_CHANNEL.lock().unwrap_or_else(|error| error.into_inner()).as_ref() {
            let info = unsafe { &*(l_param as *const MsLlHookStruct) };
            if info.flags & LLKHF_INJECTED == 0 {
                let _ = sender.send(RawInputEvent::Mouse(RawMouseEvent {
                    message: w_param as u32,
                    mouse_data: info.mouse_data,
                }));
            }
        }
    }
    CallNextHookEx(0, code, w_param, l_param)
}

fn wheel_delta(mouse_data: u32) -> i16 {
    (mouse_data >> 16) as u16 as i16
}

fn map_mouse_event(message: u32, mouse_data: u32) -> Option<MouseInputEvent> {
    let event = match message {
        WM_LBUTTONDOWN => MouseInputEvent::button(MouseEventType::Down, MouseButton::Left),
        WM_LBUTTONUP => MouseInputEvent::button(MouseEventType::Up, MouseButton::Left),
        WM_RBUTTONDOWN => MouseInputEvent::button(MouseEventType::Down, MouseButton::Right),
        WM_RBUTTONUP => MouseInputEvent::button(MouseEventType::Up, MouseButton::Right),
        WM_MBUTTONDOWN => MouseInputEvent::button(MouseEventType::Down, MouseButton::Middle),
        WM_MBUTTONUP => MouseInputEvent::button(MouseEventType::Up, MouseButton::Middle),
        WM_XBUTTONDOWN => {
            MouseInputEvent::button(MouseEventType::Down, x_button(mouse_data))
        }
        WM_XBUTTONUP => MouseInputEvent::button(MouseEventType::Up, x_button(mouse_data)),
        WM_MOUSEWHEEL => {
            let delta = wheel_delta(mouse_data);
            if delta == 0 {
                return None;
            }
            MouseInputEvent::scroll(if delta > 0 {
                ScrollDirection::Up
            } else {
                ScrollDirection::Down
            })
        }
        WM_MOUSEHWHEEL => {
            let delta = wheel_delta(mouse_data);
            if delta == 0 {
                return None;
            }
            MouseInputEvent::scroll(if delta > 0 {
                ScrollDirection::Right
            } else {
                ScrollDirection::Left
            })
        }
        _ => return None,
    };
    Some(event)
}

fn x_button(mouse_data: u32) -> MouseButton {
    // HIWORD(mouse_data): 1 = XBUTTON1, 2 = XBUTTON2.
    match (mouse_data >> 16) as u16 {
        1 => MouseButton::Mouse4,
        2 => MouseButton::Mouse5,
        _ => MouseButton::Other,
    }
}

fn map_keyboard_event(message: u32, vk_code: u32) -> Option<KeyboardInputEvent> {
    let event_type = match message {
        WM_KEYDOWN | WM_SYSKEYDOWN => KeyboardEventType::Down,
        WM_KEYUP | WM_SYSKEYUP => KeyboardEventType::Up,
        _ => return None,
    };
    Some(KeyboardInputEvent::new(
        event_type,
        key_name(vk_code as u16),
    ))
}

pub fn start(
    on_event: impl Fn(NativeInputEvent) + Send + Sync + 'static,
) -> Result<PlatformInputMonitor, String> {
    let stop_requested = Arc::new(AtomicBool::new(false));
    let thread_stop = Arc::clone(&stop_requested);
    let event_sink = Arc::new(on_event);
    let (ready_sender, ready_receiver) = mpsc::sync_channel::<Result<(), String>>(1);
    let (thread_id_sender, thread_id_receiver) = mpsc::channel::<u32>();
    let (raw_sender, raw_receiver) = mpsc::channel::<RawInputEvent>();

    {
        let mut channel = EVENT_CHANNEL
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if channel.is_some() {
            return Err("Input monitor is already running.".to_string());
        }
        *channel = Some(raw_sender);
    }

    let thread = thread::Builder::new()
        .name("desktop-pet-input-hook-win".to_string())
        .spawn(move || {
            let thread_id = unsafe { GetCurrentThreadId() };
            let keyboard_hook =
                unsafe { SetWindowsHookExW(WH_KEYBOARD_LL, keyboard_hook_proc, 0, 0) };
            let mouse_hook = unsafe { SetWindowsHookExW(WH_MOUSE_LL, mouse_hook_proc, 0, 0) };
            if keyboard_hook == 0 || mouse_hook == 0 {
                if keyboard_hook != 0 {
                    unsafe { UnhookWindowsHookEx(keyboard_hook) };
                }
                if mouse_hook != 0 {
                    unsafe { UnhookWindowsHookEx(mouse_hook) };
                }
                let _ = ready_sender.send(Err(format!(
                    "Failed to install the Windows input hooks (thread {thread_id})."
                )));
                return;
            }
            let _ = thread_id_sender.send(thread_id);

            let _ = ready_sender.send(Ok(()));

            let mut msg = Msg::default();
            loop {
                // GetMessageW blocks until a message arrives; our stop signal
                // is delivered as a posted message, so no polling is needed.
                let result = unsafe { GetMessageW(&mut msg, 0, 0, 0) };
                if result <= 0 {
                    break;
                }
                if msg.message == HOOK_STOP_MESSAGE {
                    break;
                }
            }

            unsafe {
                UnhookWindowsHookEx(keyboard_hook);
                UnhookWindowsHookEx(mouse_hook);
            }
        })
        .map_err(|error| format!("Failed to start input monitor thread: {error}"))?;

    // Forwarder: does all the mapping work off the hook callbacks and fans
    // out to the caller-provided sink.
    let forwarder = thread::Builder::new()
        .name("desktop-pet-input-forwarder-win".to_string())
        .spawn(move || {
            while let Ok(raw) = raw_receiver.recv() {
                if thread_stop.load(Ordering::Acquire) {
                    break;
                }
                let event = match raw {
                    RawInputEvent::Keyboard(raw) => {
                        map_keyboard_event(raw.message, raw.vk_code)
                            .map(NativeInputEvent::Keyboard)
                    }
                    RawInputEvent::Mouse(raw) => {
                        map_mouse_event(raw.message, raw.mouse_data).map(NativeInputEvent::Mouse)
                    }
                };
                if let Some(event) = event {
                    event_sink(event);
                }
            }
        });

    if forwarder.is_err() {
        stop_requested.store(true, Ordering::Release);
        let _ = thread.join();
        return Err("Failed to start input forwarder.".to_string());
    }

    // The hook thread reports its id so stop() can post the wake-up message.
    // Give it a moment; installation normally finishes in microseconds.
    let hook_thread_id = thread_id_receiver
        .recv_timeout(Duration::from_secs(2))
        .map_err(|_| "Timed out waiting for the input hook thread.".to_string())?;

    Ok(PlatformInputMonitor {
        stop_requested,
        hook_thread_id,
        thread: Some(thread),
    })
}
