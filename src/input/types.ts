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

export type MouseInputEventType = "down" | "up" | "scroll";

export type MouseButton =
  | "left"
  | "right"
  | "middle"
  | "mouse4"
  | "mouse5"
  | "other";

export type MouseScrollDirection = "up" | "down" | "left" | "right";

export type MouseMonitorStatus = KeyboardMonitorStatus;

export interface MouseInputEvent {
  eventType: MouseInputEventType;
  button?: MouseButton;
  scrollDirection?: MouseScrollDirection;
  timestamp: number;
}

export interface NativeMouseMonitorSnapshot {
  status: MouseMonitorStatus;
  message?: string;
}

export interface MouseRuntimeSnapshot extends NativeMouseMonitorSnapshot {
  pressedButtons: MouseButton[];
  lastButton?: MouseButton;
  lastActivityAt?: number;
  lastScrollDirection?: MouseScrollDirection;
  lastScrollAt?: number;
}
