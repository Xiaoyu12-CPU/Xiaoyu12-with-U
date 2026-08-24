import { computed, readonly, ref } from "vue";
import type { BehaviorRequest } from "./behavior";
import type { DialogueEventType } from "./dialogueEvents";
import type { PetState } from "./types";
import type {
  NextReminderRuntime,
  ReminderTriggerPayload,
} from "../reminder/reminderTypes";

export type PetAnimationStatus = "playing" | "paused";
export type CpuStatus = "disabled" | "normal" | "high";
export type MemoryStatus = "disabled" | "normal" | "high";
export type NetworkStatus = "disabled" | "warming" | "active" | "error";
export type StorageStatus = "disabled" | "active" | "error";
export type BatteryState =
  | "disabled"
  | "charging"
  | "discharging"
  | "full"
  | "unknown"
  | "unavailable"
  | "error";
export type ReminderSchedulerStatus = "enabled" | "disabled";

export interface PetRuntimeSnapshot {
  state: PetState;
  effectiveState: PetState;
  winningSource?: string;
  activeBehaviorRequests: readonly BehaviorRequest[];
  cpuUsagePercent?: number;
  cpuStatus: CpuStatus;
  cpuMonitoring: boolean;
  cpuHighThreshold: number;
  memoryUsagePercent?: number;
  memoryUsedBytes?: number;
  memoryTotalBytes?: number;
  memoryAvailableBytes?: number;
  memoryStatus: MemoryStatus;
  memoryMonitoring: boolean;
  memoryHighThreshold: number;
  networkDownloadBytesPerSecond?: number;
  networkUploadBytesPerSecond?: number;
  networkStatus: NetworkStatus;
  networkMonitoring: boolean;
  storageTotalBytes?: number;
  storageUsedBytes?: number;
  storageAvailableBytes?: number;
  storageUsagePercent?: number;
  storageStatus: StorageStatus;
  storageMonitoring: boolean;
  batteryPercent?: number;
  batteryState: BatteryState;
  batteryMonitoring: boolean;
  batteryPresent: boolean;
  reminderSchedulerStatus: ReminderSchedulerStatus;
  nextReminder?: NextReminderRuntime;
  lastReminderTrigger?: ReminderTriggerPayload;
  animationStatus: PetAnimationStatus;
  currentFrame: string;
  currentFrameIndex: number;
  lastEvent?: DialogueEventType;
  lastText: string;
  updatedAt: string;
}

const state = ref<PetState>("idle");
const effectiveState = ref<PetState>("idle");
const winningSource = ref<string>();
const activeBehaviorRequests = ref<readonly BehaviorRequest[]>([]);
const cpuUsagePercent = ref<number>();
const cpuStatus = ref<CpuStatus>("disabled");
const cpuMonitoring = ref(false);
const cpuHighThreshold = ref(80);
const memoryUsagePercent = ref<number>();
const memoryUsedBytes = ref<number>();
const memoryTotalBytes = ref<number>();
const memoryAvailableBytes = ref<number>();
const memoryStatus = ref<MemoryStatus>("disabled");
const memoryMonitoring = ref(false);
const memoryHighThreshold = ref(85);
const networkDownloadBytesPerSecond = ref<number>();
const networkUploadBytesPerSecond = ref<number>();
const networkStatus = ref<NetworkStatus>("disabled");
const networkMonitoring = ref(false);
const storageTotalBytes = ref<number>();
const storageUsedBytes = ref<number>();
const storageAvailableBytes = ref<number>();
const storageUsagePercent = ref<number>();
const storageStatus = ref<StorageStatus>("disabled");
const storageMonitoring = ref(false);
const batteryPercent = ref<number>();
const batteryState = ref<BatteryState>("disabled");
const batteryMonitoring = ref(false);
const batteryPresent = ref(false);
const reminderSchedulerStatus = ref<ReminderSchedulerStatus>("disabled");
const nextReminder = ref<NextReminderRuntime>();
const lastReminderTrigger = ref<ReminderTriggerPayload>();
const animationStatus = ref<PetAnimationStatus>("playing");
const currentFrame = ref("");
const currentFrameIndex = ref(0);
const lastEvent = ref<DialogueEventType>();
const lastText = ref("");
const updatedAt = ref(new Date().toISOString());

const snapshot = computed<PetRuntimeSnapshot>(() => ({
  state: state.value,
  effectiveState: effectiveState.value,
  winningSource: winningSource.value,
  activeBehaviorRequests: activeBehaviorRequests.value,
  cpuUsagePercent: cpuUsagePercent.value,
  cpuStatus: cpuStatus.value,
  cpuMonitoring: cpuMonitoring.value,
  cpuHighThreshold: cpuHighThreshold.value,
  memoryUsagePercent: memoryUsagePercent.value,
  memoryUsedBytes: memoryUsedBytes.value,
  memoryTotalBytes: memoryTotalBytes.value,
  memoryAvailableBytes: memoryAvailableBytes.value,
  memoryStatus: memoryStatus.value,
  memoryMonitoring: memoryMonitoring.value,
  memoryHighThreshold: memoryHighThreshold.value,
  networkDownloadBytesPerSecond: networkDownloadBytesPerSecond.value,
  networkUploadBytesPerSecond: networkUploadBytesPerSecond.value,
  networkStatus: networkStatus.value,
  networkMonitoring: networkMonitoring.value,
  storageTotalBytes: storageTotalBytes.value,
  storageUsedBytes: storageUsedBytes.value,
  storageAvailableBytes: storageAvailableBytes.value,
  storageUsagePercent: storageUsagePercent.value,
  storageStatus: storageStatus.value,
  storageMonitoring: storageMonitoring.value,
  batteryPercent: batteryPercent.value,
  batteryState: batteryState.value,
  batteryMonitoring: batteryMonitoring.value,
  batteryPresent: batteryPresent.value,
  reminderSchedulerStatus: reminderSchedulerStatus.value,
  nextReminder: nextReminder.value,
  lastReminderTrigger: lastReminderTrigger.value,
  animationStatus: animationStatus.value,
  currentFrame: currentFrame.value,
  currentFrameIndex: currentFrameIndex.value,
  lastEvent: lastEvent.value,
  lastText: lastText.value,
  updatedAt: updatedAt.value,
}));

export function updateCpuRuntime(input: {
  usagePercent?: number;
  status: CpuStatus;
  monitoring: boolean;
  highThreshold: number;
}): void {
  cpuUsagePercent.value = input.usagePercent;
  cpuStatus.value = input.status;
  cpuMonitoring.value = input.monitoring;
  cpuHighThreshold.value = input.highThreshold;
  touch();
}

export function updateMemoryRuntime(input: {
  usagePercent?: number;
  usedBytes?: number;
  totalBytes?: number;
  availableBytes?: number;
  status: MemoryStatus;
  monitoring: boolean;
  highThreshold: number;
}): void {
  memoryUsagePercent.value = input.usagePercent;
  memoryUsedBytes.value = input.usedBytes;
  memoryTotalBytes.value = input.totalBytes;
  memoryAvailableBytes.value = input.availableBytes;
  memoryStatus.value = input.status;
  memoryMonitoring.value = input.monitoring;
  memoryHighThreshold.value = input.highThreshold;
  touch();
}

export function updateNetworkRuntime(input: {
  downloadBytesPerSecond?: number;
  uploadBytesPerSecond?: number;
  status: NetworkStatus;
  monitoring: boolean;
}): void {
  networkDownloadBytesPerSecond.value = input.downloadBytesPerSecond;
  networkUploadBytesPerSecond.value = input.uploadBytesPerSecond;
  networkStatus.value = input.status;
  networkMonitoring.value = input.monitoring;
  touch();
}

export function updateStorageRuntime(input: {
  totalBytes?: number;
  usedBytes?: number;
  availableBytes?: number;
  usagePercent?: number;
  status: StorageStatus;
  monitoring: boolean;
}): void {
  storageTotalBytes.value = input.totalBytes;
  storageUsedBytes.value = input.usedBytes;
  storageAvailableBytes.value = input.availableBytes;
  storageUsagePercent.value = input.usagePercent;
  storageStatus.value = input.status;
  storageMonitoring.value = input.monitoring;
  touch();
}

export function updateBatteryRuntime(input: {
  percent?: number;
  state: BatteryState;
  monitoring: boolean;
  present: boolean;
}): void {
  batteryPercent.value = input.percent;
  batteryState.value = input.state;
  batteryMonitoring.value = input.monitoring;
  batteryPresent.value = input.present;
  touch();
}

export function updateReminderRuntime(input: {
  status: ReminderSchedulerStatus;
  nextReminder?: NextReminderRuntime;
  lastTrigger?: ReminderTriggerPayload;
}): void {
  reminderSchedulerStatus.value = input.status;
  nextReminder.value = input.nextReminder;
  lastReminderTrigger.value = input.lastTrigger;
  touch();
}

export function updateBehaviorRuntime(input: {
  effectiveState: PetState;
  winningSource?: string;
  activeRequests: readonly BehaviorRequest[];
}): void {
  effectiveState.value = input.effectiveState;
  winningSource.value = input.winningSource;
  activeBehaviorRequests.value = input.activeRequests.map((request) => ({
    ...request,
  }));
  touch();
}

export function updateAnimationRuntime(input: {
  state: PetState;
  isPaused: boolean;
  currentFrame: string;
  currentFrameIndex: number;
}): void {
  state.value = input.state;
  animationStatus.value = input.isPaused ? "paused" : "playing";
  currentFrame.value = input.currentFrame;
  currentFrameIndex.value = input.currentFrameIndex;
  touch();
}

export function recordDialogueEvent(eventType: DialogueEventType): void {
  lastEvent.value = eventType;
  touch();
}

export function recordDialogueText(text: string): void {
  lastText.value = text;
  touch();
}

export function usePetRuntimeStatus() {
  return {
    snapshot: readonly(snapshot),
  };
}

function touch(): void {
  updatedAt.value = new Date().toISOString();
}
