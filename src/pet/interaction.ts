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
import { usePetStore } from "./petStore";
import type { PetState } from "./types";
import { tauriWindowDragAdapter } from "./windowDrag";
import type { WindowDragAdapter } from "./windowDrag";

export interface PetInteractionOptions {
  dialogue?: DialogueOptions;
  windowDrag?: WindowDragAdapter;
}

export interface PetInteractionController {
  dialogue: DialogueController;
  handleInteraction: (event: PetInteractionEvent) => void;
  handleClick: () => void;
  handleHoverEnter: () => void;
  handleHoverLeave: () => void;
  handlePointerDown: (event: PointerEvent) => void;
  handlePointerMove: (event: PointerEvent) => void;
  handlePointerUp: (event: PointerEvent) => void;
  handlePointerCancel: (event: PointerEvent) => void;
}

const DRAG_ACTIVATION_DISTANCE_PX = 4;
const POST_DRAG_CLICK_SUPPRESSION_MS = 300;

const STATE_BY_INTERACTION: Readonly<Record<PetInteractionEvent, PetState>> = {
  [PET_INTERACTION_EVENT_TYPES.CLICK]: "happy",
  [PET_INTERACTION_EVENT_TYPES.HOVER_ENTER]: "alert",
  [PET_INTERACTION_EVENT_TYPES.HOVER_LEAVE]: "idle",
  [PET_INTERACTION_EVENT_TYPES.DRAG_START]: "dragging",
  [PET_INTERACTION_EVENT_TYPES.DRAGGING]: "dragging",
  [PET_INTERACTION_EVENT_TYPES.DRAG_END]: "idle",
};

const DIALOGUE_BY_INTERACTION: Readonly<
  Partial<Record<PetInteractionEvent, DialogueEventType>>
> = {
  [PET_INTERACTION_EVENT_TYPES.CLICK]: DIALOGUE_EVENT_TYPES.CLICK,
  [PET_INTERACTION_EVENT_TYPES.HOVER_ENTER]:
    DIALOGUE_EVENT_TYPES.HOVER_ENTER,
  [PET_INTERACTION_EVENT_TYPES.HOVER_LEAVE]:
    DIALOGUE_EVENT_TYPES.HOVER_LEAVE,
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
  const { currentState, setState } = usePetStore();
  const dialogue = useDialogue(options.dialogue);
  const windowDrag = options.windowDrag ?? tauriWindowDragAdapter;
  let dragSession: DragSession | undefined;
  let suppressClickUntil = 0;

  function handleInteraction(event: PetInteractionEvent): void {
    if (
      (event === PET_INTERACTION_EVENT_TYPES.HOVER_ENTER ||
        event === PET_INTERACTION_EVENT_TYPES.HOVER_LEAVE) &&
      dragSession?.active
    ) {
      return;
    }

    const nextState = STATE_BY_INTERACTION[event];

    if (currentState.value !== nextState) {
      setState(nextState);
    }

    const dialogueEvent = DIALOGUE_BY_INTERACTION[event];

    if (dialogueEvent) {
      triggerDialogueEvent(dialogueEvent);
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

    void windowDrag
      .startDragging()
      .catch((error: unknown) => {
        console.error("Failed to start native window dragging.", error);
      })
      .finally(finishDragSession);
  }

  function handlePointerUp(event: PointerEvent): void {
    if (dragSession?.pointerId === event.pointerId) {
      finishDragSession();
    }
  }

  function handlePointerCancel(event: PointerEvent): void {
    if (dragSession?.pointerId === event.pointerId) {
      finishDragSession();
    }
  }

  function finishDragSession(): void {
    const session = dragSession;

    if (!session) {
      return;
    }

    dragSession = undefined;

    if (session.captureTarget?.hasPointerCapture?.(session.pointerId)) {
      session.captureTarget.releasePointerCapture(session.pointerId);
    }

    if (session.active) {
      suppressClickUntil = Date.now() + POST_DRAG_CLICK_SUPPRESSION_MS;
      handleInteraction(PET_INTERACTION_EVENT_TYPES.DRAG_END);
    }
  }

  return {
    dialogue,
    handleInteraction,
    handleClick,
    handleHoverEnter: () =>
      handleInteraction(PET_INTERACTION_EVENT_TYPES.HOVER_ENTER),
    handleHoverLeave: () =>
      handleInteraction(PET_INTERACTION_EVENT_TYPES.HOVER_LEAVE),
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  };
}
