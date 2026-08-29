<script setup lang="ts">
import { computed, onMounted } from "vue";
import KeyHistoryStack from "./KeyHistoryStack.vue";
import MouseInputVisualizer from "./MouseInputVisualizer.vue";
import { settingsManager } from "../settings/settingsManager";
import { useInputOverlayRuntime } from "../input/inputOverlayRuntime";
import { applyWindowChrome } from "./overlayChrome";
import { useOverlayDrag } from "./overlayDrag";

const LABEL = "input-monitor";
const { isDragging, restorePosition, onPointerDown, onPointerUp, startWindowDrag } =
  useOverlayDrag(LABEL);

const { pressedKeys, keyboardStatus, mouseStatus, pressedButtons, lastScroll, lastScrollAt } =
  useInputOverlayRuntime();

const input = computed(() => settingsManager.settings.value.input);

const showsKeyHistory = computed(
  () =>
    input.value.keyboardEnabled &&
    input.value.keyDisplayEnabled &&
    keyboardStatus.value === "active",
);

const showsMouseVisualizer = computed(
  () =>
    input.value.mouseEnabled &&
    input.value.mouseVisualizerEnabled &&
    ["active", "starting"].includes(mouseStatus.value),
);

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
    class="input-monitor"
    @pointer-down="handlePointerDown"
    @pointer-up="onPointerUp"
    @pointer-cancel="onPointerUp"
  >
    <KeyHistoryStack
      v-if="showsKeyHistory"
      class="input-monitor__key-history"
      :pressed-keys="pressedKeys"
      :keyboard-enabled="input.keyboardEnabled"
      :key-display-enabled="input.keyDisplayEnabled"
      :keyboard-status="keyboardStatus"
      :max-items="input.keyDisplayMaxItems"
      :duration-ms="input.keyDisplayDurationMs"
      :persistent="input.keyDisplayPersistent"
      position="top"
      flow-direction="down"
    />

    <MouseInputVisualizer
      v-if="showsMouseVisualizer"
      class="input-monitor__mouse"
      :mouse-enabled="input.mouseEnabled"
      :visualizer-enabled="input.mouseVisualizerEnabled"
      :mouse-status="mouseStatus"
      :pressed-buttons="pressedButtons"
      :last-scroll-direction="lastScroll"
      :last-scroll-at="lastScrollAt"
      :body-color="input.mouseVisualizerBodyColor"
      :body-opacity="input.mouseVisualizerBodyOpacity"
      :button-color="input.mouseVisualizerButtonColor"
      :button-opacity="input.mouseVisualizerButtonOpacity"
      :outline-color="input.mouseVisualizerOutlineColor"
      :outline-opacity="input.mouseVisualizerOutlineOpacity"
      :outline-width="input.mouseVisualizerOutlineWidth"
      :active-color="input.mouseVisualizerActiveColor"
      :active-opacity="input.mouseVisualizerActiveOpacity"
      :dragging="isDragging"
    />

    <p v-if="!showsKeyHistory && !showsMouseVisualizer" class="input-monitor__empty">
      开启键盘或鼠标监听后，这里会实时显示输入事件。
    </p>
  </main>
</template>

<style scoped>
.input-monitor {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 10px;
  overflow: hidden;
  background: transparent;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}

.input-monitor:active {
  cursor: grabbing;
}

.input-monitor__empty {
  margin: auto;
  font-size: 12px;
  opacity: 0.6;
}
</style>
