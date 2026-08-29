<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  watch,
} from "vue";
import PetContextMenu from "../components/PetContextMenu.vue";
import ReminderFeedbackActions from "../components/ReminderFeedbackActions.vue";
import SpeechBubble from "../components/SpeechBubble.vue";
import { usePetAnimation } from "./animationEngine";
import {
  initializePetAssets,
  resolveCurrentPetAsset,
} from "./assetLoader";
import { triggerDialogueEvent } from "./dialogue";
import { DIALOGUE_EVENT_TYPES } from "./dialogueEvents";
import { usePetInteraction } from "./interaction";
import { useFollowPet } from "./followPet";
import { useOverlayWindowWatcher } from "./overlayWindowWatcher";
import { createPetControl } from "./petControl";
import type { PetControlActionType } from "./petControl";
import { usePetStore } from "./petStore";
import { useMainRuntimeBridge } from "./runtimeBridge";
import { updateAnimationRuntime, usePetRuntimeStatus } from "./runtimeStatus";
import { settingsManager } from "../settings/settingsManager";
import { tauriPetWindowSettingsAdapter } from "./windowSettings";
import {
  calculatePetWindowLayout,
  STATUS_BUBBLE_FALLBACK_SIZE,
} from "./windowLayout";
import type { PetWindowLayout } from "./windowLayout";
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

const { currentState } = usePetStore();
const currentAsset = computed(() =>
  resolveCurrentPetAsset(currentState.value),
);
const animation = usePetAnimation(currentAsset);
const { currentFrame, currentFrameIndex, isPaused } = animation;
const petControl = createPetControl(animation, {
  isAnimationEnabled: () =>
    settingsManager.settings.value.animation.enabled,
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
useFollowPet();
useOverlayWindowWatcher();
const { snapshot: runtimeSnapshot } = usePetRuntimeStatus();
const {
  dialogue,
  handleClick,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handlePointerCancel,
} = usePetInteraction();
useTypingFeedback();
const { currentText: dialogueText, isVisible: isDialogueVisible } = dialogue;
const showsReminderActions = computed(() => {
  const feedback = activeReminderFeedback.value;
  return Boolean(
    feedback
    && isDialogueVisible.value
    && dialogueText.value === feedback.text.trim(),
  );
});
const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
});
const bubbleSize = reactive<{ width: number; height: number }>({
  ...STATUS_BUBBLE_FALLBACK_SIZE,
});
const bubbleOffset = reactive({
  x: settingsManager.settings.value.systemStatusBubble.offsetX,
  y: settingsManager.settings.value.systemStatusBubble.offsetY,
});
const keyDisplayOffset = reactive({
  x: settingsManager.settings.value.input.keyDisplayOffsetX,
  y: settingsManager.settings.value.input.keyDisplayOffsetY,
});
const mouseVisualizerOffset = reactive({
  x: settingsManager.settings.value.input.mouseVisualizerOffsetX,
  y: settingsManager.settings.value.input.mouseVisualizerOffsetY,
});
const displayMode = computed(
  () => settingsManager.settings.value.systemStatusBubble.displayMode,
);
const showsPet = computed(() => displayMode.value !== "status-only");
const reservesKeyDisplay = computed(
  () => showsPet.value
    && settingsManager.settings.value.input.keyboardEnabled
    && settingsManager.settings.value.input.keyDisplayEnabled
    && runtimeSnapshot.value.keyboardStatus === "active",
);
const reservesMouseVisualizer = computed(
  () => showsPet.value
    && settingsManager.settings.value.input.mouseEnabled
    && settingsManager.settings.value.input.mouseVisualizerEnabled
    && runtimeSnapshot.value.mouseStatus === "active",
);
const windowLayout = computed(() =>
  calculatePetWindowLayout({
    displayMode: displayMode.value,
    petScale: settingsManager.settings.value.appearance.petScale,
    bubbleWidth: bubbleSize.width,
    bubbleHeight: bubbleSize.height,
    offsetX: bubbleOffset.x,
    offsetY: bubbleOffset.y,
    keyDisplayVisible: reservesKeyDisplay.value,
    keyDisplayPosition: settingsManager.settings.value.input.keyDisplayPosition,
    keyDisplayFlowDirection:
      settingsManager.settings.value.input.keyDisplayFlowDirection,
    keyDisplayMaxItems: settingsManager.settings.value.input.keyDisplayMaxItems,
    keyDisplayOffsetX: keyDisplayOffset.x,
    keyDisplayOffsetY: keyDisplayOffset.y,
    keyDisplayStartLineGapPx:
      settingsManager.settings.value.input.keyDisplayStartLineGapPx,
    mouseVisualizerVisible: reservesMouseVisualizer.value,
    mouseVisualizerPosition:
      settingsManager.settings.value.input.mouseVisualizerPosition,
    mouseVisualizerOffsetX: mouseVisualizerOffset.x,
    mouseVisualizerOffsetY: mouseVisualizerOffset.y,
  }),
);
const petStyle = computed(() => ({
  "--pet-scale": String(settingsManager.settings.value.appearance.petScale),
  left: `${windowLayout.value.petX}px`,
  top: `${windowLayout.value.petY}px`,
  width: `${windowLayout.value.petSize}px`,
  height: `${windowLayout.value.petSize}px`,
}));


let previousWindowLayout: PetWindowLayout | undefined;
let windowApplyQueue = Promise.resolve();

watch(
  () => settingsManager.settings.value.animation.enabled,
  (enabled) => {
    if (enabled) {
      animation.resume();
    } else {
      animation.pause();
    }
  },
  { immediate: true },
);




watch(
  () => [
    windowLayout.value.minX,
    windowLayout.value.minY,
    windowLayout.value.width,
    windowLayout.value.height,
    settingsManager.settings.value.appearance.petScale,
    settingsManager.settings.value.appearance.alwaysOnTop,
  ] as const,
  ([, , , , petScale, alwaysOnTop]) => {
    const nextLayout = { ...windowLayout.value };
    const previousLayout = previousWindowLayout;
    previousWindowLayout = nextLayout;

    const positionDeltaX = previousLayout
      ? nextLayout.minX - previousLayout.minX
      : 0;
    const positionDeltaY = previousLayout
      ? nextLayout.minY - previousLayout.minY
      : 0;

    windowApplyQueue = windowApplyQueue
      .then(() =>
        tauriPetWindowSettingsAdapter.apply({
          petScale,
          alwaysOnTop,
          layout: {
            width: nextLayout.width,
            height: nextLayout.height,
            positionDeltaX,
            positionDeltaY,
          },
        }),
      )
      .catch((windowError: unknown) => {
        console.error("Failed to apply pet window layout.", windowError);
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
  if (!occurrenceId) {
    return;
  }

  dismissReminderFeedback(occurrenceId, { hideDialogue: dialogue.hide });
}

async function handleReminderSnooze(minutes: SnoozeMinutes): Promise<void> {
  const occurrenceId = activeReminderFeedback.value?.occurrenceId;
  if (!occurrenceId) {
    return;
  }

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
  await Promise.all([
    initializePetAssets(),
    settingsManager.initialize(),
  ]);

  if (
    settingsManager.settings.value.dialogue
      .showDevelopmentMessageOnStartup
  ) {
    triggerDialogueEvent(DIALOGUE_EVENT_TYPES.DEVELOPMENT, {
      candidateIndex: 0,
    });
  }

});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", closeContextMenu);
});
</script>

<template>
  <div class="pet-scene">
    <div
      v-if="showsPet"
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

    <!-- 覆盖层已拆分为独立窗口: system-status / input-monitor -->

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
  position: absolute;
  display: grid;
  place-items: center;
  touch-action: none;
  cursor: grab;
}

.pet:active { cursor: grabbing; }

.pet-scene {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.pet__system-status { position: absolute; }

.pet__key-display {
  position: absolute;
  z-index: 2;
  pointer-events: none;
}

.pet__key-history-origin {
  position: absolute;
  z-index: 3;
}

.pet__mouse-visualizer {
  position: absolute;
  z-index: 3;
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
  width: calc(160px * var(--pet-scale, 1));
  height: calc(160px * var(--pet-scale, 1));
  pointer-events: none;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
</style>
