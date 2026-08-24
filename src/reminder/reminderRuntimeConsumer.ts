import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentScope, onScopeDispose } from "vue";
import {
  requestState,
} from "../pet/behavior";
import type { BehaviorRequestInput } from "../pet/behavior";
import { triggerDialogueEvent } from "../pet/dialogue";
import type { TriggerDialogueEventOptions } from "../pet/dialogue";
import { DIALOGUE_EVENT_TYPES } from "../pet/dialogueEvents";
import { REMINDER_TRIGGERED_EVENT } from "./reminderScheduler";
import type { ReminderTriggerPayload } from "./reminderTypes";

export const REMINDER_ALERT_DURATION_MS = 5_000;
export const REMINDER_BEHAVIOR_SOURCE_PREFIX = "reminder.active:";
const REMINDER_TEXT_FALLBACK = "提醒时间到了";

interface ReminderRuntimeConsumerDependencies {
  requestBehavior?: (input: BehaviorRequestInput) => unknown;
  triggerDialogue?: (
    type: typeof DIALOGUE_EVENT_TYPES.REMINDER,
    options: TriggerDialogueEventOptions,
  ) => void;
}

export function handleReminderTrigger(
  payload: ReminderTriggerPayload,
  dependencies: ReminderRuntimeConsumerDependencies = {},
): void {
  const requestBehavior = dependencies.requestBehavior ?? requestState;
  const triggerDialogue = dependencies.triggerDialogue ?? triggerDialogueEvent;

  try {
    requestBehavior({
      source: createReminderBehaviorSource(payload.id),
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

export function createReminderBehaviorSource(reminderId: string): string {
  return `${REMINDER_BEHAVIOR_SOURCE_PREFIX}${reminderId}`;
}
