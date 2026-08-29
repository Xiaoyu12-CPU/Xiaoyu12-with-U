import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { readonly, ref } from "vue";

/**
 * Free window dragging for the frameless overlay windows, with position
 * persistence: dragging uses startDragging(), and the final position is
 * saved on drop so the window reopens where the user left it.
 */
export function useOverlayDrag(label: string) {
  const isDragging = ref(false);

  async function restorePosition(): Promise<void> {
    if (!isTauri()) {
      return;
    }

    try {
      const saved = await invoke<[number, number] | null>("load_window_position", { label });
      if (saved) {
        await getCurrentWindow().setPosition(new PhysicalPosition(saved[0], saved[1]));
      }
    } catch (error) {
      console.warn(`Failed to restore position for ${label}.`, error);
    }
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    isDragging.value = true;
  }

  async function onPointerUp(): Promise<void> {
    if (!isDragging.value) {
      return;
    }
    isDragging.value = false;

    if (!isTauri()) {
      return;
    }

    try {
      const position = await getCurrentWindow().outerPosition();
      await invoke("save_window_position", {
        label,
        x: position.x,
        y: position.y,
      });
    } catch (error) {
      console.warn(`Failed to save position for ${label}.`, error);
    }
  }

  function startWindowDrag(): void {
    void getCurrentWindow()
      .startDragging()
      .catch((error: unknown) => {
        console.error(`Failed to drag ${label} window.`, error);
      });
  }

  return {
    isDragging: readonly(isDragging),
    restorePosition,
    onPointerDown,
    onPointerUp,
    startWindowDrag,
  };
}
