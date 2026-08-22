import { invoke } from "@tauri-apps/api/core";
import { getCurrentScope, onScopeDispose, watch } from "vue";
import { updateNetworkRuntime } from "../pet/runtimeStatus";
import type { NetworkStatus } from "../pet/runtimeStatus";
import { settingsManager } from "../settings/settingsManager";

interface NetworkRateSample {
  downloadBytesPerSecond: number;
  uploadBytesPerSecond: number;
}

export function useNetworkMonitor(): void {
  let generation = 0;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let status: NetworkStatus = "disabled";
  let lastSample: NetworkRateSample | undefined;
  let loggedSampleError = false;
  let disposed = false;

  const stopLifecycleWatch = watch(
    [
      settingsManager.isLoaded,
      () => settingsManager.settings.value.systemMonitor.enabled,
      () => settingsManager.settings.value.systemMonitor.networkEnabled,
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

  void settingsManager.initialize();

  function isEnabled(): boolean {
    const settings = settingsManager.settings.value.systemMonitor;
    return settings.enabled && settings.networkEnabled;
  }

  function start(): void {
    stopPolling();
    const currentGeneration = ++generation;
    status = "warming";
    lastSample = undefined;
    loggedSampleError = false;
    publishRuntime();
    void poll(currentGeneration, true);
  }

  function disable(): void {
    stopPolling();
    generation += 1;
    status = "disabled";
    lastSample = undefined;
    loggedSampleError = false;
    publishRuntime();
  }

  async function poll(currentGeneration: number, reset: boolean): Promise<void> {
    const intervalMs = settingsManager.settings.value.systemMonitor.cpuPollIntervalMs;

    try {
      const sample = await invoke<NetworkRateSample | null>(
        "sample_network_throughput",
        {
          reset,
          expectedIntervalMs: intervalMs,
        },
      );

      if (disposed || currentGeneration !== generation || !isEnabled()) {
        return;
      }

      loggedSampleError = false;

      if (sample === null) {
        status = "warming";
        lastSample = undefined;
      } else {
        status = "active";
        lastSample = normalizeSample(sample);
      }

      publishRuntime();
      schedulePoll(
        currentGeneration,
        settingsManager.settings.value.systemMonitor.cpuPollIntervalMs,
      );
    } catch (error) {
      if (disposed || currentGeneration !== generation || !isEnabled()) {
        return;
      }

      status = "error";
      lastSample = undefined;
      publishRuntime();

      if (!loggedSampleError) {
        console.error("Failed to sample system network throughput.", error);
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

  function publishRuntime(): void {
    updateNetworkRuntime({
      downloadBytesPerSecond: lastSample?.downloadBytesPerSecond,
      uploadBytesPerSecond: lastSample?.uploadBytesPerSecond,
      status,
      monitoring: status !== "disabled",
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

function normalizeSample(sample: NetworkRateSample): NetworkRateSample {
  return {
    downloadBytesPerSecond: normalizeRate(sample.downloadBytesPerSecond),
    uploadBytesPerSecond: normalizeRate(sample.uploadBytesPerSecond),
  };
}

function normalizeRate(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
