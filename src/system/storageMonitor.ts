import { invoke } from "@tauri-apps/api/core";
import { getCurrentScope, onScopeDispose, watch } from "vue";
import { updateStorageRuntime } from "../pet/runtimeStatus";
import type { StorageStatus } from "../pet/runtimeStatus";
import { settingsManager } from "../settings/settingsManager";

export const STORAGE_POLL_INTERVAL_MS = 30_000;

interface StorageSample {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePercent: number;
}

export function useStorageMonitor(): void {
  let generation = 0;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let status: StorageStatus = "disabled";
  let lastSample: StorageSample | undefined;
  let loggedSampleError = false;
  let disposed = false;

  const stopLifecycleWatch = watch(
    [
      settingsManager.isLoaded,
      () => settingsManager.settings.value.systemMonitor.enabled,
      () => settingsManager.settings.value.systemMonitor.storageEnabled,
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
    return settings.enabled && settings.storageEnabled;
  }

  function start(): void {
    stopPolling();
    const currentGeneration = ++generation;
    status = "active";
    lastSample = undefined;
    loggedSampleError = false;
    publishRuntime();
    void poll(currentGeneration);
  }

  function disable(): void {
    stopPolling();
    generation += 1;
    status = "disabled";
    lastSample = undefined;
    loggedSampleError = false;
    publishRuntime();
  }

  async function poll(currentGeneration: number): Promise<void> {
    try {
      const sample = await invoke<StorageSample>("sample_storage_usage");

      if (disposed || currentGeneration !== generation || !isEnabled()) {
        return;
      }

      lastSample = normalizeSample(sample);
      status = "active";
      loggedSampleError = false;
      publishRuntime();
      schedulePoll(currentGeneration);
    } catch (error) {
      if (disposed || currentGeneration !== generation || !isEnabled()) {
        return;
      }

      status = "error";
      lastSample = undefined;
      publishRuntime();

      if (!loggedSampleError) {
        console.error("Failed to sample system storage usage.", error);
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
    }, STORAGE_POLL_INTERVAL_MS);
  }

  function publishRuntime(): void {
    updateStorageRuntime({
      totalBytes: lastSample?.totalBytes,
      usedBytes: lastSample?.usedBytes,
      availableBytes: lastSample?.availableBytes,
      usagePercent: lastSample?.usagePercent,
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

function normalizeSample(sample: StorageSample): StorageSample {
  const totalBytes = normalizeBytes(sample.totalBytes);
  const availableBytes = Math.min(normalizeBytes(sample.availableBytes), totalBytes);

  return {
    totalBytes,
    usedBytes: Math.min(normalizeBytes(sample.usedBytes), totalBytes),
    availableBytes,
    usagePercent: Number.isFinite(sample.usagePercent)
      ? Math.min(Math.max(sample.usagePercent, 0), 100)
      : 0,
  };
}

function normalizeBytes(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
