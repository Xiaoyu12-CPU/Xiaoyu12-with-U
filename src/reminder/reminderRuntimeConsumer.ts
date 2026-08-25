import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentScope, onScopeDispose, readonly, ref } from "vue";
import { releaseState, requestState } from "../pet/behavior";
import type { BehaviorRequestInput } from "../pet/behavior";
import { triggerDialogueEvent } from "../pet/dialogue";
import type { TriggerDialogueEventOptions } from "../pet/dialogue";
import { DIALOGUE_EVENT_TYPES } from "../pet/dialogueEvents";
import { settingsManager } from "../settings/settingsManager";
import { reminderManager } from "./reminderManager";
import { REMINDER_TRIGGERED_EVENT } from "./reminderScheduler";
import {
  playReminderSound,
  stopReminderSound,
} from "./reminderSoundPlayer";
import { createReminderSnoozeInput } from "./reminderSnooze";
import type { ReminderSnooze, ReminderTriggerPayload } from "./reminderTypes";

export const REMINDER_ALERT_DURATION_MS = 5_000;
export const REMINDER_BEHAVIOR_SOURCE_PREFIX = "reminder.active:";
const REMINDER_TEXT_FALLBACK = "提醒时间到了";
const activeReminderFeedbackState = ref<ReminderTriggerPayload>();
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

export const activeReminderFeedback = readonly(activeReminderFeedbackState);

interface ReminderRuntimeConsumerDependencies {
  requestBehavior?: (input: BehaviorRequestInput) => unknown;
  triggerDialogue?: (
    type: typeof DIALOGUE_EVENT_TYPES.REMINDER,
    options: TriggerDialogueEventOptions,
  ) => void;
  playSound?: (
    soundId: ReminderTriggerPayload["soundId"],
    volume: number,
  ) => Promise<void>;
  getSoundVolume?: () => number;
}

interface ReminderFeedbackActionDependencies {
  releaseBehavior?: (source: string) => void;
  hideDialogue?: () => void;
  stopSound?: () => void;
  createSnooze?: (
    input: ReturnType<typeof createReminderSnoozeInput>,
  ) => Promise<ReminderSnooze>;
  now?: () => Date;
}

export function handleReminderTrigger(
  payload: ReminderTriggerPayload,
  dependencies: ReminderRuntimeConsumerDependencies = {},
): void {
  const requestBehavior = dependencies.requestBehavior ?? requestState;
  const triggerDialogue = dependencies.triggerDialogue ?? triggerDialogueEvent;
  const playSound = dependencies.playSound ?? playReminderSound;
  const getSoundVolume = dependencies.getSoundVolume
    ?? (() => settingsManager.settings.value.reminder.soundVolume);
  activateReminderFeedback(payload);

  try {
    requestBehavior({
      source: createReminderBehaviorSource(getReminderOccurrenceId(payload)),
      state: "alert",
      durationMs: REMINDER_ALERT_DURATION_MS,
    });
  } catch (error) {
    console.error("Failed to apply Reminder alert behavior.", error);
  }

  try {
    triggerDialogue(DIALOGUE_EVENT_TYPES.REMINDER, {
      textOverride: payload.text.trim() || REMINDER_TEXT_FALLBACK,
      context: {
        reminderId: payload.id,
        scheduleType: payload.scheduleType,
        scheduledAt: payload.scheduledAt,
        triggeredAt: payload.triggeredAt,
      },
    });
  } catch (error) {
    console.error("Failed to show Reminder dialogue.", error);
  }

  if (payload.soundEnabled) {
    try {
      void playSound(payload.soundId, getSoundVolume()).catch((error: unknown) => {
        console.error("Failed to play Reminder sound.", error);
      });
    } catch (error) {
      console.error("Failed to start Reminder sound playback.", error);
    }
  }
}

export function dismissReminderFeedback(
  occurrenceId: string,
  dependencies: ReminderFeedbackActionDependencies = {},
): boolean {
  const feedback = activeReminderFeedbackState.value;
  if (!feedback || getReminderOccurrenceId(feedback) !== occurrenceId) {
    return false;
  }

  const releaseBehavior = dependencies.releaseBehavior ?? releaseState;
  releaseBehavior(
    createReminderBehaviorSource(getReminderOccurrenceId(feedback)),
  );
  dependencies.hideDialogue?.();
  (dependencies.stopSound ?? stopReminderSound)();
  clearReminderFeedback();
  return true;
}

export async function snoozeReminderFeedback(
  occurrenceId: string,
  minutes: number,
  dependencies: ReminderFeedbackActionDependencies = {},
): Promise<ReminderSnooze | undefined> {
  const feedback = activeReminderFeedbackState.value;
  if (!feedback || getReminderOccurrenceId(feedback) !== occurrenceId) {
    return undefined;
  }

  const input = createReminderSnoozeInput(
    feedback,
    minutes,
    dependencies.now?.() ?? new Date(),
  );
  const snooze = await (
    dependencies.createSnooze?.(input)
    ?? reminderManager.createSnooze(input)
  );
  dismissReminderFeedback(occurrenceId, dependencies);
  return snooze;
}

export function useReminderRuntimeConsumer(): void {
  let disposed = false;
  let unlistenTrigger: UnlistenFn | undefined;

  if (isTauri()) {
    void listen<ReminderTriggerPayload>(
      REMINDER_TRIGGERED_EVENT,
      ({ payload }) => handleReminderTrigger(payload),
    ).then((unlisten) => {
      if (disposed) {
        unlisten();
      } else {
        unlistenTrigger = unlisten;
      }
    }).catch((error: unknown) => {
      console.error("Failed to listen for Reminder Trigger events.", error);
    });
  } else {
    const handleBrowserTrigger = (event: Event): void => {
      handleReminderTrigger(
        (event as CustomEvent<ReminderTriggerPayload>).detail,
      );
    };
    window.addEventListener(REMINDER_TRIGGERED_EVENT, handleBrowserTrigger);
    unlistenTrigger = () => {
      window.removeEventListener(REMINDER_TRIGGERED_EVENT, handleBrowserTrigger);
    };
  }

  function dispose(): void {
    disposed = true;
    unlistenTrigger?.();
  }

  if (getCurrentScope()) {
    onScopeDispose(dispose);
  }
}

export function createReminderBehaviorSource(occurrenceId: string): string {
  return `${REMINDER_BEHAVIOR_SOURCE_PREFIX}${occurrenceId}`;
}

function activateReminderFeedback(payload: ReminderTriggerPayload): void {
  clearFeedbackTimer();
  activeReminderFeedbackState.value = payload;
  const occurrenceId = getReminderOccurrenceId(payload);
  feedbackTimer = setTimeout(() => {
    if (
      activeReminderFeedbackState.value
      && getReminderOccurrenceId(activeReminderFeedbackState.value) === occurrenceId
    ) {
      activeReminderFeedbackState.value = undefined;
    }
    feedbackTimer = undefined;
  }, REMINDER_ALERT_DURATION_MS);
}

function clearReminderFeedback(): void {
  clearFeedbackTimer();
  activeReminderFeedbackState.value = undefined;
}

function clearFeedbackTimer(): void {
  if (feedbackTimer !== undefined) {
    clearTimeout(feedbackTimer);
    feedbackTimer = undefined;
  }
}

function getReminderOccurrenceId(payload: ReminderTriggerPayload): string {
  return payload.occurrenceId || `${payload.id}:${payload.scheduledAt}`;
}
