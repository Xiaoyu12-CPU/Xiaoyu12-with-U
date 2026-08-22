export const PET_INTERACTION_EVENT_TYPES = {
  CLICK: "click",
  DRAG_START: "dragStart",
  DRAGGING: "dragging",
  DRAG_END: "dragEnd",
} as const;

export const DIALOGUE_EVENT_TYPES = {
  CLICK: PET_INTERACTION_EVENT_TYPES.CLICK,
  /** Legacy catalog keys retained for existing dialogue.json files. */
  HOVER_ENTER: "hoverEnter",
  HOVER_LEAVE: "hoverLeave",
  DRAG_START: "drag.start",
  DRAG_END: "drag.end",
  DEVELOPMENT: "development",
  SYSTEM_CPU_HIGH: "system.cpu.high",
  SYSTEM_CPU_NORMAL: "system.cpu.normal",
  SYSTEM_MEMORY_HIGH: "system.memory.high",
  SYSTEM_MEMORY_NORMAL: "system.memory.normal",
  REMINDER: "reminder",
  KEYBOARD_ACTIVITY: "keyboard.activity",
} as const;

export type DialogueEventType =
  (typeof DIALOGUE_EVENT_TYPES)[keyof typeof DIALOGUE_EVENT_TYPES];

export const DIALOGUE_EVENT_TYPE_LIST = [
  DIALOGUE_EVENT_TYPES.DEVELOPMENT,
  DIALOGUE_EVENT_TYPES.CLICK,
  DIALOGUE_EVENT_TYPES.HOVER_ENTER,
  DIALOGUE_EVENT_TYPES.HOVER_LEAVE,
  DIALOGUE_EVENT_TYPES.DRAG_START,
  DIALOGUE_EVENT_TYPES.DRAG_END,
  DIALOGUE_EVENT_TYPES.SYSTEM_CPU_HIGH,
  DIALOGUE_EVENT_TYPES.SYSTEM_CPU_NORMAL,
  DIALOGUE_EVENT_TYPES.SYSTEM_MEMORY_HIGH,
  DIALOGUE_EVENT_TYPES.SYSTEM_MEMORY_NORMAL,
  DIALOGUE_EVENT_TYPES.REMINDER,
  DIALOGUE_EVENT_TYPES.KEYBOARD_ACTIVITY,
] as const satisfies readonly DialogueEventType[];

export const ACTIVE_DIALOGUE_EVENT_TYPE_LIST = [
  DIALOGUE_EVENT_TYPES.DEVELOPMENT,
  DIALOGUE_EVENT_TYPES.CLICK,
  DIALOGUE_EVENT_TYPES.DRAG_START,
  DIALOGUE_EVENT_TYPES.DRAG_END,
  DIALOGUE_EVENT_TYPES.SYSTEM_CPU_HIGH,
  DIALOGUE_EVENT_TYPES.SYSTEM_CPU_NORMAL,
  DIALOGUE_EVENT_TYPES.SYSTEM_MEMORY_HIGH,
  DIALOGUE_EVENT_TYPES.SYSTEM_MEMORY_NORMAL,
  DIALOGUE_EVENT_TYPES.REMINDER,
  DIALOGUE_EVENT_TYPES.KEYBOARD_ACTIVITY,
] as const satisfies readonly DialogueEventType[];

export type PetInteractionEvent =
  (typeof PET_INTERACTION_EVENT_TYPES)[keyof typeof PET_INTERACTION_EVENT_TYPES];

export interface DialogueEvent {
  type: DialogueEventType;
  context?: Readonly<Record<string, unknown>>;
  candidateIndex?: number;
}

export interface TriggerDialogueEventOptions {
  context?: Readonly<Record<string, unknown>>;
  candidateIndex?: number;
}
