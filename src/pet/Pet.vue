<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import PetContextMenu from "../components/PetContextMenu.vue";
import ReminderFeedbackActions from "../components/ReminderFeedbackActions.vue";
import SpeechBubble from "../components/SpeechBubble.vue";
import SystemStatusBubble from "../components/SystemStatusBubble.vue";
import KeyHistoryStack from "../components/KeyHistoryStack.vue";
import KeyHistoryStartLine from "../components/KeyHistoryStartLine.vue";
import MouseInputVisualizer from "../components/MouseInputVisualizer.vue";
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
import {
  openSystemMonitorSettings,
  useMainRuntimeBridge,
} from "./runtimeBridge";
import { updateAnimationRuntime, usePetRuntimeStatus } from "./runtimeStatus";
import { settingsManager } from "../settings/settingsManager";
import { tauriPetWindowSettingsAdapter } from "./windowSettings";
import { tauriWindowDragAdapter } from "./windowDrag";
import {
  calculatePetWindowLayout,
  clampStatusBubbleOffset,
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
import { createKeyHistoryDragController } from "../input/keyHistoryDrag";
import { createMouseVisualizerDragController } from "../input/mouseVisualizer";

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
const { snapshot: runtimeSnapshot } = usePetRuntimeStatus();
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
const showsStatusBubble = computed(() => displayMode.value !== "pet-only");
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
const statusBubbleStyle = computed(() => ({
  left: `${windowLayout.value.bubbleX}px`,
  top: `${windowLayout.value.bubbleY}px`,
}));
const keyDisplayStyle = computed(() => ({
  "--key-display-scale": String(windowLayout.value.keyDisplayScale),
  "--key-history-entry-width": `${windowLayout.value.keyDisplayEntryWidth}px`,
  left: `${windowLayout.value.keyDisplayX}px`,
  top: `${windowLayout.value.keyDisplayY}px`,
  width: `${windowLayout.value.keyDisplayWidth}px`,
  height: `${windowLayout.value.keyDisplayHeight}px`,
}));
const keyDisplayStartLineStyle = computed(() => ({
  left: `${windowLayout.value.keyDisplayOriginX}px`,
  top: `${windowLayout.value.keyDisplayOriginY}px`,
}));
const mouseVisualizerStyle = computed(() => ({
  left: `${windowLayout.value.mouseVisualizerX}px`,
  top: `${windowLayout.value.mouseVisualizerY}px`,
  width: `${windowLayout.value.mouseVisualizerWidth}px`,
  height: `${windowLayout.value.mouseVisualizerHeight}px`,
}));
const bubblePreferences = computed(
  () => settingsManager.settings.value.systemStatusBubble,
);

interface BubbleDragSession {
  pointerId: number;
  startScreenX: number;
  startScreenY: number;
  startOffsetX: number;
  startOffsetY: number;
  captureTarget?: HTMLElement;
}

const bubbleDragSession = ref<BubbleDragSession>();
const keyDisplayDragging = ref(false);
const keyDisplayCapture = ref<{
  pointerId: number;
  target?: HTMLElement;
}>();
const keyDisplayDragController = createKeyHistoryDragController({
  onPreview(offset) {
    keyDisplayOffset.x = offset.x;
    keyDisplayOffset.y = offset.y;
  },
  onCommit(offset) {
    keyDisplayOffset.x = offset.x;
    keyDisplayOffset.y = offset.y;
    settingsManager.update({
      input: {
        keyDisplayOffsetX: offset.x,
        keyDisplayOffsetY: offset.y,
      },
    });
  },
});
const mouseVisualizerDragging = ref(false);
const mouseVisualizerCapture = ref<{
  pointerId: number;
  target?: HTMLElement;
}>();
const mouseVisualizerDragController = createMouseVisualizerDragController({
  onPreview(offset) {
    mouseVisualizerOffset.x = offset.x;
    mouseVisualizerOffset.y = offset.y;
  },
  onCommit(offset) {
    mouseVisualizerOffset.x = offset.x;
    mouseVisualizerOffset.y = offset.y;
    settingsManager.update({
      input: {
        mouseVisualizerOffsetX: offset.x,
        mouseVisualizerOffsetY: offset.y,
      },
    });
  },
});
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
    settingsManager.settings.value.input.keyDisplayOffsetX,
    settingsManager.settings.value.input.keyDisplayOffsetY,
  ] as const,
  ([offsetX, offsetY]) => {
    if (!keyDisplayDragController.isDragging()) {
      keyDisplayOffset.x = offsetX;
      keyDisplayOffset.y = offsetY;
    }
  },
  { immediate: true },
);

watch(
  () => [
    settingsManager.settings.value.input.mouseVisualizerOffsetX,
    settingsManager.settings.value.input.mouseVisualizerOffsetY,
  ] as const,
  ([offsetX, offsetY]) => {
    if (!mouseVisualizerDragController.isDragging()) {
      mouseVisualizerOffset.x = offsetX;
      mouseVisualizerOffset.y = offsetY;
    }
  },
  { immediate: true },
);

watch(
  () => [
    settingsManager.settings.value.systemStatusBubble.offsetX,
    settingsManager.settings.value.systemStatusBubble.offsetY,
  ] as const,
  ([offsetX, offsetY]) => {
    if (!bubbleDragSession.value) {
      bubbleOffset.x = offsetX;
      bubbleOffset.y = offsetY;
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

function handleStatusBubbleSize(size: { width: number; height: number }): void {
  if (
    size.width <= 0 ||
    size.height <= 0 ||
    (size.width === bubbleSize.width && size.height === bubbleSize.height)
  ) {
    return;
  }

  bubbleSize.width = size.width;
  bubbleSize.height = size.height;
}

function handleOpenSystemMonitorSettings(): void {
  void openSystemMonitorSettings().catch((error: unknown) => {
    console.error("Failed to open System Monitor settings.", error);
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

function handleStatusBubblePointerDown(event: PointerEvent): void {
  if (event.button !== 0) {
    return;
  }

  if (displayMode.value === "status-only") {
    void tauriWindowDragAdapter.startDragging().catch((error: unknown) => {
      console.error("Failed to start status bubble window dragging.", error);
    });
    return;
  }

  if (displayMode.value !== "both" || bubbleDragSession.value) {
    return;
  }

  const captureTarget = event.currentTarget as HTMLElement | null;
  bubbleDragSession.value = {
    pointerId: event.pointerId,
    startScreenX: event.screenX,
    startScreenY: event.screenY,
    startOffsetX: bubbleOffset.x,
    startOffsetY: bubbleOffset.y,
    captureTarget: captureTarget ?? undefined,
  };
  captureTarget?.setPointerCapture?.(event.pointerId);
  window.addEventListener("pointerup", handleGlobalStatusBubblePointerUp, true);
}

function handleStatusBubblePointerMove(event: PointerEvent): void {
  const session = bubbleDragSession.value;
  if (!session || session.pointerId !== event.pointerId || (event.buttons & 1) === 0) {
    return;
  }

  bubbleOffset.x = clampStatusBubbleOffset(
    Math.round(session.startOffsetX + event.screenX - session.startScreenX),
  );
  bubbleOffset.y = clampStatusBubbleOffset(
    Math.round(session.startOffsetY + event.screenY - session.startScreenY),
  );
}

function handleStatusBubblePointerUp(event: PointerEvent): void {
  if (bubbleDragSession.value?.pointerId === event.pointerId) {
    finishStatusBubbleDrag();
  }
}

function handleStatusBubblePointerCancel(event: PointerEvent): void {
  if (bubbleDragSession.value?.pointerId === event.pointerId) {
    finishStatusBubbleDrag();
  }
}

function handleGlobalStatusBubblePointerUp(event: PointerEvent): void {
  handleStatusBubblePointerUp(event);
}

function finishStatusBubbleDrag(): void {
  const session = bubbleDragSession.value;
  if (!session) {
    return;
  }

  bubbleDragSession.value = undefined;
  window.removeEventListener("pointerup", handleGlobalStatusBubblePointerUp, true);
  if (session.captureTarget?.hasPointerCapture?.(session.pointerId)) {
    session.captureTarget.releasePointerCapture(session.pointerId);
  }

  settingsManager.update({
    systemStatusBubble: {
      offsetX: bubbleOffset.x,
      offsetY: bubbleOffset.y,
    },
  });
}

function handleKeyDisplayPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || keyDisplayDragController.isDragging()) {
    return;
  }

  const target = event.currentTarget as HTMLElement | null;
  if (!keyDisplayDragController.start({
    pointerId: event.pointerId,
    screenX: event.screenX,
    screenY: event.screenY,
    offset: { x: keyDisplayOffset.x, y: keyDisplayOffset.y },
  })) {
    return;
  }

  keyDisplayDragging.value = true;
  keyDisplayCapture.value = {
    pointerId: event.pointerId,
    target: target ?? undefined,
  };
  target?.setPointerCapture?.(event.pointerId);
  window.addEventListener("pointerup", handleGlobalKeyDisplayPointerUp, true);
}

function handleKeyDisplayPointerMove(event: PointerEvent): void {
  keyDisplayDragController.move(event.pointerId, event.screenX, event.screenY);
}

function handleKeyDisplayPointerUp(event: PointerEvent): void {
  if (keyDisplayCapture.value?.pointerId === event.pointerId) {
    finishKeyDisplayDrag(event.pointerId);
  }
}

function handleKeyDisplayPointerCancel(event: PointerEvent): void {
  if (keyDisplayCapture.value?.pointerId === event.pointerId) {
    finishKeyDisplayDrag(event.pointerId);
  }
}

function handleGlobalKeyDisplayPointerUp(event: PointerEvent): void {
  handleKeyDisplayPointerUp(event);
}

function finishKeyDisplayDrag(pointerId: number): void {
  const capture = keyDisplayCapture.value;
  if (!keyDisplayDragController.finish(pointerId)) {
    return;
  }

  keyDisplayDragging.value = false;
  keyDisplayCapture.value = undefined;
  window.removeEventListener("pointerup", handleGlobalKeyDisplayPointerUp, true);
  if (capture?.target?.hasPointerCapture?.(pointerId)) {
    capture.target.releasePointerCapture(pointerId);
  }
}

function handleMouseVisualizerPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || mouseVisualizerDragController.isDragging()) {
    return;
  }

  const target = event.currentTarget as HTMLElement | null;
  if (!mouseVisualizerDragController.start({
    pointerId: event.pointerId,
    screenX: event.screenX,
    screenY: event.screenY,
    offset: {
      x: mouseVisualizerOffset.x,
      y: mouseVisualizerOffset.y,
    },
  })) {
    return;
  }

  mouseVisualizerDragging.value = true;
  mouseVisualizerCapture.value = {
    pointerId: event.pointerId,
    target: target ?? undefined,
  };
  target?.setPointerCapture?.(event.pointerId);
  window.addEventListener("pointerup", handleGlobalMouseVisualizerPointerUp, true);
}

function handleMouseVisualizerPointerMove(event: PointerEvent): void {
  mouseVisualizerDragController.move(
    event.pointerId,
    event.screenX,
    event.screenY,
  );
}

function handleMouseVisualizerPointerUp(event: PointerEvent): void {
  if (mouseVisualizerCapture.value?.pointerId === event.pointerId) {
    finishMouseVisualizerDrag(event.pointerId);
  }
}

function handleMouseVisualizerPointerCancel(event: PointerEvent): void {
  if (mouseVisualizerCapture.value?.pointerId === event.pointerId) {
    finishMouseVisualizerDrag(event.pointerId);
  }
}

function handleGlobalMouseVisualizerPointerUp(event: PointerEvent): void {
  handleMouseVisualizerPointerUp(event);
}

function finishMouseVisualizerDrag(pointerId: number): void {
  const capture = mouseVisualizerCapture.value;
  if (!mouseVisualizerDragController.finish(pointerId)) {
    return;
  }

  mouseVisualizerDragging.value = false;
  mouseVisualizerCapture.value = undefined;
  window.removeEventListener(
    "pointerup",
    handleGlobalMouseVisualizerPointerUp,
    true,
  );
  if (capture?.target?.hasPointerCapture?.(pointerId)) {
    capture.target.releasePointerCapture(pointerId);
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
  window.removeEventListener("pointerup", handleGlobalStatusBubblePointerUp, true);
  window.removeEventListener("pointerup", handleGlobalKeyDisplayPointerUp, true);
  window.removeEventListener(
    "pointerup",
    handleGlobalMouseVisualizerPointerUp,
    true,
  );
  keyDisplayDragController.abort();
  mouseVisualizerDragController.abort();
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

    <KeyHistoryStack
      v-if="reservesKeyDisplay"
      class="pet__key-display"
      :style="keyDisplayStyle"
      :pressed-keys="runtimeSnapshot.pressedKeys"
      :keyboard-enabled="settingsManager.settings.value.input.keyboardEnabled"
      :key-display-enabled="settingsManager.settings.value.input.keyDisplayEnabled"
      :keyboard-status="runtimeSnapshot.keyboardStatus"
      :max-items="settingsManager.settings.value.input.keyDisplayMaxItems"
      :duration-ms="settingsManager.settings.value.input.keyDisplayDurationMs"
      :persistent="settingsManager.settings.value.input.keyDisplayPersistent"
      :position="settingsManager.settings.value.input.keyDisplayPosition"
      :flow-direction="settingsManager.settings.value.input.keyDisplayFlowDirection"
    />

    <KeyHistoryStartLine
      v-if="reservesKeyDisplay"
      class="pet__key-history-origin"
      :style="keyDisplayStartLineStyle"
      :color="settingsManager.settings.value.input.keyDisplayStartLineColor"
      :opacity="settingsManager.settings.value.input.keyDisplayStartLineOpacity"
      :dragging="keyDisplayDragging"
      @pointer-down="handleKeyDisplayPointerDown"
      @pointer-move="handleKeyDisplayPointerMove"
      @pointer-up="handleKeyDisplayPointerUp"
      @pointer-cancel="handleKeyDisplayPointerCancel"
    />

    <MouseInputVisualizer
      v-if="reservesMouseVisualizer"
      class="pet__mouse-visualizer"
      :style="mouseVisualizerStyle"
      :mouse-enabled="settingsManager.settings.value.input.mouseEnabled"
      :visualizer-enabled="settingsManager.settings.value.input.mouseVisualizerEnabled"
      :mouse-status="runtimeSnapshot.mouseStatus"
      :pressed-buttons="runtimeSnapshot.pressedMouseButtons"
      :last-scroll-direction="runtimeSnapshot.lastScrollDirection"
      :last-scroll-at="runtimeSnapshot.lastScrollAt"
      :body-color="settingsManager.settings.value.input.mouseVisualizerBodyColor"
      :body-opacity="settingsManager.settings.value.input.mouseVisualizerBodyOpacity"
      :button-color="settingsManager.settings.value.input.mouseVisualizerButtonColor"
      :button-opacity="settingsManager.settings.value.input.mouseVisualizerButtonOpacity"
      :outline-color="settingsManager.settings.value.input.mouseVisualizerOutlineColor"
      :outline-opacity="settingsManager.settings.value.input.mouseVisualizerOutlineOpacity"
      :outline-width="settingsManager.settings.value.input.mouseVisualizerOutlineWidth"
      :active-color="settingsManager.settings.value.input.mouseVisualizerActiveColor"
      :active-opacity="settingsManager.settings.value.input.mouseVisualizerActiveOpacity"
      :dragging="mouseVisualizerDragging"
      @pointer-down="handleMouseVisualizerPointerDown"
      @pointer-move="handleMouseVisualizerPointerMove"
      @pointer-up="handleMouseVisualizerPointerUp"
      @pointer-cancel="handleMouseVisualizerPointerCancel"
    />

    <SystemStatusBubble
      v-if="showsStatusBubble"
      class="pet__system-status"
      :style="statusBubbleStyle"
      :snapshot="runtimeSnapshot"
      :background-color="bubblePreferences.backgroundColor"
      :background-opacity="bubblePreferences.backgroundOpacity"
      :text-color="bubblePreferences.textColor"
      :border-color="bubblePreferences.borderColor"
      :border-width="bubblePreferences.borderWidth"
      :panel-width="bubblePreferences.panelWidth"
      :panel-scale="bubblePreferences.panelScale"
      :visible-items="bubblePreferences.visibleItems"
      :window-drag-handle="displayMode === 'status-only'"
      @pointer-down="handleStatusBubblePointerDown"
      @pointer-move="handleStatusBubblePointerMove"
      @pointer-up="handleStatusBubblePointerUp"
      @pointer-cancel="handleStatusBubblePointerCancel"
      @context-menu="openContextMenu"
      @size-change="handleStatusBubbleSize"
      @open-system-monitor-settings="handleOpenSystemMonitorSettings"
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
