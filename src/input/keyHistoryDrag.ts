export const KEY_DISPLAY_OFFSET_LIMIT = 500;

export interface KeyHistoryOffset {
  x: number;
  y: number;
}

export interface KeyHistoryDragStart {
  pointerId: number;
  screenX: number;
  screenY: number;
  offset: KeyHistoryOffset;
}

export interface KeyHistoryDragController {
  start: (input: KeyHistoryDragStart) => boolean;
  move: (pointerId: number, screenX: number, screenY: number) => boolean;
  finish: (pointerId: number) => boolean;
  abort: () => void;
  isDragging: () => boolean;
}

export interface KeyHistoryStartLinePresentation {
  handleStyle: { pointerEvents: "auto" };
  lineStyle: { backgroundColor: string; opacity: number };
}

interface KeyHistoryDragDependencies {
  onPreview: (offset: KeyHistoryOffset) => void;
  onCommit: (offset: KeyHistoryOffset) => void;
}

interface DragSession extends KeyHistoryDragStart {
  currentOffset: KeyHistoryOffset;
}

export function clampKeyDisplayOffset(value: number): number {
  const finiteValue = Number.isFinite(value) ? value : 0;
  return Math.min(
    Math.max(Math.round(finiteValue), -KEY_DISPLAY_OFFSET_LIMIT),
    KEY_DISPLAY_OFFSET_LIMIT,
  );
}

export function resetKeyHistoryOffset(): KeyHistoryOffset {
  return { x: 0, y: 0 };
}

export function keyHistoryStartLinePresentation(
  color: string,
  opacity: number,
): KeyHistoryStartLinePresentation {
  return {
    handleStyle: { pointerEvents: "auto" },
    lineStyle: {
      backgroundColor: color,
      opacity: Math.min(Math.max(opacity, 0), 1),
    },
  };
}

export function createKeyHistoryDragController(
  dependencies: KeyHistoryDragDependencies,
): KeyHistoryDragController {
  let session: DragSession | undefined;

  function start(input: KeyHistoryDragStart): boolean {
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

function normalizeOffset(offset: KeyHistoryOffset): KeyHistoryOffset {
  return {
    x: clampKeyDisplayOffset(offset.x),
    y: clampKeyDisplayOffset(offset.y),
  };
}
