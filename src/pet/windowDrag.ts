import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type WindowDragUnlisten = () => void;

export interface WindowDragAdapter {
  startDragging: () => Promise<void>;
  onMoved?: (listener: () => void) => Promise<WindowDragUnlisten>;
  onPrimaryButtonReleased?: (
    listener: () => void,
  ) => Promise<WindowDragUnlisten>;
}

export const PRIMARY_BUTTON_POLL_INTERVAL_MS = 50;

interface PrimaryButtonReleaseObserverDependencies {
  readPressed: () => Promise<boolean | null>;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
}

export function observePrimaryButtonRelease(
  listener: () => void,
  dependencies: PrimaryButtonReleaseObserverDependencies,
): WindowDragUnlisten {
  const setTimer = dependencies.setTimer ?? setTimeout;
  const clearTimer = dependencies.clearTimer ?? clearTimeout;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function poll(): Promise<void> {
    try {
      const pressed = await dependencies.readPressed();
      if (stopped) return;

      if (pressed === false) {
        stopped = true;
        listener();
        return;
      }

      // Non-Windows platforms return null and continue to use DOM release
      // events. Windows keeps polling until the native drag releases capture.
      if (pressed === true) {
        timer = setTimer(() => {
          timer = undefined;
          void poll();
        }, PRIMARY_BUTTON_POLL_INTERVAL_MS);
      }
    } catch (error) {
      if (!stopped) {
        console.error("Failed to observe the primary mouse button.", error);
      }
    }
  }

  void poll();

  return () => {
    stopped = true;
    if (timer !== undefined) clearTimer(timer);
  };
}

export const tauriWindowDragAdapter: WindowDragAdapter = {
  async startDragging(): Promise<void> {
    await getCurrentWindow().startDragging();
  },
  async onMoved(listener: () => void): Promise<WindowDragUnlisten> {
    return getCurrentWindow().onMoved(listener);
  },
  async onPrimaryButtonReleased(
    listener: () => void,
  ): Promise<WindowDragUnlisten> {
    if (!isTauri()) return () => {};
    return observePrimaryButtonRelease(listener, {
      readPressed: () => invoke<boolean | null>(
        "primary_mouse_button_pressed",
      ),
    });
  },
};
