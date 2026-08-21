import { invoke } from "@tauri-apps/api/core";
import type { PetAnimationController } from "./animationEngine";
import { triggerDialogueEvent } from "./dialogue";
import { DIALOGUE_EVENT_TYPE_LIST } from "./dialogueEvents";
import type { DialogueEventType } from "./dialogueEvents";

export const PET_CONTROL_ACTION_TYPES = {
  OPEN_CONTROL_CENTER: "openControlCenter",
  TEST_EVENT: "testEvent",
  PAUSE_ANIMATION: "pauseAnimation",
  RESUME_ANIMATION: "resumeAnimation",
  EXIT: "exit",
} as const;

export type PetControlActionType =
  (typeof PET_CONTROL_ACTION_TYPES)[keyof typeof PET_CONTROL_ACTION_TYPES];

export interface PetControlAction {
  type: PetControlActionType;
  eventType?: DialogueEventType;
}

export interface PetControlController {
  execute: (action: PetControlAction) => Promise<void>;
}

export function createPetControl(
  animation: PetAnimationController,
): PetControlController {
  let nextTestEventIndex = 0;

  async function execute(action: PetControlAction): Promise<void> {
    switch (action.type) {
      case PET_CONTROL_ACTION_TYPES.OPEN_CONTROL_CENTER:
        await invoke("open_control_center");
        return;
      case PET_CONTROL_ACTION_TYPES.TEST_EVENT: {
        const eventType = action.eventType ?? DIALOGUE_EVENT_TYPE_LIST[
          nextTestEventIndex % DIALOGUE_EVENT_TYPE_LIST.length
        ];

        if (!action.eventType) {
          nextTestEventIndex += 1;
        }

        triggerDialogueEvent(eventType);
        return;
      }
      case PET_CONTROL_ACTION_TYPES.PAUSE_ANIMATION:
        animation.pause();
        return;
      case PET_CONTROL_ACTION_TYPES.RESUME_ANIMATION:
        animation.resume();
        return;
      case PET_CONTROL_ACTION_TYPES.EXIT:
        await invoke("exit_app");
    }
  }

  return { execute };
}
