import {
  KEY_DISPLAY_MAX_ITEMS,
  KEY_DISPLAY_MIN_ITEMS,
  keyHistoryAxis,
  resolveKeyDisplayFlowDirection,
} from "../input/keyDisplay";
import {
  MOUSE_VISUALIZER_BASE_GAP,
  MOUSE_VISUALIZER_HEIGHT,
  MOUSE_VISUALIZER_WIDTH,
} from "../input/mouseVisualizer";
import type {
  KeyDisplayFlowDirection,
  KeyDisplayPosition,
  MouseVisualizerPosition,
} from "../settings/settingsTypes";

export const OVERLAY_WINDOW_PADDING = 8;
export const PET_BASE_WINDOW_SIZE = 200;
const KEY_DISPLAY_VERTICAL_WIDTH = 180;
const KEY_DISPLAY_ENTRY_WIDTH = 140;
const KEY_DISPLAY_ENTRY_HEIGHT = 42;
const KEY_DISPLAY_BASE_GAP = 6;
const KEY_DISPLAY_HORIZONTAL_MAX_WIDTH = 640;
const KEY_HISTORY_HANDLE_WIDTH = 72;
const KEY_HISTORY_HANDLE_HEIGHT = 24;

export interface OverlayWindowSize {
  width: number;
  height: number;
}

export interface KeyboardWindowLayout extends OverlayWindowSize {
  stack: { left: number; top: number; width: number; height: number };
  origin: { left: number; top: number };
  scale: number;
  entryWidth: number;
}

export function calculateKeyboardWindowLayout(input: {
  petScale: number;
  position: KeyDisplayPosition;
  flowDirection: KeyDisplayFlowDirection;
  maxItems: number;
  startLineGapPx: number;
}): KeyboardWindowLayout {
  const scale = Math.max(0.5, input.petScale);
  const maxItems = Math.round(
    Math.min(Math.max(input.maxItems, KEY_DISPLAY_MIN_ITEMS), KEY_DISPLAY_MAX_ITEMS),
  );
  const flow = resolveKeyDisplayFlowDirection(input.position, input.flowDirection);
  const axis = keyHistoryAxis(flow);
  const gap = KEY_DISPLAY_BASE_GAP * scale;
  const stackWidth = axis === "vertical"
    ? KEY_DISPLAY_VERTICAL_WIDTH * scale
    : Math.min(
      KEY_DISPLAY_HORIZONTAL_MAX_WIDTH,
      KEY_DISPLAY_ENTRY_WIDTH * maxItems
        + KEY_DISPLAY_BASE_GAP * (maxItems - 1),
    ) * scale;
  const stackHeight = axis === "vertical"
    ? (KEY_DISPLAY_ENTRY_HEIGHT * maxItems
      + KEY_DISPLAY_BASE_GAP * (maxItems - 1)) * scale
    : KEY_DISPLAY_ENTRY_HEIGHT * scale;
  const handleWidth = KEY_HISTORY_HANDLE_WIDTH * scale;
  const handleHeight = KEY_HISTORY_HANDLE_HEIGHT * scale;
  const startGap = Math.min(Math.max(input.startLineGapPx, 0), 80) * scale;
  const padding = OVERLAY_WINDOW_PADDING;

  if (flow === "up" || flow === "down") {
    const width = Math.ceil(Math.max(stackWidth, handleWidth) + padding * 2);
    const height = Math.ceil(stackHeight + startGap + handleHeight + padding * 2);
    const centerX = width / 2;
    const originTop = flow === "up"
      ? padding + stackHeight + startGap + handleHeight / 2
      : padding + handleHeight / 2;
    return {
      width,
      height,
      stack: {
        left: (width - stackWidth) / 2,
        top: flow === "up"
          ? padding
          : originTop + handleHeight / 2 + startGap,
        width: stackWidth,
        height: stackHeight,
      },
      origin: { left: centerX, top: originTop },
      scale,
      entryWidth: KEY_DISPLAY_VERTICAL_WIDTH * scale,
    };
  }

  const width = Math.ceil(stackWidth + startGap + handleWidth + padding * 2);
  const height = Math.ceil(Math.max(stackHeight, handleHeight) + padding * 2);
  const centerY = height / 2;
  const originLeft = flow === "left"
    ? padding + stackWidth + startGap + handleWidth / 2
    : padding + handleWidth / 2;
  return {
    width,
    height,
    stack: {
      left: flow === "left"
        ? padding
        : originLeft + handleWidth / 2 + startGap,
      top: (height - stackHeight) / 2,
      width: stackWidth,
      height: stackHeight,
    },
    origin: { left: originLeft, top: centerY },
    scale,
    entryWidth: Math.max(
      1,
      (stackWidth - gap * (maxItems - 1)) / maxItems,
    ),
  };
}

export function calculateMouseWindowSize(petScale: number): OverlayWindowSize {
  const scale = Math.min(Math.max(petScale, 0.75), 1.5);
  return {
    width: Math.ceil(MOUSE_VISUALIZER_WIDTH * scale + OVERLAY_WINDOW_PADDING * 2),
    height: Math.ceil(MOUSE_VISUALIZER_HEIGHT * scale + OVERLAY_WINDOW_PADDING * 2),
  };
}

export function estimateSystemWindowSize(input: {
  panelWidth: number;
  panelScale: number;
  visibleItemCount: number;
}): OverlayWindowSize {
  const scale = Math.min(Math.max(input.panelScale, 0.7), 1.6);
  const itemCount = Math.max(0, Math.min(input.visibleItemCount, 5));
  return {
    width: Math.ceil(input.panelWidth * scale + OVERLAY_WINDOW_PADDING * 2),
    height: Math.ceil(
      (42 + itemCount * 66 + Math.max(0, itemCount - 1) * 10) * scale
        + OVERLAY_WINDOW_PADDING * 2,
    ),
  };
}

export function calculateDefaultOverlayOffset(input: {
  kind: "system-status" | "keyboard-history" | "mouse-visualizer";
  petScale: number;
  overlaySize: OverlayWindowSize;
  position?: KeyDisplayPosition | MouseVisualizerPosition;
  legacyOffsetX?: number;
  legacyOffsetY?: number;
}): { x: number; y: number } {
  const petSize = PET_BASE_WINDOW_SIZE * Math.max(1, input.petScale);
  const legacyX = Number.isFinite(input.legacyOffsetX) ? input.legacyOffsetX ?? 0 : 0;
  const legacyY = Number.isFinite(input.legacyOffsetY) ? input.legacyOffsetY ?? 0 : 0;
  if (input.kind === "system-status") {
    return {
      x: (input.legacyOffsetX ?? petSize + 10),
      y: (input.legacyOffsetY ?? 0),
    };
  }

  const position = input.position ?? (input.kind === "keyboard-history" ? "bottom" : "left");
  const base = (() => {
    switch (position) {
      case "top":
        return {
          x: (petSize - input.overlaySize.width) / 2,
          y: -MOUSE_VISUALIZER_BASE_GAP - input.overlaySize.height,
        };
      case "right":
        return {
          x: petSize + MOUSE_VISUALIZER_BASE_GAP,
          y: (petSize - input.overlaySize.height) / 2,
        };
      case "bottom":
        return {
          x: (petSize - input.overlaySize.width) / 2,
          y: petSize + MOUSE_VISUALIZER_BASE_GAP,
        };
      default:
        return {
          x: -MOUSE_VISUALIZER_BASE_GAP - input.overlaySize.width,
          y: (petSize - input.overlaySize.height) / 2,
        };
    }
  })();
  return { x: base.x + legacyX, y: base.y + legacyY };
}
