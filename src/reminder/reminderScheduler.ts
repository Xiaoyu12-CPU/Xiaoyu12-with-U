import { isTauri } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentScope, onScopeDispose, watch } from "vue";
import { updateReminderRuntime } from "../pet/runtimeStatus";
import { settingsManager } from "../settings/settingsManager";
import { reminderManager } from "./reminderManager";
import type {
  NextReminderRuntime,
  Reminder,
  ReminderTriggerPayload,
} from "./reminderTypes";

export const REMINDER_TRIGGERED_EVENT = "desktop-pet://reminder-triggered";
export const REMINDER_GRACE_WINDOW_MS = 5 * 60 * 1_000;
export const REMINDER_MAX_TIMER_DELAY_MS = 60 * 60 * 1_000;

type ReminderOccurrenceStatus = "future" | "due" | "expired";

export interface ReminderOccurrence {
  status: ReminderOccurrenceStatus;
  scheduledAt?: Date;
}

interface ReminderSchedulerDependencies {
  getReminders: () => readonly Reminder[];
  isEnabled: () => boolean;
  setReminderEnabled: (id: string, enabled: boolean) => Promise<unknown>;
  publishTrigger: (payload: ReminderTriggerPayload) => Promise<void>;
  updateRuntime: (input: {
    status: "enabled" | "disabled";
    nextReminder?: NextReminderRuntime;
    lastTrigger?: ReminderTriggerPayload;
  }) => void;
  now?: () => Date;
  setTimer?: (callback: () => void, delayMs: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

export interface ReminderSchedulerController {
  refresh: () => Promise<void>;
  dispose: () => void;
}

export function createReminderScheduler(
  dependencies: ReminderSchedulerDependencies,
): ReminderSchedulerController {
  const now = dependencies.now ?? (() => new Date());
  const setTimer = dependencies.setTimer
    ?? ((callback, delayMs) => globalThis.setTimeout(callback, delayMs));
  const clearTimer = dependencies.clearTimer
    ?? ((timer) => globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>));
  const triggeredOccurrences = new Set<string>();
  let timer: unknown;
  let disposed = false;
  let reconciling = false;
  let reconcileRequested = false;
  let lastTrigger: ReminderTriggerPayload | undefined;

  function clearActiveTimer(): void {
    if (timer !== undefined) {
      clearTimer(timer);
      timer = undefined;
    }
  }

  async function refresh(): Promise<void> {
    if (disposed) {
      return;
    }

    reconcileRequested = true;
    if (reconciling) {
      return;
    }

    reconciling = true;
    try {
      while (reconcileRequested && !disposed) {
        reconcileRequested = false;
        clearActiveTimer();
        await reconcileOnce();
      }
    } finally {
      reconciling = false;
    }
  }

  async function reconcileOnce(): Promise<void> {
    if (!dependencies.isEnabled()) {
      dependencies.updateRuntime({ status: "disabled", lastTrigger });
      return;
    }

    const currentTime = now();
    const enabledReminders = dependencies.getReminders().filter(({ enabled }) => enabled);
    const occurrences = enabledReminders.map((reminder) => ({
      reminder,
      occurrence: evaluateReminderOccurrence(reminder, currentTime),
    }));

    for (const { reminder, occurrence } of occurrences) {
      if (reminder.scheduleType === "once" && occurrence.status === "expired") {
        await dependencies.setReminderEnabled(reminder.id, false);
        reconcileRequested = true;
      }
    }

    const dueOccurrences = occurrences
      .filter(({ occurrence }) => occurrence.status === "due" && occurrence.scheduledAt)
      .sort((left, right) =>
        left.occurrence.scheduledAt!.getTime() - right.occurrence.scheduledAt!.getTime()
      );

    for (const { reminder, occurrence } of dueOccurrences) {
      const scheduledAt = occurrence.scheduledAt!;
      const occurrenceKey = createOccurrenceKey(reminder.id, scheduledAt);
      if (triggeredOccurrences.has(occurrenceKey)) {
        continue;
      }

      triggeredOccurrences.add(occurrenceKey);
      try {
        if (reminder.scheduleType === "once") {
          await dependencies.setReminderEnabled(reminder.id, false);
          reconcileRequested = true;
        }

        const payload: ReminderTriggerPayload = {
          id: reminder.id,
          text: reminder.text,
          scheduleType: reminder.scheduleType,
          scheduledAt: scheduledAt.toISOString(),
          triggeredAt: now().toISOString(),
        };
        await dependencies.publishTrigger(payload);
        lastTrigger = payload;
      } catch (error) {
        triggeredOccurrences.delete(occurrenceKey);
        throw error;
      }
    }

    const nextReminder = findNextReminder(
      dependencies.getReminders(),
      now(),
      triggeredOccurrences,
    );
    dependencies.updateRuntime({
      status: "enabled",
      nextReminder,
      lastTrigger,
    });

    if (nextReminder) {
      const delayMs = Math.max(
        0,
        new Date(nextReminder.nextTriggerAt).getTime() - now().getTime(),
      );
      timer = setTimer(
        () => {
          timer = undefined;
          void refresh().catch((error: unknown) => {
            console.error("Reminder scheduler refresh failed.", error);
          });
        },
        Math.min(delayMs, REMINDER_MAX_TIMER_DELAY_MS),
      );
    }
  }

  function dispose(): void {
    disposed = true;
    reconcileRequested = false;
    clearActiveTimer();
  }

  return { refresh, dispose };
}

export function evaluateReminderOccurrence(
  reminder: Reminder,
  now: Date,
  graceWindowMs = REMINDER_GRACE_WINDOW_MS,
): ReminderOccurrence {
  if (!reminder.enabled) {
    return { status: "expired" };
  }

  const scheduledAt = reminder.scheduleType === "once"
    ? createLocalOnceDate(reminder)
    : createLocalDailyDate(now, reminder.time, 0);
  const differenceMs = now.getTime() - scheduledAt.getTime();

  if (differenceMs < 0) {
    return { status: "future", scheduledAt };
  }
  if (differenceMs <= graceWindowMs) {
    return { status: "due", scheduledAt };
  }
  if (reminder.scheduleType === "once") {
    return { status: "expired", scheduledAt };
  }

  return {
    status: "future",
    scheduledAt: createLocalDailyDate(now, reminder.time, 1),
  };
}

export function findNextReminder(
  reminders: readonly Reminder[],
  now: Date,
  triggeredOccurrences: ReadonlySet<string> = new Set(),
): NextReminderRuntime | undefined {
  const candidates = reminders
    .filter(({ enabled }) => enabled)
    .flatMap((reminder) => {
      const occurrence = evaluateReminderOccurrence(reminder, now);
      if (!occurrence.scheduledAt || occurrence.status === "expired") {
        return [];
      }

      let scheduledAt = occurrence.scheduledAt;
      if (
        reminder.scheduleType === "daily"
        && occurrence.status === "due"
        && triggeredOccurrences.has(createOccurrenceKey(reminder.id, scheduledAt))
      ) {
        scheduledAt = createLocalDailyDate(now, reminder.time, 1);
      }

      return [{ reminder, scheduledAt }];
    })
    .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime());
  const next = candidates[0];

  return next
    ? {
        id: next.reminder.id,
        text: next.reminder.text,
        scheduleType: next.reminder.scheduleType,
        nextTriggerAt: next.scheduledAt.toISOString(),
      }
    : undefined;
}

export function useReminderScheduler(): void {
  const scheduler = createReminderScheduler({
    getReminders: () => reminderManager.reminders.value,
    isEnabled: () => settingsManager.settings.value.reminder.enabled,
    setReminderEnabled: (id, enabled) => reminderManager.setEnabled(id, enabled),
    publishTrigger: publishReminderTrigger,
    updateRuntime: updateReminderRuntime,
  });
  let ready = false;

  void Promise.all([
    reminderManager.initialize(),
    settingsManager.initialize(),
  ]).then(() => {
    ready = true;
    return scheduler.refresh();
  }).catch((error: unknown) => {
    console.error("Failed to initialize reminder scheduler.", error);
  });

  const stopWatching = watch(
    [
      () => settingsManager.settings.value.reminder.enabled,
      reminderManager.reminders,
    ],
    () => {
      if (ready) {
        void scheduler.refresh().catch((error: unknown) => {
          console.error("Failed to reschedule reminders.", error);
        });
      }
    },
    { deep: true },
  );

  function dispose(): void {
    stopWatching();
    scheduler.dispose();
  }

  if (getCurrentScope()) {
    onScopeDispose(dispose);
  }
}

function createLocalOnceDate(reminder: Reminder): Date {
  const [year, month, day] = reminder.date!.split("-").map(Number);
  const [hour, minute] = reminder.time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function createLocalDailyDate(now: Date, time: string, dayOffset: number): Date {
  const [hour, minute] = time.split(":").map(Number);
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    hour,
    minute,
    0,
    0,
  );
}

function createOccurrenceKey(reminderId: string, scheduledAt: Date): string {
  return `${reminderId}:${scheduledAt.toISOString()}`;
}

async function publishReminderTrigger(payload: ReminderTriggerPayload): Promise<void> {
  if (isTauri()) {
    await emit(REMINDER_TRIGGERED_EVENT, payload);
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ReminderTriggerPayload>(REMINDER_TRIGGERED_EVENT, {
      detail: payload,
    }),
  );
}
