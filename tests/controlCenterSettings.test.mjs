import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

globalThis.window = new EventTarget();
globalThis.localStorage = { getItem() { return null; }, setItem() {} };

const vite = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

try {
  const navigation = await vite.ssrLoadModule("/src/settings/settingsNavigation.ts");
  const { normalizeSettings, settingsManager } = await vite.ssrLoadModule("/src/settings/settingsManager.ts");
  const defaults = await vite.ssrLoadModule("/src/settings/defaultSettings.ts");
  const theme = await vite.ssrLoadModule("/src/settings/controlCenterTheme.ts");
  const appearanceThemes = await vite.ssrLoadModule("/src/settings/controlCenterAppearanceThemes.ts");
  const background = await vite.ssrLoadModule("/src/settings/controlCenterBackground.ts");
  const references = await vite.ssrLoadModule("/src/settings/controlCenterBackgroundReference.ts");
  const { settingsStorage } = await vite.ssrLoadModule("/src/settings/settingsStorage.ts");
  const i18n = await vite.ssrLoadModule("/src/i18n/index.ts");

  await testInformationArchitecture(navigation);
  testThemeSettings(normalizeSettings, defaults, theme);
  await testAppearanceThemes(appearanceThemes, defaults, references, normalizeSettings, settingsManager);
  await testShippingBaseline(normalizeSettings, defaults, references);
  await testLanguageSettings(normalizeSettings, i18n);
  await testManagedBackground(background, references);
  await testThemeDeletionDuringSave(settingsManager, settingsStorage);
  console.log("Control Center settings tests passed.");
} finally {
  await vite.close();
  delete globalThis.window;
  delete globalThis.localStorage;
}

async function testInformationArchitecture(navigation) {
  assert.deepEqual(navigation.SETTINGS_TABS.map(({ id }) => id), ["general", "system", "input", "dialogue", "appearance"]);
  assert.deepEqual(navigation.INPUT_SETTINGS_TABS.map(({ id }) => id), ["keyboard", "typing", "mouse"]);

  const settingsPage = await readFile(new URL("../src/settings/SettingsPage.vue", import.meta.url), "utf8");
  const reminderPage = await readFile(new URL("../src/settings/ReminderPage.vue", import.meta.url), "utf8");
  const controlCenter = await readFile(new URL("../src/settings/ControlCenter.vue", import.meta.url), "utf8");
  const systemSettings = await readFile(new URL("../src/settings/SystemSettings.vue", import.meta.url), "utf8");
  const dialogueSettings = await readFile(new URL("../src/settings/DialogueInteractionSettings.vue", import.meta.url), "utf8");
  const stateEditor = await readFile(new URL("../src/settings/StateAnimationEditor.vue", import.meta.url), "utf8");
  const appearanceSettings = await readFile(new URL("../src/settings/ControlCenterAppearanceSettings.vue", import.meta.url), "utf8");
  assert.match(settingsPage, /GeneralSettings v-if/);
  assert.match(settingsPage, /SystemSettings v-else-if/);
  assert.match(settingsPage, /InputSettings v-else-if/);
  assert.match(settingsPage, /DialogueInteractionSettings v-else-if/);
  assert.match(settingsPage, /ControlCenterAppearanceSettings/);
  assert.doesNotMatch(settingsPage, /settings\.reminder/);
  assert.match(reminderPage, /data-reminder-settings/);
  assert.match(reminderPage, /reminder\.enabled/);
  assert.match(reminderPage, /reminder\.soundVolume/);
  assert.doesNotMatch(reminderPage, /class="scheduler-status"/);
  assert.match(controlCenter, /beforeunload/);
  assert.match(controlCenter, /dirty-change/);
  assert.match(controlCenter, /<small>v0\.5\.1<\/small>/);
  assert.doesNotMatch(controlCenter, /<p>withXiaoyu12<\/p>/);
  assert.doesNotMatch(systemSettings, /displayMode/);
  assert.doesNotMatch(dialogueSettings, /showDevelopmentMessageOnStartup/);
  assert.match(stateEditor, /v-if="loop"/);
  assert.match(appearanceSettings, /class="theme-carousel"/);
  assert.match(appearanceSettings, /@pointermove="moveThemeDrag"/);
  assert.match(appearanceSettings, /@lostpointercapture="endThemeDrag"/);
  assert.match(appearanceSettings, /overflow-x: scroll/);
  assert.match(appearanceSettings, /grid-auto-flow: column/);
  const beginThemeDrag = appearanceSettings.match(/function beginThemeDrag[\s\S]*?(?=function moveThemeDrag)/)?.[0] ?? "";
  const moveThemeDrag = appearanceSettings.match(/function moveThemeDrag[\s\S]*?(?=function endThemeDrag)/)?.[0] ?? "";
  assert.doesNotMatch(beginThemeDrag, /setPointerCapture/);
  assert.match(moveThemeDrag, /Math\.abs\(deltaX\) > 4/);
  assert.match(moveThemeDrag, /setPointerCapture/);
  assert.match(appearanceSettings, /settingsManager\.updateControlCenterAppearance/);
  assert.match(appearanceSettings, /settingsManager\.createControlCenterTheme/);
  assert.match(appearanceSettings, /v-if="!theme\.builtin"/);
  assert.match(appearanceSettings, /class="theme-card__save"/);
  assert.match(appearanceSettings, /settingsManager\.save\(\)/);
  assert.match(appearanceSettings, /@dblclick\.stop\.prevent="beginThemeRename\(theme\)"/);
  assert.match(appearanceSettings, /@keydown\.enter\.stop\.prevent="commitThemeRename\(theme\)"/);
  assert.match(appearanceSettings, /@keydown\.esc\.stop\.prevent="cancelThemeRename"/);
  assert.match(appearanceSettings, /@blur="commitThemeRename\(theme\)"/);
  assert.match(appearanceSettings, /class="theme-card__delete"/);
  assert.match(appearanceSettings, /@pointerdown\.stop/);
  assert.match(appearanceSettings, /@pointerup\.stop/);
  assert.match(appearanceSettings, /@click\.stop\.prevent="deleteAppearanceTheme\(theme\)"/);
  assert.doesNotMatch(appearanceSettings, /deleteAppearanceThemeFromPointer/);
  assert.doesNotMatch(appearanceSettings, /deleteAppearanceThemeFromKeyboard/);
  const deleteAppearanceTheme = appearanceSettings.match(/async function deleteAppearanceTheme[\s\S]*?(?=function themePreviewStyle)/)?.[0] ?? "";
  assert.doesNotMatch(deleteAppearanceTheme, /window\.confirm/);
  assert.doesNotMatch(deleteAppearanceTheme, /suppressThemeClick/);
  assert.match(appearanceSettings, /controlCenterBackgroundManager\.previewUrl\(theme\.appearance\.backgroundImage\)/);
  assert.match(appearanceSettings, /backgroundUsedByAnotherTheme\(background, theme\.id\)/);
  assert.match(appearanceSettings, /settingsManager\.deleteControlCenterTheme/);
  assert.doesNotMatch(appearanceSettings, /matchControlCenterAppearanceTheme/);
}

async function testAppearanceThemes(themes, defaults, references, normalizeSettings, settingsManager) {
  const initial = themes.createDefaultControlCenterThemeState(
    defaults.createDefaultControlCenterAppearance(),
  );
  assert.equal(initial.activeThemeId, "default");
  assert.equal(initial.nextCustomThemeNumber, 1);
  assert.deepEqual(initial.themes.map(({ id }) => id), ["default", "mikan"]);
  assert.equal(initial.themes[0].name, "Xiaoyu主题");
  assert.equal(initial.themes[1].name, "蜜柑主题");
  assert.deepEqual(initial.themes[0].appearance, defaults.DEFAULT_SETTINGS.controlCenter);

  const mikan = initial.themes[1].appearance;
  assert.deepEqual(mikan, {
    backgroundColor: "#FFFFFF",
    backgroundOpacity: 0,
    backgroundImage: references.CONTROL_CENTER_MIKAN_BACKGROUND_REFERENCE,
    backgroundImageFit: "cover",
    backgroundImageOpacity: 1,
    backgroundImageBlur: 0,
    sidebarBackgroundColor: "#2E073E",
    sidebarBackgroundOpacity: 0.4,
    sidebarTextColor: "#EBEBEB",
    sidebarActiveBackgroundColor: "#8B78FF",
    sidebarActiveBackgroundOpacity: 0.55,
    sidebarActiveTextColor: "#FFFFFF",
    primaryTextColor: "#30283D",
    secondaryTextColor: "#919191",
    contentTextShadowColor: "#FFFFFF",
    contentTextShadowOpacity: 0.1,
    contentTextShadowSize: 2,
    contentTextShadowBlur: 3,
    cardBackgroundColor: "#FFFFFF",
    cardBackgroundOpacity: 0.2,
    cardBorderColor: "#FEC700",
    cardBorderOpacity: 0.2,
    cardBorderWidth: 1,
    accentColor: "#745BC9",
  });
  const builtinMikanPreview = themes.controlCenterThemePreviewUrl(initial.themes[1]);
  assert.ok(builtinMikanPreview);
  const managedMikanTheme = {
    ...initial.themes[1],
    appearance: {
      ...initial.themes[1].appearance,
      backgroundImage: "managed-mikan.png",
    },
  };
  assert.equal(
    themes.controlCenterThemePreviewUrl(managedMikanTheme),
    undefined,
  );
  assert.equal(
    themes.controlCenterThemePreviewUrl({
      ...initial.themes[1],
      appearance: { ...initial.themes[1].appearance, backgroundImage: null },
    }),
    undefined,
  );
  const blank = themes.createBlankControlCenterAppearance(
    defaults.createDefaultControlCenterAppearance(),
  );
  assert.equal(blank.backgroundImage, null);
  assert.equal(blank.backgroundColor, "#FFFFFF");
  assert.equal(blank.backgroundOpacity, 1);

  const legacyMikan = {
    ...structuredClone(mikan),
    backgroundImage: "VRChat_2026-08-10_23-45-16596_3840x2160-1788505596520.png",
    primaryTextColor: "#123456",
    cardBackgroundOpacity: 0.15,
    contentTextShadowColor: "#FF6A00",
  };
  const migratedMikan = normalizeSettings({
    schemaVersion: 1,
    controlCenter: legacyMikan,
  });
  const expectedMigratedMikan = {
    ...legacyMikan,
    backgroundImage: references.CONTROL_CENTER_MIKAN_BACKGROUND_REFERENCE,
  };
  assert.equal(migratedMikan.controlCenterThemes.activeThemeId, "mikan");
  assert.deepEqual(migratedMikan.controlCenter, expectedMigratedMikan);
  assert.deepEqual(
    migratedMikan.controlCenterThemes.themes.find(({ id }) => id === "mikan").appearance,
    expectedMigratedMikan,
  );

  const persistedLegacyMikan = normalizeSettings({
    schemaVersion: 1,
    controlCenter: defaults.createDefaultControlCenterAppearance(),
    controlCenterThemes: {
      ...structuredClone(initial),
      themes: initial.themes.map((theme) => theme.id === "mikan"
        ? {
            ...theme,
            appearance: {
              ...theme.appearance,
              backgroundImage: legacyMikan.backgroundImage,
              primaryTextColor: "#654321",
            },
          }
        : theme),
    },
  });
  assert.equal(persistedLegacyMikan.controlCenterThemes.activeThemeId, "default");
  assert.equal(
    persistedLegacyMikan.controlCenterThemes.themes.find(({ id }) => id === "mikan").appearance.backgroundImage,
    references.CONTROL_CENTER_MIKAN_BACKGROUND_REFERENCE,
  );
  assert.equal(
    persistedLegacyMikan.controlCenterThemes.themes.find(({ id }) => id === "mikan").appearance.primaryTextColor,
    "#654321",
  );

  const userManagedMikan = normalizeSettings({
    controlCenterThemes: {
      ...structuredClone(initial),
      themes: initial.themes.map((theme) => theme.id === "mikan"
        ? {
            ...theme,
            appearance: { ...theme.appearance, backgroundImage: "my-mikan-photo.png" },
          }
        : theme),
    },
  });
  assert.equal(
    userManagedMikan.controlCenterThemes.themes.find(({ id }) => id === "mikan").appearance.backgroundImage,
    "my-mikan-photo.png",
  );

  const legacyCustom = {
    ...defaults.createDefaultControlCenterAppearance(),
    backgroundImage: "user-scene.jpg",
    accentColor: "#112233",
  };
  const migratedCustom = normalizeSettings({ controlCenter: legacyCustom });
  assert.equal(migratedCustom.controlCenterThemes.activeThemeId, "custom:1");
  assert.equal(migratedCustom.controlCenterThemes.nextCustomThemeNumber, 2);
  assert.deepEqual(migratedCustom.controlCenter, legacyCustom);
  assert.deepEqual(
    migratedCustom.controlCenterThemes.themes.find(({ id }) => id === "custom:1").appearance,
    legacyCustom,
  );

  settingsManager.resetDefaults();
  const switchStartedAt = performance.now();
  for (let index = 0; index < 200; index += 1) {
    settingsManager.selectControlCenterTheme(index % 2 === 0 ? "mikan" : "default");
  }
  assert.ok(
    performance.now() - switchStartedAt < 1000,
    "200 in-memory theme switches should complete in under one second",
  );
  assert.equal(settingsManager.selectControlCenterTheme("mikan"), true);
  settingsManager.updateControlCenterAppearance("primaryTextColor", "#123456");
  settingsManager.updateControlCenterAppearance("cardBackgroundOpacity", 0.35);
  assert.equal(settingsManager.settings.value.controlCenter.primaryTextColor, "#123456");

  settingsManager.selectControlCenterTheme("default");
  assert.equal(
    settingsManager.settings.value.controlCenter.primaryTextColor,
    defaults.DEFAULT_SETTINGS.controlCenter.primaryTextColor,
  );
  settingsManager.selectControlCenterTheme("mikan");
  assert.equal(settingsManager.settings.value.controlCenter.primaryTextColor, "#123456");
  assert.equal(settingsManager.settings.value.controlCenter.cardBackgroundOpacity, 0.35);

  const customOneId = settingsManager.createControlCenterTheme();
  assert.equal(customOneId, "custom:1");
  assert.equal(settingsManager.settings.value.controlCenterThemes.activeThemeId, customOneId);
  assert.equal(settingsManager.settings.value.controlCenter.backgroundImage, null);
  assert.equal(settingsManager.settings.value.controlCenter.backgroundOpacity, 1);
  settingsManager.updateControlCenterAppearance("accentColor", "#ABCDEF");

  settingsManager.selectControlCenterTheme("default");
  assert.equal(settingsManager.settings.value.controlCenter.backgroundImage, references.CONTROL_CENTER_BUILTIN_BACKGROUND_REFERENCE);
  settingsManager.selectControlCenterTheme("mikan");
  assert.equal(settingsManager.settings.value.controlCenter.primaryTextColor, "#123456");
  settingsManager.selectControlCenterTheme(customOneId);
  assert.equal(settingsManager.settings.value.controlCenter.accentColor, "#ABCDEF");
  assert.equal(settingsManager.settings.value.controlCenter.backgroundImage, null);

  const restarted = normalizeSettings(JSON.parse(JSON.stringify(settingsManager.settings.value)));
  assert.equal(restarted.controlCenterThemes.activeThemeId, customOneId);
  assert.equal(restarted.controlCenter.accentColor, "#ABCDEF");
  assert.equal(
    restarted.controlCenterThemes.themes.find(({ id }) => id === "mikan").appearance.primaryTextColor,
    "#123456",
  );

  const mismatchedMirror = normalizeSettings({
    ...structuredClone(restarted),
    controlCenter: defaults.createDefaultControlCenterAppearance(),
  });
  assert.equal(mismatchedMirror.controlCenterThemes.activeThemeId, customOneId);
  assert.deepEqual(
    mismatchedMirror.controlCenter,
    mismatchedMirror.controlCenterThemes.themes.find(({ id }) => id === customOneId).appearance,
  );
  assert.equal(mismatchedMirror.controlCenter.backgroundImage, null);
  assert.equal(mismatchedMirror.controlCenter.accentColor, "#ABCDEF");

  const customTwoId = settingsManager.createControlCenterTheme();
  assert.equal(customTwoId, "custom:2");
  assert.equal(settingsManager.settings.value.controlCenter.backgroundImage, null);
  assert.equal(settingsManager.settings.value.controlCenter.accentColor, defaults.DEFAULT_SETTINGS.controlCenter.accentColor);
  assert.equal(settingsManager.renameControlCenterTheme(customOneId, "  夜间主题  "), true);
  assert.equal(
    settingsManager.settings.value.controlCenterThemes.themes.find(({ id }) => id === customOneId).name,
    "夜间主题",
  );
  assert.equal(settingsManager.renameControlCenterTheme(customOneId, "   "), false);
  assert.equal(settingsManager.renameControlCenterTheme("default", "不可修改"), false);
  assert.equal(settingsManager.renameControlCenterTheme("mikan", "不可修改"), false);
  const renamedRoundTrip = normalizeSettings(
    JSON.parse(JSON.stringify(settingsManager.settings.value)),
  );
  assert.equal(
    renamedRoundTrip.controlCenterThemes.themes.find(({ id }) => id === customOneId).name,
    "夜间主题",
  );
  settingsManager.selectControlCenterTheme(customOneId);
  assert.equal(settingsManager.deleteControlCenterTheme(customTwoId), true);
  assert.equal(settingsManager.settings.value.controlCenterThemes.activeThemeId, customOneId);
  assert.equal(settingsManager.settings.value.controlCenter.accentColor, "#ABCDEF");
  assert.equal(settingsManager.deleteControlCenterTheme("default"), false);
  assert.equal(settingsManager.deleteControlCenterTheme("mikan"), false);
  assert.equal(settingsManager.deleteControlCenterTheme(customOneId), true);
  assert.equal(settingsManager.settings.value.controlCenterThemes.activeThemeId, "default");
  assert.equal(settingsManager.settings.value.controlCenter.backgroundImage, references.CONTROL_CENTER_BUILTIN_BACKGROUND_REFERENCE);
  assert.deepEqual(
    settingsManager.settings.value.controlCenterThemes.themes.map(({ id }) => id),
    ["default", "mikan"],
  );
  await settingsManager.save();
}

function testThemeSettings(normalizeSettings, defaults, theme) {
  const missing = normalizeSettings({});
  assert.deepEqual(missing.controlCenter, defaults.DEFAULT_SETTINGS.controlCenter);

  const normalized = normalizeSettings({
    systemMonitor: { cpuHighThreshold: 73 },
    input: { keyDisplayMaxItems: 7, mouseVisualizerPosition: "right" },
    reminder: { enabled: true, soundVolume: 0.45 },
    controlCenter: {
      backgroundColor: "#123abc",
      backgroundOpacity: -1,
      backgroundImage: "/Users/example/Desktop/background.png",
      backgroundImageFit: "invalid",
      backgroundImageOpacity: 2,
      backgroundImageBlur: 99,
      sidebarBackgroundColor: "#010203",
      sidebarBackgroundOpacity: 0.4,
      sidebarTextColor: "#abcdef",
      sidebarActiveBackgroundColor: "#111111",
      sidebarActiveBackgroundOpacity: 0.6,
      sidebarActiveTextColor: "#eeeeee",
      primaryTextColor: "#101010",
      secondaryTextColor: "#202020",
      contentTextShadowColor: "#aabbcc",
      contentTextShadowOpacity: 0.35,
      contentTextShadowSize: 99,
      contentTextShadowBlur: 99,
      cardBackgroundColor: "#303030",
      cardBackgroundOpacity: 0.7,
      cardBorderColor: "#404040",
      cardBorderOpacity: 0.8,
      cardBorderWidth: 99,
      accentColor: "#505050",
    },
  });
  assert.equal(normalized.controlCenter.backgroundColor, "#123ABC");
  assert.equal(normalized.controlCenter.backgroundOpacity, 0);
  assert.equal(normalized.controlCenter.backgroundImage, null);
  assert.equal(normalized.controlCenter.backgroundImageFit, "cover");
  assert.equal(normalized.controlCenter.backgroundImageOpacity, 1);
  assert.equal(normalized.controlCenter.backgroundImageBlur, 30);
  assert.equal(normalized.controlCenter.cardBorderWidth, 6);
  assert.equal(normalized.controlCenter.sidebarTextColor, "#ABCDEF");
  assert.equal(normalized.controlCenter.contentTextShadowColor, "#AABBCC");
  assert.equal(normalized.controlCenter.contentTextShadowOpacity, 0.35);
  assert.equal(normalized.controlCenter.contentTextShadowSize, 8);
  assert.equal(normalized.controlCenter.contentTextShadowBlur, 30);
  assert.equal(normalized.systemMonitor.cpuHighThreshold, 73);
  assert.equal(normalized.input.keyDisplayMaxItems, 7);
  assert.equal(normalized.input.mouseVisualizerPosition, "right");
  assert.equal(normalized.reminder.enabled, true);
  assert.equal(normalized.reminder.soundVolume, 0.45);

  const managed = normalizeSettings({ controlCenter: { backgroundImage: "scene-123.webp", backgroundImageFit: "tile" } });
  assert.equal(managed.controlCenter.backgroundImage, "scene-123.webp");
  assert.equal(managed.controlCenter.backgroundImageFit, "tile");

  for (const fit of ["cover", "contain", "stretch", "center", "tile"]) {
    const value = normalizeSettings({ controlCenter: { backgroundImageFit: fit } });
    assert.equal(value.controlCenter.backgroundImageFit, fit);
    assert.ok(theme.createControlCenterBackgroundStyle(value.controlCenter, "blob:test").backgroundSize);
  }

  const blurred = normalizeSettings({ controlCenter: { backgroundImageBlur: 12 } });
  const blurredStyle = theme.createControlCenterBackgroundStyle(blurred.controlCenter, "blob:test");
  assert.equal(blurredStyle.filter, "blur(12px)");
  assert.equal(blurredStyle.inset, "-12px");
  const clearStyle = theme.createControlCenterBackgroundStyle(missing.controlCenter, "blob:test");
  assert.equal(clearStyle.filter, "none");
  assert.equal(clearStyle.inset, "0");
  assert.equal(theme.createControlCenterBackgroundStyle(blurred.controlCenter).filter, "none");
  assert.equal(normalizeSettings({ controlCenter: { backgroundImageBlur: -5 } }).controlCenter.backgroundImageBlur, 0);

  const variables = theme.createControlCenterThemeVariables(normalized.controlCenter);
  assert.equal(variables["--cc-background"], "rgba(18, 58, 188, 0)");
  assert.equal(variables["--cc-card-bg"], "rgba(48, 48, 48, 0.7)");
  assert.equal(variables["--cc-sidebar-background"], "rgba(1, 2, 3, 0.4)");
  assert.equal(variables["--cc-accent"], "#505050");
  assert.equal(variables["--cc-content-text-shadow"], "8px 0 30px rgba(170, 187, 204, 0.35), -8px 0 30px rgba(170, 187, 204, 0.35), 0 8px 30px rgba(170, 187, 204, 0.35), 0 -8px 30px rgba(170, 187, 204, 0.35)");
  assert.equal(theme.createControlCenterThemeVariables(missing.controlCenter)["--cc-content-text-shadow"], "none");
  const glow = normalizeSettings({ controlCenter: { contentTextShadowColor: "#123456", contentTextShadowOpacity: 0.4, contentTextShadowSize: 0, contentTextShadowBlur: 6 } });
  assert.equal(theme.createContentTextShadow(glow.controlCenter), "0 0 6px rgba(18, 52, 86, 0.4)");
  assert.equal(normalizeSettings({ controlCenter: { contentTextShadowOpacity: -1 } }).controlCenter.contentTextShadowOpacity, 0);
  assert.equal(normalizeSettings({ controlCenter: { contentTextShadowOpacity: 2 } }).controlCenter.contentTextShadowOpacity, 1);
  assert.equal(normalizeSettings({ controlCenter: { contentTextShadowSize: -1, contentTextShadowBlur: -1 } }).controlCenter.contentTextShadowSize, 0);
  assert.equal(normalizeSettings({ controlCenter: { contentTextShadowSize: -1, contentTextShadowBlur: -1 } }).controlCenter.contentTextShadowBlur, 0);

  const roundTrip = normalizeSettings(structuredClone(normalized));
  assert.deepEqual(roundTrip.controlCenter, normalized.controlCenter);
  assert.deepEqual(roundTrip.controlCenterThemes, normalized.controlCenterThemes);
  assert.equal(roundTrip.systemMonitor.cpuHighThreshold, 73);
  assert.equal(roundTrip.input.keyDisplayMaxItems, 7);
  assert.equal(roundTrip.reminder.enabled, true);
}

async function testShippingBaseline(normalizeSettings, defaults, references) {
  const expectedTheme = {
    backgroundColor: "#ECF3F8",
    backgroundOpacity: 0.75,
    backgroundImage: references.CONTROL_CENTER_BUILTIN_BACKGROUND_REFERENCE,
    backgroundImageFit: "cover",
    backgroundImageOpacity: 0.7,
    backgroundImageBlur: 0,
    sidebarBackgroundColor: "#2E073E",
    sidebarBackgroundOpacity: 0.5,
    sidebarTextColor: "#EBEBEB",
    sidebarActiveBackgroundColor: "#8B78FF",
    sidebarActiveBackgroundOpacity: 0.55,
    sidebarActiveTextColor: "#FFFFFF",
    primaryTextColor: "#30283D",
    secondaryTextColor: "#857C91",
    contentTextShadowColor: "#FFFFFF",
    contentTextShadowOpacity: 0.75,
    contentTextShadowSize: 0,
    contentTextShadowBlur: 0,
    cardBackgroundColor: "#FFFFFF",
    cardBackgroundOpacity: 0.55,
    cardBorderColor: "#E392FE",
    cardBorderOpacity: 0.4,
    cardBorderWidth: 2.5,
    accentColor: "#745BC9",
  };
  assert.deepEqual(defaults.DEFAULT_SETTINGS.controlCenter, expectedTheme);
  assert.deepEqual(normalizeSettings({}).controlCenter, expectedTheme);

  // Fresh installs preserve the captured v0.4.5 appearance and layout while
  // keeping every optional desktop window and monitor disabled.
  assert.equal(defaults.DEFAULT_SETTINGS.general.language, "zh-CN");
  assert.equal(defaults.DEFAULT_SETTINGS.appearance.petScale, 0.8);
  assert.equal(defaults.DEFAULT_SETTINGS.input.keyboardEnabled, false);
  assert.equal(defaults.DEFAULT_SETTINGS.input.keyDisplayEnabled, false);
  assert.equal(defaults.DEFAULT_SETTINGS.input.mouseEnabled, false);
  assert.equal(defaults.DEFAULT_SETTINGS.input.mouseVisualizerEnabled, false);
  assert.equal(defaults.DEFAULT_SETTINGS.reminder.enabled, false);
  assert.equal(defaults.DEFAULT_SETTINGS.systemMonitor.enabled, false);
  assert.equal("showDevelopmentMessageOnStartup" in defaults.DEFAULT_SETTINGS.dialogue, false);
  assert.equal("displayMode" in defaults.DEFAULT_SETTINGS.systemStatusBubble, false);
  const withoutRemovedFields = normalizeSettings({
    dialogue: { showDevelopmentMessageOnStartup: true },
    systemStatusBubble: { displayMode: "both" },
  });
  assert.equal("showDevelopmentMessageOnStartup" in withoutRemovedFields.dialogue, false);
  assert.equal("displayMode" in withoutRemovedFields.systemStatusBubble, false);
  assert.deepEqual(defaults.DEFAULT_SETTINGS.windows, {
    systemStatusWindowEnabled: false,
    keyboardHistoryWindowEnabled: false,
    mouseVisualizerWindowEnabled: false,
    systemStatusClickThrough: false,
    keyboardHistoryClickThrough: false,
    mouseVisualizerClickThrough: false,
    followPet: true,
  });
  assert.deepEqual(
    normalizeSettings({}).windows,
    defaults.DEFAULT_SETTINGS.windows,
  );
  assert.equal(defaults.DEFAULT_SETTINGS.systemStatusBubble.offsetX, 19);
  assert.equal(defaults.DEFAULT_SETTINGS.systemStatusBubble.offsetY, 152);
  assert.equal(defaults.DEFAULT_SETTINGS.input.keyDisplayOffsetX, 115);
  assert.equal(defaults.DEFAULT_SETTINGS.input.keyDisplayOffsetY, -175);
  assert.equal(defaults.DEFAULT_SETTINGS.input.mouseVisualizerOffsetX, 272);
  assert.equal(defaults.DEFAULT_SETTINGS.input.mouseVisualizerOffsetY, 159);

  const existing = normalizeSettings({
    controlCenter: {
      backgroundColor: "#010203",
      backgroundImage: "user-managed-123.jpg",
      accentColor: "#AABBCC",
    },
  });
  assert.equal(existing.controlCenter.backgroundColor, "#010203");
  assert.equal(existing.controlCenter.backgroundImage, "user-managed-123.jpg");
  assert.equal(existing.controlCenter.accentColor, "#AABBCC");
  assert.equal(normalizeSettings({ controlCenter: { backgroundImage: null } }).controlCenter.backgroundImage, null);

  const bytes = await readFile(new URL("../src/assets/control-center/default-background.jpg", import.meta.url));
  assert.equal(bytes.subarray(0, 3).toString("hex"), "ffd8ff");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "2bcfbff435781a319be5008ad459b9f12d39bf56e16624e182a7e07179588ce2");
  const mikanBytes = await readFile(new URL("../src/assets/control-center/mikan-background.png", import.meta.url));
  const mikanPreviewBytes = await readFile(new URL("../src/assets/control-center/mikan-background-preview.jpg", import.meta.url));
  assert.equal(createHash("sha256").update(mikanBytes).digest("hex"), "d4d5678fce23db0d2e09d57dc2c61ecbc505708ff945f5a428db28cec4bf1ac4");
  assert.equal(createHash("sha256").update(mikanPreviewBytes).digest("hex"), "3d9ba8abc824da2ecd9cd45cd4ce3e493c15d63d2da9c4f0916b6e51bf24804e");
  const referenceSource = await readFile(new URL("../src/settings/controlCenterBackgroundReference.ts", import.meta.url), "utf8");
  assert.match(referenceSource, /\.\.\/assets\/control-center\/default-background\.jpg/);
  assert.doesNotMatch(referenceSource, /\/Users\//);
}

async function testLanguageSettings(normalizeSettings, i18n) {
  assert.equal(normalizeSettings({}).general.language, "zh-CN");
  assert.equal(normalizeSettings({ general: { language: "en" } }).general.language, "en");
  assert.equal(normalizeSettings({ general: { language: "ja" } }).general.language, "ja");
  assert.equal(normalizeSettings({ general: { language: "invalid" } }).general.language, "zh-CN");
  assert.equal(i18n.translateForLanguage("zh-CN", "当前状态"), "当前状态");
  assert.equal(i18n.translateForLanguage("en", "当前状态"), "Current Status");
  assert.equal(i18n.translateForLanguage("ja", "当前状态"), "現在の状態");
  assert.equal(i18n.translateForLanguage("zh-CN", "Xiaoyu主题"), "Xiaoyu主题");
  assert.equal(i18n.translateForLanguage("en", "Xiaoyu主题"), "Xiaoyu Theme");
  assert.equal(i18n.translateForLanguage("ja", "Xiaoyu主题"), "Xiaoyuテーマ");
  assert.equal(i18n.translateForLanguage("en", "项目数量", { count: 3 }), "3 items");

  const controlCenter = await readFile(new URL("../src/settings/ControlCenter.vue", import.meta.url), "utf8");
  assert.match(controlCenter, /app-icon\.png/);
  assert.match(controlCenter, /LANGUAGE_OPTIONS/);
  assert.match(controlCenter, /v0\.5\.1/);
  assert.doesNotMatch(controlCenter, />\s*12\s*</);
}

async function testManagedBackground(background, references) {
  const stored = new Map();
  let sequence = 0;
  let loadCount = 0;
  const storage = {
    async upload(file) {
      const extension = file.name.split(".").pop().toLowerCase();
      const storedName = `managed-${++sequence}.${extension === "jpeg" ? "jpg" : extension}`;
      stored.set(storedName, new Uint8Array(await file.arrayBuffer()));
      return { storedName, fileName: file.name, mimeType: file.type };
    },
    async load(storedName) {
      loadCount += 1;
      const bytes = stored.get(storedName);
      if (!bytes) throw new Error("missing");
      return bytes;
    },
    async remove(storedName) { stored.delete(storedName); },
  };
  const revoked = [];
  const manager = background.createControlCenterBackgroundManager(storage, {
    create(_bytes, mime) { return `managed-url:${mime}:${sequence}`; },
    revoke(url) { revoked.push(url); },
  });

  await manager.sync(references.CONTROL_CENTER_BUILTIN_BACKGROUND_REFERENCE);
  assert.equal(loadCount, 0);
  assert.ok(manager.imageUrl.value);
  await manager.sync(references.CONTROL_CENTER_MIKAN_BACKGROUND_REFERENCE);
  assert.equal(loadCount, 0);
  assert.equal(manager.imageUrl.value, references.CONTROL_CENTER_MIKAN_BACKGROUND_URL);
  assert.equal(
    manager.previewUrl(references.CONTROL_CENTER_MIKAN_BACKGROUND_REFERENCE),
    references.CONTROL_CENTER_MIKAN_BACKGROUND_URL,
  );
  assert.equal(references.isBuiltinControlCenterBackground("toString"), false);
  assert.equal(references.resolveBuiltinControlCenterBackground("toString"), undefined);

  let finishDelayedLoad;
  const delayedManager = background.createControlCenterBackgroundManager({
    async upload() { throw new Error("unused"); },
    async load() {
      return new Promise((resolve) => { finishDelayedLoad = resolve; });
    },
    async remove() {},
  }, {
    create() { return "managed-url:delayed"; },
    revoke() {},
  });
  const delayedLoad = delayedManager.sync("slow-theme.png");
  await delayedManager.sync(references.CONTROL_CENTER_BUILTIN_BACKGROUND_REFERENCE);
  finishDelayedLoad(Uint8Array.from([1, 2, 3]));
  await delayedLoad;
  assert.equal(
    delayedManager.imageUrl.value,
    references.CONTROL_CENTER_BUILTIN_BACKGROUND_URL,
    "a stale managed-background load must not overwrite the newly selected theme",
  );

  for (const [name, type] of [["scene.png", "image/png"], ["scene.jpg", "image/jpeg"], ["scene.webp", "image/webp"]]) {
    const file = fakeFile(name, type, [1, 2, 3]);
    const uploaded = await manager.upload(file);
    assert.doesNotMatch(uploaded.storedName, /\//);
    assert.notEqual(uploaded.storedName, name);
    await manager.sync(uploaded.storedName);
    assert.match(manager.imageUrl.value, /^managed-url:/);
  }

  const cached = await manager.upload(fakeFile("cached.png", "image/png", [4, 5, 6]));
  await manager.sync(cached.storedName);
  const loadCountAfterFirstUse = loadCount;
  const cachedUrl = manager.imageUrl.value;
  await manager.sync(references.CONTROL_CENTER_BUILTIN_BACKGROUND_REFERENCE);
  await manager.sync(cached.storedName);
  assert.equal(loadCount, loadCountAfterFirstUse);
  assert.equal(manager.imageUrl.value, cachedUrl);
  assert.equal(manager.previewUrl(cached.storedName), cachedUrl);

  const previewOnly = await manager.upload(fakeFile("preview-only.png", "image/png", [7, 8, 9]));
  await manager.sync(references.CONTROL_CENTER_BUILTIN_BACKGROUND_REFERENCE);
  const activeUrlBeforePreload = manager.imageUrl.value;
  const previewOnlyUrl = await manager.preload(previewOnly.storedName);
  assert.match(previewOnlyUrl, /^managed-url:/);
  assert.equal(manager.previewUrl(previewOnly.storedName), previewOnlyUrl);
  assert.equal(manager.imageUrl.value, activeUrlBeforePreload);
  await manager.deleteManaged(previewOnly.storedName);
  assert.equal(stored.has(previewOnly.storedName), false);
  assert.equal(manager.previewUrl(previewOnly.storedName), undefined);

  assert.throws(() => background.validateControlCenterBackgroundFile(fakeFile("scene.gif", "image/gif", [1])));
  assert.throws(() => background.validateControlCenterBackgroundFile({ ...fakeFile("huge.png", "image/png", []), size: background.CONTROL_CENTER_BACKGROUND_MAX_BYTES + 1 }));

  const retained = await manager.upload(fakeFile("retained.jpeg", "image/jpeg", [9, 8, 7]));
  await manager.sync(retained.storedName);
  assert.ok(stored.has(retained.storedName));
  await manager.remove(retained.storedName);
  assert.equal(stored.has(retained.storedName), false);
  assert.equal(manager.imageUrl.value, undefined);
  await manager.sync("missing.png");
  assert.equal(manager.imageUrl.value, undefined);
  assert.match(manager.lastError.value, /回退到背景颜色/);
  assert.ok(revoked.length > 0);

  const rustSource = await readFile(new URL("../src-tauri/src/commands/control_center_assets.rs", import.meta.url), "utf8");
  assert.match(rustSource, /pub async fn load_control_center_background/);
  assert.match(rustSource, /tauri::ipc::Response::new\(bytes\)/);
}

async function testThemeDeletionDuringSave(settingsManager, settingsStorage) {
  await settingsManager.initialize();
  settingsManager.resetDefaults();
  const customThemeId = settingsManager.createControlCenterTheme();
  const originalSave = settingsStorage.save;
  const writtenSnapshots = [];
  let saveCount = 0;
  let releaseFirstSave;

  settingsStorage.save = async (snapshot) => {
    saveCount += 1;
    writtenSnapshots.push(structuredClone(snapshot));
    if (saveCount === 1) {
      await new Promise((resolve) => { releaseFirstSave = resolve; });
    }
  };

  try {
    const firstSave = settingsManager.save();
    await Promise.resolve();
    assert.equal(settingsManager.deleteControlCenterTheme(customThemeId), true);
    let deleteFlushCompleted = false;
    const deleteFlush = settingsManager.save().then(() => { deleteFlushCompleted = true; });
    await Promise.resolve();
    assert.equal(deleteFlushCompleted, false);

    releaseFirstSave();
    await Promise.all([firstSave, deleteFlush]);

    assert.equal(saveCount, 2);
    assert.equal(settingsManager.settings.value.controlCenterThemes.activeThemeId, "default");
    assert.equal(
      settingsManager.settings.value.controlCenterThemes.themes.some(({ id }) => id === customThemeId),
      false,
    );
    assert.equal(
      writtenSnapshots.at(-1).controlCenterThemes.themes.some(({ id }) => id === customThemeId),
      false,
    );
  } finally {
    settingsStorage.save = originalSave;
  }
}

function fakeFile(name, type, bytes) {
  const data = Uint8Array.from(bytes);
  return { name, type, size: data.byteLength, async arrayBuffer() { return data.buffer.slice(0); } };
}
