export const TYPING_BUSY_DEFAULT_TEXT = "键盘好忙呀";
export const TYPING_SPEED_DEFAULT_TEXT = "打字速度起飞了！";
export const TYPING_SPEED_WINDOW_MS = 1_000;

export type TypingFeedbackKind = "busy" | "speed";

export interface TypingMetricsConfig {
  busyEnabled: boolean;
  busyWindowSeconds: number;
  busyCountThreshold: number;
  speedEnabled: boolean;
  speedThresholdPerSecond: number;
}

export interface TypingFeedbackConfig extends TypingMetricsConfig {
  busyText: string;
  speedText: string;
  cooldownSeconds: number;
}

export interface TypingMetricResult {
  busyTriggered: boolean;
  speedTriggered: boolean;
  busyCount: number;
  speedCount: number;
}

export interface TypingMetricsSnapshot {
  timestamps: readonly number[];
  busyLatched: boolean;
  speedLatched: boolean;
}

export interface TypingFeedbackAttempt {
  kind: TypingFeedbackKind;
  text: string;
  shown: boolean;
  reason?: "cooldown" | "suppressed";
}

export interface TypingFeedbackController {
  recordTypingActivity: (timestamp: number) => TypingFeedbackAttempt | undefined;
  updateConfig: (config: TypingFeedbackConfig) => void;
  reset: () => void;
  getLastTypingFeedbackAt: () => number | undefined;
  getMetricsSnapshot: () => TypingMetricsSnapshot;
}

interface TypingFeedbackControllerDependencies {
  showFeedback: (kind: TypingFeedbackKind, text: string) => boolean;
}

export function createTypingMetrics(initialConfig: TypingMetricsConfig) {
  let config = { ...initialConfig };
  let timestamps: number[] = [];
  let busyLatched = false;
  let speedLatched = false;

  function reset(): void {
    timestamps = [];
    busyLatched = false;
    speedLatched = false;
  }

  function updateConfig(nextConfig: TypingMetricsConfig): void {
    const metricsChanged =
      nextConfig.busyWindowSeconds !== config.busyWindowSeconds
      || nextConfig.busyCountThreshold !== config.busyCountThreshold
      || nextConfig.speedThresholdPerSecond
        !== config.speedThresholdPerSecond;
    const bothWereDisabled = !config.busyEnabled && !config.speedEnabled;

    if (metricsChanged || (bothWereDisabled && (
      nextConfig.busyEnabled || nextConfig.speedEnabled
    ))) {
      reset();
    } else {
      if (config.busyEnabled && !nextConfig.busyEnabled) {
        busyLatched = false;
      }
      if (config.speedEnabled && !nextConfig.speedEnabled) {
        speedLatched = false;
      }
    }

    config = { ...nextConfig };
    if (!config.busyEnabled && !config.speedEnabled) {
      reset();
    }
  }

  function recordTypingActivity(timestamp: number): TypingMetricResult {
    if (
      !Number.isFinite(timestamp)
      || (!config.busyEnabled && !config.speedEnabled)
    ) {
      return emptyResult();
    }

    const busyWindowMs = config.busyWindowSeconds * 1_000;
    const retentionMs = Math.max(
      config.busyEnabled ? busyWindowMs : 0,
      config.speedEnabled ? TYPING_SPEED_WINDOW_MS : 0,
    );
    timestamps = timestamps.filter(
      (recordedAt) =>
        recordedAt >= timestamp - retentionMs && recordedAt <= timestamp,
    );
    timestamps.sort((left, right) => left - right);

    const previousBusyCount = config.busyEnabled
      ? countSince(timestamp - busyWindowMs)
      : 0;
    const previousSpeedCount = config.speedEnabled
      ? countSince(timestamp - TYPING_SPEED_WINDOW_MS)
      : 0;

    if (busyLatched && previousBusyCount < config.busyCountThreshold) {
      busyLatched = false;
    }
    if (speedLatched && previousSpeedCount < config.speedThresholdPerSecond) {
      speedLatched = false;
    }

    timestamps.push(timestamp);
    const busyCount = config.busyEnabled
      ? previousBusyCount + 1
      : 0;
    const speedCount = config.speedEnabled
      ? previousSpeedCount + 1
      : 0;
    const busyTriggered = config.busyEnabled
      && !busyLatched
      && previousBusyCount < config.busyCountThreshold
      && busyCount >= config.busyCountThreshold;
    const speedTriggered = config.speedEnabled
      && !speedLatched
      && previousSpeedCount < config.speedThresholdPerSecond
      && speedCount >= config.speedThresholdPerSecond;

    if (busyTriggered) {
      busyLatched = true;
    }
    if (speedTriggered) {
      speedLatched = true;
    }

    return { busyTriggered, speedTriggered, busyCount, speedCount };
  }

  function countSince(startAt: number): number {
    return timestamps.reduce(
      (count, recordedAt) => count + Number(recordedAt >= startAt),
      0,
    );
  }

  function getSnapshot(): TypingMetricsSnapshot {
    return {
      timestamps: [...timestamps],
      busyLatched,
      speedLatched,
    };
  }

  return {
    recordTypingActivity,
    updateConfig,
    reset,
    getSnapshot,
  };
}

export function createTypingFeedbackController(
  initialConfig: TypingFeedbackConfig,
  dependencies: TypingFeedbackControllerDependencies,
): TypingFeedbackController {
  let config = { ...initialConfig };
  let lastTypingFeedbackAt: number | undefined;
  const metrics = createTypingMetrics(config);

  function recordTypingActivity(
    timestamp: number,
  ): TypingFeedbackAttempt | undefined {
    const result = metrics.recordTypingActivity(timestamp);
    const kind = result.busyTriggered
      ? "busy"
      : result.speedTriggered ? "speed" : undefined;

    if (!kind) {
      return undefined;
    }

    const configuredText = kind === "busy" ? config.busyText : config.speedText;
    const text = configuredText.trim() || (
      kind === "busy" ? TYPING_BUSY_DEFAULT_TEXT : TYPING_SPEED_DEFAULT_TEXT
    );
    if (
      lastTypingFeedbackAt !== undefined
      && timestamp - lastTypingFeedbackAt < config.cooldownSeconds * 1_000
    ) {
      return { kind, text, shown: false, reason: "cooldown" };
    }

    const shown = dependencies.showFeedback(kind, text);
    if (shown) {
      lastTypingFeedbackAt = timestamp;
    }
    return {
      kind,
      text,
      shown,
      reason: shown ? undefined : "suppressed",
    };
  }

  function updateConfig(nextConfig: TypingFeedbackConfig): void {
    metrics.updateConfig(nextConfig);
    config = { ...nextConfig };
  }

  function reset(): void {
    metrics.reset();
    lastTypingFeedbackAt = undefined;
  }

  return {
    recordTypingActivity,
    updateConfig,
    reset,
    getLastTypingFeedbackAt: () => lastTypingFeedbackAt,
    getMetricsSnapshot: metrics.getSnapshot,
  };
}

function emptyResult(): TypingMetricResult {
  return {
    busyTriggered: false,
    speedTriggered: false,
    busyCount: 0,
    speedCount: 0,
  };
}
