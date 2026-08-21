import { PET_STATES } from "./types";
import type { PetState } from "./types";

export type PetStateLifecycle = "active" | "planned";

export interface PetStateMetadata {
  id: PetState;
  label: string;
  lifecycle: PetStateLifecycle;
  fallbackState: PetState;
}

const STATE_LABELS: Readonly<Record<PetState, string>> = {
  idle: "Idle",
  happy: "Happy",
  sleep: "Sleep",
  tired: "Tired",
  alert: "Alert",
  working: "Working",
  dragging: "Dragging",
};

export const PET_STATE_REGISTRY: readonly PetStateMetadata[] = PET_STATES.map(
  (state) => ({
    id: state,
    label: STATE_LABELS[state],
    lifecycle: "active",
    fallbackState: "idle",
  }),
);

export function getPetStateMetadata(state: PetState): PetStateMetadata {
  const metadata = PET_STATE_REGISTRY.find((entry) => entry.id === state);

  if (!metadata) {
    throw new Error(`Unknown PetState "${state}".`);
  }

  return metadata;
}
