<script setup lang="ts">
import { computed, onMounted } from "vue";
import SystemStatusBubble from "./SystemStatusBubble.vue";
import { settingsManager } from "../settings/settingsManager";
import { openSystemMonitorSettings, useRemotePetRuntime } from "../pet/runtimeBridge";
import { OVERLAY_LABELS } from "../pet/desktopWindows";
import { OVERLAY_WINDOW_PADDING } from "../pet/desktopWindowLayout";
import { useOverlayWindow } from "./useOverlayWindow";

const { snapshot } = useRemotePetRuntime();
const { startDragging, resize } = useOverlayWindow(OVERLAY_LABELS.systemStatus);
const bubble = computed(() => settingsManager.settings.value.systemStatusBubble);

function handleSize(size: { width: number; height: number }): void {
  resize(
    size.width + OVERLAY_WINDOW_PADDING * 2,
    size.height + OVERLAY_WINDOW_PADDING * 2,
  );
}

function handleOpenSettings(): void {
  void openSystemMonitorSettings().catch((error) => {
    console.error("Failed to open system monitor settings.", error);
  });
}

onMounted(() => {
  void settingsManager.initialize();
});
</script>

<template>
  <main class="system-status-window" @pointerdown.self="startDragging">
    <SystemStatusBubble
      v-if="snapshot"
      :snapshot="snapshot"
      :background-color="bubble.backgroundColor"
      :background-opacity="bubble.backgroundOpacity"
      :text-color="bubble.textColor"
      :border-color="bubble.borderColor"
      :border-width="bubble.borderWidth"
      :panel-width="bubble.panelWidth"
      :panel-scale="bubble.panelScale"
      :visible-items="bubble.visibleItems"
      window-drag-handle
      @pointer-down="startDragging"
      @size-change="handleSize"
      @open-system-monitor-settings="handleOpenSettings"
    />
    <p v-else class="overlay-loading" @pointerdown="startDragging">
      正在连接桌宠运行状态…
    </p>
  </main>
</template>

<style scoped>
.system-status-window {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  height: 100%;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 8px;
  overflow: hidden;
  background: transparent;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}

.system-status-window:active { cursor: grabbing; }
.overlay-loading { margin: auto; font: 12px system-ui; opacity: .65; }
</style>
