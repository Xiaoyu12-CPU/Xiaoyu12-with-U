import { invoke } from "@tauri-apps/api/core";
import {
  getCurrentScope,
  onScopeDispose,
  watch,
} from "vue";
import {
  BEHAVIOR_SOURCES,
  releaseState,
  requestState,
} from "../pet/behavior";
import { triggerDialogueEvent } from "../pet/dialogue";
import { DIALOGUE_EVENT_TYPES } from "../pet/dialogueEvents";
import { updateCpuRuntime } from "../pet/runtimeStatus";
import type { CpuStatus } from "../pet/runtimeStatus";
import { settingsManager } from "../settings/settingsManager";

const CPU_HYSTERESIS_PERCENTAGE_POINTS = 10;
const CPU_WARM_UP_RETRY_MS = 500;

export function resolveCpuStatus(
  usagePercent: number,
  highThreshold: number,
  currentStatus: Exclude<CpuStatus, "disabled">,
): Exclude<CpuStatus, "disabled"> {
  if (currentStatus === "high") {
    return usagePercent <= Math.max(0, highThreshold - CPU_HYSTERESIS_PERCENTAGE_POINTS)
      ? "normal"
      : "high";
  }

  return usagePercent >= highThreshold ? "high" : "normal";
}

export function useCpuMonitor(): void {
  let generation = 0;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let status: CpuStatus = "disabled";
  let lastUsagePercent: number | undefined;
  let loggedSampleError = false;
  let disposed = false;

  const stopLifecycleWatch = watch(
    [
      settingsManager.isLoaded,
      () => settingsManager.settings.value.systemMonitor.enabled,
      () => settingsManager.settings.value.systemMonitor.cpuEnabled,
      () => settingsManager.settings.value.systemMonitor.cpuPollIntervalMs,
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

  const stopThresholdWatch = watch(
    () => settingsManager.settings.value.systemMonitor.cpuHighThreshold,
    (threshold) => {
      if (!disposed && isEnabled() && lastUsagePercent !== undefined) {
        applySample(lastUsagePercent, threshold);
      } else if (!disposed) {
        publishRuntime();
      }
    },
  );

  void settingsManager.initialize();

  function isEnabled(): boolean {
    const settings = settingsManager.settings.value.systemMonitor;
    return settings.enabled && settings.cpuEnabled;
  }

  function start(): void {
    if (status !== "disabled") {
      stopPolling();
      const currentGeneration = ++generation;
      schedulePoll(
        currentGeneration,
        settingsManager.settings.value.systemMonitor.cpuPollIntervalMs,
      );
      return;
    }

    stopPolling();
    const currentGeneration = ++generation;
    status = "normal";
    lastUsagePercent = undefined;
    loggedSampleError = false;
    releaseState(BEHAVIOR_SOURCES.SYSTEM_CPU);
    publishRuntime();
    void poll(currentGeneration, true);
  }

  function disable(): void {
    stopPolling();
    generation += 1;
    status = "disabled";
    lastUsagePercent = undefined;
    loggedSampleError = false;
    releaseState(BEHAVIOR_SOURCES.SYSTEM_CPU);
    publishRuntime();
  }

  async function poll(
    currentGeneration: number,
    reset: boolean,
  ): Promise<void> {
    try {
      const usagePercent = await invoke<number | null>("sample_cpu_usage", {
        reset,
      });

      if (disposed || currentGeneration !== generation || !isEnabled()) {
        return;
      }

      loggedSampleError = false;

      if (usagePercent === null) {
        schedulePoll(currentGeneration, CPU_WARM_UP_RETRY_MS);
        return;
      }

      applySample(
        Math.min(Math.max(usagePercent, 0), 100),
        settingsManager.settings.value.systemMonitor.cpuHighThreshold,
      );
      schedulePoll(
        currentGeneration,
        settingsManager.settings.value.systemMonitor.cpuPollIntervalMs,
      );
    } catch (error) {
      if (disposed || currentGeneration !== generation || !isEnabled()) {
        return;
      }

      if (!loggedSampleError) {
        console.error("Failed to sample system CPU usage.", error);
        loggedSampleError = true;
      }

      schedulePoll(
        currentGeneration,
        settingsManager.settings.value.systemMonitor.cpuPollIntervalMs,
      );
    }
  }

  function schedulePoll(currentGeneration: number, delayMs: number): void {
    if (disposed || currentGeneration !== generation || !isEnabled()) {
      return;
    }

    pollTimer = setTimeout(() => {
      pollTimer = undefined;
      void poll(currentGeneration, false);
    }, delayMs);
  }

  function applySample(usagePercent: number, highThreshold: number): void {
    const previousStatus = status === "high" ? "high" : "normal";
    const nextStatus = resolveCpuStatus(
      usagePercent,
      highThreshold,
      previousStatus,
    );

    lastUsagePercent = usagePercent;
    status = nextStatus;

    if (previousStatus !== nextStatus) {
      if (nextStatus === "high") {
        requestState({
          source: BEHAVIOR_SOURCES.SYSTEM_CPU,
          state: "tired",
        });
      } else {
        releaseState(BEHAVIOR_SOURCES.SYSTEM_CPU);
      }

      triggerDialogueEvent(
        nextStatus === "high"
          ? DIALOGUE_EVENT_TYPES.SYSTEM_CPU_HIGH
          : DIALOGUE_EVENT_TYPES.SYSTEM_CPU_NORMAL,
      );
    }

    publishRuntime();
  }

  function publishRuntime(): void {
    updateCpuRuntime({
      usagePercent: lastUsagePercent,
      status,
      monitoring: status !== "disabled",
      highThreshold:
        settingsManager.settings.value.systemMonitor.cpuHighThreshold,
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
      stopThresholdWatch();
      disable();
    });
  }
}
