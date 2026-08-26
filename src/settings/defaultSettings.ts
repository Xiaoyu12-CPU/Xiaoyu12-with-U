import type { DesktopPetSettings } from "./settingsTypes";

export const DEFAULT_SETTINGS: Readonly<DesktopPetSettings> = {
  schemaVersion: 1,
  appearance: {
    petScale: 1,
    alwaysOnTop: true,
  },
  dialogue: {
    bubbleDurationMs: 2500,
    showDevelopmentMessageOnStartup: true,
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
    displayMode: "pet-only",
    offsetX: 190,
    offsetY: 0,
    panelWidth: 184,
    panelScale: 1,
    visibleItems: ["cpu", "memory", "network", "storage"],
    backgroundColor: "#FFFFFF",
    backgroundOpacity: 0.85,
    textColor: "#2B2738",
    borderColor: "#D8D2E6",
    borderWidth: 1,
  },
  input: {
    keyboardEnabled: false,
    keyDisplayEnabled: true,
    keyDisplayMaxItems: 4,
    keyDisplayDurationMs: 3000,
    keyDisplayPersistent: false,
    keyDisplayPosition: "bottom",
    keyDisplayFlowDirection: "auto",
    keyDisplayOffsetX: 0,
    keyDisplayOffsetY: 0,
    keyDisplayStartLineGapPx: 8,
    keyDisplayStartLineColor: "#8B5CF6",
    keyDisplayStartLineOpacity: 0.5,
    mouseEnabled: false,
    mouseVisualizerEnabled: true,
    mouseVisualizerPosition: "left",
    mouseVisualizerOffsetX: 0,
    mouseVisualizerOffsetY: 0,
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
};

export function createDefaultSettings(): DesktopPetSettings {
  return structuredClone(DEFAULT_SETTINGS);
}
