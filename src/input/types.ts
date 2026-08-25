export type KeyboardInputEventType = "down" | "up";

export type KeyboardMonitorStatus =
  | "disabled"
  | "starting"
  | "permission-required"
  | "active"
  | "error"
  | "unsupported";

export interface KeyboardInputEvent {
  eventType: KeyboardInputEventType;
  key: string;
  timestamp: number;
}

export interface NativeKeyboardMonitorSnapshot {
  status: KeyboardMonitorStatus;
  message?: string;
}

export interface KeyboardRuntimeSnapshot extends NativeKeyboardMonitorSnapshot {
  pressedKeys: string[];
  lastKey?: string;
  lastActivityAt?: number;
}
