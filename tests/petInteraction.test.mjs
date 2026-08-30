import assert from "node:assert/strict";
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
  const behavior = await vite.ssrLoadModule("/src/pet/behavior.ts");

  let startCount = 0;
  let movedListener;
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

  controller.dialogue.dispose();
  console.log("Pet interaction tests passed.");
} finally {
  await vite.close();
  delete globalThis.window;
  delete globalThis.localStorage;
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
