<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
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
import type { SettingsTabId } from "./settingsNavigation";
import {
  createControlCenterBackgroundStyle,
  createControlCenterThemeVariables,
} from "./controlCenterTheme";

type ControlCenterPage = "status" | "states" | "dialogue" | "reminders" | "settings";

const activePage = ref<ControlCenterPage>("status");
const contentElement = ref<HTMLElement>();
const settingsInitialTab = ref<SettingsTabId>("general");
const settingsNavigationRequest = ref(0);
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

onMounted(() => { void settingsManager.initialize(); });

function handleAction(action: PetControlAction): void {
  executeAction(action);
}

function handleExternalNavigation(destination: ControlCenterDestination): void {
  if (destination === CONTROL_CENTER_DESTINATIONS.SYSTEM_MONITOR_SETTINGS) {
    openSystemMonitorSettings();
  }
}

function openSystemMonitorSettings(): void {
  openSettings("system");
}

function openSettings(tab: SettingsTabId): void {
  settingsInitialTab.value = tab;
  settingsNavigationRequest.value += 1;
  activePage.value = "settings";
  scrollContentToTop();
}

function scrollContentToTop(): void {
  requestAnimationFrame(() => contentElement.value?.scrollTo({ top: 0 }));
}

</script>

<template>
  <main class="control-center" :style="themeStyle">
    <div class="control-center__base" />
    <div class="control-center__background-image" :style="backgroundImageStyle" />
    <aside>
      <div class="brand">
        <span class="brand__mark">12</span>
        <div>
          <strong>withXiaoyu12</strong>
          <small>控制中心</small>
        </div>
      </div>

      <nav aria-label="控制中心页面">
        <button
          type="button"
          :class="{ active: activePage === 'status' }"
          @click="activePage = 'status'"
        >
          当前状态
        </button>
        <button
          type="button"
          :class="{ active: activePage === 'states' }"
          @click="activePage = 'states'"
        >
          状态与动画
        </button>
        <button
          type="button"
          :class="{ active: activePage === 'dialogue' }"
          @click="activePage = 'dialogue'"
        >
          Dialogue 编辑
        </button>
        <button
          type="button"
          :class="{ active: activePage === 'reminders' }"
          @click="activePage = 'reminders'"
        >
          提醒
        </button>
        <button
          type="button"
          :class="{ active: activePage === 'settings' }"
          @click="openSettings('general')"
        >
          设置
        </button>
      </nav>

      <p>withXiaoyu12</p>
    </aside>

    <div ref="contentElement" class="control-center__content">
      <StatusPage
        v-if="activePage === 'status'"
        :snapshot="snapshot"
        :connected="isConnected"
        @action="handleAction"
        @open-system-monitor-settings="openSystemMonitorSettings"
      />
      <StateAnimationEditor
        v-else-if="activePage === 'states'"
        :runtime-state="snapshot?.state"
      />
      <DialogueEditor v-else-if="activePage === 'dialogue'" @action="handleAction" />
      <ReminderPage
        v-else-if="activePage === 'reminders'"
        :runtime="snapshot"
      />
      <SettingsPage
        v-else
        :initial-tab="settingsInitialTab"
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
  display: grid;
  width: 38px;
  height: 38px;
  font-size: 12px;
  font-weight: 800;
  background: var(--cc-accent);
  border-radius: 11px;
  place-items: center;
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

aside > p {
  margin: auto 0 0;
  color: var(--cc-sidebar-text);
  font-size: 11px;
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
.control-center__content :deep(.scheduler-status) {
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

  aside > p {
    display: none;
  }

  .control-center__content {
    padding: 20px;
  }
}
</style>
