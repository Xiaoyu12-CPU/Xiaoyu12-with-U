import type { SystemStatusItemId } from "../system/statusItems";

export type DesktopDisplayMode = "pet-only" | "status-only" | "both";

export interface DesktopPetSettings {
  schemaVersion: 1;
  appearance: {
    petScale: number;
    alwaysOnTop: boolean;
  };
  dialogue: {
    bubbleDurationMs: number;
    showDevelopmentMessageOnStartup: boolean;
    enableClickDialogue: boolean;
    /** @deprecated Hover is no longer an active runtime interaction. */
    enableHoverDialogue: boolean;
    enableDragDialogue: boolean;
  };
  animation: {
    enabled: boolean;
  };
  systemMonitor: {
    enabled: boolean;
    cpuEnabled: boolean;
    cpuHighThreshold: number;
    cpuPollIntervalMs: number;
    memoryEnabled: boolean;
    memoryHighThreshold: number;
    networkEnabled: boolean;
    storageEnabled: boolean;
    batteryEnabled: boolean;
  };
  systemStatusBubble: {
    displayMode: DesktopDisplayMode;
    offsetX: number;
    offsetY: number;
    panelWidth: number;
    panelScale: number;
    visibleItems: SystemStatusItemId[];
    backgroundColor: string;
    backgroundOpacity: number;
    textColor: string;
    borderColor: string;
    borderWidth: number;
  };
  input: {
    keyboardEnabled: boolean;
    mouseEnabled: boolean;
  };
  reminder: {
    enabled: boolean;
  };
}

export type SettingsSection = Exclude<keyof DesktopPetSettings, "schemaVersion">;

export type SettingsPatch = {
  [Section in SettingsSection]?: Partial<DesktopPetSettings[Section]>;
};
