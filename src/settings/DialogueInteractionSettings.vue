<script setup lang="ts">
import { settingsManager } from "./settingsManager";

const settings = settingsManager.settings;

function updateDuration(event: Event): void {
  settingsManager.updateSetting(
    "dialogue",
    "bubbleDurationMs",
    Number((event.target as HTMLInputElement).value),
  );
}

function updateBoolean(
  key: "enableClickDialogue" | "enableDragDialogue",
  event: Event,
): void {
  settingsManager.updateSetting(
    "dialogue",
    key,
    (event.target as HTMLInputElement).checked,
  );
}
</script>

<template>
  <div class="settings-sections" data-settings-category="dialogue">
    <article>
      <div class="section-heading">
        <h3>{{ $t("语音气泡") }}</h3>
        <p>{{ $t("管理普通对话何时出现与显示多久；具体文本仍在对话编辑中维护。") }}</p>
      </div>
      <label class="setting-row">
        <span><strong>{{ $t("气泡显示时间") }}</strong><small>250 ～ 60000 ms</small></span>
        <div class="number-control">
          <input type="number" min="250" max="60000" step="250" :value="settings.dialogue.bubbleDurationMs" @change="updateDuration" />
          <span>ms</span>
        </div>
      </label>
    </article>

    <article>
      <div class="section-heading">
        <h3>{{ $t("交互对话") }}</h3>
        <p>{{ $t("关闭选项只影响气泡文本，不改变交互行为。") }}</p>
      </div>
      <label class="setting-row">
        <span><strong>{{ $t("点击对话") }}</strong></span>
        <input class="toggle" type="checkbox" :checked="settings.dialogue.enableClickDialogue" @change="updateBoolean('enableClickDialogue', $event)" />
      </label>
      <label class="setting-row">
        <span><strong>{{ $t("拖动对话") }}</strong></span>
        <input class="toggle" type="checkbox" :checked="settings.dialogue.enableDragDialogue" @change="updateBoolean('enableDragDialogue', $event)" />
      </label>
    </article>
  </div>
</template>
