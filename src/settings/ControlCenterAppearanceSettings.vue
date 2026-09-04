<script setup lang="ts">
import { computed, ref } from "vue";
import { controlCenterBackgroundManager } from "./controlCenterBackground";
import {
  CONTROL_CENTER_APPEARANCE_THEMES,
  createControlCenterAppearanceTheme,
  matchControlCenterAppearanceTheme,
} from "./controlCenterAppearanceThemes";
import type {
  ControlCenterAppearanceTheme,
  ControlCenterAppearanceThemeId,
} from "./controlCenterAppearanceThemes";
import { createDefaultControlCenterAppearance } from "./defaultSettings";
import { settingsManager } from "./settingsManager";
import type { ControlCenterBackgroundImageFit, DesktopPetSettings } from "./settingsTypes";
import {
  CONTROL_CENTER_MIKAN_BACKGROUND_REFERENCE,
  isBuiltinControlCenterBackground,
} from "./controlCenterBackgroundReference";
import { translate } from "../i18n";

const settings = settingsManager.settings;
const fileInput = ref<HTMLInputElement>();
const themeRail = ref<HTMLElement>();
const operationError = ref("");
const appearance = computed(() => settings.value.controlCenter);
const activeThemeId = computed(() => matchControlCenterAppearanceTheme(appearance.value));
const isDraggingThemes = ref(false);
let dragPointerId: number | undefined;
let dragStartX = 0;
let dragStartScrollLeft = 0;
let dragMoved = false;
let suppressThemeClick = false;

type ColorKey = "backgroundColor" | "sidebarBackgroundColor" | "sidebarTextColor" | "sidebarActiveBackgroundColor" | "sidebarActiveTextColor" | "primaryTextColor" | "secondaryTextColor" | "contentTextShadowColor" | "cardBackgroundColor" | "cardBorderColor" | "accentColor";
type OpacityKey = "backgroundOpacity" | "backgroundImageOpacity" | "sidebarBackgroundOpacity" | "sidebarActiveBackgroundOpacity" | "contentTextShadowOpacity" | "cardBackgroundOpacity" | "cardBorderOpacity";
type TextShadowNumberKey = "contentTextShadowSize" | "contentTextShadowBlur";

function update<Key extends keyof DesktopPetSettings["controlCenter"]>(key: Key, value: DesktopPetSettings["controlCenter"][Key]): void {
  settingsManager.updateSetting("controlCenter", key, value);
}
function updateColor(key: ColorKey, event: Event): void { update(key, (event.target as HTMLInputElement).value); }
function updateOpacity(key: OpacityKey, event: Event): void { update(key, Number((event.target as HTMLInputElement).value) / 100); }
function updateImageBlur(event: Event): void { update("backgroundImageBlur", Number((event.target as HTMLInputElement).value)); }
function updateTextShadowNumber(key: TextShadowNumberKey, event: Event): void { update(key, Number((event.target as HTMLInputElement).value)); }
function updateBorderWidth(event: Event): void { update("cardBorderWidth", Number((event.target as HTMLInputElement).value)); }
function updateImageFit(event: Event): void { update("backgroundImageFit", (event.target as HTMLSelectElement).value as ControlCenterBackgroundImageFit); }
function openFilePicker(): void { fileInput.value?.click(); }

function applyAppearanceTheme(id: ControlCenterAppearanceThemeId): void {
  if (suppressThemeClick || activeThemeId.value === id) return;
  operationError.value = "";
  settingsManager.update({ controlCenter: createControlCenterAppearanceTheme(id) });
}

function themePreviewStyle(theme: ControlCenterAppearanceTheme): Record<string, string> {
  return theme.previewUrl
    ? {
        backgroundColor: theme.appearance.backgroundColor,
        backgroundImage: `linear-gradient(145deg, transparent 35%, ${theme.appearance.sidebarBackgroundColor}99), url("${theme.previewUrl}")`,
      }
    : {
        backgroundColor: theme.appearance.backgroundColor,
        backgroundImage: `linear-gradient(145deg, ${theme.appearance.cardBackgroundColor}, ${theme.appearance.sidebarBackgroundColor}22)`,
      };
}

function beginThemeDrag(event: PointerEvent): void {
  if (event.button !== 0 || !themeRail.value) return;
  dragPointerId = event.pointerId;
  dragStartX = event.clientX;
  dragStartScrollLeft = themeRail.value.scrollLeft;
  dragMoved = false;
  isDraggingThemes.value = true;
  themeRail.value.setPointerCapture(event.pointerId);
}

function moveThemeDrag(event: PointerEvent): void {
  if (dragPointerId !== event.pointerId || !themeRail.value) return;
  const deltaX = event.clientX - dragStartX;
  if (Math.abs(deltaX) > 4) dragMoved = true;
  if (dragMoved) event.preventDefault();
  themeRail.value.scrollLeft = dragStartScrollLeft - deltaX;
}

function endThemeDrag(event: PointerEvent): void {
  if (dragPointerId !== event.pointerId || !themeRail.value) return;
  if (themeRail.value.hasPointerCapture(event.pointerId)) {
    themeRail.value.releasePointerCapture(event.pointerId);
  }
  dragPointerId = undefined;
  isDraggingThemes.value = false;
  if (dragMoved) {
    suppressThemeClick = true;
    window.setTimeout(() => { suppressThemeClick = false; }, 0);
  }
}

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
  if (reference === CONTROL_CENTER_MIKAN_BACKGROUND_REFERENCE) return translate("蜜柑主题背景");
  if (isBuiltinControlCenterBackground(reference)) return translate("内置默认背景");
  return reference ?? translate("未选择背景图片");
}
</script>

<template>
  <div class="settings-sections" data-settings-category="appearance">
    <p v-if="operationError || controlCenterBackgroundManager.lastError.value" class="error">{{ operationError || controlCenterBackgroundManager.lastError.value }}</p>
    <article class="appearance-themes">
      <div class="section-heading"><h3>{{ $t("外观主题") }}</h3><p>{{ $t("横向拖动浏览；选择主题会替换下方的控制中心外观设置。") }}</p></div>
      <div
        ref="themeRail"
        class="theme-carousel"
        :class="{ 'theme-carousel--dragging': isDraggingThemes }"
        @pointerdown="beginThemeDrag"
        @pointermove="moveThemeDrag"
        @pointerup="endThemeDrag"
        @pointercancel="endThemeDrag"
        @lostpointercapture="endThemeDrag"
      >
        <div class="theme-track">
          <button
            v-for="theme in CONTROL_CENTER_APPEARANCE_THEMES"
            :key="theme.id"
            type="button"
            class="theme-card"
            :class="{ 'theme-card--active': activeThemeId === theme.id, 'theme-card--blank': theme.id === 'blank' }"
            :aria-pressed="activeThemeId === theme.id"
            @click="applyAppearanceTheme(theme.id)"
          >
            <span class="theme-card__preview" :style="themePreviewStyle(theme)">
              <span v-if="theme.id === 'blank'" class="theme-card__plus" aria-hidden="true">＋</span>
              <span v-if="activeThemeId === theme.id" class="theme-card__badge">{{ $t("当前") }}</span>
            </span>
            <span class="theme-card__copy"><strong>{{ $t(theme.title) }}</strong><small>{{ $t(theme.subtitle) }}</small></span>
          </button>
        </div>
      </div>
    </article>
    <article>
      <div class="section-heading"><h3>{{ $t("背景") }}</h3><p>{{ $t("背景色与图片是独立图层，不改变文字和组件透明度。") }}</p></div>
      <label class="setting-row"><span><strong>{{ $t("背景颜色") }}</strong></span><div class="color-control"><input type="color" :value="appearance.backgroundColor" @input="updateColor('backgroundColor', $event)" /><code>{{ appearance.backgroundColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("背景透明度") }}</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="percent(appearance.backgroundOpacity)" @input="updateOpacity('backgroundOpacity', $event)" /><output>{{ percent(appearance.backgroundOpacity) }}%</output></div></label>
      <div class="setting-row"><span><strong>{{ $t("背景图片") }}</strong><small>{{ backgroundLabel(appearance.backgroundImage) }}</small></span><div class="inline-actions"><input ref="fileInput" class="file-input" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" @change="importBackground" /><button type="button" @click="openFilePicker">{{ $t("选择图片") }}</button><button type="button" :disabled="!appearance.backgroundImage" @click="removeBackground">{{ $t("移除图片") }}</button></div></div>
      <label class="setting-row"><span><strong>{{ $t("图片填充") }}</strong></span><select class="select-control" :value="appearance.backgroundImageFit" :disabled="!appearance.backgroundImage" @change="updateImageFit"><option value="cover">{{ $t("填满") }}</option><option value="contain">{{ $t("完整显示") }}</option><option value="stretch">{{ $t("拉伸") }}</option><option value="center">{{ $t("居中原尺寸") }}</option><option value="tile">{{ $t("平铺") }}</option></select></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("图片透明度") }}</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="percent(appearance.backgroundImageOpacity)" :disabled="!appearance.backgroundImage" @input="updateOpacity('backgroundImageOpacity', $event)" /><output>{{ percent(appearance.backgroundImageOpacity) }}%</output></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("图片模糊度") }}</strong></span><div class="scale-control"><input type="range" min="0" max="30" step="1" :value="appearance.backgroundImageBlur" :disabled="!appearance.backgroundImage" @input="updateImageBlur" /><output>{{ appearance.backgroundImageBlur }} px</output></div></label>
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
      <h4 class="settings-group-heading">{{ $t("文字阴影") }}</h4>
      <label class="setting-row"><span><strong>{{ $t("阴影颜色") }}</strong><small>{{ $t("阴影环绕内容文字，提高复杂背景上的可读性。") }}</small></span><div class="color-control"><input type="color" :value="appearance.contentTextShadowColor" @input="updateColor('contentTextShadowColor', $event)" /><code>{{ appearance.contentTextShadowColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("阴影透明度") }}</strong></span><div class="scale-control"><input type="range" min="0" max="100" step="5" :value="percent(appearance.contentTextShadowOpacity)" @input="updateOpacity('contentTextShadowOpacity', $event)" /><output>{{ percent(appearance.contentTextShadowOpacity) }}%</output></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("阴影大小") }}</strong><small>{{ $t("大小和模糊范围均为 0 时关闭。") }}</small></span><div class="scale-control"><input type="range" min="0" max="8" step="0.5" :value="appearance.contentTextShadowSize" @input="updateTextShadowNumber('contentTextShadowSize', $event)" /><output>{{ appearance.contentTextShadowSize }} px</output></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("模糊范围") }}</strong></span><div class="scale-control"><input type="range" min="0" max="30" step="1" :value="appearance.contentTextShadowBlur" @input="updateTextShadowNumber('contentTextShadowBlur', $event)" /><output>{{ appearance.contentTextShadowBlur }} px</output></div></label>
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

<style scoped>
.appearance-themes { overflow: hidden; }
.theme-carousel {
  width: 100%;
  padding: 2px 1px 10px;
  overflow-x: scroll;
  overflow-y: hidden;
  cursor: grab;
  scrollbar-color: var(--cc-accent, #745bc9) color-mix(in srgb, var(--cc-accent, #745bc9) 16%, transparent);
  scrollbar-width: thin;
  scroll-snap-type: x proximity;
  touch-action: pan-y;
  user-select: none;
}
.theme-carousel--dragging { cursor: grabbing; scroll-snap-type: none; }
.theme-carousel::-webkit-scrollbar { height: 7px; }
.theme-carousel::-webkit-scrollbar-track { background: color-mix(in srgb, var(--cc-accent, #745bc9) 14%, transparent); border-radius: 999px; }
.theme-carousel::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--cc-accent, #745bc9) 72%, transparent); border-radius: 999px; }
.theme-track {
  display: grid;
  grid-auto-columns: minmax(220px, 38%);
  grid-auto-flow: column;
  gap: 12px;
  min-width: 100%;
}
.theme-card {
  display: grid;
  gap: 9px;
  min-width: 0;
  padding: 8px !important;
  overflow: hidden;
  text-align: left;
  scroll-snap-align: start;
  border: 1px solid var(--cc-card-border, #d9d1ef) !important;
  border-radius: 12px !important;
}
.theme-card--active {
  border-color: var(--cc-accent, #745bc9) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--cc-accent, #745bc9) 28%, transparent);
}
.theme-card__preview {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 16 / 8;
  overflow: hidden;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  border-radius: 8px;
}
.theme-card__plus {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  color: var(--cc-accent, #745bc9);
  font-size: 24px;
  background: color-mix(in srgb, var(--cc-card-bg, #fff) 82%, transparent);
  border: 1px solid color-mix(in srgb, var(--cc-accent, #745bc9) 36%, transparent);
  border-radius: 50%;
}
.theme-card__badge {
  position: absolute;
  top: 7px;
  right: 7px;
  padding: 3px 7px;
  color: var(--cc-on-accent, #fff);
  font-size: 9px;
  font-weight: 750;
  background: var(--cc-accent, #745bc9);
  border-radius: 999px;
}
.theme-card__copy { display: grid; gap: 2px; padding: 0 2px 2px; }
.theme-card__copy strong { font-size: 12px; }
.theme-card__copy small { font-size: 10px; }
</style>
