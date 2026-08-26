import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const {
    KEY_DISPLAY_HIDE_DELAY_MS,
    buildKeyDisplayModel,
    createKeyDisplayController,
    formatDisplayKey,
  } = await vite.ssrLoadModule("/src/input/keyDisplay.ts");
  const { calculatePetWindowLayout } = await vite.ssrLoadModule(
    "/src/pet/windowLayout.ts",
  );
  const { normalizeSettings } = await vite.ssrLoadModule(
    "/src/settings/settingsManager.ts",
  );

  assert.equal(formatDisplayKey("A"), "A");
  assert.equal(formatDisplayKey("Command"), "⌘");
  assert.equal(formatDisplayKey("Shift"), "⇧");
  assert.equal(formatDisplayKey("Option"), "⌥");
  assert.equal(formatDisplayKey("Control"), "⌃");
  assert.equal(formatDisplayKey("ArrowUp"), "↑");
  assert.equal(formatDisplayKey("ArrowDown"), "↓");
  assert.equal(formatDisplayKey("ArrowLeft"), "←");
  assert.equal(formatDisplayKey("ArrowRight"), "→");
  assert.equal(formatDisplayKey("Space"), "Space");
  assert.equal(formatDisplayKey("Enter"), "↵");
  assert.equal(formatDisplayKey("Escape"), "Esc");
  assert.equal(formatDisplayKey("Backspace"), "⌫");
  assert.equal(formatDisplayKey("Tab"), "Tab");
  assert.equal(formatDisplayKey("Unknown(999)"), "?");

  assert.equal(
    normalizeSettings({
      input: { keyboardEnabled: true, mouseEnabled: false },
    }).input.keyDisplayEnabled,
    true,
  );

  assert.deepEqual(
    buildKeyDisplayModel(["A", "Command", "Shift", "Option", "Control"]).keycaps,
    ["⌃", "⌥", "⇧", "⌘", "A"],
  );
  assert.deepEqual(
    buildKeyDisplayModel(["D", "A", "S"]).keycaps,
    ["A", "D", "S"],
  );
  assert.deepEqual(
    buildKeyDisplayModel(["A", "S", "D", "F", "G", "H"]).keycaps,
    ["A", "D", "F", "G", "+2"],
  );

  const timers = createFakeTimers();
  const changes = [];
  const controller = createKeyDisplayController({
    onChange: (snapshot) => changes.push(snapshot),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const activeInput = {
    keyboardEnabled: true,
    keyDisplayEnabled: true,
    keyboardStatus: "active",
  };

  controller.update({ ...activeInput, pressedKeys: ["A"] });
  assert.deepEqual(controller.getSnapshot(), {
    visible: true,
    keycaps: ["A"],
    overflowCount: 0,
  });
  controller.update({ ...activeInput, pressedKeys: [] });
  timers.advance(KEY_DISPLAY_HIDE_DELAY_MS - 1);
  assert.equal(controller.getSnapshot().visible, true);
  timers.advance(1);
  assert.equal(controller.getSnapshot().visible, false);

  controller.update({ ...activeInput, pressedKeys: ["A"] });
  controller.update({ ...activeInput, pressedKeys: [] });
  timers.advance(400);
  controller.update({ ...activeInput, pressedKeys: ["B"] });
  timers.advance(500);
  assert.equal(controller.getSnapshot().visible, true);
  assert.deepEqual(controller.getSnapshot().keycaps, ["B"]);

  controller.update({ ...activeInput, keyboardEnabled: false, pressedKeys: ["B"] });
  assert.equal(controller.getSnapshot().visible, false);
  controller.update({ ...activeInput, pressedKeys: ["C"] });
  controller.update({ ...activeInput, keyDisplayEnabled: false, pressedKeys: ["C"] });
  assert.equal(controller.getSnapshot().visible, false);
  controller.update({ ...activeInput, pressedKeys: ["D"] });
  controller.update({
    ...activeInput,
    keyboardStatus: "permission-required",
    pressedKeys: ["D"],
  });
  assert.equal(controller.getSnapshot().visible, false);
  controller.dispose();
  assert.ok(changes.length >= 7);

  const baseLayout = {
    displayMode: "pet-only",
    petScale: 1,
    bubbleWidth: 184,
    bubbleHeight: 286,
    offsetX: 190,
    offsetY: 0,
  };
  const withoutKeys = calculatePetWindowLayout({
    ...baseLayout,
    keyDisplayVisible: false,
  });
  const withKeys = calculatePetWindowLayout({
    ...baseLayout,
    keyDisplayVisible: true,
  });
  assert.equal(withoutKeys.height, 200);
  assert.equal(withKeys.height, 248);
  assert.equal(withKeys.petX, withoutKeys.petX);
  assert.equal(withKeys.petY, withoutKeys.petY);
  assert.equal(withKeys.keyDisplayWidth, 180);

  const statusOnly = calculatePetWindowLayout({
    ...baseLayout,
    displayMode: "status-only",
    keyDisplayVisible: true,
  });
  assert.equal(statusOnly.width, 184);
  assert.equal(statusOnly.height, 286);

  console.log("Key display tests passed.");
} finally {
  await vite.close();
}

function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();

  return {
    setTimer(callback, delayMs) {
      const id = nextId++;
      timers.set(id, { callback, at: now + delayMs });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    advance(durationMs) {
      now += durationMs;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
  };
}
