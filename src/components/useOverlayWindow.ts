import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentScope, onScopeDispose, ref } from "vue";
import type { OverlayLabel } from "../pet/desktopWindows";

const POSITION_SAVE_DELAY_MS = 220;

export function useOverlayWindow(label: OverlayLabel) {
  const isDragging = ref(false);
  let disposed = false;
  let unlistenMoved: UnlistenFn | undefined;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let resizeRunning = false;
  let pendingSize: { width: number; height: number } | undefined;

  function schedulePositionSave(): void {
    if (!isTauri() || disposed) return;
    if (saveTimer !== undefined) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      void invoke("save_overlay_window_position", { label }).catch((error) => {
        console.error(`Failed to save ${label} position.`, error);
      });
    }, POSITION_SAVE_DELAY_MS);
  }

  async function startDragging(event: PointerEvent): Promise<void> {
    if (!isTauri() || event.button !== 0 || isDragging.value) return;
    isDragging.value = true;
    try {
      await getCurrentWindow().startDragging();
    } catch (error) {
      console.error(`Failed to drag ${label}.`, error);
    } finally {
      isDragging.value = false;
      schedulePositionSave();
    }
  }

  async function flushResize(): Promise<void> {
    if (resizeRunning || !pendingSize || disposed || !isTauri()) return;
    resizeRunning = true;
    try {
      while (pendingSize && !disposed) {
        const size = pendingSize;
        pendingSize = undefined;
        await invoke("resize_overlay_window", { label, ...size });
      }
    } catch (error) {
      console.error(`Failed to resize ${label}.`, error);
    } finally {
      resizeRunning = false;
      if (pendingSize && !disposed) void flushResize();
    }
  }

  function resize(width: number, height: number): void {
    pendingSize = {
      width: Math.max(1, Math.ceil(width)),
      height: Math.max(1, Math.ceil(height)),
    };
    void flushResize();
  }

  if (isTauri()) {
    void getCurrentWindow().onMoved(schedulePositionSave).then((unlisten) => {
      if (disposed) unlisten();
      else unlistenMoved = unlisten;
    });
  }

  function dispose(): void {
    disposed = true;
    unlistenMoved?.();
    if (saveTimer !== undefined) clearTimeout(saveTimer);
  }

  if (getCurrentScope()) onScopeDispose(dispose);

  return { isDragging, startDragging, resize };
}
