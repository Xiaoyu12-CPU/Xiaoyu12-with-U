import {
  KEY_DISPLAY_MAX_ITEMS,
  KEY_DISPLAY_MIN_ITEMS,
  keyHistoryAxis,
  resolveKeyDisplayFlowDirection,
} from "../input/keyDisplay";
import { clampKeyDisplayOffset } from "../input/keyHistoryDrag";
import {
  clampMouseVisualizerOffset,
  MOUSE_VISUALIZER_BASE_GAP,
  MOUSE_VISUALIZER_HEIGHT,
  MOUSE_VISUALIZER_WIDTH,
} from "../input/mouseVisualizer";
import type {
  DesktopDisplayMode,
  KeyDisplayFlowDirection,
  KeyDisplayPosition,
  MouseVisualizerPosition,
} from "../settings/settingsTypes";

export const PET_BASE_WINDOW_SIZE = 200;
export const KEY_DISPLAY_VERTICAL_WIDTH = 180;
export const KEY_DISPLAY_ENTRY_WIDTH = 140;
export const KEY_DISPLAY_ENTRY_HEIGHT = 42;
export const KEY_DISPLAY_BASE_GAP = 6;
export const KEY_DISPLAY_HORIZONTAL_MAX_WIDTH = 640;
export const KEY_HISTORY_HANDLE_WIDTH = 72;
export const KEY_HISTORY_HANDLE_HEIGHT = 24;
export const KEY_HISTORY_START_LINE_WIDTH = 56;
export const KEY_HISTORY_START_LINE_HEIGHT = 2;
export const STATUS_BUBBLE_OFFSET_LIMIT = 500;
export const STATUS_BUBBLE_FALLBACK_SIZE = Object.freeze({
  width: 184,
  height: 286,
});

export interface WindowLayoutInput {
  displayMode: DesktopDisplayMode;
  petScale: number;
  bubbleWidth: number;
  bubbleHeight: number;
  offsetX: number;
  offsetY: number;
  keyDisplayVisible: boolean;
  keyDisplayPosition: KeyDisplayPosition;
  keyDisplayFlowDirection: KeyDisplayFlowDirection;
  keyDisplayMaxItems: number;
  keyDisplayOffsetX: number;
  keyDisplayOffsetY: number;
  keyDisplayStartLineGapPx: number;
  mouseVisualizerVisible: boolean;
  mouseVisualizerPosition: MouseVisualizerPosition;
  mouseVisualizerOffsetX: number;
  mouseVisualizerOffsetY: number;
}

export interface PetWindowLayout {
  minX: number;
  minY: number;
  width: number;
  height: number;
  petX: number;
  petY: number;
  petSize: number;
  bubbleX: number;
  bubbleY: number;
  keyDisplayX: number;
  keyDisplayY: number;
  keyDisplayWidth: number;
  keyDisplayHeight: number;
  keyDisplayScale: number;
  keyDisplayEntryWidth: number;
  keyDisplayOriginX: number;
  keyDisplayOriginY: number;
  mouseVisualizerX: number;
  mouseVisualizerY: number;
  mouseVisualizerWidth: number;
  mouseVisualizerHeight: number;
  mouseVisualizerScale: number;
}

interface LayoutRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculatePetWindowLayout(
  input: WindowLayoutInput,
): PetWindowLayout {
  const petSize = PET_BASE_WINDOW_SIZE * Math.max(1, input.petScale);
  const keyDisplayScale = Math.max(0.5, input.petScale);
  const keyDisplayMaxItems = Math.round(
    Math.min(
      Math.max(input.keyDisplayMaxItems, KEY_DISPLAY_MIN_ITEMS),
      KEY_DISPLAY_MAX_ITEMS,
    ),
  );
  const actualFlow = resolveKeyDisplayFlowDirection(
    input.keyDisplayPosition,
    input.keyDisplayFlowDirection,
  );
  const axis = keyHistoryAxis(actualFlow);
  const unscaledGap = KEY_DISPLAY_BASE_GAP;
  const unscaledWidth = axis === "vertical"
    ? KEY_DISPLAY_VERTICAL_WIDTH
    : Math.min(
      KEY_DISPLAY_HORIZONTAL_MAX_WIDTH,
      KEY_DISPLAY_ENTRY_WIDTH * keyDisplayMaxItems
        + unscaledGap * (keyDisplayMaxItems - 1),
    );
  const unscaledHeight = axis === "vertical"
    ? KEY_DISPLAY_ENTRY_HEIGHT * keyDisplayMaxItems
      + unscaledGap * (keyDisplayMaxItems - 1)
    : KEY_DISPLAY_ENTRY_HEIGHT;
  const keyDisplayWidth = unscaledWidth * keyDisplayScale;
  const keyDisplayHeight = unscaledHeight * keyDisplayScale;
  const keyDisplayEntryWidth = (axis === "vertical"
    ? KEY_DISPLAY_VERTICAL_WIDTH
    : (unscaledWidth - unscaledGap * (keyDisplayMaxItems - 1))
      / keyDisplayMaxItems) * keyDisplayScale;
  const baseOrigin = keyHistoryBaseOrigin(
    input.keyDisplayPosition,
    petSize,
  );
  const keyDisplayOrigin = {
    x: baseOrigin.x + clampKeyDisplayOffset(input.keyDisplayOffsetX),
    y: baseOrigin.y + clampKeyDisplayOffset(input.keyDisplayOffsetY),
  };
  const keyDisplayRect = positionKeyHistoryRectangle(
    actualFlow,
    keyDisplayOrigin,
    keyDisplayWidth,
    keyDisplayHeight,
    Math.min(Math.max(input.keyDisplayStartLineGapPx, 0), 80),
  );
  const keyDisplayHandleRect: LayoutRectangle = {
    x: keyDisplayOrigin.x - KEY_HISTORY_HANDLE_WIDTH / 2,
    y: keyDisplayOrigin.y - KEY_HISTORY_HANDLE_HEIGHT / 2,
    width: KEY_HISTORY_HANDLE_WIDTH,
    height: KEY_HISTORY_HANDLE_HEIGHT,
  };
  const mouseVisualizerScale = Math.min(
    Math.max(input.petScale, 0.75),
    1.5,
  );
  const mouseVisualizerWidth = MOUSE_VISUALIZER_WIDTH * mouseVisualizerScale;
  const mouseVisualizerHeight = MOUSE_VISUALIZER_HEIGHT * mouseVisualizerScale;
  const mouseVisualizerRect = positionMouseVisualizerRectangle(
    input.mouseVisualizerPosition,
    petSize,
    mouseVisualizerWidth,
    mouseVisualizerHeight,
    clampMouseVisualizerOffset(input.mouseVisualizerOffsetX),
    clampMouseVisualizerOffset(input.mouseVisualizerOffsetY),
  );
  const rectangles: LayoutRectangle[] = [];

  if (input.displayMode !== "status-only") {
    rectangles.push({ x: 0, y: 0, width: petSize, height: petSize });
  }
  if (input.displayMode !== "pet-only") {
    const statusRectangle = {
      x: input.offsetX,
      y: input.offsetY,
      width: Math.max(1, input.bubbleWidth),
      height: Math.max(1, input.bubbleHeight),
    };
    rectangles.push(statusRectangle);
  }
  if (input.displayMode !== "status-only" && input.keyDisplayVisible) {
    rectangles.push(keyDisplayRect, keyDisplayHandleRect);
  }
  if (input.displayMode !== "status-only" && input.mouseVisualizerVisible) {
    rectangles.push(mouseVisualizerRect);
  }

  const minX = Math.floor(Math.min(...rectangles.map(({ x }) => x)));
  const minY = Math.floor(Math.min(...rectangles.map(({ y }) => y)));
  const maxX = Math.ceil(
    Math.max(...rectangles.map(({ x, width }) => x + width)),
  );
  const maxY = Math.ceil(
    Math.max(...rectangles.map(({ y, height }) => y + height)),
  );

  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    petX: -minX,
    petY: -minY,
    petSize,
    bubbleX: input.offsetX - minX,
    bubbleY: input.offsetY - minY,
    keyDisplayX: keyDisplayRect.x - minX,
    keyDisplayY: keyDisplayRect.y - minY,
    keyDisplayWidth,
    keyDisplayHeight,
    keyDisplayScale,
    keyDisplayEntryWidth,
    keyDisplayOriginX: keyDisplayOrigin.x - minX,
    keyDisplayOriginY: keyDisplayOrigin.y - minY,
    mouseVisualizerX: mouseVisualizerRect.x - minX,
    mouseVisualizerY: mouseVisualizerRect.y - minY,
    mouseVisualizerWidth,
    mouseVisualizerHeight,
    mouseVisualizerScale,
  };
}

function positionMouseVisualizerRectangle(
  position: MouseVisualizerPosition,
  petSize: number,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
): LayoutRectangle {
  const base = (() => {
    switch (position) {
      case "top":
        return {
          x: (petSize - width) / 2,
          y: -MOUSE_VISUALIZER_BASE_GAP - height,
        };
      case "right":
        return {
          x: petSize + MOUSE_VISUALIZER_BASE_GAP,
          y: (petSize - height) / 2,
        };
      case "bottom":
        return {
          x: (petSize - width) / 2,
          y: petSize + MOUSE_VISUALIZER_BASE_GAP,
        };
      default:
        return {
          x: -MOUSE_VISUALIZER_BASE_GAP - width,
          y: (petSize - height) / 2,
        };
    }
  })();

  return {
    x: base.x + offsetX,
    y: base.y + offsetY,
    width,
    height,
  };
}

function keyHistoryBaseOrigin(
  position: KeyDisplayPosition,
  petSize: number,
): { x: number; y: number } {
  switch (position) {
    case "top":
      return { x: petSize / 2, y: 0 };
    case "left":
      return { x: 0, y: petSize / 2 };
    case "right":
      return { x: petSize, y: petSize / 2 };
    default:
      return { x: petSize / 2, y: petSize };
  }
}

function positionKeyHistoryRectangle(
  flowDirection: Exclude<KeyDisplayFlowDirection, "auto">,
  origin: { x: number; y: number },
  width: number,
  height: number,
  gap: number,
): LayoutRectangle {
  switch (flowDirection) {
    case "up":
      return {
        x: origin.x - width / 2,
        y: origin.y - KEY_HISTORY_START_LINE_HEIGHT / 2 - gap - height,
        width,
        height,
      };
    case "left":
      return {
        x: origin.x - KEY_HISTORY_START_LINE_WIDTH / 2 - gap - width,
        y: origin.y - height / 2,
        width,
        height,
      };
    case "right":
      return {
        x: origin.x + KEY_HISTORY_START_LINE_WIDTH / 2 + gap,
        y: origin.y - height / 2,
        width,
        height,
      };
    default:
      return {
        x: origin.x - width / 2,
        y: origin.y + KEY_HISTORY_START_LINE_HEIGHT / 2 + gap,
        width,
        height,
      };
  }
}

export function clampStatusBubbleOffset(value: number): number {
  return Math.min(Math.max(value, -STATUS_BUBBLE_OFFSET_LIMIT), STATUS_BUBBLE_OFFSET_LIMIT);
}
