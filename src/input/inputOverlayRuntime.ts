import { readonly, ref } from "vue";
import { listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";
import type {
  KeyboardInputEvent,
  KeyboardMonitorStatus,
  MouseButton,
  MouseInputEvent,
  MouseMonitorStatus,
  MouseScrollDirection,
} from "./types";
import { settingsManager } from "../settings/settingsManager";

const KEYBOARD_INPUT_EVENT = "desktop-pet://keyboard-input";
const KEYBOARD_STATUS_EVENT = "desktop-pet://keyboard-status";
const MOUSE_INPUT_EVENT = "desktop-pet://mouse-input";
const MOUSE_STATUS_EVENT = "desktop-pet://mouse-status";

/**
 * Lightweight runtime for the floating input-monitor window. It only renders
 * the keyboard/mouse event streams; the pet window remains the sole owner of
 * the monitor lifecycle (start/stop), so this composable never invokes the
 * monitor commands.
 */
export function useInputOverlayRuntime() {
  const pressedKeys = ref<string[]>([]);
  const keyboardStatus = ref<KeyboardMonitorStatus>("disabled");
  const pressedButtons = ref<MouseButton[]>([]);
  const mouseStatus = ref<MouseMonitorStatus>("disabled");
  const lastScroll = ref<MouseScrollDirection | undefined>(undefined);
  const lastScrollAt = ref<number | undefined>(undefined);

  let disposed = false;
  const unlisteners: UnlistenFn[] = [];

  function applyKeyboardEvent(event: KeyboardInputEvent): void {
    if (!event.key) {
      return;
    }

    if (event.eventType === "down") {
      if (!pressedKeys.value.includes(event.key)) {
        pressedKeys.value = [...pressedKeys.value, event.key];
      }
      return;
    }

    pressedKeys.value = pressedKeys.value.filter((key) => key !== event.key);
  }

  function applyMouseEvent(event: MouseInputEvent): void {
    const button = event.button;

    if (event.eventType === "down" && button) {
      if (!pressedButtons.value.includes(button)) {
        pressedButtons.value = [...pressedButtons.value, button];
      }
      return;
    }

    if (event.eventType === "up" && button) {
      pressedButtons.value = pressedButtons.value.filter((item) => item !== button);
      return;
    }

    if (event.eventType === "scroll" && event.scrollDirection) {
      lastScroll.value = event.scrollDirection;
      lastScrollAt.value = event.timestamp;
    }
  }

  async function initialize(): Promise<void> {
    if (!isTauri()) {
      return;
    }

    const [input, keyboardStatusEvent, mouseInput, mouseStatusEvent] = await Promise.all([
      listen<KeyboardInputEvent>(KEYBOARD_INPUT_EVENT, ({ payload }) => {
        applyKeyboardEvent(payload);
      }),
      listen<NativeStatus<KeyboardMonitorStatus>>(KEYBOARD_STATUS_EVENT, ({ payload }) => {
        keyboardStatus.value = payload.status;
      }),
      listen<MouseInputEvent>(MOUSE_INPUT_EVENT, ({ payload }) => {
        applyMouseEvent(payload);
      }),
      listen<NativeStatus<MouseMonitorStatus>>(MOUSE_STATUS_EVENT, ({ payload }) => {
        mouseStatus.value = payload.status;
      }),
    ]);

    if (disposed) {
      for (const unlisten of [input, keyboardStatusEvent, mouseInput, mouseStatusEvent]) {
        unlisten();
      }
      return;
    }

    unlisteners.push(input, keyboardStatusEvent, mouseInput, mouseStatusEvent);
    await settingsManager.initialize();
  }

  void initialize().catch((error: unknown) => {
    console.error("Failed to attach input overlay runtime.", error);
  });

  function dispose(): void {
    disposed = true;
    for (const unlisten of unlisteners.splice(0)) {
      unlisten();
    }
  }

  return {
    pressedKeys: readonly(pressedKeys),
    keyboardStatus: readonly(keyboardStatus),
    pressedButtons: readonly(pressedButtons),
    mouseStatus: readonly(mouseStatus),
    lastScroll: readonly(lastScroll),
    lastScrollAt: readonly(lastScrollAt),
    dispose,
  };
}

interface NativeStatus<S extends string> {
  status: S;
  message?: string;
}
