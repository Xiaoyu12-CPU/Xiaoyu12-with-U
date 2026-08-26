import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const keyDisplay = await vite.ssrLoadModule("/src/input/keyDisplay.ts");
  const { calculatePetWindowLayout } = await vite.ssrLoadModule(
    "/src/pet/windowLayout.ts",
  );
  const { normalizeSettings } = await vite.ssrLoadModule(
    "/src/settings/settingsManager.ts",
  );
  const {
    buildKeyDisplayModel,
    createKeyHistoryController,
    formatDisplayKey,
    keyHistoryAxis,
    keyHistoryStackAlignment,
    resolveKeyDisplayFlowDirection,
  } = keyDisplay;

  testFormatting(formatDisplayKey, buildKeyDisplayModel);
  testSettingsCompatibility(normalizeSettings);
  testFlowResolution(
    resolveKeyDisplayFlowDirection,
    keyHistoryAxis,
    keyHistoryStackAlignment,
  );
  testChordAggregation(createKeyHistoryController);
  testHistoryLimits(createKeyHistoryController);
  testExpirationAndPersistent(createKeyHistoryController);
  testRuntimeClearing(createKeyHistoryController);
  testLayout(calculatePetWindowLayout);
  testDistanceLayout(
    calculatePetWindowLayout,
    keyHistoryStackAlignment,
    createKeyHistoryController,
  );

  console.log("Directional key history tests passed.");
} finally {
  await vite.close();
}

function testFormatting(formatDisplayKey, buildKeyDisplayModel) {
  const expected = {
    A: "A",
    Command: "⌘",
    Shift: "⇧",
    Option: "⌥",
    Control: "⌃",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Space: "Space",
    Enter: "↵",
    Escape: "Esc",
    Backspace: "⌫",
    Tab: "Tab",
    "Unknown(999)": "?",
  };
  for (const [key, label] of Object.entries(expected)) {
    assert.equal(formatDisplayKey(key), label);
  }
  assert.deepEqual(
    buildKeyDisplayModel(["A", "Command", "Shift", "Option", "Control"]).keycaps,
    ["⌃", "⌥", "⇧", "⌘", "A"],
  );
  assert.deepEqual(
    buildKeyDisplayModel(["A", "S", "D", "F", "G", "H"]).keycaps,
    ["A", "D", "F", "G", "+2"],
  );
}

function testSettingsCompatibility(normalizeSettings) {
  const oldSettings = normalizeSettings({
    input: { keyboardEnabled: true, keyDisplayEnabled: true, mouseEnabled: false },
  }).input;
  assert.equal(oldSettings.keyDisplayMaxItems, 4);
  assert.equal(oldSettings.keyDisplayDurationMs, 3000);
  assert.equal(oldSettings.keyDisplayPersistent, false);
  assert.equal(oldSettings.keyDisplayPosition, "bottom");
  assert.equal(oldSettings.keyDisplayFlowDirection, "auto");
  assert.equal(oldSettings.keyDisplayDistancePx, 12);

  const invalid = normalizeSettings({
    input: {
      keyDisplayMaxItems: 99,
      keyDisplayDurationMs: 20,
      keyDisplayPosition: "center",
      keyDisplayFlowDirection: "diagonal",
    },
  }).input;
  assert.equal(invalid.keyDisplayMaxItems, 8);
  assert.equal(invalid.keyDisplayDurationMs, 500);
  assert.equal(invalid.keyDisplayPosition, "bottom");
  assert.equal(invalid.keyDisplayFlowDirection, "auto");
  assert.equal(invalid.keyDisplayDistancePx, 12);
  assert.equal(normalizeSettings({ input: { keyDisplayMaxItems: 4.6 } }).input.keyDisplayMaxItems, 5);
  assert.equal(normalizeSettings({ input: { keyDisplayDistancePx: -10 } }).input.keyDisplayDistancePx, 0);
  assert.equal(normalizeSettings({ input: { keyDisplayDistancePx: 300 } }).input.keyDisplayDistancePx, 200);
  assert.equal(normalizeSettings({ input: { keyDisplayDistancePx: Number.NaN } }).input.keyDisplayDistancePx, 12);
  assert.equal(normalizeSettings({ input: { keyDisplayDistancePx: "far" } }).input.keyDisplayDistancePx, 12);
}

function testFlowResolution(resolveFlow, axisForFlow, stackAlignment) {
  const explicitCases = [
    ["bottom", "down", "down"],
    ["bottom", "up", "up"],
    ["bottom", "left", "left"],
    ["bottom", "right", "right"],
    ["top", "right", "right"],
    ["left", "down", "down"],
    ["right", "up", "up"],
  ];
  for (const [position, setting, expected] of explicitCases) {
    assert.equal(resolveFlow(position, setting), expected);
  }
  assert.equal(resolveFlow("bottom", "auto"), "down");
  assert.equal(resolveFlow("top", "auto"), "up");
  assert.equal(resolveFlow("left", "auto"), "left");
  assert.equal(resolveFlow("right", "auto"), "right");
  assert.equal(axisForFlow("up"), "vertical");
  assert.equal(axisForFlow("down"), "vertical");
  assert.equal(axisForFlow("left"), "horizontal");
  assert.equal(axisForFlow("right"), "horizontal");
  assert.deepEqual(stackAlignment("right", "up"), {
    justifyContent: "flex-end",
    alignItems: "flex-start",
  });
  assert.deepEqual(stackAlignment("right", "left"), {
    justifyContent: "flex-start",
    alignItems: "center",
  });
  assert.deepEqual(stackAlignment("bottom", "left"), {
    justifyContent: "flex-end",
    alignItems: "flex-start",
  });
  assert.deepEqual(stackAlignment("top", "right"), {
    justifyContent: "flex-start",
    alignItems: "flex-end",
  });
  assert.deepEqual(stackAlignment("left", "down"), {
    justifyContent: "flex-start",
    alignItems: "flex-end",
  });
}

function testChordAggregation(createController) {
  const { controller, input } = makeController(createController, { persistent: true });
  press(controller, input, "A");
  press(controller, input, "B");
  press(controller, input, "C");
  assert.deepEqual(labels(controller), ["A", "B", "C"]);

  const chord = makeController(createController, { persistent: true });
  chord.controller.update({ ...chord.input, pressedKeys: ["Command"] });
  chord.controller.update({ ...chord.input, pressedKeys: ["Command", "C"] });
  chord.controller.update({ ...chord.input, pressedKeys: ["Command"] });
  chord.controller.update({ ...chord.input, pressedKeys: [] });
  assert.deepEqual(labels(chord.controller), ["⌘ C"]);

  const held = makeController(createController, { persistent: true });
  held.controller.update({ ...held.input, pressedKeys: ["Command"] });
  held.controller.update({ ...held.input, pressedKeys: ["Command", "C"] });
  held.controller.update({ ...held.input, pressedKeys: ["Command"] });
  held.controller.update({ ...held.input, pressedKeys: ["Command", "V"] });
  held.controller.update({ ...held.input, pressedKeys: ["Command"] });
  held.controller.update({ ...held.input, pressedKeys: [] });
  assert.deepEqual(labels(held.controller), ["⌘ C", "⌘ V"]);

  const modifier = makeController(createController, { persistent: true });
  modifier.controller.update({ ...modifier.input, pressedKeys: ["Shift"] });
  modifier.controller.update({ ...modifier.input, pressedKeys: ["Shift"] });
  modifier.controller.update({ ...modifier.input, pressedKeys: [] });
  assert.deepEqual(labels(modifier.controller), ["⇧"]);

  const repeat = makeController(createController, { persistent: true });
  repeat.controller.update({ ...repeat.input, pressedKeys: ["A"] });
  repeat.controller.update({ ...repeat.input, pressedKeys: ["A"] });
  assert.deepEqual(labels(repeat.controller), ["A"]);

  const capsLock = makeController(createController, { persistent: true });
  capsLock.controller.update({ ...capsLock.input, pressedKeys: ["CapsLock"] });
  capsLock.controller.update({ ...capsLock.input, pressedKeys: ["CapsLock"] });
  assert.deepEqual(labels(capsLock.controller), ["CapsLock"]);
}

function testHistoryLimits(createController) {
  const limited = makeController(createController, { persistent: true, maxItems: 4 });
  for (const key of ["A", "B", "C", "D", "E"]) press(limited.controller, limited.input, key);
  assert.deepEqual(labels(limited.controller), ["B", "C", "D", "E"]);

  const dynamic = makeController(createController, { persistent: true, maxItems: 5 });
  for (const key of ["A", "B", "C", "D", "E"]) press(dynamic.controller, dynamic.input, key);
  dynamic.controller.update({ ...dynamic.input, maxItems: 3, pressedKeys: [] });
  assert.deepEqual(labels(dynamic.controller), ["C", "D", "E"]);

  // Position and flow are presentation settings and never mutate controller order.
  assert.deepEqual(labels(dynamic.controller), ["C", "D", "E"]);
}

function testExpirationAndPersistent(createController) {
  const timed = makeController(createController, { durationMs: 3000 });
  press(timed.controller, timed.input, "A");
  timed.timers.advance(1000);
  press(timed.controller, timed.input, "B");
  timed.timers.advance(2000);
  assert.deepEqual(labels(timed.controller), ["B"]);
  timed.timers.advance(1000);
  assert.deepEqual(labels(timed.controller), []);

  const persistent = makeController(createController, {
    persistent: true,
    maxItems: 2,
    durationMs: 500,
  });
  press(persistent.controller, persistent.input, "A");
  persistent.timers.advance(1000);
  assert.deepEqual(labels(persistent.controller), ["A"]);
  press(persistent.controller, persistent.input, "B");
  press(persistent.controller, persistent.input, "C");
  assert.deepEqual(labels(persistent.controller), ["B", "C"]);

  const cancelPending = makeController(createController, { durationMs: 1000 });
  press(cancelPending.controller, cancelPending.input, "A");
  assert.equal(cancelPending.timers.pending(), 1);
  cancelPending.controller.update({
    ...cancelPending.input,
    persistent: true,
    pressedKeys: [],
  });
  assert.equal(cancelPending.timers.pending(), 0);
  cancelPending.timers.advance(2000);
  assert.deepEqual(labels(cancelPending.controller), ["A"]);

  cancelPending.controller.update({
    ...cancelPending.input,
    persistent: false,
    pressedKeys: [],
  });
  cancelPending.timers.advance(999);
  assert.deepEqual(labels(cancelPending.controller), ["A"]);
  cancelPending.timers.advance(1);
  assert.deepEqual(labels(cancelPending.controller), []);
}

function testRuntimeClearing(createController) {
  for (const override of [
    { keyDisplayEnabled: false },
    { keyboardEnabled: false },
    { keyboardStatus: "permission-required" },
    { keyboardStatus: "error" },
  ]) {
    const state = makeController(createController, { durationMs: 3000 });
    press(state.controller, state.input, "A");
    state.controller.update({ ...state.input, ...override, pressedKeys: [] });
    assert.deepEqual(labels(state.controller), []);
    assert.equal(state.timers.pending(), 0);
  }

  const disposed = makeController(createController, { durationMs: 3000 });
  press(disposed.controller, disposed.input, "A");
  disposed.controller.dispose();
  assert.equal(disposed.timers.pending(), 0);
}

function testLayout(calculateLayout) {
  const base = {
    displayMode: "pet-only",
    petScale: 1,
    bubbleWidth: 184,
    bubbleHeight: 286,
    offsetX: 190,
    offsetY: 0,
    keyDisplayVisible: true,
    keyDisplayMaxItems: 4,
    keyDisplayDistancePx: 12,
  };
  const cases = [
    ["bottom", "down", "below"],
    ["bottom", "up", "below"],
    ["bottom", "left", "below"],
    ["bottom", "right", "below"],
    ["top", "right", "above"],
    ["left", "down", "left"],
    ["right", "up", "right"],
  ];
  for (const [position, flow, side] of cases) {
    const layout = calculateLayout({
      ...base,
      keyDisplayPosition: position,
      keyDisplayFlowDirection: flow,
    });
    if (side === "below") assert.ok(layout.keyDisplayY >= layout.petY + layout.petSize);
    if (side === "above") assert.ok(layout.keyDisplayY + layout.keyDisplayHeight <= layout.petY);
    if (side === "left") assert.ok(layout.keyDisplayX + layout.keyDisplayWidth <= layout.petX);
    if (side === "right") assert.ok(layout.keyDisplayX >= layout.petX + layout.petSize);
    assert.equal(layout.minX + layout.petX, 0);
    assert.equal(layout.minY + layout.petY, 0);
  }

  const vertical = calculateLayout({
    ...base,
    keyDisplayPosition: "bottom",
    keyDisplayFlowDirection: "down",
  });
  const horizontal = calculateLayout({
    ...base,
    keyDisplayPosition: "bottom",
    keyDisplayFlowDirection: "left",
  });
  assert.ok(vertical.keyDisplayHeight > horizontal.keyDisplayHeight);
  assert.ok(horizontal.keyDisplayWidth > vertical.keyDisplayWidth);

  const statusOnly = calculateLayout({
    ...base,
    displayMode: "status-only",
    keyDisplayPosition: "bottom",
    keyDisplayFlowDirection: "down",
  });
  assert.equal(statusOnly.width, 184);
  assert.equal(statusOnly.height, 286);
}

function testDistanceLayout(calculateLayout, stackAlignment, createController) {
  const base = {
    displayMode: "pet-only",
    petScale: 1,
    bubbleWidth: 184,
    bubbleHeight: 286,
    offsetX: 190,
    offsetY: 0,
    keyDisplayVisible: true,
    keyDisplayMaxItems: 4,
    keyDisplayDistancePx: 12,
  };
  const cases = [
    ["right", "up"],
    ["right", "left"],
    ["left", "down"],
    ["bottom", "left"],
    ["top", "right"],
  ];
  for (const [position, flow] of cases) {
    const layout = calculateLayout({
      ...base,
      keyDisplayPosition: position,
      keyDisplayFlowDirection: flow,
    });
    assert.equal(distanceFromPet(layout, position), 12);
  }

  const rightNear = calculateLayout({
    ...base,
    keyDisplayPosition: "right",
    keyDisplayFlowDirection: "up",
    keyDisplayDistancePx: 0,
  });
  const rightFar = calculateLayout({
    ...base,
    keyDisplayPosition: "right",
    keyDisplayFlowDirection: "left",
    keyDisplayDistancePx: 60,
  });
  assert.equal(distanceFromPet(rightNear, "right"), 0);
  assert.equal(distanceFromPet(rightFar, "right"), 60);
  assert.equal(rightNear.minX + rightNear.petX, 0);
  assert.equal(rightFar.minX + rightFar.petX, 0);
  assert.deepEqual(stackAlignment("right", "up").alignItems, "flex-start");
  assert.deepEqual(stackAlignment("right", "left").justifyContent, "flex-start");

  const maxEight = calculateLayout({
    ...base,
    keyDisplayPosition: "bottom",
    keyDisplayFlowDirection: "left",
    keyDisplayMaxItems: 8,
    keyDisplayDistancePx: 35,
  });
  assert.equal(distanceFromPet(maxEight, "bottom"), 35);

  const withStatusNear = calculateLayout({
    ...base,
    displayMode: "both",
    keyDisplayPosition: "right",
    keyDisplayFlowDirection: "up",
    keyDisplayDistancePx: 12,
  });
  const withStatusFar = calculateLayout({
    ...base,
    displayMode: "both",
    keyDisplayPosition: "right",
    keyDisplayFlowDirection: "up",
    keyDisplayDistancePx: 60,
  });
  assert.equal(withStatusNear.bubbleX + withStatusNear.minX, base.offsetX);
  assert.equal(withStatusNear.bubbleY + withStatusNear.minY, base.offsetY);
  assert.equal(withStatusFar.bubbleX + withStatusFar.minX, base.offsetX);
  assert.equal(withStatusFar.bubbleY + withStatusFar.minY, base.offsetY);

  const history = makeController(createController, { persistent: true });
  press(history.controller, history.input, "A");
  calculateLayout({
    ...base,
    keyDisplayPosition: "right",
    keyDisplayFlowDirection: "up",
    keyDisplayDistancePx: 12,
  });
  calculateLayout({
    ...base,
    keyDisplayPosition: "right",
    keyDisplayFlowDirection: "left",
    keyDisplayDistancePx: 60,
  });
  assert.deepEqual(labels(history.controller), ["A"]);

  // Entry count/content is deliberately absent from layout input, so runtime
  // additions and expirations cannot change the fixed reserved rectangle.
  assert.deepEqual(
    calculateLayout({
      ...base,
      keyDisplayPosition: "right",
      keyDisplayFlowDirection: "up",
    }),
    calculateLayout({
      ...base,
      keyDisplayPosition: "right",
      keyDisplayFlowDirection: "up",
    }),
  );
}

function distanceFromPet(layout, position) {
  if (position === "right") {
    return layout.keyDisplayX - (layout.petX + layout.petSize);
  }
  if (position === "left") {
    return layout.petX - (layout.keyDisplayX + layout.keyDisplayWidth);
  }
  if (position === "top") {
    return layout.petY - (layout.keyDisplayY + layout.keyDisplayHeight);
  }
  return layout.keyDisplayY - (layout.petY + layout.petSize);
}

function makeController(createController, overrides = {}) {
  const timers = createFakeTimers();
  const controller = createController({
    now: timers.now,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const input = {
    pressedKeys: [],
    keyboardEnabled: true,
    keyDisplayEnabled: true,
    keyboardStatus: "active",
    maxItems: 8,
    durationMs: 3000,
    persistent: false,
    ...overrides,
  };
  controller.update(input);
  return { controller, input, timers };
}

function press(controller, input, key) {
  controller.update({ ...input, pressedKeys: [key] });
  controller.update({ ...input, pressedKeys: [] });
}

function labels(controller) {
  return controller.getSnapshot().entries.map(({ label }) => label);
}

function createFakeTimers() {
  let currentTime = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    now: () => currentTime,
    setTimer(callback, delayMs) {
      const id = nextId++;
      timers.set(id, { callback, at: currentTime + delayMs });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    pending: () => timers.size,
    advance(durationMs) {
      currentTime += durationMs;
      let ranTimer = true;
      while (ranTimer) {
        ranTimer = false;
        for (const [id, timer] of [...timers]) {
          if (timer.at <= currentTime) {
            timers.delete(id);
            timer.callback();
            ranTimer = true;
          }
        }
      }
    },
  };
}
