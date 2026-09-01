<script setup lang="ts">
import { computed, ref } from "vue";
import { controlCenterBackgroundManager } from "./controlCenterBackground";
import { createDefaultControlCenterAppearance } from "./defaultSettings";
import { settingsManager } from "./settingsManager";
import type { ControlCenterBackgroundImageFit, DesktopPetSettings } from "./settingsTypes";
import { isBuiltinControlCenterBackground } from "./controlCenterBackgroundReference";
import { translate } from "../i18n";

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
  if (!window.confirm(translate("恢复控制中心默认视觉？当前托管背景图片会被清除。"))) {
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
  if (isBuiltinControlCenterBackground(reference)) return translate("内置默认背景");
  return reference ?? translate("未选择背景图片");
}
</script>

<template>
  <div class="settings-sections" data-settings-category="appearance">
    <p v-if="operationError || controlCenterBackgroundManager.lastError.value" class="error">{{ operationError || controlCenterBackgroundManager.lastError.value }}</p>
    <article>
      <div class="section-heading"><h3>{{ $t("背景") }}</h3><p>{{ $t("背景色与图片是独立图层，不改变文字和组件透明度。") }}</p></div>
      <label class="setting-row"><span><strong>{{ $t("背景颜色") }}</strong></span><div class="color-control"><input type="color" :value="appearance.backgroundColor" @input="updateColor('backgroundColor', $event)" /><code>{{ appearance.backgroundColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("背景透明度") }}</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="percent(appearance.backgroundOpacity)" @input="updateOpacity('backgroundOpacity', $event)" /><output>{{ percent(appearance.backgroundOpacity) }}%</output></div></label>
      <div class="setting-row"><span><strong>{{ $t("背景图片") }}</strong><small>{{ backgroundLabel(appearance.backgroundImage) }}</small></span><div class="inline-actions"><input ref="fileInput" class="file-input" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" @change="importBackground" /><button type="button" @click="openFilePicker">{{ $t("选择图片") }}</button><button type="button" :disabled="!appearance.backgroundImage" @click="removeBackground">{{ $t("移除图片") }}</button></div></div>
      <label class="setting-row"><span><strong>{{ $t("图片填充") }}</strong></span><select class="select-control" :value="appearance.backgroundImageFit" :disabled="!appearance.backgroundImage" @change="updateImageFit"><option value="cover">{{ $t("填满") }}</option><option value="contain">{{ $t("完整显示") }}</option><option value="stretch">{{ $t("拉伸") }}</option><option value="center">{{ $t("居中原尺寸") }}</option><option value="tile">{{ $t("平铺") }}</option></select></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("图片透明度") }}</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="percent(appearance.backgroundImageOpacity)" :disabled="!appearance.backgroundImage" @input="updateOpacity('backgroundImageOpacity', $event)" /><output>{{ percent(appearance.backgroundImageOpacity) }}%</output></div></label>
    </article>

    <article>
      <div class="section-heading"><h3>{{ $t("侧边栏") }}</h3><p>{{ $t("主导航背景、文字和选中项使用统一配色。") }}</p></div>
      <label class="setting-row"><span><strong>{{ $t("背景颜色") }}</strong></span><div class="color-control"><input type="color" :value="appearance.sidebarBackgroundColor" @input="updateColor('sidebarBackgroundColor', $event)" /><code>{{ appearance.sidebarBackgroundColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("背景透明度") }}</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="percent(appearance.sidebarBackgroundOpacity)" @input="updateOpacity('sidebarBackgroundOpacity', $event)" /><output>{{ percent(appearance.sidebarBackgroundOpacity) }}%</output></div></label>
      <label class="setting-row"><span><strong>{{ $t("文字颜色") }}</strong></span><div class="color-control"><input type="color" :value="appearance.sidebarTextColor" @input="updateColor('sidebarTextColor', $event)" /><code>{{ appearance.sidebarTextColor }}</code></div></label>
      <label class="setting-row"><span><strong>{{ $t("选中项背景颜色") }}</strong></span><div class="color-control"><input type="color" :value="appearance.sidebarActiveBackgroundColor" @input="updateColor('sidebarActiveBackgroundColor', $event)" /><code>{{ appearance.sidebarActiveBackgroundColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("选中项背景透明度") }}</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="percent(appearance.sidebarActiveBackgroundOpacity)" @input="updateOpacity('sidebarActiveBackgroundOpacity', $event)" /><output>{{ percent(appearance.sidebarActiveBackgroundOpacity) }}%</output></div></label>
      <label class="setting-row"><span><strong>{{ $t("选中项文字颜色") }}</strong></span><div class="color-control"><input type="color" :value="appearance.sidebarActiveTextColor" @input="updateColor('sidebarActiveTextColor', $event)" /><code>{{ appearance.sidebarActiveTextColor }}</code></div></label>
    </article>

    <article>
      <div class="section-heading"><h3>{{ $t("内容") }}</h3><p>{{ $t("所有控制中心页面共享主要文字、次要文字与强调色。") }}</p></div>
      <label class="setting-row"><span><strong>{{ $t("主要文字颜色") }}</strong></span><div class="color-control"><input type="color" :value="appearance.primaryTextColor" @input="updateColor('primaryTextColor', $event)" /><code>{{ appearance.primaryTextColor }}</code></div></label>
      <label class="setting-row"><span><strong>{{ $t("次要文字颜色") }}</strong></span><div class="color-control"><input type="color" :value="appearance.secondaryTextColor" @input="updateColor('secondaryTextColor', $event)" /><code>{{ appearance.secondaryTextColor }}</code></div></label>
      <label class="setting-row"><span><strong>{{ $t("强调色") }}</strong></span><div class="color-control"><input type="color" :value="appearance.accentColor" @input="updateColor('accentColor', $event)" /><code>{{ appearance.accentColor }}</code></div></label>
    </article>

    <article>
      <div class="section-heading"><h3>{{ $t("卡片") }}</h3><p>{{ $t("设置卡片、状态卡片与主要面板统一使用。") }}</p></div>
      <label class="setting-row"><span><strong>{{ $t("背景颜色") }}</strong></span><div class="color-control"><input type="color" :value="appearance.cardBackgroundColor" @input="updateColor('cardBackgroundColor', $event)" /><code>{{ appearance.cardBackgroundColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("背景透明度") }}</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="percent(appearance.cardBackgroundOpacity)" @input="updateOpacity('cardBackgroundOpacity', $event)" /><output>{{ percent(appearance.cardBackgroundOpacity) }}%</output></div></label>
      <label class="setting-row"><span><strong>{{ $t("边框颜色") }}</strong></span><div class="color-control"><input type="color" :value="appearance.cardBorderColor" @input="updateColor('cardBorderColor', $event)" /><code>{{ appearance.cardBorderColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("边框透明度") }}</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="percent(appearance.cardBorderOpacity)" @input="updateOpacity('cardBorderOpacity', $event)" /><output>{{ percent(appearance.cardBorderOpacity) }}%</output></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("边框粗细") }}</strong></span><div class="scale-control"><input type="range" min="0" max="6" step="0.5" :value="appearance.cardBorderWidth" @input="updateBorderWidth" /><output>{{ appearance.cardBorderWidth }} px</output></div></label>
    </article>
    <article><div class="setting-row"><span><strong>{{ $t("重置控制中心外观") }}</strong><small>{{ $t("只重置主题并清理当前托管背景副本，不影响其他设置。") }}</small></span><button type="button" @click="resetAppearance">{{ $t("恢复默认视觉") }}</button></div></article>
  </div>
</template>
