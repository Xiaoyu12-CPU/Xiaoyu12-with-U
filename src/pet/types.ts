export const PET_STATES = [
  "idle",
  "happy",
  "sleep",
  "tired",
  "alert",
  "working",
  "dragging",
] as const;

export type PetState = (typeof PET_STATES)[number];

export type PetAssetSource = "built-in" | "user";
export type PetReplayMode = "continuous" | "fixed" | "random";

export interface PetReplayConfig {
  mode: PetReplayMode;
  delayMs?: number;
  delayOptionsMs?: number[];
}

export interface PetAnimationConfig {
  /** Legacy schema v1 default duration. */
  frameDurationMs?: number;
  loop?: boolean;
  /** Legacy schema v1 random replay delays. */
  loopDelayOptionsMs?: number[];
  replay?: PetReplayConfig;
}

export interface ResolvedPetAnimationConfig {
  loop: boolean;
  replay: Readonly<{
    mode: PetReplayMode;
    delayMs: number;
    delayOptionsMs: readonly number[];
  }>;
}

export interface PetFrameConfig {
  path: string;
  durationMs: number;
}

export type PetFrameManifestEntry = string | PetFrameConfig;

export interface PetStateResourceConfig {
  frames: [PetFrameManifestEntry, ...PetFrameManifestEntry[]];
  animation?: PetAnimationConfig;
}

export interface PetAssetManifest {
  schemaVersion: 1 | 2;
  id: string;
  name: string;
  supportedStates: PetState[];
  fallbackState: PetState;
  states: Partial<Record<PetState, PetStateResourceConfig>>;
}

export interface ResolvedPetFrame {
  id: string;
  src: string;
  path: string;
  fileName: string;
  durationMs: number;
  source: PetAssetSource;
  width?: number;
  height?: number;
}

export interface ResolvedPetAsset {
  requestedPetId: string;
  petId: string;
  petName: string;
  requestedState: PetState;
  resolvedState: PetState;
  frames: readonly [ResolvedPetFrame, ...ResolvedPetFrame[]];
  animation: Readonly<ResolvedPetAnimationConfig>;
  usedFallback: boolean;
}
