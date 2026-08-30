import { invoke, isTauri } from "@tauri-apps/api/core";
import { emit, emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  getCurrentScope,
  onScopeDispose,
  readonly,
  ref,
  watch,
} from "vue";
import type { PetControlAction } from "./petControl";
import { usePetRuntimeStatus } from "./runtimeStatus";
import type { PetRuntimeSnapshot } from "./runtimeStatus";

const CONTROL_CENTER_LABEL = "control-center";
const MAIN_WINDOW_LABEL = "main";
const CONTROL_ACTION_EVENT = "desktop-pet://control-action";
const STATUS_REQUEST_EVENT = "desktop-pet://status-request";
const STATUS_UPDATED_EVENT = "desktop-pet://status-updated";
const CONTROL_CENTER_NAVIGATION_EVENT =
  "desktop-pet://control-center-navigation";
const CONTROL_CENTER_NAVIGATION_READY_EVENT =
  "desktop-pet://control-center-navigation-ready";
const CONTROL_CENTER_NAVIGATION_ACK_EVENT =
  "desktop-pet://control-center-navigation-ack";
const OPEN_SYSTEM_MONITOR_SETTINGS_EVENT =
  "desktop-pet://open-system-monitor-settings";

export const CONTROL_CENTER_DESTINATIONS = {
  SYSTEM_MONITOR_SETTINGS: "system-monitor-settings",
} as const;

export type ControlCenterDestination =
  (typeof CONTROL_CENTER_DESTINATIONS)[keyof typeof CONTROL_CENTER_DESTINATIONS];

let pendingControlCenterDestination: ControlCenterDestination | undefined;

export async function openSystemMonitorSettings(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  if (getCurrentWindow().label !== MAIN_WINDOW_LABEL) {
    await emitTo(MAIN_WINDOW_LABEL, OPEN_SYSTEM_MONITOR_SETTINGS_EVENT);
    return;
  }

  pendingControlCenterDestination =
    CONTROL_CENTER_DESTINATIONS.SYSTEM_MONITOR_SETTINGS;

  try {
    await invoke("open_control_center");
    await publishPendingControlCenterNavigation();
  } catch (error) {
    pendingControlCenterDestination = undefined;
    throw error;
  }
}

export function useMainRuntimeBridge(
  executeAction: (action: PetControlAction) => void | Promise<void>,
): void {
  const { snapshot } = usePetRuntimeStatus();
  let disposed = false;
  let unlistenAction: UnlistenFn | undefined;
  let unlistenRequest: UnlistenFn | undefined;
  let unlistenNavigationReady: UnlistenFn | undefined;
  let unlistenNavigationAck: UnlistenFn | undefined;
  let unlistenOpenSystemSettings: UnlistenFn | undefined;

  async function publishStatus(): Promise<void> {
    if (!isTauri() || disposed) {
      return;
    }

    await emit(STATUS_UPDATED_EVENT, snapshot.value);
  }

  if (isTauri()) {
    void listen<PetControlAction>(CONTROL_ACTION_EVENT, ({ payload }) => {
      void executeAction(payload);
    }).then((unlisten) => {
      if (disposed) {
        unlisten();
      } else {
        unlistenAction = unlisten;
      }
    });

    void listen(STATUS_REQUEST_EVENT, () => {
      void publishStatus();
    }).then((unlisten) => {
      if (disposed) {
        unlisten();
      } else {
        unlistenRequest = unlisten;
      }
    });

    void listen(CONTROL_CENTER_NAVIGATION_READY_EVENT, () => {
      void publishPendingControlCenterNavigation();
    }).then((unlisten) => {
      if (disposed) {
        unlisten();
      } else {
        unlistenNavigationReady = unlisten;
      }
    });

    void listen<ControlCenterDestination>(
      CONTROL_CENTER_NAVIGATION_ACK_EVENT,
      ({ payload }) => {
        if (pendingControlCenterDestination === payload) {
          pendingControlCenterDestination = undefined;
        }
      },
    ).then((unlisten) => {
      if (disposed) {
        unlisten();
      } else {
        unlistenNavigationAck = unlisten;
      }
    });

    void listen(OPEN_SYSTEM_MONITOR_SETTINGS_EVENT, () => {
      void openSystemMonitorSettings().catch((error) => {
        console.error("Failed to open system monitor settings.", error);
      });
    }).then((unlisten) => {
      if (disposed) {
        unlisten();
      } else {
        unlistenOpenSystemSettings = unlisten;
      }
    });
  }

  const stopWatching = watch(
    snapshot,
    () => {
      void publishStatus();
    },
    { deep: true },
  );

  function dispose(): void {
    disposed = true;
    stopWatching();
    unlistenAction?.();
    unlistenRequest?.();
    unlistenNavigationReady?.();
    unlistenNavigationAck?.();
    unlistenOpenSystemSettings?.();
  }

  if (getCurrentScope()) {
    onScopeDispose(dispose);
  }
}

export function useControlCenterNavigation(
  navigate: (destination: ControlCenterDestination) => void,
): void {
  let disposed = false;
  let unlistenNavigation: UnlistenFn | undefined;

  if (isTauri()) {
    void listen<ControlCenterDestination>(
      CONTROL_CENTER_NAVIGATION_EVENT,
      ({ payload }) => {
        navigate(payload);
        void emitTo(MAIN_WINDOW_LABEL, CONTROL_CENTER_NAVIGATION_ACK_EVENT, payload);
      },
    ).then((unlisten) => {
      if (disposed) {
        unlisten();
        return;
      }

      unlistenNavigation = unlisten;
      void emitTo(MAIN_WINDOW_LABEL, CONTROL_CENTER_NAVIGATION_READY_EVENT);
    });
  }

  function dispose(): void {
    disposed = true;
    unlistenNavigation?.();
  }

  if (getCurrentScope()) {
    onScopeDispose(dispose);
  }
}

export function useRemotePetRuntime() {
  const snapshot = ref<PetRuntimeSnapshot>();
  const isConnected = ref(false);
  let disposed = false;
  let unlistenStatus: UnlistenFn | undefined;
  let requestTimer: ReturnType<typeof setInterval> | undefined;

  function requestStatus(): void {
    if (isTauri() && !disposed) {
      void emitTo(MAIN_WINDOW_LABEL, STATUS_REQUEST_EVENT);
    }
  }

  if (isTauri()) {
    void listen<PetRuntimeSnapshot>(STATUS_UPDATED_EVENT, ({ payload }) => {
      snapshot.value = payload;
      isConnected.value = true;
    }).then((unlisten) => {
      if (disposed) {
        unlisten();
        return;
      }

      unlistenStatus = unlisten;
      requestStatus();
      requestTimer = setInterval(() => {
        if (snapshot.value) {
          if (requestTimer !== undefined) {
            clearInterval(requestTimer);
            requestTimer = undefined;
          }
          return;
        }
        requestStatus();
      }, 1000);
    });
  }

  function executeAction(action: PetControlAction): void {
    if (isTauri()) {
      void emitTo(MAIN_WINDOW_LABEL, CONTROL_ACTION_EVENT, action);
    }
  }

  function dispose(): void {
    disposed = true;
    unlistenStatus?.();
    if (requestTimer !== undefined) {
      clearInterval(requestTimer);
      requestTimer = undefined;
    }
  }

  if (getCurrentScope()) {
    onScopeDispose(dispose);
  }

  return {
    snapshot: readonly(snapshot),
    isConnected: readonly(isConnected),
    executeAction,
    dispose,
  };
}

async function publishPendingControlCenterNavigation(): Promise<void> {
  if (!isTauri() || !pendingControlCenterDestination) {
    return;
  }

  await emitTo(
    CONTROL_CENTER_LABEL,
    CONTROL_CENTER_NAVIGATION_EVENT,
    pendingControlCenterDestination,
  );
}
