// Virtual-Key code to display-name mapping for the Windows backend.
// Mirrors the macOS keymap's naming so the frontend key history looks the
// same on both platforms.

/// True when the virtual key is a modifier with distinct left/right keys.
/// The frontend treats "Left Shift" and "Right Shift" as the same logical
/// key (Shift), so only the pressed side is reported in the name.
pub(crate) fn key_name(vk_code: u16) -> String {
    let key = match vk_code {
        0x08 => "Backspace",
        0x09 => "Tab",
        0x0D => "Enter",
        0x10 => "Shift",
        0x11 => "Control",
        0x12 => "Alt",
        0x13 => "Pause",
        0x14 => "CapsLock",
        0x15 => "IME",
        0x16 => "IMEHangul",
        0x17 => "IMEJunja",
        0x18 => "IMEFinal",
        0x19 => "IMEHanja",
        0x1B => "Escape",
        0x1C => "IMEConvert",
        0x1D => "IMENonconvert",
        0x1E => "IMEAccept",
        0x1F => "IMEModeChange",
        0x20 => "Space",
        0x21 => "PageUp",
        0x22 => "PageDown",
        0x23 => "End",
        0x24 => "Home",
        0x25 => "ArrowLeft",
        0x26 => "ArrowUp",
        0x27 => "ArrowRight",
        0x28 => "ArrowDown",
        0x29 => "Select",
        0x2A => "Print",
        0x2B => "Execute",
        0x2C => "PrintScreen",
        0x2D => "Insert",
        0x2E => "Delete",
        0x2F => "Help",
        0x5B => "Meta",
        0x5C => "Meta",
        0x5D => "Apps",
        0x5F => "Sleep",
        0x60 => "Numpad0",
        0x61 => "Numpad1",
        0x62 => "Numpad2",
        0x63 => "Numpad3",
        0x64 => "Numpad4",
        0x65 => "Numpad5",
        0x66 => "Numpad6",
        0x67 => "Numpad7",
        0x68 => "Numpad8",
        0x69 => "Numpad9",
        0x6A => "NumpadMultiply",
        0x6B => "NumpadAdd",
        0x6C => "NumpadEnter",
        0x6D => "NumpadSubtract",
        0x6E => "NumpadDecimal",
        0x6F => "NumpadDivide",
        0x70 => "F1",
        0x71 => "F2",
        0x72 => "F3",
        0x73 => "F4",
        0x74 => "F5",
        0x75 => "F6",
        0x76 => "F7",
        0x77 => "F8",
        0x78 => "F9",
        0x79 => "F10",
        0x7A => "F11",
        0x7B => "F12",
        0x7C => "F13",
        0x7D => "F14",
        0x7E => "F15",
        0x7F => "F16",
        0x80 => "F17",
        0x81 => "F18",
        0x82 => "F19",
        0x83 => "F20",
        0x84 => "F21",
        0x85 => "F22",
        0x86 => "F23",
        0x87 => "F24",
        0x90 => "NumLock",
        0x91 => "ScrollLock",
        0xA0 => "Shift",
        0xA1 => "Shift",
        0xA2 => "Control",
        0xA3 => "Control",
        0xA4 => "Alt",
        0xA5 => "Alt",
        0xAD => "VolumeMute",
        0xAE => "VolumeDown",
        0xAF => "VolumeUp",
        0xB0 => "MediaNext",
        0xB1 => "MediaPrev",
        0xB2 => "MediaStop",
        0xB3 => "MediaPlayPause",
        0xBA => "Semicolon",
        0xBB => "Equal",
        0xBC => "Comma",
        0xBD => "Minus",
        0xBE => "Period",
        0xBF => "Slash",
        0xC0 => "Backquote",
        0xDB => "LeftBracket",
        0xDC => "Backslash",
        0xDD => "RightBracket",
        0xDE => "Quote",
        0xE2 => "Backslash",
        0xFF => "Unknown",
        0x30..=0x39 => return digit_name(vk_code),
        0x41..=0x5A => return letter_name(vk_code),
        _ => return format!("Unknown({vk_code})"),
    };
    key.to_string()
}

fn letter_name(vk_code: u16) -> String {
    // VK 0x41..=0x5A map to 'A'..='Z' in order regardless of layout.
    let letter = char::from_u32(u32::from(b'A') + u32::from(vk_code - 0x41))
        .unwrap_or('?');
    letter.to_string()
}

fn digit_name(vk_code: u16) -> String {
    let digit = char::from_u32(u32::from(b'0') + u32::from(vk_code - 0x30))
        .unwrap_or('?');
    digit.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_stable_human_readable_key_names() {
        assert_eq!(key_name(0x41), "A");
        assert_eq!(key_name(0x5A), "Z");
        assert_eq!(key_name(0x30), "0");
        assert_eq!(key_name(0x39), "9");
        assert_eq!(key_name(0x0D), "Enter");
        assert_eq!(key_name(0x20), "Space");
        assert_eq!(key_name(0x25), "ArrowLeft");
        assert_eq!(key_name(0x70), "F1");
        assert_eq!(key_name(0x87), "F24");
        assert_eq!(key_name(0x5B), "Meta");
    }

    #[test]
    fn modifier_variants_share_logical_names() {
        // VK_LSHIFT/VK_RSHIFT and friends normalize to the macOS naming.
        assert_eq!(key_name(0x10), "Shift");
        assert_eq!(key_name(0xA0), "Shift");
        assert_eq!(key_name(0xA1), "Shift");
        assert_eq!(key_name(0xA2), "Control");
        assert_eq!(key_name(0xA4), "Alt");
        assert_eq!(key_name(0x5C), "Meta");
    }

    #[test]
    fn unknown_key_codes_are_safe() {
        assert_eq!(key_name(0x07), "Unknown(7)");
        assert_eq!(key_name(0x88), "Unknown(136)");
    }

    #[test]
    fn oem_punctuation_matches_macos_names() {
        assert_eq!(key_name(0xBA), "Semicolon");
        assert_eq!(key_name(0xBB), "Equal");
        assert_eq!(key_name(0xBD), "Minus");
        assert_eq!(key_name(0xC0), "Backquote");
        assert_eq!(key_name(0xDE), "Quote");
    }
}
