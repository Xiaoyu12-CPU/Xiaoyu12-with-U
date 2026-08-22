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

    <section class="cpu-panel">
      <div>
        <p class="eyebrow">System Monitor / CPU</p>
        <h3>真实系统 CPU</h3>
      </div>
      <div class="cpu-grid">
        <article>
          <span>CPU Usage</span>
          <strong>{{ cpuUsage }}</strong>
        </article>
        <article>
          <span>CPU Status</span>
          <strong :class="{ high: snapshot?.cpuStatus === 'high' }">
            {{ snapshot?.cpuStatus ?? "disabled" }}
          </strong>
        </article>
        <article>
          <span>CPU Threshold</span>
          <strong>{{ snapshot?.cpuHighThreshold ?? 80 }}%</strong>
        </article>
        <article>
          <span>Monitoring</span>
          <strong>{{ snapshot?.cpuMonitoring ? "Active" : "Disabled" }}</strong>
        </article>
      </div>
    </section>

    <section class="memory-panel">
      <div>
        <p class="eyebrow">System Monitor / Memory</p>
        <h3>真实系统内存</h3>
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
          <span>Memory Status</span>
          <strong :class="{ high: snapshot?.memoryStatus === 'high' }">
            {{ snapshot?.memoryStatus ?? "disabled" }}
          </strong>
        </article>
        <article>
          <span>Memory Threshold</span>
          <strong>{{ snapshot?.memoryHighThreshold ?? 85 }}%</strong>
        </article>
        <article>
          <span>Monitoring</span>
          <strong>{{ snapshot?.memoryMonitoring ? "Active" : "Disabled" }}</strong>
        </article>
      </div>
    </section>

    <section class="network-panel">
      <div>
        <p class="eyebrow">System Monitor / Network</p>
        <h3>真实系统网络吞吐</h3>
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
          <span>Network Status</span>
          <strong>{{ snapshot?.networkStatus ?? "disabled" }}</strong>
        </article>
        <article>
          <span>Monitoring</span>
          <strong>{{ snapshot?.networkMonitoring ? "Active" : "Disabled" }}</strong>
        </article>
      </div>
    </section>

    <section class="storage-panel">
      <div>
        <p class="eyebrow">System Monitor / Storage</p>
        <h3>真实系统卷储存空间</h3>
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
          <span>Storage Status</span>
          <strong>{{ snapshot?.storageStatus ?? "disabled" }}</strong>
        </article>
        <article>
          <span>Monitoring</span>
          <strong>{{ snapshot?.storageMonitoring ? "Active" : "Disabled" }}</strong>
        </article>
      </div>
    </section>

    <section class="battery-panel">
      <div>
        <p class="eyebrow">System Monitor / Battery</p>
        <h3>真实系统电池</h3>
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
          <span>Monitoring</span>
          <strong>{{ snapshot?.batteryMonitoring ? "Active" : "Disabled" }}</strong>
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
