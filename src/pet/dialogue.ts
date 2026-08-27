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
  DialoguePriority,
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
  DialoguePriority,
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
  isPersistent: Readonly<Ref<boolean>>;
  currentPriority: Readonly<Ref<DialoguePriority | undefined>>;
  notify: (event: DialogueEvent) => boolean;
  hide: () => void;
  dispose: () => void;
}

type DialogueEventListener = (event: DialogueEvent) => boolean;
const dialogueEventListeners = new Set<DialogueEventListener>();

export { DEFAULT_DIALOGUE_CATALOG } from "./dialogueManager";

export function triggerDialogueEvent(
  type: DialogueEventType,
  options: TriggerDialogueEventOptions = {},
): boolean {
  const event: DialogueEvent = {
    type,
    ...options,
  };

  let shown = false;
  for (const listener of dialogueEventListeners) {
    shown = listener(event) || shown;
  }
  return shown;
}

export function useDialogue(
  options: DialogueOptions = {},
): DialogueController {
  const currentText = ref("");
  const isVisible = ref(false);
  const isPersistent = ref(false);
  const currentPriority = ref<DialoguePriority>();
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
    isPersistent.value = false;
    currentPriority.value = undefined;
  }

  function notify(event: DialogueEvent): boolean {
    if (disposed) {
      return false;
    }

    const incomingPriority = resolveDialoguePriority(event);
    if (
      isVisible.value
      && (
        incomingPriority === "low"
        || (
          currentPriority.value === "protected"
          && incomingPriority !== "protected"
        )
      )
    ) {
      return false;
    }

    const text = selectDialogueText(
      event,
      {
        ...dialogueManager.getCatalog(),
        ...options.catalog,
      },
      random,
    );

    if (!text) {
      return false;
    }

    clearHideTimer();
    currentText.value = text;
    isPersistent.value = event.persistent === true;
    currentPriority.value = incomingPriority;
    recordDialogueEvent(event.type);
    recordDialogueText(text);
    isVisible.value = true;
    if (isPersistent.value) {
      return true;
    }

    const displayDurationMs = Math.max(
      0,
      options.displayDurationMs ??
        settingsManager.settings.value.dialogue.bubbleDurationMs,
    );
    hideTimerId = setTimeout(hide, displayDurationMs);
    return true;
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
    isPersistent: readonly(isPersistent),
    currentPriority: readonly(currentPriority),
    notify,
    hide,
    dispose,
  };
}

function resolveDialoguePriority(event: DialogueEvent): DialoguePriority {
  return event.persistent ? "protected" : event.priority ?? "normal";
}

export function selectDialogueText(
  event: DialogueEvent,
  catalog: DialogueCatalog = dialogueManager.getCatalog(),
  random: () => number = Math.random,
): string | undefined {
  const textOverride = event.textOverride?.trim();
  if (textOverride) {
    return textOverride;
  }

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
