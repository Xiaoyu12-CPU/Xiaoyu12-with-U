export type ReminderScheduleType = "once" | "daily";
export type ReminderSoundId = "default" | "soft" | "digital";
export type ReminderOccurrenceType = "reminder" | "snooze";

export interface Reminder {
  id: string;
  text: string;
  enabled: boolean;
  scheduleType: ReminderScheduleType;
  date: string | null;
  time: string;
  soundEnabled: boolean;
  soundId: ReminderSoundId | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderInput {
  text: string;
  enabled: boolean;
  scheduleType: ReminderScheduleType;
  date: string | null;
  time: string;
  soundEnabled: boolean;
  soundId: ReminderSoundId | null;
}

export interface ReminderSnooze {
  id: string;
  reminderId: string;
  scheduleType: ReminderScheduleType;
  text: string;
  soundEnabled: boolean;
  soundId: ReminderSoundId | null;
  triggerAt: string;
  createdAt: string;
}

export type ReminderSnoozeInput = Omit<ReminderSnooze, "id" | "createdAt">;

export interface ReminderStorageDocument {
  schemaVersion: 1;
  reminders: Reminder[];
  snoozes: ReminderSnooze[];
}

export interface ReminderTriggerPayload {
  id: string;
  occurrenceId: string;
  occurrenceType: ReminderOccurrenceType;
  text: string;
  scheduleType: ReminderScheduleType;
  scheduledAt: string;
  triggeredAt: string;
  soundEnabled: boolean;
  soundId: ReminderSoundId | null;
}

export interface NextReminderRuntime {
  id: string;
  occurrenceId: string;
  occurrenceType: ReminderOccurrenceType;
  text: string;
  scheduleType: ReminderScheduleType;
  nextTriggerAt: string;
}
