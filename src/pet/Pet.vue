<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  watch,
} from "vue";
import PetContextMenu from "../components/PetContextMenu.vue";
import SpeechBubble from "../components/SpeechBubble.vue";
import { usePetAnimation } from "./animationEngine";
import {
  initializePetAssets,
  resolveCurrentPetAsset,
} from "./assetLoader";
import { triggerDialogueEvent } from "./dialogue";
import { DIALOGUE_EVENT_TYPES } from "./dialogueEvents";
import { usePetInteraction } from "./interaction";
import { createPetControl } from "./petControl";
import type { PetControlActionType } from "./petControl";
import { usePetStore } from "./petStore";
import { useMainRuntimeBridge } from "./runtimeBridge";
import { updateAnimationRuntime } from "./runtimeStatus";

const { currentState } = usePetStore();
const currentAsset = computed(() =>
  resolveCurrentPetAsset(currentState.value),
);
const animation = usePetAnimation(currentAsset);
const { currentFrame, currentFrameIndex, isPaused } = animation;
const petControl = createPetControl(animation);
useMainRuntimeBridge(petControl.execute);
const {
  dialogue,
  handleClick,
  handleHoverEnter,
  handleHoverLeave,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handlePointerCancel,
} = usePetInteraction();
const { currentText: dialogueText, isVisible: isDialogueVisible } = dialogue;
const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
});

watch(
  [currentState, isPaused, currentFrame, currentFrameIndex],
  ([state, paused, frame, frameIndex]) => {
    updateAnimationRuntime({
      state,
      isPaused: paused,
      currentFrame: frame,
      currentFrameIndex: frameIndex,
    });
  },
  { immediate: true, flush: "sync" },
);

function openContextMenu(event: MouseEvent): void {
  contextMenu.x = event.clientX;
  contextMenu.y = event.clientY;
  contextMenu.visible = true;
}

function closeContextMenu(): void {
  contextMenu.visible = false;
}

function handleContextMenuAction(type: PetControlActionType): void {
  closeContextMenu();
  void petControl.execute({ type }).catch((error: unknown) => {
    console.error("Failed to execute pet control action.", error);
  });
}

onMounted(() => {
  document.addEventListener("pointerdown", closeContextMenu);
  void initializePetAssets();
  triggerDialogueEvent(DIALOGUE_EVENT_TYPES.DEVELOPMENT, {
    candidateIndex: 0,
  });
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", closeContextMenu);
});
</script>

<template>
  <div
    class="pet"
    :data-pet="currentAsset.petId"
    :data-state="currentState"
    :data-resolved-state="currentAsset.resolvedState"
    @click="handleClick"
    @mouseenter="handleHoverEnter"
    @mouseleave="handleHoverLeave"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerCancel"
    @contextmenu.prevent.stop="openContextMenu"
  >
    <SpeechBubble
      class="pet__speech-bubble"
      :text="dialogueText"
      :visible="isDialogueVisible"
    />
    <img
      class="pet__frame"
      :src="currentFrame"
      :alt="currentAsset.petName"
      draggable="false"
    />
    <PetContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :is-paused="isPaused"
      @action="handleContextMenuAction"
    />
  </div>
</template>

<style scoped>
.pet {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  touch-action: none;
}

.pet__speech-bubble {
  position: absolute;
  top: 4px;
  left: 50%;
  z-index: 1;
  transform: translateX(-50%);
}

.pet__frame {
  display: block;
  width: 160px;
  height: 160px;
  pointer-events: none;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
</style>
