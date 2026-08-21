import { isTauri } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
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

export function useMainRuntimeBridge(
  executeAction: (action: PetControlAction) => void | Promise<void>,
): void {
  const { snapshot } = usePetRuntimeStatus();
  let disposed = false;
  let unlistenAction: UnlistenFn | undefined;
  let unlistenRequest: UnlistenFn | undefined;

  async function publishStatus(): Promise<void> {
    if (!isTauri() || disposed) {
      return;
    }

    await emitTo(CONTROL_CENTER_LABEL, STATUS_UPDATED_EVENT, snapshot.value);
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
      void emitTo(MAIN_WINDOW_LABEL, STATUS_REQUEST_EVENT);
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
