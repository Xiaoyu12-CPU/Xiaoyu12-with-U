export const PET_CONTEXT_MENU_WIDTH = 144;
export const PET_CONTEXT_MENU_HEIGHT = 66;
export const PET_CONTEXT_MENU_MARGIN = 4;

export interface ContextMenuPositionInput {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
}

export function calculateContextMenuPosition(
  input: ContextMenuPositionInput,
): { left: number; top: number } {
  const availableWidth = Math.max(
    0,
    input.viewportWidth - PET_CONTEXT_MENU_MARGIN * 2,
  );
  const availableHeight = Math.max(
    0,
    input.viewportHeight - PET_CONTEXT_MENU_MARGIN * 2,
  );
  const width = Math.min(PET_CONTEXT_MENU_WIDTH, availableWidth);
  const height = Math.min(PET_CONTEXT_MENU_HEIGHT, availableHeight);
  const maximumLeft = Math.max(
    PET_CONTEXT_MENU_MARGIN,
    input.viewportWidth - width - PET_CONTEXT_MENU_MARGIN,
  );
  const maximumTop = Math.max(
    PET_CONTEXT_MENU_MARGIN,
    input.viewportHeight - height - PET_CONTEXT_MENU_MARGIN,
  );

  return {
    left: clamp(input.x, PET_CONTEXT_MENU_MARGIN, maximumLeft),
    top: clamp(input.y, PET_CONTEXT_MENU_MARGIN, maximumTop),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
