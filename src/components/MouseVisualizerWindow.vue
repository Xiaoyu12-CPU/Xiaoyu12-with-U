<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import MouseInputVisualizer from "./MouseInputVisualizer.vue";
import { settingsManager } from "../settings/settingsManager";
import { useRemotePetRuntime } from "../pet/runtimeBridge";
import { OVERLAY_LABELS } from "../pet/desktopWindows";
import {
  calculateMouseWindowSize,
  OVERLAY_WINDOW_PADDING,
} from "../pet/desktopWindowLayout";
import { useOverlayWindow } from "./useOverlayWindow";

const { snapshot } = useRemotePetRuntime();
const { isDragging, startDragging, resize } = useOverlayWindow(
  OVERLAY_LABELS.mouseVisualizer,
);
const input = computed(() => settingsManager.settings.value.input);
const size = computed(() => calculateMouseWindowSize(
  settingsManager.settings.value.appearance.petScale,
));
const visualizerStyle = computed(() => ({
  left: `${OVERLAY_WINDOW_PADDING}px`,
  top: `${OVERLAY_WINDOW_PADDING}px`,
  width: `${size.value.width - OVERLAY_WINDOW_PADDING * 2}px`,
  height: `${size.value.height - OVERLAY_WINDOW_PADDING * 2}px`,
}));

watch(size, (next) => resize(next.width, next.height), { immediate: true });

onMounted(() => {
  void settingsManager.initialize();
});
</script>

<template>
  <main class="mouse-visualizer-window">
    <MouseInputVisualizer
      class="mouse-visualizer-window__visual"
      :style="visualizerStyle"
      :mouse-enabled="input.mouseEnabled"
      :visualizer-enabled="input.mouseVisualizerEnabled"
      :mouse-status="snapshot?.mouseStatus ?? 'disabled'"
      :pressed-buttons="snapshot?.pressedMouseButtons ?? []"
      :last-scroll-direction="snapshot?.lastScrollDirection"
      :last-scroll-at="snapshot?.lastScrollAt"
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
      @pointer-down="startDragging"
    />
    <p
      v-if="!snapshot || snapshot.mouseStatus !== 'active'"
      class="mouse-visualizer-window__status"
      @pointerdown="startDragging"
    >
      {{ snapshot?.mouseMessage || $t("鼠标监听未运行") }}
    </p>
  </main>
</template>

<style scoped>
.mouse-visualizer-window {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
  user-select: none;
  -webkit-user-select: none;
}

.mouse-visualizer-window__visual { position: absolute; }
.mouse-visualizer-window__status {
  position: absolute;
  right: 8px;
  bottom: 5px;
  left: 8px;
  margin: 0;
  overflow: hidden;
  font: 10px system-ui;
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
  opacity: .55;
  cursor: grab;
}

.mouse-visualizer-window__status:active { cursor: grabbing; }
</style>
