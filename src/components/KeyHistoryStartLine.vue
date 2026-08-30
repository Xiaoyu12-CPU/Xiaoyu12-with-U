<script setup lang="ts">
import { computed } from "vue";
import { keyHistoryStartLinePresentation } from "../input/keyHistoryDrag";

const props = defineProps<{
  color: string;
  opacity: number;
  dragging: boolean;
}>();

const emit = defineEmits<{
  pointerDown: [event: PointerEvent];
  pointerMove: [event: PointerEvent];
  pointerUp: [event: PointerEvent];
  pointerCancel: [event: PointerEvent];
}>();

const presentation = computed(() =>
  keyHistoryStartLinePresentation(props.color, props.opacity),
);
</script>

<template>
  <div
    class="key-history-start-line"
    :class="{ 'key-history-start-line--dragging': dragging }"
    :style="presentation.handleStyle"
    aria-label="拖动键位显示位置"
    @pointerdown.stop.prevent="emit('pointerDown', $event)"
    @pointermove.stop.prevent="emit('pointerMove', $event)"
    @pointerup.stop.prevent="emit('pointerUp', $event)"
    @pointercancel.stop.prevent="emit('pointerCancel', $event)"
    @click.stop.prevent
  >
    <span :style="presentation.lineStyle" aria-hidden="true"></span>
  </div>
</template>

<style scoped>
.key-history-start-line {
  box-sizing: border-box;
  display: grid;
  width: 72px;
  height: 24px;
  place-items: center;
  transform: translate(-50%, -50%) scale(var(--key-display-scale, 1));
  cursor: grab;
  pointer-events: auto;
  touch-action: none;
  user-select: none;
}

.key-history-start-line--dragging { cursor: grabbing; }

.key-history-start-line span {
  display: block;
  width: 56px;
  height: 2px;
  border-radius: 999px;
  pointer-events: none;
}
</style>
