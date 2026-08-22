import { invoke, isTauri } from "@tauri-apps/api/core";

export interface PetWindowSettings {
  petScale: number;
  alwaysOnTop: boolean;
  layout?: {
    width: number;
    height: number;
    positionDeltaX: number;
    positionDeltaY: number;
  };
}

export interface PetWindowSettingsAdapter {
  apply: (settings: PetWindowSettings) => Promise<void>;
}

export const tauriPetWindowSettingsAdapter: PetWindowSettingsAdapter = {
  async apply(settings): Promise<void> {
    if (!isTauri()) {
      return;
    }

    await invoke("apply_pet_window_settings", {
      petScale: settings.petScale,
      alwaysOnTop: settings.alwaysOnTop,
      windowWidth: settings.layout?.width,
      windowHeight: settings.layout?.height,
      positionDeltaX: settings.layout?.positionDeltaX,
      positionDeltaY: settings.layout?.positionDeltaY,
    });
  },
};
