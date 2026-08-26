<script setup lang="ts">
import { computed } from "vue";
import {
  PET_CONTROL_ACTION_TYPES,
} from "../pet/petControl";
import type {
  PetControlAction,
  PetControlActionType,
} from "../pet/petControl";
import type { PetRuntimeSnapshot } from "../pet/runtimeStatus";
import { formatNetworkRate } from "../system/formatNetworkRate";
import { formatBytes } from "../system/formatBytes";

const props = defineProps<{
  snapshot?: PetRuntimeSnapshot;
  connected: boolean;
}>();

const emit = defineEmits<{
  action: [action: PetControlAction];
  openSystemMonitorSettings: [];
}>();

const frameName = computed(() => {
  if (!props.snapshot?.currentFrame) {
    return "—";
  }

  const path = props.snapshot.currentFrame.split("?")[0];
  return decodeURIComponent(path.split("/").pop() ?? path);
});

const cpuUsage = computed(() =>
  props.snapshot?.cpuUsagePercent === undefined
    ? "—"
    : `${props.snapshot.cpuUsagePercent.toFixed(1)}%`,
);

const memoryUsage = computed(() =>
  props.snapshot?.memoryUsagePercent === undefined
    ? "—"
    : `${props.snapshot.memoryUsagePercent.toFixed(1)}%`,
);
const networkDownload = computed(() =>
  formatNetworkRate(props.snapshot?.networkDownloadBytesPerSecond),
);
const networkUpload = computed(() =>
  formatNetworkRate(props.snapshot?.networkUploadBytesPerSecond),
);
const storageUsage = computed(() =>
  props.snapshot?.storageUsagePercent === undefined
    ? "—"
    : `${props.snapshot.storageUsagePercent.toFixed(1)}%`,
);
const batteryCharge = computed(() => {
  if (props.snapshot?.batteryState === "unavailable") {
    return "No Battery";
  }
  return props.snapshot?.batteryPercent === undefined
    ? "—"
    : `${Math.round(props.snapshot.batteryPercent)}%`;
});
const batteryStateText = computed(() => {
  const state = props.snapshot?.batteryState ?? "disabled";
  const labels: Record<typeof state, string> = {
    disabled: "Disabled",
    charging: "Charging",
    discharging: "Discharging",
    full: "Full",
    unknown: "Unknown",
    unavailable: "No Battery",
    error: "Error",
  };
  return labels[state];
});
const cpuLifecycleStatus = computed(() =>
  props.snapshot?.cpuMonitoring ? "Active" : "Disabled",
);
const memoryLifecycleStatus = computed(() =>
  props.snapshot?.memoryMonitoring ? "Active" : "Disabled",
);
const networkLifecycleStatus = computed(() => {
  switch (props.snapshot?.networkStatus) {
    case "active":
      return "Active";
    case "warming":
      return "Warming";
    case "error":
      return "Error";
    default:
      return "Disabled";
  }
});
const storageLifecycleStatus = computed(() => {
  switch (props.snapshot?.storageStatus) {
    case "active":
      return "Active";
    case "error":
      return "Error";
    default:
      return "Disabled";
  }
});
const batteryLifecycleStatus = computed(() => {
  switch (props.snapshot?.batteryState) {
    case "unavailable":
      return "Unavailable";
    case "error":
      return "Error";
    case "disabled":
    case undefined:
      return "Disabled";
    default:
      return props.snapshot?.batteryMonitoring ? "Active" : "Disabled";
  }
});
const keyboardLifecycleStatus = computed(() => {
  const labels: Record<NonNullable<PetRuntimeSnapshot["keyboardStatus"]>, string> = {
    disabled: "Disabled",
    starting: "Starting",
    "permission-required": "Permission Required",
    active: "Active",
    error: "Error",
    unsupported: "Unsupported",
  };
  return labels[props.snapshot?.keyboardStatus ?? "disabled"];
});
const pressedKeysText = computed(() =>
  props.snapshot?.pressedKeys.length
    ? props.snapshot.pressedKeys.join(" + ")
    : "—",
);
const lastKeyboardActivity = computed(() => {
  const timestamp = props.snapshot?.lastKeyboardActivityAt;
  if (timestamp === undefined) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, { timeStyle: "medium" })
    .format(new Date(timestamp));
});
const mouseLifecycleStatus = computed(() => {
  const labels: Record<NonNullable<PetRuntimeSnapshot["mouseStatus"]>, string> = {
    disabled: "Disabled",
    starting: "Starting",
    "permission-required": "Permission Required",
    active: "Active",
    error: "Error",
    unsupported: "Unsupported",
  };
  return labels[props.snapshot?.mouseStatus ?? "disabled"];
});
const pressedMouseButtonsText = computed(() =>
  props.snapshot?.pressedMouseButtons.length
    ? props.snapshot.pressedMouseButtons.map(formatMouseButton).join(" + ")
    : "—",
);
const lastMouseInput = computed(() => {
  if (
    props.snapshot?.lastScrollAt !== undefined
    && props.snapshot.lastScrollAt === props.snapshot.lastMouseActivityAt
  ) {
    return props.snapshot.lastScrollDirection
      ? `Scroll ${capitalize(props.snapshot.lastScrollDirection)}`
      : "Scroll";
  }
  return props.snapshot?.lastMouseButton
    ? formatMouseButton(props.snapshot.lastMouseButton)
    : "—";
});
const lastMouseActivity = computed(() => {
  const timestamp = props.snapshot?.lastMouseActivityAt;
  if (timestamp === undefined) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, { timeStyle: "medium" })
    .format(new Date(timestamp));
});

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function formatMouseButton(button: string): string {
  const labels: Record<string, string> = {
    left: "Left",
    right: "Right",
    middle: "Middle",
    mouse4: "Mouse4",
    mouse5: "Mouse5",
    other: "Other",
  };
  return labels[button] ?? button;
}

function execute(type: PetControlActionType): void {
  emit("action", { type });
}
</script>

<template>
  <section class="status-page">
    <header>
      <div>
        <p class="eyebrow">Runtime Inspector</p>
        <h2>当前状态</h2>
      </div>
      <span class="connection" :class="{ connected }">
        {{ connected ? "已连接桌宠" : "等待桌宠窗口" }}
      </span>
    </header>

    <div class="status-grid">
      <article>
        <span>PetState</span>
        <strong>{{ snapshot?.state ?? "—" }}</strong>
      </article>
      <article>
        <span>Effective State</span>
        <strong>{{ snapshot?.effectiveState ?? "—" }}</strong>
      </article>
      <article class="wide">
        <span>Winning Source</span>
        <strong>{{ snapshot?.winningSource ?? "无（idle）" }}</strong>
      </article>
      <article>
        <span>动画状态</span>
        <strong>{{ snapshot?.animationStatus ?? "—" }}</strong>
      </article>
      <article>
        <span>当前帧序号</span>
        <strong>
          {{ snapshot ? snapshot.currentFrameIndex + 1 : "—" }}
        </strong>
      </article>
      <article>
        <span>当前显示帧</span>
        <strong class="frame-name">{{ frameName }}</strong>
      </article>
      <article class="wide">
        <span>最近触发事件</span>
        <strong>{{ snapshot?.lastEvent ?? "尚未触发" }}</strong>
      </article>
      <article class="wide">
        <span>最近显示文本</span>
        <strong>{{ snapshot?.lastText || "尚未显示" }}</strong>
      </article>
    </div>

    <section class="cpu-panel monitor-panel">
      <div class="monitor-panel__heading">
        <div>
          <p class="eyebrow">System Monitor / CPU</p>
          <h3>真实系统 CPU</h3>
        </div>
        <button
          v-if="cpuLifecycleStatus === 'Disabled'"
          class="secondary"
          type="button"
          @click="emit('openSystemMonitorSettings')"
        >
          前往设置
        </button>
      </div>
      <div class="cpu-grid">
        <article>
          <span>CPU Usage</span>
          <strong>{{ cpuUsage }}</strong>
        </article>
        <article>
          <span>CPU Condition</span>
          <strong :class="{ high: snapshot?.cpuStatus === 'high' }">
            {{ snapshot?.cpuStatus ?? "disabled" }}
          </strong>
        </article>
        <article>
          <span>CPU Threshold</span>
          <strong>{{ snapshot?.cpuHighThreshold ?? 80 }}%</strong>
        </article>
        <article>
          <span>Status</span>
          <strong>{{ cpuLifecycleStatus }}</strong>
        </article>
      </div>
    </section>

    <section class="memory-panel monitor-panel">
      <div class="monitor-panel__heading">
        <div>
          <p class="eyebrow">System Monitor / Memory</p>
          <h3>真实系统内存</h3>
        </div>
        <button
          v-if="memoryLifecycleStatus === 'Disabled'"
          class="secondary"
          type="button"
          @click="emit('openSystemMonitorSettings')"
        >
          前往设置
        </button>
      </div>
      <div class="memory-grid">
        <article>
          <span>Memory Usage</span>
          <strong>{{ memoryUsage }}</strong>
        </article>
        <article>
          <span>Used</span>
          <strong>{{ formatBytes(snapshot?.memoryUsedBytes) }}</strong>
        </article>
        <article>
          <span>Available</span>
          <strong>{{ formatBytes(snapshot?.memoryAvailableBytes) }}</strong>
        </article>
        <article>
          <span>Total</span>
          <strong>{{ formatBytes(snapshot?.memoryTotalBytes) }}</strong>
        </article>
        <article>
          <span>Memory Condition</span>
          <strong :class="{ high: snapshot?.memoryStatus === 'high' }">
            {{ snapshot?.memoryStatus ?? "disabled" }}
          </strong>
        </article>
        <article>
          <span>Memory Threshold</span>
          <strong>{{ snapshot?.memoryHighThreshold ?? 85 }}%</strong>
        </article>
        <article>
          <span>Status</span>
          <strong>{{ memoryLifecycleStatus }}</strong>
        </article>
      </div>
    </section>

    <section class="network-panel monitor-panel">
      <div class="monitor-panel__heading">
        <div>
          <p class="eyebrow">System Monitor / Network</p>
          <h3>真实系统网络吞吐</h3>
        </div>
        <button
          v-if="networkLifecycleStatus === 'Disabled'"
          class="secondary"
          type="button"
          @click="emit('openSystemMonitorSettings')"
        >
          前往设置
        </button>
      </div>
      <div class="network-grid">
        <article>
          <span>Download</span>
          <strong>{{ networkDownload }}</strong>
        </article>
        <article>
          <span>Upload</span>
          <strong>{{ networkUpload }}</strong>
        </article>
        <article>
          <span>Status</span>
          <strong>{{ networkLifecycleStatus }}</strong>
        </article>
      </div>
    </section>

    <section class="storage-panel monitor-panel">
      <div class="monitor-panel__heading">
        <div>
          <p class="eyebrow">System Monitor / Storage</p>
          <h3>真实系统卷储存空间</h3>
        </div>
        <button
          v-if="storageLifecycleStatus === 'Disabled'"
          class="secondary"
          type="button"
          @click="emit('openSystemMonitorSettings')"
        >
          前往设置
        </button>
      </div>
      <div class="storage-grid">
        <article>
          <span>Usage</span>
          <strong>{{ storageUsage }}</strong>
        </article>
        <article>
          <span>Used</span>
          <strong>{{ formatBytes(snapshot?.storageUsedBytes) }}</strong>
        </article>
        <article>
          <span>Available</span>
          <strong>{{ formatBytes(snapshot?.storageAvailableBytes) }}</strong>
        </article>
        <article>
          <span>Total</span>
          <strong>{{ formatBytes(snapshot?.storageTotalBytes) }}</strong>
        </article>
        <article>
          <span>Status</span>
          <strong>{{ storageLifecycleStatus }}</strong>
        </article>
      </div>
    </section>

    <section class="battery-panel monitor-panel">
      <div class="monitor-panel__heading">
        <div>
          <p class="eyebrow">System Monitor / Battery</p>
          <h3>真实系统电池</h3>
        </div>
        <button
          v-if="batteryLifecycleStatus === 'Disabled'"
          class="secondary"
          type="button"
          @click="emit('openSystemMonitorSettings')"
        >
          前往设置
        </button>
      </div>
      <div class="battery-grid">
        <article>
          <span>Charge</span>
          <strong>{{ batteryCharge }}</strong>
        </article>
        <article>
          <span>State</span>
          <strong>{{ batteryStateText }}</strong>
        </article>
        <article>
          <span>Present</span>
          <strong>{{ snapshot?.batteryPresent ? "Yes" : "No" }}</strong>
        </article>
        <article>
          <span>Status</span>
          <strong>{{ batteryLifecycleStatus }}</strong>
        </article>
      </div>
    </section>

    <section class="keyboard-panel monitor-panel">
      <div class="monitor-panel__heading">
        <div>
          <p class="eyebrow">Input Monitor / Keyboard</p>
          <h3>全局键盘监听</h3>
        </div>
        <strong>{{ keyboardLifecycleStatus }}</strong>
      </div>
      <p
        v-if="snapshot?.keyboardStatus === 'permission-required'"
        class="permission-note"
      >
        需要在 macOS 系统设置 → 隐私与安全性 → 输入监听中允许 withXiaoyu12。
      </p>
      <p v-else-if="snapshot?.keyboardMessage" class="permission-note">
        {{ snapshot.keyboardMessage }}
      </p>
      <div class="keyboard-grid">
        <article>
          <span>Pressed Keys</span>
          <strong>{{ pressedKeysText }}</strong>
        </article>
        <article>
          <span>Last Key</span>
          <strong>{{ snapshot?.lastKey ?? "—" }}</strong>
        </article>
        <article>
          <span>Last Activity</span>
          <strong>{{ lastKeyboardActivity }}</strong>
        </article>
        <article>
          <span>Activity State</span>
          <strong>
            {{ snapshot?.keyboardActivityStatus === "active" ? "Active" : "Idle" }}
          </strong>
        </article>
      </div>
    </section>

    <section class="keyboard-panel monitor-panel">
      <div class="monitor-panel__heading">
        <div>
          <p class="eyebrow">Input Monitor / Mouse</p>
          <h3>全局鼠标监听</h3>
        </div>
        <strong>{{ mouseLifecycleStatus }}</strong>
      </div>
      <p
        v-if="snapshot?.mouseStatus === 'permission-required'"
        class="permission-note"
      >
        需要在 macOS 系统设置 → 隐私与安全性 → 输入监听中允许 withXiaoyu12。
      </p>
      <p v-else-if="snapshot?.mouseMessage" class="permission-note">
        {{ snapshot.mouseMessage }}
      </p>
      <div class="keyboard-grid">
        <article>
          <span>Pressed Buttons</span>
          <strong>{{ pressedMouseButtonsText }}</strong>
        </article>
        <article>
          <span>Last Mouse Input</span>
          <strong>{{ lastMouseInput }}</strong>
        </article>
        <article>
          <span>Last Activity</span>
          <strong>{{ lastMouseActivity }}</strong>
        </article>
        <article>
          <span>Tracking</span>
          <strong>Buttons + Scroll Only</strong>
        </article>
      </div>
    </section>

    <section class="behavior-panel">
      <div class="behavior-panel__heading">
        <div>
          <p class="eyebrow">Development / Debug</p>
          <h3>Active Behavior Requests</h3>
        </div>
        <button
          class="secondary"
          type="button"
          @click="execute(PET_CONTROL_ACTION_TYPES.DEBUG_CLEAR_BEHAVIORS)"
        >
          清除测试请求
        </button>
      </div>

      <div
        v-if="snapshot?.activeBehaviorRequests?.length"
        class="behavior-list"
      >
        <article
          v-for="request in snapshot?.activeBehaviorRequests ?? []"
          :key="`${request.source}-${request.sequence}`"
          class="behavior-request"
        >
          <strong>{{ request.source }}</strong>
          <span>
            {{ request.state }} · priority {{ request.priority }} ·
            {{ request.durationMs ? `${request.durationMs}ms transient` : "held" }}
          </span>
        </article>
      </div>
      <p v-else class="empty">当前没有 Behavior Request，状态回退为 idle。</p>

      <div class="debug-actions">
        <button
          type="button"
          @click="execute(PET_CONTROL_ACTION_TYPES.DEBUG_REQUEST_TIRED)"
        >
          Request tired
        </button>
        <button
          class="secondary"
          type="button"
          @click="execute(PET_CONTROL_ACTION_TYPES.DEBUG_RELEASE_TIRED)"
        >
          Release tired
        </button>
        <button
          type="button"
          @click="execute(PET_CONTROL_ACTION_TYPES.DEBUG_REQUEST_WORKING)"
        >
          Request working
        </button>
        <button
          class="secondary"
          type="button"
          @click="execute(PET_CONTROL_ACTION_TYPES.DEBUG_RELEASE_WORKING)"
        >
          Release working
        </button>
        <button
          type="button"
          @click="execute(PET_CONTROL_ACTION_TYPES.DEBUG_REQUEST_ALERT)"
        >
          Alert 5s
        </button>
        <button
          class="secondary"
          type="button"
          @click="execute(PET_CONTROL_ACTION_TYPES.DEBUG_RELEASE_ALERT)"
        >
          Release alert
        </button>
      </div>
    </section>

    <div class="actions">
      <button
        type="button"
        @click="execute(PET_CONTROL_ACTION_TYPES.TEST_EVENT)"
      >
        测试下一个事件
      </button>
      <button
        type="button"
        :disabled="snapshot?.animationStatus === 'paused'"
        @click="execute(PET_CONTROL_ACTION_TYPES.PAUSE_ANIMATION)"
      >
        暂停动画
      </button>
      <button
        type="button"
        :disabled="snapshot?.animationStatus !== 'paused'"
        @click="execute(PET_CONTROL_ACTION_TYPES.RESUME_ANIMATION)"
      >
        恢复动画
      </button>
    </div>
  </section>
</template>

<style scoped>
.status-page {
  display: grid;
  gap: 22px;
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #8d78db;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h2 {
  margin: 0;
  color: #211b31;
  font-size: 26px;
}

.connection {
  padding: 6px 10px;
  color: #8a5960;
  font-size: 12px;
  background: #fff0f1;
  border-radius: 999px;
}

.connection.connected {
  color: #3f735a;
  background: #e9f8ef;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

article {
  display: grid;
  gap: 7px;
  min-height: 72px;
  padding: 15px;
  background: #faf9fd;
  border: 1px solid #ebe7f3;
  border-radius: 13px;
}

article.wide {
  grid-column: 1 / -1;
}

article span {
  color: #81798f;
  font-size: 12px;
}

article strong {
  color: #2b2438;
  font-size: 15px;
  overflow-wrap: anywhere;
}

.frame-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.cpu-panel {
  display: grid;
  gap: 13px;
}

.memory-panel {
  display: grid;
  gap: 13px;
}

.network-panel {
  display: grid;
  gap: 13px;
}

.storage-panel {
  display: grid;
  gap: 13px;
}

.battery-panel {
  display: grid;
  gap: 13px;
}

.keyboard-panel {
  display: grid;
  gap: 13px;
}

.monitor-panel__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.cpu-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.memory-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.network-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.storage-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.battery-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.keyboard-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
}

.cpu-grid article {
  min-height: 58px;
  padding: 12px;
}

.memory-grid article {
  min-height: 58px;
  padding: 12px;
}

.network-grid article {
  min-height: 58px;
  padding: 12px;
}

.storage-grid article {
  min-height: 58px;
  padding: 12px;
}

.battery-grid article {
  min-height: 58px;
  padding: 12px;
}

.keyboard-grid article {
  min-height: 58px;
  padding: 12px;
}

.permission-note {
  margin: 0;
  padding: 10px 12px;
  color: #7a5a35;
  font-size: 12px;
  background: #fff7e7;
  border-radius: 9px;
}

.cpu-grid strong {
  text-transform: capitalize;
}

.memory-grid strong {
  text-transform: capitalize;
}

.network-grid strong {
  text-transform: capitalize;
}

.storage-grid strong {
  text-transform: capitalize;
}

.battery-grid strong {
  text-transform: capitalize;
}

.cpu-grid strong.high {
  color: #b34152;
}

.memory-grid strong.high {
  color: #b34152;
}

.behavior-panel {
  display: grid;
  gap: 13px;
  padding: 16px;
  background: #f7f5fb;
  border: 1px dashed #cfc7df;
  border-radius: 13px;
}

.behavior-panel__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

h3 {
  margin: 0;
  color: #2b2438;
  font-size: 16px;
}

.behavior-list {
  display: grid;
  gap: 7px;
}

.behavior-request {
  min-height: 0;
  padding: 10px 12px;
  background: #fff;
}

.behavior-request strong {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.behavior-request span,
.empty {
  margin: 0;
  color: #81798f;
  font-size: 11px;
}

.debug-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

button {
  padding: 9px 13px;
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  background: #6f57c8;
  border: 0;
  border-radius: 9px;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: #5d47b2;
}

button.secondary {
  color: #5c4a73;
  background: #e9e4f2;
}

button.secondary:hover:not(:disabled) {
  background: #ddd5ea;
}

button:disabled {
  color: #9b94a8;
  background: #e8e5ed;
  cursor: default;
}

@media (max-width: 760px) {
  .cpu-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .memory-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .network-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .storage-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .battery-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
