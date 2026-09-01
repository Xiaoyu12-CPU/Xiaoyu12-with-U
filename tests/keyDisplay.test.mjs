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
  const keyHistoryDrag = await vite.ssrLoadModule(
    "/src/input/keyHistoryDrag.ts",
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
  testOriginLayout(
    calculatePetWindowLayout,
    createKeyHistoryController,
  );
  testDragLifecycle(keyHistoryDrag, createKeyHistoryController);

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
  assert.equal(oldSettings.keyDisplayDurationMs, 2500);
  assert.equal(oldSettings.keyDisplayPersistent, false);
  assert.equal(oldSettings.keyDisplayPosition, "bottom");
  assert.equal(oldSettings.keyDisplayFlowDirection, "up");
  assert.equal(oldSettings.keyDisplayOffsetX, 115);
  assert.equal(oldSettings.keyDisplayOffsetY, -175);
  assert.equal(oldSettings.keyDisplayStartLineGapPx, 8);
  assert.equal(oldSettings.keyDisplayStartLineColor, "#8B5CF6");
  assert.equal(oldSettings.keyDisplayStartLineOpacity, 0.5);
  assert.equal("keyDisplayDistancePx" in oldSettings, false);

  const invalid = normalizeSettings({
    input: {
      keyDisplayMaxItems: 99,
      keyDisplayDurationMs: 20,
      keyDisplayPosition: "center",
      keyDisplayFlowDirection: "diagonal",
      keyDisplayOffsetX: -900,
      keyDisplayOffsetY: 900,
      keyDisplayStartLineGapPx: 120,
      keyDisplayStartLineColor: "purple",
      keyDisplayStartLineOpacity: 8,
      keyDisplayDistancePx: 175,
    },
  }).input;
  assert.equal(invalid.keyDisplayMaxItems, 8);
  assert.equal(invalid.keyDisplayDurationMs, 500);
  assert.equal(invalid.keyDisplayPosition, "bottom");
  assert.equal(invalid.keyDisplayFlowDirection, "up");
  assert.equal(invalid.keyDisplayOffsetX, -500);
  assert.equal(invalid.keyDisplayOffsetY, 500);
  assert.equal(invalid.keyDisplayStartLineGapPx, 80);
  assert.equal(invalid.keyDisplayStartLineColor, "#8B5CF6");
  assert.equal(invalid.keyDisplayStartLineOpacity, 1);
  assert.equal("keyDisplayDistancePx" in invalid, false);
  assert.equal(normalizeSettings({ input: { keyDisplayMaxItems: 4.6 } }).input.keyDisplayMaxItems, 5);
  assert.equal(normalizeSettings({ input: { keyDisplayOffsetX: Number.NaN } }).input.keyDisplayOffsetX, 115);
  assert.equal(normalizeSettings({ input: { keyDisplayOffsetY: "far" } }).input.keyDisplayOffsetY, -175);
  assert.equal(normalizeSettings({ input: { keyDisplayStartLineGapPx: -10 } }).input.keyDisplayStartLineGapPx, 0);
  assert.equal(normalizeSettings({ input: { keyDisplayStartLineGapPx: Number.NaN } }).input.keyDisplayStartLineGapPx, 8);
  assert.equal(normalizeSettings({ input: { keyDisplayStartLineGapPx: "wide" } }).input.keyDisplayStartLineGapPx, 8);
  assert.equal(normalizeSettings({ input: { keyDisplayStartLineColor: "#123abc" } }).input.keyDisplayStartLineColor, "#123ABC");
  assert.equal(normalizeSettings({ input: { keyDisplayStartLineOpacity: -1 } }).input.keyDisplayStartLineOpacity, 0);
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
    alignItems: "center",
  });
  assert.deepEqual(stackAlignment("right", "left"), {
    justifyContent: "flex-end",
    alignItems: "center",
  });
  assert.deepEqual(stackAlignment("bottom", "left"), {
    justifyContent: "flex-end",
    alignItems: "center",
  });
  assert.deepEqual(stackAlignment("top", "right"), {
    justifyContent: "flex-start",
    alignItems: "center",
  });
  assert.deepEqual(stackAlignment("left", "down"), {
    justifyContent: "flex-start",
    alignItems: "center",
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
    keyDisplayOffsetX: 0,
    keyDisplayOffsetY: 0,
    keyDisplayStartLineGapPx: 8,
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
    const origin = worldOrigin(layout);
    if (side === "below") assert.deepEqual(origin, { x: 100, y: 200 });
    if (side === "above") assert.deepEqual(origin, { x: 100, y: 0 });
    if (side === "left") assert.deepEqual(origin, { x: 0, y: 100 });
    if (side === "right") assert.deepEqual(origin, { x: 200, y: 100 });
    assertGapFromVisibleLine(layout, flow, 8);
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

function testOriginLayout(calculateLayout, createController) {
  const base = {
    displayMode: "pet-only",
    petScale: 1,
    bubbleWidth: 184,
    bubbleHeight: 286,
    offsetX: 190,
    offsetY: 0,
    keyDisplayVisible: true,
    keyDisplayMaxItems: 4,
    keyDisplayOffsetX: 0,
    keyDisplayOffsetY: 0,
    keyDisplayStartLineGapPx: 8,
  };
  const cases = [
    ["right", "up"],
    ["right", "left"],
    ["left", "down"],
    ["bottom", "left"],
    ["top", "right"],
  ];
  const expectedOrigins = {
    right: { x: 200, y: 100 },
    left: { x: 0, y: 100 },
    bottom: { x: 100, y: 200 },
    top: { x: 100, y: 0 },
  };
  for (const [position, flow] of cases) {
    const layout = calculateLayout({
      ...base,
      keyDisplayPosition: position,
      keyDisplayFlowDirection: flow,
    });
    assert.deepEqual(worldOrigin(layout), expectedOrigins[position]);
    assertGapFromVisibleLine(layout, flow, 8);
  }

  const rightUp = calculateLayout({
    ...base,
    keyDisplayPosition: "right",
    keyDisplayFlowDirection: "up",
  });
  const rightLeft = calculateLayout({
    ...base,
    keyDisplayPosition: "right",
    keyDisplayFlowDirection: "left",
  });
  assert.deepEqual(worldOrigin(rightUp), worldOrigin(rightLeft));
  assert.deepEqual(worldOrigin(rightUp), { x: 200, y: 100 });
  assert.equal(rightUp.minX + rightUp.petX, 0);
  assert.equal(rightLeft.minX + rightLeft.petX, 0);

  for (const flow of ["up", "down", "left", "right"]) {
    const gapZero = calculateLayout({
      ...base,
      keyDisplayPosition: "right",
      keyDisplayFlowDirection: flow,
      keyDisplayStartLineGapPx: 0,
    });
    const gapThirty = calculateLayout({
      ...base,
      keyDisplayPosition: "right",
      keyDisplayFlowDirection: flow,
      keyDisplayStartLineGapPx: 30,
    });
    assert.deepEqual(worldOrigin(gapZero), worldOrigin(gapThirty));
    assertGapFromVisibleLine(gapZero, flow, 0);
    assertGapFromVisibleLine(gapThirty, flow, 30);
    assert.equal(gapZero.minX + gapZero.petX, 0);
    assert.equal(gapZero.minY + gapZero.petY, 0);
    assert.equal(gapThirty.minX + gapThirty.petX, 0);
    assert.equal(gapThirty.minY + gapThirty.petY, 0);
  }

  const moved = calculateLayout({
    ...base,
    keyDisplayPosition: "right",
    keyDisplayFlowDirection: "up",
    keyDisplayOffsetX: -40,
    keyDisplayOffsetY: 15,
  });
  assert.deepEqual(worldOrigin(moved), { x: 160, y: 115 });
  assert.equal(moved.minX + moved.petX, 0);
  assert.ok(moved.keyDisplayOriginX >= 36);
  assert.ok(moved.keyDisplayOriginX <= moved.width - 36);
  assert.ok(moved.keyDisplayOriginY >= 12);
  assert.ok(moved.keyDisplayOriginY <= moved.height - 12);

  const repositioned = calculateLayout({
    ...base,
    keyDisplayPosition: "bottom",
    keyDisplayFlowDirection: "left",
    keyDisplayOffsetX: -40,
    keyDisplayOffsetY: 15,
  });
  assert.deepEqual(worldOrigin(repositioned), { x: 60, y: 215 });

  const withStatus = calculateLayout({
    ...base,
    displayMode: "both",
    keyDisplayPosition: "right",
    keyDisplayFlowDirection: "up",
    keyDisplayOffsetX: 80,
    keyDisplayOffsetY: -30,
  });
  assert.equal(withStatus.bubbleX + withStatus.minX, base.offsetX);
  assert.equal(withStatus.bubbleY + withStatus.minY, base.offsetY);
  const withStatusWideGap = calculateLayout({
    ...base,
    displayMode: "both",
    keyDisplayPosition: "right",
    keyDisplayFlowDirection: "up",
    keyDisplayOffsetX: 80,
    keyDisplayOffsetY: -30,
    keyDisplayStartLineGapPx: 60,
  });
  assert.equal(withStatusWideGap.bubbleX + withStatusWideGap.minX, base.offsetX);
  assert.equal(withStatusWideGap.bubbleY + withStatusWideGap.minY, base.offsetY);

  const history = makeController(createController, { persistent: true });
  press(history.controller, history.input, "A");
  calculateLayout({
    ...base,
    keyDisplayPosition: "right",
    keyDisplayFlowDirection: "up",
    keyDisplayOffsetX: 0,
    keyDisplayOffsetY: 0,
  });
  calculateLayout({
    ...base,
    keyDisplayPosition: "right",
    keyDisplayFlowDirection: "left",
    keyDisplayOffsetX: 100,
    keyDisplayOffsetY: -100,
    keyDisplayStartLineGapPx: 60,
  });
  assert.deepEqual(labels(history.controller), ["A"]);

  const timedHistory = makeController(createController, {
    persistent: false,
    durationMs: 3000,
  });
  press(timedHistory.controller, timedHistory.input, "B");
  const pendingBeforeGapChange = timedHistory.timers.pending();
  calculateLayout({ ...base, keyDisplayStartLineGapPx: 0 });
  calculateLayout({ ...base, keyDisplayStartLineGapPx: 80 });
  assert.deepEqual(labels(timedHistory.controller), ["B"]);
  assert.equal(timedHistory.timers.pending(), pendingBeforeGapChange);

  const legacyDistanceNear = calculateLayout({ ...base, keyDisplayDistancePx: 0 });
  const legacyDistanceFar = calculateLayout({ ...base, keyDisplayDistancePx: 200 });
  assert.deepEqual(legacyDistanceNear, legacyDistanceFar);

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

function testDragLifecycle(keyHistoryDrag, createController) {
  const {
    createKeyHistoryDragController,
    keyHistoryStartLinePresentation,
    resetKeyHistoryOffset,
  } = keyHistoryDrag;
  const previews = [];
  const commits = [];
  let persisted = { x: 0, y: 0 };
  const drag = createKeyHistoryDragController({
    onPreview(offset) {
      previews.push(offset);
    },
    onCommit(offset) {
      persisted = offset;
      commits.push(offset);
    },
  });
  assert.equal(drag.start({ pointerId: 7, screenX: 100, screenY: 50, offset: persisted }), true);
  assert.equal(drag.start({ pointerId: 8, screenX: 0, screenY: 0, offset: persisted }), false);
  assert.equal(drag.move(7, 150, 20), true);
  assert.deepEqual(previews, [{ x: 50, y: -30 }]);
  assert.deepEqual(persisted, { x: 0, y: 0 });
  assert.equal(drag.finish(7), true);
  assert.deepEqual(persisted, { x: 50, y: -30 });
  assert.equal(commits.length, 1);
  assert.equal(drag.finish(7), false);

  drag.start({ pointerId: 9, screenX: 0, screenY: 0, offset: persisted });
  drag.move(9, 900, -900);
  drag.finish(9);
  assert.deepEqual(persisted, { x: 500, y: -500 });
  assert.equal(commits.length, 2);

  const presentation = keyHistoryStartLinePresentation("#8B5CF6", 0);
  assert.equal(presentation.lineStyle.opacity, 0);
  assert.equal(presentation.handleStyle.pointerEvents, "auto");

  const settings = {
    position: "right",
    flow: "up",
    offset: persisted,
    gap: 24,
    color: "#8B5CF6",
    opacity: 0.5,
  };
  const reset = { ...settings, offset: resetKeyHistoryOffset() };
  assert.deepEqual(reset.offset, { x: 0, y: 0 });
  assert.equal(reset.position, settings.position);
  assert.equal(reset.flow, settings.flow);
  assert.equal(reset.gap, settings.gap);
  assert.equal(reset.color, settings.color);
  assert.equal(reset.opacity, settings.opacity);

  const history = makeController(createController, { persistent: false, durationMs: 3000 });
  press(history.controller, history.input, "A");
  const pendingBeforeDrag = history.timers.pending();
  drag.start({ pointerId: 10, screenX: 0, screenY: 0, offset: reset.offset });
  drag.move(10, 25, 40);
  drag.finish(10);
  assert.deepEqual(labels(history.controller), ["A"]);
  assert.equal(history.timers.pending(), pendingBeforeDrag);
}

function worldOrigin(layout) {
  return {
    x: layout.keyDisplayOriginX + layout.minX,
    y: layout.keyDisplayOriginY + layout.minY,
  };
}

function assertGapFromVisibleLine(layout, flow, gap) {
  const origin = {
    x: layout.keyDisplayOriginX,
    y: layout.keyDisplayOriginY,
  };
  if (flow === "up") {
    assert.equal(
      origin.y - (layout.keyDisplayY + layout.keyDisplayHeight),
      gap + 1,
    );
  } else if (flow === "down") {
    assert.equal(layout.keyDisplayY - origin.y, gap + 1);
  } else if (flow === "left") {
    assert.equal(
      origin.x - (layout.keyDisplayX + layout.keyDisplayWidth),
      gap + 28,
    );
  } else {
    assert.equal(layout.keyDisplayX - origin.x, gap + 28);
  }
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
