import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { createKeyboardMonitorController } = await vite.ssrLoadModule(
    "/src/input/keyboardMonitor.ts",
  );
  const { createMouseMonitorController } = await vite.ssrLoadModule(
    "/src/input/mouseMonitor.ts",
  );
  const { createKeyboardInputRuntime } = await vite.ssrLoadModule(
    "/src/input/keyboardRuntime.ts",
  );
  const { createMouseInputRuntime } = await vite.ssrLoadModule(
    "/src/input/mouseRuntime.ts",
  );
  const { createKeyHistoryController } = await vite.ssrLoadModule(
    "/src/input/keyDisplay.ts",
  );
  const { createKeyboardActivityBehaviorController } = await vite.ssrLoadModule(
    "/src/input/keyboardActivityBehavior.ts",
  );
  const { createMouseVisualizerController } = await vite.ssrLoadModule(
    "/src/input/mouseVisualizer.ts",
  );
  const { calculatePetWindowLayout } = await vite.ssrLoadModule(
    "/src/pet/windowLayout.ts",
  );
  const { normalizeSettings } = await vite.ssrLoadModule(
    "/src/settings/settingsManager.ts",
  );

  await testSharedNativeLifecycle(
    createKeyboardMonitorController,
    createMouseMonitorController,
  );
  testKeyboardCleanupAndVisibility(
    createKeyboardInputRuntime,
    createKeyHistoryController,
    createKeyboardActivityBehaviorController,
  );
  testMouseCleanupAndVisibility(
    createMouseInputRuntime,
    createMouseVisualizerController,
  );
  testPermissionAndErrorCleanup(
    createKeyboardInputRuntime,
    createMouseInputRuntime,
  );
  testIndependentLayoutOffsets(calculatePetWindowLayout);
  testRuntimeInputIsNotPersisted(normalizeSettings);

  console.log("Input integration tests passed.");
} finally {
  await vite.close();
}

async function testSharedNativeLifecycle(createKeyboard, createMouse) {
  const shared = createSharedNativeAdapter();
  const keyboard = createKeyboard(shared.adapter("keyboard"));
  const mouse = createMouse(shared.adapter("mouse"));

  await keyboard.start();
  assert.deepEqual(shared.snapshot(), {
    keyboard: true,
    mouse: false,
    listenerRunning: true,
    starts: 1,
    stops: 0,
  });

  await mouse.start();
  assert.equal(shared.snapshot().starts, 1);
  assert.equal(shared.snapshot().listenerRunning, true);

  await keyboard.stop();
  assert.equal(shared.snapshot().keyboard, false);
  assert.equal(shared.snapshot().mouse, true);
  assert.equal(shared.snapshot().listenerRunning, true);
  assert.equal(shared.snapshot().stops, 0);

  await keyboard.start();
  await mouse.stop();
  assert.equal(shared.snapshot().keyboard, true);
  assert.equal(shared.snapshot().mouse, false);
  assert.equal(shared.snapshot().listenerRunning, true);
  assert.equal(shared.snapshot().stops, 0);

  await mouse.start();
  await keyboard.stop();
  await mouse.stop();
  assert.equal(shared.snapshot().listenerRunning, false);
  assert.equal(shared.snapshot().starts, 1);
  assert.equal(shared.snapshot().stops, 1);
}

function testKeyboardCleanupAndVisibility(
  createRuntime,
  createHistory,
  createActivity,
) {
  const timers = createFakeTimers();
  const requests = [];
  const releases = [];
  const runtime = createRuntime();
  const history = createHistory({
    now: timers.now,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const activity = createActivity({
    requestBehavior: (request) => requests.push(request),
    releaseBehavior: (source) => releases.push(source),
    now: timers.now,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  runtime.applyStatus({ status: "active" });
  runtime.applyEvent({ eventType: "down", key: "A", timestamp: 10 });
  const snapshot = runtime.getSnapshot();
  history.update(historyInput(snapshot, true));
  activity.update(activityInput(snapshot, true));
  assert.equal(history.getSnapshot().entries.length, 1);
  assert.deepEqual(requests, [{ source: "input.keyboard", state: "working" }]);

  history.update(historyInput(snapshot, false));
  assert.equal(history.getSnapshot().entries.length, 0);
  assert.equal(activity.isActive(), true);

  runtime.disable();
  const disabled = runtime.getSnapshot();
  history.update(historyInput(disabled, true, false));
  activity.update(activityInput(disabled, false));
  assert.deepEqual(disabled.pressedKeys, []);
  assert.equal(history.getSnapshot().entries.length, 0);
  assert.equal(activity.isActive(), false);
  assert.deepEqual(releases, ["input.keyboard"]);
  assert.equal(timers.pending(), 0);

  history.dispose();
  activity.dispose();
}

function testMouseCleanupAndVisibility(createRuntime, createVisualizer) {
  const timers = createFakeTimers();
  const runtime = createRuntime();
  const visualizer = createVisualizer({
    now: timers.now,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  runtime.applyStatus({ status: "active" });
  runtime.applyEvent({ eventType: "down", button: "left", timestamp: 20 });
  runtime.applyEvent({ eventType: "scroll", scrollDirection: "up", timestamp: 21 });

  visualizer.update(mouseVisualizerInput(runtime.getSnapshot(), false));
  assert.equal(visualizer.getSnapshot().visible, false);
  assert.deepEqual(runtime.getSnapshot().pressedButtons, ["left"]);

  visualizer.update(mouseVisualizerInput(runtime.getSnapshot(), true));
  runtime.applyEvent({
    eventType: "scroll",
    scrollDirection: "down",
    timestamp: timers.now(),
  });
  visualizer.update(mouseVisualizerInput(runtime.getSnapshot(), true));
  assert.equal(visualizer.getSnapshot().scrollDirection, "down");
  assert.equal(timers.pending(), 1);

  runtime.disable();
  visualizer.update(mouseVisualizerInput(runtime.getSnapshot(), true, false));
  assert.deepEqual(runtime.getSnapshot().pressedButtons, []);
  assert.equal(runtime.getSnapshot().lastScrollDirection, undefined);
  assert.equal(visualizer.getSnapshot().visible, false);
  assert.equal(visualizer.getSnapshot().scrollDirection, undefined);
  assert.equal(timers.pending(), 0);
  visualizer.dispose();
}

function testPermissionAndErrorCleanup(createKeyboard, createMouse) {
  const keyboard = createKeyboard();
  keyboard.applyStatus({ status: "active" });
  keyboard.applyEvent({ eventType: "down", key: "Shift", timestamp: 30 });
  keyboard.applyStatus({ status: "permission-required" });
  assert.deepEqual(keyboard.getSnapshot().pressedKeys, []);

  const mouse = createMouse();
  mouse.applyStatus({ status: "active" });
  mouse.applyEvent({ eventType: "down", button: "right", timestamp: 31 });
  mouse.applyEvent({ eventType: "scroll", scrollDirection: "down", timestamp: 32 });
  mouse.applyStatus({ status: "error", message: "test" });
  assert.deepEqual(mouse.getSnapshot().pressedButtons, []);
  assert.equal(mouse.getSnapshot().lastScrollDirection, undefined);
  assert.equal(mouse.getSnapshot().lastScrollAt, undefined);
}

function testIndependentLayoutOffsets(calculateLayout) {
  const base = layoutInput();
  const original = calculateLayout(base);
  const movedKeyboard = calculateLayout({
    ...base,
    keyDisplayOffsetX: 60,
    keyDisplayOffsetY: -25,
  });
  assert.deepEqual(worldMouse(movedKeyboard), worldMouse(original));
  assert.deepEqual(worldBubble(movedKeyboard), worldBubble(original));
  assert.deepEqual(worldPet(movedKeyboard), worldPet(original));

  const movedMouse = calculateLayout({
    ...base,
    mouseVisualizerOffsetX: -45,
    mouseVisualizerOffsetY: 30,
  });
  assert.deepEqual(worldKeyOrigin(movedMouse), worldKeyOrigin(original));
  assert.deepEqual(worldBubble(movedMouse), worldBubble(original));
  assert.deepEqual(worldPet(movedMouse), worldPet(original));

  const movedStatus = calculateLayout({ ...base, offsetX: 280, offsetY: -90 });
  assert.deepEqual(worldKeyOrigin(movedStatus), worldKeyOrigin(original));
  assert.deepEqual(worldMouse(movedStatus), worldMouse(original));
  assert.deepEqual(worldPet(movedStatus), worldPet(original));

  for (const point of [
    [original.petX, original.petY],
    [original.bubbleX, original.bubbleY],
    [original.keyDisplayX, original.keyDisplayY],
    [original.mouseVisualizerX, original.mouseVisualizerY],
  ]) {
    assert.ok(point[0] >= 0 && point[1] >= 0);
  }
}

function testRuntimeInputIsNotPersisted(normalizeSettings) {
  const settings = normalizeSettings({
    input: {
      keyboardEnabled: true,
      mouseEnabled: true,
      keyDisplayDistancePx: 200,
      pressedKeys: ["A"],
      keyHistory: [{ label: "A" }],
      pressedButtons: ["left"],
      mouseHistory: [{ button: "left" }],
      lastScrollDirection: "up",
    },
  });
  const serialized = JSON.stringify(settings);
  for (const forbidden of [
    "keyDisplayDistancePx",
    "pressedKeys",
    "keyHistory",
    "pressedButtons",
    "mouseHistory",
    "lastScrollDirection",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
}

function createSharedNativeAdapter() {
  const state = {
    keyboard: false,
    mouse: false,
    listenerRunning: false,
    starts: 0,
    stops: 0,
  };
  return {
    adapter(channel) {
      return {
        async start() {
          state[channel] = true;
          if (!state.listenerRunning) {
            state.listenerRunning = true;
            state.starts += 1;
          }
          return { status: "active" };
        },
        async stop() {
          state[channel] = false;
          if (!state.keyboard && !state.mouse && state.listenerRunning) {
            state.listenerRunning = false;
            state.stops += 1;
          }
          return { status: "disabled" };
        },
      };
    },
    snapshot: () => ({ ...state }),
  };
}

function historyInput(snapshot, displayEnabled, keyboardEnabled = true) {
  return {
    keyboardEnabled,
    keyDisplayEnabled: displayEnabled,
    keyboardStatus: snapshot.status,
    pressedKeys: snapshot.pressedKeys,
    maxItems: 4,
    durationMs: 3000,
    persistent: false,
  };
}

function activityInput(snapshot, keyboardEnabled) {
  return {
    keyboardEnabled,
    keyboardStatus: snapshot.status,
    pressedKeys: snapshot.pressedKeys,
    lastActivityAt: snapshot.lastActivityAt,
  };
}

function mouseVisualizerInput(snapshot, visualizerEnabled, mouseEnabled = true) {
  return {
    mouseEnabled,
    visualizerEnabled,
    mouseStatus: snapshot.status,
    pressedButtons: snapshot.pressedButtons,
    lastScrollDirection: snapshot.lastScrollDirection,
    lastScrollAt: snapshot.lastScrollAt,
  };
}

function layoutInput() {
  return {
    displayMode: "both",
    petScale: 1,
    bubbleWidth: 184,
    bubbleHeight: 260,
    offsetX: 210,
    offsetY: 15,
    keyDisplayVisible: true,
    keyDisplayPosition: "bottom",
    keyDisplayFlowDirection: "right",
    keyDisplayMaxItems: 4,
    keyDisplayOffsetX: 12,
    keyDisplayOffsetY: 8,
    keyDisplayStartLineGapPx: 8,
    mouseVisualizerVisible: true,
    mouseVisualizerPosition: "left",
    mouseVisualizerOffsetX: -10,
    mouseVisualizerOffsetY: 18,
  };
}

function worldPet(layout) {
  return { x: layout.minX + layout.petX, y: layout.minY + layout.petY };
}

function worldBubble(layout) {
  return { x: layout.minX + layout.bubbleX, y: layout.minY + layout.bubbleY };
}

function worldKeyOrigin(layout) {
  return {
    x: layout.minX + layout.keyDisplayOriginX,
    y: layout.minY + layout.keyDisplayOriginY,
  };
}

function worldMouse(layout) {
  return {
    x: layout.minX + layout.mouseVisualizerX,
    y: layout.minY + layout.mouseVisualizerY,
  };
}

function createFakeTimers() {
  let currentTime = 100;
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
  };
}
