import { getCurrentWindow } from "@tauri-apps/api/window";

export type WindowDragUnlisten = () => void;

export interface WindowDragAdapter {
  startDragging: () => Promise<void>;
  onMoved?: (listener: () => void) => Promise<WindowDragUnlisten>;
}

export const tauriWindowDragAdapter: WindowDragAdapter = {
  async startDragging(): Promise<void> {
    await getCurrentWindow().startDragging();
  },
  async onMoved(listener: () => void): Promise<WindowDragUnlisten> {
    return getCurrentWindow().onMoved(listener);
  },
};
