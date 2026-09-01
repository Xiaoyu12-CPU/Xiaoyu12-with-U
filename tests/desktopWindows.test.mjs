import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

globalThis.window = new EventTarget();
globalThis.localStorage = { getItem() { return null; }, setItem() {} };

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { normalizeSettings } = await vite.ssrLoadModule(
    "/src/settings/settingsManager.ts",
  );
  const defaults = await vite.ssrLoadModule("/src/settings/defaultSettings.ts");
  const layout = await vite.ssrLoadModule("/src/pet/desktopWindowLayout.ts");
  const windows = await vite.ssrLoadModule("/src/pet/desktopWindows.ts");

  testSettingsMigration(normalizeSettings, defaults);
  testWindowOptions(windows, defaults);
  testWindowSettingsSignature(windows, defaults);
  testKeyboardLayout(layout);
  testDefaultAnchors(layout);
  await testArchitectureSources();
  console.log("Desktop window tests passed.");
} finally {
  await vite.close();
  delete globalThis.window;
  delete globalThis.localStorage;
}

function testWindowSettingsSignature(windows, defaults) {
  const settings = defaults.createDefaultSettings();
  const baseline = windows.createOverlayWindowOptionsSignature(settings);

  settings.input.typingBusyWindowSeconds += 30;
  settings.dialogue.bubbleDurationMs += 250;
  settings.reminder.enabled = !settings.reminder.enabled;
  assert.equal(windows.createOverlayWindowOptionsSignature(settings), baseline);

  settings.windows.systemStatusWindowEnabled = true;
  assert.notEqual(windows.createOverlayWindowOptionsSignature(settings), baseline);
}

function testSettingsMigration(normalizeSettings, defaults) {
  assert.deepEqual(
    normalizeSettings({}).windows,
    defaults.DEFAULT_SETTINGS.windows,
  );

  const from041 = normalizeSettings({
    systemStatusBubble: { displayMode: "both" },
    input: {
      keyboardEnabled: true,
      keyDisplayEnabled: true,
      mouseEnabled: true,
      mouseVisualizerEnabled: true,
    },
  });
  assert.equal(from041.windows.systemStatusWindowEnabled, false);
  assert.equal(from041.windows.keyboardHistoryWindowEnabled, false);
  assert.equal(from041.windows.mouseVisualizerWindowEnabled, false);

  const from042 = normalizeSettings({
    windows: {
      systemStatusWindowEnabled: true,
      inputMonitorWindowEnabled: true,
      inputMonitorClickThrough: true,
      followPet: false,
    },
  });
  assert.equal(from042.windows.systemStatusWindowEnabled, true);
  assert.equal(from042.windows.keyboardHistoryWindowEnabled, true);
  assert.equal(from042.windows.mouseVisualizerWindowEnabled, true);
  assert.equal(from042.windows.keyboardHistoryClickThrough, true);
  assert.equal(from042.windows.mouseVisualizerClickThrough, true);
  assert.equal(from042.windows.followPet, false);

  const explicit = normalizeSettings({
    windows: {
      keyboardHistoryWindowEnabled: true,
      mouseVisualizerWindowEnabled: false,
      keyboardHistoryClickThrough: false,
      mouseVisualizerClickThrough: true,
    },
  });
  assert.equal(explicit.windows.keyboardHistoryWindowEnabled, true);
  assert.equal(explicit.windows.mouseVisualizerWindowEnabled, false);
  assert.equal(explicit.windows.keyboardHistoryClickThrough, false);
  assert.equal(explicit.windows.mouseVisualizerClickThrough, true);
}

function testWindowOptions(windows, defaults) {
  const settings = defaults.createDefaultSettings();
  settings.windows.systemStatusWindowEnabled = true;
  settings.windows.keyboardHistoryWindowEnabled = true;
  settings.windows.mouseVisualizerWindowEnabled = true;
  settings.windows.keyboardHistoryClickThrough = true;
  settings.windows.mouseVisualizerClickThrough = false;
  const options = windows.buildOverlayWindowOptions(settings);
  assert.deepEqual(
    options.map(({ label }) => label),
    ["system-status", "keyboard-history", "mouse-visualizer"],
  );
  assert.ok(options.every(({ width, height }) => width > 0 && height > 0));
  assert.equal(options[0].visible, true);
  assert.equal(options[1].visible, false);
  assert.equal(options[2].visible, false);
  assert.equal(options[1].clickThrough, true);
  assert.equal(options[2].clickThrough, false);
  assert.ok(options.every(({ followPet }) => followPet));

  settings.input.keyDisplayEnabled = true;
  settings.input.mouseVisualizerEnabled = true;
  const enabledOptions = windows.buildOverlayWindowOptions(settings);
  assert.equal(enabledOptions[1].visible, true);
  assert.equal(enabledOptions[2].visible, true);
  assert.deepEqual(
    enabledOptions.map(({ defaultOffsetX, defaultOffsetY }) => [defaultOffsetX, defaultOffsetY]),
    [[19, 152], [135, 33], [171, 201]],
  );
}

function testKeyboardLayout(layout) {
  for (const position of ["top", "bottom", "left", "right"]) {
    for (const flowDirection of ["auto", "up", "down", "left", "right"]) {
      const value = layout.calculateKeyboardWindowLayout({
        petScale: 2,
        position,
        flowDirection,
        maxItems: 8,
        startLineGapPx: 80,
      });
      assert.ok(value.width <= 1600);
      assert.ok(value.height <= 1600);
      assert.ok(value.stack.left >= 0 && value.stack.top >= 0);
      assert.ok(value.stack.left + value.stack.width <= value.width + 0.01);
      assert.ok(value.stack.top + value.stack.height <= value.height + 0.01);
      assert.ok(value.origin.left >= 0 && value.origin.left <= value.width);
      assert.ok(value.origin.top >= 0 && value.origin.top <= value.height);
    }
  }
}

function testDefaultAnchors(layout) {
  const size = { width: 100, height: 120 };
  const left = layout.calculateDefaultOverlayOffset({
    kind: "mouse-visualizer",
    petScale: 1,
    overlaySize: size,
    position: "left",
  });
  const right = layout.calculateDefaultOverlayOffset({
    kind: "mouse-visualizer",
    petScale: 1,
    overlaySize: size,
    position: "right",
  });
  assert.ok(left.x < 0);
  assert.ok(right.x >= 200);
  assert.equal(left.y, right.y);
}

async function testArchitectureSources() {
  const app = await readFile(new URL("../src/App.vue", import.meta.url), "utf8");
  const pet = await readFile(new URL("../src/pet/Pet.vue", import.meta.url), "utf8");
  const backend = await readFile(
    new URL("../src-tauri/src/commands/app.rs", import.meta.url),
    "utf8",
  );
  const statusWindow = await readFile(
    new URL("../src/components/SystemStatusWindow.vue", import.meta.url),
    "utf8",
  );
  const statusPage = await readFile(
    new URL("../src/settings/StatusPage.vue", import.meta.url),
    "utf8",
  );
  const contextMenu = await readFile(
    new URL("../src/components/PetContextMenu.vue", import.meta.url),
    "utf8",
  );
  const tauriConfig = JSON.parse(await readFile(
    new URL("../src-tauri/tauri.conf.json", import.meta.url),
    "utf8",
  ));

  for (const label of ["system-status", "keyboard-history", "mouse-visualizer"]) {
    assert.match(app, new RegExp(label));
  }
  assert.doesNotMatch(app, /input-monitor/);
  assert.doesNotMatch(
    pet,
    /calculatePetWindowLayout|SystemStatusBubble|KeyHistoryStack|MouseInputVisualizer/,
  );
  assert.match(backend, /directory\.join\(WINDOW_POSITIONS_FILE\)/);
  assert.match(backend, /relative_target/);
  assert.doesNotMatch(backend, /delta_x|delta_y/);
  for (const command of [
    "resize_overlay_window",
    "follow_overlay_windows",
    "save_overlay_window_position",
    "save_pet_window_position",
    "reset_overlay_window_position",
  ]) {
    assert.match(backend, new RegExp(`pub async fn ${command}`));
  }
  assert.doesNotMatch(statusWindow, /<main[^>]*@pointer-down=/s);
  assert.doesNotMatch(statusPage, /Development \/ Debug|DEBUG_REQUEST|测试下一个事件|暂停动画|恢复动画/);
  assert.doesNotMatch(contextMenu, /测试事件|暂停动画|恢复动画/);
  assert.match(backend, /restore_pet_window_position/);
  assert.equal(tauriConfig.version, "0.4.5");
  assert.equal(tauriConfig.bundle.macOS.signingIdentity, "-");
}
