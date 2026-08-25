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
}

export function createKeyboardInputRuntime(
  onChange: (snapshot: KeyboardRuntimeSnapshot) => void = () => {},
): KeyboardInputRuntime {
  const pressedKeys = new Set<string>();
  let status: KeyboardMonitorStatus = "disabled";
  let message: string | undefined;
  let lastKey: string | undefined;
  let lastActivityAt: number | undefined;

  function getSnapshot(): KeyboardRuntimeSnapshot {
    return {
      status,
      message,
      pressedKeys: [...pressedKeys],
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
      pressedKeys.add(event.key);
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
  };
}
