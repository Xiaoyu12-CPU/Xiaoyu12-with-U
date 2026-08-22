import type { DesktopDisplayMode } from "../settings/settingsTypes";

export const PET_BASE_WINDOW_SIZE = 200;
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
  };
}

export function clampStatusBubbleOffset(value: number): number {
  return Math.min(Math.max(value, -STATUS_BUBBLE_OFFSET_LIMIT), STATUS_BUBBLE_OFFSET_LIMIT);
}
