import assert from "node:assert/strict";
import { mock } from "node:test";
import { effectScope } from "vue";
import { createServer } from "vite";

globalThis.window = new EventTarget();
globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
};

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { usePetInteraction } = await vite.ssrLoadModule(
    "/src/pet/interaction.ts",
  );
  const windowDrag = await vite.ssrLoadModule("/src/pet/windowDrag.ts");
  const behavior = await vite.ssrLoadModule("/src/pet/behavior.ts");
  const contextMenuLayout = await vite.ssrLoadModule(
    "/src/pet/contextMenuLayout.ts",
  );

  testContextMenuLayout(contextMenuLayout);
  await testPrimaryButtonReleaseObserver(windowDrag);

  let startCount = 0;
  let movedListener;
  let primaryButtonReleasedListener;
  const controller = usePetInteraction({
    dialogue: { catalog: {} },
    windowDrag: {
      async startDragging() {
        startCount += 1;
      },
      async onMoved(listener) {
        movedListener = listener;
        return () => {};
      },
      async onPrimaryButtonReleased(listener) {
        primaryButtonReleasedListener = listener;
        return () => {};
      },
    },
  });

  controller.handlePointerDown(pointerEvent({ pointerId: 1 }));
  assert.equal(startCount, 1, "native dragging starts on mouse-down");
  assert.equal(behavior.winningSource.value, undefined);

  movedListener();
  assert.equal(behavior.winningSource.value, "interaction.drag");
  controller.handlePointerUp(pointerEvent({ pointerId: 1 }));
  assert.equal(behavior.winningSource.value, undefined);

  controller.handlePointerDown(pointerEvent({ pointerId: 2 }));
  assert.equal(startCount, 2);
  controller.handlePointerMove(pointerEvent({
    pointerId: 2,
    clientX: 2,
    clientY: 2,
    buttons: 1,
  }));
  assert.equal(behavior.winningSource.value, undefined);
  controller.handlePointerMove(pointerEvent({
    pointerId: 2,
    clientX: 8,
    buttons: 1,
  }));
  assert.equal(behavior.winningSource.value, "interaction.drag");
  assert.equal(startCount, 2, "pointer movement must not start a second native drag");
  controller.handlePointerCancel(pointerEvent({ pointerId: 2 }));
  controller.handlePointerUp(pointerEvent({ pointerId: 2 }));
  assert.equal(behavior.winningSource.value, undefined);

  controller.handlePointerDown(pointerEvent({ pointerId: 3 }));
  movedListener();
  assert.equal(behavior.winningSource.value, "interaction.drag");
  primaryButtonReleasedListener();
  assert.equal(
    behavior.winningSource.value,
    undefined,
    "native primary-button release must end a drag when Windows loses DOM mouseup",
  );

  controller.dialogue.dispose();
  testNativeClickFallback(usePetInteraction, behavior);
  console.log("Pet interaction tests passed.");
} finally {
  await vite.close();
  delete globalThis.window;
  delete globalThis.localStorage;
}

function testNativeClickFallback(usePetInteraction, behavior) {
  mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });

  function withInteraction(check) {
    const scope = effectScope();
    let nativeRelease;
    const controller = scope.run(() => usePetInteraction({
      dialogue: { catalog: {} },
      windowDrag: {
        async startDragging() {},
        async onPrimaryButtonReleased(listener) {
          nativeRelease = listener;
          return () => {};
        },
      },
    }));
    try {
      check(controller, () => nativeRelease());
    } finally {
      scope.stop();
      controller.dialogue.dispose();
      behavior.releaseState(behavior.BEHAVIOR_SOURCES.INTERACTION_CLICK);
    }
  }

  function clickRequest() {
    return behavior.activeRequests.value.find(
      ({ source }) => source === behavior.BEHAVIOR_SOURCES.INTERACTION_CLICK,
    );
  }

  try {
    withInteraction((controller, nativeRelease) => {
      controller.handlePointerDown(pointerEvent());
      nativeRelease();
      assert.equal(
        behavior.effectiveState.value,
        "happy",
        "a Windows native release without DOM click must trigger happy when no drag occurred",
      );
      mock.timers.tick(1199);
      assert.equal(behavior.effectiveState.value, "happy");
      mock.timers.tick(1);
      assert.equal(behavior.effectiveState.value, "idle");
    });

    withInteraction((controller, nativeRelease) => {
      controller.handlePointerDown(pointerEvent());
      nativeRelease();
      const request = clickRequest();
      mock.timers.tick(100);
      controller.handlePointerUp(pointerEvent());
      controller.handleClick();
      assert.deepEqual(clickRequest(), request, "a later DOM click must not duplicate the native click");
      mock.timers.tick(1100);
      assert.equal(behavior.effectiveState.value, "idle", "a duplicate DOM click must not extend happy");
    });

    withInteraction((controller, nativeRelease) => {
      controller.handlePointerDown(pointerEvent());
      controller.handlePointerUp(pointerEvent());
      controller.handleClick();
      const request = clickRequest();
      assert.equal(request?.state, "happy");
      mock.timers.tick(100);
      nativeRelease();
      assert.deepEqual(clickRequest(), request, "a later native release must not duplicate a DOM click");
    });

    withInteraction((controller, nativeRelease) => {
      controller.handlePointerDown(pointerEvent());
      nativeRelease();
      const firstRequest = clickRequest();
      mock.timers.tick(50);
      controller.handlePointerDown(pointerEvent({ pointerId: 2 }));
      nativeRelease();
      assert.ok(
        clickRequest().sequence > firstRequest.sequence,
        "a new real click within 300 ms must still trigger happy",
      );
      assert.equal(clickRequest().createdAt, Date.now());
    });

    withInteraction((controller, nativeRelease) => {
      controller.handlePointerDown(pointerEvent());
      controller.handlePointerMove(pointerEvent({ clientX: 8, buttons: 1 }));
      assert.equal(behavior.effectiveState.value, "dragging");
      nativeRelease();
      assert.equal(behavior.effectiveState.value, "idle", "native drag release must not trigger happy");
      controller.handleClick();
      assert.equal(clickRequest(), undefined, "the trailing click after a drag must remain suppressed");
    });

    withInteraction((controller, nativeRelease) => {
      controller.handlePointerDown(pointerEvent());
      controller.handlePointerCancel(pointerEvent());
      nativeRelease();
      assert.equal(clickRequest(), undefined, "a late native release after cancellation must not trigger happy");
    });
  } finally {
    mock.timers.reset();
  }
}

async function testPrimaryButtonReleaseObserver(module) {
  const scheduled = [];
  const cleared = [];
  const states = [true, true, false];
  let releases = 0;
  let nextTimerId = 1;
  const stop = module.observePrimaryButtonRelease(
    () => { releases += 1; },
    {
      async readPressed() { return states.shift() ?? null; },
      setTimer(callback, delay) {
        const id = nextTimerId++;
        scheduled.push({ id, callback, delay });
        return id;
      },
      clearTimer(id) { cleared.push(id); },
    },
  );

  await Promise.resolve();
  assert.equal(scheduled[0].delay, module.PRIMARY_BUTTON_POLL_INTERVAL_MS);
  scheduled.shift().callback();
  await Promise.resolve();
  scheduled.shift().callback();
  await Promise.resolve();
  assert.equal(releases, 1);

  stop();
  assert.deepEqual(cleared, []);
}

function pointerEvent(overrides = {}) {
  return {
    button: 0,
    buttons: 0,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    ...overrides,
  };
}

function testContextMenuLayout(layout) {
  assert.deepEqual(
    layout.calculateContextMenuPosition({
      x: 198,
      y: 198,
      viewportWidth: 200,
      viewportHeight: 200,
    }),
    { left: 52, top: 130 },
    "the complete 144×66 menu must flip inside the 200×200 pet window",
  );
  assert.deepEqual(
    layout.calculateContextMenuPosition({
      x: -20,
      y: -20,
      viewportWidth: 200,
      viewportHeight: 200,
    }),
    { left: 4, top: 4 },
  );
  assert.deepEqual(
    layout.calculateContextMenuPosition({
      x: 60,
      y: 60,
      viewportWidth: 100,
      viewportHeight: 60,
    }),
    { left: 4, top: 4 },
    "small windows should shrink the menu instead of clipping it",
  );
}
