import { invoke, isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { DialogueStorageDocument } from "./dialogueTypes";

const BROWSER_STORAGE_KEY = "desktop-pet.dialogue.v1";
const STORAGE_UPDATED_EVENT = "desktop-pet://dialogue-storage-updated";

export interface DialogueStorage {
  load: () => Promise<unknown | undefined>;
  save: (document: DialogueStorageDocument) => Promise<void>;
  broadcast: (document: DialogueStorageDocument) => Promise<void>;
  subscribe: (
    listener: (document: unknown) => void,
  ) => Promise<UnlistenFn>;
}

export const dialogueStorage: DialogueStorage = {
  async load(): Promise<unknown | undefined> {
    const serialized = isTauri()
      ? await invoke<string | null>("load_dialogue_catalog")
      : localStorage.getItem(BROWSER_STORAGE_KEY);

    if (!serialized) {
      return undefined;
    }

    return JSON.parse(serialized) as unknown;
  },

  async save(document: DialogueStorageDocument): Promise<void> {
    const serialized = JSON.stringify(document, null, 2);

    if (isTauri()) {
      await invoke("save_dialogue_catalog", { contents: serialized });
      return;
    }

    localStorage.setItem(BROWSER_STORAGE_KEY, serialized);
  },

  async broadcast(document: DialogueStorageDocument): Promise<void> {
    if (isTauri()) {
      await emit(STORAGE_UPDATED_EVENT, document);
      return;
    }

    window.dispatchEvent(
      new CustomEvent<DialogueStorageDocument>(STORAGE_UPDATED_EVENT, {
        detail: document,
      }),
    );
  },

  async subscribe(
    listener: (document: unknown) => void,
  ): Promise<UnlistenFn> {
    if (isTauri()) {
      return listen<unknown>(STORAGE_UPDATED_EVENT, ({ payload }) => {
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
        // Ignore malformed external browser storage updates.
      }
    };

    window.addEventListener(STORAGE_UPDATED_EVENT, handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      window.removeEventListener(STORAGE_UPDATED_EVENT, handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
    };
  },
};
