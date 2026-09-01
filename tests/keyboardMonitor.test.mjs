import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { createKeyboardInputRuntime } = await vite.ssrLoadModule(
    "/src/input/keyboardRuntime.ts",
  );
  const { createKeyboardMonitorController } = await vite.ssrLoadModule(
    "/src/input/keyboardMonitor.ts",
  );

  const updates = [];
  const runtime = createKeyboardInputRuntime((snapshot) => updates.push(snapshot));
  runtime.applyStatus({ status: "active" });

  assert.equal(runtime.applyEvent(keyEvent("down", "A", 1)), true);
  assert.deepEqual(runtime.getSnapshot().pressedKeys, ["A"]);
  assert.equal(runtime.applyEvent(keyEvent("down", "A", 2)), false);
  assert.deepEqual(runtime.getSnapshot().pressedKeys, ["A"]);
  assert.equal(runtime.applyEvent(keyEvent("up", "A", 3)), true);
  assert.deepEqual(runtime.getSnapshot().pressedKeys, []);

  runtime.applyEvent(keyEvent("down", "Shift", 4));
  runtime.applyEvent(keyEvent("down", "Command", 5));
  assert.deepEqual(runtime.getSnapshot().pressedKeys, ["Shift", "Command"]);
  runtime.applyEvent(keyEvent("up", "Shift", 6));
  runtime.applyEvent(keyEvent("up", "Command", 7));
  assert.deepEqual(runtime.getSnapshot().pressedKeys, []);

  runtime.applyEvent(keyEvent("down", "Unknown(999)", 8));
  assert.equal(runtime.getSnapshot().lastKey, "Unknown(999)");
  runtime.disable();
  assert.equal(runtime.getSnapshot().status, "disabled");
  assert.deepEqual(runtime.getSnapshot().pressedKeys, []);
  assert.equal(runtime.applyEvent(keyEvent("down", "B", 9)), false);

  let startCalls = 0;
  let stopCalls = 0;
  const controllerRuntime = createKeyboardInputRuntime();
  const controller = createKeyboardMonitorController({
    async start() {
      startCalls += 1;
      return { status: "active" };
    },
    async stop() {
      stopCalls += 1;
      return { status: "disabled" };
    },
  }, controllerRuntime);
  await Promise.all([controller.start(), controller.start()]);
  assert.equal(startCalls, 1);
  assert.equal(controllerRuntime.getSnapshot().status, "active");
  await controller.stop();
  assert.equal(stopCalls, 1);
  assert.equal(controllerRuntime.getSnapshot().status, "disabled");

  const unrelatedRuntime = { cpuStatus: "normal" };
  const errorRuntime = createKeyboardInputRuntime();
  const errorController = createKeyboardMonitorController({
    async start() {
      throw new Error("listener unavailable");
    },
    async stop() {
      return { status: "disabled" };
    },
  }, errorRuntime);
  await errorController.start();
  assert.equal(errorRuntime.getSnapshot().status, "error");
  assert.equal(unrelatedRuntime.cpuStatus, "normal");

  controller.applyNativeStatus({
    status: "permission-required",
    message: "permission needed",
  });
  assert.equal(controllerRuntime.getSnapshot().status, "permission-required");
  assert.equal(controllerRuntime.getSnapshot().message, "permission needed");
  assert.ok(updates.length >= 8);

  const monitorSource = await readFile(new URL("../src/input/keyboardMonitor.ts", import.meta.url), "utf8");
  const settingsSource = await readFile(new URL("../src/settings/KeyboardInputSettings.vue", import.meta.url), "utf8");
  assert.match(monitorSource, /KEYBOARD_PERMISSION_RETRY_INTERVAL_MS/);
  assert.doesNotMatch(settingsSource, /setInterval/);
  assert.match(settingsSource, /<strong>键盘历史窗口<\/strong>/);
  assert.doesNotMatch(settingsSource, /Show Keyboard History/);

  // Stuck-key GC: a lost "up" must not block the next "down" of the same key.
  const gcRuntime = createKeyboardInputRuntime();
  gcRuntime.applyStatus({ status: "active" });
  assert.equal(gcRuntime.applyEvent(keyEvent("down", "A", 1_000)), true);
  assert.deepEqual(gcRuntime.getSnapshot().pressedKeys, ["A"]);
  // Within the stale window the key is still pressed and the down is deduped.
  assert.equal(gcRuntime.reapStalePressedKeys(20_000, 30_000), false);
  assert.equal(gcRuntime.applyEvent(keyEvent("down", "A", 21_000)), false);
  // Past the window the stuck key is reaped and the next down is accepted.
  assert.equal(gcRuntime.reapStalePressedKeys(40_000, 30_000), true);
  assert.deepEqual(gcRuntime.getSnapshot().pressedKeys, []);
  assert.equal(gcRuntime.applyEvent(keyEvent("down", "A", 41_000)), true);
  assert.deepEqual(gcRuntime.getSnapshot().pressedKeys, ["A"]);
  // Fresh keys within the window survive reaping.
  assert.equal(gcRuntime.reapStalePressedKeys(45_000, 30_000), false);
  assert.deepEqual(gcRuntime.getSnapshot().pressedKeys, ["A"]);
  // Inactive runtimes never reap.
  const idleRuntime = createKeyboardInputRuntime();
  assert.equal(idleRuntime.reapStalePressedKeys(999_999, 1), false);

  console.log("Keyboard monitor tests passed.");
} finally {
  await vite.close();
}

function keyEvent(eventType, key, timestamp) {
  return { eventType, key, timestamp };
}
