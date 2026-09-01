import type { DesktopPetSettings } from "./settingsTypes";
import {
  TYPING_BUSY_DEFAULT_TEXT,
  TYPING_SPEED_DEFAULT_TEXT,
} from "../input/typingFeedback";
import { CONTROL_CENTER_BUILTIN_BACKGROUND_REFERENCE } from "./controlCenterBackgroundReference";

export const DEFAULT_SETTINGS: Readonly<DesktopPetSettings> = {
  schemaVersion: 1,
  general: {
    language: "zh-CN",
  },
  appearance: {
    petScale: 0.8,
    alwaysOnTop: true,
  },
  dialogue: {
    bubbleDurationMs: 2500,
    enableClickDialogue: true,
    // Legacy field retained so existing settings.json files remain compatible.
    enableHoverDialogue: true,
    enableDragDialogue: true,
  },
  animation: {
    enabled: true,
  },
  systemMonitor: {
    enabled: false,
    cpuEnabled: false,
    cpuHighThreshold: 80,
    cpuPollIntervalMs: 5000,
    memoryEnabled: false,
    memoryHighThreshold: 85,
    networkEnabled: false,
    storageEnabled: false,
    batteryEnabled: false,
  },
  systemStatusBubble: {
    offsetX: 19,
    offsetY: 152,
    panelWidth: 180,
    panelScale: 0.8,
    visibleItems: ["cpu", "memory"],
    backgroundColor: "#232323",
    backgroundOpacity: 0.35,
    textColor: "#EBEBEB",
    borderColor: "#D8D2E6",
    borderWidth: 2,
  },
  input: {
    keyboardEnabled: false,
    keyDisplayEnabled: false,
    keyDisplayMaxItems: 4,
    keyDisplayDurationMs: 2500,
    keyDisplayPersistent: false,
    keyDisplayPosition: "bottom",
    keyDisplayFlowDirection: "up",
    keyDisplayOffsetX: 115,
    keyDisplayOffsetY: -175,
    keyDisplayStartLineGapPx: 8,
    keyDisplayStartLineColor: "#8B5CF6",
    keyDisplayStartLineOpacity: 0.5,
    typingBusyEnabled: true,
    typingBusyWindowSeconds: 120,
    typingBusyCountThreshold: 200,
    typingBusyText: TYPING_BUSY_DEFAULT_TEXT,
    typingSpeedEnabled: true,
    typingSpeedThresholdPerSecond: 5,
    typingSpeedText: TYPING_SPEED_DEFAULT_TEXT,
    typingFeedbackCooldownSeconds: 10,
    mouseEnabled: false,
    mouseVisualizerEnabled: false,
    mouseVisualizerPosition: "left",
    mouseVisualizerOffsetX: 272,
    mouseVisualizerOffsetY: 159,
    mouseVisualizerBodyColor: "#F4F0FA",
    mouseVisualizerBodyOpacity: 0.3,
    mouseVisualizerButtonColor: "#FFFFFF",
    mouseVisualizerButtonOpacity: 0.42,
    mouseVisualizerOutlineColor: "#745BC9",
    mouseVisualizerOutlineOpacity: 0.7,
    mouseVisualizerOutlineWidth: 1.25,
    mouseVisualizerActiveColor: "#8B5CF6",
    mouseVisualizerActiveOpacity: 0.88,
  },
  reminder: {
    enabled: false,
    soundVolume: 0.7,
  },
  windows: {
    systemStatusWindowEnabled: false,
    keyboardHistoryWindowEnabled: false,
    mouseVisualizerWindowEnabled: false,
    systemStatusClickThrough: false,
    keyboardHistoryClickThrough: false,
    mouseVisualizerClickThrough: false,
    followPet: true,
  },
  controlCenter: {
    backgroundColor: "#ECF3F8",
    backgroundOpacity: 0.75,
    backgroundImage: CONTROL_CENTER_BUILTIN_BACKGROUND_REFERENCE,
    backgroundImageFit: "cover",
    backgroundImageOpacity: 0.7,
    sidebarBackgroundColor: "#2E073E",
    sidebarBackgroundOpacity: 0.5,
    sidebarTextColor: "#EBEBEB",
    sidebarActiveBackgroundColor: "#8B78FF",
    sidebarActiveBackgroundOpacity: 0.55,
    sidebarActiveTextColor: "#FFFFFF",
    primaryTextColor: "#30283D",
    secondaryTextColor: "#857C91",
    cardBackgroundColor: "#FFFFFF",
    cardBackgroundOpacity: 0.55,
    cardBorderColor: "#E392FE",
    cardBorderOpacity: 0.4,
    cardBorderWidth: 2.5,
    accentColor: "#745BC9",
  },
};

export function createDefaultSettings(): DesktopPetSettings {
  return structuredClone(DEFAULT_SETTINGS);
}

export function createDefaultControlCenterAppearance(): DesktopPetSettings["controlCenter"] {
  return structuredClone(DEFAULT_SETTINGS.controlCenter);
}
