import { isTauri } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentScope, onScopeDispose, watch } from "vue";
import { updateReminderRuntime } from "../pet/runtimeStatus";
import { settingsManager } from "../settings/settingsManager";
import { reminderManager } from "./reminderManager";
import type {
  MissedReminderRuntime,
  NextReminderRuntime,
  Reminder,
  ReminderSnooze,
  ReminderTriggerPayload,
} from "./reminderTypes";

export const REMINDER_TRIGGERED_EVENT = "desktop-pet://reminder-triggered";
export const REMINDER_GRACE_WINDOW_MS = 5 * 60 * 1_000;
export const REMINDER_MAX_TIMER_DELAY_MS = 60 * 60 * 1_000;
/** Fired occurrence keys older than this are pruned from memory and storage. */
export const REMINDER_TRIGGERED_RETENTION_MS = 24 * 60 * 60 * 1_000;

type ReminderOccurrenceStatus = "future" | "due" | "expired";

export interface ReminderOccurrence {
  status: ReminderOccurrenceStatus;
  scheduledAt?: Date;
}

interface ReminderSchedulerDependencies {
  getReminders: () => readonly Reminder[];
  getSnoozes: () => readonly ReminderSnooze[];
  isEnabled: () => boolean;
  setReminderEnabled: (id: string, enabled: boolean) => Promise<unknown>;
  deleteSnooze: (id: string) => Promise<unknown>;
  publishTrigger: (payload: ReminderTriggerPayload) => Promise<void>;
  updateRuntime: (input: {
    status: "enabled" | "disabled";
    nextReminder?: NextReminderRuntime;
    lastTrigger?: ReminderTriggerPayload;
    missed?: MissedReminderRuntime[];
  }) => void;
  /**
   * Persists fired occurrence keys so a crash or refresh inside the trigger
   * grace window cannot ring the same occurrence twice. When omitted, the
   * in-memory set still guards within a single session.
   */
  markTriggered?: (keys: readonly string[]) => Promise<unknown>;
  /** Restores previously persisted occurrence keys before first reconcile. */
  getTriggeredOccurrences?: () => readonly string[];
  now?: () => Date;
  setTimer?: (callback: () => void, delayMs: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

export interface ReminderSchedulerController {
  refresh: () => Promise<void>;
  dispose: () => void;
  /** Seeds previously persisted occurrence keys (call once after storage load). */
  restoreTriggeredOccurrences: (keys: readonly string[]) => void;
  /** Current fired-occurrence keys, for persisting alongside reminders. */
  getTriggeredOccurrenceKeys: () => string[];
}

export function createReminderScheduler(
  dependencies: ReminderSchedulerDependencies,
): ReminderSchedulerController {
  const now = dependencies.now ?? (() => new Date());
  const setTimer = dependencies.setTimer
    ?? ((callback, delayMs) => globalThis.setTimeout(callback, delayMs));
  const clearTimer = dependencies.clearTimer
    ?? ((timer) => globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>));
  /** occurrenceKey -> scheduledAt(ms) for pruning and persistence. */
  const triggeredOccurrences = new Map<string, number>();
  let timer: unknown;
  let disposed = false;
  let reconciling = false;
  let reconcileRequested = false;
  let lastTrigger: ReminderTriggerPayload | undefined;
  let missedOccurrences: MissedReminderRuntime[] = [];

  function clearActiveTimer(): void {
    if (timer !== undefined) {
      clearTimer(timer);
      timer = undefined;
    }
  }

  function pruneTriggeredOccurrences(currentTime: Date): void {
    const cutoff = currentTime.getTime() - REMINDER_TRIGGERED_RETENTION_MS;
    for (const [key, scheduledAtMs] of triggeredOccurrences) {
      if (scheduledAtMs < cutoff) {
        triggeredOccurrences.delete(key);
      }
    }
  }

  // Seed from storage-provided state (if any) before the first reconcile so a
  // restart inside the grace window still de-duplicates against history.
  if (dependencies.getTriggeredOccurrences) {
    for (const key of dependencies.getTriggeredOccurrences()) {
      // Without a known schedule time, anchor to now so retention starts fresh.
      triggeredOccurrences.set(key, Date.now());
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
    pruneTriggeredOccurrences(currentTime);
    missedOccurrences = [];
    const enabledReminders = dependencies.getReminders().filter(({ enabled }) => enabled);
    const occurrences = enabledReminders.map((reminder) => ({
      occurrenceType: "reminder" as const,
      reminder,
      occurrence: evaluateReminderOccurrence(reminder, currentTime),
    }));
    const snoozeOccurrences = dependencies.getSnoozes().map((snooze) => ({
      occurrenceType: "snooze" as const,
      snooze,
      occurrence: evaluateSnoozeOccurrence(snooze, currentTime),
    }));

    for (const { reminder, occurrence } of occurrences) {
      if (reminder.scheduleType === "once" && occurrence.status === "expired") {
        await dependencies.setReminderEnabled(reminder.id, false);
        reconcileRequested = true;
        missedOccurrences.push({
          id: reminder.id,
          occurrenceType: "reminder",
          text: reminder.text,
          scheduledAt: occurrence.scheduledAt?.toISOString()
            ?? createLocalOnceDate(reminder).toISOString(),
        });
      }
    }

    for (const { snooze, occurrence } of snoozeOccurrences) {
      if (occurrence.status === "expired") {
        await dependencies.deleteSnooze(snooze.id);
        reconcileRequested = true;
        missedOccurrences.push({
          id: snooze.reminderId,
          occurrenceType: "snooze",
          text: snooze.text,
          scheduledAt: new Date(snooze.triggerAt).toISOString(),
        });
      }
    }

    const dueOccurrences = [...occurrences, ...snoozeOccurrences]
      .filter(({ occurrence }) => occurrence.status === "due" && occurrence.scheduledAt)
      .sort((left, right) =>
        left.occurrence.scheduledAt!.getTime() - right.occurrence.scheduledAt!.getTime()
      );

    for (const candidate of dueOccurrences) {
      const { occurrence } = candidate;
      const scheduledAt = occurrence.scheduledAt!;
      const occurrenceKey = candidate.occurrenceType === "reminder"
        ? createOccurrenceKey(candidate.reminder.id, scheduledAt)
        : createSnoozeOccurrenceKey(candidate.snooze);
      if (triggeredOccurrences.has(occurrenceKey)) {
        continue;
      }

      triggeredOccurrences.set(occurrenceKey, scheduledAt.getTime());
      try {
        if (
          candidate.occurrenceType === "reminder"
          && candidate.reminder.scheduleType === "once"
        ) {
          await dependencies.setReminderEnabled(candidate.reminder.id, false);
          reconcileRequested = true;
        }

        const payload = candidate.occurrenceType === "reminder"
          ? createReminderTriggerPayload(candidate.reminder, scheduledAt, now())
          : createSnoozeTriggerPayload(candidate.snooze, scheduledAt, now());
        await dependencies.publishTrigger(payload);
        lastTrigger = payload;

        if (candidate.occurrenceType === "snooze") {
          await dependencies.deleteSnooze(candidate.snooze.id);
          reconcileRequested = true;
        }
      } catch (error) {
        triggeredOccurrences.delete(occurrenceKey);
        throw error;
      }
    }

    if (dueOccurrences.length > 0 && dependencies.markTriggered) {
      // Best effort: failures are logged inside the manager via lastError and
      // must not abort reconciliation.
      await dependencies.markTriggered([...triggeredOccurrences.keys()])
        .catch((error: unknown) => {
          console.error("Failed to persist triggered reminder occurrences.", error);
        });
    }

    const nextReminder = findNextReminder(
      dependencies.getReminders(),
      now(),
      triggeredOccurrences,
      dependencies.getSnoozes(),
    );
    dependencies.updateRuntime({
      status: "enabled",
      nextReminder,
      lastTrigger,
      ...(missedOccurrences.length > 0 ? { missed: missedOccurrences } : {}),
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

  return {
    refresh,
    dispose,
    restoreTriggeredOccurrences(keys) {
      for (const key of keys) {
        // Anchor to now: retention restarts from restore time.
        triggeredOccurrences.set(key, Date.now());
      }
    },
    getTriggeredOccurrenceKeys() {
      return [...triggeredOccurrences.keys()];
    },
  };
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

export function evaluateSnoozeOccurrence(
  snooze: ReminderSnooze,
  now: Date,
  graceWindowMs = REMINDER_GRACE_WINDOW_MS,
): ReminderOccurrence {
  const scheduledAt = new Date(snooze.triggerAt);
  const differenceMs = now.getTime() - scheduledAt.getTime();

  if (differenceMs < 0) {
    return { status: "future", scheduledAt };
  }
  if (differenceMs <= graceWindowMs) {
    return { status: "due", scheduledAt };
  }
  return { status: "expired", scheduledAt };
}

export function findNextReminder(
  reminders: readonly Reminder[],
  now: Date,
  triggeredOccurrences: { has: (key: string) => boolean } = new Set(),
  snoozes: readonly ReminderSnooze[] = [],
): NextReminderRuntime | undefined {
  const hasTriggered = (key: string): boolean => triggeredOccurrences.has(key);
  const reminderCandidates = reminders
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
        && hasTriggered(createOccurrenceKey(reminder.id, scheduledAt))
      ) {
        scheduledAt = createLocalDailyDate(now, reminder.time, 1);
      }

      return [{
        id: reminder.id,
        occurrenceId: createOccurrenceKey(reminder.id, scheduledAt),
        occurrenceType: "reminder" as const,
        text: reminder.text,
        scheduleType: reminder.scheduleType,
        scheduledAt,
      }];
    });
  const snoozeCandidates = snoozes.flatMap((snooze) => {
    const occurrence = evaluateSnoozeOccurrence(snooze, now);
    if (
      !occurrence.scheduledAt
      || occurrence.status === "expired"
      || hasTriggered(createSnoozeOccurrenceKey(snooze))
    ) {
      return [];
    }

    return [{
      id: snooze.reminderId,
      occurrenceId: snooze.id,
      occurrenceType: "snooze" as const,
      text: snooze.text,
      scheduleType: snooze.scheduleType,
      scheduledAt: occurrence.scheduledAt,
    }];
  });
  const candidates = [...reminderCandidates, ...snoozeCandidates]
    .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime());
  const next = candidates[0];

  return next
    ? {
        id: next.id,
        occurrenceId: next.occurrenceId,
        occurrenceType: next.occurrenceType,
        text: next.text,
        scheduleType: next.scheduleType,
        nextTriggerAt: next.scheduledAt.toISOString(),
      }
    : undefined;
}

export function useReminderScheduler(): void {
  const scheduler = createReminderScheduler({
    getReminders: () => reminderManager.reminders.value,
    getSnoozes: () => reminderManager.snoozes.value,
    isEnabled: () => settingsManager.settings.value.reminder.enabled,
    setReminderEnabled: (id, enabled) => reminderManager.setEnabled(id, enabled),
    deleteSnooze: (id) => reminderManager.deleteSnooze(id),
    publishTrigger: publishReminderTrigger,
    updateRuntime: updateReminderRuntime,
    markTriggered: (keys) => reminderManager.markTriggeredOccurrences(keys),
    getTriggeredOccurrences: () => [...reminderManager.triggeredOccurrences.value],
  });
  let ready = false;

  void Promise.all([
    reminderManager.initialize(),
    settingsManager.initialize(),
  ]).then(() => {
    // Restore persisted occurrence history before the first reconcile so a
    // restart inside the grace window still de-duplicates.
    scheduler.restoreTriggeredOccurrences([
      ...reminderManager.triggeredOccurrences.value,
    ]);
    ready = true;
    return scheduler.refresh();
  }).catch((error: unknown) => {
    console.error("Failed to initialize reminder scheduler.", error);
  });

  const stopWatching = watch(
    [
      () => settingsManager.settings.value.reminder.enabled,
      reminderManager.reminders,
      reminderManager.snoozes,
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

function createSnoozeOccurrenceKey(snooze: ReminderSnooze): string {
  return `snooze:${snooze.id}:${snooze.triggerAt}`;
}

function createReminderTriggerPayload(
  reminder: Reminder,
  scheduledAt: Date,
  triggeredAt: Date,
): ReminderTriggerPayload {
  return {
    id: reminder.id,
    occurrenceId: createOccurrenceKey(reminder.id, scheduledAt),
    occurrenceType: "reminder",
    text: reminder.text,
    scheduleType: reminder.scheduleType,
    scheduledAt: scheduledAt.toISOString(),
    triggeredAt: triggeredAt.toISOString(),
    soundEnabled: reminder.soundEnabled,
    soundId: reminder.soundId,
  };
}

function createSnoozeTriggerPayload(
  snooze: ReminderSnooze,
  scheduledAt: Date,
  triggeredAt: Date,
): ReminderTriggerPayload {
  return {
    id: snooze.reminderId,
    occurrenceId: snooze.id,
    occurrenceType: "snooze",
    text: snooze.text,
    scheduleType: snooze.scheduleType,
    scheduledAt: scheduledAt.toISOString(),
    triggeredAt: triggeredAt.toISOString(),
    soundEnabled: snooze.soundEnabled,
    soundId: snooze.soundId,
  };
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
