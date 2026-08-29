import { ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentScope, onScopeDispose } from "vue";
import { settingsManager } from "../settings/settingsManager";

const OVERLAY_LABELS = {
  systemStatus: "system-status",
  inputMonitor: "input-monitor",
} as const;

const SETTINGS_UPDATED_EVENT = "desktop-pet://settings-updated";

/**
 * Runs in the pet (main) window: watches the pet window position and moves
 * the enabled overlay windows along with it when follow-pet mode is on.
 * The overlays themselves stay freely draggable - follow mode only applies
 * the pet's own movement deltas, never the other way around.
 */
export function useFollowPet(): void {
  const disposed = ref(false);
  let unlistenMoved: UnlistenFn | undefined;
  let unlistenSettings: UnlistenFn | undefined;

  let lastPosition: { x: number; y: number } | null = null;

  async function follow(deltaX: number, deltaY: number): Promise<void> {
    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    const windows = settingsManager.settings.value.windows;
    if (!windows.followPet) {
      return;
    }

    const targets: string[] = [];
    if (windows.systemStatusWindowEnabled) {
      targets.push(OVERLAY_LABELS.systemStatus);
    }
    if (windows.inputMonitorWindowEnabled) {
      targets.push(OVERLAY_LABELS.inputMonitor);
    }

    await Promise.allSettled(
      targets.map((label) =>
        invoke("move_overlay_window", { label, deltaX, deltaY }),
      ),
    );
  }

  if (isTauri()) {
    void getCurrentWindow()
      .onMoved(({ payload }) => {
        const previous = lastPosition;
        lastPosition = { x: payload.x, y: payload.y };

        if (!previous) {
          // First reading only records the baseline; otherwise opening an
          // overlay would teleport it by the window's absolute position.
          return;
        }

        void follow(payload.x - previous.x, payload.y - previous.y);
      })
      .then((unlisten) => {
        if (disposed.value) {
          unlisten();
        } else {
          unlistenMoved = unlisten;
        }
      });

    void listen(SETTINGS_UPDATED_EVENT, () => {
      // Nothing to do per update: toggling follow mode or window switches
      // takes effect on the next move event, and deltas come from
      // consecutive positions regardless.
    }).then((unlisten) => {
      if (disposed.value) {
        unlisten();
      } else {
        unlistenSettings = unlisten;
      }
    });
  }

  function dispose(): void {
    disposed.value = true;
    unlistenMoved?.();
    unlistenSettings?.();
  }

  if (getCurrentScope()) {
    onScopeDispose(dispose);
  }
}
