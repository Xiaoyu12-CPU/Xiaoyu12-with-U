import assert from "node:assert/strict";
import { createServer } from "vite";

globalThis.window = new EventTarget();
globalThis.localStorage = {
  getItem() {
    return null;
  },
  setItem() {},
};

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const {
    createTypingFeedbackController,
    createTypingMetrics,
  } = await vite.ssrLoadModule("/src/input/typingFeedback.ts");
  const {
    createTypingFeedbackRuntimeController,
  } = await vite.ssrLoadModule("/src/input/typingFeedbackRuntime.ts");
  const {
    createKeyboardMonitorController,
    isTypingActivityEvent,
  } = await vite.ssrLoadModule("/src/input/keyboardMonitor.ts");
  const { createKeyboardInputRuntime } = await vite.ssrLoadModule(
    "/src/input/keyboardRuntime.ts",
  );
  const { createMouseInputRuntime } = await vite.ssrLoadModule(
    "/src/input/mouseRuntime.ts",
  );
  const { useDialogue } = await vite.ssrLoadModule("/src/pet/dialogue.ts");
  const { normalizeSettings } = await vite.ssrLoadModule(
    "/src/settings/settingsManager.ts",
  );
  const { DEFAULT_SETTINGS } = await vite.ssrLoadModule(
    "/src/settings/defaultSettings.ts",
  );

  testSettings(normalizeSettings, DEFAULT_SETTINGS);
  testAcceptedTypingInput(
    createKeyboardInputRuntime,
    createKeyboardMonitorController,
    isTypingActivityEvent,
  );
  testBusyRollingAndLatch(createTypingMetrics);
  testSpeedRollingAndLatch(createTypingMetrics);
  testConfigResetRules(createTypingMetrics);
  testEnabledRules(createTypingMetrics);
  testBusyWins(createTypingFeedbackController);
  testSharedCooldown(createTypingFeedbackController);
  testTextOnlyConfigChange(createTypingFeedbackController);
  testRuntimeCleanup(createTypingFeedbackRuntimeController);
  testMouseIsolation(createMouseInputRuntime, createTypingFeedbackRuntimeController);
  testDialoguePriority(useDialogue, createTypingFeedbackController);

  console.log("Typing feedback tests passed.");
} finally {
  await vite.close();
  delete globalThis.window;
  delete globalThis.localStorage;
}

function testSettings(normalizeSettings, defaults) {
  const missing = normalizeSettings({});
  assert.equal(missing.input.typingBusyEnabled, true);
  assert.equal(missing.input.typingBusyWindowSeconds, 120);
  assert.equal(missing.input.typingBusyCountThreshold, 200);
  assert.equal(missing.input.typingBusyText, "键盘好忙呀");
  assert.equal(missing.input.typingSpeedEnabled, true);
  assert.equal(missing.input.typingSpeedThresholdPerSecond, 5);
  assert.equal(missing.input.typingSpeedText, "打字速度起飞了！");
  assert.equal(missing.input.typingFeedbackCooldownSeconds, 10);

  const normalized = normalizeSettings({
    input: {
      typingBusyWindowSeconds: 2,
      typingBusyCountThreshold: 9000,
      typingBusyText: "  Busy Test  ",
      typingSpeedThresholdPerSecond: 99,
      typingSpeedText: "   ",
      typingFeedbackCooldownSeconds: 0,
    },
  });
  assert.equal(normalized.input.typingBusyWindowSeconds, 10);
  assert.equal(normalized.input.typingBusyCountThreshold, 5000);
  assert.equal(normalized.input.typingBusyText, "Busy Test");
  assert.equal(normalized.input.typingSpeedThresholdPerSecond, 30);
  assert.equal(
    normalized.input.typingSpeedText,
    defaults.input.typingSpeedText,
  );
  assert.equal(normalized.input.typingFeedbackCooldownSeconds, 1);
  assert.equal(normalizeSettings({ input: {
    typingFeedbackCooldownSeconds: 700,
  } }).input.typingFeedbackCooldownSeconds, 600);
  assert.equal(normalizeSettings({ input: {
    typingFeedbackCooldownSeconds: Number.NaN,
  } }).input.typingFeedbackCooldownSeconds, 10);
}

function testAcceptedTypingInput(createRuntime, createMonitor, isTypingEvent) {
  assert.equal(isTypingEvent(keyEvent("down", "A", 1)), true);
  assert.equal(isTypingEvent(keyEvent("up", "A", 2)), false);
  for (const modifier of ["Shift", "Control", "Option", "Command"]) {
    assert.equal(isTypingEvent(keyEvent("down", modifier, 3)), false);
  }

  const timestamps = [];
  const runtime = createRuntime();
  runtime.applyStatus({ status: "active" });
  const controller = createMonitor(noopAdapter(), runtime, {
    onTypingActivity(timestamp) {
      timestamps.push(timestamp);
    },
  });

  controller.handleNativeEvent(keyEvent("down", "A", 10));
  controller.handleNativeEvent(keyEvent("down", "A", 11));
  controller.handleNativeEvent(keyEvent("up", "A", 12));
  controller.handleNativeEvent(keyEvent("down", "Shift", 13));
  controller.handleNativeEvent(keyEvent("down", "B", 14));
  controller.handleNativeEvent(keyEvent("up", "B", 15));
  controller.handleNativeEvent(keyEvent("up", "Shift", 16));
  controller.handleNativeEvent(keyEvent("down", "Command", 17));
  controller.handleNativeEvent(keyEvent("down", "C", 18));
  controller.handleNativeEvent(keyEvent("up", "C", 19));
  controller.handleNativeEvent(keyEvent("up", "Command", 20));

  assert.deepEqual(timestamps, [10, 14, 18]);
}

function testBusyRollingAndLatch(createMetrics) {
  const metrics = createMetrics(metricsConfig({ speedEnabled: false }));
  let result;
  for (let index = 0; index < 199; index += 1) {
    result = metrics.recordTypingActivity(index);
  }
  assert.equal(result.busyTriggered, false);
  result = metrics.recordTypingActivity(199);
  assert.equal(result.busyTriggered, true);
  assert.equal(result.busyCount, 200);
  assert.equal(metrics.recordTypingActivity(200).busyTriggered, false);

  result = metrics.recordTypingActivity(120_200);
  assert.equal(result.busyTriggered, false);
  assert.equal(metrics.getSnapshot().busyLatched, false);
  for (let index = 1; index < 200; index += 1) {
    result = metrics.recordTypingActivity(120_200 + index);
  }
  assert.equal(result.busyTriggered, true);

  const rolling = createMetrics(metricsConfig({
    busyWindowSeconds: 10,
    busyCountThreshold: 3,
    speedEnabled: false,
  }));
  rolling.recordTypingActivity(0);
  rolling.recordTypingActivity(1_000);
  assert.equal(rolling.recordTypingActivity(10_001).busyTriggered, false);
  assert.equal(rolling.recordTypingActivity(10_002).busyTriggered, true);
}

function testSpeedRollingAndLatch(createMetrics) {
  const metrics = createMetrics(metricsConfig({ busyEnabled: false }));
  for (let index = 0; index < 4; index += 1) {
    assert.equal(metrics.recordTypingActivity(index * 100).speedTriggered, false);
  }
  assert.equal(metrics.recordTypingActivity(400).speedTriggered, true);
  assert.equal(metrics.recordTypingActivity(500).speedTriggered, false);
  assert.equal(metrics.recordTypingActivity(2_000).speedTriggered, false);
  assert.equal(metrics.getSnapshot().speedLatched, false);
  for (let index = 1; index < 5; index += 1) {
    const result = metrics.recordTypingActivity(2_000 + index * 100);
    assert.equal(result.speedTriggered, index === 4);
  }
}

function testConfigResetRules(createMetrics) {
  const initial = metricsConfig({ busyCountThreshold: 10 });
  const metrics = createMetrics(initial);
  metrics.recordTypingActivity(1);
  assert.equal(metrics.getSnapshot().timestamps.length, 1);
  metrics.updateConfig({ ...initial, busyCountThreshold: 11 });
  assert.equal(metrics.getSnapshot().timestamps.length, 0);

  metrics.recordTypingActivity(2);
  metrics.updateConfig({ ...initial, busyWindowSeconds: 121 });
  assert.equal(metrics.getSnapshot().timestamps.length, 0);

  metrics.recordTypingActivity(3);
  metrics.updateConfig({ ...initial, speedThresholdPerSecond: 6 });
  assert.equal(metrics.getSnapshot().timestamps.length, 0);

  const enabled = createMetrics(initial);
  enabled.recordTypingActivity(4);
  enabled.updateConfig({ ...initial, busyEnabled: false });
  assert.equal(enabled.getSnapshot().timestamps.length, 1);
  assert.equal(enabled.getSnapshot().busyLatched, false);
  enabled.updateConfig({ ...initial, busyEnabled: false, speedEnabled: false });
  assert.equal(enabled.getSnapshot().timestamps.length, 0);
  assert.ok(enabled.getSnapshot().timestamps.every(Number.isFinite));
  assert.equal(JSON.stringify(enabled.getSnapshot()).includes("A"), false);
}

function testEnabledRules(createMetrics) {
  const busyDisabled = createMetrics(metricsConfig({
    busyEnabled: false,
    speedThresholdPerSecond: 2,
  }));
  busyDisabled.recordTypingActivity(0);
  const speedOnly = busyDisabled.recordTypingActivity(1);
  assert.equal(speedOnly.busyTriggered, false);
  assert.equal(speedOnly.speedTriggered, true);

  const speedDisabled = createMetrics(metricsConfig({
    busyCountThreshold: 2,
    speedEnabled: false,
  }));
  speedDisabled.recordTypingActivity(0);
  const busyOnly = speedDisabled.recordTypingActivity(1);
  assert.equal(busyOnly.busyTriggered, true);
  assert.equal(busyOnly.speedTriggered, false);

  const bothDisabled = createMetrics(metricsConfig({
    busyEnabled: false,
    speedEnabled: false,
  }));
  assert.deepEqual(bothDisabled.recordTypingActivity(1), {
    busyTriggered: false,
    speedTriggered: false,
    busyCount: 0,
    speedCount: 0,
  });
  assert.equal(bothDisabled.getSnapshot().timestamps.length, 0);
}

function testBusyWins(createController) {
  const shown = [];
  const controller = createController(feedbackConfig({
    busyCountThreshold: 5,
    speedThresholdPerSecond: 5,
  }), {
    showFeedback(kind, text) {
      shown.push({ kind, text });
      return true;
    },
  });
  for (let index = 0; index < 5; index += 1) {
    controller.recordTypingActivity(index * 100);
  }
  assert.deepEqual(shown, [{ kind: "busy", text: "Busy" }]);
  assert.equal(controller.getMetricsSnapshot().busyLatched, true);
  assert.equal(controller.getMetricsSnapshot().speedLatched, true);

  let attempts = 0;
  const suppressed = createController(feedbackConfig({
    busyCountThreshold: 5,
    speedThresholdPerSecond: 5,
  }), {
    showFeedback(kind) {
      attempts += 1;
      assert.equal(kind, "busy");
      return false;
    },
  });
  for (let index = 0; index < 5; index += 1) {
    suppressed.recordTypingActivity(index * 100);
  }
  assert.equal(attempts, 1);
  assert.equal(suppressed.getLastTypingFeedbackAt(), undefined);
}

function testSharedCooldown(createController) {
  const shown = [];
  const speedThenBusy = createController(feedbackConfig({
    busyCountThreshold: 3,
    speedThresholdPerSecond: 2,
  }), {
    showFeedback(kind) {
      shown.push(kind);
      return true;
    },
  });
  speedThenBusy.recordTypingActivity(0);
  assert.equal(speedThenBusy.recordTypingActivity(1).shown, true);
  const busyAttempt = speedThenBusy.recordTypingActivity(2);
  assert.deepEqual(busyAttempt, {
    kind: "busy",
    text: "Busy",
    shown: false,
    reason: "cooldown",
  });
  assert.deepEqual(shown, ["speed"]);

  const reverseShown = [];
  const busyThenSpeed = createController(feedbackConfig({
    busyCountThreshold: 2,
    speedThresholdPerSecond: 3,
  }), {
    showFeedback(kind) {
      reverseShown.push(kind);
      return true;
    },
  });
  busyThenSpeed.recordTypingActivity(0);
  assert.equal(busyThenSpeed.recordTypingActivity(1).kind, "busy");
  busyThenSpeed.recordTypingActivity(2_000);
  busyThenSpeed.recordTypingActivity(2_100);
  assert.equal(busyThenSpeed.recordTypingActivity(2_200).reason, "cooldown");
  assert.deepEqual(reverseShown, ["busy"]);

  const replayCalls = [];
  const noReplay = createController(feedbackConfig({
    busyEnabled: false,
    speedThresholdPerSecond: 2,
  }), {
    showFeedback(kind) {
      replayCalls.push(kind);
      return true;
    },
  });
  noReplay.recordTypingActivity(0);
  noReplay.recordTypingActivity(100);
  noReplay.recordTypingActivity(2_000);
  assert.equal(noReplay.recordTypingActivity(2_100).reason, "cooldown");
  assert.deepEqual(replayCalls, ["speed"]);
  noReplay.recordTypingActivity(12_000);
  assert.deepEqual(replayCalls, ["speed"]);
  assert.equal(noReplay.recordTypingActivity(12_100).shown, true);
  assert.deepEqual(replayCalls, ["speed", "speed"]);

  const dynamic = createController(feedbackConfig({
    busyEnabled: false,
    speedThresholdPerSecond: 2,
  }), { showFeedback: () => true });
  dynamic.recordTypingActivity(0);
  dynamic.recordTypingActivity(100);
  dynamic.recordTypingActivity(2_000);
  dynamic.updateConfig(feedbackConfig({
    busyEnabled: false,
    speedThresholdPerSecond: 2,
    cooldownSeconds: 1,
  }));
  assert.equal(dynamic.recordTypingActivity(2_100).shown, true);
}

function testTextOnlyConfigChange(createController) {
  const shown = [];
  const initial = feedbackConfig({
    busyEnabled: false,
    speedThresholdPerSecond: 3,
  });
  const controller = createController(initial, {
    showFeedback(kind, text) {
      shown.push({ kind, text });
      return true;
    },
  });
  controller.recordTypingActivity(0);
  controller.updateConfig({
    ...initial,
    speedText: "  New Speed Text  ",
    cooldownSeconds: 60,
  });
  assert.equal(controller.getMetricsSnapshot().timestamps.length, 1);
  controller.recordTypingActivity(100);
  controller.recordTypingActivity(200);
  assert.deepEqual(shown, [{ kind: "speed", text: "New Speed Text" }]);
}

function testRuntimeCleanup(createRuntimeController) {
  const config = feedbackConfig({
    busyEnabled: false,
    speedThresholdPerSecond: 2,
  });
  const runtime = createRuntimeController(config, () => true);
  runtime.update({ keyboardEnabled: true, keyboardStatus: "active", config });
  runtime.recordTypingActivity(0);
  runtime.recordTypingActivity(1);
  assert.equal(runtime.feedback.getLastTypingFeedbackAt(), 1);

  runtime.update({ keyboardEnabled: false, keyboardStatus: "active", config });
  assert.equal(runtime.feedback.getMetricsSnapshot().timestamps.length, 0);
  assert.equal(runtime.feedback.getLastTypingFeedbackAt(), undefined);
  runtime.recordTypingActivity(2);
  assert.equal(runtime.feedback.getMetricsSnapshot().timestamps.length, 0);

  runtime.update({ keyboardEnabled: true, keyboardStatus: "active", config });
  runtime.recordTypingActivity(3);
  assert.equal(runtime.feedback.getMetricsSnapshot().timestamps.length, 1);
  for (const status of ["permission-required", "error", "unsupported", "disabled"]) {
    runtime.update({ keyboardEnabled: true, keyboardStatus: status, config });
    assert.equal(runtime.feedback.getMetricsSnapshot().timestamps.length, 0);
    assert.equal(runtime.feedback.getLastTypingFeedbackAt(), undefined);
  }
}

function testMouseIsolation(createMouseRuntime, createTypingRuntime) {
  const config = feedbackConfig({
    busyEnabled: false,
    speedThresholdPerSecond: 1,
  });
  let feedbackCount = 0;
  const typing = createTypingRuntime(config, () => {
    feedbackCount += 1;
    return true;
  });
  typing.update({ keyboardEnabled: true, keyboardStatus: "active", config });
  const mouse = createMouseRuntime();
  mouse.applyStatus({ status: "active" });
  mouse.applyEvent({ eventType: "down", button: "left", timestamp: 1 });
  mouse.applyEvent({ eventType: "up", button: "left", timestamp: 2 });
  mouse.applyEvent({ eventType: "scroll", scrollDirection: "up", timestamp: 3 });
  assert.equal(typing.feedback.getMetricsSnapshot().timestamps.length, 0);
  assert.equal(feedbackCount, 0);
}

function testDialoguePriority(useDialogue, createController) {
  const dialogue = useDialogue({
    displayDurationMs: 60_000,
    catalog: {
      click: ["Normal"],
      reminder: ["Reminder"],
      "input.keyboard.speed": ["Low"],
    },
  });

  assert.equal(dialogue.notify({ type: "click" }), true);
  assert.equal(dialogue.currentPriority.value, "normal");
  assert.equal(dialogue.notify({
    type: "input.keyboard.speed",
    priority: "low",
  }), false);
  assert.equal(dialogue.currentText.value, "Normal");

  const suppressedController = createController(feedbackConfig({
    busyEnabled: false,
    speedThresholdPerSecond: 1,
  }), {
    showFeedback(_kind, text) {
      return dialogue.notify({
        type: "input.keyboard.speed",
        textOverride: text,
        priority: "low",
      });
    },
  });
  assert.equal(suppressedController.recordTypingActivity(1).shown, false);
  assert.equal(suppressedController.getLastTypingFeedbackAt(), undefined);

  dialogue.hide();
  assert.equal(suppressedController.recordTypingActivity(2_000).shown, true);
  assert.equal(suppressedController.getLastTypingFeedbackAt(), 2_000);
  dialogue.hide();
  assert.equal(dialogue.notify({
    type: "input.keyboard.speed",
    textOverride: "Low",
    priority: "low",
  }), true);
  assert.equal(dialogue.currentPriority.value, "low");
  assert.equal(dialogue.notify({ type: "click", textOverride: "Normal 2" }), true);
  assert.equal(dialogue.currentText.value, "Normal 2");

  dialogue.hide();
  dialogue.notify({
    type: "input.keyboard.speed",
    textOverride: "Low again",
    priority: "low",
  });
  assert.equal(dialogue.notify({
    type: "reminder",
    textOverride: "Protected",
    persistent: true,
  }), true);
  assert.equal(dialogue.currentPriority.value, "protected");
  assert.equal(dialogue.notify({ type: "click", textOverride: "Blocked" }), false);
  assert.equal(dialogue.notify({
    type: "input.keyboard.speed",
    textOverride: "Blocked Low",
    priority: "low",
  }), false);
  assert.equal(dialogue.currentText.value, "Protected");
  dialogue.dispose();
}

function metricsConfig(overrides = {}) {
  return {
    busyEnabled: true,
    busyWindowSeconds: 120,
    busyCountThreshold: 200,
    speedEnabled: true,
    speedThresholdPerSecond: 5,
    ...overrides,
  };
}

function feedbackConfig(overrides = {}) {
  return {
    ...metricsConfig(),
    busyText: "Busy",
    speedText: "Speed",
    cooldownSeconds: 10,
    ...overrides,
  };
}

function keyEvent(eventType, key, timestamp) {
  return { eventType, key, timestamp };
}

function noopAdapter() {
  return {
    async start() {
      return { status: "active" };
    },
    async stop() {
      return { status: "disabled" };
    },
  };
}
