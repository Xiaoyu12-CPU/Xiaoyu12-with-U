import { invoke, isTauri } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ReminderStorageDocument } from "./reminderTypes";

const MAIN_WINDOW_LABEL = "main";
const CONTROL_CENTER_LABEL = "control-center";
const REMINDERS_UPDATED_EVENT = "desktop-pet://reminders-updated";

export interface ReminderStorage {
  load: () => Promise<unknown | undefined>;
  save: (document: ReminderStorageDocument) => Promise<void>;
  broadcast: (document: ReminderStorageDocument) => Promise<void>;
  subscribe: (listener: (document: unknown) => void) => Promise<UnlistenFn>;
}

let browserDocument: ReminderStorageDocument | undefined;

export const reminderStorage: ReminderStorage = {
  async load(): Promise<unknown | undefined> {
    if (!isTauri()) {
      return browserDocument ? structuredClone(browserDocument) : undefined;
    }

    const serialized = await invoke<string | null>("load_reminders");
    return serialized ? (JSON.parse(serialized) as unknown) : undefined;
  },

  async save(document: ReminderStorageDocument): Promise<void> {
    if (!isTauri()) {
      browserDocument = structuredClone(document);
      return;
    }

    await invoke("save_reminders", {
      contents: JSON.stringify(document, null, 2),
    });
  },

  async broadcast(document: ReminderStorageDocument): Promise<void> {
    if (isTauri()) {
      const currentLabel = getCurrentWindow().label;
      const targetLabel = currentLabel === MAIN_WINDOW_LABEL
        ? CONTROL_CENTER_LABEL
        : MAIN_WINDOW_LABEL;
      await emitTo(targetLabel, REMINDERS_UPDATED_EVENT, document);
      return;
    }

    window.dispatchEvent(
      new CustomEvent<ReminderStorageDocument>(REMINDERS_UPDATED_EVENT, {
        detail: document,
      }),
    );
  },

  async subscribe(listener: (document: unknown) => void): Promise<UnlistenFn> {
    if (isTauri()) {
      return listen<unknown>(REMINDERS_UPDATED_EVENT, ({ payload }) => {
        listener(payload);
      });
    }

    const handleUpdate = (event: Event): void => {
      listener((event as CustomEvent<unknown>).detail);
    };
    window.addEventListener(REMINDERS_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(REMINDERS_UPDATED_EVENT, handleUpdate);
  },
};
