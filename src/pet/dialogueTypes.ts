import type { DialogueEventType } from "./dialogueEvents";

export type DialogueCatalog = Readonly<
  Partial<Record<DialogueEventType, readonly string[]>>
>;

export type EditableDialogueCatalog = Record<DialogueEventType, string[]>;

export interface DialogueStorageDocument {
  schemaVersion: 1;
  events: EditableDialogueCatalog;
}
