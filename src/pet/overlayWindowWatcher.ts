import { invoke, isTauri } from "@tauri-apps/api/core";
import { watch } from "vue";
import { getCurrentScope, onScopeDispose } from "vue";
import { settingsManager } from "../settings/settingsManager";

const SYSTEM_STATUS_LABEL = "system-status";
const INPUT_MONITOR_LABEL = "input-monitor";

/**
 * Keeps the overlay windows in sync with the `windows` settings section:
 * opening/closing windows when their switches flip and applying the
 * click-through flags. Runs in the pet (main) window, which owns the
 * windows lifecycle.
 */
export function useOverlayWindowWatcher(): void {
  if (!isTauri()) {
    return;
  }

  async function sync(): Promise<void> {
    const windows = settingsManager.settings.value.windows;

    await Promise.allSettled([
      windows.systemStatusWindowEnabled
        ? invoke("open_overlay_window", { label: SYSTEM_STATUS_LABEL })
        : closeWindow(SYSTEM_STATUS_LABEL),
      windows.inputMonitorWindowEnabled
        ? invoke("open_overlay_window", { label: INPUT_MONITOR_LABEL })
        : closeWindow(INPUT_MONITOR_LABEL),
      invoke("set_overlay_click_through", {
        label: SYSTEM_STATUS_LABEL,
        enabled: windows.systemStatusClickThrough,
      }),
      invoke("set_overlay_click_through", {
        label: INPUT_MONITOR_LABEL,
        enabled: windows.inputMonitorClickThrough,
      }),
    ]);
  }

  async function closeWindow(label: string): Promise<void> {
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const target = await WebviewWindow.getByLabel(label);
      await target?.close();
    } catch {
      // Window already gone or close refused; nothing else to do.
    }
  }

  const stopWatching = watch(
    () => ({ ...settingsManager.settings.value.windows }),
    () => {
      void sync();
    },
    { deep: true, immediate: true },
  );

  if (getCurrentScope()) {
    onScopeDispose(stopWatching);
  }
}
