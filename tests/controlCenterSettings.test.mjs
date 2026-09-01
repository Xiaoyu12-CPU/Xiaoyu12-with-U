import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

globalThis.window = new EventTarget();
globalThis.localStorage = { getItem() { return null; }, setItem() {} };

const vite = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

try {
  const navigation = await vite.ssrLoadModule("/src/settings/settingsNavigation.ts");
  const { normalizeSettings } = await vite.ssrLoadModule("/src/settings/settingsManager.ts");
  const defaults = await vite.ssrLoadModule("/src/settings/defaultSettings.ts");
  const theme = await vite.ssrLoadModule("/src/settings/controlCenterTheme.ts");
  const background = await vite.ssrLoadModule("/src/settings/controlCenterBackground.ts");
  const references = await vite.ssrLoadModule("/src/settings/controlCenterBackgroundReference.ts");
  const i18n = await vite.ssrLoadModule("/src/i18n/index.ts");

  await testInformationArchitecture(navigation);
  testThemeSettings(normalizeSettings, defaults, theme);
  await testShippingBaseline(normalizeSettings, defaults, references);
  await testLanguageSettings(normalizeSettings, i18n);
  await testManagedBackground(background, references);
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
  assert.match(controlCenter, /<small>v0\.4\.5\.1<\/small>/);
  assert.doesNotMatch(controlCenter, /<p>withXiaoyu12<\/p>/);
  assert.doesNotMatch(systemSettings, /displayMode/);
  assert.doesNotMatch(dialogueSettings, /showDevelopmentMessageOnStartup/);
  assert.match(stateEditor, /v-if="loop"/);
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
      sidebarBackgroundColor: "#010203",
      sidebarBackgroundOpacity: 0.4,
      sidebarTextColor: "#abcdef",
      sidebarActiveBackgroundColor: "#111111",
      sidebarActiveBackgroundOpacity: 0.6,
      sidebarActiveTextColor: "#eeeeee",
      primaryTextColor: "#101010",
      secondaryTextColor: "#202020",
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
  assert.equal(normalized.controlCenter.cardBorderWidth, 6);
  assert.equal(normalized.controlCenter.sidebarTextColor, "#ABCDEF");
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

  const variables = theme.createControlCenterThemeVariables(normalized.controlCenter);
  assert.equal(variables["--cc-background"], "rgba(18, 58, 188, 0)");
  assert.equal(variables["--cc-card-bg"], "rgba(48, 48, 48, 0.7)");
  assert.equal(variables["--cc-sidebar-background"], "rgba(1, 2, 3, 0.4)");
  assert.equal(variables["--cc-accent"], "#505050");

  const reset = normalizeSettings({
    ...normalized,
    controlCenter: defaults.createDefaultControlCenterAppearance(),
  });
  assert.deepEqual(reset.controlCenter, defaults.DEFAULT_SETTINGS.controlCenter);
  assert.equal(reset.systemMonitor.cpuHighThreshold, 73);
  assert.equal(reset.input.keyDisplayMaxItems, 7);
  assert.equal(reset.reminder.enabled, true);
}

async function testShippingBaseline(normalizeSettings, defaults, references) {
  const expectedTheme = {
    backgroundColor: "#ECF3F8",
    backgroundOpacity: 0.75,
    backgroundImage: references.CONTROL_CENTER_BUILTIN_BACKGROUND_REFERENCE,
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
  assert.equal(i18n.translateForLanguage("en", "项目数量", { count: 3 }), "3 items");

  const controlCenter = await readFile(new URL("../src/settings/ControlCenter.vue", import.meta.url), "utf8");
  assert.match(controlCenter, /app-icon\.png/);
  assert.match(controlCenter, /LANGUAGE_OPTIONS/);
  assert.match(controlCenter, /v0\.4\.5/);
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

  for (const [name, type] of [["scene.png", "image/png"], ["scene.jpg", "image/jpeg"], ["scene.webp", "image/webp"]]) {
    const file = fakeFile(name, type, [1, 2, 3]);
    const uploaded = await manager.upload(file);
    assert.doesNotMatch(uploaded.storedName, /\//);
    assert.notEqual(uploaded.storedName, name);
    await manager.sync(uploaded.storedName);
    assert.match(manager.imageUrl.value, /^managed-url:/);
  }

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
}

function fakeFile(name, type, bytes) {
  const data = Uint8Array.from(bytes);
  return { name, type, size: data.byteLength, async arrayBuffer() { return data.buffer.slice(0); } };
}
