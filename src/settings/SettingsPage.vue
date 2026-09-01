<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { translate } from "../i18n";
import ControlCenterAppearanceSettings from "./ControlCenterAppearanceSettings.vue";
import { controlCenterBackgroundManager } from "./controlCenterBackground";
import DialogueInteractionSettings from "./DialogueInteractionSettings.vue";
import GeneralSettings from "./GeneralSettings.vue";
import InputSettings from "./InputSettings.vue";
import { settingsManager } from "./settingsManager";
import { SETTINGS_TABS } from "./settingsNavigation";
import type { InputSettingsTabId, SettingsTabId } from "./settingsNavigation";
import SystemSettings from "./SystemSettings.vue";

const props = withDefaults(defineProps<{
  initialTab?: SettingsTabId;
  initialInputTab?: InputSettingsTabId;
  navigationRequest?: number;
}>(), { initialTab: "general", initialInputTab: "keyboard", navigationRequest: 0 });
const emit = defineEmits<{ navigate: [] }>();
const activeTab = ref<SettingsTabId>(props.initialTab);

watch(() => props.navigationRequest, () => { activeTab.value = props.initialTab; emit("navigate"); });
onMounted(() => { void settingsManager.initialize(); });

function selectTab(tab: SettingsTabId): void { activeTab.value = tab; emit("navigate"); }

async function resetAllSettings(): Promise<void> {
  if (!window.confirm(translate("恢复应用设置默认值？不会删除提醒、对话、动画资源或已保存的窗口位置。"))) {
    return;
  }
  const previousBackground = settingsManager.settings.value.controlCenter.backgroundImage;
  settingsManager.resetDefaults();
  try {
    await controlCenterBackgroundManager.remove(previousBackground);
  } catch (error) {
    console.error("Failed to clean the managed Control Center background.", error);
  }
}
</script>

<template>
  <section class="settings-page">
    <header class="settings-page__header">
      <div><p class="eyebrow">{{ $t("应用设置") }}</p><h2>{{ $t("设置") }}</h2></div>
      <div class="save-state"><span v-if="settingsManager.isSaving.value">{{ $t("自动保存中…") }}</span><span v-else-if="settingsManager.lastSavedAt.value">{{ $t("已自动保存") }}</span><span v-else>{{ $t("加载完成后自动保存") }}</span></div>
    </header>
    <p v-if="settingsManager.lastError.value" class="error">{{ settingsManager.lastError.value }}</p>
    <nav class="settings-tabs" :aria-label="$t('设置分类')">
      <button v-for="tab in SETTINGS_TABS" :key="tab.id" type="button" :class="{ active: activeTab === tab.id }" @click="selectTab(tab.id)">{{ $t(tab.label) }}</button>
    </nav>
    <GeneralSettings v-if="activeTab === 'general'" />
    <SystemSettings v-else-if="activeTab === 'system'" />
    <InputSettings v-else-if="activeTab === 'input'" :initial-tab="props.initialInputTab" :navigation-request="props.navigationRequest" @navigate="emit('navigate')" />
    <DialogueInteractionSettings v-else-if="activeTab === 'dialogue'" />
    <ControlCenterAppearanceSettings v-else />
    <footer class="settings-page__footer"><p>{{ $t("恢复操作只重置应用设置；不会删除提醒、对话、动画资源或已保存的窗口位置。") }}</p><button type="button" @click="resetAllSettings">{{ $t("恢复应用设置默认值") }}</button></footer>
  </section>
</template>

<style>
.settings-page { display: grid; gap: 18px; color: var(--cc-text-primary, #30283d); accent-color: var(--cc-accent, #745bc9); }
.settings-page__header, .settings-page .setting-row, .settings-page__footer { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.settings-page .eyebrow { margin: 0 0 4px; color: var(--cc-accent, #745bc9); font-size: 11px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
.settings-page h2, .settings-page h3, .settings-page h4, .settings-page p { margin: 0; }
.settings-page h2 { color: var(--cc-text-primary, #211b31); font-size: 26px; }
.settings-page .save-state { color: var(--cc-text-secondary, #6e6579); font-size: 12px; }
.settings-tabs, .settings-subtabs { position: sticky; z-index: 4; top: -1px; display: flex; flex-wrap: wrap; gap: 7px; padding: 8px; background: var(--cc-card-bg, #faf9fd); border: var(--cc-card-border-width, 1px) solid var(--cc-card-border, #e8e4f0); border-radius: 11px; backdrop-filter: blur(10px); }
.settings-subtabs { z-index: 3; top: 54px; margin-bottom: 14px; }
.settings-tabs button, .settings-subtabs button { padding: 8px 12px; color: var(--cc-text-secondary, #857c91); font: inherit; font-size: 12px; font-weight: 650; background: transparent; border: 0; border-radius: 8px; cursor: pointer; }
.settings-tabs button.active, .settings-subtabs button.active { color: var(--cc-on-accent, #fff); background: var(--cc-accent, #745bc9); }
.settings-sections { display: grid; gap: 14px; }
.settings-page article { display: grid; gap: 4px; padding: 17px; background: var(--cc-card-bg, #faf9fd); border: var(--cc-card-border-width, 1px) solid var(--cc-card-border, #e8e4f0); border-radius: 13px; }
.settings-page .section-heading { padding-bottom: 12px; }
.settings-page .section-heading h3 { color: var(--cc-text-primary, #2d253a); font-size: 16px; }
.settings-page .section-heading p, .settings-page__footer p { margin-top: 3px; color: var(--cc-text-secondary, #857c91); font-size: 11px; }
.settings-page .settings-group-heading { margin: 12px 0 0; color: var(--cc-text-secondary, #756a82); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
.settings-page .setting-row { min-height: 42px; padding: 9px 0; border-top: 1px solid var(--cc-card-border, #ede9f2); }
.settings-page .setting-row > span { display: grid; gap: 3px; }
.settings-page .setting-row strong { color: var(--cc-text-primary, #403649); font-size: 13px; }
.settings-page .setting-row small { color: var(--cc-text-secondary, #8c8397); font-size: 10px; }
.settings-page .scale-control { display: flex; align-items: center; gap: 10px; min-width: 230px; }
.settings-page .scale-control input { flex: 1; accent-color: var(--cc-accent, #745bc9); }
.settings-page .scale-control output { width: 62px; color: var(--cc-accent, #604ca5); font-size: 12px; font-weight: 700; text-align: right; }
.settings-page .number-control { display: flex; align-items: center; gap: 6px; color: var(--cc-text-secondary, #777080); font-size: 11px; }
.settings-page .number-control input, .settings-page .text-control, .settings-page .select-control { padding: 7px 9px; color: var(--cc-text-primary, #30283d); font: inherit; font-size: 12px; background: var(--cc-input-bg, #fff); border: 1px solid var(--cc-card-border, #dcd6e7); border-radius: 7px; }
.settings-page .number-control input { width: 100px; }
.settings-page .text-control { width: min(250px, 48%); }
.settings-page .select-control { min-width: 170px; }
.settings-page .item-options, .settings-page .inline-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.settings-page .item-options label { display: flex; align-items: center; gap: 5px; padding: 7px 9px; color: var(--cc-text-secondary, #5c5267); font-size: 11px; background: var(--cc-input-bg, #fff); border: 1px solid var(--cc-card-border, #ded8e8); border-radius: 8px; cursor: pointer; }
.settings-page .item-options label:has(input:checked) { color: var(--cc-accent, #5d48a6); border-color: var(--cc-accent, #b9aae4); }
.settings-page .color-control { display: flex; align-items: center; gap: 8px; }
.settings-page .color-control input { width: 36px; height: 28px; padding: 2px; background: var(--cc-input-bg, #fff); border: 1px solid var(--cc-card-border, #dcd6e7); border-radius: 7px; cursor: pointer; }
.settings-page .color-control code { color: var(--cc-text-secondary, #706579); font-size: 11px; }
.settings-page .toggle { width: 18px; height: 18px; accent-color: var(--cc-accent, #745bc9); cursor: pointer; }
.settings-page :is(.toggle, input, select):disabled { cursor: default; opacity: .5; }
.settings-page .file-input { display: none; }
.settings-page .error { padding: 10px 12px; color: var(--cc-danger, #9d3f4b); font-size: 12px; background: var(--cc-danger-bg, #fff0f2); border-radius: 9px; }
.settings-page__footer { align-items: flex-end; padding-top: 2px; }
.settings-page__footer p { max-width: 430px; }
.settings-page button { padding: 8px 11px; color: var(--cc-accent, #5d48a6); font: inherit; font-size: 12px; font-weight: 650; background: var(--cc-input-bg, #fff); border: 1px solid var(--cc-card-border, #d9d1ef); border-radius: 8px; cursor: pointer; }
.settings-page button:hover { filter: brightness(.97); }
@media (max-width: 680px) { .settings-page .setting-row, .settings-page__footer { align-items: flex-start; flex-direction: column; } .settings-page .scale-control { width: 100%; min-width: 0; } .settings-subtabs { top: 52px; } }
</style>
