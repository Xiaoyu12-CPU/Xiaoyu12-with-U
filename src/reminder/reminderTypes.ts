export type ReminderScheduleType = "once" | "daily";
export type ReminderSoundId = "default" | "soft" | "digital";

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

export interface ReminderStorageDocument {
  schemaVersion: 1;
  reminders: Reminder[];
}

export interface ReminderTriggerPayload {
  id: string;
  text: string;
  scheduleType: ReminderScheduleType;
  scheduledAt: string;
  triggeredAt: string;
  soundEnabled: boolean;
  soundId: ReminderSoundId | null;
}

export interface NextReminderRuntime {
  id: string;
  text: string;
  scheduleType: ReminderScheduleType;
  nextTriggerAt: string;
}
