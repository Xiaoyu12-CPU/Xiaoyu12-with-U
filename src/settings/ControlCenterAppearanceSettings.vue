<script setup lang="ts">
import { computed, ref } from "vue";
import { controlCenterBackgroundManager } from "./controlCenterBackground";
import { createDefaultControlCenterAppearance } from "./defaultSettings";
import { settingsManager } from "./settingsManager";
import type { ControlCenterBackgroundImageFit, DesktopPetSettings } from "./settingsTypes";
import { isBuiltinControlCenterBackground } from "./controlCenterBackgroundReference";

const settings = settingsManager.settings;
const fileInput = ref<HTMLInputElement>();
const operationError = ref("");
const appearance = computed(() => settings.value.controlCenter);

type ColorKey = "backgroundColor" | "sidebarBackgroundColor" | "sidebarTextColor" | "sidebarActiveBackgroundColor" | "sidebarActiveTextColor" | "primaryTextColor" | "secondaryTextColor" | "cardBackgroundColor" | "cardBorderColor" | "accentColor";
type OpacityKey = "backgroundOpacity" | "backgroundImageOpacity" | "sidebarBackgroundOpacity" | "sidebarActiveBackgroundOpacity" | "cardBackgroundOpacity" | "cardBorderOpacity";

function update<Key extends keyof DesktopPetSettings["controlCenter"]>(key: Key, value: DesktopPetSettings["controlCenter"][Key]): void {
  settingsManager.updateSetting("controlCenter", key, value);
}
function updateColor(key: ColorKey, event: Event): void { update(key, (event.target as HTMLInputElement).value); }
function updateOpacity(key: OpacityKey, event: Event): void { update(key, Number((event.target as HTMLInputElement).value) / 100); }
function updateBorderWidth(event: Event): void { update("cardBorderWidth", Number((event.target as HTMLInputElement).value)); }
function updateImageFit(event: Event): void { update("backgroundImageFit", (event.target as HTMLSelectElement).value as ControlCenterBackgroundImageFit); }
function openFilePicker(): void { fileInput.value?.click(); }

async function importBackground(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  operationError.value = "";
  const previous = appearance.value.backgroundImage;
  try {
    const uploaded = await controlCenterBackgroundManager.upload(file);
    await controlCenterBackgroundManager.sync(uploaded.storedName);
    update("backgroundImage", uploaded.storedName);
    if (previous !== uploaded.storedName) {
      await controlCenterBackgroundManager.deleteManaged(previous);
    }
  } catch (error) {
    operationError.value = error instanceof Error ? error.message : String(error);
  }
}

async function removeBackground(): Promise<void> {
  operationError.value = "";
  const previous = appearance.value.backgroundImage;
  update("backgroundImage", null);
  try {
    await controlCenterBackgroundManager.remove(previous);
  } catch (error) {
    operationError.value = error instanceof Error ? error.message : String(error);
  }
}

async function resetAppearance(): Promise<void> {
  if (!window.confirm("恢复控制中心默认视觉？当前托管背景图片会被清除。")) {
    return;
  }
  operationError.value = "";
  const previous = appearance.value.backgroundImage;
  settingsManager.update({ controlCenter: createDefaultControlCenterAppearance() });
  try {
    await controlCenterBackgroundManager.remove(previous);
  } catch (error) {
    operationError.value = error instanceof Error ? error.message : String(error);
  }
}

function percent(value: number): number { return Math.round(value * 100); }
function backgroundLabel(reference: string | null): string {
  if (isBuiltinControlCenterBackground(reference)) return "内置默认背景";
  return reference ?? "未选择背景图片";
}
</script>

<template>
  <div class="settings-sections" data-settings-category="appearance">
    <p v-if="operationError || controlCenterBackgroundManager.lastError.value" class="error">{{ operationError || controlCenterBackgroundManager.lastError.value }}</p>
    <article>
      <div class="section-heading"><h3>Background</h3><p>背景色与图片是独立Layer，不改变WebView文字和组件透明度。</p></div>
      <label class="setting-row"><span><strong>Background Color</strong></span><div class="color-control"><input type="color" :value="appearance.backgroundColor" @input="updateColor('backgroundColor', $event)" /><code>{{ appearance.backgroundColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>Background Opacity</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="percent(appearance.backgroundOpacity)" @input="updateOpacity('backgroundOpacity', $event)" /><output>{{ percent(appearance.backgroundOpacity) }}%</output></div></label>
      <div class="setting-row"><span><strong>Background Image</strong><small>{{ backgroundLabel(appearance.backgroundImage) }}</small></span><div class="inline-actions"><input ref="fileInput" class="file-input" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" @change="importBackground" /><button type="button" @click="openFilePicker">选择图片</button><button type="button" :disabled="!appearance.backgroundImage" @click="removeBackground">移除图片</button></div></div>
      <label class="setting-row"><span><strong>Image Fill</strong></span><select class="select-control" :value="appearance.backgroundImageFit" :disabled="!appearance.backgroundImage" @change="updateImageFit"><option value="cover">填满（Cover）</option><option value="contain">完整显示（Contain）</option><option value="stretch">拉伸（Stretch）</option><option value="center">居中原尺寸（Center）</option><option value="tile">平铺（Tile）</option></select></label>
      <label class="setting-row scale-row"><span><strong>Image Opacity</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="percent(appearance.backgroundImageOpacity)" :disabled="!appearance.backgroundImage" @input="updateOpacity('backgroundImageOpacity', $event)" /><output>{{ percent(appearance.backgroundImageOpacity) }}%</output></div></label>
    </article>

    <article>
      <div class="section-heading"><h3>Sidebar</h3><p>主导航背景、文字和Active Item使用统一Semantic Token。</p></div>
      <label class="setting-row"><span><strong>Background Color</strong></span><div class="color-control"><input type="color" :value="appearance.sidebarBackgroundColor" @input="updateColor('sidebarBackgroundColor', $event)" /><code>{{ appearance.sidebarBackgroundColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>Background Opacity</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="percent(appearance.sidebarBackgroundOpacity)" @input="updateOpacity('sidebarBackgroundOpacity', $event)" /><output>{{ percent(appearance.sidebarBackgroundOpacity) }}%</output></div></label>
      <label class="setting-row"><span><strong>Text Color</strong></span><div class="color-control"><input type="color" :value="appearance.sidebarTextColor" @input="updateColor('sidebarTextColor', $event)" /><code>{{ appearance.sidebarTextColor }}</code></div></label>
      <label class="setting-row"><span><strong>Active Background Color</strong></span><div class="color-control"><input type="color" :value="appearance.sidebarActiveBackgroundColor" @input="updateColor('sidebarActiveBackgroundColor', $event)" /><code>{{ appearance.sidebarActiveBackgroundColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>Active Background Opacity</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="percent(appearance.sidebarActiveBackgroundOpacity)" @input="updateOpacity('sidebarActiveBackgroundOpacity', $event)" /><output>{{ percent(appearance.sidebarActiveBackgroundOpacity) }}%</output></div></label>
      <label class="setting-row"><span><strong>Active Text Color</strong></span><div class="color-control"><input type="color" :value="appearance.sidebarActiveTextColor" @input="updateColor('sidebarActiveTextColor', $event)" /><code>{{ appearance.sidebarActiveTextColor }}</code></div></label>
    </article>

    <article>
      <div class="section-heading"><h3>Content</h3><p>所有Control Center页面共享主要文字、次要文字与Accent。</p></div>
      <label class="setting-row"><span><strong>Primary Text Color</strong></span><div class="color-control"><input type="color" :value="appearance.primaryTextColor" @input="updateColor('primaryTextColor', $event)" /><code>{{ appearance.primaryTextColor }}</code></div></label>
      <label class="setting-row"><span><strong>Secondary Text Color</strong></span><div class="color-control"><input type="color" :value="appearance.secondaryTextColor" @input="updateColor('secondaryTextColor', $event)" /><code>{{ appearance.secondaryTextColor }}</code></div></label>
      <label class="setting-row"><span><strong>Accent Color</strong></span><div class="color-control"><input type="color" :value="appearance.accentColor" @input="updateColor('accentColor', $event)" /><code>{{ appearance.accentColor }}</code></div></label>
    </article>

    <article>
      <div class="section-heading"><h3>Cards</h3><p>Settings Card、Status Card与主要Panel统一使用。</p></div>
      <label class="setting-row"><span><strong>Background Color</strong></span><div class="color-control"><input type="color" :value="appearance.cardBackgroundColor" @input="updateColor('cardBackgroundColor', $event)" /><code>{{ appearance.cardBackgroundColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>Background Opacity</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="percent(appearance.cardBackgroundOpacity)" @input="updateOpacity('cardBackgroundOpacity', $event)" /><output>{{ percent(appearance.cardBackgroundOpacity) }}%</output></div></label>
      <label class="setting-row"><span><strong>Border Color</strong></span><div class="color-control"><input type="color" :value="appearance.cardBorderColor" @input="updateColor('cardBorderColor', $event)" /><code>{{ appearance.cardBorderColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>Border Opacity</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="percent(appearance.cardBorderOpacity)" @input="updateOpacity('cardBorderOpacity', $event)" /><output>{{ percent(appearance.cardBorderOpacity) }}%</output></div></label>
      <label class="setting-row scale-row"><span><strong>Border Width</strong></span><div class="scale-control"><input type="range" min="0" max="6" step="0.5" :value="appearance.cardBorderWidth" @input="updateBorderWidth" /><output>{{ appearance.cardBorderWidth }} px</output></div></label>
    </article>
    <article><div class="setting-row"><span><strong>重置控制中心外观</strong><small>只重置Theme并清理当前托管背景副本，不影响其他Settings。</small></span><button type="button" @click="resetAppearance">恢复默认视觉</button></div></article>
  </div>
</template>
