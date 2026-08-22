import { invoke } from "@tauri-apps/api/core";
import { getCurrentScope, onScopeDispose, watch } from "vue";
import { updateBatteryRuntime } from "../pet/runtimeStatus";
import type { BatteryState } from "../pet/runtimeStatus";
import { settingsManager } from "../settings/settingsManager";

export const BATTERY_POLL_INTERVAL_MS = 30_000;

interface BatterySample {
  batteryPercent?: number;
  batteryState: Exclude<BatteryState, "disabled" | "error">;
  batteryPresent: boolean;
}

export function useBatteryMonitor(): void {
  let generation = 0;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let state: BatteryState = "disabled";
  let batteryPercent: number | undefined;
  let batteryPresent = false;
  let loggedSampleError = false;
  let disposed = false;

  const stopLifecycleWatch = watch(
    [
      settingsManager.isLoaded,
      () => settingsManager.settings.value.systemMonitor.enabled,
      () => settingsManager.settings.value.systemMonitor.batteryEnabled,
    ],
    ([loaded]) => {
      if (!loaded || disposed) {
        return;
      }

      if (isEnabled()) {
        start();
      } else {
        disable();
      }
    },
    { immediate: true },
  );

  void settingsManager.initialize();

  function isEnabled(): boolean {
    const settings = settingsManager.settings.value.systemMonitor;
    return settings.enabled && settings.batteryEnabled;
  }

  function start(): void {
    stopPolling();
    const currentGeneration = ++generation;
    state = "unknown";
    batteryPercent = undefined;
    batteryPresent = false;
    loggedSampleError = false;
    publishRuntime();
    void poll(currentGeneration);
  }

  function disable(): void {
    stopPolling();
    generation += 1;
    state = "disabled";
    batteryPercent = undefined;
    batteryPresent = false;
    loggedSampleError = false;
    publishRuntime();
  }

  async function poll(currentGeneration: number): Promise<void> {
    try {
      const sample = await invoke<BatterySample>("sample_battery_status");

      if (disposed || currentGeneration !== generation || !isEnabled()) {
        return;
      }

      state = sample.batteryState;
      batteryPresent = sample.batteryPresent;
      batteryPercent = normalizePercent(sample.batteryPercent);
      loggedSampleError = false;
      publishRuntime();
      schedulePoll(currentGeneration);
    } catch (error) {
      if (disposed || currentGeneration !== generation || !isEnabled()) {
        return;
      }

      state = "error";
      batteryPercent = undefined;
      batteryPresent = false;
      publishRuntime();

      if (!loggedSampleError) {
        console.error("Failed to sample system battery status.", error);
        loggedSampleError = true;
      }

      schedulePoll(currentGeneration);
    }
  }

  function schedulePoll(currentGeneration: number): void {
    if (disposed || currentGeneration !== generation || !isEnabled()) {
      return;
    }

    pollTimer = setTimeout(() => {
      pollTimer = undefined;
      void poll(currentGeneration);
    }, BATTERY_POLL_INTERVAL_MS);
  }

  function publishRuntime(): void {
    updateBatteryRuntime({
      percent: batteryPercent,
      state,
      monitoring: state !== "disabled",
      present: batteryPresent,
    });
  }

  function stopPolling(): void {
    if (pollTimer !== undefined) {
      clearTimeout(pollTimer);
      pollTimer = undefined;
    }
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true;
      stopLifecycleWatch();
      disable();
    });
  }
}

function normalizePercent(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 100)
    : undefined;
}
