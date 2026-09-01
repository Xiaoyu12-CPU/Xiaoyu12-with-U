<script setup lang="ts">
import { ref, watch } from "vue";
import KeyboardInputSettings from "./KeyboardInputSettings.vue";
import MouseInputSettings from "./MouseInputSettings.vue";
import TypingFeedbackSettings from "./TypingFeedbackSettings.vue";
import { INPUT_SETTINGS_TABS } from "./settingsNavigation";
import type { InputSettingsTabId } from "./settingsNavigation";

const emit = defineEmits<{ navigate: [] }>();
const props = withDefaults(defineProps<{
  initialTab?: InputSettingsTabId;
  navigationRequest?: number;
}>(), { initialTab: "keyboard", navigationRequest: 0 });
const activeTab = ref<InputSettingsTabId>(props.initialTab);

watch(() => props.navigationRequest, () => {
  activeTab.value = props.initialTab;
});

function selectTab(tab: InputSettingsTabId): void {
  activeTab.value = tab;
  emit("navigate");
}
</script>

<template>
  <section class="input-settings" data-settings-category="input">
    <nav class="settings-subtabs" aria-label="输入监控设置分类">
      <button v-for="tab in INPUT_SETTINGS_TABS" :key="tab.id" type="button" :class="{ active: activeTab === tab.id }" @click="selectTab(tab.id)">
        {{ tab.label }}
      </button>
    </nav>
    <KeyboardInputSettings v-if="activeTab === 'keyboard'" />
    <TypingFeedbackSettings v-else-if="activeTab === 'typing'" />
    <MouseInputSettings v-else />
  </section>
</template>
