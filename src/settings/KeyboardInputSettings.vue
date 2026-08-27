<script setup lang="ts">
import { computed } from "vue";
import { resetKeyHistoryOffset } from "../input/keyHistoryDrag";
import { settingsManager } from "./settingsManager";
import type { KeyDisplayFlowDirection, KeyDisplayPosition } from "./settingsTypes";

const settings = settingsManager.settings;
const durationSeconds = computed(() => (settings.value.input.keyDisplayDurationMs / 1000).toFixed(1));
const lineOpacityPercent = computed(() => Math.round(settings.value.input.keyDisplayStartLineOpacity * 100));

function updateBoolean(key: "keyboardEnabled" | "keyDisplayEnabled" | "keyDisplayPersistent", event: Event): void {
  settingsManager.updateSetting("input", key, (event.target as HTMLInputElement).checked);
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
  const offset = resetKeyHistoryOffset();
  settingsManager.update({ input: { keyDisplayOffsetX: offset.x, keyDisplayOffsetY: offset.y } });
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
      <label class="setting-row">
        <span><strong>Show Keyboard History</strong><small>只控制可视化；关闭后Keyboard仍可驱动WORKING。</small></span>
        <input class="toggle" type="checkbox" :checked="settings.input.keyDisplayEnabled" @change="updateBoolean('keyDisplayEnabled', $event)" />
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
      <div class="setting-row"><span><strong>键位显示位置</strong><small>只清除Manual Offset。</small></span><button type="button" @click="resetPosition">重置键位显示位置</button></div>
    </article>
  </div>
</template>
