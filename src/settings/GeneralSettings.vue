<script setup lang="ts">
import { computed } from "vue";
import { settingsManager } from "./settingsManager";

const settings = settingsManager.settings;
const scalePercent = computed(() => Math.round(settings.value.appearance.petScale * 100));

function updateScale(event: Event): void {
  settingsManager.updateSetting(
    "appearance",
    "petScale",
    Number((event.target as HTMLInputElement).value) / 100,
  );
}

function updateAlwaysOnTop(event: Event): void {
  settingsManager.updateSetting("appearance", "alwaysOnTop", (event.target as HTMLInputElement).checked);
}

function updateAnimationEnabled(event: Event): void {
  settingsManager.updateSetting("animation", "enabled", (event.target as HTMLInputElement).checked);
}

function updateFollowPet(event: Event): void {
  settingsManager.updateSetting("windows", "followPet", (event.target as HTMLInputElement).checked);
}
</script>

<template>
  <div class="settings-sections" data-settings-category="general">
    <article>
      <div class="section-heading">
        <h3>外观与窗口</h3>
        <p>最常用的桌宠尺寸与窗口行为。</p>
      </div>
      <label class="setting-row scale-row">
        <span><strong>桌宠大小</strong><small>50% ～ 200%</small></span>
        <div class="scale-control">
          <input type="range" min="50" max="200" step="10" :value="scalePercent" @input="updateScale" />
          <output>{{ scalePercent }}%</output>
        </div>
      </label>
      <label class="setting-row">
        <span><strong>Always On Top</strong><small>控制桌宠及三个浮层窗口是否始终置顶。</small></span>
        <input class="toggle" type="checkbox" :checked="settings.appearance.alwaysOnTop" @change="updateAlwaysOnTop" />
      </label>
      <label class="setting-row">
        <span><strong>浮层跟随桌宠</strong><small>系统状态、键盘历史和鼠标可视化保持各自相对位置。</small></span>
        <input class="toggle" type="checkbox" :checked="settings.windows.followPet" @change="updateFollowPet" />
      </label>
    </article>

    <article>
      <div class="section-heading">
        <h3>Animation</h3>
        <p>关闭后保持当前有效帧，重新开启后继续播放。</p>
      </div>
      <label class="setting-row">
        <span><strong>Animation Enabled</strong></span>
        <input class="toggle" type="checkbox" :checked="settings.animation.enabled" @change="updateAnimationEnabled" />
      </label>
    </article>
  </div>
</template>
