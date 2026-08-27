<script setup lang="ts">
import { computed } from "vue";
import { resetMouseVisualizerOffset } from "../input/mouseVisualizer";
import { settingsManager } from "./settingsManager";
import type { MouseVisualizerPosition } from "./settingsTypes";

const settings = settingsManager.settings;
const bodyOpacity = computed(() => Math.round(settings.value.input.mouseVisualizerBodyOpacity * 100));
const buttonOpacity = computed(() => Math.round(settings.value.input.mouseVisualizerButtonOpacity * 100));
const outlineOpacity = computed(() => Math.round(settings.value.input.mouseVisualizerOutlineOpacity * 100));
const activeOpacity = computed(() => Math.round(settings.value.input.mouseVisualizerActiveOpacity * 100));
type ColorKey = "mouseVisualizerBodyColor" | "mouseVisualizerButtonColor" | "mouseVisualizerOutlineColor" | "mouseVisualizerActiveColor";
type OpacityKey = "mouseVisualizerBodyOpacity" | "mouseVisualizerButtonOpacity" | "mouseVisualizerOutlineOpacity" | "mouseVisualizerActiveOpacity";

function updateBoolean(key: "mouseEnabled" | "mouseVisualizerEnabled", event: Event): void {
  settingsManager.updateSetting("input", key, (event.target as HTMLInputElement).checked);
}
function updatePosition(event: Event): void {
  settingsManager.updateSetting("input", "mouseVisualizerPosition", (event.target as HTMLSelectElement).value as MouseVisualizerPosition);
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
  const offset = resetMouseVisualizerOffset();
  settingsManager.update({ input: { mouseVisualizerOffsetX: offset.x, mouseVisualizerOffsetY: offset.y } });
}
</script>

<template>
  <div class="settings-sections" data-input-settings="mouse">
    <article>
      <div class="section-heading"><h3>Mouse Monitor</h3><p>监听全局按键与滚轮，不监听移动、坐标或轨迹。</p></div>
      <label class="setting-row"><span><strong>Mouse Monitoring</strong><small>与Keyboard开关和Runtime完全独立。</small></span><input class="toggle" type="checkbox" :checked="settings.input.mouseEnabled" @change="updateBoolean('mouseEnabled', $event)" /></label>
      <label class="setting-row"><span><strong>Show Mouse Visualizer</strong><small>只隐藏UI，不停止Mouse Runtime。</small></span><input class="toggle" type="checkbox" :checked="settings.input.mouseVisualizerEnabled" @change="updateBoolean('mouseVisualizerEnabled', $event)" /></label>
      <label class="setting-row"><span><strong>Mouse Visualizer Position</strong><small>选择相对桌宠的Base Anchor。</small></span><select class="select-control" :value="settings.input.mouseVisualizerPosition" @change="updatePosition"><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option></select></label>
    </article>

    <article>
      <div class="section-heading"><h3>Mouse Body & Buttons</h3><p>各层透明度独立，不改变整个组件透明度。</p></div>
      <label class="setting-row"><span><strong>Body Color</strong></span><div class="color-control"><input type="color" :value="settings.input.mouseVisualizerBodyColor" @input="updateColor('mouseVisualizerBodyColor', $event)" /><code>{{ settings.input.mouseVisualizerBodyColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>Body Opacity</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="bodyOpacity" @input="updateOpacity('mouseVisualizerBodyOpacity', $event)" /><output>{{ bodyOpacity }}%</output></div></label>
      <label class="setting-row"><span><strong>Button Color</strong></span><div class="color-control"><input type="color" :value="settings.input.mouseVisualizerButtonColor" @input="updateColor('mouseVisualizerButtonColor', $event)" /><code>{{ settings.input.mouseVisualizerButtonColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>Button Opacity</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="buttonOpacity" @input="updateOpacity('mouseVisualizerButtonOpacity', $event)" /><output>{{ buttonOpacity }}%</output></div></label>
    </article>

    <article>
      <div class="section-heading"><h3>Outline</h3><p>统一控制Body、分隔线、Wheel与侧键线稿。</p></div>
      <label class="setting-row"><span><strong>Outline Color</strong></span><div class="color-control"><input type="color" :value="settings.input.mouseVisualizerOutlineColor" @input="updateColor('mouseVisualizerOutlineColor', $event)" /><code>{{ settings.input.mouseVisualizerOutlineColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>Outline Opacity</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="outlineOpacity" @input="updateOpacity('mouseVisualizerOutlineOpacity', $event)" /><output>{{ outlineOpacity }}%</output></div></label>
      <label class="setting-row scale-row"><span><strong>Outline Width</strong><small>0～4px。</small></span><div class="scale-control"><input type="range" min="0" max="4" step="0.25" :value="settings.input.mouseVisualizerOutlineWidth" @input="updateOutlineWidth" /><output>{{ settings.input.mouseVisualizerOutlineWidth }} px</output></div></label>
    </article>

    <article>
      <div class="section-heading"><h3>Active</h3><p>Pressed Button与Scroll Pulse共享强调样式。</p></div>
      <label class="setting-row"><span><strong>Active Color</strong></span><div class="color-control"><input type="color" :value="settings.input.mouseVisualizerActiveColor" @input="updateColor('mouseVisualizerActiveColor', $event)" /><code>{{ settings.input.mouseVisualizerActiveColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>Active Opacity</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="activeOpacity" @input="updateOpacity('mouseVisualizerActiveOpacity', $event)" /><output>{{ activeOpacity }}%</output></div></label>
      <div class="setting-row"><span><strong>鼠标显示位置</strong><small>只清除Manual Offset。</small></span><button type="button" @click="resetPosition">重置鼠标显示位置</button></div>
    </article>
  </div>
</template>
