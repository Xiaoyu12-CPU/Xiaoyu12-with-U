import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentScope, onScopeDispose, watch } from "vue";
import { updateKeyboardRuntime } from "../pet/runtimeStatus";
import { settingsManager } from "../settings/settingsManager";
import { createKeyboardInputRuntime } from "./keyboardRuntime";
import type {
  KeyboardInputEvent,
  NativeKeyboardMonitorSnapshot,
} from "./types";

const KEYBOARD_INPUT_EVENT = "desktop-pet://keyboard-input";
const KEYBOARD_STATUS_EVENT = "desktop-pet://keyboard-status";

export interface KeyboardNativeAdapter {
  start: () => Promise<NativeKeyboardMonitorSnapshot>;
  stop: () => Promise<NativeKeyboardMonitorSnapshot>;
}

export type TypingActivityListener = (timestamp: number) => void;
const typingActivityListeners = new Set<TypingActivityListener>();

export interface KeyboardMonitorControllerOptions {
  onTypingActivity?: TypingActivityListener;
}

export function createKeyboardMonitorController(
  adapter: KeyboardNativeAdapter,
  runtime = createKeyboardInputRuntime(),
  options: KeyboardMonitorControllerOptions = {},
) {
  let desiredEnabled = false;
  let nativeStarted = false;
  let startPromise: Promise<void> | undefined;

  async function start(): Promise<void> {
    desiredEnabled = true;
    if (nativeStarted) {
      return;
    }
    if (startPromise) {
      return startPromise;
    }

    runtime.applyStatus({ status: "starting" });
    const pendingStart = (async () => {
      try {
        const snapshot = await adapter.start();
        nativeStarted = snapshot.status === "active";
        runtime.applyStatus(snapshot);
        if (!desiredEnabled) {
          await stopNative();
        }
      } catch (error) {
        nativeStarted = false;
        runtime.applyStatus({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    startPromise = pendingStart;
    try {
      await pendingStart;
    } finally {
      startPromise = undefined;
    }
  }

  async function stopNative(): Promise<void> {
    try {
      await adapter.stop();
    } catch (error) {
      runtime.applyStatus({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    nativeStarted = false;
    runtime.disable();
  }

  async function stop(): Promise<void> {
    desiredEnabled = false;
    if (startPromise) {
      await startPromise;
      if (!desiredEnabled && nativeStarted) {
        await stopNative();
      }
      return;
    }
    await stopNative();
  }

  function applyNativeStatus(snapshot: NativeKeyboardMonitorSnapshot): void {
    nativeStarted = snapshot.status === "active";
    runtime.applyStatus(snapshot);
  }

  function handleNativeEvent(event: KeyboardInputEvent): boolean {
    const accepted = runtime.applyEvent(event);
    if (accepted && isTypingActivityEvent(event)) {
      options.onTypingActivity?.(event.timestamp);
    }
    return accepted;
  }

  return {
    runtime,
    start,
    stop,
    applyNativeStatus,
    handleNativeEvent,
  };
}

export function subscribeToTypingActivity(
  listener: TypingActivityListener,
): () => void {
  typingActivityListeners.add(listener);
  return () => typingActivityListeners.delete(listener);
}

export function isTypingActivityEvent(event: KeyboardInputEvent): boolean {
  return event.eventType === "down" && !MODIFIER_KEYS.has(event.key);
}

const MODIFIER_KEYS = new Set(["Shift", "Control", "Option", "Command"]);

function publishTypingActivity(timestamp: number): void {
  for (const listener of typingActivityListeners) {
    listener(timestamp);
  }
}

const tauriKeyboardAdapter: KeyboardNativeAdapter = {
  start: () => invoke("start_keyboard_monitor"),
  stop: () => invoke("stop_keyboard_monitor"),
};

export function useKeyboardMonitor(): void {
  const runtime = createKeyboardInputRuntime(updateKeyboardRuntime);
  const controller = createKeyboardMonitorController(
    tauriKeyboardAdapter,
    runtime,
    { onTypingActivity: publishTypingActivity },
  );
  let disposed = false;
  let unlistenInput: UnlistenFn | undefined;
  let unlistenStatus: UnlistenFn | undefined;
  let stopWatching: (() => void) | undefined;

  async function initialize(): Promise<void> {
    if (!isTauri()) {
      controller.applyNativeStatus({ status: "unsupported" });
      return;
    }

    [unlistenInput, unlistenStatus] = await Promise.all([
      listen<KeyboardInputEvent>(KEYBOARD_INPUT_EVENT, ({ payload }) => {
        controller.handleNativeEvent(payload);
      }),
      listen<NativeKeyboardMonitorSnapshot>(KEYBOARD_STATUS_EVENT, ({ payload }) => {
        controller.applyNativeStatus(payload);
      }),
    ]);

    await settingsManager.initialize();
    if (disposed) {
      unlistenInput();
      unlistenStatus();
      return;
    }

    stopWatching = watch(
      () => settingsManager.settings.value.input.keyboardEnabled,
      (enabled) => {
        void (enabled ? controller.start() : controller.stop());
      },
      { immediate: true },
    );
  }

  void initialize().catch((error: unknown) => {
    controller.applyNativeStatus({
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  });

  function dispose(): void {
    disposed = true;
    stopWatching?.();
    unlistenInput?.();
    unlistenStatus?.();
    void controller.stop();
  }

  if (getCurrentScope()) {
    onScopeDispose(dispose);
  }
}
