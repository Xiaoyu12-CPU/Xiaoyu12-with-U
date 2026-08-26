import { getCurrentScope, onScopeDispose, watch } from "vue";
import {
  BEHAVIOR_SOURCES,
  releaseState,
  requestState,
} from "../pet/behavior";
import {
  updateKeyboardActivityRuntime,
  usePetRuntimeStatus,
} from "../pet/runtimeStatus";
import { settingsManager } from "../settings/settingsManager";
import type { KeyboardMonitorStatus } from "./types";

export const KEYBOARD_ACTIVITY_IDLE_MS = 2000;

export interface KeyboardActivityInput {
  keyboardEnabled: boolean;
  keyboardStatus: KeyboardMonitorStatus;
  pressedKeys: readonly string[];
  lastActivityAt?: number;
}

export interface KeyboardActivityBehaviorController {
  update: (input: KeyboardActivityInput) => void;
  dispose: () => void;
  isActive: () => boolean;
}

interface KeyboardActivityBehaviorDependencies {
  requestBehavior?: typeof requestState;
  releaseBehavior?: typeof releaseState;
  onActivityChange?: (active: boolean) => void;
  now?: () => number;
  setTimer?: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

export function createKeyboardActivityBehaviorController(
  dependencies: KeyboardActivityBehaviorDependencies = {},
): KeyboardActivityBehaviorController {
  const requestBehavior = dependencies.requestBehavior ?? requestState;
  const releaseBehavior = dependencies.releaseBehavior ?? releaseState;
  const onActivityChange = dependencies.onActivityChange ?? (() => {});
  const now = dependencies.now ?? Date.now;
  const setTimer = dependencies.setTimer ?? setTimeout;
  const clearTimer = dependencies.clearTimer ?? clearTimeout;
  let currentInput: KeyboardActivityInput | undefined;
  let lastObservedActivityAt: number | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let active = false;
  let disposed = false;

  function clearIdleTimer(): void {
    if (idleTimer !== undefined) {
      clearTimer(idleTimer);
      idleTimer = undefined;
    }
  }

  function activate(): void {
    if (active) return;
    active = true;
    requestBehavior({
      source: BEHAVIOR_SOURCES.INPUT_KEYBOARD,
      state: "working",
    });
    onActivityChange(true);
  }

  function deactivate(): void {
    clearIdleTimer();
    if (!active) return;
    active = false;
    releaseBehavior(BEHAVIOR_SOURCES.INPUT_KEYBOARD);
    onActivityChange(false);
  }

  function scheduleIdleCheck(): void {
    clearIdleTimer();
    if (!active || lastObservedActivityAt === undefined) return;

    const delayMs = Math.max(
      0,
      lastObservedActivityAt + KEYBOARD_ACTIVITY_IDLE_MS - now(),
    );
    idleTimer = setTimer(() => {
      idleTimer = undefined;
      if (!active || !currentInput) return;
      if (
        !currentInput.keyboardEnabled
        || currentInput.keyboardStatus !== "active"
      ) {
        deactivate();
        return;
      }
      if (currentInput.pressedKeys.length > 0) {
        return;
      }
      if (
        lastObservedActivityAt !== undefined
        && now() - lastObservedActivityAt < KEYBOARD_ACTIVITY_IDLE_MS
      ) {
        scheduleIdleCheck();
        return;
      }
      deactivate();
    }, delayMs);
  }

  function update(input: KeyboardActivityInput): void {
    if (disposed) return;
    currentInput = {
      ...input,
      pressedKeys: [...input.pressedKeys],
    };

    if (!input.keyboardEnabled || input.keyboardStatus !== "active") {
      lastObservedActivityAt = input.lastActivityAt;
      deactivate();
      return;
    }

    const hasNewActivity = input.lastActivityAt !== undefined
      && input.lastActivityAt !== lastObservedActivityAt;
    if (hasNewActivity) {
      lastObservedActivityAt = input.lastActivityAt;
      activate();
      scheduleIdleCheck();
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    deactivate();
    currentInput = undefined;
  }

  return {
    update,
    dispose,
    isActive: () => active,
  };
}

export function useKeyboardActivityBehavior(): void {
  const { snapshot } = usePetRuntimeStatus();
  const controller = createKeyboardActivityBehaviorController({
    onActivityChange(active) {
      updateKeyboardActivityRuntime(active ? "active" : "idle");
    },
  });

  const stopWatching = watch(
    () => ({
      keyboardEnabled: settingsManager.settings.value.input.keyboardEnabled,
      keyboardStatus: snapshot.value.keyboardStatus,
      pressedKeys: snapshot.value.pressedKeys,
      lastActivityAt: snapshot.value.lastKeyboardActivityAt,
    }),
    (input) => controller.update(input),
    { immediate: true },
  );

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stopWatching();
      controller.dispose();
    });
  }
}
