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
      showDevelopmentMessageOnStartup: booleanOrDefault(
        dialogue.showDevelopmentMessageOnStartup,
        DEFAULT_SETTINGS.dialogue.showDevelopmentMessageOnStartup,
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
      displayMode: displayModeOrDefault(
        systemStatusBubble.displayMode,
        DEFAULT_SETTINGS.systemStatusBubble.displayMode,
      ),
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
      mouseEnabled: booleanOrDefault(
        input.mouseEnabled,
        DEFAULT_SETTINGS.input.mouseEnabled,
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
  };
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

function displayModeOrDefault(
  value: unknown,
  fallback: DesktopPetSettings["systemStatusBubble"]["displayMode"],
): DesktopPetSettings["systemStatusBubble"]["displayMode"] {
  return value === "pet-only" || value === "status-only" || value === "both"
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
