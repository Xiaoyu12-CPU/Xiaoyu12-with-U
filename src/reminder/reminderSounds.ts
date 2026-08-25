import defaultSoundUrl from "../assets/sounds/reminders/default.wav?url";
import digitalSoundUrl from "../assets/sounds/reminders/digital.wav?url";
import softSoundUrl from "../assets/sounds/reminders/soft.wav?url";
import type { ReminderSoundId } from "./reminderTypes";

export interface ReminderSoundDefinition {
  id: ReminderSoundId;
  label: string;
  url: string;
}

export const DEFAULT_REMINDER_SOUND_ID: ReminderSoundId = "default";

export const REMINDER_SOUNDS: readonly ReminderSoundDefinition[] = [
  { id: "default", label: "默认提醒音", url: defaultSoundUrl },
  { id: "soft", label: "柔和", url: softSoundUrl },
  { id: "digital", label: "电子", url: digitalSoundUrl },
];

export function isReminderSoundId(value: unknown): value is ReminderSoundId {
  return REMINDER_SOUNDS.some(({ id }) => id === value);
}

export function resolveReminderSound(
  soundId: string | null | undefined,
): ReminderSoundDefinition {
  return REMINDER_SOUNDS.find(({ id }) => id === soundId)
    ?? REMINDER_SOUNDS.find(({ id }) => id === DEFAULT_REMINDER_SOUND_ID)!;
}
