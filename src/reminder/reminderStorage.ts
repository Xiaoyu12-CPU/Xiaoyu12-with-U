import { invoke, isTauri } from "@tauri-apps/api/core";
import type { ReminderStorageDocument } from "./reminderTypes";

export interface ReminderStorage {
  load: () => Promise<unknown | undefined>;
  save: (document: ReminderStorageDocument) => Promise<void>;
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
};
