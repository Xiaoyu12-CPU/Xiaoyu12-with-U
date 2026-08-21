import { computed, readonly, ref } from "vue";
import type { DialogueEventType } from "./dialogueEvents";
import type { PetState } from "./types";

export type PetAnimationStatus = "playing" | "paused";

export interface PetRuntimeSnapshot {
  state: PetState;
  animationStatus: PetAnimationStatus;
  currentFrame: string;
  currentFrameIndex: number;
  lastEvent?: DialogueEventType;
  lastText: string;
  updatedAt: string;
}

const state = ref<PetState>("idle");
const animationStatus = ref<PetAnimationStatus>("playing");
const currentFrame = ref("");
const currentFrameIndex = ref(0);
const lastEvent = ref<DialogueEventType>();
const lastText = ref("");
const updatedAt = ref(new Date().toISOString());

const snapshot = computed<PetRuntimeSnapshot>(() => ({
  state: state.value,
  animationStatus: animationStatus.value,
  currentFrame: currentFrame.value,
  currentFrameIndex: currentFrameIndex.value,
  lastEvent: lastEvent.value,
  lastText: lastText.value,
  updatedAt: updatedAt.value,
}));

export function updateAnimationRuntime(input: {
  state: PetState;
  isPaused: boolean;
  currentFrame: string;
  currentFrameIndex: number;
}): void {
  state.value = input.state;
  animationStatus.value = input.isPaused ? "paused" : "playing";
  currentFrame.value = input.currentFrame;
  currentFrameIndex.value = input.currentFrameIndex;
  touch();
}

export function recordDialogueEvent(eventType: DialogueEventType): void {
  lastEvent.value = eventType;
  touch();
}

export function recordDialogueText(text: string): void {
  lastText.value = text;
  touch();
}

export function usePetRuntimeStatus() {
  return {
    snapshot: readonly(snapshot),
  };
}

function touch(): void {
  updatedAt.value = new Date().toISOString();
}
