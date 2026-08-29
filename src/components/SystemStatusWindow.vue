<script setup lang="ts">
import { computed, onMounted } from "vue";
import SystemStatusBubble from "./SystemStatusBubble.vue";
import { settingsManager } from "../settings/settingsManager";
import { applyWindowChrome } from "./overlayChrome";
import { useRemotePetRuntime } from "../pet/runtimeBridge";
import { useOverlayDrag } from "./overlayDrag";

const LABEL = "system-status";
const { restorePosition, onPointerDown, onPointerUp, startWindowDrag } =
  useOverlayDrag(LABEL);

// The pet window broadcasts its runtime snapshot; this window only renders it.
const { snapshot } = useRemotePetRuntime();

const bubble = computed(() => settingsManager.settings.value.systemStatusBubble);

function handlePointerDown(event: PointerEvent): void {
  onPointerDown(event);
  startWindowDrag();
}

onMounted(() => {
  void settingsManager.initialize();
  applyWindowChrome();
  void restorePosition();
});
</script>

<template>
  <main
    class="system-status-window"
    @pointer-down="handlePointerDown"
    @pointer-up="onPointerUp"
    @pointer-cancel="onPointerUp"
  >
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
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}

.system-status-window:active {
  cursor: grabbing;
}

.system-status-window__empty {
  margin: auto;
  font-size: 12px;
  opacity: 0.6;
}
</style>
