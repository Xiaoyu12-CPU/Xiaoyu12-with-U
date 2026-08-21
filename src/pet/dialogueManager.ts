import { readonly, ref } from "vue";
import defaultDialogueDocument from "../assets/dialogue/default.json";
import { DIALOGUE_EVENT_TYPE_LIST } from "./dialogueEvents";
import type { DialogueEventType } from "./dialogueEvents";
import { dialogueStorage } from "./dialogueStorage";
import type {
  DialogueCatalog,
  DialogueStorageDocument,
  EditableDialogueCatalog,
} from "./dialogueTypes";

const defaultDocument = normalizeDocument(defaultDialogueDocument);
const catalog = ref<EditableDialogueCatalog>(cloneCatalog(defaultDocument.events));
const isLoaded = ref(false);
const lastStorageError = ref<string>();
let initializePromise: Promise<void> | undefined;

async function initialize(): Promise<void> {
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    try {
      const storedDocument = await dialogueStorage.load();

      if (storedDocument !== undefined) {
        catalog.value = normalizeDocument(storedDocument).events;
      }
    } catch (error) {
      lastStorageError.value = toErrorMessage(error);
      console.error("Failed to load dialogue storage; using defaults.", error);
    } finally {
      isLoaded.value = true;
    }

    try {
      await dialogueStorage.subscribe((document) => {
        try {
          catalog.value = normalizeDocument(document).events;
          lastStorageError.value = undefined;
        } catch (error) {
          console.error("Ignored invalid dialogue storage update.", error);
        }
      });
    } catch (error) {
      lastStorageError.value = toErrorMessage(error);
      console.error("Failed to subscribe to dialogue storage updates.", error);
    }
  })();

  return initializePromise;
}

async function setEventTexts(
  eventType: DialogueEventType,
  texts: readonly string[],
): Promise<void> {
  const normalizedTexts = texts
    .map((text) => text.trim())
    .filter((text) => text.length > 0);
  const nextDocument: DialogueStorageDocument = {
    schemaVersion: 1,
    events: {
      ...cloneCatalog(catalog.value),
      [eventType]: normalizedTexts,
    },
  };

  catalog.value = nextDocument.events;
  lastStorageError.value = undefined;

  try {
    await dialogueStorage.save(nextDocument);
    await dialogueStorage.broadcast(nextDocument);
  } catch (error) {
    lastStorageError.value = toErrorMessage(error);
    throw error;
  }
}

function getCatalog(): DialogueCatalog {
  return catalog.value;
}

function getEventTexts(eventType: DialogueEventType): readonly string[] {
  return catalog.value[eventType];
}

export const dialogueManager = {
  catalog: readonly(catalog),
  isLoaded: readonly(isLoaded),
  lastStorageError: readonly(lastStorageError),
  initialize,
  getCatalog,
  getEventTexts,
  setEventTexts,
};

export const DEFAULT_DIALOGUE_CATALOG: DialogueCatalog = defaultDocument.events;

function normalizeDocument(value: unknown): DialogueStorageDocument {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.events)) {
    throw new Error("Unsupported dialogue JSON format.");
  }

  const events = {} as EditableDialogueCatalog;

  for (const eventType of DIALOGUE_EVENT_TYPE_LIST) {
    const candidates = value.events[eventType];

    if (!Array.isArray(candidates) || !candidates.every((text) => typeof text === "string")) {
      events[eventType] = [...defaultDocumentFallback(eventType)];
      continue;
    }

    events[eventType] = candidates
      .map((text) => text.trim())
      .filter((text) => text.length > 0);
  }

  return { schemaVersion: 1, events };
}

function defaultDocumentFallback(eventType: DialogueEventType): readonly string[] {
  const rawDocument = defaultDialogueDocument as {
    events?: Partial<Record<DialogueEventType, unknown>>;
  };
  const candidates = rawDocument.events?.[eventType];

  return Array.isArray(candidates)
    ? candidates.filter((text): text is string => typeof text === "string")
    : [];
}

function cloneCatalog(source: EditableDialogueCatalog): EditableDialogueCatalog {
  return Object.fromEntries(
    DIALOGUE_EVENT_TYPE_LIST.map((eventType) => [
      eventType,
      [...source[eventType]],
    ]),
  ) as EditableDialogueCatalog;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
