import type { SystemStatusItemId } from "../system/statusItems";

export type DesktopDisplayMode = "pet-only" | "status-only" | "both";

export interface DesktopWindowSettings {
  systemStatusWindowEnabled: boolean;
  keyboardHistoryWindowEnabled: boolean;
  mouseVisualizerWindowEnabled: boolean;
  systemStatusClickThrough: boolean;
  keyboardHistoryClickThrough: boolean;
  mouseVisualizerClickThrough: boolean;
  followPet: boolean;
}
export type KeyDisplayPosition = "top" | "bottom" | "left" | "right";
export type MouseVisualizerPosition = "top" | "bottom" | "left" | "right";
export type ControlCenterBackgroundImageFit =
  | "cover"
  | "contain"
  | "stretch"
  | "center"
  | "tile";
export type KeyDisplayFlowDirection =
  | "auto"
  | "up"
  | "down"
  | "left"
  | "right";

export interface DesktopPetSettings {
  schemaVersion: 1;
  appearance: {
    petScale: number;
    alwaysOnTop: boolean;
  };
  dialogue: {
    bubbleDurationMs: number;
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
    keyDisplayEnabled: boolean;
    keyDisplayMaxItems: number;
    keyDisplayDurationMs: number;
    keyDisplayPersistent: boolean;
    keyDisplayPosition: KeyDisplayPosition;
    keyDisplayFlowDirection: KeyDisplayFlowDirection;
    keyDisplayOffsetX: number;
    keyDisplayOffsetY: number;
    keyDisplayStartLineGapPx: number;
    keyDisplayStartLineColor: string;
    keyDisplayStartLineOpacity: number;
    typingBusyEnabled: boolean;
    typingBusyWindowSeconds: number;
    typingBusyCountThreshold: number;
    typingBusyText: string;
    typingSpeedEnabled: boolean;
    typingSpeedThresholdPerSecond: number;
    typingSpeedText: string;
    typingFeedbackCooldownSeconds: number;
    mouseEnabled: boolean;
    mouseVisualizerEnabled: boolean;
    mouseVisualizerPosition: MouseVisualizerPosition;
    mouseVisualizerOffsetX: number;
    mouseVisualizerOffsetY: number;
    mouseVisualizerBodyColor: string;
    mouseVisualizerBodyOpacity: number;
    mouseVisualizerButtonColor: string;
    mouseVisualizerButtonOpacity: number;
    mouseVisualizerOutlineColor: string;
    mouseVisualizerOutlineOpacity: number;
    mouseVisualizerOutlineWidth: number;
    mouseVisualizerActiveColor: string;
    mouseVisualizerActiveOpacity: number;
  };
  reminder: {
    enabled: boolean;
    soundVolume: number;
  };
  windows: DesktopWindowSettings;
  controlCenter: {
    backgroundColor: string;
    backgroundOpacity: number;
    backgroundImage: string | null;
    backgroundImageFit: ControlCenterBackgroundImageFit;
    backgroundImageOpacity: number;
    sidebarBackgroundColor: string;
    sidebarBackgroundOpacity: number;
    sidebarTextColor: string;
    sidebarActiveBackgroundColor: string;
    sidebarActiveBackgroundOpacity: number;
    sidebarActiveTextColor: string;
    primaryTextColor: string;
    secondaryTextColor: string;
    cardBackgroundColor: string;
    cardBackgroundOpacity: number;
    cardBorderColor: string;
    cardBorderOpacity: number;
    cardBorderWidth: number;
    accentColor: string;
  };
}

export type SettingsSection = Exclude<keyof DesktopPetSettings, "schemaVersion">;

export type SettingsPatch = {
  [Section in SettingsSection]?: Partial<DesktopPetSettings[Section]>;
};
