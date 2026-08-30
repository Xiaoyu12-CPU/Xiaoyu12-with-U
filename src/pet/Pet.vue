<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from "vue";
import PetContextMenu from "../components/PetContextMenu.vue";
import ReminderFeedbackActions from "../components/ReminderFeedbackActions.vue";
import SpeechBubble from "../components/SpeechBubble.vue";
import { usePetAnimation } from "./animationEngine";
import { initializePetAssets, resolveCurrentPetAsset } from "./assetLoader";
import { triggerDialogueEvent } from "./dialogue";
import { DIALOGUE_EVENT_TYPES } from "./dialogueEvents";
import { usePetInteraction } from "./interaction";
import { createPetControl } from "./petControl";
import type { PetControlActionType } from "./petControl";
import { usePetStore } from "./petStore";
import { useMainRuntimeBridge } from "./runtimeBridge";
import { updateAnimationRuntime } from "./runtimeStatus";
import { settingsManager } from "../settings/settingsManager";
import { tauriPetWindowSettingsAdapter } from "./windowSettings";
import { useCpuMonitor } from "../system/cpuMonitor";
import { useMemoryMonitor } from "../system/memoryMonitor";
import { useNetworkMonitor } from "../system/networkMonitor";
import { useStorageMonitor } from "../system/storageMonitor";
import { useBatteryMonitor } from "../system/batteryMonitor";
import { useReminderScheduler } from "../reminder/reminderScheduler";
import {
  activeReminderFeedback,
  dismissReminderFeedback,
  snoozeReminderFeedback,
  useReminderRuntimeConsumer,
} from "../reminder/reminderRuntimeConsumer";
import type { SnoozeMinutes } from "../reminder/reminderSnooze";
import { useKeyboardMonitor } from "../input/keyboardMonitor";
import { useMouseMonitor } from "../input/mouseMonitor";
import { useKeyboardActivityBehavior } from "../input/keyboardActivityBehavior";
import { useTypingFeedback } from "../input/typingFeedbackRuntime";
import { useDesktopWindowCoordinator } from "./desktopWindows";

const { currentState } = usePetStore();
const currentAsset = computed(() => resolveCurrentPetAsset(currentState.value));
const animation = usePetAnimation(currentAsset);
const { currentFrame, currentFrameIndex, isPaused } = animation;
const petControl = createPetControl(animation, {
  isAnimationEnabled: () => settingsManager.settings.value.animation.enabled,
});

useMainRuntimeBridge(petControl.execute);
useCpuMonitor();
useMemoryMonitor();
useNetworkMonitor();
useStorageMonitor();
useBatteryMonitor();
useReminderRuntimeConsumer();
useReminderScheduler();
useKeyboardMonitor();
useMouseMonitor();
useKeyboardActivityBehavior();
useTypingFeedback();
useDesktopWindowCoordinator();

const {
  dialogue,
  handleClick,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handlePointerCancel,
} = usePetInteraction();
const { currentText: dialogueText, isVisible: isDialogueVisible } = dialogue;
const showsReminderActions = computed(() => {
  const feedback = activeReminderFeedback.value;
  return Boolean(
    feedback
      && isDialogueVisible.value
      && dialogueText.value === feedback.text.trim(),
  );
});
const contextMenu = reactive({ visible: false, x: 0, y: 0 });
const petStyle = computed(() => ({
  "--pet-scale": String(settingsManager.settings.value.appearance.petScale),
}));

let windowApplyQueue = Promise.resolve();

watch(
  () => settingsManager.settings.value.animation.enabled,
  (enabled) => {
    if (enabled) animation.resume();
    else animation.pause();
  },
  { immediate: true },
);

watch(
  () => [
    settingsManager.settings.value.appearance.petScale,
    settingsManager.settings.value.appearance.alwaysOnTop,
  ] as const,
  ([petScale, alwaysOnTop]) => {
    windowApplyQueue = windowApplyQueue
      .then(() => tauriPetWindowSettingsAdapter.apply({ petScale, alwaysOnTop }))
      .catch((error: unknown) => {
        console.error("Failed to apply pet window settings.", error);
      });
  },
  { immediate: true },
);

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

function handleReminderDismiss(): void {
  const occurrenceId = activeReminderFeedback.value?.occurrenceId;
  if (occurrenceId) {
    dismissReminderFeedback(occurrenceId, { hideDialogue: dialogue.hide });
  }
}

async function handleReminderSnooze(minutes: SnoozeMinutes): Promise<void> {
  const occurrenceId = activeReminderFeedback.value?.occurrenceId;
  if (!occurrenceId) return;
  try {
    await snoozeReminderFeedback(occurrenceId, minutes, {
      hideDialogue: dialogue.hide,
    });
  } catch (error) {
    console.error("Failed to snooze Reminder feedback.", error);
  }
}

onMounted(async () => {
  document.addEventListener("pointerdown", closeContextMenu);
  await Promise.all([initializePetAssets(), settingsManager.initialize()]);
  if (settingsManager.settings.value.dialogue.showDevelopmentMessageOnStartup) {
    triggerDialogueEvent(DIALOGUE_EVENT_TYPES.DEVELOPMENT, { candidateIndex: 0 });
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", closeContextMenu);
});
</script>

<template>
  <div class="pet-scene">
    <div
      class="pet"
      :style="petStyle"
      :data-pet="currentAsset.petId"
      :data-state="currentState"
      :data-resolved-state="currentAsset.resolvedState"
      @click="handleClick"
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
        :interactive="showsReminderActions"
      >
        <ReminderFeedbackActions
          v-if="showsReminderActions"
          :key="activeReminderFeedback?.occurrenceId"
          @dismiss="handleReminderDismiss"
          @snooze="handleReminderSnooze"
        />
      </SpeechBubble>
      <img
        class="pet__frame"
        :src="currentFrame"
        :alt="currentAsset.petName"
        draggable="false"
      />
    </div>

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
.pet-scene {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.pet {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  touch-action: none;
  cursor: grab;
}

.pet:active { cursor: grabbing; }

.pet__speech-bubble {
  position: absolute;
  top: 4px;
  left: 50%;
  z-index: 1;
  transform: translateX(-50%);
}

.pet__frame {
  display: block;
  width: calc(160px * var(--pet-scale, 1));
  height: calc(160px * var(--pet-scale, 1));
  pointer-events: none;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
</style>
