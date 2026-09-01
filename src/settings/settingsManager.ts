import { readonly, ref } from "vue";
import {
  createDefaultSettings,
  DEFAULT_SETTINGS,
} from "./defaultSettings";
import { settingsStorage } from "./settingsStorage";
import { SYSTEM_STATUS_ITEM_IDS } from "../system/statusItems";
import type { SystemStatusItemId } from "../system/statusItems";
import type {
  DesktopPetSettings,
  SettingsPatch,
  SettingsSection,
} from "./settingsTypes";
import {
  isBuiltinControlCenterBackground,
  isManagedControlCenterBackground,
} from "./controlCenterBackgroundReference";

const SAVE_DEBOUNCE_MS = 150;
const settings = ref<DesktopPetSettings>(createDefaultSettings());
const isLoaded = ref(false);
const isSaving = ref(false);
const lastError = ref("");
const lastSavedAt = ref<string>();
let initializePromise: Promise<void> | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saveRequestedWhileSaving = false;

async function initialize(): Promise<void> {
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    try {
      const stored = await settingsStorage.load();
      settings.value = stored === undefined
        ? createDefaultSettings()
        : normalizeSettings(stored);
      lastError.value = "";
    } catch (error) {
      settings.value = createDefaultSettings();
      lastError.value = `settings.json 无法读取，已使用默认配置：${toErrorMessage(error)}`;
      console.error("Failed to load settings; using defaults.", error);
    } finally {
      isLoaded.value = true;
    }

    try {
      await settingsStorage.subscribe((value) => {
        try {
          settings.value = normalizeSettings(value);
          lastError.value = "";
        } catch (error) {
          console.error("Ignored invalid settings update.", error);
        }
      });
    } catch (error) {
      lastError.value = toErrorMessage(error);
    }
  })();

  return initializePromise;
}

function getSettings(): Readonly<DesktopPetSettings> {
  return settings.value;
}

function updateSetting<
  Section extends SettingsSection,
  Key extends keyof DesktopPetSettings[Section],
>(
  section: Section,
  key: Key,
  value: DesktopPetSettings[Section][Key],
): void {
  update({
    [section]: {
      ...settings.value[section],
      [key]: value,
    },
  } as SettingsPatch);
}

function update(patch: SettingsPatch): void {
  settings.value = normalizeSettings({
    ...settings.value,
    appearance: { ...settings.value.appearance, ...patch.appearance },
    dialogue: { ...settings.value.dialogue, ...patch.dialogue },
    animation: { ...settings.value.animation, ...patch.animation },
    systemMonitor: {
      ...settings.value.systemMonitor,
      ...patch.systemMonitor,
    },
    systemStatusBubble: {
      ...settings.value.systemStatusBubble,
      ...patch.systemStatusBubble,
    },
    input: { ...settings.value.input, ...patch.input },
    reminder: { ...settings.value.reminder, ...patch.reminder },
    windows: { ...settings.value.windows, ...patch.windows },
    controlCenter: {
      ...settings.value.controlCenter,
      ...patch.controlCenter,
    },
  });
  scheduleSave();
}

function resetDefaults(): void {
  settings.value = createDefaultSettings();
  scheduleSave();
}

function scheduleSave(): void {
  if (saveTimer !== undefined) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void save();
  }, SAVE_DEBOUNCE_MS);
}

async function save(): Promise<void> {
  if (saveTimer !== undefined) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }

  if (isSaving.value) {
    saveRequestedWhileSaving = true;
    return;
  }

  isSaving.value = true;
  lastError.value = "";

  do {
    saveRequestedWhileSaving = false;

    try {
      const snapshot = normalizeSettings(settings.value);
      await settingsStorage.save(snapshot);
      await settingsStorage.broadcast(snapshot);
      lastSavedAt.value = new Date().toISOString();
      lastError.value = "";
    } catch (error) {
      lastError.value = toErrorMessage(error);
      console.error("Failed to save settings.", error);
    }
  } while (saveRequestedWhileSaving);

  isSaving.value = false;
}

export function normalizeSettings(value: unknown): DesktopPetSettings {
  if (!isRecord(value)) {
    throw new Error("Settings document must be an object.");
  }
  if (value.schemaVersion !== undefined && value.schemaVersion !== 1) {
    throw new Error(`Unsupported settings schemaVersion: ${String(value.schemaVersion)}`);
  }

  const appearance = isRecord(value.appearance) ? value.appearance : {};
  const dialogue = isRecord(value.dialogue) ? value.dialogue : {};
  const animation = isRecord(value.animation) ? value.animation : {};
  const systemMonitor = isRecord(value.systemMonitor) ? value.systemMonitor : {};
  const systemStatusBubble = isRecord(value.systemStatusBubble)
    ? value.systemStatusBubble
    : {};
  const input = isRecord(value.input) ? value.input : {};
  const reminder = isRecord(value.reminder) ? value.reminder : {};
  const windows = isRecord(value.windows) ? value.windows : {};
  const controlCenter = isRecord(value.controlCenter) ? value.controlCenter : {};
  const legacyInputWindowEnabled = optionalBoolean(
    windows.inputMonitorWindowEnabled,
  );

  return {
    schemaVersion: 1,
    appearance: {
      petScale: clampNumber(
        appearance.petScale,
        0.5,
        2,
        DEFAULT_SETTINGS.appearance.petScale,
      ),
      alwaysOnTop: booleanOrDefault(
        appearance.alwaysOnTop,
        DEFAULT_SETTINGS.appearance.alwaysOnTop,
      ),
    },
    dialogue: {
      bubbleDurationMs: clampNumber(
        dialogue.bubbleDurationMs,
        250,
        60000,
        DEFAULT_SETTINGS.dialogue.bubbleDurationMs,
      ),
      enableClickDialogue: booleanOrDefault(
        dialogue.enableClickDialogue,
        DEFAULT_SETTINGS.dialogue.enableClickDialogue,
      ),
      enableHoverDialogue: booleanOrDefault(
        dialogue.enableHoverDialogue,
        DEFAULT_SETTINGS.dialogue.enableHoverDialogue,
      ),
      enableDragDialogue: booleanOrDefault(
        dialogue.enableDragDialogue,
        DEFAULT_SETTINGS.dialogue.enableDragDialogue,
      ),
    },
    animation: {
      enabled: booleanOrDefault(
        animation.enabled,
        DEFAULT_SETTINGS.animation.enabled,
      ),
    },
    systemMonitor: {
      enabled: booleanOrDefault(
        systemMonitor.enabled,
        DEFAULT_SETTINGS.systemMonitor.enabled,
      ),
      cpuEnabled: booleanOrDefault(
        systemMonitor.cpuEnabled,
        DEFAULT_SETTINGS.systemMonitor.cpuEnabled,
      ),
      cpuHighThreshold: clampNumber(
        systemMonitor.cpuHighThreshold,
        10,
        100,
        DEFAULT_SETTINGS.systemMonitor.cpuHighThreshold,
      ),
      cpuPollIntervalMs: clampNumber(
        systemMonitor.cpuPollIntervalMs,
        500,
        10000,
        DEFAULT_SETTINGS.systemMonitor.cpuPollIntervalMs,
      ),
      memoryEnabled: booleanOrDefault(
        systemMonitor.memoryEnabled,
        DEFAULT_SETTINGS.systemMonitor.memoryEnabled,
      ),
      memoryHighThreshold: clampNumber(
        systemMonitor.memoryHighThreshold,
        50,
        100,
        DEFAULT_SETTINGS.systemMonitor.memoryHighThreshold,
      ),
      networkEnabled: booleanOrDefault(
        systemMonitor.networkEnabled,
        DEFAULT_SETTINGS.systemMonitor.networkEnabled,
      ),
      storageEnabled: booleanOrDefault(
        systemMonitor.storageEnabled,
        DEFAULT_SETTINGS.systemMonitor.storageEnabled,
      ),
      batteryEnabled: booleanOrDefault(
        systemMonitor.batteryEnabled,
        DEFAULT_SETTINGS.systemMonitor.batteryEnabled,
      ),
    },
    systemStatusBubble: {
      offsetX: clampNumber(
        systemStatusBubble.offsetX,
        -500,
        500,
        DEFAULT_SETTINGS.systemStatusBubble.offsetX,
      ),
      offsetY: clampNumber(
        systemStatusBubble.offsetY,
        -500,
        500,
        DEFAULT_SETTINGS.systemStatusBubble.offsetY,
      ),
      panelWidth: clampNumber(
        systemStatusBubble.panelWidth,
        180,
        420,
        DEFAULT_SETTINGS.systemStatusBubble.panelWidth,
      ),
      panelScale: clampNumber(
        systemStatusBubble.panelScale,
        0.7,
        1.6,
        DEFAULT_SETTINGS.systemStatusBubble.panelScale,
      ),
      visibleItems: statusItemsOrDefault(systemStatusBubble.visibleItems),
      backgroundColor: hexColorOrDefault(
        systemStatusBubble.backgroundColor,
        DEFAULT_SETTINGS.systemStatusBubble.backgroundColor,
      ),
      backgroundOpacity: clampNumber(
        systemStatusBubble.backgroundOpacity,
        0,
        1,
        DEFAULT_SETTINGS.systemStatusBubble.backgroundOpacity,
      ),
      textColor: hexColorOrDefault(
        systemStatusBubble.textColor,
        DEFAULT_SETTINGS.systemStatusBubble.textColor,
      ),
      borderColor: hexColorOrDefault(
        systemStatusBubble.borderColor,
        DEFAULT_SETTINGS.systemStatusBubble.borderColor,
      ),
      borderWidth: clampNumber(
        systemStatusBubble.borderWidth,
        0,
        6,
        DEFAULT_SETTINGS.systemStatusBubble.borderWidth,
      ),
    },
    input: {
      keyboardEnabled: booleanOrDefault(
        input.keyboardEnabled,
        DEFAULT_SETTINGS.input.keyboardEnabled,
      ),
      keyDisplayEnabled: booleanOrDefault(
        input.keyDisplayEnabled,
        DEFAULT_SETTINGS.input.keyDisplayEnabled,
      ),
      keyDisplayMaxItems: Math.round(
        clampNumber(
          input.keyDisplayMaxItems,
          1,
          8,
          DEFAULT_SETTINGS.input.keyDisplayMaxItems,
        ),
      ),
      keyDisplayDurationMs: Math.round(
        clampNumber(
          input.keyDisplayDurationMs,
          500,
          10000,
          DEFAULT_SETTINGS.input.keyDisplayDurationMs,
        ),
      ),
      keyDisplayPersistent: booleanOrDefault(
        input.keyDisplayPersistent,
        DEFAULT_SETTINGS.input.keyDisplayPersistent,
      ),
      keyDisplayPosition: keyDisplayPositionOrDefault(
        input.keyDisplayPosition,
        DEFAULT_SETTINGS.input.keyDisplayPosition,
      ),
      keyDisplayFlowDirection: keyDisplayFlowOrDefault(
        input.keyDisplayFlowDirection,
        DEFAULT_SETTINGS.input.keyDisplayFlowDirection,
      ),
      keyDisplayOffsetX: clampNumber(
        input.keyDisplayOffsetX,
        -500,
        500,
        DEFAULT_SETTINGS.input.keyDisplayOffsetX,
      ),
      keyDisplayOffsetY: clampNumber(
        input.keyDisplayOffsetY,
        -500,
        500,
        DEFAULT_SETTINGS.input.keyDisplayOffsetY,
      ),
      keyDisplayStartLineGapPx: clampNumber(
        input.keyDisplayStartLineGapPx,
        0,
        80,
        DEFAULT_SETTINGS.input.keyDisplayStartLineGapPx,
      ),
      keyDisplayStartLineColor: hexColorOrDefault(
        input.keyDisplayStartLineColor,
        DEFAULT_SETTINGS.input.keyDisplayStartLineColor,
      ),
      keyDisplayStartLineOpacity: clampNumber(
        input.keyDisplayStartLineOpacity,
        0,
        1,
        DEFAULT_SETTINGS.input.keyDisplayStartLineOpacity,
      ),
      typingBusyEnabled: booleanOrDefault(
        input.typingBusyEnabled,
        DEFAULT_SETTINGS.input.typingBusyEnabled,
      ),
      typingBusyWindowSeconds: Math.round(
        clampNumber(
          input.typingBusyWindowSeconds,
          10,
          600,
          DEFAULT_SETTINGS.input.typingBusyWindowSeconds,
        ),
      ),
      typingBusyCountThreshold: Math.round(
        clampNumber(
          input.typingBusyCountThreshold,
          10,
          5000,
          DEFAULT_SETTINGS.input.typingBusyCountThreshold,
        ),
      ),
      typingBusyText: nonEmptyTextOrDefault(
        input.typingBusyText,
        DEFAULT_SETTINGS.input.typingBusyText,
      ),
      typingSpeedEnabled: booleanOrDefault(
        input.typingSpeedEnabled,
        DEFAULT_SETTINGS.input.typingSpeedEnabled,
      ),
      typingSpeedThresholdPerSecond: Math.round(
        clampNumber(
          input.typingSpeedThresholdPerSecond,
          1,
          30,
          DEFAULT_SETTINGS.input.typingSpeedThresholdPerSecond,
        ),
      ),
      typingSpeedText: nonEmptyTextOrDefault(
        input.typingSpeedText,
        DEFAULT_SETTINGS.input.typingSpeedText,
      ),
      typingFeedbackCooldownSeconds: Math.round(
        clampNumber(
          input.typingFeedbackCooldownSeconds,
          1,
          600,
          DEFAULT_SETTINGS.input.typingFeedbackCooldownSeconds,
        ),
      ),
      mouseEnabled: booleanOrDefault(
        input.mouseEnabled,
        DEFAULT_SETTINGS.input.mouseEnabled,
      ),
      mouseVisualizerEnabled: booleanOrDefault(
        input.mouseVisualizerEnabled,
        DEFAULT_SETTINGS.input.mouseVisualizerEnabled,
      ),
      mouseVisualizerPosition: keyDisplayPositionOrDefault(
        input.mouseVisualizerPosition,
        DEFAULT_SETTINGS.input.mouseVisualizerPosition,
      ),
      mouseVisualizerOffsetX: clampNumber(
        input.mouseVisualizerOffsetX,
        -500,
        500,
        DEFAULT_SETTINGS.input.mouseVisualizerOffsetX,
      ),
      mouseVisualizerOffsetY: clampNumber(
        input.mouseVisualizerOffsetY,
        -500,
        500,
        DEFAULT_SETTINGS.input.mouseVisualizerOffsetY,
      ),
      mouseVisualizerBodyColor: hexColorOrDefault(
        input.mouseVisualizerBodyColor,
        DEFAULT_SETTINGS.input.mouseVisualizerBodyColor,
      ),
      mouseVisualizerBodyOpacity: clampNumber(
        input.mouseVisualizerBodyOpacity,
        0,
        1,
        DEFAULT_SETTINGS.input.mouseVisualizerBodyOpacity,
      ),
      mouseVisualizerButtonColor: hexColorOrDefault(
        input.mouseVisualizerButtonColor,
        DEFAULT_SETTINGS.input.mouseVisualizerButtonColor,
      ),
      mouseVisualizerButtonOpacity: clampNumber(
        input.mouseVisualizerButtonOpacity,
        0,
        1,
        DEFAULT_SETTINGS.input.mouseVisualizerButtonOpacity,
      ),
      mouseVisualizerOutlineColor: hexColorOrDefault(
        input.mouseVisualizerOutlineColor,
        DEFAULT_SETTINGS.input.mouseVisualizerOutlineColor,
      ),
      mouseVisualizerOutlineOpacity: clampNumber(
        input.mouseVisualizerOutlineOpacity,
        0,
        1,
        DEFAULT_SETTINGS.input.mouseVisualizerOutlineOpacity,
      ),
      mouseVisualizerOutlineWidth: clampNumber(
        input.mouseVisualizerOutlineWidth,
        0,
        4,
        DEFAULT_SETTINGS.input.mouseVisualizerOutlineWidth,
      ),
      mouseVisualizerActiveColor: hexColorOrDefault(
        input.mouseVisualizerActiveColor,
        DEFAULT_SETTINGS.input.mouseVisualizerActiveColor,
      ),
      mouseVisualizerActiveOpacity: clampNumber(
        input.mouseVisualizerActiveOpacity,
        0,
        1,
        DEFAULT_SETTINGS.input.mouseVisualizerActiveOpacity,
      ),
    },
    reminder: {
      enabled: booleanOrDefault(
        reminder.enabled,
        DEFAULT_SETTINGS.reminder.enabled,
      ),
      soundVolume: clampNumber(
        reminder.soundVolume,
        0,
        1,
        DEFAULT_SETTINGS.reminder.soundVolume,
      ),
    },
    windows: {
      systemStatusWindowEnabled: booleanOrDefault(
        windows.systemStatusWindowEnabled,
        DEFAULT_SETTINGS.windows.systemStatusWindowEnabled,
      ),
      keyboardHistoryWindowEnabled: booleanOrDefault(
        windows.keyboardHistoryWindowEnabled,
        legacyInputWindowEnabled
          ?? DEFAULT_SETTINGS.windows.keyboardHistoryWindowEnabled,
      ),
      mouseVisualizerWindowEnabled: booleanOrDefault(
        windows.mouseVisualizerWindowEnabled,
        legacyInputWindowEnabled
          ?? DEFAULT_SETTINGS.windows.mouseVisualizerWindowEnabled,
      ),
      systemStatusClickThrough: booleanOrDefault(
        windows.systemStatusClickThrough,
        DEFAULT_SETTINGS.windows.systemStatusClickThrough,
      ),
      keyboardHistoryClickThrough: booleanOrDefault(
        windows.keyboardHistoryClickThrough,
        optionalBoolean(windows.inputMonitorClickThrough)
          ?? DEFAULT_SETTINGS.windows.keyboardHistoryClickThrough,
      ),
      mouseVisualizerClickThrough: booleanOrDefault(
        windows.mouseVisualizerClickThrough,
        optionalBoolean(windows.inputMonitorClickThrough)
          ?? DEFAULT_SETTINGS.windows.mouseVisualizerClickThrough,
      ),
      followPet: booleanOrDefault(
        windows.followPet,
        DEFAULT_SETTINGS.windows.followPet,
      ),
    },
    controlCenter: {
      backgroundColor: hexColorOrDefault(
        controlCenter.backgroundColor,
        DEFAULT_SETTINGS.controlCenter.backgroundColor,
      ),
      backgroundOpacity: clampNumber(
        controlCenter.backgroundOpacity,
        0,
        1,
        DEFAULT_SETTINGS.controlCenter.backgroundOpacity,
      ),
      backgroundImage: backgroundReferenceOrDefault(controlCenter.backgroundImage),
      backgroundImageFit: backgroundFitOrDefault(controlCenter.backgroundImageFit),
      backgroundImageOpacity: clampNumber(
        controlCenter.backgroundImageOpacity,
        0,
        1,
        DEFAULT_SETTINGS.controlCenter.backgroundImageOpacity,
      ),
      sidebarBackgroundColor: hexColorOrDefault(
        controlCenter.sidebarBackgroundColor,
        DEFAULT_SETTINGS.controlCenter.sidebarBackgroundColor,
      ),
      sidebarBackgroundOpacity: clampNumber(
        controlCenter.sidebarBackgroundOpacity,
        0,
        1,
        DEFAULT_SETTINGS.controlCenter.sidebarBackgroundOpacity,
      ),
      sidebarTextColor: hexColorOrDefault(
        controlCenter.sidebarTextColor,
        DEFAULT_SETTINGS.controlCenter.sidebarTextColor,
      ),
      sidebarActiveBackgroundColor: hexColorOrDefault(
        controlCenter.sidebarActiveBackgroundColor,
        DEFAULT_SETTINGS.controlCenter.sidebarActiveBackgroundColor,
      ),
      sidebarActiveBackgroundOpacity: clampNumber(
        controlCenter.sidebarActiveBackgroundOpacity,
        0,
        1,
        DEFAULT_SETTINGS.controlCenter.sidebarActiveBackgroundOpacity,
      ),
      sidebarActiveTextColor: hexColorOrDefault(
        controlCenter.sidebarActiveTextColor,
        DEFAULT_SETTINGS.controlCenter.sidebarActiveTextColor,
      ),
      primaryTextColor: hexColorOrDefault(
        controlCenter.primaryTextColor,
        DEFAULT_SETTINGS.controlCenter.primaryTextColor,
      ),
      secondaryTextColor: hexColorOrDefault(
        controlCenter.secondaryTextColor,
        DEFAULT_SETTINGS.controlCenter.secondaryTextColor,
      ),
      cardBackgroundColor: hexColorOrDefault(
        controlCenter.cardBackgroundColor,
        DEFAULT_SETTINGS.controlCenter.cardBackgroundColor,
      ),
      cardBackgroundOpacity: clampNumber(
        controlCenter.cardBackgroundOpacity,
        0,
        1,
        DEFAULT_SETTINGS.controlCenter.cardBackgroundOpacity,
      ),
      cardBorderColor: hexColorOrDefault(
        controlCenter.cardBorderColor,
        DEFAULT_SETTINGS.controlCenter.cardBorderColor,
      ),
      cardBorderOpacity: clampNumber(
        controlCenter.cardBorderOpacity,
        0,
        1,
        DEFAULT_SETTINGS.controlCenter.cardBorderOpacity,
      ),
      cardBorderWidth: clampNumber(
        controlCenter.cardBorderWidth,
        0,
        6,
        DEFAULT_SETTINGS.controlCenter.cardBorderWidth,
      ),
      accentColor: hexColorOrDefault(
        controlCenter.accentColor,
        DEFAULT_SETTINGS.controlCenter.accentColor,
      ),
    },
  };
}

function backgroundReferenceOrDefault(value: unknown): string | null {
  if (value === undefined) {
    return DEFAULT_SETTINGS.controlCenter.backgroundImage;
  }
  if (value === null) {
    return null;
  }
  return typeof value === "string"
      && (isBuiltinControlCenterBackground(value)
        || isManagedControlCenterBackground(value))
    ? value
    : null;
}

function backgroundFitOrDefault(
  value: unknown,
): DesktopPetSettings["controlCenter"]["backgroundImageFit"] {
  return value === "cover"
      || value === "contain"
      || value === "stretch"
      || value === "center"
      || value === "tile"
    ? value
    : DEFAULT_SETTINGS.controlCenter.backgroundImageFit;
}

function clampNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(value, minimum), maximum)
    : fallback;
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function nonEmptyTextOrDefault(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim() || fallback;
}

function keyDisplayPositionOrDefault(
  value: unknown,
  fallback: DesktopPetSettings["input"]["keyDisplayPosition"],
): DesktopPetSettings["input"]["keyDisplayPosition"] {
  return value === "top" || value === "bottom" || value === "left" || value === "right"
    ? value
    : fallback;
}

function keyDisplayFlowOrDefault(
  value: unknown,
  fallback: DesktopPetSettings["input"]["keyDisplayFlowDirection"],
): DesktopPetSettings["input"]["keyDisplayFlowDirection"] {
  return value === "auto"
      || value === "up"
      || value === "down"
      || value === "left"
      || value === "right"
    ? value
    : fallback;
}

function statusItemsOrDefault(value: unknown): SystemStatusItemId[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_SETTINGS.systemStatusBubble.visibleItems];
  }

  return SYSTEM_STATUS_ITEM_IDS.filter((itemId) => value.includes(itemId));
}

function hexColorOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toUpperCase()
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const settingsManager = {
  settings: readonly(settings),
  isLoaded: readonly(isLoaded),
  isSaving: readonly(isSaving),
  lastError: readonly(lastError),
  lastSavedAt: readonly(lastSavedAt),
  initialize,
  getSettings,
  updateSetting,
  update,
  resetDefaults,
  save,
};
