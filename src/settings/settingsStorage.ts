import { invoke, isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { DesktopPetSettings } from "./settingsTypes";

const BROWSER_STORAGE_KEY = "desktop-pet.settings.v1";
const SETTINGS_UPDATED_EVENT = "desktop-pet://settings-updated";

export const settingsStorage = {
  async load(): Promise<unknown | undefined> {
    const serialized = isTauri()
      ? await invoke<string | null>("load_settings")
      : localStorage.getItem(BROWSER_STORAGE_KEY);

    return serialized ? (JSON.parse(serialized) as unknown) : undefined;
  },

  async save(settings: DesktopPetSettings): Promise<void> {
    const contents = JSON.stringify(settings, null, 2);

    if (isTauri()) {
      await invoke("save_settings", { contents });
      return;
    }

    localStorage.setItem(BROWSER_STORAGE_KEY, contents);
  },

  async broadcast(settings: DesktopPetSettings): Promise<void> {
    if (isTauri()) {
      await emit(SETTINGS_UPDATED_EVENT, settings);
      return;
    }

    window.dispatchEvent(
      new CustomEvent<DesktopPetSettings>(SETTINGS_UPDATED_EVENT, {
        detail: settings,
      }),
    );
  },

  async subscribe(listener: (settings: unknown) => void): Promise<UnlistenFn> {
    if (isTauri()) {
      return listen<unknown>(SETTINGS_UPDATED_EVENT, ({ payload }) => {
        listener(payload);
      });
    }

    const handleCustomEvent = (event: Event): void => {
      listener((event as CustomEvent<unknown>).detail);
    };
    const handleStorageEvent = (event: StorageEvent): void => {
      if (event.key !== BROWSER_STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        listener(JSON.parse(event.newValue) as unknown);
      } catch {
        // Ignore malformed updates from another browser tab.
      }
    };

    window.addEventListener(SETTINGS_UPDATED_EVENT, handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);
    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
    };
  },
};
