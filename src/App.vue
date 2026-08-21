<script setup lang="ts">
import { computed } from "vue";
import Pet from "./pet/Pet.vue";
import ControlCenter from "./settings/ControlCenter.vue";

const isControlCenter = computed(
  () => new URLSearchParams(window.location.search).get("window") === "control-center",
);
</script>

<template>
  <ControlCenter v-if="isControlCenter" />
  <main v-else class="pet-window">
    <Pet />
  </main>
</template>

<style>
:root {
  color-scheme: light dark;
  background: transparent;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: transparent;
}

.pet-window {
  user-select: none;
  -webkit-user-select: none;
}

.pet-window {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  background: transparent;
  cursor: grab;
}

.pet-window:active {
  cursor: grabbing;
}
</style>
