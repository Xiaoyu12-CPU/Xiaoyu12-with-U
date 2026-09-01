<script setup lang="ts">
import { computed } from "vue";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRemotePetRuntime } from "../pet/runtimeBridge";
import { OVERLAY_LABELS, resetOverlayPosition } from "../pet/desktopWindows";
import { settingsManager } from "./settingsManager";
import { DEFAULT_SETTINGS } from "./defaultSettings";
import { translate } from "../i18n";
import type { MouseVisualizerPosition } from "./settingsTypes";

const settings = settingsManager.settings;
const { snapshot } = useRemotePetRuntime();

const mouseStatus = computed(() => snapshot.value?.mouseStatus ?? "disabled");
const mouseStatusNote = computed(() => {
  switch (mouseStatus.value) {
    case "active":
      return translate("监听运行中，鼠标可视化可以正常显示。");
    case "starting":
      return translate("正在启动监听…");
    case "permission-required":
      return translate("缺少鼠标输入监听权限");
    case "unsupported":
      return translate("当前平台暂不支持全局鼠标监听。");
    case "error":
      return snapshot.value?.mouseMessage ?? translate("监听启动失败，请重试。");
    default:
      return "";
  }
});
const showRetry = computed(() => mouseStatus.value === "permission-required");

function retryMouseMonitor(): void {
  if (isTauri()) {
    void invoke("start_mouse_monitor").catch((error: unknown) => {
      console.error("Failed to restart the mouse monitor.", error);
    });
  }
}

function openInputMonitoringSettings(): void {
  if (isTauri()) {
    void openUrl(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent",
    ).catch((error: unknown) => {
      console.error("Failed to open Input Monitoring settings.", error);
    });
  }
}

const bodyOpacity = computed(() => Math.round(settings.value.input.mouseVisualizerBodyOpacity * 100));
const buttonOpacity = computed(() => Math.round(settings.value.input.mouseVisualizerButtonOpacity * 100));
const outlineOpacity = computed(() => Math.round(settings.value.input.mouseVisualizerOutlineOpacity * 100));
const activeOpacity = computed(() => Math.round(settings.value.input.mouseVisualizerActiveOpacity * 100));
type ColorKey = "mouseVisualizerBodyColor" | "mouseVisualizerButtonColor" | "mouseVisualizerOutlineColor" | "mouseVisualizerActiveColor";
type OpacityKey = "mouseVisualizerBodyOpacity" | "mouseVisualizerButtonOpacity" | "mouseVisualizerOutlineOpacity" | "mouseVisualizerActiveOpacity";

function updateBoolean(key: "mouseEnabled" | "mouseVisualizerEnabled", event: Event): void {
  settingsManager.updateSetting("input", key, (event.target as HTMLInputElement).checked);
}
function updateWindowBoolean(key: "mouseVisualizerClickThrough", event: Event): void {
  settingsManager.updateSetting("windows", key, (event.target as HTMLInputElement).checked);
}
function updateVisualizerWindow(event: Event): void {
  const enabled = (event.target as HTMLInputElement).checked;
  settingsManager.update({
    input: { mouseVisualizerEnabled: enabled },
    windows: { mouseVisualizerWindowEnabled: enabled },
  });
}
function updatePosition(event: Event): void {
  settingsManager.update({
    input: {
      mouseVisualizerPosition: (event.target as HTMLSelectElement).value as MouseVisualizerPosition,
      mouseVisualizerOffsetX: 0,
      mouseVisualizerOffsetY: 0,
    },
  });
  void resetOverlayPosition(OVERLAY_LABELS.mouseVisualizer).catch((error) => {
    console.error("Failed to reposition the mouse visualizer window.", error);
  });
}
function updateColor(key: ColorKey, event: Event): void {
  settingsManager.updateSetting("input", key, (event.target as HTMLInputElement).value);
}
function updateOpacity(key: OpacityKey, event: Event): void {
  settingsManager.updateSetting("input", key, Number((event.target as HTMLInputElement).value) / 100);
}
function updateOutlineWidth(event: Event): void {
  settingsManager.updateSetting("input", "mouseVisualizerOutlineWidth", Number((event.target as HTMLInputElement).value));
}
function resetPosition(): void {
  settingsManager.update({
    input: {
      mouseVisualizerPosition: DEFAULT_SETTINGS.input.mouseVisualizerPosition,
      mouseVisualizerOffsetX: DEFAULT_SETTINGS.input.mouseVisualizerOffsetX,
      mouseVisualizerOffsetY: DEFAULT_SETTINGS.input.mouseVisualizerOffsetY,
    },
  });
  void resetOverlayPosition(OVERLAY_LABELS.mouseVisualizer).catch((error) => {
    console.error("Failed to reset the mouse visualizer window position.", error);
  });
}
</script>

<template>
  <div class="settings-sections" data-input-settings="mouse">
    <article>
      <div class="section-heading"><h3>{{ $t("鼠标监听") }}</h3><p>{{ $t("监听全局按键与滚轮，不监听移动、坐标或轨迹。") }}</p></div>
      <label class="setting-row"><span><strong>{{ $t("启用鼠标监听") }}</strong><small>{{ $t("与键盘监听开关和运行状态完全独立。") }}</small></span><input class="toggle" type="checkbox" :checked="settings.input.mouseEnabled" @change="updateBoolean('mouseEnabled', $event)" /></label>
      <p v-if="mouseStatusNote" class="monitor-status-note" :data-status="mouseStatus">
        {{ mouseStatusNote }}
        <button v-if="showRetry" type="button" class="retry-button" @click="openInputMonitoringSettings">{{ $t("打开系统设置") }}</button>
        <button v-if="showRetry" type="button" class="retry-button" @click="retryMouseMonitor">{{ $t("重新检测") }}</button>
      </p>
      <label class="setting-row"><span><strong>{{ $t("鼠标可视化窗口") }}</strong><small>{{ $t("显示独立鼠标按键与滚轮窗口；关闭不停止鼠标监听。") }}</small></span><input class="toggle" type="checkbox" :checked="settings.input.mouseVisualizerEnabled && settings.windows.mouseVisualizerWindowEnabled" @change="updateVisualizerWindow" /></label>
      <label class="setting-row"><span><strong>{{ $t("点击穿透") }}</strong><small>{{ $t("开启后不能拖动窗口，可在控制中心关闭。") }}</small></span><input class="toggle" type="checkbox" :checked="settings.windows.mouseVisualizerClickThrough" :disabled="!settings.input.mouseVisualizerEnabled || !settings.windows.mouseVisualizerWindowEnabled" @change="updateWindowBoolean('mouseVisualizerClickThrough', $event)" /></label>
      <label class="setting-row"><span><strong>{{ $t("方位") }}</strong><small>{{ $t("选择相对桌宠的基础锚点。") }}</small></span><select class="select-control" :value="settings.input.mouseVisualizerPosition" @change="updatePosition"><option value="top">{{ $t("上") }}</option><option value="bottom">{{ $t("下") }}</option><option value="left">{{ $t("左") }}</option><option value="right">{{ $t("右") }}</option></select></label>
    </article>

    <article>
      <div class="section-heading"><h3>{{ $t("鼠标主体与按键") }}</h3><p>{{ $t("各层透明度独立，不改变整个组件透明度。") }}</p></div>
      <label class="setting-row"><span><strong>{{ $t("主体颜色") }}</strong></span><div class="color-control"><input type="color" :value="settings.input.mouseVisualizerBodyColor" @input="updateColor('mouseVisualizerBodyColor', $event)" /><code>{{ settings.input.mouseVisualizerBodyColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("主体透明度") }}</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="bodyOpacity" @input="updateOpacity('mouseVisualizerBodyOpacity', $event)" /><output>{{ bodyOpacity }}%</output></div></label>
      <label class="setting-row"><span><strong>{{ $t("按键颜色") }}</strong></span><div class="color-control"><input type="color" :value="settings.input.mouseVisualizerButtonColor" @input="updateColor('mouseVisualizerButtonColor', $event)" /><code>{{ settings.input.mouseVisualizerButtonColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("按键透明度") }}</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="buttonOpacity" @input="updateOpacity('mouseVisualizerButtonOpacity', $event)" /><output>{{ buttonOpacity }}%</output></div></label>
    </article>

    <article>
      <div class="section-heading"><h3>{{ $t("轮廓") }}</h3><p>{{ $t("统一控制主体、分隔线、滚轮与侧键线稿。") }}</p></div>
      <label class="setting-row"><span><strong>{{ $t("轮廓颜色") }}</strong></span><div class="color-control"><input type="color" :value="settings.input.mouseVisualizerOutlineColor" @input="updateColor('mouseVisualizerOutlineColor', $event)" /><code>{{ settings.input.mouseVisualizerOutlineColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("轮廓透明度") }}</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="outlineOpacity" @input="updateOpacity('mouseVisualizerOutlineOpacity', $event)" /><output>{{ outlineOpacity }}%</output></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("轮廓粗细") }}</strong><small>0～4 px</small></span><div class="scale-control"><input type="range" min="0" max="4" step="0.25" :value="settings.input.mouseVisualizerOutlineWidth" @input="updateOutlineWidth" /><output>{{ settings.input.mouseVisualizerOutlineWidth }} px</output></div></label>
    </article>

    <article>
      <div class="section-heading"><h3>{{ $t("激活状态") }}</h3><p>{{ $t("按下按键与滚轮脉冲共享强调样式。") }}</p></div>
      <label class="setting-row"><span><strong>{{ $t("激活颜色") }}</strong></span><div class="color-control"><input type="color" :value="settings.input.mouseVisualizerActiveColor" @input="updateColor('mouseVisualizerActiveColor', $event)" /><code>{{ settings.input.mouseVisualizerActiveColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("激活透明度") }}</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="activeOpacity" @input="updateOpacity('mouseVisualizerActiveOpacity', $event)" /><output>{{ activeOpacity }}%</output></div></label>
      <div class="setting-row"><span><strong>{{ $t("鼠标窗口位置") }}</strong><small>{{ $t("按所选方位重新放到当前默认位置。") }}</small></span><button type="button" @click="resetPosition">{{ $t("重置鼠标窗口位置") }}</button></div>
    </article>
  </div>
</template>

<style scoped>
.monitor-status-note {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 8px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
  background: var(--cc-muted-surface, rgba(96, 165, 250, 0.12));
  color: var(--control-center-text, inherit);
}

.monitor-status-note[data-status="permission-required"],
.monitor-status-note[data-status="error"] {
  background: var(--cc-danger-bg, rgba(248, 113, 113, 0.16));
}

.monitor-status-note[data-status="active"] {
  background: var(--cc-success-bg, rgba(74, 222, 128, 0.14));
}

.retry-button {
  flex: none;
  padding: 2px 10px;
  font-size: 12px;
}
</style>
