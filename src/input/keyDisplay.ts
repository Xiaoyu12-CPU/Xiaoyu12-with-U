import type {
  KeyDisplayFlowDirection,
  KeyDisplayPosition,
} from "../settings/settingsTypes";
import type { KeyboardMonitorStatus } from "./types";

export const KEY_DISPLAY_MAX_KEYS = 5;
export const KEY_DISPLAY_MIN_ITEMS = 1;
export const KEY_DISPLAY_MAX_ITEMS = 8;
export const KEY_DISPLAY_MIN_DURATION_MS = 500;
export const KEY_DISPLAY_MAX_DURATION_MS = 10000;

const KEY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  Control: "⌃",
  Option: "⌥",
  Shift: "⇧",
  Command: "⌘",
  Space: "Space",
  Enter: "↵",
  Escape: "Esc",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Backspace: "⌫",
  Tab: "Tab",
});

const MODIFIER_ORDER: Readonly<Record<string, number>> = Object.freeze({
  Control: 0,
  Option: 1,
  Shift: 2,
  Command: 3,
});

export type ResolvedKeyDisplayFlowDirection = Exclude<
  KeyDisplayFlowDirection,
  "auto"
>;
export type KeyHistoryAxis = "vertical" | "horizontal";
export interface KeyHistoryStackAlignment {
  justifyContent: "flex-start" | "flex-end";
  alignItems: "flex-start" | "center" | "flex-end";
}

export interface KeyDisplayModel {
  keycaps: readonly string[];
  overflowCount: number;
}

export interface KeyDisplayEntry {
  id: string;
  keys: readonly string[];
  label: string;
  createdAt: number;
}

export interface KeyHistorySnapshot {
  entries: readonly KeyDisplayEntry[];
}

export interface KeyHistoryInput {
  pressedKeys: readonly string[];
  keyboardEnabled: boolean;
  keyDisplayEnabled: boolean;
  keyboardStatus: KeyboardMonitorStatus;
  maxItems: number;
  durationMs: number;
  persistent: boolean;
}

export interface KeyHistoryController {
  update: (input: KeyHistoryInput) => void;
  getSnapshot: () => KeyHistorySnapshot;
  clear: () => void;
  dispose: () => void;
}

interface KeyHistoryControllerDependencies {
  onChange?: (snapshot: KeyHistorySnapshot) => void;
  now?: () => number;
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

export function formatDisplayKey(key: string): string {
  if (/^Unknown\(.*\)$/.test(key)) {
    return "?";
  }

  return KEY_LABELS[key] ?? key;
}

export function buildKeyDisplayModel(keys: readonly string[]): KeyDisplayModel {
  const sorted = [...new Set(keys)].sort(compareKeys);
  if (sorted.length <= KEY_DISPLAY_MAX_KEYS) {
    return {
      keycaps: sorted.map(formatDisplayKey),
      overflowCount: 0,
    };
  }

  const visibleKeyCount = KEY_DISPLAY_MAX_KEYS - 1;
  const overflowCount = sorted.length - visibleKeyCount;
  return {
    keycaps: [
      ...sorted.slice(0, visibleKeyCount).map(formatDisplayKey),
      `+${overflowCount}`,
    ],
    overflowCount,
  };
}

export function resolveKeyDisplayFlowDirection(
  position: KeyDisplayPosition,
  flowDirection: KeyDisplayFlowDirection,
): ResolvedKeyDisplayFlowDirection {
  if (flowDirection !== "auto") {
    return flowDirection;
  }

  if (position === "top") return "up";
  if (position === "bottom") return "down";
  return position;
}

export function keyHistoryAxis(
  flowDirection: ResolvedKeyDisplayFlowDirection,
): KeyHistoryAxis {
  return flowDirection === "up" || flowDirection === "down"
    ? "vertical"
    : "horizontal";
}

export function keyHistoryStackAlignment(
  _position: KeyDisplayPosition,
  flowDirection: ResolvedKeyDisplayFlowDirection,
): KeyHistoryStackAlignment {
  return {
    justifyContent:
    flowDirection === "up" || flowDirection === "left"
      ? "flex-end"
      : "flex-start",
    alignItems: "center",
  };
}

export function createKeyHistoryController(
  dependencies: KeyHistoryControllerDependencies = {},
): KeyHistoryController {
  const onChange = dependencies.onChange ?? (() => {});
  const now = dependencies.now ?? Date.now;
  const setTimer = dependencies.setTimer ?? setTimeout;
  const clearTimer = dependencies.clearTimer ?? clearTimeout;
  const expirationTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const modifierParticipation = new Map<string, boolean>();
  let entries: KeyDisplayEntry[] = [];
  let previousPressedKeys = new Set<string>();
  let currentInput: KeyHistoryInput | undefined;
  let sequence = 0;
  let disposed = false;

  function snapshot(): KeyHistorySnapshot {
    return {
      entries: entries.map((entry) => ({ ...entry, keys: [...entry.keys] })),
    };
  }

  function publish(): void {
    onChange(snapshot());
  }

  function cancelExpiration(entryId: string): void {
    const timer = expirationTimers.get(entryId);
    if (timer !== undefined) {
      clearTimer(timer);
      expirationTimers.delete(entryId);
    }
  }

  function cancelAllExpirations(): void {
    for (const timer of expirationTimers.values()) {
      clearTimer(timer);
    }
    expirationTimers.clear();
  }

  function expireEntry(entryId: string): void {
    expirationTimers.delete(entryId);
    const nextEntries = entries.filter(({ id }) => id !== entryId);
    if (nextEntries.length !== entries.length) {
      entries = nextEntries;
      publish();
    }
  }

  function scheduleExpiration(entry: KeyDisplayEntry, durationMs: number): void {
    cancelExpiration(entry.id);
    expirationTimers.set(
      entry.id,
      setTimer(() => expireEntry(entry.id), durationMs),
    );
  }

  function trimToMaxItems(maxItems: number): void {
    const excess = entries.length - maxItems;
    if (excess <= 0) return;

    const removed = entries.slice(0, excess);
    for (const entry of removed) {
      cancelExpiration(entry.id);
    }
    entries = entries.slice(excess);
  }

  function addEntry(keys: readonly string[]): void {
    if (!currentInput || disposed) return;

    const normalizedKeys = [...new Set(keys)].sort(compareKeys);
    const model = buildKeyDisplayModel(normalizedKeys);
    const createdAt = now();
    const entry: KeyDisplayEntry = {
      id: `key-entry-${createdAt}-${++sequence}`,
      keys: normalizedKeys,
      label: model.keycaps.join(" "),
      createdAt,
    };
    entries = [...entries, entry];
    trimToMaxItems(currentInput.maxItems);
    if (!currentInput.persistent && entries.some(({ id }) => id === entry.id)) {
      scheduleExpiration(entry, currentInput.durationMs);
    }
    publish();
  }

  function clear(): void {
    cancelAllExpirations();
    entries = [];
    previousPressedKeys.clear();
    modifierParticipation.clear();
    publish();
  }

  function processPressedKeys(nextPressedKeys: readonly string[]): void {
    const next = new Set(nextPressedKeys);
    const added = nextPressedKeys.filter((key) => !previousPressedKeys.has(key));
    const removed = [...previousPressedKeys].filter((key) => !next.has(key));

    for (const key of added) {
      if (isModifierKey(key)) {
        modifierParticipation.set(key, false);
        continue;
      }

      const modifiers = [...next].filter(isModifierKey).sort(compareKeys);
      for (const modifier of modifiers) {
        modifierParticipation.set(modifier, true);
      }
      addEntry([...modifiers, key]);
    }

    for (const key of removed) {
      if (isModifierKey(key)) {
        if (modifierParticipation.get(key) === false) {
          addEntry([key]);
        }
        modifierParticipation.delete(key);
      } else if (key === "CapsLock") {
        // CGEventTap exposes CapsLock as a toggled flag. Removing that flag is
        // the next physical CapsLock press, so it is another display entry.
        addEntry([key]);
      }
    }

    previousPressedKeys = next;
  }

  function update(input: KeyHistoryInput): void {
    if (disposed) return;

    const normalizedInput: KeyHistoryInput = {
      ...input,
      maxItems: clampInteger(
        input.maxItems,
        KEY_DISPLAY_MIN_ITEMS,
        KEY_DISPLAY_MAX_ITEMS,
      ),
      durationMs: clampInteger(
        input.durationMs,
        KEY_DISPLAY_MIN_DURATION_MS,
        KEY_DISPLAY_MAX_DURATION_MS,
      ),
    };
    const canDisplay = normalizedInput.keyboardEnabled
      && normalizedInput.keyDisplayEnabled
      && normalizedInput.keyboardStatus === "active";
    if (!canDisplay) {
      currentInput = normalizedInput;
      if (
        entries.length > 0
        || previousPressedKeys.size > 0
        || expirationTimers.size > 0
      ) {
        clear();
      }
      return;
    }

    const previousInput = currentInput;
    currentInput = normalizedInput;
    if (previousInput) {
      if (!previousInput.persistent && normalizedInput.persistent) {
        cancelAllExpirations();
      } else if (
        (previousInput.persistent && !normalizedInput.persistent)
        || (!normalizedInput.persistent
          && previousInput.durationMs !== normalizedInput.durationMs)
      ) {
        cancelAllExpirations();
        for (const entry of entries) {
          scheduleExpiration(entry, normalizedInput.durationMs);
        }
      }
    }

    const previousLength = entries.length;
    trimToMaxItems(normalizedInput.maxItems);
    if (entries.length !== previousLength) publish();
    processPressedKeys(normalizedInput.pressedKeys);
  }

  function dispose(): void {
    disposed = true;
    cancelAllExpirations();
    entries = [];
    previousPressedKeys.clear();
    modifierParticipation.clear();
  }

  return {
    update,
    getSnapshot: snapshot,
    clear,
    dispose,
  };
}

function isModifierKey(key: string): boolean {
  return MODIFIER_ORDER[key] !== undefined;
}

function compareKeys(left: string, right: string): number {
  const leftModifier = MODIFIER_ORDER[left];
  const rightModifier = MODIFIER_ORDER[right];
  if (leftModifier !== undefined || rightModifier !== undefined) {
    if (leftModifier === undefined) return 1;
    if (rightModifier === undefined) return -1;
    return leftModifier - rightModifier;
  }

  return left.localeCompare(right, "en", { numeric: true });
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.round(Math.min(Math.max(value, minimum), maximum));
}
