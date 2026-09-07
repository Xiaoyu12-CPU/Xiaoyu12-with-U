import { readonly, ref } from "vue";
import {
  createDefaultSettings,
  DEFAULT_SETTINGS,
} from "./defaultSettings";
import { settingsStorage } from "./settingsStorage";
import { SYSTEM_STATUS_ITEM_IDS } from "../system/statusItems";
import type { SystemStatusItemId } from "../system/statusItems";
import type {
  AppLanguage,
  ControlCenterAppearance,
  ControlCenterAppearanceTheme,
  ControlCenterThemeState,
  DesktopPetSettings,
  SettingsPatch,
  SettingsSection,
} from "./settingsTypes";
import {
  CONTROL_CENTER_BUILTIN_BACKGROUND_REFERENCE,
  CONTROL_CENTER_MIKAN_BACKGROUND_REFERENCE,
  isBuiltinControlCenterBackground,
  isManagedControlCenterBackground,
} from "./controlCenterBackgroundReference";
import {
  createBlankControlCenterAppearance,
  createDefaultControlCenterThemeState,
  DEFAULT_CONTROL_CENTER_THEME_ID,
  DEFAULT_CONTROL_CENTER_THEME_NAME,
  findControlCenterTheme,
  MIKAN_CONTROL_CENTER_APPEARANCE,
  MIKAN_CONTROL_CENTER_THEME_ID,
  MIKAN_CONTROL_CENTER_THEME_NAME,
} from "./controlCenterAppearanceThemes";

const SAVE_DEBOUNCE_MS = 150;
const settings = ref<DesktopPetSettings>(createDefaultSettings());
const isLoaded = ref(false);
const isSaving = ref(false);
const lastError = ref("");
const lastSavedAt = ref<string>();
let initializePromise: Promise<void> | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saveRequestedWhileSaving = false;
let activeSavePromise: Promise<void> | undefined;
const pendingLocalBroadcasts = new Set<string>();

async function initialize(): Promise<void> {
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    try {
      const stored = await settingsStorage.load();
      if (stored === undefined) {
        settings.value = createDefaultSettings();
      } else {
        const normalized = normalizeSettings(stored);
        settings.value = normalized;
        if (JSON.stringify(stored) !== JSON.stringify(normalized)) {
          scheduleSave();
        }
      }
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
          const normalized = normalizeSettings(value);
          if (pendingLocalBroadcasts.delete(JSON.stringify(normalized))) {
            return;
          }
          settings.value = normalized;
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
  const nextControlCenter = {
    ...settings.value.controlCenter,
    ...patch.controlCenter,
  };
  const controlCenterThemePatch = patch.controlCenter
      && patch.controlCenterThemes?.themes === undefined
    ? {
        ...patch.controlCenterThemes,
        themes: settings.value.controlCenterThemes.themes.map((theme) => (
          theme.id === settings.value.controlCenterThemes.activeThemeId
            ? { ...theme, appearance: nextControlCenter }
            : theme
        )),
      }
    : patch.controlCenterThemes;
  settings.value = normalizeSettings({
    ...settings.value,
    general: { ...settings.value.general, ...patch.general },
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
    controlCenter: nextControlCenter,
    controlCenterThemes: {
      ...settings.value.controlCenterThemes,
      ...controlCenterThemePatch,
    },
  });
  scheduleSave();
}

function updateControlCenterAppearance<
  Key extends keyof ControlCenterAppearance,
>(key: Key, value: ControlCenterAppearance[Key]): void {
  const activeThemeId = settings.value.controlCenterThemes.activeThemeId;
  const appearance = {
    ...settings.value.controlCenter,
    [key]: value,
  };
  update({
    controlCenter: appearance,
    controlCenterThemes: {
      themes: settings.value.controlCenterThemes.themes.map((theme) => (
        theme.id === activeThemeId
          ? { ...theme, appearance }
          : theme
      )),
    },
  });
}

function selectControlCenterTheme(themeId: string): boolean {
  const currentState = settings.value.controlCenterThemes;
  const theme = findControlCenterTheme(currentState, themeId);
  if (!theme) {
    return false;
  }
  if (themeId !== currentState.activeThemeId) {
    settings.value = {
      ...settings.value,
      controlCenter: { ...theme.appearance },
      controlCenterThemes: {
        ...currentState,
        activeThemeId: themeId,
      },
    };
    scheduleSave();
  }
  return true;
}

function createControlCenterTheme(): string {
  const currentState = settings.value.controlCenterThemes;
  let number = currentState.nextCustomThemeNumber;
  let id = `custom:${number}`;
  while (findControlCenterTheme(currentState, id)) {
    number += 1;
    id = `custom:${number}`;
  }
  const theme: ControlCenterAppearanceTheme = {
    id,
    name: `自定义主题${number}`,
    builtin: false,
    appearance: createBlankControlCenterAppearance(
      structuredClone(DEFAULT_SETTINGS.controlCenter),
    ),
  };
  settings.value = {
    ...settings.value,
    controlCenter: { ...theme.appearance },
    controlCenterThemes: {
      ...currentState,
      activeThemeId: id,
      nextCustomThemeNumber: number + 1,
      themes: [...currentState.themes, theme],
    },
  };
  scheduleSave();
  return id;
}

function renameControlCenterTheme(themeId: string, name: string): boolean {
  const currentState = settings.value.controlCenterThemes;
  const theme = findControlCenterTheme(currentState, themeId);
  const normalizedName = name.trim().slice(0, 80);
  if (!theme || theme.builtin || !normalizedName) {
    return false;
  }
  if (theme.name === normalizedName) {
    return true;
  }

  settings.value = {
    ...settings.value,
    controlCenterThemes: {
      ...currentState,
      themes: currentState.themes.map((candidate) => (
        candidate.id === themeId
          ? { ...candidate, name: normalizedName }
          : candidate
      )),
    },
  };
  scheduleSave();
  return true;
}

function deleteControlCenterTheme(themeId: string): boolean {
  const currentState = settings.value.controlCenterThemes;
  const theme = findControlCenterTheme(currentState, themeId);
  if (!theme || theme.builtin) {
    return false;
  }

  const themes = currentState.themes.filter((candidate) => candidate.id !== themeId);
  const deletingActiveTheme = currentState.activeThemeId === themeId;
  const fallbackTheme = themes.find(({ id }) => id === DEFAULT_CONTROL_CENTER_THEME_ID);
  if (deletingActiveTheme && !fallbackTheme) {
    return false;
  }

  settings.value = {
    ...settings.value,
    controlCenter: deletingActiveTheme
      ? { ...fallbackTheme!.appearance }
      : settings.value.controlCenter,
    controlCenterThemes: {
      ...currentState,
      activeThemeId: deletingActiveTheme
        ? DEFAULT_CONTROL_CENTER_THEME_ID
        : currentState.activeThemeId,
      themes,
    },
  };
  scheduleSave();
  return true;
}

function resetControlCenterAppearance(): void {
  const appearance = structuredClone(DEFAULT_SETTINGS.controlCenter);
  const themes = settings.value.controlCenterThemes.themes.map((theme) => (
    theme.id === DEFAULT_CONTROL_CENTER_THEME_ID
      ? {
          ...theme,
          name: DEFAULT_CONTROL_CENTER_THEME_NAME,
          builtin: true,
          appearance,
        }
      : theme
  ));
  update({
    controlCenter: appearance,
    controlCenterThemes: {
      activeThemeId: DEFAULT_CONTROL_CENTER_THEME_ID,
      themes,
    },
  });
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

  if (activeSavePromise) {
    saveRequestedWhileSaving = true;
    await activeSavePromise;
    return;
  }

  const operation = performSave();
  activeSavePromise = operation;
  try {
    await operation;
  } finally {
    if (activeSavePromise === operation) {
      activeSavePromise = undefined;
    }
  }
}

async function performSave(): Promise<void> {
  isSaving.value = true;
  lastError.value = "";

  do {
    saveRequestedWhileSaving = false;

    try {
      const snapshot = normalizeSettings(settings.value);
      await settingsStorage.save(snapshot);
      const fingerprint = JSON.stringify(snapshot);
      pendingLocalBroadcasts.add(fingerprint);
      try {
        await settingsStorage.broadcast(snapshot);
      } finally {
        if (pendingLocalBroadcasts.has(fingerprint)) {
          const cleanupTimer = setTimeout(
            () => pendingLocalBroadcasts.delete(fingerprint),
            5_000,
          );
          (cleanupTimer as unknown as { unref?: () => void }).unref?.();
        }
      }
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
  const general = isRecord(value.general) ? value.general : {};
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
  const normalizedLegacyControlCenter = normalizeControlCenterAppearance(
    controlCenter,
    DEFAULT_SETTINGS.controlCenter,
  );
  const controlCenterThemes = normalizeControlCenterThemeState(
    value.controlCenterThemes,
    normalizedLegacyControlCenter,
  );
  const activeControlCenter = findControlCenterTheme(
    controlCenterThemes,
    controlCenterThemes.activeThemeId,
  )?.appearance ?? DEFAULT_SETTINGS.controlCenter;
  const legacyInputWindowEnabled = optionalBoolean(
    windows.inputMonitorWindowEnabled,
  );

  return {
    schemaVersion: 1,
    general: {
      language: languageOrDefault(
        general.language,
        DEFAULT_SETTINGS.general.language,
      ),
    },
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
    controlCenter: structuredClone(activeControlCenter),
    controlCenterThemes,
  };
}

function normalizeControlCenterAppearance(
  value: unknown,
  fallback: ControlCenterAppearance,
): ControlCenterAppearance {
  const appearance = isRecord(value) ? value : {};
  return {
    backgroundColor: hexColorOrDefault(
      appearance.backgroundColor,
      fallback.backgroundColor,
    ),
    backgroundOpacity: clampNumber(
      appearance.backgroundOpacity,
      0,
      1,
      fallback.backgroundOpacity,
    ),
    backgroundImage: backgroundReferenceOrDefault(
      appearance.backgroundImage,
      fallback.backgroundImage,
    ),
    backgroundImageFit: backgroundFitOrDefault(
      appearance.backgroundImageFit,
      fallback.backgroundImageFit,
    ),
    backgroundImageOpacity: clampNumber(
      appearance.backgroundImageOpacity,
      0,
      1,
      fallback.backgroundImageOpacity,
    ),
    backgroundImageBlur: clampNumber(
      appearance.backgroundImageBlur,
      0,
      30,
      fallback.backgroundImageBlur,
    ),
    sidebarBackgroundColor: hexColorOrDefault(
      appearance.sidebarBackgroundColor,
      fallback.sidebarBackgroundColor,
    ),
    sidebarBackgroundOpacity: clampNumber(
      appearance.sidebarBackgroundOpacity,
      0,
      1,
      fallback.sidebarBackgroundOpacity,
    ),
    sidebarTextColor: hexColorOrDefault(
      appearance.sidebarTextColor,
      fallback.sidebarTextColor,
    ),
    sidebarActiveBackgroundColor: hexColorOrDefault(
      appearance.sidebarActiveBackgroundColor,
      fallback.sidebarActiveBackgroundColor,
    ),
    sidebarActiveBackgroundOpacity: clampNumber(
      appearance.sidebarActiveBackgroundOpacity,
      0,
      1,
      fallback.sidebarActiveBackgroundOpacity,
    ),
    sidebarActiveTextColor: hexColorOrDefault(
      appearance.sidebarActiveTextColor,
      fallback.sidebarActiveTextColor,
    ),
    primaryTextColor: hexColorOrDefault(
      appearance.primaryTextColor,
      fallback.primaryTextColor,
    ),
    secondaryTextColor: hexColorOrDefault(
      appearance.secondaryTextColor,
      fallback.secondaryTextColor,
    ),
    contentTextShadowColor: hexColorOrDefault(
      appearance.contentTextShadowColor,
      fallback.contentTextShadowColor,
    ),
    contentTextShadowOpacity: clampNumber(
      appearance.contentTextShadowOpacity,
      0,
      1,
      fallback.contentTextShadowOpacity,
    ),
    contentTextShadowSize: clampNumber(
      appearance.contentTextShadowSize,
      0,
      8,
      fallback.contentTextShadowSize,
    ),
    contentTextShadowBlur: clampNumber(
      appearance.contentTextShadowBlur,
      0,
      30,
      fallback.contentTextShadowBlur,
    ),
    cardBackgroundColor: hexColorOrDefault(
      appearance.cardBackgroundColor,
      fallback.cardBackgroundColor,
    ),
    cardBackgroundOpacity: clampNumber(
      appearance.cardBackgroundOpacity,
      0,
      1,
      fallback.cardBackgroundOpacity,
    ),
    cardBorderColor: hexColorOrDefault(
      appearance.cardBorderColor,
      fallback.cardBorderColor,
    ),
    cardBorderOpacity: clampNumber(
      appearance.cardBorderOpacity,
      0,
      1,
      fallback.cardBorderOpacity,
    ),
    cardBorderWidth: clampNumber(
      appearance.cardBorderWidth,
      0,
      6,
      fallback.cardBorderWidth,
    ),
    accentColor: hexColorOrDefault(
      appearance.accentColor,
      fallback.accentColor,
    ),
  };
}

function normalizeControlCenterThemeState(
  value: unknown,
  legacyAppearance: ControlCenterAppearance,
): ControlCenterThemeState {
  if (!isRecord(value) || !Array.isArray(value.themes)) {
    return migrateLegacyControlCenterThemeState(legacyAppearance);
  }

  const defaults = createDefaultControlCenterThemeState(
    structuredClone(DEFAULT_SETTINGS.controlCenter),
  );
  const seen = new Set<string>();
  const normalized: ControlCenterAppearanceTheme[] = [];
  for (const candidate of value.themes) {
    if (!isRecord(candidate)) continue;
    const id = normalizedControlCenterThemeId(candidate.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const builtin = id === DEFAULT_CONTROL_CENTER_THEME_ID
      || id === MIKAN_CONTROL_CENTER_THEME_ID;
    const fallback = id === DEFAULT_CONTROL_CENTER_THEME_ID
      ? DEFAULT_SETTINGS.controlCenter
      : id === MIKAN_CONTROL_CENTER_THEME_ID
        ? MIKAN_CONTROL_CENTER_APPEARANCE
        : createBlankControlCenterAppearance(
            structuredClone(DEFAULT_SETTINGS.controlCenter),
          );
    const fallbackName = id === DEFAULT_CONTROL_CENTER_THEME_ID
      ? DEFAULT_CONTROL_CENTER_THEME_NAME
      : id === MIKAN_CONTROL_CENTER_THEME_ID
        ? MIKAN_CONTROL_CENTER_THEME_NAME
        : `自定义主题${customThemeNumber(id) ?? 1}`;
    const appearance = normalizeControlCenterAppearance(
      candidate.appearance,
      fallback,
    );
    normalized.push({
      id,
      name: builtin
        ? fallbackName
        : nonEmptyTextOrDefault(candidate.name, fallbackName).slice(0, 80),
      builtin,
      appearance: migrateLegacyMikanBackground(id, appearance),
    });
  }

  const defaultTheme = normalized.find(
    (theme) => theme.id === DEFAULT_CONTROL_CENTER_THEME_ID,
  ) ?? defaults.themes[0];
  const mikanTheme = normalized.find(
    (theme) => theme.id === MIKAN_CONTROL_CENTER_THEME_ID,
  ) ?? defaults.themes[1];
  const customThemes = normalized.filter((theme) => !theme.builtin);
  const themes = [defaultTheme, mikanTheme, ...customThemes];
  const requestedActiveId = typeof value.activeThemeId === "string"
    ? value.activeThemeId
    : DEFAULT_CONTROL_CENTER_THEME_ID;
  const activeThemeId = themes.some((theme) => theme.id === requestedActiveId)
    ? requestedActiveId
    : DEFAULT_CONTROL_CENTER_THEME_ID;
  const highestCustomNumber = customThemes.reduce(
    (highest, theme) => Math.max(highest, customThemeNumber(theme.id) ?? 0),
    0,
  );
  const requestedNextNumber = Number.isSafeInteger(value.nextCustomThemeNumber)
      && Number(value.nextCustomThemeNumber) > 0
    ? Number(value.nextCustomThemeNumber)
    : 1;

  return {
    activeThemeId,
    nextCustomThemeNumber: Math.max(requestedNextNumber, highestCustomNumber + 1),
    themes,
  };
}

function migrateLegacyControlCenterThemeState(
  appearance: ControlCenterAppearance,
): ControlCenterThemeState {
  const state = createDefaultControlCenterThemeState(
    structuredClone(DEFAULT_SETTINGS.controlCenter),
  );
  const inferredBuiltinId = inferLegacyBuiltinThemeId(appearance);
  if (inferredBuiltinId) {
    const migratedAppearance = migrateLegacyMikanBackground(
      inferredBuiltinId,
      appearance,
    );
    return {
      ...state,
      activeThemeId: inferredBuiltinId,
      themes: state.themes.map((theme) => (
        theme.id === inferredBuiltinId
          ? { ...theme, appearance: structuredClone(migratedAppearance) }
          : theme
      )),
    };
  }

  const customTheme: ControlCenterAppearanceTheme = {
    id: "custom:1",
    name: "自定义主题1",
    builtin: false,
    appearance: structuredClone(appearance),
  };
  return {
    activeThemeId: customTheme.id,
    nextCustomThemeNumber: 2,
    themes: [...state.themes, customTheme],
  };
}

const LEGACY_MIKAN_MANAGED_BACKGROUND_PATTERN =
  /^VRChat_2026-08-10_23-45-16596_3840x2160-\d+(?:-\d+)?\.png$/;

function migrateLegacyMikanBackground(
  themeId: string,
  appearance: ControlCenterAppearance,
): ControlCenterAppearance {
  return themeId === MIKAN_CONTROL_CENTER_THEME_ID
      && typeof appearance.backgroundImage === "string"
      && LEGACY_MIKAN_MANAGED_BACKGROUND_PATTERN.test(appearance.backgroundImage)
    ? {
        ...appearance,
        backgroundImage: CONTROL_CENTER_MIKAN_BACKGROUND_REFERENCE,
      }
    : appearance;
}

function inferLegacyBuiltinThemeId(
  appearance: ControlCenterAppearance,
): string | undefined {
  if (appearance.backgroundImage === CONTROL_CENTER_BUILTIN_BACKGROUND_REFERENCE) {
    return DEFAULT_CONTROL_CENTER_THEME_ID;
  }
  if (appearance.backgroundImage === CONTROL_CENTER_MIKAN_BACKGROUND_REFERENCE) {
    return MIKAN_CONTROL_CENTER_THEME_ID;
  }
  if (!isManagedControlCenterBackground(appearance.backgroundImage)) {
    return undefined;
  }

  const defaultScore = appearanceSimilarityScore(
    appearance,
    DEFAULT_SETTINGS.controlCenter,
  );
  const mikanScore = appearanceSimilarityScore(
    appearance,
    MIKAN_CONTROL_CENTER_APPEARANCE,
  );
  return mikanScore >= defaultScore + 4
    ? MIKAN_CONTROL_CENTER_THEME_ID
    : undefined;
}

function appearanceSimilarityScore(
  appearance: ControlCenterAppearance,
  reference: Readonly<ControlCenterAppearance>,
): number {
  return (Object.keys(reference) as Array<keyof ControlCenterAppearance>)
    .filter((key) => key !== "backgroundImage")
    .reduce(
      (score, key) => score + Number(appearance[key] === reference[key]),
      0,
    );
}

function normalizedControlCenterThemeId(value: unknown): string | undefined {
  if (value === DEFAULT_CONTROL_CENTER_THEME_ID
      || value === MIKAN_CONTROL_CENTER_THEME_ID) {
    return value;
  }
  return typeof value === "string" && customThemeNumber(value) !== undefined
    ? value
    : undefined;
}

function customThemeNumber(id: string): number | undefined {
  const match = /^custom:([1-9]\d*)$/.exec(id);
  if (!match) return undefined;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

function languageOrDefault(value: unknown, fallback: AppLanguage): AppLanguage {
  return value === "zh-CN" || value === "en" || value === "ja"
    ? value
    : fallback;
}

function backgroundReferenceOrDefault(
  value: unknown,
  fallback: string | null,
): string | null {
  if (value === undefined) {
    return fallback;
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
  fallback: DesktopPetSettings["controlCenter"]["backgroundImageFit"],
): DesktopPetSettings["controlCenter"]["backgroundImageFit"] {
  return value === "cover"
      || value === "contain"
      || value === "stretch"
      || value === "center"
      || value === "tile"
    ? value
    : fallback;
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
  updateControlCenterAppearance,
  selectControlCenterTheme,
  createControlCenterTheme,
  renameControlCenterTheme,
  deleteControlCenterTheme,
  resetControlCenterAppearance,
  resetDefaults,
  save,
};
