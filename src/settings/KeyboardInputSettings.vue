<script setup lang="ts">
import { computed } from "vue";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRemotePetRuntime } from "../pet/runtimeBridge";
import { OVERLAY_LABELS, resetOverlayPosition } from "../pet/desktopWindows";
import { settingsManager } from "./settingsManager";
import type { KeyDisplayFlowDirection, KeyDisplayPosition } from "./settingsTypes";

const settings = settingsManager.settings;
const { snapshot } = useRemotePetRuntime();

const keyboardStatus = computed(() => snapshot.value?.keyboardStatus ?? "disabled");
const keyboardStatusNote = computed(() => {
  switch (keyboardStatus.value) {
    case "active":
      return "监听运行中，键位历史可以正常显示。";
    case "starting":
      return "正在启动监听…";
    case "permission-required":
      return "缺少「输入监听」权限，键位历史不会显示。请在 系统设置 → 隐私与安全性 → 输入监控 中允许 withXiaoyu12；若其开关无法打开，先点 − 删除该条目，再点 + 重新选择应用。授权后应用会每 2 秒自动重试，若仍无效请重启应用。";
    case "unsupported":
      return "当前平台暂不支持全局键盘监听。";
    case "error":
      return snapshot.value?.keyboardMessage ?? "监听启动失败，请重试。";
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
  settingsManager.updateSetting("input", "keyDisplayPosition", (event.target as HTMLSelectElement).value as KeyDisplayPosition);
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
  settingsManager.update({ input: { keyDisplayOffsetX: 0, keyDisplayOffsetY: 0 } });
  void resetOverlayPosition(OVERLAY_LABELS.keyboardHistory).catch((error) => {
    console.error("Failed to reset the keyboard history window position.", error);
  });
}
</script>

<template>
  <div class="settings-sections" data-input-settings="keyboard">
    <article>
      <div class="section-heading">
        <h3>Keyboard Monitor</h3>
        <p>监听全局键盘活动；只维护Runtime状态，不持久化按键内容。</p>
      </div>
      <label class="setting-row">
        <span><strong>Keyboard Monitoring</strong><small>macOS可能要求授予输入监听权限。</small></span>
        <input class="toggle" type="checkbox" :checked="settings.input.keyboardEnabled" @change="updateBoolean('keyboardEnabled', $event)" />
      </label>
      <p v-if="keyboardStatusNote" class="monitor-status-note" :data-status="keyboardStatus">
        {{ keyboardStatusNote }}
        <button v-if="showRetry" type="button" class="retry-button" @click="openInputMonitoringSettings">打开系统设置</button>
        <button v-if="showRetry" type="button" class="retry-button" @click="retryKeyboardMonitor">重新检测</button>
      </p>
      <label class="setting-row">
        <span><strong>键盘历史窗口</strong><small>显示独立键位历史窗口；关闭不影响键盘活动驱动桌宠状态。</small></span>
        <input class="toggle" type="checkbox" :checked="settings.input.keyDisplayEnabled && settings.windows.keyboardHistoryWindowEnabled" @change="updateHistoryWindow" />
      </label>
      <label class="setting-row">
        <span><strong>鼠标穿透</strong><small>开启后不能拖动窗口，可在控制中心关闭。</small></span>
        <input class="toggle" type="checkbox" :checked="settings.windows.keyboardHistoryClickThrough" :disabled="!settings.input.keyDisplayEnabled || !settings.windows.keyboardHistoryWindowEnabled" @change="updateWindowBoolean('keyboardHistoryClickThrough', $event)" />
      </label>
    </article>

    <article>
      <div class="section-heading"><h3>Keyboard History</h3><p>当前运行期的Chord与短时记录显示。</p></div>
      <label class="setting-row scale-row">
        <span><strong>同时显示数量</strong><small>保留最新1～8条。</small></span>
        <div class="scale-control"><input type="range" min="1" max="8" step="1" :value="settings.input.keyDisplayMaxItems" @input="updateNumber('keyDisplayMaxItems', $event)" /><output>{{ settings.input.keyDisplayMaxItems }}</output></div>
      </label>
      <label class="setting-row">
        <span><strong>Permanent</strong><small>本次运行期间保留，仍受数量限制。</small></span>
        <input class="toggle" type="checkbox" :checked="settings.input.keyDisplayPersistent" @change="updateBoolean('keyDisplayPersistent', $event)" />
      </label>
      <label class="setting-row scale-row">
        <span><strong>自动消失时间</strong><small>Permanent开启时暂停计时。</small></span>
        <div class="scale-control"><input type="range" min="500" max="10000" step="500" :value="settings.input.keyDisplayDurationMs" :disabled="settings.input.keyDisplayPersistent" @input="updateNumber('keyDisplayDurationMs', $event)" /><output>{{ durationSeconds }}s</output></div>
      </label>
      <label class="setting-row">
        <span><strong>Position</strong><small>决定History相对桌宠的基础锚点。</small></span>
        <select class="select-control" :value="settings.input.keyDisplayPosition" @change="updatePosition"><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option></select>
      </label>
      <label class="setting-row">
        <span><strong>Flow Direction</strong><small>独立控制旧记录被推动的方向。</small></span>
        <select class="select-control" :value="settings.input.keyDisplayFlowDirection" @change="updateFlow"><option value="auto">Auto（远离桌宠）</option><option value="up">Up ↑</option><option value="down">Down ↓</option><option value="left">Left ←</option><option value="right">Right →</option></select>
      </label>
    </article>

    <article>
      <div class="section-heading"><h3>Start Line</h3><p>拖动起始线可以调整History原点。</p></div>
      <label class="setting-row scale-row">
        <span><strong>起始线与键位间距</strong><small>0～80px，只移动Entries。</small></span>
        <div class="scale-control"><input type="range" min="0" max="80" step="1" :value="settings.input.keyDisplayStartLineGapPx" @input="updateNumber('keyDisplayStartLineGapPx', $event)" /><output>{{ settings.input.keyDisplayStartLineGapPx }} px</output></div>
      </label>
      <label class="setting-row">
        <span><strong>起始线颜色</strong></span>
        <div class="color-control"><input type="color" :value="settings.input.keyDisplayStartLineColor" @input="updateLineColor" /><code>{{ settings.input.keyDisplayStartLineColor }}</code></div>
      </label>
      <label class="setting-row scale-row">
        <span><strong>起始线透明度</strong><small>0%时透明拖动区域仍然可用。</small></span>
        <div class="scale-control"><input type="range" min="0" max="100" step="5" :value="lineOpacityPercent" @input="updateLineOpacity" /><output>{{ lineOpacityPercent }}%</output></div>
      </label>
      <div class="setting-row"><span><strong>键盘窗口位置</strong><small>按 Position 重新放到桌宠四周。</small></span><button type="button" @click="resetPosition">重置键盘窗口位置</button></div>
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
