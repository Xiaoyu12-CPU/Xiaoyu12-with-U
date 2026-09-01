<script setup lang="ts">
import { computed } from "vue";
import {
  PET_CONTROL_ACTION_TYPES,
} from "../pet/petControl";
import type { PetControlActionType } from "../pet/petControl";
import { calculateContextMenuPosition } from "../pet/contextMenuLayout";

const props = defineProps<{
  visible: boolean;
  x: number;
  y: number;
}>();

const emit = defineEmits<{
  action: [type: PetControlActionType];
}>();

const menuStyle = computed(() => {
  const position = calculateContextMenuPosition({
    x: props.x,
    y: props.y,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
  return {
    left: `${position.left}px`,
    top: `${position.top}px`,
  };
});

function select(type: PetControlActionType): void {
  emit("action", type);
}
</script>

<template>
  <div
    v-if="visible"
    class="pet-context-menu"
    :style="menuStyle"
    role="menu"
    :aria-label="$t('桌宠菜单')"
    @click.stop
    @pointerdown.stop
    @contextmenu.prevent.stop
  >
    <button
      type="button"
      role="menuitem"
      @click="select(PET_CONTROL_ACTION_TYPES.OPEN_CONTROL_CENTER)"
    >
      {{ $t("打开控制中心") }}
    </button>
    <button
      class="pet-context-menu__danger"
      type="button"
      role="menuitem"
      @click="select(PET_CONTROL_ACTION_TYPES.EXIT)"
    >
      {{ $t("退出") }}
    </button>
  </div>
</template>

<style scoped>
.pet-context-menu {
  box-sizing: border-box;
  position: absolute;
  z-index: 20;
  display: grid;
  width: min(144px, calc(100vw - 8px));
  padding: 5px;
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
  background: rgba(33, 30, 42, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 9px;
  box-shadow: 0 8px 24px rgba(16, 14, 22, 0.35);
  backdrop-filter: blur(12px);
}

button {
  min-height: 27px;
  padding: 4px 8px;
  color: #f8f6ff;
  font: inherit;
  font-size: 12px;
  text-align: left;
  white-space: nowrap;
  background: transparent;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
}

button:hover:not(:disabled),
button:focus-visible {
  background: rgba(139, 120, 255, 0.32);
  outline: none;
}

button:disabled {
  color: rgba(248, 246, 255, 0.35);
  cursor: default;
}

.pet-context-menu__danger {
  color: #ffb5bd;
}
</style>
