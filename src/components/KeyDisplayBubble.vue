<script setup lang="ts">
import { computed } from "vue";
import { buildKeyDisplayModel } from "../input/keyDisplay";

const props = defineProps<{
  keys: readonly string[];
}>();

const keycaps = computed(() => buildKeyDisplayModel(props.keys).keycaps);
</script>

<template>
  <div class="key-display" :aria-label="keycaps.join(' + ')">
    <span
      v-for="(keycap, index) in keycaps"
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
  gap: calc(4px * var(--key-display-scale, 1));
  max-width: 100%;
  min-height: calc(34px * var(--key-display-scale, 1));
  padding: calc(5px * var(--key-display-scale, 1))
    calc(7px * var(--key-display-scale, 1));
  overflow: hidden;
  border: calc(1px * var(--key-display-scale, 1)) solid rgb(216 210 230 / 85%);
  border-radius: calc(10px * var(--key-display-scale, 1));
  background: rgb(255 255 255 / 90%);
  box-shadow: 0 calc(2px * var(--key-display-scale, 1))
    calc(7px * var(--key-display-scale, 1)) rgb(43 39 56 / 14%);
  color: #2b2738;
  white-space: nowrap;
}

.key-display__keycap {
  box-sizing: border-box;
  min-width: calc(21px * var(--key-display-scale, 1));
  padding: calc(2px * var(--key-display-scale, 1))
    calc(4px * var(--key-display-scale, 1));
  overflow: hidden;
  border: calc(1px * var(--key-display-scale, 1)) solid rgb(184 176 204 / 80%);
  border-radius: calc(5px * var(--key-display-scale, 1));
  background: rgb(250 248 255 / 95%);
  font: 600 calc(13px * var(--key-display-scale, 1)) / 1.2
    -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  text-align: center;
  text-overflow: ellipsis;
}
</style>
