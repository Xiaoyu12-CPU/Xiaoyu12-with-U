import type {
  ReminderSnoozeInput,
  ReminderTriggerPayload,
} from "./reminderTypes";

export const SNOOZE_OPTIONS_MINUTES = [5, 10, 30] as const;
export type SnoozeMinutes = typeof SNOOZE_OPTIONS_MINUTES[number];

export function isSnoozeMinutes(value: number): value is SnoozeMinutes {
  return SNOOZE_OPTIONS_MINUTES.includes(value as SnoozeMinutes);
}

export function createReminderSnoozeInput(
  payload: ReminderTriggerPayload,
  minutes: number,
  now = new Date(),
): ReminderSnoozeInput {
  if (!isSnoozeMinutes(minutes)) {
    throw new Error(`Unsupported snooze duration: ${minutes}`);
  }

  return {
    reminderId: payload.id,
    scheduleType: payload.scheduleType,
    text: payload.text,
    soundEnabled: payload.soundEnabled,
    soundId: payload.soundId,
    triggerAt: new Date(now.getTime() + minutes * 60_000).toISOString(),
  };
}
