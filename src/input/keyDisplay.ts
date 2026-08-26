import type { KeyboardMonitorStatus } from "./types";

export const KEY_DISPLAY_HIDE_DELAY_MS = 800;
export const KEY_DISPLAY_MAX_KEYS = 5;

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

export interface KeyDisplayModel {
  keycaps: readonly string[];
  overflowCount: number;
}

export interface KeyDisplaySnapshot extends KeyDisplayModel {
  visible: boolean;
}

export interface KeyDisplayInput {
  pressedKeys: readonly string[];
  keyboardEnabled: boolean;
  keyDisplayEnabled: boolean;
  keyboardStatus: KeyboardMonitorStatus;
}

export interface KeyDisplayController {
  update: (input: KeyDisplayInput) => void;
  getSnapshot: () => KeyDisplaySnapshot;
  dispose: () => void;
}

interface KeyDisplayControllerDependencies {
  onChange?: (snapshot: KeyDisplaySnapshot) => void;
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

export function formatDisplayKey(key: string): string {
  if (/^Unknown\(.*\)$/.test(key)) {
    return "?";
  }

  return KEY_LABELS[key] ?? key;
}

export function buildKeyDisplayModel(
  pressedKeys: readonly string[],
): KeyDisplayModel {
  const sorted = [...new Set(pressedKeys)].sort(compareKeys);
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

export function createKeyDisplayController(
  dependencies: KeyDisplayControllerDependencies = {},
): KeyDisplayController {
  const onChange = dependencies.onChange ?? (() => {});
  const setTimer = dependencies.setTimer ?? setTimeout;
  const clearTimer = dependencies.clearTimer ?? clearTimeout;
  let snapshot: KeyDisplaySnapshot = {
    visible: false,
    keycaps: [],
    overflowCount: 0,
  };
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  function publish(next: KeyDisplaySnapshot): void {
    snapshot = next;
    onChange({ ...next, keycaps: [...next.keycaps] });
  }

  function cancelPendingHide(): void {
    if (hideTimer !== undefined) {
      clearTimer(hideTimer);
      hideTimer = undefined;
    }
  }

  function hideImmediately(): void {
    cancelPendingHide();
    if (snapshot.visible || snapshot.keycaps.length > 0) {
      publish({ visible: false, keycaps: [], overflowCount: 0 });
    }
  }

  function update(input: KeyDisplayInput): void {
    const canDisplay = input.keyboardEnabled
      && input.keyDisplayEnabled
      && input.keyboardStatus === "active";
    if (!canDisplay) {
      hideImmediately();
      return;
    }

    if (input.pressedKeys.length > 0) {
      cancelPendingHide();
      publish({ visible: true, ...buildKeyDisplayModel(input.pressedKeys) });
      return;
    }

    if (!snapshot.visible || snapshot.keycaps.length === 0 || hideTimer !== undefined) {
      return;
    }

    hideTimer = setTimer(() => {
      hideTimer = undefined;
      publish({ visible: false, keycaps: [], overflowCount: 0 });
    }, KEY_DISPLAY_HIDE_DELAY_MS);
  }

  function dispose(): void {
    cancelPendingHide();
  }

  return {
    update,
    getSnapshot: () => ({ ...snapshot, keycaps: [...snapshot.keycaps] }),
    dispose,
  };
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
