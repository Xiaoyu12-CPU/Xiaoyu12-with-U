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
use crate::input::monitor::NativeInputEvent;
use crate::input::mouse::{MouseButton, MouseEventType, MouseInputEvent, ScrollDirection};

const LISTENER_START_TIMEOUT: Duration = Duration::from_secs(2);
const RUN_LOOP_SLICE_SECONDS: f64 = 0.1;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightListenEventAccess() -> bool;
    fn CGRequestListenEventAccess() -> bool;
}

pub struct PlatformInputMonitor {
    stop_requested: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl PlatformInputMonitor {
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
    on_event: impl Fn(NativeInputEvent) + Send + Sync + 'static,
) -> Result<PlatformInputMonitor, String> {
    let stop_requested = Arc::new(AtomicBool::new(false));
    let thread_stop = Arc::clone(&stop_requested);
    let event_sink = Arc::new(on_event);
    let (ready_sender, ready_receiver) = mpsc::sync_channel(1);
    let thread = thread::Builder::new()
        .name("desktop-pet-input-monitor".to_string())
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
                    CGEventType::LeftMouseDown,
                    CGEventType::LeftMouseUp,
                    CGEventType::RightMouseDown,
                    CGEventType::RightMouseUp,
                    CGEventType::OtherMouseDown,
                    CGEventType::OtherMouseUp,
                    CGEventType::ScrollWheel,
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
                        "Failed to create the macOS input event tap.".to_string()
                    ));
                    return;
                }
            };
            let source = match tap.mach_port().create_runloop_source(0) {
                Ok(source) => source,
                Err(()) => {
                    let _ = ready_sender.send(Err(
                        "Failed to create the input event tap run-loop source.".to_string(),
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
        .map_err(|error| format!("Failed to start input monitor thread: {error}"))?;

    match ready_receiver.recv_timeout(LISTENER_START_TIMEOUT) {
        Ok(Ok(())) => Ok(PlatformInputMonitor {
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
            Err("Timed out while starting the input event tap.".to_string())
        }
    }
}

fn convert_event(
    event_type: CGEventType,
    event: &core_graphics::event::CGEvent,
) -> Option<NativeInputEvent> {
    if let Some(event) = convert_keyboard_event(event_type, event) {
        return Some(NativeInputEvent::Keyboard(event));
    }

    convert_mouse_event(event_type, event).map(NativeInputEvent::Mouse)
}

fn convert_keyboard_event(
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

fn convert_mouse_event(
    event_type: CGEventType,
    event: &core_graphics::event::CGEvent,
) -> Option<MouseInputEvent> {
    match event_type {
        CGEventType::LeftMouseDown => Some(MouseInputEvent::button(
            MouseEventType::Down,
            MouseButton::Left,
        )),
        CGEventType::LeftMouseUp => Some(MouseInputEvent::button(
            MouseEventType::Up,
            MouseButton::Left,
        )),
        CGEventType::RightMouseDown => Some(MouseInputEvent::button(
            MouseEventType::Down,
            MouseButton::Right,
        )),
        CGEventType::RightMouseUp => Some(MouseInputEvent::button(
            MouseEventType::Up,
            MouseButton::Right,
        )),
        CGEventType::OtherMouseDown => Some(MouseInputEvent::button(
            MouseEventType::Down,
            mouse_button(event.get_integer_value_field(EventField::MOUSE_EVENT_BUTTON_NUMBER)),
        )),
        CGEventType::OtherMouseUp => Some(MouseInputEvent::button(
            MouseEventType::Up,
            mouse_button(event.get_integer_value_field(EventField::MOUSE_EVENT_BUTTON_NUMBER)),
        )),
        CGEventType::ScrollWheel => {
            let vertical =
                event.get_integer_value_field(EventField::SCROLL_WHEEL_EVENT_DELTA_AXIS_1);
            let horizontal =
                event.get_integer_value_field(EventField::SCROLL_WHEEL_EVENT_DELTA_AXIS_2);
            scroll_direction(vertical, horizontal).map(MouseInputEvent::scroll)
        }
        _ => None,
    }
}

fn mouse_button(button_number: i64) -> MouseButton {
    match button_number {
        0 => MouseButton::Left,
        1 => MouseButton::Right,
        2 => MouseButton::Middle,
        3 => MouseButton::Mouse4,
        4 => MouseButton::Mouse5,
        _ => MouseButton::Other,
    }
}

fn scroll_direction(vertical: i64, horizontal: i64) -> Option<ScrollDirection> {
    if vertical == 0 && horizontal == 0 {
        return None;
    }

    if vertical.abs() >= horizontal.abs() {
        Some(if vertical > 0 {
            ScrollDirection::Up
        } else {
            ScrollDirection::Down
        })
    } else {
        Some(if horizontal > 0 {
            ScrollDirection::Right
        } else {
            ScrollDirection::Left
        })
    }
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

    #[test]
    fn maps_stable_mouse_button_names() {
        assert_eq!(mouse_button(0), MouseButton::Left);
        assert_eq!(mouse_button(1), MouseButton::Right);
        assert_eq!(mouse_button(2), MouseButton::Middle);
        assert_eq!(mouse_button(3), MouseButton::Mouse4);
        assert_eq!(mouse_button(4), MouseButton::Mouse5);
        assert_eq!(mouse_button(99), MouseButton::Other);
    }

    #[test]
    fn maps_scroll_to_the_dominant_axis() {
        assert_eq!(scroll_direction(8, 1), Some(ScrollDirection::Up));
        assert_eq!(scroll_direction(-8, 1), Some(ScrollDirection::Down));
        assert_eq!(scroll_direction(1, -8), Some(ScrollDirection::Left));
        assert_eq!(scroll_direction(1, 8), Some(ScrollDirection::Right));
        assert_eq!(scroll_direction(0, 0), None);
    }
}
