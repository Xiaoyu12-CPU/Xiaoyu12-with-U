<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import KeyHistoryStack from "./KeyHistoryStack.vue";
import KeyHistoryStartLine from "./KeyHistoryStartLine.vue";
import { settingsManager } from "../settings/settingsManager";
import { useRemotePetRuntime } from "../pet/runtimeBridge";
import { OVERLAY_LABELS } from "../pet/desktopWindows";
import { calculateKeyboardWindowLayout } from "../pet/desktopWindowLayout";
import { useOverlayWindow } from "./useOverlayWindow";

const { snapshot } = useRemotePetRuntime();
const { isDragging, startDragging, resize } = useOverlayWindow(
  OVERLAY_LABELS.keyboardHistory,
);
const input = computed(() => settingsManager.settings.value.input);
const layout = computed(() => calculateKeyboardWindowLayout({
  petScale: settingsManager.settings.value.appearance.petScale,
  position: input.value.keyDisplayPosition,
  flowDirection: input.value.keyDisplayFlowDirection,
  maxItems: input.value.keyDisplayMaxItems,
  startLineGapPx: input.value.keyDisplayStartLineGapPx,
}));
const stackStyle = computed(() => ({
  "--key-display-scale": String(layout.value.scale),
  "--key-history-entry-width": `${layout.value.entryWidth}px`,
  left: `${layout.value.stack.left}px`,
  top: `${layout.value.stack.top}px`,
  width: `${layout.value.stack.width}px`,
  height: `${layout.value.stack.height}px`,
}));
const originStyle = computed(() => ({
  "--key-display-scale": String(layout.value.scale),
  left: `${layout.value.origin.left}px`,
  top: `${layout.value.origin.top}px`,
}));

watch(layout, (next) => resize(next.width, next.height), { immediate: true });

onMounted(() => {
  void settingsManager.initialize();
});
</script>

<template>
  <main class="keyboard-history-window" @pointerdown.self="startDragging">
    <KeyHistoryStack
      class="keyboard-history-window__stack"
      :style="stackStyle"
      :pressed-keys="snapshot?.pressedKeys ?? []"
      :keyboard-enabled="input.keyboardEnabled"
      :key-display-enabled="input.keyDisplayEnabled"
      :keyboard-status="snapshot?.keyboardStatus ?? 'disabled'"
      :max-items="input.keyDisplayMaxItems"
      :duration-ms="input.keyDisplayDurationMs"
      :persistent="input.keyDisplayPersistent"
      :position="input.keyDisplayPosition"
      :flow-direction="input.keyDisplayFlowDirection"
    />
    <KeyHistoryStartLine
      class="keyboard-history-window__origin"
      :style="originStyle"
      :color="input.keyDisplayStartLineColor"
      :opacity="input.keyDisplayStartLineOpacity"
      :dragging="isDragging"
      @pointer-down="startDragging"
    />
  </main>
</template>

<style scoped>
.keyboard-history-window {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}

.keyboard-history-window:active { cursor: grabbing; }
.keyboard-history-window__stack,
.keyboard-history-window__origin { position: absolute; }
.keyboard-history-window__stack { pointer-events: none; }
</style>
