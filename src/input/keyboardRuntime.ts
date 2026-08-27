import type {
  KeyboardInputEvent,
  KeyboardMonitorStatus,
  KeyboardRuntimeSnapshot,
  NativeKeyboardMonitorSnapshot,
} from "./types";

export interface KeyboardInputRuntime {
  getSnapshot: () => KeyboardRuntimeSnapshot;
  applyEvent: (event: KeyboardInputEvent) => boolean;
  applyStatus: (snapshot: NativeKeyboardMonitorSnapshot) => void;
  disable: () => void;
  /** Removes keys pressed longer than `staleMs`; returns true when anything changed. */
  reapStalePressedKeys: (now: number, staleMs: number) => boolean;
}

/** A key held (or stuck) longer than this is treated as lost. */
export const KEYBOARD_PRESSED_KEY_STALE_MS = 30_000;

export function createKeyboardInputRuntime(
  onChange: (snapshot: KeyboardRuntimeSnapshot) => void = () => {},
): KeyboardInputRuntime {
  /** key -> timestamp of the most recent "down" event for that key. */
  const pressedKeys = new Map<string, number>();
  let status: KeyboardMonitorStatus = "disabled";
  let message: string | undefined;
  let lastKey: string | undefined;
  let lastActivityAt: number | undefined;

  function getSnapshot(): KeyboardRuntimeSnapshot {
    return {
      status,
      message,
      pressedKeys: [...pressedKeys.keys()],
      lastKey,
      lastActivityAt,
    };
  }

  function publish(): void {
    onChange(getSnapshot());
  }

  function applyEvent(event: KeyboardInputEvent): boolean {
    if (status !== "active" || !event.key) {
      return false;
    }

    if (event.eventType === "down") {
      if (pressedKeys.has(event.key)) {
        return false;
      }
      pressedKeys.set(event.key, event.timestamp);
    } else {
      if (!pressedKeys.delete(event.key)) {
        return false;
      }
    }

    lastKey = event.key;
    lastActivityAt = event.timestamp;
    publish();
    return true;
  }

  /**
   * Drops keys stuck in the pressed state for longer than `staleMs`. A lost
   * "up" event (busy webview dropping IPC) would otherwise keep the pet in
   * its keyboard-driven working state until the monitor restarts.
   */
  function reapStalePressedKeys(now: number, staleMs: number): boolean {
    if (status !== "active" || staleMs <= 0) {
      return false;
    }
    let removed = false;
    for (const [key, pressedAt] of pressedKeys) {
      if (now - pressedAt > staleMs) {
        pressedKeys.delete(key);
        removed = true;
      }
    }
    return removed;
  }

  function applyStatus(snapshot: NativeKeyboardMonitorSnapshot): void {
    status = snapshot.status;
    message = snapshot.message;
    if (status !== "active") {
      pressedKeys.clear();
    }
    publish();
  }

  function disable(): void {
    status = "disabled";
    message = undefined;
    pressedKeys.clear();
    publish();
  }

  return {
    getSnapshot,
    applyEvent,
    applyStatus,
    disable,
    reapStalePressedKeys,
  };
}
