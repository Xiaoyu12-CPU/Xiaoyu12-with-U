<script setup lang="ts">
import { computed } from "vue";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRemotePetRuntime } from "../pet/runtimeBridge";
import { OVERLAY_LABELS, resetOverlayPosition } from "../pet/desktopWindows";
import { settingsManager } from "./settingsManager";
import { DEFAULT_SETTINGS } from "./defaultSettings";
import { translate } from "../i18n";
import type { KeyDisplayFlowDirection, KeyDisplayPosition } from "./settingsTypes";

const settings = settingsManager.settings;
const { snapshot } = useRemotePetRuntime();

const keyboardStatus = computed(() => snapshot.value?.keyboardStatus ?? "disabled");
const keyboardStatusNote = computed(() => {
  switch (keyboardStatus.value) {
    case "active":
      return translate("监听运行中，键位历史可以正常显示。");
    case "starting":
      return translate("正在启动监听…");
    case "permission-required":
      return translate("缺少键盘输入监听权限");
    case "unsupported":
      return translate("当前平台暂不支持全局键盘监听。");
    case "error":
      return snapshot.value?.keyboardMessage ?? translate("监听启动失败，请重试。");
    default:
      return "";
  }
});
const showRetry = computed(() => keyboardStatus.value === "permission-required");

function retryKeyboardMonitor(): void {
  if (isTauri()) {
    void invoke("start_keyboard_monitor").catch((error: unknown) => {
      console.error("Failed to restart the keyboard monitor.", error);
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

const durationSeconds = computed(() => (settings.value.input.keyDisplayDurationMs / 1000).toFixed(1));
const lineOpacityPercent = computed(() => Math.round(settings.value.input.keyDisplayStartLineOpacity * 100));

function updateBoolean(key: "keyboardEnabled" | "keyDisplayEnabled" | "keyDisplayPersistent", event: Event): void {
  settingsManager.updateSetting("input", key, (event.target as HTMLInputElement).checked);
}

function updateWindowBoolean(key: "keyboardHistoryClickThrough", event: Event): void {
  settingsManager.updateSetting("windows", key, (event.target as HTMLInputElement).checked);
}

function updateHistoryWindow(event: Event): void {
  const enabled = (event.target as HTMLInputElement).checked;
  settingsManager.update({
    input: { keyDisplayEnabled: enabled },
    windows: { keyboardHistoryWindowEnabled: enabled },
  });
}

function updateNumber(key: "keyDisplayMaxItems" | "keyDisplayDurationMs" | "keyDisplayStartLineGapPx", event: Event): void {
  settingsManager.updateSetting("input", key, Number((event.target as HTMLInputElement).value));
}

function updatePosition(event: Event): void {
  settingsManager.update({
    input: {
      keyDisplayPosition: (event.target as HTMLSelectElement).value as KeyDisplayPosition,
      keyDisplayOffsetX: 0,
      keyDisplayOffsetY: 0,
    },
  });
  void resetOverlayPosition(OVERLAY_LABELS.keyboardHistory).catch((error) => {
    console.error("Failed to reposition the keyboard history window.", error);
  });
}

function updateFlow(event: Event): void {
  settingsManager.updateSetting("input", "keyDisplayFlowDirection", (event.target as HTMLSelectElement).value as KeyDisplayFlowDirection);
}

function updateLineColor(event: Event): void {
  settingsManager.updateSetting("input", "keyDisplayStartLineColor", (event.target as HTMLInputElement).value);
}

function updateLineOpacity(event: Event): void {
  settingsManager.updateSetting("input", "keyDisplayStartLineOpacity", Number((event.target as HTMLInputElement).value) / 100);
}

function resetPosition(): void {
  settingsManager.update({
    input: {
      keyDisplayPosition: DEFAULT_SETTINGS.input.keyDisplayPosition,
      keyDisplayOffsetX: DEFAULT_SETTINGS.input.keyDisplayOffsetX,
      keyDisplayOffsetY: DEFAULT_SETTINGS.input.keyDisplayOffsetY,
    },
  });
  void resetOverlayPosition(OVERLAY_LABELS.keyboardHistory).catch((error) => {
    console.error("Failed to reset the keyboard history window position.", error);
  });
}
</script>

<template>
  <div class="settings-sections" data-input-settings="keyboard">
    <article>
      <div class="section-heading">
        <h3>{{ $t("键盘监听") }}</h3>
        <p>{{ $t("监听全局键盘活动；只维护运行状态，不持久化按键内容。") }}</p>
      </div>
      <label class="setting-row">
        <span><strong>{{ $t("启用键盘监听") }}</strong><small>{{ $t("macOS 可能要求授予输入监听权限。") }}</small></span>
        <input class="toggle" type="checkbox" :checked="settings.input.keyboardEnabled" @change="updateBoolean('keyboardEnabled', $event)" />
      </label>
      <p v-if="keyboardStatusNote" class="monitor-status-note" :data-status="keyboardStatus">
        {{ keyboardStatusNote }}
        <button v-if="showRetry" type="button" class="retry-button" @click="openInputMonitoringSettings">{{ $t("打开系统设置") }}</button>
        <button v-if="showRetry" type="button" class="retry-button" @click="retryKeyboardMonitor">{{ $t("重新检测") }}</button>
      </p>
      <label class="setting-row">
        <span><strong>{{ $t("键盘历史窗口") }}</strong><small>{{ $t("显示独立键位历史窗口；关闭不影响键盘活动驱动桌宠状态。") }}</small></span>
        <input class="toggle" type="checkbox" :checked="settings.input.keyDisplayEnabled && settings.windows.keyboardHistoryWindowEnabled" @change="updateHistoryWindow" />
      </label>
      <label class="setting-row">
        <span><strong>{{ $t("点击穿透") }}</strong><small>{{ $t("开启后不能拖动窗口，可在控制中心关闭。") }}</small></span>
        <input class="toggle" type="checkbox" :checked="settings.windows.keyboardHistoryClickThrough" :disabled="!settings.input.keyDisplayEnabled || !settings.windows.keyboardHistoryWindowEnabled" @change="updateWindowBoolean('keyboardHistoryClickThrough', $event)" />
      </label>
    </article>

    <article>
      <div class="section-heading"><h3>{{ $t("键盘历史") }}</h3><p>{{ $t("显示当前按键组合与短时记录。") }}</p></div>
      <label class="setting-row scale-row">
        <span><strong>{{ $t("同时显示数量") }}</strong><small>{{ $t("保留最新 1～8 条。") }}</small></span>
        <div class="scale-control"><input type="range" min="1" max="8" step="1" :value="settings.input.keyDisplayMaxItems" @input="updateNumber('keyDisplayMaxItems', $event)" /><output>{{ settings.input.keyDisplayMaxItems }}</output></div>
      </label>
      <label class="setting-row">
        <span><strong>{{ $t("永久显示") }}</strong><small>{{ $t("本次运行期间保留，仍受数量限制。") }}</small></span>
        <input class="toggle" type="checkbox" :checked="settings.input.keyDisplayPersistent" @change="updateBoolean('keyDisplayPersistent', $event)" />
      </label>
      <label class="setting-row scale-row">
        <span><strong>{{ $t("自动消失时间") }}</strong><small>{{ $t("永久显示开启时暂停计时。") }}</small></span>
        <div class="scale-control"><input type="range" min="500" max="10000" step="500" :value="settings.input.keyDisplayDurationMs" :disabled="settings.input.keyDisplayPersistent" @input="updateNumber('keyDisplayDurationMs', $event)" /><output>{{ durationSeconds }}s</output></div>
      </label>
      <label class="setting-row">
        <span><strong>{{ $t("方位") }}</strong><small>{{ $t("决定窗口相对桌宠的基础锚点。") }}</small></span>
        <select class="select-control" :value="settings.input.keyDisplayPosition" @change="updatePosition"><option value="top">{{ $t("上") }}</option><option value="bottom">{{ $t("下") }}</option><option value="left">{{ $t("左") }}</option><option value="right">{{ $t("右") }}</option></select>
      </label>
      <label class="setting-row">
        <span><strong>{{ $t("流动方向") }}</strong><small>{{ $t("独立控制旧记录被推动的方向。") }}</small></span>
        <select class="select-control" :value="settings.input.keyDisplayFlowDirection" @change="updateFlow"><option value="auto">{{ $t("自动（远离桌宠）") }}</option><option value="up">{{ $t("向上") }}</option><option value="down">{{ $t("向下") }}</option><option value="left">{{ $t("向左") }}</option><option value="right">{{ $t("向右") }}</option></select>
      </label>
    </article>

    <article>
      <div class="section-heading"><h3>{{ $t("起始线") }}</h3><p>{{ $t("拖动起始线可以调整键盘历史原点。") }}</p></div>
      <label class="setting-row scale-row">
        <span><strong>{{ $t("起始线与键位间距") }}</strong><small>{{ $t("0～80 px，只移动按键条目。") }}</small></span>
        <div class="scale-control"><input type="range" min="0" max="80" step="1" :value="settings.input.keyDisplayStartLineGapPx" @input="updateNumber('keyDisplayStartLineGapPx', $event)" /><output>{{ settings.input.keyDisplayStartLineGapPx }} px</output></div>
      </label>
      <label class="setting-row">
        <span><strong>{{ $t("起始线颜色") }}</strong></span>
        <div class="color-control"><input type="color" :value="settings.input.keyDisplayStartLineColor" @input="updateLineColor" /><code>{{ settings.input.keyDisplayStartLineColor }}</code></div>
      </label>
      <label class="setting-row scale-row">
        <span><strong>{{ $t("起始线透明度") }}</strong><small>{{ $t("透明度为 0% 时拖动区域仍然可用。") }}</small></span>
        <div class="scale-control"><input type="range" min="0" max="100" step="5" :value="lineOpacityPercent" @input="updateLineOpacity" /><output>{{ lineOpacityPercent }}%</output></div>
      </label>
      <div class="setting-row"><span><strong>{{ $t("键盘窗口位置") }}</strong><small>{{ $t("按所选方位重新放到当前默认位置。") }}</small></span><button type="button" @click="resetPosition">{{ $t("重置键盘窗口位置") }}</button></div>
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
