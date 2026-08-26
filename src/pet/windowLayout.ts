import type { DesktopDisplayMode } from "../settings/settingsTypes";

export const PET_BASE_WINDOW_SIZE = 200;
export const KEY_DISPLAY_BASE_WIDTH = 180;
export const KEY_DISPLAY_BASE_HEIGHT = 42;
export const KEY_DISPLAY_BASE_GAP = 6;
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
  const keyDisplayWidth = KEY_DISPLAY_BASE_WIDTH * keyDisplayScale;
  const keyDisplayHeight = KEY_DISPLAY_BASE_HEIGHT * keyDisplayScale;
  const keyDisplayX = (petSize - keyDisplayWidth) / 2;
  const keyDisplayY = petSize + KEY_DISPLAY_BASE_GAP * keyDisplayScale;
  const rectangles: LayoutRectangle[] = [];

  if (input.displayMode !== "status-only") {
    rectangles.push({ x: 0, y: 0, width: petSize, height: petSize });
  }
  if (input.displayMode !== "pet-only") {
    rectangles.push({
      x: input.offsetX,
      y: input.offsetY,
      width: Math.max(1, input.bubbleWidth),
      height: Math.max(1, input.bubbleHeight),
    });
  }
  if (input.displayMode !== "status-only" && input.keyDisplayVisible) {
    rectangles.push({
      x: keyDisplayX,
      y: keyDisplayY,
      width: keyDisplayWidth,
      height: keyDisplayHeight,
    });
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
    keyDisplayX: keyDisplayX - minX,
    keyDisplayY: keyDisplayY - minY,
    keyDisplayWidth,
    keyDisplayHeight,
    keyDisplayScale,
  };
}

export function clampStatusBubbleOffset(value: number): number {
  return Math.min(Math.max(value, -STATUS_BUBBLE_OFFSET_LIMIT), STATUS_BUBBLE_OFFSET_LIMIT);
}
