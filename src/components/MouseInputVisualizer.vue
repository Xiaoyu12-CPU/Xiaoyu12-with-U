<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  createMouseVisualizerController,
  isMouseButtonActive,
  mouseVisualizerPointerPresentation,
  scrollDirectionSymbol,
  type MouseVisualizerSnapshot,
} from "../input/mouseVisualizer";
import type {
  MouseButton,
  MouseMonitorStatus,
  MouseScrollDirection,
} from "../input/types";

const props = defineProps<{
  mouseEnabled: boolean;
  visualizerEnabled: boolean;
  mouseStatus: MouseMonitorStatus;
  pressedButtons: readonly MouseButton[];
  lastScrollDirection?: MouseScrollDirection;
  lastScrollAt?: number;
  activeColor: string;
  dragging: boolean;
}>();

const emit = defineEmits<{
  pointerDown: [event: PointerEvent];
  pointerMove: [event: PointerEvent];
  pointerUp: [event: PointerEvent];
  pointerCancel: [event: PointerEvent];
}>();

const presentation = mouseVisualizerPointerPresentation();
const snapshot = ref<MouseVisualizerSnapshot>({
  visible: false,
  activeButtons: [] as readonly MouseButton[],
});
const controller = createMouseVisualizerController({
  onChange(nextSnapshot) {
    snapshot.value = nextSnapshot;
  },
});
const activeButtons = computed(() => snapshot.value.activeButtons);
const wheelActive = computed(() =>
  isMouseButtonActive(activeButtons.value, "middle")
  || snapshot.value.scrollDirection !== undefined,
);
const wheelSymbol = computed(() =>
  scrollDirectionSymbol(snapshot.value.scrollDirection),
);
const visualizerStyle = computed(() => ({
  "--mouse-active-color": props.activeColor,
  pointerEvents: presentation.rootPointerEvents,
}));

function active(button: MouseButton): boolean {
  return isMouseButtonActive(activeButtons.value, button);
}

watch(
  () => [
    props.mouseEnabled,
    props.visualizerEnabled,
    props.mouseStatus,
    props.pressedButtons,
    props.lastScrollDirection,
    props.lastScrollAt,
  ] as const,
  ([
    mouseEnabled,
    visualizerEnabled,
    mouseStatus,
    pressedButtons,
    lastScrollDirection,
    lastScrollAt,
  ]) => {
    controller.update({
      mouseEnabled,
      visualizerEnabled,
      mouseStatus,
      pressedButtons,
      lastScrollDirection,
      lastScrollAt,
    });
  },
  { immediate: true, deep: true },
);

onBeforeUnmount(() => controller.dispose());
</script>

<template>
  <div
    v-show="snapshot.visible"
    class="mouse-visualizer"
    :style="visualizerStyle"
    aria-label="Mouse input visualizer"
  >
    <button
      class="mouse-visualizer__drag-handle"
      :class="{ 'mouse-visualizer__drag-handle--dragging': dragging }"
      :style="{ pointerEvents: presentation.handlePointerEvents }"
      type="button"
      aria-label="拖动鼠标显示位置"
      @pointerdown.stop.prevent="emit('pointerDown', $event)"
      @pointermove.stop.prevent="emit('pointerMove', $event)"
      @pointerup.stop.prevent="emit('pointerUp', $event)"
      @pointercancel.stop.prevent="emit('pointerCancel', $event)"
      @click.stop.prevent
    >
      <span></span><span></span><span></span>
    </button>

    <div
      class="mouse-visualizer__body"
      :style="{ pointerEvents: presentation.visualPointerEvents }"
      aria-hidden="true"
    >
      <span
        class="mouse-visualizer__button mouse-visualizer__button--left"
        :class="{ 'is-active': active('left') }"
      >L</span>
      <span
        class="mouse-visualizer__button mouse-visualizer__button--right"
        :class="{ 'is-active': active('right') }"
      >R</span>
      <span
        class="mouse-visualizer__wheel"
        :class="{ 'is-active': wheelActive }"
      >{{ wheelSymbol || "•" }}</span>
      <span
        class="mouse-visualizer__side mouse-visualizer__side--four"
        :class="{ 'is-active': active('mouse4') }"
      >M4</span>
      <span
        class="mouse-visualizer__side mouse-visualizer__side--five"
        :class="{ 'is-active': active('mouse5') }"
      >M5</span>
      <span
        v-if="active('other')"
        class="mouse-visualizer__other is-active"
      >+</span>
    </div>
  </div>
</template>

<style scoped>
.mouse-visualizer {
  box-sizing: border-box;
  position: relative;
  width: 100%;
  height: 100%;
  color: #554b65;
  font-family: ui-rounded, "SF Pro Rounded", system-ui, sans-serif;
  user-select: none;
}

.mouse-visualizer__drag-handle {
  position: absolute;
  top: 0;
  left: 50%;
  z-index: 2;
  display: flex;
  width: 42%;
  height: 15%;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0;
  background: rgba(255, 255, 255, .82);
  border: 1px solid rgba(111, 91, 160, .22);
  border-radius: 999px;
  transform: translateX(-50%);
  cursor: grab;
  touch-action: none;
}

.mouse-visualizer__drag-handle--dragging { cursor: grabbing; }

.mouse-visualizer__drag-handle span {
  width: 3px;
  height: 3px;
  background: #8f80ad;
  border-radius: 50%;
  pointer-events: none;
}

.mouse-visualizer__body {
  box-sizing: border-box;
  position: absolute;
  top: 17%;
  left: 10%;
  width: 80%;
  height: 80%;
  overflow: visible;
  background: rgba(250, 248, 255, .88);
  border: 1px solid rgba(108, 92, 139, .3);
  border-radius: 46% 46% 42% 42% / 33% 33% 48% 48%;
  box-shadow: 0 3px 10px rgba(62, 45, 91, .12);
}

.mouse-visualizer__button,
.mouse-visualizer__wheel,
.mouse-visualizer__side,
.mouse-visualizer__other {
  box-sizing: border-box;
  display: grid;
  place-items: center;
  color: #7f728f;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  transition: background-color 90ms ease, color 90ms ease, box-shadow 90ms ease;
}

.mouse-visualizer__button {
  position: absolute;
  top: 0;
  width: 50%;
  height: 42%;
  background: rgba(235, 231, 244, .75);
  border-bottom: 1px solid rgba(108, 92, 139, .22);
}

.mouse-visualizer__button--left {
  left: 0;
  border-right: 1px solid rgba(108, 92, 139, .2);
  border-radius: 80% 0 8px 0;
}

.mouse-visualizer__button--right {
  right: 0;
  border-radius: 0 80% 0 8px;
}

.mouse-visualizer__wheel {
  position: absolute;
  top: 12%;
  left: 50%;
  z-index: 1;
  width: 24%;
  height: 31%;
  color: #6c5e80;
  background: #fdfcff;
  border: 1px solid rgba(108, 92, 139, .34);
  border-radius: 999px;
  transform: translateX(-50%);
}

.mouse-visualizer__side {
  position: absolute;
  left: -10%;
  width: 28%;
  height: 16%;
  background: #f6f2fb;
  border: 1px solid rgba(108, 92, 139, .3);
  border-radius: 5px;
  font-size: 8px;
}

.mouse-visualizer__side--four { top: 54%; }
.mouse-visualizer__side--five { top: 73%; }

.mouse-visualizer__other {
  position: absolute;
  right: 8%;
  bottom: 9%;
  width: 20%;
  aspect-ratio: 1;
  border-radius: 50%;
}

.is-active {
  color: #fff;
  background: var(--mouse-active-color, #8b5cf6);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--mouse-active-color, #8b5cf6) 22%, transparent);
}
</style>
