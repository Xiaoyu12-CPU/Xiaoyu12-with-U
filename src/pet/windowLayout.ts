import {
  KEY_DISPLAY_MAX_ITEMS,
  KEY_DISPLAY_MIN_ITEMS,
  keyHistoryAxis,
  resolveKeyDisplayFlowDirection,
} from "../input/keyDisplay";
import type {
  DesktopDisplayMode,
  KeyDisplayFlowDirection,
  KeyDisplayPosition,
} from "../settings/settingsTypes";

export const PET_BASE_WINDOW_SIZE = 200;
export const KEY_DISPLAY_VERTICAL_WIDTH = 180;
export const KEY_DISPLAY_ENTRY_WIDTH = 140;
export const KEY_DISPLAY_ENTRY_HEIGHT = 42;
export const KEY_DISPLAY_BASE_GAP = 6;
export const KEY_DISPLAY_HORIZONTAL_MAX_WIDTH = 640;
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
  keyDisplayDistancePx: number;
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
  const keyDisplayRect = positionKeyHistoryRectangle(
    input.keyDisplayPosition,
    petSize,
    keyDisplayWidth,
    keyDisplayHeight,
    Math.min(Math.max(input.keyDisplayDistancePx, 0), 200),
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
    rectangles.push(keyDisplayRect);
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
  };
}

function positionKeyHistoryRectangle(
  position: KeyDisplayPosition,
  petSize: number,
  width: number,
  height: number,
  gap: number,
): LayoutRectangle {
  switch (position) {
    case "top":
      return { x: (petSize - width) / 2, y: -height - gap, width, height };
    case "left":
      return { x: -width - gap, y: (petSize - height) / 2, width, height };
    case "right":
      return { x: petSize + gap, y: (petSize - height) / 2, width, height };
    default:
      return { x: (petSize - width) / 2, y: petSize + gap, width, height };
  }
}

export function clampStatusBubbleOffset(value: number): number {
  return Math.min(Math.max(value, -STATUS_BUBBLE_OFFSET_LIMIT), STATUS_BUBBLE_OFFSET_LIMIT);
}
