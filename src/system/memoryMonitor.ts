import { invoke } from "@tauri-apps/api/core";
import { getCurrentScope, onScopeDispose, watch } from "vue";
import {
  BEHAVIOR_SOURCES,
  releaseState,
  requestState,
} from "../pet/behavior";
import { triggerDialogueEvent } from "../pet/dialogue";
import { DIALOGUE_EVENT_TYPES } from "../pet/dialogueEvents";
import { updateMemoryRuntime } from "../pet/runtimeStatus";
import type { MemoryStatus } from "../pet/runtimeStatus";
import { settingsManager } from "../settings/settingsManager";

const MEMORY_HYSTERESIS_PERCENTAGE_POINTS = 5;

interface MemorySample {
  totalMemory: number;
  usedMemory: number;
  availableMemory: number;
  usagePercent: number;
}

export function resolveMemoryStatus(
  usagePercent: number,
  highThreshold: number,
  currentStatus: Exclude<MemoryStatus, "disabled">,
): Exclude<MemoryStatus, "disabled"> {
  if (currentStatus === "high") {
    return usagePercent <= Math.max(
      0,
      highThreshold - MEMORY_HYSTERESIS_PERCENTAGE_POINTS,
    )
      ? "normal"
      : "high";
  }

  return usagePercent >= highThreshold ? "high" : "normal";
}

export function useMemoryMonitor(): void {
  let generation = 0;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let status: MemoryStatus = "disabled";
  let lastSample: MemorySample | undefined;
  let loggedSampleError = false;
  let disposed = false;

  const stopLifecycleWatch = watch(
    [
      settingsManager.isLoaded,
      () => settingsManager.settings.value.systemMonitor.enabled,
      () => settingsManager.settings.value.systemMonitor.memoryEnabled,
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
    () => settingsManager.settings.value.systemMonitor.memoryHighThreshold,
    (threshold) => {
      if (!disposed && isEnabled() && lastSample !== undefined) {
        applySample(lastSample, threshold);
      } else if (!disposed) {
        publishRuntime();
      }
    },
  );

  void settingsManager.initialize();

  function isEnabled(): boolean {
    const settings = settingsManager.settings.value.systemMonitor;
    return settings.enabled && settings.memoryEnabled;
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
    lastSample = undefined;
    loggedSampleError = false;
    releaseState(BEHAVIOR_SOURCES.SYSTEM_MEMORY);
    publishRuntime();
    void poll(currentGeneration);
  }

  function disable(): void {
    stopPolling();
    generation += 1;
    status = "disabled";
    lastSample = undefined;
    loggedSampleError = false;
    releaseState(BEHAVIOR_SOURCES.SYSTEM_MEMORY);
    publishRuntime();
  }

  async function poll(currentGeneration: number): Promise<void> {
    try {
      const sample = await invoke<MemorySample>("sample_memory_usage");

      if (disposed || currentGeneration !== generation || !isEnabled()) {
        return;
      }

      loggedSampleError = false;
      applySample(
        normalizeSample(sample),
        settingsManager.settings.value.systemMonitor.memoryHighThreshold,
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
        console.error("Failed to sample system memory usage.", error);
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
      void poll(currentGeneration);
    }, delayMs);
  }

  function applySample(sample: MemorySample, highThreshold: number): void {
    const previousStatus = status === "high" ? "high" : "normal";
    const nextStatus = resolveMemoryStatus(
      sample.usagePercent,
      highThreshold,
      previousStatus,
    );

    lastSample = sample;
    status = nextStatus;

    if (previousStatus !== nextStatus) {
      if (nextStatus === "high") {
        requestState({
          source: BEHAVIOR_SOURCES.SYSTEM_MEMORY,
          state: "tired",
        });
      } else {
        releaseState(BEHAVIOR_SOURCES.SYSTEM_MEMORY);
      }

      triggerDialogueEvent(
        nextStatus === "high"
          ? DIALOGUE_EVENT_TYPES.SYSTEM_MEMORY_HIGH
          : DIALOGUE_EVENT_TYPES.SYSTEM_MEMORY_NORMAL,
      );
    }

    publishRuntime();
  }

  function publishRuntime(): void {
    updateMemoryRuntime({
      usagePercent: lastSample?.usagePercent,
      usedBytes: lastSample?.usedMemory,
      totalBytes: lastSample?.totalMemory,
      availableBytes: lastSample?.availableMemory,
      status,
      monitoring: status !== "disabled",
      highThreshold:
        settingsManager.settings.value.systemMonitor.memoryHighThreshold,
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

function normalizeSample(sample: MemorySample): MemorySample {
  return {
    totalMemory: Math.max(0, sample.totalMemory),
    usedMemory: Math.max(0, sample.usedMemory),
    availableMemory: Math.max(0, sample.availableMemory),
    usagePercent: Math.min(Math.max(sample.usagePercent, 0), 100),
  };
}
