import { triggerDialogueEvent, useDialogue } from "./dialogue";
import type {
  DialogueController,
  DialogueOptions,
} from "./dialogue";
import {
  DIALOGUE_EVENT_TYPES,
  PET_INTERACTION_EVENT_TYPES,
} from "./dialogueEvents";
import type {
  DialogueEventType,
  PetInteractionEvent,
} from "./dialogueEvents";
import {
  BEHAVIOR_SOURCES,
  releaseState,
  requestState,
} from "./behavior";
import { tauriWindowDragAdapter } from "./windowDrag";
import type { WindowDragAdapter } from "./windowDrag";
import { settingsManager } from "../settings/settingsManager";
import { getCurrentScope, onScopeDispose } from "vue";

export interface PetInteractionOptions {
  dialogue?: DialogueOptions;
  windowDrag?: WindowDragAdapter;
}

export interface PetInteractionController {
  dialogue: DialogueController;
  handleInteraction: (event: PetInteractionEvent) => void;
  handleClick: () => void;
  handlePointerDown: (event: PointerEvent) => void;
  handlePointerMove: (event: PointerEvent) => void;
  handlePointerUp: (event: PointerEvent) => void;
  handlePointerCancel: (event: PointerEvent) => void;
}

const DRAG_ACTIVATION_DISTANCE_PX = 4;
const POST_DRAG_CLICK_SUPPRESSION_MS = 300;
const DRAG_END_DIALOGUE_DELAY_MS = 500;
const CLICK_BEHAVIOR_DURATION_MS = 1200;

const DIALOGUE_BY_INTERACTION: Readonly<
  Partial<Record<PetInteractionEvent, DialogueEventType>>
> = {
  [PET_INTERACTION_EVENT_TYPES.CLICK]: DIALOGUE_EVENT_TYPES.CLICK,
  [PET_INTERACTION_EVENT_TYPES.DRAG_START]: DIALOGUE_EVENT_TYPES.DRAG_START,
  [PET_INTERACTION_EVENT_TYPES.DRAG_END]: DIALOGUE_EVENT_TYPES.DRAG_END,
};

interface DragSession {
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
  captureTarget?: HTMLElement;
}

export function usePetInteraction(
  options: PetInteractionOptions = {},
): PetInteractionController {
  const dialogue = useDialogue(options.dialogue);
  const windowDrag = options.windowDrag ?? tauriWindowDragAdapter;
  void settingsManager.initialize();
  let dragSession: DragSession | undefined;
  let suppressClickUntil = 0;
  let dragEndDialogueTimer: ReturnType<typeof setTimeout> | undefined;

  function handleInteraction(event: PetInteractionEvent): void {
    if (
      event === PET_INTERACTION_EVENT_TYPES.CLICK ||
      event === PET_INTERACTION_EVENT_TYPES.DRAG_START
    ) {
      clearPendingDragEndDialogue();
    }

    updateBehavior(event);

    const dialogueEvent = DIALOGUE_BY_INTERACTION[event];

    if (!dialogueEvent || !isDialogueEnabled(event)) {
      return;
    }

    if (event === PET_INTERACTION_EVENT_TYPES.DRAG_END) {
      dragEndDialogueTimer = setTimeout(() => {
        dragEndDialogueTimer = undefined;
        triggerDialogueEvent(dialogueEvent);
      }, DRAG_END_DIALOGUE_DELAY_MS);
      return;
    }

    triggerDialogueEvent(dialogueEvent);
  }

  function updateBehavior(event: PetInteractionEvent): void {
    switch (event) {
      case PET_INTERACTION_EVENT_TYPES.CLICK:
        requestState({
          source: BEHAVIOR_SOURCES.INTERACTION_CLICK,
          state: "happy",
          durationMs: CLICK_BEHAVIOR_DURATION_MS,
        });
        return;
      case PET_INTERACTION_EVENT_TYPES.DRAG_START:
        requestState({
          source: BEHAVIOR_SOURCES.INTERACTION_DRAG,
          state: "dragging",
        });
        return;
      case PET_INTERACTION_EVENT_TYPES.DRAG_END:
        releaseState(BEHAVIOR_SOURCES.INTERACTION_DRAG);
        return;
      case PET_INTERACTION_EVENT_TYPES.DRAGGING:
        return;
    }
  }

  function isDialogueEnabled(event: PetInteractionEvent): boolean {
    const preferences = settingsManager.settings.value.dialogue;

    switch (event) {
      case PET_INTERACTION_EVENT_TYPES.CLICK:
        return preferences.enableClickDialogue;
      case PET_INTERACTION_EVENT_TYPES.DRAG_START:
      case PET_INTERACTION_EVENT_TYPES.DRAG_END:
        return preferences.enableDragDialogue;
      case PET_INTERACTION_EVENT_TYPES.DRAGGING:
        return false;
    }
  }

  function handleClick(): void {
    if (Date.now() < suppressClickUntil) {
      return;
    }

    handleInteraction(PET_INTERACTION_EVENT_TYPES.CLICK);
  }

  function handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0 || dragSession) {
      return;
    }

    const captureTarget = event.currentTarget as HTMLElement | null;

    dragSession = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      captureTarget: captureTarget ?? undefined,
    };
    observePointerRelease();

    captureTarget?.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent): void {
    const session = dragSession;

    if (
      !session ||
      session.pointerId !== event.pointerId ||
      session.active ||
      (event.buttons & 1) === 0
    ) {
      return;
    }

    const distance = Math.hypot(
      event.clientX - session.startX,
      event.clientY - session.startY,
    );

    if (distance < DRAG_ACTIVATION_DISTANCE_PX) {
      return;
    }

    session.active = true;
    handleInteraction(PET_INTERACTION_EVENT_TYPES.DRAG_START);
    handleInteraction(PET_INTERACTION_EVENT_TYPES.DRAGGING);

    // Tauri resolves after submitting the native drag request, not after release.
    void windowDrag.startDragging().catch((error: unknown) => {
      console.error("Failed to start native window dragging.", error);
    });
  }

  function handlePointerUp(event: PointerEvent): void {
    if (dragSession?.pointerId === event.pointerId) {
      finishDragSession();
    }
  }

  function handlePointerCancel(event: PointerEvent): void {
    const session = dragSession;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    if (session.active) {
      // Native drag ownership may cancel the WebView pointer stream. The
      // window-level release signal remains responsible for ending the session.
      return;
    }

    finishDragSession();
  }

  function handleGlobalMouseUp(event: MouseEvent): void {
    if (event.button === 0 && dragSession) {
      finishDragSession();
    }
  }

  function observePointerRelease(): void {
    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("mouseup", handleGlobalMouseUp, true);
  }

  function stopObservingPointerRelease(): void {
    window.removeEventListener("pointerup", handlePointerUp, true);
    window.removeEventListener("mouseup", handleGlobalMouseUp, true);
  }

  function finishDragSession(): void {
    const session = dragSession;

    if (!session) {
      return;
    }

    dragSession = undefined;
    stopObservingPointerRelease();

    if (session.captureTarget?.hasPointerCapture?.(session.pointerId)) {
      session.captureTarget.releasePointerCapture(session.pointerId);
    }

    if (session.active) {
      suppressClickUntil = Date.now() + POST_DRAG_CLICK_SUPPRESSION_MS;
      handleInteraction(PET_INTERACTION_EVENT_TYPES.DRAG_END);
    }
  }

  function clearPendingDragEndDialogue(): void {
    if (dragEndDialogueTimer !== undefined) {
      clearTimeout(dragEndDialogueTimer);
      dragEndDialogueTimer = undefined;
    }
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      dragSession = undefined;
      stopObservingPointerRelease();
      clearPendingDragEndDialogue();
      releaseState(BEHAVIOR_SOURCES.INTERACTION_DRAG);
    });
  }

  return {
    dialogue,
    handleInteraction,
    handleClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  };
}
