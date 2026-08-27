<script setup lang="ts">
import { settingsManager } from "./settingsManager";

const settings = settingsManager.settings;
type NumberKey = "typingBusyWindowSeconds" | "typingBusyCountThreshold" | "typingSpeedThresholdPerSecond" | "typingFeedbackCooldownSeconds";

function updateEnabled(key: "typingBusyEnabled" | "typingSpeedEnabled", event: Event): void {
  settingsManager.updateSetting("input", key, (event.target as HTMLInputElement).checked);
}
function updateNumber(key: NumberKey, event: Event): void {
  settingsManager.updateSetting("input", key, (event.target as HTMLInputElement).valueAsNumber);
}
function updateText(key: "typingBusyText" | "typingSpeedText", event: Event): void {
  settingsManager.updateSetting("input", key, (event.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="settings-sections" data-input-settings="typing">
    <article>
      <div class="section-heading"><h3>Busy Typing</h3><p>Rolling Window达到设定次数时请求Low Priority Dialogue。</p></div>
      <label class="setting-row"><span><strong>Enabled</strong></span><input class="toggle" type="checkbox" :checked="settings.input.typingBusyEnabled" @change="updateEnabled('typingBusyEnabled', $event)" /></label>
      <label class="setting-row"><span><strong>时间窗口</strong><small>10～600秒。</small></span><div class="number-control"><input type="number" min="10" max="600" step="1" :value="settings.input.typingBusyWindowSeconds" :disabled="!settings.input.typingBusyEnabled" @change="updateNumber('typingBusyWindowSeconds', $event)" /><span>sec</span></div></label>
      <label class="setting-row"><span><strong>输入次数</strong><small>10～5000次有效keydown。</small></span><div class="number-control"><input type="number" min="10" max="5000" step="1" :value="settings.input.typingBusyCountThreshold" :disabled="!settings.input.typingBusyEnabled" @change="updateNumber('typingBusyCountThreshold', $event)" /><span>times</span></div></label>
      <label class="setting-row"><span><strong>提示文本</strong><small>留空自动恢复默认。</small></span><input class="text-control" type="text" :value="settings.input.typingBusyText" :disabled="!settings.input.typingBusyEnabled" @change="updateText('typingBusyText', $event)" /></label>
    </article>
    <article>
      <div class="section-heading"><h3>Fast Typing</h3><p>固定最近1秒Rolling Window。</p></div>
      <label class="setting-row"><span><strong>Enabled</strong></span><input class="toggle" type="checkbox" :checked="settings.input.typingSpeedEnabled" @change="updateEnabled('typingSpeedEnabled', $event)" /></label>
      <label class="setting-row"><span><strong>触发速度</strong><small>1～30次/秒。</small></span><div class="number-control"><input type="number" min="1" max="30" step="1" :value="settings.input.typingSpeedThresholdPerSecond" :disabled="!settings.input.typingSpeedEnabled" @change="updateNumber('typingSpeedThresholdPerSecond', $event)" /><span>/ sec</span></div></label>
      <label class="setting-row"><span><strong>提示文本</strong><small>留空自动恢复默认。</small></span><input class="text-control" type="text" :value="settings.input.typingSpeedText" :disabled="!settings.input.typingSpeedEnabled" @change="updateText('typingSpeedText', $event)" /></label>
    </article>
    <article>
      <div class="section-heading"><h3>Common</h3><p>Busy与Fast共享冷却，只在Dialogue实际显示后计时。</p></div>
      <label class="setting-row"><span><strong>提示间隔</strong><small>1～600秒。</small></span><div class="number-control"><input type="number" min="1" max="600" step="1" :value="settings.input.typingFeedbackCooldownSeconds" @change="updateNumber('typingFeedbackCooldownSeconds', $event)" /><span>sec</span></div></label>
    </article>
  </div>
</template>
