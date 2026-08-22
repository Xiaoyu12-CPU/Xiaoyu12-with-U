import {
  getCurrentScope,
  onScopeDispose,
  readonly,
  ref,
} from "vue";
import type { Ref } from "vue";
import type {
  DialogueEvent,
  DialogueEventType,
  TriggerDialogueEventOptions,
} from "./dialogueEvents";
import { dialogueManager } from "./dialogueManager";
import type { DialogueCatalog } from "./dialogueTypes";
import {
  recordDialogueEvent,
  recordDialogueText,
} from "./runtimeStatus";
import { settingsManager } from "../settings/settingsManager";

export type {
  DialogueEvent,
  DialogueEventType,
  PetInteractionEvent,
  TriggerDialogueEventOptions,
} from "./dialogueEvents";

export type { DialogueCatalog } from "./dialogueTypes";

export interface DialogueOptions {
  catalog?: DialogueCatalog;
  displayDurationMs?: number;
  random?: () => number;
}

export interface DialogueController {
  currentText: Readonly<Ref<string>>;
  isVisible: Readonly<Ref<boolean>>;
  notify: (event: DialogueEvent) => void;
  hide: () => void;
  dispose: () => void;
}

type DialogueEventListener = (event: DialogueEvent) => void;
const dialogueEventListeners = new Set<DialogueEventListener>();

export { DEFAULT_DIALOGUE_CATALOG } from "./dialogueManager";

export function triggerDialogueEvent(
  type: DialogueEventType,
  options: TriggerDialogueEventOptions = {},
): void {
  const event: DialogueEvent = {
    type,
    ...options,
  };

  recordDialogueEvent(type);

  for (const listener of dialogueEventListeners) {
    listener(event);
  }
}

export function useDialogue(
  options: DialogueOptions = {},
): DialogueController {
  const currentText = ref("");
  const isVisible = ref(false);
  void dialogueManager.initialize();
  void settingsManager.initialize();
  const random = options.random ?? Math.random;
  let hideTimerId: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function clearHideTimer(): void {
    if (hideTimerId !== undefined) {
      clearTimeout(hideTimerId);
      hideTimerId = undefined;
    }
  }

  function hide(): void {
    clearHideTimer();
    isVisible.value = false;
  }

  function notify(event: DialogueEvent): void {
    if (disposed) {
      return;
    }

    const text = selectDialogueText(
      event,
      {
        ...dialogueManager.getCatalog(),
        ...options.catalog,
      },
      random,
    );

    recordDialogueEvent(event.type);

    if (!text) {
      hide();
      return;
    }

    clearHideTimer();
    currentText.value = text;
    recordDialogueText(text);
    isVisible.value = true;
    const displayDurationMs = Math.max(
      0,
      options.displayDurationMs ??
        settingsManager.settings.value.dialogue.bubbleDurationMs,
    );
    hideTimerId = setTimeout(hide, displayDurationMs);
  }

  function dispose(): void {
    if (disposed) {
      return;
    }

    disposed = true;
    unsubscribeFromEvents();
    hide();
    currentText.value = "";
  }

  const unsubscribeFromEvents = subscribeToDialogueEvents(notify);

  if (getCurrentScope()) {
    onScopeDispose(dispose);
  }

  return {
    currentText: readonly(currentText),
    isVisible: readonly(isVisible),
    notify,
    hide,
    dispose,
  };
}

export function selectDialogueText(
  event: DialogueEvent,
  catalog: DialogueCatalog = dialogueManager.getCatalog(),
  random: () => number = Math.random,
): string | undefined {
  const candidates = catalog[event.type]?.filter(
    (text) => text.trim().length > 0,
  );

  if (!candidates?.length) {
    return undefined;
  }

  if (
    event.candidateIndex !== undefined &&
    Number.isInteger(event.candidateIndex) &&
    event.candidateIndex >= 0 &&
    event.candidateIndex < candidates.length
  ) {
    return candidates[event.candidateIndex];
  }

  const randomValue = Math.min(Math.max(random(), 0), 1 - Number.EPSILON);
  return candidates[Math.floor(randomValue * candidates.length)];
}

function subscribeToDialogueEvents(
  listener: DialogueEventListener,
): () => void {
  dialogueEventListeners.add(listener);
  return () => dialogueEventListeners.delete(listener);
}
