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

export interface MouseInputRuntimeOptions {
  /**
   * Scroll events publish at most once per this window (inbound inertia
   * scrolling easily exceeds 100 events/s). 0 disables coalescing.
   */
  scrollCoalesceMs?: number;
  setTimer?: (callback: () => void, delayMs: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

export const MOUSE_SCROLL_COALESCE_MS = 16;

export function createMouseInputRuntime(
  onChange: (snapshot: MouseRuntimeSnapshot) => void = () => {},
  options: MouseInputRuntimeOptions = {},
): MouseInputRuntime {
  const pressedButtons = new Set<NonNullable<MouseInputEvent["button"]>>();
  let status: MouseMonitorStatus = "disabled";
  let message: string | undefined;
  let lastButton: MouseInputEvent["button"];
  let lastActivityAt: number | undefined;
  let lastScrollDirection: MouseInputEvent["scrollDirection"];
  let lastScrollAt: number | undefined;

  const scrollCoalesceMs = options.scrollCoalesceMs ?? MOUSE_SCROLL_COALESCE_MS;
  const setTimer = options.setTimer
    ?? ((callback, delayMs) => globalThis.setTimeout(callback, delayMs));
  const clearTimer = options.clearTimer
    ?? ((timer) => globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>));
  let scrollPublishTimer: unknown;

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

  /**
   * Publishes scroll-driven changes at most once per coalesce window; the
   * flushed snapshot always carries the latest direction/timestamp pair.
   */
  function publishScrollCoalesced(): void {
    if (scrollCoalesceMs <= 0) {
      publish();
      return;
    }
    // A flush is already scheduled; snapshot() reads latest state at flush time.
    if (scrollPublishTimer !== undefined) {
      return;
    }
    const handle: object = {};
    scrollPublishTimer = handle;
    setTimer(() => {
      // Ownership check: cancelled handles must not publish stale state.
      if (scrollPublishTimer !== handle) {
        return;
      }
      scrollPublishTimer = undefined;
      publish();
    }, scrollCoalesceMs);
  }

  function cancelScrollPublish(): void {
    if (scrollPublishTimer !== undefined) {
      clearTimer(scrollPublishTimer);
      scrollPublishTimer = undefined;
    }
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
      publishScrollCoalesced();
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
    // Flush any pending scroll publish together with this button change.
    cancelScrollPublish();
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
    cancelScrollPublish();
    publish();
  }

  function disable(): void {
    status = "disabled";
    message = undefined;
    pressedButtons.clear();
    lastScrollDirection = undefined;
    lastScrollAt = undefined;
    cancelScrollPublish();
    publish();
  }

  return {
    getSnapshot,
    applyEvent,
    applyStatus,
    disable,
  };
}
