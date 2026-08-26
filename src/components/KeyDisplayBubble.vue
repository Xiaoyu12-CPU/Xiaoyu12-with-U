<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import {
  createKeyDisplayController,
  type KeyDisplaySnapshot,
} from "../input/keyDisplay";
import type { KeyboardMonitorStatus } from "../input/types";

const props = defineProps<{
  pressedKeys: readonly string[];
  keyboardEnabled: boolean;
  keyDisplayEnabled: boolean;
  keyboardStatus: KeyboardMonitorStatus;
}>();

const display = ref<KeyDisplaySnapshot>({
  visible: false,
  keycaps: [],
  overflowCount: 0,
});
const controller = createKeyDisplayController({
  onChange(snapshot) {
    display.value = snapshot;
  },
});

watch(
  () => [
    props.pressedKeys,
    props.keyboardEnabled,
    props.keyDisplayEnabled,
    props.keyboardStatus,
  ] as const,
  ([pressedKeys, keyboardEnabled, keyDisplayEnabled, keyboardStatus]) => {
    controller.update({
      pressedKeys,
      keyboardEnabled,
      keyDisplayEnabled,
      keyboardStatus,
    });
  },
  { immediate: true, deep: true },
);

onBeforeUnmount(() => controller.dispose());
</script>

<template>
  <div
    class="key-display"
    :class="{ 'key-display--visible': display.visible }"
    aria-hidden="true"
  >
    <span
      v-for="(keycap, index) in display.keycaps"
      :key="`${keycap}-${index}`"
      class="key-display__keycap"
    >
      {{ keycap }}
    </span>
  </div>
</template>

<style scoped>
.key-display {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(5px * var(--key-display-scale, 1));
  width: 100%;
  height: 100%;
  padding: calc(6px * var(--key-display-scale, 1))
    calc(10px * var(--key-display-scale, 1));
  border: calc(1px * var(--key-display-scale, 1)) solid rgb(216 210 230 / 85%);
  border-radius: calc(12px * var(--key-display-scale, 1));
  background: rgb(255 255 255 / 88%);
  box-shadow: 0 calc(2px * var(--key-display-scale, 1))
    calc(8px * var(--key-display-scale, 1)) rgb(43 39 56 / 14%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 180ms ease;
}

.key-display--visible { opacity: 1; }

.key-display__keycap {
  box-sizing: border-box;
  min-width: calc(25px * var(--key-display-scale, 1));
  padding: calc(3px * var(--key-display-scale, 1))
    calc(6px * var(--key-display-scale, 1));
  border: calc(1px * var(--key-display-scale, 1)) solid rgb(184 176 204 / 80%);
  border-radius: calc(6px * var(--key-display-scale, 1));
  background: rgb(250 248 255 / 95%);
  color: #2b2738;
  font: 600 calc(14px * var(--key-display-scale, 1)) / 1.2
    -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  text-align: center;
  white-space: nowrap;
}
</style>
