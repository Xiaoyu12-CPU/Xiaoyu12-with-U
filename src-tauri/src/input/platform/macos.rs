use core_foundation::runloop::{
    kCFRunLoopCommonModes, kCFRunLoopDefaultMode, CFRunLoop, CFRunLoopRunInMode,
};
use core_graphics::event::{
    CGEventTap, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement, CGEventType,
    CallbackResult, EventField,
};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use super::PermissionState;
use crate::input::keyboard::{KeyboardEventType, KeyboardInputEvent};

const LISTENER_START_TIMEOUT: Duration = Duration::from_secs(2);
const RUN_LOOP_SLICE_SECONDS: f64 = 0.1;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightListenEventAccess() -> bool;
    fn CGRequestListenEventAccess() -> bool;
}

pub struct PlatformKeyboardMonitor {
    stop_requested: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl PlatformKeyboardMonitor {
    pub fn stop(&mut self) {
        self.stop_requested.store(true, Ordering::Release);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

pub fn permission_state() -> PermissionState {
    if unsafe { CGPreflightListenEventAccess() } {
        PermissionState::Granted
    } else {
        PermissionState::Required
    }
}

pub fn request_permission() {
    let _ = unsafe { CGRequestListenEventAccess() };
}

pub fn start(
    on_event: impl Fn(KeyboardInputEvent) + Send + Sync + 'static,
) -> Result<PlatformKeyboardMonitor, String> {
    let stop_requested = Arc::new(AtomicBool::new(false));
    let thread_stop = Arc::clone(&stop_requested);
    let event_sink = Arc::new(on_event);
    let (ready_sender, ready_receiver) = mpsc::sync_channel(1);
    let thread = thread::Builder::new()
        .name("desktop-pet-keyboard-monitor".to_string())
        .spawn(move || {
            let callback_sink = Arc::clone(&event_sink);
            let tap = CGEventTap::new(
                CGEventTapLocation::Session,
                CGEventTapPlacement::HeadInsertEventTap,
                CGEventTapOptions::ListenOnly,
                vec![
                    CGEventType::KeyDown,
                    CGEventType::KeyUp,
                    CGEventType::FlagsChanged,
                ],
                move |_proxy, event_type, event| {
                    if let Some(input_event) = convert_event(event_type, event) {
                        callback_sink(input_event);
                    }
                    CallbackResult::Keep
                },
            );

            let tap = match tap {
                Ok(tap) => tap,
                Err(()) => {
                    let _ = ready_sender.send(Err(
                        "Failed to create the macOS keyboard event tap.".to_string(),
                    ));
                    return;
                }
            };
            let source = match tap.mach_port().create_runloop_source(0) {
                Ok(source) => source,
                Err(()) => {
                    let _ = ready_sender.send(Err(
                        "Failed to create the keyboard event tap run-loop source.".to_string(),
                    ));
                    return;
                }
            };
            let run_loop = CFRunLoop::get_current();
            run_loop.add_source(&source, unsafe { kCFRunLoopCommonModes });
            tap.enable();
            if ready_sender.send(Ok(())).is_err() {
                return;
            }

            while !thread_stop.load(Ordering::Acquire) {
                unsafe {
                    CFRunLoopRunInMode(kCFRunLoopDefaultMode, RUN_LOOP_SLICE_SECONDS, 0);
                }
            }
        })
        .map_err(|error| format!("Failed to start keyboard monitor thread: {error}"))?;

    match ready_receiver.recv_timeout(LISTENER_START_TIMEOUT) {
        Ok(Ok(())) => Ok(PlatformKeyboardMonitor {
            stop_requested,
            thread: Some(thread),
        }),
        Ok(Err(error)) => {
            let _ = thread.join();
            Err(error)
        }
        Err(_) => {
            stop_requested.store(true, Ordering::Release);
            let _ = thread.join();
            Err("Timed out while starting the keyboard event tap.".to_string())
        }
    }
}

fn convert_event(
    event_type: CGEventType,
    event: &core_graphics::event::CGEvent,
) -> Option<KeyboardInputEvent> {
    let key_code = event.get_integer_value_field(EventField::KEYBOARD_EVENT_KEYCODE) as u16;
    let event_type = match event_type {
        CGEventType::KeyDown => {
            if event.get_integer_value_field(EventField::KEYBOARD_EVENT_AUTOREPEAT) != 0 {
                return None;
            }
            KeyboardEventType::Down
        }
        CGEventType::KeyUp => KeyboardEventType::Up,
        CGEventType::FlagsChanged => modifier_event_type(key_code, event.get_flags())?,
        _ => return None,
    };

    Some(KeyboardInputEvent::new(event_type, key_name(key_code)))
}

fn modifier_event_type(
    key_code: u16,
    flags: core_graphics::event::CGEventFlags,
) -> Option<KeyboardEventType> {
    use core_graphics::event::CGEventFlags;

    let is_pressed = match key_code {
        54 | 55 => flags.contains(CGEventFlags::CGEventFlagCommand),
        56 | 60 => flags.contains(CGEventFlags::CGEventFlagShift),
        57 => flags.contains(CGEventFlags::CGEventFlagAlphaShift),
        58 | 61 => flags.contains(CGEventFlags::CGEventFlagAlternate),
        59 | 62 => flags.contains(CGEventFlags::CGEventFlagControl),
        63 => flags.contains(CGEventFlags::CGEventFlagSecondaryFn),
        _ => return None,
    };

    Some(if is_pressed {
        KeyboardEventType::Down
    } else {
        KeyboardEventType::Up
    })
}

fn key_name(key_code: u16) -> String {
    let key = match key_code {
        0 => "A",
        1 => "S",
        2 => "D",
        3 => "F",
        4 => "H",
        5 => "G",
        6 => "Z",
        7 => "X",
        8 => "C",
        9 => "V",
        11 => "B",
        12 => "Q",
        13 => "W",
        14 => "E",
        15 => "R",
        16 => "Y",
        17 => "T",
        18 => "1",
        19 => "2",
        20 => "3",
        21 => "4",
        22 => "6",
        23 => "5",
        24 => "Equal",
        25 => "9",
        26 => "7",
        27 => "Minus",
        28 => "8",
        29 => "0",
        30 => "RightBracket",
        31 => "O",
        32 => "U",
        33 => "LeftBracket",
        34 => "I",
        35 => "P",
        36 => "Enter",
        37 => "L",
        38 => "J",
        39 => "Quote",
        40 => "K",
        41 => "Semicolon",
        42 => "Backslash",
        43 => "Comma",
        44 => "Slash",
        45 => "N",
        46 => "M",
        47 => "Period",
        48 => "Tab",
        49 => "Space",
        50 => "Backquote",
        51 => "Backspace",
        53 => "Escape",
        54 | 55 => "Command",
        56 | 60 => "Shift",
        57 => "CapsLock",
        58 | 61 => "Option",
        59 | 62 => "Control",
        63 => "Fn",
        65 => "NumpadDecimal",
        67 => "NumpadMultiply",
        69 => "NumpadAdd",
        71 => "NumpadClear",
        72 => "VolumeUp",
        73 => "VolumeDown",
        74 => "Mute",
        75 => "NumpadDivide",
        76 => "NumpadEnter",
        78 => "NumpadSubtract",
        81 => "NumpadEqual",
        82 => "Numpad0",
        83 => "Numpad1",
        84 => "Numpad2",
        85 => "Numpad3",
        86 => "Numpad4",
        87 => "Numpad5",
        88 => "Numpad6",
        89 => "Numpad7",
        91 => "Numpad8",
        92 => "Numpad9",
        96 => "F5",
        97 => "F6",
        98 => "F7",
        99 => "F3",
        100 => "F8",
        101 => "F9",
        103 => "F11",
        105 => "F13",
        106 => "F16",
        107 => "F14",
        109 => "F10",
        111 => "F12",
        113 => "F15",
        114 => "Help",
        115 => "Home",
        116 => "PageUp",
        117 => "Delete",
        118 => "F4",
        119 => "End",
        120 => "F2",
        121 => "PageDown",
        122 => "F1",
        123 => "ArrowLeft",
        124 => "ArrowRight",
        125 => "ArrowDown",
        126 => "ArrowUp",
        _ => return format!("Unknown({key_code})"),
    };

    key.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_stable_human_readable_key_names() {
        assert_eq!(key_name(0), "A");
        assert_eq!(key_name(36), "Enter");
        assert_eq!(key_name(49), "Space");
        assert_eq!(key_name(55), "Command");
        assert_eq!(key_name(56), "Shift");
        assert_eq!(key_name(123), "ArrowLeft");
    }

    #[test]
    fn unknown_key_codes_are_safe() {
        assert_eq!(key_name(999), "Unknown(999)");
    }
}
