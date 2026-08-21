import type {
  PetAssetSource,
  PetReplayMode,
  PetState,
} from "./types";

export interface UserPetFrameReference {
  id: string;
  source: PetAssetSource;
  path: string;
  fileName: string;
  durationMs: number;
  width?: number;
  height?: number;
}

export interface UserAnimationConfig {
  loop: boolean;
  replay: {
    mode: PetReplayMode;
    delayMs: number;
    delayOptionsMs: number[];
  };
}

export interface UserPetStateOverride {
  frames: UserPetFrameReference[];
  animation: UserAnimationConfig;
}

export interface UserPetManifest {
  schemaVersion: 1;
  petId: string;
  states: Partial<Record<PetState, UserPetStateOverride>>;
}

export interface UploadedUserAsset {
  storedName: string;
  fileName: string;
  width: number;
  height: number;
}
