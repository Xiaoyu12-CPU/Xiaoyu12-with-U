import type {
  MouseInputEvent,
  MouseMonitorStatus,
  MouseRuntimeSnapshot,
  NativeMouseMonitorSnapshot,
} from "./types";

export interface MouseInputRuntime {
  getSnapshot: () => MouseRuntimeSnapshot;
  applyEvent: (event: MouseInputEvent) => boolean;
  applyStatus: (snapshot: NativeMouseMonitorSnapshot) => void;
  disable: () => void;
}

export function createMouseInputRuntime(
  onChange: (snapshot: MouseRuntimeSnapshot) => void = () => {},
): MouseInputRuntime {
  const pressedButtons = new Set<NonNullable<MouseInputEvent["button"]>>();
  let status: MouseMonitorStatus = "disabled";
  let message: string | undefined;
  let lastButton: MouseInputEvent["button"];
  let lastActivityAt: number | undefined;
  let lastScrollDirection: MouseInputEvent["scrollDirection"];
  let lastScrollAt: number | undefined;

  function getSnapshot(): MouseRuntimeSnapshot {
    return {
      status,
      message,
      pressedButtons: [...pressedButtons],
      lastButton,
      lastActivityAt,
      lastScrollDirection,
      lastScrollAt,
    };
  }

  function publish(): void {
    onChange(getSnapshot());
  }

  function applyEvent(event: MouseInputEvent): boolean {
    if (status !== "active") {
      return false;
    }

    if (event.eventType === "scroll") {
      if (!event.scrollDirection) {
        return false;
      }
      lastScrollDirection = event.scrollDirection;
      lastScrollAt = event.timestamp;
      lastActivityAt = event.timestamp;
      publish();
      return true;
    }

    if (!event.button) {
      return false;
    }
    if (event.eventType === "down") {
      if (pressedButtons.has(event.button)) {
        return false;
      }
      pressedButtons.add(event.button);
    } else if (!pressedButtons.delete(event.button)) {
      return false;
    }

    lastButton = event.button;
    lastActivityAt = event.timestamp;
    publish();
    return true;
  }

  function applyStatus(snapshot: NativeMouseMonitorSnapshot): void {
    status = snapshot.status;
    message = snapshot.message;
    if (status !== "active") {
      pressedButtons.clear();
      lastScrollDirection = undefined;
      lastScrollAt = undefined;
    }
    publish();
  }

  function disable(): void {
    status = "disabled";
    message = undefined;
    pressedButtons.clear();
    lastScrollDirection = undefined;
    lastScrollAt = undefined;
    publish();
  }

  return {
    getSnapshot,
    applyEvent,
    applyStatus,
    disable,
  };
}
