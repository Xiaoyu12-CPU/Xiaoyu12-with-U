<script setup lang="ts">
import { computed } from "vue";
import type { PetRuntimeSnapshot } from "../pet/runtimeStatus";
import { formatNetworkRate } from "../system/formatNetworkRate";
import { formatBytes } from "../system/formatBytes";
import type { InputSettingsTabId, SettingsTabId } from "./settingsNavigation";
import { currentLocaleTag, translate } from "../i18n";

const props = defineProps<{
  snapshot?: PetRuntimeSnapshot;
  connected: boolean;
}>();

const emit = defineEmits<{
  openSettings: [tab: SettingsTabId, inputTab?: InputSettingsTabId];
}>();

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
    return translate("没有电池");
  }
  return props.snapshot?.batteryPercent === undefined
    ? "—"
    : `${Math.round(props.snapshot.batteryPercent)}%`;
});
const batteryStateText = computed(() => {
  const state = props.snapshot?.batteryState ?? "disabled";
  const labels: Record<typeof state, Parameters<typeof translate>[0]> = {
    disabled: "已停用",
    charging: "充电中",
    discharging: "放电中",
    full: "已充满",
    unknown: "未知",
    unavailable: "没有电池",
    error: "错误",
  };
  return translate(labels[state]);
});
const cpuLifecycleStatus = computed(() =>
  translate(props.snapshot?.cpuMonitoring ? "已启用" : "已停用"),
);
const memoryLifecycleStatus = computed(() =>
  translate(props.snapshot?.memoryMonitoring ? "已启用" : "已停用"),
);
const networkLifecycleStatus = computed(() => {
  switch (props.snapshot?.networkStatus) {
    case "active":
      return translate("已启用");
    case "warming":
      return translate("等待首次采样");
    case "error":
      return translate("错误");
    default:
      return translate("已停用");
  }
});
const storageLifecycleStatus = computed(() => {
  switch (props.snapshot?.storageStatus) {
    case "active":
      return translate("已启用");
    case "error":
      return translate("错误");
    default:
      return translate("已停用");
  }
});
const batteryLifecycleStatus = computed(() => {
  switch (props.snapshot?.batteryState) {
    case "unavailable":
      return translate("不可用");
    case "error":
      return translate("错误");
    case "disabled":
    case undefined:
      return translate("已停用");
    default:
      return translate(props.snapshot?.batteryMonitoring ? "已启用" : "已停用");
  }
});
const keyboardLifecycleStatus = computed(() => {
  const labels: Record<NonNullable<PetRuntimeSnapshot["keyboardStatus"]>, Parameters<typeof translate>[0]> = {
    disabled: "已停用",
    starting: "正在启动",
    "permission-required": "需要权限",
    active: "已启用",
    error: "错误",
    unsupported: "不支持",
  };
  return translate(labels[props.snapshot?.keyboardStatus ?? "disabled"]);
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
  return new Intl.DateTimeFormat(currentLocaleTag.value, { timeStyle: "medium" })
    .format(new Date(timestamp));
});
const mouseLifecycleStatus = computed(() => {
  const labels: Record<NonNullable<PetRuntimeSnapshot["mouseStatus"]>, Parameters<typeof translate>[0]> = {
    disabled: "已停用",
    starting: "正在启动",
    "permission-required": "需要权限",
    active: "已启用",
    error: "错误",
    unsupported: "不支持",
  };
  return translate(labels[props.snapshot?.mouseStatus ?? "disabled"]);
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
      ? `${translate("滚轮")} ${formatDirection(props.snapshot.lastScrollDirection)}`
      : translate("滚轮");
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
  return new Intl.DateTimeFormat(currentLocaleTag.value, { timeStyle: "medium" })
    .format(new Date(timestamp));
});

function formatDirection(value: string): string {
  const labels: Record<string, Parameters<typeof translate>[0]> = {
    up: "向上",
    down: "向下",
    left: "向左",
    right: "向右",
  };
  return labels[value] ? translate(labels[value]) : value;
}

function formatMouseButton(button: string): string {
  const labels: Record<string, Parameters<typeof translate>[0]> = {
    left: "左键",
    right: "右键",
    middle: "中键",
    mouse4: "鼠标侧键 4",
    mouse5: "鼠标侧键 5",
    other: "其他",
  };
  return labels[button] ? translate(labels[button]) : button;
}

function formatRuntimeState(value: string | undefined): string {
  const labels: Record<string, Parameters<typeof translate>[0]> = {
    idle: "空闲",
    happy: "开心",
    sleep: "睡眠",
    tired: "疲惫",
    alert: "警觉",
    working: "工作中",
    dragging: "拖动中",
    playing: "播放中",
    paused: "已暂停",
    normal: "正常",
    high: "高负载",
    disabled: "已停用",
  };
  return value && labels[value] ? translate(labels[value]) : value ?? "—";
}

</script>

<template>
  <section class="status-page">
    <header>
      <div>
        <p class="eyebrow">{{ $t("桌宠") }}</p>
        <h2>{{ $t("当前状态") }}</h2>
      </div>
      <span class="connection" :class="{ connected }">
        {{ connected ? $t("已连接桌宠") : $t("等待桌宠窗口") }}
      </span>
    </header>

    <div class="status-grid">
      <article>
        <span>{{ $t("当前状态") }}</span>
        <strong>{{ formatRuntimeState(snapshot?.state) }}</strong>
      </article>
      <article>
        <span>{{ $t("动画状态") }}</span>
        <strong>{{ formatRuntimeState(snapshot?.animationStatus) }}</strong>
      </article>
      <article class="wide">
        <span>{{ $t("最近显示文本") }}</span>
        <strong>{{ snapshot?.lastText || $t("尚未显示") }}</strong>
      </article>
    </div>

    <section class="cpu-panel monitor-panel">
      <div class="monitor-panel__heading">
        <div>
          <p class="eyebrow">{{ $t("系统监控") }} / CPU</p>
          <h3>{{ $t("真实系统 CPU") }}</h3>
        </div>
        <button
          v-if="!snapshot?.cpuMonitoring"
          class="secondary"
          type="button"
          @click="emit('openSettings', 'system')"
        >
          {{ $t("前往设置") }}
        </button>
      </div>
      <div class="cpu-grid">
        <article>
          <span>CPU {{ $t("使用率") }}</span>
          <strong>{{ cpuUsage }}</strong>
        </article>
        <article>
          <span>CPU {{ $t("状态") }}</span>
          <strong :class="{ high: snapshot?.cpuStatus === 'high' }">
            {{ formatRuntimeState(snapshot?.cpuStatus) }}
          </strong>
        </article>
        <article>
          <span>CPU {{ $t("阈值") }}</span>
          <strong>{{ snapshot?.cpuHighThreshold ?? 80 }}%</strong>
        </article>
        <article>
          <span>{{ $t("状态") }}</span>
          <strong>{{ cpuLifecycleStatus }}</strong>
        </article>
      </div>
    </section>

    <section class="memory-panel monitor-panel">
      <div class="monitor-panel__heading">
        <div>
          <p class="eyebrow">{{ $t("系统监控") }} / {{ $t("内存") }}</p>
          <h3>{{ $t("真实系统内存") }}</h3>
        </div>
        <button
          v-if="!snapshot?.memoryMonitoring"
          class="secondary"
          type="button"
          @click="emit('openSettings', 'system')"
        >
          {{ $t("前往设置") }}
        </button>
      </div>
      <div class="memory-grid">
        <article>
          <span>{{ $t("内存") }} {{ $t("使用率") }}</span>
          <strong>{{ memoryUsage }}</strong>
        </article>
        <article>
          <span>{{ $t("已使用") }}</span>
          <strong>{{ formatBytes(snapshot?.memoryUsedBytes) }}</strong>
        </article>
        <article>
          <span>{{ $t("可用") }}</span>
          <strong>{{ formatBytes(snapshot?.memoryAvailableBytes) }}</strong>
        </article>
        <article>
          <span>{{ $t("总计") }}</span>
          <strong>{{ formatBytes(snapshot?.memoryTotalBytes) }}</strong>
        </article>
        <article>
          <span>{{ $t("内存") }} {{ $t("状态") }}</span>
          <strong :class="{ high: snapshot?.memoryStatus === 'high' }">
            {{ formatRuntimeState(snapshot?.memoryStatus) }}
          </strong>
        </article>
        <article>
          <span>{{ $t("内存") }} {{ $t("阈值") }}</span>
          <strong>{{ snapshot?.memoryHighThreshold ?? 85 }}%</strong>
        </article>
        <article>
          <span>{{ $t("状态") }}</span>
          <strong>{{ memoryLifecycleStatus }}</strong>
        </article>
      </div>
    </section>

    <section class="network-panel monitor-panel">
      <div class="monitor-panel__heading">
        <div>
          <p class="eyebrow">{{ $t("系统监控") }} / {{ $t("网络") }}</p>
          <h3>{{ $t("真实系统网络吞吐") }}</h3>
        </div>
        <button
          v-if="snapshot?.networkStatus !== 'active'"
          class="secondary"
          type="button"
          @click="emit('openSettings', 'system')"
        >
          {{ $t("前往设置") }}
        </button>
      </div>
      <div class="network-grid">
        <article>
          <span>{{ $t("下载") }}</span>
          <strong>{{ networkDownload }}</strong>
        </article>
        <article>
          <span>{{ $t("上传") }}</span>
          <strong>{{ networkUpload }}</strong>
        </article>
        <article>
          <span>{{ $t("状态") }}</span>
          <strong>{{ networkLifecycleStatus }}</strong>
        </article>
      </div>
    </section>

    <section class="storage-panel monitor-panel">
      <div class="monitor-panel__heading">
        <div>
          <p class="eyebrow">{{ $t("系统监控") }} / {{ $t("储存") }}</p>
          <h3>{{ $t("真实系统卷储存空间") }}</h3>
        </div>
        <button
          v-if="snapshot?.storageStatus !== 'active'"
          class="secondary"
          type="button"
          @click="emit('openSettings', 'system')"
        >
          {{ $t("前往设置") }}
        </button>
      </div>
      <div class="storage-grid">
        <article>
          <span>{{ $t("使用率") }}</span>
          <strong>{{ storageUsage }}</strong>
        </article>
        <article>
          <span>{{ $t("已使用") }}</span>
          <strong>{{ formatBytes(snapshot?.storageUsedBytes) }}</strong>
        </article>
        <article>
          <span>{{ $t("可用") }}</span>
          <strong>{{ formatBytes(snapshot?.storageAvailableBytes) }}</strong>
        </article>
        <article>
          <span>{{ $t("总计") }}</span>
          <strong>{{ formatBytes(snapshot?.storageTotalBytes) }}</strong>
        </article>
        <article>
          <span>{{ $t("状态") }}</span>
          <strong>{{ storageLifecycleStatus }}</strong>
        </article>
      </div>
    </section>

    <section class="battery-panel monitor-panel">
      <div class="monitor-panel__heading">
        <div>
          <p class="eyebrow">{{ $t("系统监控") }} / {{ $t("电池") }}</p>
          <h3>{{ $t("真实系统电池") }}</h3>
        </div>
        <button
          v-if="!snapshot?.batteryMonitoring"
          class="secondary"
          type="button"
          @click="emit('openSettings', 'system')"
        >
          {{ $t("前往设置") }}
        </button>
      </div>
      <div class="battery-grid">
        <article>
          <span>{{ $t("电量") }}</span>
          <strong>{{ batteryCharge }}</strong>
        </article>
        <article>
          <span>{{ $t("电池状态") }}</span>
          <strong>{{ batteryStateText }}</strong>
        </article>
        <article>
          <span>{{ $t("是否存在") }}</span>
          <strong>{{ snapshot?.batteryPresent ? $t("是") : $t("否") }}</strong>
        </article>
        <article>
          <span>{{ $t("状态") }}</span>
          <strong>{{ batteryLifecycleStatus }}</strong>
        </article>
      </div>
    </section>

    <section class="keyboard-panel monitor-panel">
      <div class="monitor-panel__heading">
        <div>
          <p class="eyebrow">{{ $t("输入感知") }} / {{ $t("键盘") }}</p>
          <h3>{{ $t("全局键盘监听") }}</h3>
        </div>
        <div class="monitor-panel__actions">
          <strong>{{ keyboardLifecycleStatus }}</strong>
          <button v-if="snapshot?.keyboardStatus !== 'active'" class="secondary" type="button" @click="emit('openSettings', 'input', 'keyboard')">{{ $t("前往设置") }}</button>
        </div>
      </div>
      <p
        v-if="snapshot?.keyboardStatus === 'permission-required'"
        class="permission-note"
      >
        {{ $t("需要在 macOS 系统设置中允许输入监听。") }}
      </p>
      <p v-else-if="snapshot?.keyboardMessage" class="permission-note">
        {{ snapshot.keyboardMessage }}
      </p>
      <div class="keyboard-grid">
        <article>
          <span>{{ $t("当前按键") }}</span>
          <strong>{{ pressedKeysText }}</strong>
        </article>
        <article>
          <span>{{ $t("最近按键") }}</span>
          <strong>{{ snapshot?.lastKey ?? "—" }}</strong>
        </article>
        <article>
          <span>{{ $t("最近活动") }}</span>
          <strong>{{ lastKeyboardActivity }}</strong>
        </article>
        <article>
          <span>{{ $t("活动状态") }}</span>
          <strong>
            {{ snapshot?.keyboardActivityStatus === "active" ? $t("活跃") : $t("空闲") }}
          </strong>
        </article>
      </div>
    </section>

    <section class="keyboard-panel monitor-panel">
      <div class="monitor-panel__heading">
        <div>
          <p class="eyebrow">{{ $t("输入感知") }} / {{ $t("鼠标") }}</p>
          <h3>{{ $t("全局鼠标监听") }}</h3>
        </div>
        <div class="monitor-panel__actions">
          <strong>{{ mouseLifecycleStatus }}</strong>
          <button v-if="snapshot?.mouseStatus !== 'active'" class="secondary" type="button" @click="emit('openSettings', 'input', 'mouse')">{{ $t("前往设置") }}</button>
        </div>
      </div>
      <p
        v-if="snapshot?.mouseStatus === 'permission-required'"
        class="permission-note"
      >
        {{ $t("需要在 macOS 系统设置中允许输入监听。") }}
      </p>
      <p v-else-if="snapshot?.mouseMessage" class="permission-note">
        {{ snapshot.mouseMessage }}
      </p>
      <div class="keyboard-grid">
        <article>
          <span>{{ $t("当前按键按钮") }}</span>
          <strong>{{ pressedMouseButtonsText }}</strong>
        </article>
        <article>
          <span>{{ $t("最近鼠标输入") }}</span>
          <strong>{{ lastMouseInput }}</strong>
        </article>
        <article>
          <span>{{ $t("最近活动") }}</span>
          <strong>{{ lastMouseActivity }}</strong>
        </article>
        <article>
          <span>{{ $t("监听范围") }}</span>
          <strong>{{ $t("仅按键与滚轮") }}</strong>
        </article>
      </div>
    </section>

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
  color: var(--cc-accent, #8d78db);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h2 {
  margin: 0;
  color: var(--cc-text-primary, #211b31);
  font-size: 26px;
}

.connection {
  padding: 6px 10px;
  color: var(--cc-danger, #8a5960);
  font-size: 12px;
  background: var(--cc-danger-bg, #fff0f1);
  border-radius: 999px;
}

.connection.connected {
  color: var(--cc-success, #3f735a);
  background: var(--cc-success-bg, #e9f8ef);
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
  background: var(--cc-card-bg, #faf9fd);
  border: var(--cc-card-border-width, 1px) solid var(--cc-card-border, #ebe7f3);
  border-radius: 13px;
}

article.wide {
  grid-column: 1 / -1;
}

article span {
  color: var(--cc-text-secondary, #81798f);
  font-size: 12px;
}

article strong {
  color: var(--cc-text-primary, #2b2438);
  font-size: 15px;
  overflow-wrap: anywhere;
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

.monitor-panel__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cpu-grid,
.memory-grid,
.network-grid,
.storage-grid,
.battery-grid,
.keyboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
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
  color: var(--cc-text-primary, #7a5a35);
  font-size: 12px;
  background: color-mix(in srgb, var(--cc-accent, #8d78db) 10%, var(--cc-card-bg, #fff));
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
  color: var(--cc-danger, #b34152);
}

.memory-grid strong.high {
  color: var(--cc-danger, #b34152);
}

h3 {
  margin: 0;
  color: var(--cc-text-primary, #2b2438);
  font-size: 16px;
}

button {
  padding: 9px 13px;
  color: var(--cc-on-accent, #fff);
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  background: var(--cc-accent, #6f57c8);
  border: 0;
  border-radius: 9px;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: var(--cc-accent-hover, #5d47b2);
}

button.secondary {
  color: var(--cc-text-primary, #5c4a73);
  background: var(--cc-muted-surface, #e9e4f2);
}

button.secondary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--cc-accent, #6f57c8) 15%, var(--cc-card-bg, #fff));
}

button:disabled {
  color: var(--cc-text-secondary, #9b94a8);
  background: var(--cc-muted-surface, #e8e5ed);
  cursor: default;
}

</style>
