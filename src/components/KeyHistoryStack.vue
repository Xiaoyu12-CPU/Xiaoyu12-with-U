<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import KeyDisplayBubble from "./KeyDisplayBubble.vue";
import {
  createKeyHistoryController,
  keyHistoryAxis,
  resolveKeyDisplayFlowDirection,
  type KeyDisplayEntry,
} from "../input/keyDisplay";
import type { KeyboardMonitorStatus } from "../input/types";
import type {
  KeyDisplayFlowDirection,
  KeyDisplayPosition,
} from "../settings/settingsTypes";

const props = defineProps<{
  pressedKeys: readonly string[];
  keyboardEnabled: boolean;
  keyDisplayEnabled: boolean;
  keyboardStatus: KeyboardMonitorStatus;
  maxItems: number;
  durationMs: number;
  persistent: boolean;
  position: KeyDisplayPosition;
  flowDirection: KeyDisplayFlowDirection;
}>();

const entries = ref<readonly KeyDisplayEntry[]>([]);
const controller = createKeyHistoryController({
  onChange(snapshot) {
    entries.value = snapshot.entries;
  },
});
const actualFlow = computed(() =>
  resolveKeyDisplayFlowDirection(props.position, props.flowDirection),
);
const axis = computed(() => keyHistoryAxis(actualFlow.value));
const renderedEntries = computed(() =>
  actualFlow.value === "down" || actualFlow.value === "right"
    ? [...entries.value].reverse()
    : entries.value,
);

watch(
  () => [
    props.pressedKeys,
    props.keyboardEnabled,
    props.keyDisplayEnabled,
    props.keyboardStatus,
    props.maxItems,
    props.durationMs,
    props.persistent,
  ] as const,
  ([
    pressedKeys,
    keyboardEnabled,
    keyDisplayEnabled,
    keyboardStatus,
    maxItems,
    durationMs,
    persistent,
  ]) => {
    controller.update({
      pressedKeys,
      keyboardEnabled,
      keyDisplayEnabled,
      keyboardStatus,
      maxItems,
      durationMs,
      persistent,
    });
  },
  { immediate: true, deep: true },
);

onBeforeUnmount(() => controller.dispose());
</script>

<template>
  <TransitionGroup
    name="key-history-entry"
    tag="div"
    class="key-history"
    :class="[
      `key-history--${axis}`,
      `key-history--flow-${actualFlow}`,
    ]"
    aria-live="polite"
    aria-label="Recent keys"
  >
    <KeyDisplayBubble
      v-for="entry in renderedEntries"
      :key="entry.id"
      class="key-history__entry"
      :keys="entry.keys"
    />
  </TransitionGroup>
</template>

<style scoped>
.key-history {
  box-sizing: border-box;
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  gap: calc(6px * var(--key-display-scale, 1));
  pointer-events: none;
}

.key-history--vertical {
  flex-direction: column;
  align-items: center;
}

.key-history--horizontal {
  flex-direction: row;
  align-items: center;
}

.key-history--flow-down,
.key-history--flow-right {
  justify-content: flex-start;
}

.key-history--flow-up,
.key-history--flow-left {
  justify-content: flex-end;
}

.key-history__entry {
  flex: 0 1 auto;
  min-width: 0;
  max-width: var(--key-history-entry-width);
}

.key-history-entry-enter-active,
.key-history-entry-leave-active,
.key-history-entry-move {
  transition:
    opacity 220ms ease,
    transform 220ms ease;
}

.key-history-entry-enter-from { opacity: 0; transform: scale(.92); }
.key-history-entry-leave-active { position: absolute; }
.key-history-entry-leave-to { opacity: 0; }
.key-history--flow-up .key-history-entry-leave-to { transform: translateY(-14px); }
.key-history--flow-down .key-history-entry-leave-to { transform: translateY(14px); }
.key-history--flow-left .key-history-entry-leave-to { transform: translateX(-14px); }
.key-history--flow-right .key-history-entry-leave-to { transform: translateX(14px); }
</style>
