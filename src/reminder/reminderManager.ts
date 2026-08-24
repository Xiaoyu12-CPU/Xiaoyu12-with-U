import { readonly, ref } from "vue";
import type { DeepReadonly, Ref } from "vue";
import { reminderStorage } from "./reminderStorage";
import type { ReminderStorage } from "./reminderStorage";
import type {
  Reminder,
  ReminderInput,
  ReminderStorageDocument,
} from "./reminderTypes";

export interface ReminderManager {
  reminders: DeepReadonly<Ref<Reminder[]>>;
  isLoaded: DeepReadonly<Ref<boolean>>;
  isSaving: DeepReadonly<Ref<boolean>>;
  lastError: DeepReadonly<Ref<string | undefined>>;
  initialize: () => Promise<void>;
  load: () => Promise<void>;
  create: (input: ReminderInput) => Promise<Reminder>;
  update: (id: string, input: ReminderInput) => Promise<Reminder>;
  delete: (id: string) => Promise<void>;
  setEnabled: (id: string, enabled: boolean) => Promise<Reminder>;
  save: () => Promise<void>;
}

interface ReminderManagerDependencies {
  storage?: ReminderStorage;
  now?: () => Date;
  createId?: () => string;
}

export function createReminderManager(
  dependencies: ReminderManagerDependencies = {},
): ReminderManager {
  const storage = dependencies.storage ?? reminderStorage;
  const now = dependencies.now ?? (() => new Date());
  const createId = dependencies.createId ?? createReminderId;
  const reminders = ref<Reminder[]>([]);
  const isLoaded = ref(false);
  const isSaving = ref(false);
  const lastError = ref<string>();
  let initializePromise: Promise<void> | undefined;

  async function load(): Promise<void> {
    try {
      const storedDocument = await storage.load();
      reminders.value = storedDocument === undefined
        ? []
        : normalizeDocument(storedDocument).reminders;
      lastError.value = undefined;
    } catch (error) {
      reminders.value = [];
      lastError.value = toErrorMessage(error);
      console.error("Failed to load reminders; using an empty list.", error);
    } finally {
      isLoaded.value = true;
    }
  }

  async function initialize(): Promise<void> {
    if (!initializePromise) {
      initializePromise = (async () => {
        let subscriptionError: string | undefined;
        try {
          await storage.subscribe((value) => {
            try {
              reminders.value = normalizeDocument(value).reminders;
              lastError.value = undefined;
            } catch (error) {
              console.error("Ignored invalid reminders update.", error);
            }
          });
        } catch (error) {
          subscriptionError = `无法监听提醒更新：${toErrorMessage(error)}`;
          console.error("Failed to subscribe to reminder updates.", error);
        }
        await load();
        if (subscriptionError) {
          lastError.value = subscriptionError;
        }
      })();
    }

    return initializePromise;
  }

  async function persist(nextReminders: Reminder[]): Promise<void> {
    isSaving.value = true;
    lastError.value = undefined;
    const persistedReminders = nextReminders.map((reminder) => ({ ...reminder }));

    try {
      await storage.save({ schemaVersion: 1, reminders: persistedReminders });
      reminders.value = persistedReminders;
      try {
        await storage.broadcast({ schemaVersion: 1, reminders: persistedReminders });
      } catch (error) {
        lastError.value = `提醒已保存，但跨窗口同步失败：${toErrorMessage(error)}`;
        console.error("Failed to broadcast reminder storage update.", error);
      }
    } catch (error) {
      lastError.value = toErrorMessage(error);
      throw error;
    } finally {
      isSaving.value = false;
    }
  }

  async function create(input: ReminderInput): Promise<Reminder> {
    const timestamp = now().toISOString();
    const reminder: Reminder = {
      id: createId(),
      ...normalizeInput(input),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await persist([...reminders.value, reminder]);
    return reminder;
  }

  async function update(id: string, input: ReminderInput): Promise<Reminder> {
    const index = findReminderIndex(reminders.value, id);
    const reminder: Reminder = {
      ...reminders.value[index],
      ...normalizeInput(input),
      updatedAt: now().toISOString(),
    };
    const nextReminders = [...reminders.value];
    nextReminders[index] = reminder;
    await persist(nextReminders);
    return reminder;
  }

  async function remove(id: string): Promise<void> {
    const index = findReminderIndex(reminders.value, id);
    await persist(reminders.value.filter((_, candidateIndex) => candidateIndex !== index));
  }

  async function setEnabled(id: string, enabled: boolean): Promise<Reminder> {
    const index = findReminderIndex(reminders.value, id);
    const reminder: Reminder = {
      ...reminders.value[index],
      enabled,
      updatedAt: now().toISOString(),
    };
    const nextReminders = [...reminders.value];
    nextReminders[index] = reminder;
    await persist(nextReminders);
    return reminder;
  }

  async function save(): Promise<void> {
    await persist([...reminders.value]);
  }

  return {
    reminders: readonly(reminders),
    isLoaded: readonly(isLoaded),
    isSaving: readonly(isSaving),
    lastError: readonly(lastError),
    initialize,
    load,
    create,
    update,
    delete: remove,
    setEnabled,
    save,
  };
}

export const reminderManager = createReminderManager();

function normalizeDocument(value: unknown): ReminderStorageDocument {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.reminders)) {
    throw new Error("Unsupported reminders JSON format.");
  }

  const reminders = value.reminders.map(normalizeReminder);
  const ids = new Set(reminders.map(({ id }) => id));
  if (ids.size !== reminders.length) {
    throw new Error("Reminder IDs must be unique.");
  }

  return { schemaVersion: 1, reminders };
}

function normalizeReminder(value: unknown): Reminder {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || value.id.trim().length === 0
    || typeof value.enabled !== "boolean"
    || typeof value.createdAt !== "string"
    || typeof value.updatedAt !== "string"
    || Number.isNaN(Date.parse(value.createdAt))
    || Number.isNaN(Date.parse(value.updatedAt))
  ) {
    throw new Error("Stored reminder metadata is invalid.");
  }

  const input = normalizeInput({
    text: value.text,
    enabled: value.enabled,
    scheduleType: value.scheduleType,
    date: value.date,
    time: value.time,
  });

  return {
    id: value.id,
    ...input,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function normalizeInput(value: unknown): ReminderInput {
  if (!isRecord(value) || typeof value.text !== "string") {
    throw new Error("提醒内容不能为空。");
  }

  const text = value.text.trim();
  if (text.length === 0) {
    throw new Error("提醒内容不能为空。");
  }
  if (value.scheduleType !== "once" && value.scheduleType !== "daily") {
    throw new Error("提醒类型无效。");
  }
  if (typeof value.enabled !== "boolean") {
    throw new Error("提醒启用状态无效。");
  }
  if (typeof value.time !== "string" || !isValidTime(value.time)) {
    throw new Error("请选择合法的提醒时间。");
  }

  const date = value.scheduleType === "once" ? value.date : null;
  if (value.scheduleType === "once" && (typeof date !== "string" || !isValidDate(date))) {
    throw new Error("请选择合法的提醒日期。");
  }

  return {
    text,
    enabled: value.enabled,
    scheduleType: value.scheduleType,
    date: typeof date === "string" ? date : null,
    time: value.time,
  };
}

function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const [, year, month, day] = match.map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

function findReminderIndex(reminders: readonly Reminder[], id: string): number {
  const index = reminders.findIndex((reminder) => reminder.id === id);
  if (index === -1) {
    throw new Error(`Reminder not found: ${id}`);
  }
  return index;
}

function createReminderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
