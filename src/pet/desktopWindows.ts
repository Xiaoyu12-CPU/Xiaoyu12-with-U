import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentScope, onScopeDispose, watch } from "vue";
import { settingsManager } from "../settings/settingsManager";
import type { DesktopPetSettings } from "../settings/settingsTypes";
import {
  calculateDefaultOverlayOffset,
  calculateKeyboardWindowLayout,
  calculateMouseWindowSize,
  estimateSystemWindowSize,
  type OverlayWindowSize,
} from "./desktopWindowLayout";

export const OVERLAY_LABELS = {
  systemStatus: "system-status",
  keyboardHistory: "keyboard-history",
  mouseVisualizer: "mouse-visualizer",
} as const;

export type OverlayLabel = (typeof OVERLAY_LABELS)[keyof typeof OVERLAY_LABELS];

export interface OverlayWindowOptions extends OverlayWindowSize {
  label: OverlayLabel;
  visible: boolean;
  clickThrough: boolean;
  alwaysOnTop: boolean;
  followPet: boolean;
  defaultOffsetX: number;
  defaultOffsetY: number;
}

export function buildOverlayWindowOptions(
  settings: DesktopPetSettings,
): OverlayWindowOptions[] {
  const systemSize = estimateSystemWindowSize({
    panelWidth: settings.systemStatusBubble.panelWidth,
    panelScale: settings.systemStatusBubble.panelScale,
    visibleItemCount: settings.systemStatusBubble.visibleItems.length,
  });
  const keyboardSize = calculateKeyboardWindowLayout({
    petScale: settings.appearance.petScale,
    position: settings.input.keyDisplayPosition,
    flowDirection: settings.input.keyDisplayFlowDirection,
    maxItems: settings.input.keyDisplayMaxItems,
    startLineGapPx: settings.input.keyDisplayStartLineGapPx,
  });
  const mouseSize = calculateMouseWindowSize(settings.appearance.petScale);
  const common = {
    alwaysOnTop: settings.appearance.alwaysOnTop,
    followPet: settings.windows.followPet,
  };
  const systemOffset = calculateDefaultOverlayOffset({
    kind: OVERLAY_LABELS.systemStatus,
    petScale: settings.appearance.petScale,
    overlaySize: systemSize,
    legacyOffsetX: settings.systemStatusBubble.offsetX,
    legacyOffsetY: settings.systemStatusBubble.offsetY,
  });
  const keyboardOffset = calculateDefaultOverlayOffset({
    kind: OVERLAY_LABELS.keyboardHistory,
    petScale: settings.appearance.petScale,
    overlaySize: keyboardSize,
    position: settings.input.keyDisplayPosition,
    legacyOffsetX: settings.input.keyDisplayOffsetX,
    legacyOffsetY: settings.input.keyDisplayOffsetY,
  });
  const mouseOffset = calculateDefaultOverlayOffset({
    kind: OVERLAY_LABELS.mouseVisualizer,
    petScale: settings.appearance.petScale,
    overlaySize: mouseSize,
    position: settings.input.mouseVisualizerPosition,
    legacyOffsetX: settings.input.mouseVisualizerOffsetX,
    legacyOffsetY: settings.input.mouseVisualizerOffsetY,
  });

  return [
    {
      ...common,
      ...systemSize,
      label: OVERLAY_LABELS.systemStatus,
      visible: settings.windows.systemStatusWindowEnabled,
      clickThrough: settings.windows.systemStatusClickThrough,
      defaultOffsetX: systemOffset.x,
      defaultOffsetY: systemOffset.y,
    },
    {
      ...common,
      width: keyboardSize.width,
      height: keyboardSize.height,
      label: OVERLAY_LABELS.keyboardHistory,
      visible: settings.windows.keyboardHistoryWindowEnabled,
      clickThrough: settings.windows.keyboardHistoryClickThrough,
      defaultOffsetX: keyboardOffset.x,
      defaultOffsetY: keyboardOffset.y,
    },
    {
      ...common,
      ...mouseSize,
      label: OVERLAY_LABELS.mouseVisualizer,
      visible: settings.windows.mouseVisualizerWindowEnabled,
      clickThrough: settings.windows.mouseVisualizerClickThrough,
      defaultOffsetX: mouseOffset.x,
      defaultOffsetY: mouseOffset.y,
    },
  ];
}

export function useDesktopWindowCoordinator(): void {
  if (!isTauri()) {
    return;
  }

  let disposed = false;
  let syncing = false;
  let syncRequested = false;
  let followRunning = false;
  let followRequested = false;
  let unlistenMoved: UnlistenFn | undefined;

  async function flushSync(): Promise<void> {
    if (syncing || disposed) {
      return;
    }
    syncing = true;
    try {
      do {
        syncRequested = false;
        const options = buildOverlayWindowOptions(settingsManager.getSettings());
        for (const option of options) {
          if (disposed) return;
          try {
            await invoke("sync_overlay_window", { options: option });
          } catch (error) {
            console.error(`Failed to synchronize ${option.label}.`, error);
          }
        }
      } while (syncRequested && !disposed);
    } catch (error) {
      console.error("Failed to synchronize desktop windows.", error);
    } finally {
      syncing = false;
      if (syncRequested && !disposed) {
        void flushSync();
      }
    }
  }

  function requestSync(): void {
    syncRequested = true;
    void flushSync();
  }

  async function flushFollow(): Promise<void> {
    if (followRunning || disposed) {
      return;
    }
    followRunning = true;
    try {
      do {
        followRequested = false;
        const settings = settingsManager.getSettings();
        if (!settings.windows.followPet) continue;
        const labels = buildOverlayWindowOptions(settings)
          .filter(({ visible }) => visible)
          .map(({ label }) => label);
        await invoke("follow_overlay_windows", { labels });
      } while (followRequested && !disposed);
    } catch (error) {
      console.error("Failed to move overlay windows with the pet.", error);
    } finally {
      followRunning = false;
      if (followRequested && !disposed) {
        void flushFollow();
      }
    }
  }

  function requestFollow(): void {
    followRequested = true;
    void flushFollow();
  }

  const stopWatching = watch(
    settingsManager.settings,
    requestSync,
    { deep: true },
  );

  void getCurrentWindow().onMoved(requestFollow).then((unlisten) => {
    if (disposed) {
      unlisten();
    } else {
      unlistenMoved = unlisten;
    }
  });

  requestSync();

  function dispose(): void {
    disposed = true;
    stopWatching();
    unlistenMoved?.();
  }

  if (getCurrentScope()) {
    onScopeDispose(dispose);
  }
}

export async function resetOverlayPosition(label: OverlayLabel): Promise<void> {
  if (!isTauri()) return;
  const option = buildOverlayWindowOptions(settingsManager.getSettings())
    .find((candidate) => candidate.label === label);
  if (!option) return;
  await invoke("reset_overlay_window_position", {
    label,
    defaultOffsetX: option.defaultOffsetX,
    defaultOffsetY: option.defaultOffsetY,
  });
}
