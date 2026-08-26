<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  createMouseVisualizerController,
  isMouseButtonActive,
  mouseVisualizerPointerPresentation,
  mouseVisualizerVisualStyle,
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
  bodyColor: string;
  bodyOpacity: number;
  buttonColor: string;
  buttonOpacity: number;
  outlineColor: string;
  outlineOpacity: number;
  outlineWidth: number;
  activeColor: string;
  activeOpacity: number;
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
const visualizerStyle = computed(() => {
  const visual = mouseVisualizerVisualStyle({
    bodyColor: props.bodyColor,
    bodyOpacity: props.bodyOpacity,
    buttonColor: props.buttonColor,
    buttonOpacity: props.buttonOpacity,
    outlineColor: props.outlineColor,
    outlineOpacity: props.outlineOpacity,
    outlineWidth: props.outlineWidth,
    activeColor: props.activeColor,
    activeOpacity: props.activeOpacity,
  });
  return {
    "--mouse-body-fill": visual.bodyFill,
    "--mouse-button-fill": visual.buttonFill,
    "--mouse-outline": visual.outline,
    "--mouse-outline-width": visual.outlineWidth,
    "--mouse-active-fill": visual.activeFill,
    pointerEvents: presentation.rootPointerEvents,
  };
});

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

    <svg
      class="mouse-visualizer__body"
      :style="{ pointerEvents: presentation.visualPointerEvents }"
      viewBox="0 0 80 100"
      role="img"
      aria-label="Mouse buttons"
    >
      <path
        class="mouse-visualizer__body-fill"
        d="M40 3C21 3 10 15 10 37V60C10 84 21 97 40 97C59 97 70 84 70 60V37C70 15 59 3 40 3Z"
      />
      <path
        class="mouse-visualizer__button-fill"
        :class="{ 'is-active': active('left') }"
        d="M40 3C21 3 10 15 10 37V42H40V3Z"
      />
      <path
        class="mouse-visualizer__button-fill"
        :class="{ 'is-active': active('right') }"
        d="M40 3C59 3 70 15 70 37V42H40V3Z"
      />
      <path class="mouse-visualizer__outline-line" d="M10 42H70M40 3V42" />
      <path
        class="mouse-visualizer__outline-line"
        d="M40 3C21 3 10 15 10 37V60C10 84 21 97 40 97C59 97 70 84 70 60V37C70 15 59 3 40 3Z"
      />
      <text
        class="mouse-visualizer__label"
        :class="{ 'is-active': active('left') }"
        x="25"
        y="32"
      >L</text>
      <text
        class="mouse-visualizer__label"
        :class="{ 'is-active': active('right') }"
        x="55"
        y="32"
      >R</text>
      <rect
        class="mouse-visualizer__wheel mouse-visualizer__outline"
        :class="{ 'is-active': wheelActive }"
        x="34"
        y="13"
        width="12"
        height="25"
        rx="6"
      />
      <text
        class="mouse-visualizer__wheel-label"
        :class="{ 'is-active': wheelActive }"
        x="40"
        y="29"
      >
        {{ wheelSymbol || "•" }}
      </text>
      <rect
        class="mouse-visualizer__side mouse-visualizer__outline"
        :class="{ 'is-active': active('mouse4') }"
        x="3"
        y="54"
        width="20"
        height="11"
        rx="4"
      />
      <rect
        class="mouse-visualizer__side mouse-visualizer__outline"
        :class="{ 'is-active': active('mouse5') }"
        x="3"
        y="69"
        width="20"
        height="11"
        rx="4"
      />
      <text
        class="mouse-visualizer__side-label"
        :class="{ 'is-active': active('mouse4') }"
        x="13"
        y="62"
      >M4</text>
      <text
        class="mouse-visualizer__side-label"
        :class="{ 'is-active': active('mouse5') }"
        x="13"
        y="77"
      >M5</text>
      <circle
        v-if="active('other')"
        class="mouse-visualizer__other mouse-visualizer__outline is-active"
        cx="58"
        cy="72"
        r="7"
      />
      <text
        v-if="active('other')"
        class="mouse-visualizer__other-label"
        x="58"
        y="75"
      >+</text>
    </svg>
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
  background: transparent;
  border: 0;
  transform: translateX(-50%);
  cursor: grab;
  touch-action: none;
}

.mouse-visualizer__drag-handle--dragging { cursor: grabbing; }

.mouse-visualizer__drag-handle span {
  width: 7px;
  height: max(1px, var(--mouse-outline-width));
  background: var(--mouse-outline);
  border-radius: 999px;
  pointer-events: none;
}

.mouse-visualizer__body {
  position: absolute;
  top: 17%;
  left: 7%;
  width: 86%;
  height: 80%;
  overflow: visible;
}

.mouse-visualizer__body-fill { fill: var(--mouse-body-fill); }

.mouse-visualizer__button-fill,
.mouse-visualizer__wheel,
.mouse-visualizer__side,
.mouse-visualizer__other {
  fill: var(--mouse-button-fill);
  transition: fill 90ms ease;
}

.mouse-visualizer__outline,
.mouse-visualizer__outline-line {
  stroke: var(--mouse-outline);
  stroke-width: var(--mouse-outline-width);
  vector-effect: non-scaling-stroke;
}

.mouse-visualizer__outline { stroke-linejoin: round; }

.mouse-visualizer__outline-line {
  fill: none;
  stroke-linecap: round;
}

.mouse-visualizer__label,
.mouse-visualizer__wheel-label,
.mouse-visualizer__side-label,
.mouse-visualizer__other-label {
  fill: #645a70;
  font-size: 8px;
  font-weight: 700;
  text-anchor: middle;
  pointer-events: none;
}

.mouse-visualizer__wheel-label { font-size: 10px; }

.mouse-visualizer__side-label,
.mouse-visualizer__other-label { font-size: 6px; }

.is-active { fill: var(--mouse-active-fill); }

.mouse-visualizer__label.is-active,
.mouse-visualizer__wheel-label.is-active,
.mouse-visualizer__side-label.is-active,
.mouse-visualizer__other-label { fill: #fff; }
</style>
