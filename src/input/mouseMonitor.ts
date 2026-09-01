import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentScope, onScopeDispose, watch } from "vue";
import { updateMouseRuntime } from "../pet/runtimeStatus";
import { settingsManager } from "../settings/settingsManager";
import { createMouseInputRuntime } from "./mouseRuntime";
import type {
  MouseInputEvent,
  NativeMouseMonitorSnapshot,
} from "./types";

const MOUSE_INPUT_EVENT = "desktop-pet://mouse-input";
const MOUSE_STATUS_EVENT = "desktop-pet://mouse-status";
export const MOUSE_PERMISSION_RETRY_INTERVAL_MS = 2000;

export interface MouseNativeAdapter {
  start: () => Promise<NativeMouseMonitorSnapshot>;
  stop: () => Promise<NativeMouseMonitorSnapshot>;
}

export function createMouseMonitorController(
  adapter: MouseNativeAdapter,
  runtime = createMouseInputRuntime(),
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

  function applyNativeStatus(snapshot: NativeMouseMonitorSnapshot): void {
    nativeStarted = snapshot.status === "active";
    runtime.applyStatus(snapshot);
  }

  return {
    runtime,
    start,
    stop,
    applyNativeStatus,
    handleNativeEvent: runtime.applyEvent,
  };
}

const tauriMouseAdapter: MouseNativeAdapter = {
  start: () => invoke("start_mouse_monitor"),
  stop: () => invoke("stop_mouse_monitor"),
};

export function useMouseMonitor(): void {
  const runtime = createMouseInputRuntime(updateMouseRuntime);
  const controller = createMouseMonitorController(tauriMouseAdapter, runtime);
  let disposed = false;
  let unlistenInput: UnlistenFn | undefined;
  let unlistenStatus: UnlistenFn | undefined;
  let stopWatching: (() => void) | undefined;
  let permissionRetryTimer: ReturnType<typeof setInterval> | undefined;

  function reconcilePermissionRetry(): void {
    const shouldRetry = !disposed
      && settingsManager.settings.value.input.mouseEnabled
      && runtime.getSnapshot().status === "permission-required";
    if (shouldRetry && permissionRetryTimer === undefined) {
      permissionRetryTimer = setInterval(() => {
        void controller.start().then(reconcilePermissionRetry);
      }, MOUSE_PERMISSION_RETRY_INTERVAL_MS);
    } else if (!shouldRetry && permissionRetryTimer !== undefined) {
      clearInterval(permissionRetryTimer);
      permissionRetryTimer = undefined;
    }
  }

  async function initialize(): Promise<void> {
    if (!isTauri()) {
      controller.applyNativeStatus({ status: "unsupported" });
      return;
    }

    [unlistenInput, unlistenStatus] = await Promise.all([
      listen<MouseInputEvent>(MOUSE_INPUT_EVENT, ({ payload }) => {
        controller.handleNativeEvent(payload);
      }),
      listen<NativeMouseMonitorSnapshot>(MOUSE_STATUS_EVENT, ({ payload }) => {
        controller.applyNativeStatus(payload);
        reconcilePermissionRetry();
      }),
    ]);

    await settingsManager.initialize();
    if (disposed) {
      unlistenInput();
      unlistenStatus();
      return;
    }

    stopWatching = watch(
      () => settingsManager.settings.value.input.mouseEnabled,
      (enabled) => {
        reconcilePermissionRetry();
        void (enabled ? controller.start() : controller.stop())
          .then(reconcilePermissionRetry);
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
    if (permissionRetryTimer !== undefined) {
      clearInterval(permissionRetryTimer);
      permissionRetryTimer = undefined;
    }
    unlistenInput?.();
    unlistenStatus?.();
    void controller.stop();
  }

  if (getCurrentScope()) {
    onScopeDispose(dispose);
  }
}
