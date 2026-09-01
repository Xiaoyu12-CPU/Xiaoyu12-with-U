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
    <p v-if="!settings.input.keyboardEnabled" class="settings-notice">
      {{ $t("键盘监听当前已关闭。这些规则会保留，但在开启前不会触发。") }}
    </p>
    <article>
      <div class="section-heading"><h3>{{ $t("忙碌反馈") }}</h3><p>{{ $t("在滚动时间窗口达到设定次数时触发低优先级对话。") }}</p></div>
      <label class="setting-row"><span><strong>{{ $t("启用") }}</strong></span><input class="toggle" type="checkbox" :checked="settings.input.typingBusyEnabled" @change="updateEnabled('typingBusyEnabled', $event)" /></label>
      <label class="setting-row"><span><strong>{{ $t("时间窗口") }}</strong><small>{{ $t("10～600 秒。") }}</small></span><div class="number-control"><input type="number" min="10" max="600" step="1" :value="settings.input.typingBusyWindowSeconds" :disabled="!settings.input.typingBusyEnabled" @change="updateNumber('typingBusyWindowSeconds', $event)" /><span>s</span></div></label>
      <label class="setting-row"><span><strong>{{ $t("按键数量阈值") }}</strong><small>{{ $t("10～5000 次有效按键。") }}</small></span><div class="number-control"><input type="number" min="10" max="5000" step="1" :value="settings.input.typingBusyCountThreshold" :disabled="!settings.input.typingBusyEnabled" @change="updateNumber('typingBusyCountThreshold', $event)" /><span>×</span></div></label>
      <label class="setting-row"><span><strong>{{ $t("忙碌反馈文本") }}</strong><small>{{ $t("留空会自动恢复默认文本。") }}</small></span><input class="text-control" type="text" :value="settings.input.typingBusyText" :disabled="!settings.input.typingBusyEnabled" @change="updateText('typingBusyText', $event)" /></label>
    </article>
    <article>
      <div class="section-heading"><h3>{{ $t("高速反馈") }}</h3><p>{{ $t("统计最近 1 秒内的有效按键。") }}</p></div>
      <label class="setting-row"><span><strong>{{ $t("启用") }}</strong></span><input class="toggle" type="checkbox" :checked="settings.input.typingSpeedEnabled" @change="updateEnabled('typingSpeedEnabled', $event)" /></label>
      <label class="setting-row"><span><strong>{{ $t("每秒按键阈值") }}</strong><small>{{ $t("每秒 1～30 次。") }}</small></span><div class="number-control"><input type="number" min="1" max="30" step="1" :value="settings.input.typingSpeedThresholdPerSecond" :disabled="!settings.input.typingSpeedEnabled" @change="updateNumber('typingSpeedThresholdPerSecond', $event)" /><span>/s</span></div></label>
      <label class="setting-row"><span><strong>{{ $t("高速反馈文本") }}</strong><small>{{ $t("留空会自动恢复默认文本。") }}</small></span><input class="text-control" type="text" :value="settings.input.typingSpeedText" :disabled="!settings.input.typingSpeedEnabled" @change="updateText('typingSpeedText', $event)" /></label>
    </article>
    <article>
      <div class="section-heading"><h3>{{ $t("通用") }}</h3><p>{{ $t("忙碌与高速反馈共享冷却时间，只在对话实际显示后计时。") }}</p></div>
      <label class="setting-row"><span><strong>{{ $t("反馈冷却时间") }}</strong><small>{{ $t("1～600 秒。") }}</small></span><div class="number-control"><input type="number" min="1" max="600" step="1" :value="settings.input.typingFeedbackCooldownSeconds" @change="updateNumber('typingFeedbackCooldownSeconds', $event)" /><span>s</span></div></label>
    </article>
  </div>
</template>

<style scoped>
.settings-notice {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--control-center-accent) 35%, transparent);
  border-radius: 10px;
  color: var(--control-center-text);
  background: color-mix(in srgb, var(--control-center-accent) 10%, transparent);
}
</style>
