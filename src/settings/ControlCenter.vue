<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import appIconUrl from "../../src-tauri/icons/app-icon.png";
import {
  currentLanguage,
  LANGUAGE_OPTIONS,
  setLanguage,
  translate,
} from "../i18n";
import type { AppLanguage } from "./settingsTypes";
import type { PetControlAction } from "../pet/petControl";
import {
  CONTROL_CENTER_DESTINATIONS,
  useControlCenterNavigation,
  useRemotePetRuntime,
} from "../pet/runtimeBridge";
import type { ControlCenterDestination } from "../pet/runtimeBridge";
import DialogueEditor from "./DialogueEditor.vue";
import ReminderPage from "./ReminderPage.vue";
import StateAnimationEditor from "./StateAnimationEditor.vue";
import StatusPage from "./StatusPage.vue";
import SettingsPage from "./SettingsPage.vue";
import { controlCenterBackgroundManager } from "./controlCenterBackground";
import { settingsManager } from "./settingsManager";
import type { InputSettingsTabId, SettingsTabId } from "./settingsNavigation";
import {
  createControlCenterBackgroundStyle,
  createControlCenterThemeVariables,
} from "./controlCenterTheme";

type ControlCenterPage = "status" | "states" | "dialogue" | "reminders" | "settings";

const activePage = ref<ControlCenterPage>("status");
const contentElement = ref<HTMLElement>();
const settingsInitialTab = ref<SettingsTabId>("general");
const settingsInitialInputTab = ref<InputSettingsTabId>("keyboard");
const settingsNavigationRequest = ref(0);
const dirtyPages = reactive<Record<"states" | "dialogue" | "reminders", boolean>>({
  states: false,
  dialogue: false,
  reminders: false,
});
const { snapshot, isConnected, executeAction } = useRemotePetRuntime();
useControlCenterNavigation(handleExternalNavigation);

const themeStyle = computed(() => {
  return createControlCenterThemeVariables(settingsManager.settings.value.controlCenter);
});

const backgroundImageStyle = computed(() => {
  return createControlCenterBackgroundStyle(
    settingsManager.settings.value.controlCenter,
    controlCenterBackgroundManager.imageUrl.value,
  );
});

watch(
  () => settingsManager.settings.value.controlCenter.backgroundImage,
  (storedName) => { void controlCenterBackgroundManager.sync(storedName); },
  { immediate: true },
);

onMounted(() => {
  void settingsManager.initialize();
  window.addEventListener("beforeunload", handleBeforeUnload);
});
onBeforeUnmount(() => window.removeEventListener("beforeunload", handleBeforeUnload));

function handleAction(action: PetControlAction): void {
  executeAction(action);
}

function handleExternalNavigation(destination: ControlCenterDestination): void {
  if (destination === CONTROL_CENTER_DESTINATIONS.SYSTEM_MONITOR_SETTINGS) {
    openSettings("system");
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent): void {
  if (!Object.values(dirtyPages).some(Boolean)) return;
  event.preventDefault();
  event.returnValue = "";
}

function canLeaveActivePage(): boolean {
  const page = activePage.value;
  if (!(page in dirtyPages) || !dirtyPages[page as keyof typeof dirtyPages]) {
    return true;
  }
  if (!window.confirm(translate("当前页面有未保存修改，确定离开并放弃修改吗？"))) {
    return false;
  }
  dirtyPages[page as keyof typeof dirtyPages] = false;
  return true;
}

function navigatePage(page: ControlCenterPage): boolean {
  if (page === activePage.value) return true;
  if (!canLeaveActivePage()) return false;
  activePage.value = page;
  scrollContentToTop();
  return true;
}

function openSettings(tab: SettingsTabId, inputTab: InputSettingsTabId = "keyboard"): void {
  if (!navigatePage("settings")) return;
  settingsInitialTab.value = tab;
  settingsInitialInputTab.value = inputTab;
  settingsNavigationRequest.value += 1;
  scrollContentToTop();
}

function setPageDirty(page: keyof typeof dirtyPages, dirty: boolean): void {
  dirtyPages[page] = dirty;
}

function scrollContentToTop(): void {
  requestAnimationFrame(() => contentElement.value?.scrollTo({ top: 0 }));
}

function updateLanguage(event: Event): void {
  setLanguage((event.target as HTMLSelectElement).value as AppLanguage);
}

</script>

<template>
  <main class="control-center" :style="themeStyle">
    <div class="control-center__base" />
    <div class="control-center__background-image" :style="backgroundImageStyle" />
    <aside>
      <div class="brand">
        <img class="brand__mark" :src="appIconUrl" alt="withXiaoyu12" />
        <div>
          <strong>withXiaoyu12</strong>
          <small>v0.4.5.2</small>
        </div>
      </div>

      <nav :aria-label="$t('控制中心页面')">
        <button
          type="button"
          :class="{ active: activePage === 'status' }"
          @click="navigatePage('status')"
        >
          {{ $t("当前状态") }}
        </button>
        <button
          type="button"
          :class="{ active: activePage === 'states' }"
          @click="navigatePage('states')"
        >
          {{ $t("状态与动画") }}
        </button>
        <button
          type="button"
          :class="{ active: activePage === 'dialogue' }"
          @click="navigatePage('dialogue')"
        >
          {{ $t("对话编辑") }}
        </button>
        <button
          type="button"
          :class="{ active: activePage === 'reminders' }"
          @click="navigatePage('reminders')"
        >
          {{ $t("提醒") }}
        </button>
        <button
          type="button"
          :class="{ active: activePage === 'settings' }"
          @click="openSettings('general')"
        >
          {{ $t("设置") }}
        </button>
      </nav>

      <label class="language-picker">
        <span>{{ $t("语言") }}</span>
        <select :value="currentLanguage" @change="updateLanguage">
          <option
            v-for="option in LANGUAGE_OPTIONS"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>
    </aside>

    <div ref="contentElement" class="control-center__content">
      <StatusPage
        v-if="activePage === 'status'"
        :snapshot="snapshot"
        :connected="isConnected"
        @open-settings="openSettings"
      />
      <StateAnimationEditor
        v-else-if="activePage === 'states'"
        :runtime-state="snapshot?.state"
        @dirty-change="setPageDirty('states', $event)"
      />
      <DialogueEditor v-else-if="activePage === 'dialogue'" @action="handleAction" @dirty-change="setPageDirty('dialogue', $event)" />
      <ReminderPage
        v-else-if="activePage === 'reminders'"
        :runtime="snapshot"
        @dirty-change="setPageDirty('reminders', $event)"
      />
      <SettingsPage
        v-else
        :initial-tab="settingsInitialTab"
        :initial-input-tab="settingsInitialInputTab"
        :navigation-request="settingsNavigationRequest"
        @navigate="scrollContentToTop"
      />
    </div>
  </main>
</template>

<style scoped>
.control-center {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  width: 100%;
  height: 100%;
  color: var(--cc-text-primary);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: transparent;
  overflow: hidden;
  accent-color: var(--cc-accent);
}

.control-center__base,
.control-center__background-image {
  position: absolute;
  z-index: -2;
  inset: 0;
  pointer-events: none;
}

.control-center__base { background: var(--cc-background); }
.control-center__background-image { z-index: -1; }

aside,
.control-center__content {
  position: relative;
  z-index: 1;
}

aside {
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding: 26px 18px 18px;
  color: var(--cc-sidebar-active-text);
  background: var(--cc-sidebar-background);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand__mark {
  width: 38px;
  height: 38px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 11px;
}

.brand > div {
  display: grid;
  gap: 2px;
}

.brand strong {
  font-size: 14px;
}

.brand small {
  color: var(--cc-sidebar-text);
  font-size: 11px;
}

nav {
  display: grid;
  gap: 6px;
}

nav button {
  padding: 10px 12px;
  color: var(--cc-sidebar-text);
  font: inherit;
  font-size: 13px;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}

nav button:hover,
nav button.active {
  color: var(--cc-sidebar-active-text);
  background: var(--cc-sidebar-active-background);
}

.language-picker {
  display: grid;
  gap: 6px;
  margin-top: auto;
}

.language-picker span {
  color: var(--cc-sidebar-text);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.language-picker select {
  width: 100%;
  padding: 8px 10px;
  color: var(--cc-sidebar-active-text);
  font: inherit;
  font-size: 12px;
  background: color-mix(in srgb, var(--cc-sidebar-active-background) 65%, transparent);
  border: 1px solid color-mix(in srgb, var(--cc-sidebar-active-text) 22%, transparent);
  border-radius: 8px;
  cursor: pointer;
}

.control-center__content {
  min-width: 0;
  padding: 30px;
  overflow: auto;
  background: transparent;
}

.control-center__content :deep(input),
.control-center__content :deep(select) {
  accent-color: var(--cc-accent);
}

.control-center__content :deep(.primary) {
  background: var(--cc-accent);
  border-color: var(--cc-accent);
}

.control-center__content :deep(.eyebrow) {
  color: var(--cc-accent);
}

.control-center__content :deep(h1),
.control-center__content :deep(h2),
.control-center__content :deep(h3),
.control-center__content :deep(strong) {
  color: var(--cc-text-primary);
}

.control-center__content :deep(.subtitle),
.control-center__content :deep(small) {
  color: var(--cc-text-secondary);
}

.control-center__content :deep(article),
.control-center__content :deep(.empty-state),
.control-center__content :deep(.pending-snoozes),
.control-center__content :deep(.editor),
.control-center__content :deep(.reminder-system-settings) {
  background: var(--cc-card-bg);
  border-color: var(--cc-card-border);
  border-width: var(--cc-card-border-width);
}

@media (max-width: 620px) {
  .control-center {
    grid-template-columns: 1fr;
  }

  aside {
    gap: 16px;
    padding: 14px;
  }

  nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .control-center__content {
    padding: 20px;
  }
}
</style>
