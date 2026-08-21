import { readonly, ref } from "vue";
import { PET_STATES } from "./types";
import type { PetState } from "./types";
import { userAssetStorage } from "./userAssetStorage";
import type {
  UploadedUserAsset,
  UserPetFrameReference,
  UserPetManifest,
  UserPetStateOverride,
} from "./userAssetTypes";

const DEFAULT_PET_ID = "default";
const manifest = ref<UserPetManifest>(createEmptyManifest(DEFAULT_PET_ID));
const revision = ref(0);
const isLoaded = ref(false);
const lastError = ref("");
const objectUrls = new Map<string, string>();
let initializePromise: Promise<void> | undefined;

async function initialize(): Promise<void> {
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    try {
      await reload();
      await userAssetStorage.subscribe((value) => {
        void applyManifest(value).catch((error: unknown) => {
          console.error("Failed to reload user pet assets.", error);
        });
      });
    } catch (error) {
      lastError.value = toErrorMessage(error);
      console.error("Failed to initialize user pet assets.", error);
    } finally {
      isLoaded.value = true;
    }
  })();

  return initializePromise;
}

async function reload(): Promise<void> {
  const stored = await userAssetStorage.loadManifest(DEFAULT_PET_ID);
  await applyManifest(stored ?? createEmptyManifest(DEFAULT_PET_ID));
}

async function applyManifest(value: unknown): Promise<void> {
  const nextManifest = normalizeUserManifest(value, DEFAULT_PET_ID);
  await hydrateUserFrameUrls(nextManifest);
  manifest.value = nextManifest;
  lastError.value = "";
  revision.value += 1;
}

async function saveStateOverride(
  state: PetState,
  stateOverride: UserPetStateOverride,
): Promise<void> {
  if (state === "idle" && stateOverride.frames.length === 0) {
    throw new Error("idle 状态必须至少保留一个有效帧。");
  }

  const nextManifest: UserPetManifest = {
    schemaVersion: 1,
    petId: DEFAULT_PET_ID,
    states: {
      ...manifest.value.states,
      [state]: normalizeStateOverride(stateOverride),
    },
  };

  await userAssetStorage.saveManifest(nextManifest);
  await applyManifest(nextManifest);
  await userAssetStorage.broadcast(nextManifest);
}

async function uploadPng(
  state: PetState,
  file: File,
): Promise<UserPetFrameReference> {
  if (file.type !== "image/png" && !file.name.toLowerCase().endsWith(".png")) {
    throw new Error(`“${file.name}”不是 PNG 文件。`);
  }

  const uploaded: UploadedUserAsset = await userAssetStorage.uploadPng(
    DEFAULT_PET_ID,
    state,
    file,
  );
  const frame: UserPetFrameReference = {
    id: `user:${state}:${uploaded.storedName}`,
    source: "user",
    path: uploaded.storedName,
    fileName: uploaded.fileName,
    durationMs: 250,
    width: uploaded.width,
    height: uploaded.height,
  };

  await hydrateFrameUrl(DEFAULT_PET_ID, state, frame);
  return frame;
}

async function deletePng(
  state: PetState,
  frame: UserPetFrameReference,
): Promise<void> {
  if (frame.source !== "user") {
    throw new Error("Built-in 资源只读，只能从动画配置中移除。");
  }

  await userAssetStorage.deletePng(DEFAULT_PET_ID, state, frame.path);
  revokeObjectUrl(frame.id);
}

function getStateOverride(state: PetState): UserPetStateOverride | undefined {
  return manifest.value.states[state];
}

function getFrameUrl(frame: UserPetFrameReference): string | undefined {
  return frame.source === "user" ? objectUrls.get(frame.id) : undefined;
}

async function hydrateUserFrameUrls(nextManifest: UserPetManifest): Promise<void> {
  const activeIds = new Set<string>();

  for (const state of PET_STATES) {
    for (const frame of nextManifest.states[state]?.frames ?? []) {
      if (frame.source !== "user") {
        continue;
      }

      activeIds.add(frame.id);

      if (!objectUrls.has(frame.id)) {
        try {
          await hydrateFrameUrl(nextManifest.petId, state, frame);
        } catch (error) {
          console.error(`Failed to load user frame "${frame.fileName}".`, error);
        }
      }
    }
  }

  for (const id of objectUrls.keys()) {
    if (!activeIds.has(id)) {
      revokeObjectUrl(id);
    }
  }
}

async function hydrateFrameUrl(
  petId: string,
  state: PetState,
  frame: UserPetFrameReference,
): Promise<void> {
  const bytes = await userAssetStorage.loadPng(petId, state, frame.path);
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  revokeObjectUrl(frame.id);
  objectUrls.set(frame.id, url);
}

function revokeObjectUrl(id: string): void {
  const url = objectUrls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(id);
  }
}

function normalizeUserManifest(value: unknown, petId: string): UserPetManifest {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.petId !== petId) {
    return createEmptyManifest(petId);
  }

  const states: UserPetManifest["states"] = {};
  const rawStates = isRecord(value.states) ? value.states : {};

  for (const state of PET_STATES) {
    const rawState = rawStates[state];
    if (rawState !== undefined) {
      try {
        states[state] = normalizeStateOverride(rawState);
      } catch (error) {
        console.error(`Ignored damaged user override for "${state}".`, error);
      }
    }
  }

  if (states.idle?.frames.length === 0) {
    delete states.idle;
  }

  return { schemaVersion: 1, petId, states };
}

function normalizeStateOverride(value: unknown): UserPetStateOverride {
  if (!isRecord(value) || !Array.isArray(value.frames) || !isRecord(value.animation)) {
    throw new Error("Invalid user state override.");
  }

  const frames = value.frames.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const { id, source, path, fileName, durationMs, width, height } = entry;
    if (
      typeof id !== "string" ||
      (source !== "built-in" && source !== "user") ||
      !isSafeFramePath(path, source) ||
      typeof fileName !== "string" ||
      typeof durationMs !== "number" ||
      !Number.isFinite(durationMs) ||
      durationMs < 0
    ) {
      return [];
    }

    return [{
      id,
      source,
      path,
      fileName,
      durationMs,
      width: isPositiveInteger(width) ? width : undefined,
      height: isPositiveInteger(height) ? height : undefined,
    } satisfies UserPetFrameReference];
  });

  const replay = isRecord(value.animation.replay) ? value.animation.replay : {};
  const mode = replay.mode;
  const normalizedMode =
    mode === "fixed" || mode === "random" ? mode : "continuous";

  return {
    frames,
    animation: {
      loop: value.animation.loop !== false,
      replay: {
        mode: normalizedMode,
        delayMs: isNonNegativeNumber(replay.delayMs) ? replay.delayMs : 0,
        delayOptionsMs: Array.isArray(replay.delayOptionsMs)
          ? replay.delayOptionsMs.filter(isNonNegativeNumber)
          : [],
      },
    },
  };
}

function createEmptyManifest(petId: string): UserPetManifest {
  return { schemaVersion: 1, petId, states: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeFramePath(
  value: unknown,
  source: unknown,
): value is string {
  if (typeof value !== "string" || value.length === 0 || value.startsWith("/")) {
    return false;
  }

  const segments = value.replace(/\\/g, "/").split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return false;
  }

  return source === "built-in" || segments.length === 1;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const userAssetManager = {
  manifest: readonly(manifest),
  revision: readonly(revision),
  isLoaded: readonly(isLoaded),
  lastError: readonly(lastError),
  initialize,
  reload,
  getStateOverride,
  getFrameUrl,
  saveStateOverride,
  uploadPng,
  deletePng,
};
