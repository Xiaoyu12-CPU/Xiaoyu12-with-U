import { getCurrentScope, onScopeDispose, watch } from "vue";
import { triggerDialogueEvent } from "../pet/dialogue";
import { DIALOGUE_EVENT_TYPES } from "../pet/dialogueEvents";
import { usePetRuntimeStatus } from "../pet/runtimeStatus";
import { settingsManager } from "../settings/settingsManager";
import type { DesktopPetSettings } from "../settings/settingsTypes";
import { subscribeToTypingActivity } from "./keyboardMonitor";
import { createTypingFeedbackController } from "./typingFeedback";
import type {
  TypingFeedbackConfig,
  TypingFeedbackController,
  TypingFeedbackKind,
} from "./typingFeedback";
import type { KeyboardMonitorStatus } from "./types";

export interface TypingFeedbackRuntimeInput {
  keyboardEnabled: boolean;
  keyboardStatus: KeyboardMonitorStatus;
  config: TypingFeedbackConfig;
}

export interface TypingFeedbackRuntimeController {
  update: (input: TypingFeedbackRuntimeInput) => void;
  recordTypingActivity: (timestamp: number) => void;
  reset: () => void;
  feedback: TypingFeedbackController;
}

export function createTypingFeedbackRuntimeController(
  initialConfig: TypingFeedbackConfig,
  showFeedback: (kind: TypingFeedbackKind, text: string) => boolean,
): TypingFeedbackRuntimeController {
  const feedback = createTypingFeedbackController(
    initialConfig,
    { showFeedback },
  );
  let monitorActive = false;

  function update(input: TypingFeedbackRuntimeInput): void {
    feedback.updateConfig(input.config);
    const nextMonitorActive = input.keyboardEnabled
      && input.keyboardStatus === "active";
    if (!nextMonitorActive || !monitorActive) {
      feedback.reset();
    }
    monitorActive = nextMonitorActive;
  }

  function recordTypingActivity(timestamp: number): void {
    if (monitorActive) {
      feedback.recordTypingActivity(timestamp);
    }
  }

  function reset(): void {
    monitorActive = false;
    feedback.reset();
  }

  return { update, recordTypingActivity, reset, feedback };
}

export function useTypingFeedback(): void {
  const { snapshot } = usePetRuntimeStatus();
  const controller = createTypingFeedbackRuntimeController(
    toTypingFeedbackConfig(settingsManager.settings.value.input),
    (kind, text) => {
      return triggerDialogueEvent(
        typingFeedbackEventType(kind),
        { textOverride: text, priority: "low" },
      );
    },
  );

  const unsubscribeTyping = subscribeToTypingActivity((timestamp) => {
    controller.recordTypingActivity(timestamp);
  });

  const stopWatching = watch(
    () => ({
      input: settingsManager.settings.value.input,
      keyboardStatus: snapshot.value.keyboardStatus,
    }),
    ({ input, keyboardStatus }) => {
      controller.update({
        keyboardEnabled: input.keyboardEnabled,
        keyboardStatus,
        config: toTypingFeedbackConfig(input),
      });
    },
    { immediate: true },
  );

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stopWatching();
      unsubscribeTyping();
      controller.reset();
    });
  }
}

export function toTypingFeedbackConfig(
  input: DesktopPetSettings["input"],
): TypingFeedbackConfig {
  return {
    busyEnabled: input.typingBusyEnabled,
    busyWindowSeconds: input.typingBusyWindowSeconds,
    busyCountThreshold: input.typingBusyCountThreshold,
    busyText: input.typingBusyText,
    speedEnabled: input.typingSpeedEnabled,
    speedThresholdPerSecond: input.typingSpeedThresholdPerSecond,
    speedText: input.typingSpeedText,
    cooldownSeconds: input.typingFeedbackCooldownSeconds,
  };
}

export function typingFeedbackEventType(
  kind: TypingFeedbackKind,
): typeof DIALOGUE_EVENT_TYPES.KEYBOARD_BUSY
  | typeof DIALOGUE_EVENT_TYPES.KEYBOARD_SPEED {
  return kind === "busy"
    ? DIALOGUE_EVENT_TYPES.KEYBOARD_BUSY
    : DIALOGUE_EVENT_TYPES.KEYBOARD_SPEED;
}
