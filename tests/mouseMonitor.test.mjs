import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { createMouseInputRuntime } = await vite.ssrLoadModule(
    "/src/input/mouseRuntime.ts",
  );
  const { createMouseMonitorController } = await vite.ssrLoadModule(
    "/src/input/mouseMonitor.ts",
  );
  const { createKeyboardInputRuntime } = await vite.ssrLoadModule(
    "/src/input/keyboardRuntime.ts",
  );
  const { createKeyHistoryController } = await vite.ssrLoadModule(
    "/src/input/keyDisplay.ts",
  );
  const behavior = await vite.ssrLoadModule("/src/pet/behavior.ts");
  const { normalizeSettings } = await vite.ssrLoadModule(
    "/src/settings/settingsManager.ts",
  );

  testButtonState(createMouseInputRuntime);
  testScrollState(createMouseInputRuntime);
  await testMonitorLifecycle(
    createMouseInputRuntime,
    createMouseMonitorController,
  );
  testKeyboardIndependence(createMouseInputRuntime, createKeyboardInputRuntime);
  testNoHistoryOrBehaviorIntegration(
    createMouseInputRuntime,
    createKeyHistoryController,
    behavior,
  );
  testSettings(normalizeSettings);

  console.log("Mouse monitor tests passed.");
} finally {
  await vite.close();
}

function testButtonState(createRuntime) {
  const runtime = createRuntime();
  runtime.applyStatus({ status: "active" });

  assert.equal(runtime.applyEvent(buttonEvent("down", "left", 1)), true);
  assert.deepEqual(runtime.getSnapshot().pressedButtons, ["left"]);
  assert.equal(runtime.applyEvent(buttonEvent("down", "left", 2)), false);
  assert.deepEqual(runtime.getSnapshot().pressedButtons, ["left"]);

  for (const [index, button] of [
    "right",
    "middle",
    "mouse4",
    "mouse5",
  ].entries()) {
    assert.equal(
      runtime.applyEvent(buttonEvent("down", button, index + 3)),
      true,
    );
  }
  assert.deepEqual(runtime.getSnapshot().pressedButtons, [
    "left",
    "right",
    "middle",
    "mouse4",
    "mouse5",
  ]);

  assert.equal(runtime.applyEvent(buttonEvent("up", "left", 9)), true);
  assert.deepEqual(runtime.getSnapshot().pressedButtons, [
    "right",
    "middle",
    "mouse4",
    "mouse5",
  ]);
  assert.equal(runtime.getSnapshot().lastButton, "left");
  assert.equal(runtime.getSnapshot().lastActivityAt, 9);
  assert.equal(runtime.applyEvent(buttonEvent("up", "left", 10)), false);

  runtime.disable();
  assert.equal(runtime.getSnapshot().status, "disabled");
  assert.deepEqual(runtime.getSnapshot().pressedButtons, []);
}

function testScrollState(createRuntime) {
  const runtime = createRuntime();
  runtime.applyStatus({ status: "active" });

  assert.equal(runtime.applyEvent(scrollEvent("up", 11)), true);
  assert.equal(runtime.getSnapshot().lastScrollDirection, "up");
  assert.equal(runtime.getSnapshot().lastScrollAt, 11);
  assert.equal(runtime.applyEvent(scrollEvent("down", 12)), true);
  assert.equal(runtime.getSnapshot().lastScrollDirection, "down");
  assert.equal(runtime.getSnapshot().lastActivityAt, 12);
  assert.deepEqual(runtime.getSnapshot().pressedButtons, []);
}

async function testMonitorLifecycle(createRuntime, createController) {
  let startCalls = 0;
  let stopCalls = 0;
  const runtime = createRuntime();
  const controller = createController({
    async start() {
      startCalls += 1;
      return { status: "active" };
    },
    async stop() {
      stopCalls += 1;
      return { status: "disabled" };
    },
  }, runtime);

  await Promise.all([controller.start(), controller.start()]);
  assert.equal(startCalls, 1);
  controller.handleNativeEvent(buttonEvent("down", "right", 20));
  await controller.stop();
  assert.equal(stopCalls, 1);
  assert.deepEqual(runtime.getSnapshot().pressedButtons, []);

  const unrelatedRuntime = { keyboardStatus: "active" };
  const errorController = createController({
    async start() {
      throw new Error("mouse listener unavailable");
    },
    async stop() {
      return { status: "disabled" };
    },
  }, createRuntime());
  await errorController.start();
  assert.equal(errorController.runtime.getSnapshot().status, "error");
  assert.equal(unrelatedRuntime.keyboardStatus, "active");
}

function testKeyboardIndependence(createMouseRuntime, createKeyboardRuntime) {
  const keyboard = createKeyboardRuntime();
  const mouse = createMouseRuntime();
  keyboard.applyStatus({ status: "active" });
  mouse.applyStatus({ status: "active" });
  keyboard.applyEvent({ eventType: "down", key: "A", timestamp: 30 });
  mouse.applyEvent(buttonEvent("down", "left", 31));

  mouse.disable();
  assert.deepEqual(keyboard.getSnapshot().pressedKeys, ["A"]);
  assert.equal(keyboard.getSnapshot().status, "active");

  mouse.applyStatus({ status: "active" });
  mouse.applyEvent(buttonEvent("down", "right", 32));
  keyboard.disable();
  assert.deepEqual(mouse.getSnapshot().pressedButtons, ["right"]);
  assert.equal(mouse.getSnapshot().status, "active");
}

function testNoHistoryOrBehaviorIntegration(
  createMouseRuntime,
  createHistory,
  behavior,
) {
  const history = createHistory();
  history.update({
    keyboardEnabled: true,
    keyDisplayEnabled: true,
    keyboardStatus: "active",
    pressedKeys: [],
    maxItems: 4,
    durationMs: 3000,
    persistent: true,
  });
  const beforeHistory = history.getSnapshot();
  const beforeBehaviorRequests = behavior.activeRequests.value.length;

  const mouse = createMouseRuntime();
  mouse.applyStatus({ status: "active" });
  mouse.applyEvent(buttonEvent("down", "left", 40));
  mouse.applyEvent(scrollEvent("up", 41));

  assert.deepEqual(history.getSnapshot(), beforeHistory);
  assert.equal(behavior.activeRequests.value.length, beforeBehaviorRequests);
  assert.equal(
    behavior.activeRequests.value.some(({ source }) => source === "input.mouse"),
    false,
  );
  assert.equal(behavior.effectiveState.value, "idle");

  const snapshotKeys = Object.keys(mouse.getSnapshot()).sort();
  assert.equal(snapshotKeys.includes("history"), false);
  assert.equal(snapshotKeys.includes("x"), false);
  assert.equal(snapshotKeys.includes("y"), false);
  history.dispose();
}

function testSettings(normalizeSettings) {
  assert.equal(normalizeSettings({}).input.mouseEnabled, false);
  assert.equal(
    normalizeSettings({ input: { keyboardEnabled: true, mouseEnabled: false } })
      .input.keyboardEnabled,
    true,
  );
  assert.equal(
    normalizeSettings({ input: { keyboardEnabled: false, mouseEnabled: true } })
      .input.mouseEnabled,
    true,
  );
}

function buttonEvent(eventType, button, timestamp) {
  return { eventType, button, timestamp };
}

function scrollEvent(scrollDirection, timestamp) {
  return { eventType: "scroll", scrollDirection, timestamp };
}
