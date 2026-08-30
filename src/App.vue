<script setup lang="ts">
import { getCurrentWindow } from "@tauri-apps/api/window";
import Pet from "./pet/Pet.vue";
import ControlCenter from "./settings/ControlCenter.vue";
import SystemStatusWindow from "./components/SystemStatusWindow.vue";
import KeyboardHistoryWindow from "./components/KeyboardHistoryWindow.vue";
import MouseVisualizerWindow from "./components/MouseVisualizerWindow.vue";

// Route by window label (query strings are unreliable in release builds).
const label = getCurrentWindow().label;
const isControlCenter = label === "control-center";
const isSystemStatus = label === "system-status";
const isKeyboardHistory = label === "keyboard-history";
const isMouseVisualizer = label === "mouse-visualizer";
</script>

<template>
  <ControlCenter v-if="isControlCenter" />
  <SystemStatusWindow v-else-if="isSystemStatus" />
  <KeyboardHistoryWindow v-else-if="isKeyboardHistory" />
  <MouseVisualizerWindow v-else-if="isMouseVisualizer" />
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
}
</style>
