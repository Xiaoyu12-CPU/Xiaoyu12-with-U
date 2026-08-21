import { getCurrentWindow } from "@tauri-apps/api/window";

export interface WindowDragAdapter {
  startDragging: () => Promise<void>;
}

export const tauriWindowDragAdapter: WindowDragAdapter = {
  async startDragging(): Promise<void> {
    await getCurrentWindow().startDragging();
  },
};
