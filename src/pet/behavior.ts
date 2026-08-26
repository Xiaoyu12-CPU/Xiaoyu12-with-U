import { computed, reactive } from "vue";
import { usePetStore } from "./petStore";
import { updateBehaviorRuntime } from "./runtimeStatus";
import type { PetState } from "./types";

export const DEFAULT_BEHAVIOR_PRIORITIES: Readonly<
  Record<PetState, number>
> = {
  dragging: 100,
  alert: 80,
  sleep: 70,
  happy: 60,
  working: 50,
  tired: 30,
  idle: 0,
};

export const BEHAVIOR_SOURCES = {
  INTERACTION_CLICK: "interaction.click",
  INTERACTION_DRAG: "interaction.drag",
  INPUT_KEYBOARD: "input.keyboard",
  SYSTEM_CPU: "system.cpu",
  SYSTEM_MEMORY: "system.memory",
  DEVELOPMENT_TIRED: "development.test.tired",
  DEVELOPMENT_WORKING: "development.test.working",
  DEVELOPMENT_ALERT: "development.test.alert",
} as const;

export interface BehaviorRequestInput {
  source: string;
  state: PetState;
  priority?: number;
  durationMs?: number;
}

export interface BehaviorRequest {
  readonly source: string;
  readonly state: PetState;
  readonly priority: number;
  readonly durationMs?: number;
  readonly createdAt: number;
  readonly sequence: number;
}

const requests = reactive(new Map<string, BehaviorRequest>());
const transientTimers = new Map<
  string,
  ReturnType<typeof setTimeout>
>();
let nextSequence = 0;

export const activeRequests = computed<readonly BehaviorRequest[]>(() =>
  [...requests.values()]
    .sort(compareRequests)
    .map((request) => ({ ...request })),
);

const winningRequest = computed(() => activeRequests.value[0]);

export const effectiveState = computed<PetState>(
  () => winningRequest.value?.state ?? "idle",
);

export const winningSource = computed<string | undefined>(
  () => winningRequest.value?.source,
);

export function requestState(
  input: BehaviorRequestInput,
): BehaviorRequest {
  const source = input.source.trim();

  if (!source) {
    throw new Error("Behavior source must not be empty.");
  }

  const priority = input.priority ?? DEFAULT_BEHAVIOR_PRIORITIES[input.state];

  if (!Number.isFinite(priority)) {
    throw new Error("Behavior priority must be a finite number.");
  }

  if (
    input.durationMs !== undefined &&
    (!Number.isFinite(input.durationMs) || input.durationMs <= 0)
  ) {
    throw new Error("Behavior durationMs must be a positive number.");
  }

  clearTransientTimer(source);

  const request: BehaviorRequest = {
    source,
    state: input.state,
    priority,
    durationMs: input.durationMs,
    createdAt: Date.now(),
    sequence: ++nextSequence,
  };

  requests.set(source, request);
  applyWinner();

  if (request.durationMs !== undefined) {
    const requestSequence = request.sequence;
    const timer = setTimeout(() => {
      transientTimers.delete(source);

      if (requests.get(source)?.sequence === requestSequence) {
        requests.delete(source);
        applyWinner();
      }
    }, request.durationMs);

    transientTimers.set(source, timer);
  }

  return { ...request };
}

export function releaseState(source: string): void {
  const normalizedSource = source.trim();

  if (!normalizedSource) {
    return;
  }

  clearTransientTimer(normalizedSource);

  if (requests.delete(normalizedSource)) {
    applyWinner();
  }
}

function clearTransientTimer(source: string): void {
  const timer = transientTimers.get(source);

  if (timer !== undefined) {
    clearTimeout(timer);
    transientTimers.delete(source);
  }
}

function compareRequests(
  left: BehaviorRequest,
  right: BehaviorRequest,
): number {
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  if (left.sequence !== right.sequence) {
    return right.sequence - left.sequence;
  }

  return left.source.localeCompare(right.source);
}

const { currentState, setState } = usePetStore();

function applyWinner(): void {
  const state = effectiveState.value;

  if (currentState.value !== state) {
    setState(state);
  }

  updateBehaviorRuntime({
    effectiveState: state,
    winningSource: winningSource.value,
    activeRequests: activeRequests.value,
  });
}
