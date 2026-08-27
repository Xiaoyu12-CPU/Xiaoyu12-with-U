import assert from "node:assert/strict";
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

  await testInformationArchitecture(navigation);
  testThemeSettings(normalizeSettings, defaults, theme);
  await testManagedBackground(background);
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
  assert.match(settingsPage, /GeneralSettings v-if/);
  assert.match(settingsPage, /SystemSettings v-else-if/);
  assert.match(settingsPage, /InputSettings v-else-if/);
  assert.match(settingsPage, /DialogueInteractionSettings v-else-if/);
  assert.match(settingsPage, /ControlCenterAppearanceSettings/);
  assert.doesNotMatch(settingsPage, /settings\.reminder/);
  assert.match(reminderPage, /data-reminder-settings/);
  assert.match(reminderPage, /reminder\.enabled/);
  assert.match(reminderPage, /reminder\.soundVolume/);
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

async function testManagedBackground(background) {
  const stored = new Map();
  let sequence = 0;
  const storage = {
    async upload(file) {
      const extension = file.name.split(".").pop().toLowerCase();
      const storedName = `managed-${++sequence}.${extension === "jpeg" ? "jpg" : extension}`;
      stored.set(storedName, new Uint8Array(await file.arrayBuffer()));
      return { storedName, fileName: file.name, mimeType: file.type };
    },
    async load(storedName) {
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
