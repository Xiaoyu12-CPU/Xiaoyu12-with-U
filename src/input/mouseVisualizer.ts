import type {
  MouseButton,
  MouseMonitorStatus,
  MouseScrollDirection,
} from "./types";

export const MOUSE_SCROLL_PULSE_MS = 600;
export const MOUSE_VISUALIZER_OFFSET_LIMIT = 500;
export const MOUSE_VISUALIZER_WIDTH = 96;
export const MOUSE_VISUALIZER_HEIGHT = 124;
export const MOUSE_VISUALIZER_BASE_GAP = 8;

export interface MouseVisualizerInput {
  mouseEnabled: boolean;
  visualizerEnabled: boolean;
  mouseStatus: MouseMonitorStatus;
  pressedButtons: readonly MouseButton[];
  lastScrollDirection?: MouseScrollDirection;
  lastScrollAt?: number;
}

export interface MouseVisualizerSnapshot {
  visible: boolean;
  activeButtons: readonly MouseButton[];
  scrollDirection?: MouseScrollDirection;
}

export interface MouseVisualizerController {
  update: (input: MouseVisualizerInput) => void;
  getSnapshot: () => MouseVisualizerSnapshot;
  dispose: () => void;
}

interface MouseVisualizerControllerDependencies {
  onChange?: (snapshot: MouseVisualizerSnapshot) => void;
  now?: () => number;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
}

export interface MouseVisualizerOffset {
  x: number;
  y: number;
}

export interface MouseVisualizerDragStart {
  pointerId: number;
  screenX: number;
  screenY: number;
  offset: MouseVisualizerOffset;
}

export interface MouseVisualizerDragController {
  start: (input: MouseVisualizerDragStart) => boolean;
  move: (pointerId: number, screenX: number, screenY: number) => boolean;
  finish: (pointerId: number) => boolean;
  abort: () => void;
  isDragging: () => boolean;
}

interface MouseVisualizerDragDependencies {
  onPreview: (offset: MouseVisualizerOffset) => void;
  onCommit: (offset: MouseVisualizerOffset) => void;
}

interface MouseVisualizerDragSession extends MouseVisualizerDragStart {
  currentOffset: MouseVisualizerOffset;
}

export function createMouseVisualizerController(
  dependencies: MouseVisualizerControllerDependencies = {},
): MouseVisualizerController {
  const onChange = dependencies.onChange ?? (() => {});
  const now = dependencies.now ?? Date.now;
  const setTimer = dependencies.setTimer ?? setTimeout;
  const clearTimer = dependencies.clearTimer ?? clearTimeout;
  let visible = false;
  let activeButtons: MouseButton[] = [];
  let scrollDirection: MouseScrollDirection | undefined;
  let lastProcessedScrollAt: number | undefined;
  let pulseTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function getSnapshot(): MouseVisualizerSnapshot {
    return {
      visible,
      activeButtons: [...activeButtons],
      scrollDirection,
    };
  }

  function publish(): void {
    onChange(getSnapshot());
  }

  function clearPulse(): void {
    if (pulseTimer !== undefined) {
      clearTimer(pulseTimer);
      pulseTimer = undefined;
    }
    scrollDirection = undefined;
  }

  function update(input: MouseVisualizerInput): void {
    if (disposed) return;

    const nextVisible = input.mouseEnabled
      && input.visualizerEnabled
      && input.mouseStatus === "active";
    visible = nextVisible;
    activeButtons = nextVisible
      ? [...new Set(input.pressedButtons)]
      : [];

    if (!nextVisible) {
      clearPulse();
      lastProcessedScrollAt = input.lastScrollAt;
      publish();
      return;
    }

    if (
      input.lastScrollAt !== undefined
      && input.lastScrollAt !== lastProcessedScrollAt
      && input.lastScrollDirection
    ) {
      lastProcessedScrollAt = input.lastScrollAt;
      clearPulse();
      const elapsed = now() - input.lastScrollAt;
      if (elapsed >= 0 && elapsed <= MOUSE_SCROLL_PULSE_MS) {
        scrollDirection = input.lastScrollDirection;
        pulseTimer = setTimer(() => {
          pulseTimer = undefined;
          scrollDirection = undefined;
          publish();
        }, MOUSE_SCROLL_PULSE_MS - elapsed);
      }
    }

    publish();
  }

  function dispose(): void {
    disposed = true;
    clearPulse();
    activeButtons = [];
    visible = false;
  }

  return { update, getSnapshot, dispose };
}

export function isMouseButtonActive(
  activeButtons: readonly MouseButton[],
  button: MouseButton,
): boolean {
  return activeButtons.includes(button);
}

export function scrollDirectionSymbol(
  direction?: MouseScrollDirection,
): string {
  const symbols: Partial<Record<MouseScrollDirection, string>> = {
    up: "↑",
    down: "↓",
    left: "←",
    right: "→",
  };
  return direction ? symbols[direction] ?? "" : "";
}

export function clampMouseVisualizerOffset(value: number): number {
  const finiteValue = Number.isFinite(value) ? value : 0;
  return Math.min(
    Math.max(Math.round(finiteValue), -MOUSE_VISUALIZER_OFFSET_LIMIT),
    MOUSE_VISUALIZER_OFFSET_LIMIT,
  );
}

export function resetMouseVisualizerOffset(): MouseVisualizerOffset {
  return { x: 0, y: 0 };
}

export function mouseVisualizerPointerPresentation(): {
  rootPointerEvents: "none";
  handlePointerEvents: "auto";
  visualPointerEvents: "none";
} {
  return {
    rootPointerEvents: "none",
    handlePointerEvents: "auto",
    visualPointerEvents: "none",
  };
}

export function createMouseVisualizerDragController(
  dependencies: MouseVisualizerDragDependencies,
): MouseVisualizerDragController {
  let session: MouseVisualizerDragSession | undefined;

  function start(input: MouseVisualizerDragStart): boolean {
    if (session) return false;
    const offset = normalizeOffset(input.offset);
    session = { ...input, offset, currentOffset: offset };
    return true;
  }

  function move(
    pointerId: number,
    screenX: number,
    screenY: number,
  ): boolean {
    if (!session || session.pointerId !== pointerId) return false;
    const nextOffset = normalizeOffset({
      x: session.offset.x + screenX - session.screenX,
      y: session.offset.y + screenY - session.screenY,
    });
    if (
      nextOffset.x !== session.currentOffset.x
      || nextOffset.y !== session.currentOffset.y
    ) {
      session.currentOffset = nextOffset;
      dependencies.onPreview(nextOffset);
    }
    return true;
  }

  function finish(pointerId: number): boolean {
    if (!session || session.pointerId !== pointerId) return false;
    const finalOffset = session.currentOffset;
    session = undefined;
    dependencies.onCommit(finalOffset);
    return true;
  }

  function abort(): void {
    session = undefined;
  }

  return {
    start,
    move,
    finish,
    abort,
    isDragging: () => session !== undefined,
  };
}

function normalizeOffset(offset: MouseVisualizerOffset): MouseVisualizerOffset {
  return {
    x: clampMouseVisualizerOffset(offset.x),
    y: clampMouseVisualizerOffset(offset.y),
  };
}
