export type ReminderScheduleType = "once" | "daily";

export interface Reminder {
  id: string;
  text: string;
  enabled: boolean;
  scheduleType: ReminderScheduleType;
  date: string | null;
  time: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderInput {
  text: string;
  enabled: boolean;
  scheduleType: ReminderScheduleType;
  date: string | null;
  time: string;
}

export interface ReminderStorageDocument {
  schemaVersion: 1;
  reminders: Reminder[];
}
