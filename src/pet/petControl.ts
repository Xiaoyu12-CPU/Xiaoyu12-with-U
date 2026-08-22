import { invoke } from "@tauri-apps/api/core";
import type { PetAnimationController } from "./animationEngine";
import {
  BEHAVIOR_SOURCES,
  releaseState,
  requestState,
} from "./behavior";
import { triggerDialogueEvent } from "./dialogue";
import { ACTIVE_DIALOGUE_EVENT_TYPE_LIST } from "./dialogueEvents";
import type { DialogueEventType } from "./dialogueEvents";

export const PET_CONTROL_ACTION_TYPES = {
  OPEN_CONTROL_CENTER: "openControlCenter",
  TEST_EVENT: "testEvent",
  PAUSE_ANIMATION: "pauseAnimation",
  RESUME_ANIMATION: "resumeAnimation",
  DEBUG_REQUEST_TIRED: "debugRequestTired",
  DEBUG_RELEASE_TIRED: "debugReleaseTired",
  DEBUG_REQUEST_WORKING: "debugRequestWorking",
  DEBUG_RELEASE_WORKING: "debugReleaseWorking",
  DEBUG_REQUEST_ALERT: "debugRequestAlert",
  DEBUG_RELEASE_ALERT: "debugReleaseAlert",
  DEBUG_CLEAR_BEHAVIORS: "debugClearBehaviors",
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

export interface PetControlOptions {
  isAnimationEnabled?: () => boolean;
}

export function createPetControl(
  animation: PetAnimationController,
  options: PetControlOptions = {},
): PetControlController {
  let nextTestEventIndex = 0;

  async function execute(action: PetControlAction): Promise<void> {
    switch (action.type) {
      case PET_CONTROL_ACTION_TYPES.OPEN_CONTROL_CENTER:
        await invoke("open_control_center");
        return;
      case PET_CONTROL_ACTION_TYPES.TEST_EVENT: {
        const eventType = action.eventType ?? ACTIVE_DIALOGUE_EVENT_TYPE_LIST[
          nextTestEventIndex % ACTIVE_DIALOGUE_EVENT_TYPE_LIST.length
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
        if (options.isAnimationEnabled?.() ?? true) {
          animation.resume();
        }
        return;
      case PET_CONTROL_ACTION_TYPES.DEBUG_REQUEST_TIRED:
        requestState({
          source: BEHAVIOR_SOURCES.DEVELOPMENT_TIRED,
          state: "tired",
        });
        return;
      case PET_CONTROL_ACTION_TYPES.DEBUG_RELEASE_TIRED:
        releaseState(BEHAVIOR_SOURCES.DEVELOPMENT_TIRED);
        return;
      case PET_CONTROL_ACTION_TYPES.DEBUG_REQUEST_WORKING:
        requestState({
          source: BEHAVIOR_SOURCES.DEVELOPMENT_WORKING,
          state: "working",
        });
        return;
      case PET_CONTROL_ACTION_TYPES.DEBUG_RELEASE_WORKING:
        releaseState(BEHAVIOR_SOURCES.DEVELOPMENT_WORKING);
        return;
      case PET_CONTROL_ACTION_TYPES.DEBUG_REQUEST_ALERT:
        requestState({
          source: BEHAVIOR_SOURCES.DEVELOPMENT_ALERT,
          state: "alert",
          durationMs: 5000,
        });
        return;
      case PET_CONTROL_ACTION_TYPES.DEBUG_RELEASE_ALERT:
        releaseState(BEHAVIOR_SOURCES.DEVELOPMENT_ALERT);
        return;
      case PET_CONTROL_ACTION_TYPES.DEBUG_CLEAR_BEHAVIORS:
        releaseState(BEHAVIOR_SOURCES.DEVELOPMENT_TIRED);
        releaseState(BEHAVIOR_SOURCES.DEVELOPMENT_WORKING);
        releaseState(BEHAVIOR_SOURCES.DEVELOPMENT_ALERT);
        return;
      case PET_CONTROL_ACTION_TYPES.EXIT:
        await invoke("exit_app");
    }
  }

  return { execute };
}
