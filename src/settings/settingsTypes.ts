import type { SystemStatusItemId } from "../system/statusItems";

/** @deprecated Replaced by the per-window switches in `windows`. */
export type DesktopDisplayMode = "pet-only" | "status-only" | "both";

/** Per-window visibility and behavior switches. */
export interface WindowSettings {
  /** Pet window (always true in practice; kept for completeness). */
  petWindowEnabled: boolean;
  /** Floating system-status window. */
  systemStatusWindowEnabled: boolean;
  /** Floating keyboard/mouse monitor window. */
  inputMonitorWindowEnabled: boolean;
  /** Click-through for the system-status window. */
  systemStatusClickThrough: boolean;
  /** Click-through for the input-monitor window. */
  inputMonitorClickThrough: boolean;
  /** Floating windows follow the pet window when it moves. */
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
    /** @deprecated Replaced by `windows.systemStatusWindowEnabled`. */
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
  windows: WindowSettings;
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
