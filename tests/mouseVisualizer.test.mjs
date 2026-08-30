import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const mouseVisualizer = await vite.ssrLoadModule(
    "/src/input/mouseVisualizer.ts",
  );
  const { createMouseInputRuntime } = await vite.ssrLoadModule(
    "/src/input/mouseRuntime.ts",
  );
  const { createKeyHistoryController } = await vite.ssrLoadModule(
    "/src/input/keyDisplay.ts",
  );
  const { calculatePetWindowLayout } = await vite.ssrLoadModule(
    "/src/pet/windowLayout.ts",
  );
  const behavior = await vite.ssrLoadModule("/src/pet/behavior.ts");
  const { normalizeSettings } = await vite.ssrLoadModule(
    "/src/settings/settingsManager.ts",
  );

  testButtonPresentation(mouseVisualizer);
  testScrollPulse(mouseVisualizer);
  testVisualLayers(mouseVisualizer);
  testVisibilityIsolation(mouseVisualizer, createMouseInputRuntime);
  testSettings(normalizeSettings);
  testPositionAndBounding(mouseVisualizer, calculatePetWindowLayout);
  testDragAndReset(mouseVisualizer);
  testKeyboardAndBehaviorIsolation(
    mouseVisualizer,
    createMouseInputRuntime,
    createKeyHistoryController,
    behavior,
  );

  console.log("Mouse visualizer tests passed.");
} finally {
  await vite.close();
}

function testButtonPresentation(module) {
  const timers = createFakeTimers(1000);
  const controller = module.createMouseVisualizerController(timers.dependencies);
  const base = visualizerInput();

  for (const button of ["left", "right", "middle", "mouse4", "mouse5"]) {
    controller.update({ ...base, pressedButtons: [button] });
    assert.deepEqual(controller.getSnapshot().activeButtons, [button]);
    controller.update({ ...base, pressedButtons: [] });
    assert.deepEqual(controller.getSnapshot().activeButtons, []);
  }

  controller.update({
    ...base,
    pressedButtons: ["left", "right", "mouse4"],
  });
  assert.deepEqual(controller.getSnapshot().activeButtons, [
    "left",
    "right",
    "mouse4",
  ]);
  controller.dispose();
}

function testScrollPulse(module) {
  const timers = createFakeTimers(2000);
  const controller = module.createMouseVisualizerController(timers.dependencies);
  const base = visualizerInput();
  controller.update(base);

  for (const direction of ["up", "down", "left", "right"]) {
    const timestamp = timers.now();
    controller.update({
      ...base,
      lastScrollDirection: direction,
      lastScrollAt: timestamp,
    });
    assert.equal(controller.getSnapshot().scrollDirection, direction);
    assert.equal(module.scrollDirectionSymbol(direction), {
      up: "↑",
      down: "↓",
      left: "←",
      right: "→",
    }[direction]);
    timers.advance(module.MOUSE_SCROLL_PULSE_MS);
    assert.equal(controller.getSnapshot().scrollDirection, undefined);
    timers.advance(1);
  }

  const firstAt = timers.now();
  controller.update({
    ...base,
    lastScrollDirection: "up",
    lastScrollAt: firstAt,
  });
  timers.advance(300);
  const secondAt = timers.now();
  controller.update({
    ...base,
    lastScrollDirection: "down",
    lastScrollAt: secondAt,
  });
  timers.advance(300);
  assert.equal(controller.getSnapshot().scrollDirection, "down");
  timers.advance(300);
  assert.equal(controller.getSnapshot().scrollDirection, undefined);

  const middleAt = timers.now();
  controller.update({
    ...base,
    pressedButtons: ["middle"],
    lastScrollDirection: "left",
    lastScrollAt: middleAt,
  });
  timers.advance(module.MOUSE_SCROLL_PULSE_MS);
  assert.deepEqual(controller.getSnapshot().activeButtons, ["middle"]);
  assert.equal(controller.getSnapshot().scrollDirection, undefined);
  controller.dispose();
}

function testVisibilityIsolation(module, createMouseRuntime) {
  const timers = createFakeTimers(3000);
  const controller = module.createMouseVisualizerController(timers.dependencies);
  const runtime = createMouseRuntime();
  runtime.applyStatus({ status: "active" });
  runtime.applyEvent({
    eventType: "down",
    button: "left",
    timestamp: timers.now(),
  });

  controller.update({
    ...visualizerInput(),
    visualizerEnabled: false,
    pressedButtons: runtime.getSnapshot().pressedButtons,
  });
  assert.equal(controller.getSnapshot().visible, false);
  assert.deepEqual(runtime.getSnapshot().pressedButtons, ["left"]);

  controller.update({
    ...visualizerInput(),
    mouseEnabled: false,
    pressedButtons: runtime.getSnapshot().pressedButtons,
  });
  assert.equal(controller.getSnapshot().visible, false);
  controller.update({
    ...visualizerInput(),
    mouseStatus: "permission-required",
  });
  assert.equal(controller.getSnapshot().visible, false);

  // Keyboard state is intentionally absent from the Mouse Visualizer input.
  controller.update(visualizerInput());
  assert.equal(controller.getSnapshot().visible, true);
  controller.dispose();
}

function testSettings(normalizeSettings) {
  const defaults = normalizeSettings({}).input;
  assert.equal(defaults.mouseVisualizerEnabled, false);
  assert.equal(defaults.mouseVisualizerPosition, "left");
  assert.equal(defaults.mouseVisualizerOffsetX, 0);
  assert.equal(defaults.mouseVisualizerOffsetY, 0);
  assert.equal(defaults.mouseVisualizerBodyColor, "#F4F0FA");
  assert.equal(defaults.mouseVisualizerBodyOpacity, 0.3);
  assert.equal(defaults.mouseVisualizerButtonColor, "#FFFFFF");
  assert.equal(defaults.mouseVisualizerButtonOpacity, 0.42);
  assert.equal(defaults.mouseVisualizerOutlineColor, "#745BC9");
  assert.equal(defaults.mouseVisualizerOutlineOpacity, 0.7);
  assert.equal(defaults.mouseVisualizerOutlineWidth, 1.25);
  assert.equal(defaults.mouseVisualizerActiveColor, "#8B5CF6");
  assert.equal(defaults.mouseVisualizerActiveOpacity, 0.88);

  const normalized = normalizeSettings({
    input: {
      mouseVisualizerPosition: "center",
      mouseVisualizerOffsetX: -900,
      mouseVisualizerOffsetY: 900,
      mouseVisualizerBodyColor: "body",
      mouseVisualizerBodyOpacity: -1,
      mouseVisualizerButtonColor: "button",
      mouseVisualizerButtonOpacity: 2,
      mouseVisualizerOutlineColor: "outline",
      mouseVisualizerOutlineOpacity: -2,
      mouseVisualizerOutlineWidth: 12,
      mouseVisualizerActiveColor: "purple",
      mouseVisualizerActiveOpacity: 5,
    },
  }).input;
  assert.equal(normalized.mouseVisualizerPosition, "left");
  assert.equal(normalized.mouseVisualizerOffsetX, -500);
  assert.equal(normalized.mouseVisualizerOffsetY, 500);
  assert.equal(normalized.mouseVisualizerBodyColor, "#F4F0FA");
  assert.equal(normalized.mouseVisualizerBodyOpacity, 0);
  assert.equal(normalized.mouseVisualizerButtonColor, "#FFFFFF");
  assert.equal(normalized.mouseVisualizerButtonOpacity, 1);
  assert.equal(normalized.mouseVisualizerOutlineColor, "#745BC9");
  assert.equal(normalized.mouseVisualizerOutlineOpacity, 0);
  assert.equal(normalized.mouseVisualizerOutlineWidth, 4);
  assert.equal(normalized.mouseVisualizerActiveColor, "#8B5CF6");
  assert.equal(normalized.mouseVisualizerActiveOpacity, 1);
  assert.equal(
    normalizeSettings({ input: { mouseVisualizerOffsetX: Number.NaN } })
      .input.mouseVisualizerOffsetX,
    0,
  );
  assert.equal(
    normalizeSettings({ input: { mouseVisualizerBodyOpacity: Number.NaN } })
      .input.mouseVisualizerBodyOpacity,
    0.3,
  );
  assert.equal(
    normalizeSettings({ input: { mouseVisualizerOutlineWidth: -1 } })
      .input.mouseVisualizerOutlineWidth,
    0,
  );
}

function testVisualLayers(module) {
  const base = {
    bodyColor: "#112233",
    bodyOpacity: 0.3,
    buttonColor: "#445566",
    buttonOpacity: 0.4,
    outlineColor: "#778899",
    outlineOpacity: 0.7,
    outlineWidth: 1.25,
    activeColor: "#AABBCC",
    activeOpacity: 0.88,
  };
  const style = module.mouseVisualizerVisualStyle(base);
  assert.deepEqual(style, {
    bodyFill: "rgba(17, 34, 51, 0.3)",
    buttonFill: "rgba(68, 85, 102, 0.4)",
    outline: "rgba(119, 136, 153, 0.7)",
    outlineWidth: "1.25px",
    activeFill: "rgba(170, 187, 204, 0.88)",
  });

  const noBody = module.mouseVisualizerVisualStyle({
    ...base,
    bodyOpacity: 0,
  });
  assert.equal(noBody.bodyFill, "rgba(17, 34, 51, 0)");
  assert.equal(noBody.outline, style.outline);
  assert.equal(noBody.buttonFill, style.buttonFill);

  const noOutline = module.mouseVisualizerVisualStyle({
    ...base,
    outlineOpacity: 0,
  });
  assert.equal(noOutline.outline, "rgba(119, 136, 153, 0)");
  assert.equal(noOutline.bodyFill, style.bodyFill);
  assert.equal(noOutline.buttonFill, style.buttonFill);

  const noInactiveButtons = module.mouseVisualizerVisualStyle({
    ...base,
    buttonOpacity: 0,
  });
  assert.equal(noInactiveButtons.buttonFill, "rgba(68, 85, 102, 0)");
  assert.equal(noInactiveButtons.activeFill, style.activeFill);
  assert.equal(
    module.mouseVisualizerVisualStyle({ ...base, outlineWidth: -1 })
      .outlineWidth,
    "0px",
  );
  assert.equal(
    module.mouseVisualizerVisualStyle({ ...base, outlineWidth: 9 })
      .outlineWidth,
    "4px",
  );
}

function testPositionAndBounding(module, calculateLayout) {
  const base = layoutInput();
  const expected = {
    left: { x: -104, y: 38 },
    right: { x: 208, y: 38 },
    top: { x: 52, y: -132 },
    bottom: { x: 52, y: 208 },
  };

  for (const position of ["top", "bottom", "left", "right"]) {
    const layout = calculateLayout({
      ...base,
      mouseVisualizerPosition: position,
    });
    assert.deepEqual(worldMouse(layout), expected[position]);
    assert.equal(layout.minX + layout.petX, 0);
    assert.equal(layout.minY + layout.petY, 0);
    assert.ok(layout.width >= layout.mouseVisualizerWidth);
    assert.ok(layout.height >= layout.mouseVisualizerHeight);
  }

  const original = calculateLayout(base);
  const styleOnly = calculateLayout({
    ...base,
    mouseVisualizerBodyColor: "#000000",
    mouseVisualizerBodyOpacity: 0,
    mouseVisualizerButtonColor: "#FFFFFF",
    mouseVisualizerButtonOpacity: 1,
    mouseVisualizerOutlineColor: "#FF0000",
    mouseVisualizerOutlineOpacity: 0,
    mouseVisualizerOutlineWidth: 4,
    mouseVisualizerActiveColor: "#00FF00",
    mouseVisualizerActiveOpacity: 0.2,
  });
  assert.deepEqual(styleOnly, original);
  const moved = calculateLayout({
    ...base,
    mouseVisualizerOffsetX: 40,
    mouseVisualizerOffsetY: -20,
  });
  assert.deepEqual(worldMouse(moved), {
    x: worldMouse(original).x + 40,
    y: worldMouse(original).y - 20,
  });
  assert.equal(moved.minX + moved.petX, 0);
  assert.equal(moved.minY + moved.petY, 0);

  // Mouse movement changes only its own world rectangle. Existing UI offsets
  // stay independent even though all rectangles share one OS window bound.
  assert.deepEqual(worldKeyOrigin(moved), worldKeyOrigin(original));
  assert.deepEqual(worldStatus(moved), worldStatus(original));
}

function testDragAndReset(module) {
  const previews = [];
  const commits = [];
  const controller = module.createMouseVisualizerDragController({
    onPreview: (offset) => previews.push(offset),
    onCommit: (offset) => commits.push(offset),
  });
  assert.equal(controller.start({
    pointerId: 7,
    screenX: 100,
    screenY: 100,
    offset: { x: 10, y: -10 },
  }), true);
  assert.equal(controller.start({
    pointerId: 8,
    screenX: 0,
    screenY: 0,
    offset: { x: 0, y: 0 },
  }), false);
  assert.equal(controller.move(7, 140, 80), true);
  assert.deepEqual(previews, [{ x: 50, y: -30 }]);
  assert.equal(controller.finish(7), true);
  assert.deepEqual(commits, [{ x: 50, y: -30 }]);
  assert.deepEqual(module.resetMouseVisualizerOffset(), { x: 0, y: 0 });
  assert.equal(module.clampMouseVisualizerOffset(-900), -500);
  assert.equal(module.clampMouseVisualizerOffset(900), 500);
  assert.deepEqual(module.mouseVisualizerPointerPresentation(), {
    rootPointerEvents: "none",
    handlePointerEvents: "auto",
    visualPointerEvents: "none",
  });
}

function testKeyboardAndBehaviorIsolation(
  module,
  createMouseRuntime,
  createHistory,
  behavior,
) {
  const timers = createFakeTimers(5000);
  const visualizer = module.createMouseVisualizerController(timers.dependencies);
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
  const runtime = createMouseRuntime();
  runtime.applyStatus({ status: "active" });
  const requestCount = behavior.activeRequests.value.length;

  runtime.applyEvent({
    eventType: "down",
    button: "right",
    timestamp: timers.now(),
  });
  visualizer.update({
    ...visualizerInput(),
    pressedButtons: runtime.getSnapshot().pressedButtons,
  });

  assert.deepEqual(visualizer.getSnapshot().activeButtons, ["right"]);
  assert.deepEqual(history.getSnapshot().entries, []);
  assert.equal(behavior.activeRequests.value.length, requestCount);
  assert.equal(
    behavior.activeRequests.value.some(({ source }) => source === "input.mouse"),
    false,
  );
  visualizer.dispose();
  history.dispose();
}

function visualizerInput(overrides = {}) {
  return {
    mouseEnabled: true,
    visualizerEnabled: true,
    mouseStatus: "active",
    pressedButtons: [],
    ...overrides,
  };
}

function layoutInput(overrides = {}) {
  return {
    displayMode: "both",
    petScale: 1,
    bubbleWidth: 184,
    bubbleHeight: 286,
    offsetX: 220,
    offsetY: 12,
    keyDisplayVisible: true,
    keyDisplayPosition: "bottom",
    keyDisplayFlowDirection: "down",
    keyDisplayMaxItems: 4,
    keyDisplayOffsetX: 11,
    keyDisplayOffsetY: 17,
    keyDisplayStartLineGapPx: 8,
    mouseVisualizerVisible: true,
    mouseVisualizerPosition: "left",
    mouseVisualizerOffsetX: 0,
    mouseVisualizerOffsetY: 0,
    ...overrides,
  };
}

function worldMouse(layout) {
  return {
    x: layout.minX + layout.mouseVisualizerX,
    y: layout.minY + layout.mouseVisualizerY,
  };
}

function worldKeyOrigin(layout) {
  return {
    x: layout.minX + layout.keyDisplayOriginX,
    y: layout.minY + layout.keyDisplayOriginY,
  };
}

function worldStatus(layout) {
  return {
    x: layout.minX + layout.bubbleX,
    y: layout.minY + layout.bubbleY,
  };
}

function createFakeTimers(startTime) {
  let currentTime = startTime;
  let nextId = 1;
  const timers = new Map();
  return {
    now: () => currentTime,
    dependencies: {
      now: () => currentTime,
      setTimer(callback, delayMs) {
        const id = nextId++;
        timers.set(id, { callback, at: currentTime + delayMs });
        return id;
      },
      clearTimer(id) {
        timers.delete(id);
      },
    },
    advance(durationMs) {
      currentTime += durationMs;
      let executed = true;
      while (executed) {
        executed = false;
        for (const [id, timer] of [...timers]) {
          if (timer.at <= currentTime) {
            timers.delete(id);
            timer.callback();
            executed = true;
          }
        }
      }
    },
  };
}
