<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { PetRuntimeSnapshot } from "../pet/runtimeStatus";
import type { SystemStatusItemId } from "../system/statusItems";
import { formatNetworkRate } from "../system/formatNetworkRate";
import { formatBytePair } from "../system/formatBytes";
import { translate } from "../i18n";

const props = defineProps<{
  snapshot: PetRuntimeSnapshot;
  backgroundColor: string;
  backgroundOpacity: number;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  panelWidth: number;
  panelScale: number;
  visibleItems: readonly SystemStatusItemId[];
  windowDragHandle?: boolean;
}>();

const emit = defineEmits<{
  pointerDown: [event: PointerEvent];
  pointerMove: [event: PointerEvent];
  pointerUp: [event: PointerEvent];
  pointerCancel: [event: PointerEvent];
  contextMenu: [event: MouseEvent];
  sizeChange: [size: { width: number; height: number }];
  openSystemMonitorSettings: [];
}>();

const panelElement = ref<HTMLElement>();
let resizeObserver: ResizeObserver | undefined;
let lastReportedWidth = 0;
let lastReportedHeight = 0;

const panelStyle = computed(() => {
  const scale = props.panelScale;

  return {
    color: props.textColor,
    backgroundColor: toRgba(props.backgroundColor, props.backgroundOpacity),
    borderColor: props.borderColor,
    borderWidth: `${props.borderWidth * scale}px`,
    "--panel-width": `${props.panelWidth * scale}px`,
    "--panel-gap": `${10 * scale}px`,
    "--panel-padding": `${13 * scale}px`,
    "--panel-radius": `${15 * scale}px`,
    "--panel-shadow-y": `${8 * scale}px`,
    "--panel-shadow-blur": `${24 * scale}px`,
    "--heading-gap": `${10 * scale}px`,
    "--header-padding": `${3 * scale}px`,
    "--header-font-size": `${11 * scale}px`,
    "--status-dot-size": `${7 * scale}px`,
    "--status-dot-ring": `${3 * scale}px`,
    "--metric-gap": `${6 * scale}px`,
    "--metric-padding-y": `${9 * scale}px`,
    "--metric-padding-x": `${10 * scale}px`,
    "--metric-radius": `${10 * scale}px`,
    "--metric-label-size": `${12 * scale}px`,
    "--metric-value-size": `${15 * scale}px`,
    "--metric-small-size": `${10 * scale}px`,
    "--progress-height": `${5 * scale}px`,
    "--placeholder-padding": `${8 * scale}px`,
    "--placeholder-value-size": `${13 * scale}px`,
  };
});

const visibleItemSet = computed(() => new Set(props.visibleItems));

const cpuUsageText = computed(() =>
  !props.snapshot.cpuMonitoring
    ? translate("未启用")
    : props.snapshot.cpuUsagePercent === undefined
      ? translate("采样中…")
      : `${props.snapshot.cpuUsagePercent.toFixed(1)}%`,
);
const memoryUsageText = computed(() =>
  !props.snapshot.memoryMonitoring
    ? translate("未启用")
    : props.snapshot.memoryUsagePercent === undefined
      ? translate("采样中…")
      : `${props.snapshot.memoryUsagePercent.toFixed(1)}%`,
);
const memoryBytesText = computed(() => {
  if (
    !props.snapshot.memoryMonitoring ||
    props.snapshot.memoryUsedBytes === undefined ||
    props.snapshot.memoryTotalBytes === undefined
  ) {
    return "";
  }

  return formatBytePair(
    props.snapshot.memoryUsedBytes,
    props.snapshot.memoryTotalBytes,
  );
});
const networkStatusText = computed(() => {
  switch (props.snapshot.networkStatus) {
    case "warming":
      return translate("采样中…");
    case "error":
      return translate("读取失败");
    case "active":
      return "";
    default:
      return translate("未启用");
  }
});
const storageUsageText = computed(() => {
  if (props.snapshot.storageStatus === "error") {
    return translate("读取失败");
  }
  if (!props.snapshot.storageMonitoring) {
    return translate("未启用");
  }
  if (props.snapshot.storageUsagePercent === undefined) {
    return translate("读取中…");
  }
  return translate("使用比例", {
    percent: props.snapshot.storageUsagePercent.toFixed(1),
  });
});
const storageBytesText = computed(() =>
  formatBytePair(
    props.snapshot.storageUsedBytes,
    props.snapshot.storageTotalBytes,
  ),
);
const batteryValueText = computed(() => {
  if (props.snapshot.batteryState === "unavailable") {
    return translate("无电池");
  }
  if (props.snapshot.batteryState === "error") {
    return translate("读取失败");
  }
  if (!props.snapshot.batteryMonitoring) {
    return translate("未启用");
  }
  return props.snapshot.batteryPercent === undefined
    ? translate("读取中…")
    : `${Math.round(props.snapshot.batteryPercent)}%`;
});
const batteryStateText = computed(() => {
  switch (props.snapshot.batteryState) {
    case "charging":
      return translate("充电中");
    case "discharging":
      return translate("使用电池");
    case "full":
      return translate("已充满");
    case "unknown":
      return translate("状态未知");
    default:
      return "";
  }
});

onMounted(() => {
  const element = panelElement.value;
  if (!element) {
    return;
  }

  reportSize(element);
  resizeObserver = new ResizeObserver(() => reportSize(element));
  resizeObserver.observe(element);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

function reportSize(element: HTMLElement): void {
  const width = element.offsetWidth;
  const height = element.offsetHeight;

  if (width === lastReportedWidth && height === lastReportedHeight) {
    return;
  }

  lastReportedWidth = width;
  lastReportedHeight = height;
  emit("sizeChange", { width, height });
}

function percentageWidth(value: number | undefined, active: boolean): string {
  if (!active || value === undefined) {
    return "0%";
  }
  return `${Math.min(Math.max(value, 0), 100)}%`;
}

function isVisible(itemId: SystemStatusItemId): boolean {
  return visibleItemSet.value.has(itemId);
}

function toRgba(hexColor: string, opacity: number): string {
  const red = Number.parseInt(hexColor.slice(1, 3), 16);
  const green = Number.parseInt(hexColor.slice(3, 5), 16);
  const blue = Number.parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}
</script>

<template>
  <section
    ref="panelElement"
    class="system-status-bubble"
    :class="{ 'system-status-bubble--window-drag': windowDragHandle }"
    :style="panelStyle"
    :aria-label="$t('系统状态')"
    @pointerdown.stop.prevent="emit('pointerDown', $event)"
    @pointermove.stop.prevent="emit('pointerMove', $event)"
    @pointerup.stop.prevent="emit('pointerUp', $event)"
    @pointercancel.stop.prevent="emit('pointerCancel', $event)"
    @click.stop
    @contextmenu.stop.prevent="emit('contextMenu', $event)"
  >
    <header>
      <span>{{ $t("系统状态") }}</span>
      <i aria-hidden="true"></i>
    </header>

    <div v-if="isVisible('cpu')" class="metric">
      <div class="metric__heading">
        <strong>CPU</strong>
        <span :class="`metric__value--${snapshot.cpuStatus}`">{{ cpuUsageText }}</span>
      </div>
      <div v-if="snapshot.cpuMonitoring" class="progress" aria-hidden="true">
        <span :style="{ width: percentageWidth(snapshot.cpuUsagePercent, snapshot.cpuMonitoring) }"></span>
      </div>
      <button
        v-else
        class="settings-link"
        type="button"
        @pointerdown.stop
        @pointerup.stop
        @click.stop="emit('openSystemMonitorSettings')"
      >
        {{ $t("前往设置") }}
      </button>
    </div>

    <div v-if="isVisible('memory')" class="metric">
      <div class="metric__heading">
        <strong>{{ $t("内存") }}</strong>
        <span :class="`metric__value--${snapshot.memoryStatus}`">{{ memoryUsageText }}</span>
      </div>
      <small v-if="memoryBytesText">{{ memoryBytesText }}</small>
      <div v-if="snapshot.memoryMonitoring" class="progress" aria-hidden="true">
        <span :style="{ width: percentageWidth(snapshot.memoryUsagePercent, snapshot.memoryMonitoring) }"></span>
      </div>
      <button
        v-else
        class="settings-link"
        type="button"
        @pointerdown.stop
        @pointerup.stop
        @click.stop="emit('openSystemMonitorSettings')"
      >
        {{ $t("前往设置") }}
      </button>
    </div>

    <div v-if="isVisible('network')" class="metric">
      <div class="metric__heading">
        <strong>{{ $t("网络") }}</strong>
        <span v-if="snapshot.networkStatus !== 'active'" class="metric__value--disabled">
          {{ networkStatusText }}
        </span>
      </div>
      <div v-if="snapshot.networkStatus === 'active'" class="network-rates">
        <small>↓ {{ formatNetworkRate(snapshot.networkDownloadBytesPerSecond) }}</small>
        <small>↑ {{ formatNetworkRate(snapshot.networkUploadBytesPerSecond) }}</small>
      </div>
      <button
        v-else-if="!snapshot.networkMonitoring"
        class="settings-link"
        type="button"
        @pointerdown.stop
        @pointerup.stop
        @click.stop="emit('openSystemMonitorSettings')"
      >
        {{ $t("前往设置") }}
      </button>
    </div>

    <div v-if="isVisible('storage')" class="metric">
      <div class="metric__heading metric__heading--storage">
        <strong>{{ $t("储存") }}</strong>
        <span :class="{ 'metric__value--disabled': snapshot.storageStatus !== 'active' }">
          {{ storageUsageText }}
        </span>
      </div>
      <small v-if="snapshot.storageStatus === 'active' && snapshot.storageUsagePercent !== undefined">
        {{ storageBytesText }}
      </small>
      <div
        v-if="snapshot.storageStatus === 'active' && snapshot.storageUsagePercent !== undefined"
        class="progress"
        aria-hidden="true"
      >
        <span
          :style="{
            width: percentageWidth(
              snapshot.storageUsagePercent,
              snapshot.storageMonitoring,
            ),
          }"
        ></span>
      </div>
      <button
        v-else-if="!snapshot.storageMonitoring"
        class="settings-link"
        type="button"
        @pointerdown.stop
        @pointerup.stop
        @click.stop="emit('openSystemMonitorSettings')"
      >
        {{ $t("前往设置") }}
      </button>
    </div>

    <div v-if="isVisible('battery')" class="metric">
      <div class="metric__heading">
        <strong>{{ $t("电池") }}</strong>
        <span :class="{ 'metric__value--disabled': !snapshot.batteryPresent }">
          {{ batteryValueText }}
        </span>
      </div>
      <small v-if="snapshot.batteryPresent">{{ batteryStateText }}</small>
      <div
        v-if="snapshot.batteryPresent && snapshot.batteryPercent !== undefined"
        class="progress"
        aria-hidden="true"
      >
        <span
          :style="{
            width: percentageWidth(
              snapshot.batteryPercent,
              snapshot.batteryMonitoring,
            ),
          }"
        ></span>
      </div>
      <button
        v-else-if="snapshot.batteryState === 'disabled'"
        class="settings-link"
        type="button"
        @pointerdown.stop
        @pointerup.stop
        @click.stop="emit('openSystemMonitorSettings')"
      >
        {{ $t("前往设置") }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.system-status-bubble {
  box-sizing: border-box;
  display: grid;
  width: var(--panel-width);
  gap: var(--panel-gap);
  padding: var(--panel-padding);
  overflow: hidden;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.25;
  border-style: solid;
  border-radius: var(--panel-radius);
  box-shadow: 0 var(--panel-shadow-y) var(--panel-shadow-blur) rgba(31, 24, 48, .14);
  cursor: move;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.system-status-bubble--window-drag { cursor: grab; }
.system-status-bubble--window-drag:active { cursor: grabbing; }

header,
.metric__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--heading-gap);
}

header {
  padding-bottom: var(--header-padding);
  font-size: var(--header-font-size);
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
  opacity: .78;
}

header i {
  width: var(--status-dot-size);
  height: var(--status-dot-size);
  background: #8d78db;
  border-radius: 50%;
  box-shadow: 0 0 0 var(--status-dot-ring) rgba(141, 120, 219, .16);
}

.metric {
  display: grid;
  gap: var(--metric-gap);
  padding: var(--metric-padding-y) var(--metric-padding-x);
  background: rgba(255, 255, 255, .42);
  border-radius: var(--metric-radius);
}

.metric__heading strong { font-size: var(--metric-label-size); }
.metric__heading span { font-size: var(--metric-value-size); font-weight: 750; }
.metric__heading .metric__value--high { color: #c44d5d; }
.metric__heading .metric__value--disabled { font-size: var(--metric-label-size); font-weight: 650; opacity: .62; }
.metric__heading--storage { gap: calc(var(--heading-gap) * .45); }
.metric__heading--storage strong,
.metric__heading--storage span { white-space: nowrap; }
.metric__heading--storage span { font-size: var(--metric-label-size); }
.metric small {
  overflow: hidden;
  font-size: var(--metric-small-size);
  white-space: nowrap;
  text-overflow: ellipsis;
  opacity: .62;
}
.network-rates { display: grid; gap: calc(var(--metric-gap) * .55); }
.network-rates small { font-size: var(--metric-label-size); font-weight: 700; opacity: .82; }

.settings-link {
  width: fit-content;
  padding: 0;
  color: inherit;
  font: inherit;
  font-size: var(--metric-small-size);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
  background: transparent;
  border: 0;
  cursor: pointer;
  opacity: .72;
}

.settings-link:hover { opacity: 1; }

.progress {
  height: var(--progress-height);
  overflow: hidden;
  background: rgba(74, 63, 92, .12);
  border-radius: 999px;
}

.progress span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #8d78db, #6651b8);
  border-radius: inherit;
  transition: width 240ms ease;
}

.metric--placeholder { padding-block: var(--placeholder-padding); opacity: .68; }
.metric--placeholder .metric__heading span { font-size: var(--placeholder-value-size); }
</style>
