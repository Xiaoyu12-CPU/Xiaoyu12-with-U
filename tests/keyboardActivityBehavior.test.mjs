import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const behavior = await vite.ssrLoadModule("/src/pet/behavior.ts");
  const {
    createKeyboardActivityBehaviorController,
    KEYBOARD_ACTIVITY_IDLE_MS,
  } = await vite.ssrLoadModule(
    "/src/input/keyboardActivityBehavior.ts",
  );

  testActivityLifecycle(
    createKeyboardActivityBehaviorController,
    KEYBOARD_ACTIVITY_IDLE_MS,
  );
  testHeldKeyLifecycle(
    createKeyboardActivityBehaviorController,
    KEYBOARD_ACTIVITY_IDLE_MS,
  );
  testBehaviorPriority(
    createKeyboardActivityBehaviorController,
    behavior,
  );

  console.log("Keyboard activity behavior tests passed.");
} finally {
  await vite.close();
}

function testActivityLifecycle(createController, idleMs) {
  const timers = createFakeTimers();
  const requests = [];
  const releases = [];
  const activityStates = [];
  const controller = createController({
    requestBehavior(request) {
      requests.push(request);
    },
    releaseBehavior(source) {
      releases.push(source);
    },
    onActivityChange(active) {
      activityStates.push(active ? "active" : "idle");
    },
    now: timers.now,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  controller.update(input({ lastActivityAt: 0, pressedKeys: ["A"] }));
  assert.equal(controller.isActive(), true);
  assert.deepEqual(requests, [{ source: "input.keyboard", state: "working" }]);

  timers.advance(1000);
  controller.update(input({ lastActivityAt: 1000, pressedKeys: [] }));
  assert.equal(requests.length, 1);
  timers.advance(idleMs - 1);
  assert.equal(controller.isActive(), true);
  timers.advance(1);
  assert.equal(controller.isActive(), false);
  assert.deepEqual(releases, ["input.keyboard"]);
  assert.deepEqual(activityStates, ["active", "idle"]);

  controller.update(input({ lastActivityAt: 4000, pressedKeys: ["B"] }));
  assert.equal(controller.isActive(), true);
  controller.update(input({
    keyboardEnabled: false,
    keyboardStatus: "disabled",
    lastActivityAt: 4000,
    pressedKeys: [],
  }));
  assert.equal(controller.isActive(), false);
  assert.equal(releases.at(-1), "input.keyboard");
  assert.equal(timers.pending(), 0);
  controller.dispose();
}

function testHeldKeyLifecycle(createController, idleMs) {
  const timers = createFakeTimers();
  let releases = 0;
  const controller = createController({
    requestBehavior() {},
    releaseBehavior() {
      releases += 1;
    },
    now: timers.now,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  controller.update(input({ lastActivityAt: 0, pressedKeys: ["Shift"] }));
  timers.advance(idleMs * 2);
  assert.equal(controller.isActive(), true);
  assert.equal(releases, 0);

  controller.update(input({
    lastActivityAt: timers.now(),
    pressedKeys: [],
  }));
  timers.advance(idleMs);
  assert.equal(controller.isActive(), false);
  assert.equal(releases, 1);
  controller.dispose();
}

function testBehaviorPriority(createController, behavior) {
  const timers = createFakeTimers();
  const controller = createController({
    now: timers.now,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  controller.update(input({ lastActivityAt: 0, pressedKeys: ["A"] }));
  assert.equal(behavior.effectiveState.value, "working");
  const keyboardRequest = behavior.activeRequests.value.find(
    ({ source }) => source === behavior.BEHAVIOR_SOURCES.INPUT_KEYBOARD,
  );
  assert.equal(
    keyboardRequest.priority,
    behavior.DEFAULT_BEHAVIOR_PRIORITIES.working,
  );

  behavior.requestState({ source: "test.tired", state: "tired" });
  assert.equal(behavior.effectiveState.value, "working");
  behavior.requestState({ source: "test.happy", state: "happy" });
  assert.equal(behavior.effectiveState.value, "happy");
  behavior.requestState({ source: "test.alert", state: "alert" });
  assert.equal(behavior.effectiveState.value, "alert");
  behavior.requestState({
    source: behavior.BEHAVIOR_SOURCES.INTERACTION_DRAG,
    state: "dragging",
  });
  assert.equal(behavior.effectiveState.value, "dragging");

  behavior.releaseState(behavior.BEHAVIOR_SOURCES.INTERACTION_DRAG);
  assert.equal(behavior.effectiveState.value, "alert");
  behavior.releaseState("test.alert");
  assert.equal(behavior.effectiveState.value, "happy");
  behavior.releaseState("test.happy");
  assert.equal(behavior.effectiveState.value, "working");

  controller.dispose();
  assert.equal(behavior.effectiveState.value, "tired");
  behavior.releaseState("test.tired");
  assert.equal(behavior.effectiveState.value, "idle");
}

function input(overrides = {}) {
  return {
    keyboardEnabled: true,
    keyboardStatus: "active",
    pressedKeys: [],
    ...overrides,
  };
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
