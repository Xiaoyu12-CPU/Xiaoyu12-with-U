<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import SystemStatusBubble from "./SystemStatusBubble.vue";
import { settingsManager } from "../settings/settingsManager";
import { applyWindowChrome } from "./overlayChrome";
import { useRemotePetRuntime } from "../pet/runtimeBridge";

const isDragging = ref(false);

// The pet window broadcasts its runtime snapshot; this window only renders it.
const { snapshot } = useRemotePetRuntime();

const bubble = computed(() => settingsManager.settings.value.systemStatusBubble);

const fallbackSnapshot = computed(() => snapshot.value ?? undefined);

function handlePointerDown(): void {
  isDragging.value = true;
  void getCurrentWindow().startDragging().finally(() => {
    isDragging.value = false;
  });
}

onMounted(() => {
  void settingsManager.initialize();
  applyWindowChrome();
});
</script>

<template>
  <main class="system-status-window">
    <SystemStatusBubble
      v-if="fallbackSnapshot"
      :snapshot="fallbackSnapshot"
      :background-color="bubble.backgroundColor"
      :background-opacity="bubble.backgroundOpacity"
      :text-color="bubble.textColor"
      :border-color="bubble.borderColor"
      :border-width="bubble.borderWidth"
      :panel-width="bubble.panelWidth"
      :panel-scale="bubble.panelScale"
      :visible-items="bubble.visibleItems"
      window-drag-handle
      @pointer-down="handlePointerDown"
    />
    <p v-else class="system-status-window__empty">等待桌宠窗口的运行状态…</p>
  </main>
</template>

<style scoped>
.system-status-window {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 8px;
  background: transparent;
  overflow: hidden;
}

.system-status-window__empty {
  margin: auto;
  font-size: 12px;
  opacity: 0.6;
}
</style>
