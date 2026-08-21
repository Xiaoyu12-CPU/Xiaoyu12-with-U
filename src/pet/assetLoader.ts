import { PET_STATES } from "./types";
import type {
  PetAnimationConfig,
  PetAssetManifest,
  PetFrameManifestEntry,
  PetReplayMode,
  PetState,
  PetStateResourceConfig,
  ResolvedPetAnimationConfig,
  ResolvedPetAsset,
  ResolvedPetFrame,
} from "./types";
import { userAssetManager } from "./userAssetManager";
import type {
  UserAnimationConfig,
  UserPetFrameReference,
  UserPetStateOverride,
} from "./userAssetTypes";

const DEFAULT_PET_ID = "default";
const DEFAULT_FRAME_DURATION_MS = 500;

const manifestModules = import.meta.glob<unknown>(
  "../assets/pets/*/pet.json",
  { eager: true, import: "default" },
);

const bundledAssetUrls = import.meta.glob<string>(
  "../assets/pets/**/*.png",
  { eager: true, import: "default", query: "?url" },
);

interface RegisteredPet {
  manifest: PetAssetManifest;
  manifestPath: string;
}

interface DedicatedStateResolution {
  frames: ResolvedPetFrame[];
  animation: ResolvedPetAnimationConfig;
  source: "built-in" | "user";
  errors: string[];
}

export interface PetStateAssetInfo {
  state: PetState;
  fallbackState: PetState;
  hasBuiltInResource: boolean;
  hasUserOverride: boolean;
  isConfigured: boolean;
  frames: readonly ResolvedPetFrame[];
  animation: Readonly<ResolvedPetAnimationConfig>;
  source: "built-in" | "user" | "fallback";
  errors: readonly string[];
}

const petRegistry = createPetRegistry();

export const assetRevision = userAssetManager.revision;

export function initializePetAssets(): Promise<void> {
  return userAssetManager.initialize();
}

export function listPetIds(): readonly string[] {
  return [...petRegistry.keys()];
}

export function loadPetConfig(petId: string): PetAssetManifest | undefined {
  return petRegistry.get(petId)?.manifest;
}

export function getPetStateAssetInfo(
  state: PetState,
  petId = DEFAULT_PET_ID,
): PetStateAssetInfo {
  void assetRevision.value;
  const pet = petRegistry.get(petId) ?? getDefaultPet();
  const dedicated = resolveDedicatedState(pet, state);

  if (dedicated?.frames.length) {
    return {
      state,
      fallbackState: pet.manifest.fallbackState,
      hasBuiltInResource: Boolean(pet.manifest.states[state]),
      hasUserOverride: Boolean(userAssetManager.getStateOverride(state)),
      isConfigured: true,
      frames: dedicated.frames,
      animation: dedicated.animation,
      source: dedicated.source,
      errors: dedicated.errors,
    };
  }

  return {
    state,
    fallbackState: pet.manifest.fallbackState,
    hasBuiltInResource: Boolean(pet.manifest.states[state]),
    hasUserOverride: Boolean(userAssetManager.getStateOverride(state)),
    isConfigured: false,
    frames: [],
    animation: createDefaultAnimation(),
    source: "fallback",
    errors: dedicated?.errors ?? [],
  };
}

export function resolvePetAsset(
  petId: string,
  requestedState: PetState,
): ResolvedPetAsset {
  void assetRevision.value;
  const requestedPet = petRegistry.get(petId);
  const pet = requestedPet ?? getDefaultPet();
  const requestedResource = resolveDedicatedState(pet, requestedState);
  const resolvedState = requestedResource?.frames.length
    ? requestedState
    : pet.manifest.fallbackState;
  let resource = resolvedState === requestedState
    ? requestedResource
    : resolveDedicatedState(pet, resolvedState);

  if (!resource?.frames.length) {
    const builtInFallback = pet.manifest.states[pet.manifest.fallbackState];
    resource = builtInFallback
      ? resolveBuiltInState(pet, builtInFallback)
      : undefined;
  }

  if (!resource?.frames.length) {
    throw new Error(`Pet "${pet.manifest.id}" has no valid fallback resource.`);
  }

  return {
    requestedPetId: petId,
    petId: pet.manifest.id,
    petName: pet.manifest.name,
    requestedState,
    resolvedState,
    frames: resource.frames as [ResolvedPetFrame, ...ResolvedPetFrame[]],
    animation: resource.animation,
    usedFallback: requestedPet === undefined || resolvedState !== requestedState,
  };
}

export function resolveCurrentPetAsset(state: PetState): ResolvedPetAsset {
  return resolvePetAsset(DEFAULT_PET_ID, state);
}

function resolveDedicatedState(
  pet: RegisteredPet,
  state: PetState,
): DedicatedStateResolution | undefined {
  const userOverride = userAssetManager.getStateOverride(state);
  if (userOverride) {
    return resolveUserState(pet, state, userOverride);
  }

  const builtIn = pet.manifest.states[state];
  return builtIn ? resolveBuiltInState(pet, builtIn) : undefined;
}

function resolveBuiltInState(
  pet: RegisteredPet,
  resource: PetStateResourceConfig,
): DedicatedStateResolution {
  const manifestDirectory = pet.manifestPath.slice(
    0,
    pet.manifestPath.lastIndexOf("/") + 1,
  );
  const legacyDuration =
    resource.animation?.frameDurationMs ?? DEFAULT_FRAME_DURATION_MS;
  const legacyRandomReplay = Boolean(resource.animation?.loopDelayOptionsMs?.length);
  const errors: string[] = [];
  const frames = resource.frames.flatMap((entry, index) => {
    const frame = normalizeBuiltInFrame(
      entry,
      legacyDuration,
      legacyRandomReplay && index === resource.frames.length - 1,
    );
    const src = bundledAssetUrls[`${manifestDirectory}${frame.path}`];

    if (!src) {
      errors.push(`Built-in PNG 不存在：${frame.path}`);
      return [];
    }

    return [{
      id: `built-in:${frame.path}`,
      src,
      path: frame.path,
      fileName: fileNameFromPath(frame.path),
      durationMs: frame.durationMs,
      source: "built-in" as const,
    }];
  });

  return {
    frames,
    animation: resolveAnimation(resource.animation),
    source: "built-in",
    errors,
  };
}

function resolveUserState(
  pet: RegisteredPet,
  state: PetState,
  stateOverride: UserPetStateOverride,
): DedicatedStateResolution {
  const errors: string[] = [];
  const manifestDirectory = pet.manifestPath.slice(
    0,
    pet.manifestPath.lastIndexOf("/") + 1,
  );
  const frames = stateOverride.frames.flatMap((frame) => {
    const src = resolveUserFrameSource(frame, manifestDirectory);
    if (!src) {
      errors.push(`${frame.source} PNG 无法读取：${frame.fileName}`);
      return [];
    }
    return [{ ...frame, src } satisfies ResolvedPetFrame];
  });

  if (state === "idle" && frames.length === 0) {
    errors.push("idle 用户配置无有效帧，已安全回退到 built-in idle。");
  }

  return {
    frames,
    animation: normalizeUserAnimation(stateOverride.animation),
    source: "user",
    errors,
  };
}

function resolveUserFrameSource(
  frame: UserPetFrameReference,
  manifestDirectory: string,
): string | undefined {
  if (frame.source === "user") {
    return userAssetManager.getFrameUrl(frame);
  }

  return bundledAssetUrls[
    `${manifestDirectory}${normalizeRelativeAssetPath(frame.path)}`
  ];
}

function normalizeBuiltInFrame(
  entry: PetFrameManifestEntry,
  legacyDuration: number,
  legacyFinalReplayFrame: boolean,
): { path: string; durationMs: number } {
  if (typeof entry === "string") {
    return {
      path: normalizeRelativeAssetPath(entry),
      durationMs: legacyFinalReplayFrame ? 0 : legacyDuration,
    };
  }

  return {
    path: normalizeRelativeAssetPath(entry.path),
    durationMs: entry.durationMs,
  };
}

function resolveAnimation(
  animation: PetAnimationConfig | undefined,
): ResolvedPetAnimationConfig {
  const loop = animation?.loop ?? true;

  if (animation?.replay) {
    return {
      loop,
      replay: normalizeReplay(
        animation.replay.mode,
        animation.replay.delayMs,
        animation.replay.delayOptionsMs,
      ),
    };
  }

  if (animation?.loopDelayOptionsMs?.length) {
    return {
      loop,
      replay: normalizeReplay("random", 0, animation.loopDelayOptionsMs),
    };
  }

  return { loop, replay: normalizeReplay("continuous") };
}

function normalizeUserAnimation(
  animation: UserAnimationConfig,
): ResolvedPetAnimationConfig {
  return {
    loop: animation.loop,
    replay: normalizeReplay(
      animation.replay.mode,
      animation.replay.delayMs,
      animation.replay.delayOptionsMs,
    ),
  };
}

function normalizeReplay(
  mode: PetReplayMode,
  delayMs = 0,
  delayOptionsMs: readonly number[] = [],
): ResolvedPetAnimationConfig["replay"] {
  return {
    mode,
    delayMs: Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 0,
    delayOptionsMs: delayOptionsMs.filter(
      (delay) => Number.isFinite(delay) && delay >= 0,
    ),
  };
}

function createDefaultAnimation(): ResolvedPetAnimationConfig {
  return { loop: true, replay: normalizeReplay("continuous") };
}

function createPetRegistry(): Map<string, RegisteredPet> {
  const registry = new Map<string, RegisteredPet>();

  for (const [manifestPath, rawManifest] of Object.entries(manifestModules)) {
    assertPetManifest(rawManifest, manifestPath);
    const folderId = getPetFolderId(manifestPath);
    if (rawManifest.id !== folderId) {
      throw new Error(
        `Pet manifest id "${rawManifest.id}" must match folder "${folderId}".`,
      );
    }
    if (registry.has(rawManifest.id)) {
      throw new Error(`Duplicate pet id "${rawManifest.id}".`);
    }
    registry.set(rawManifest.id, { manifest: rawManifest, manifestPath });
  }

  if (!registry.has(DEFAULT_PET_ID)) {
    throw new Error(`Required default pet "${DEFAULT_PET_ID}" was not found.`);
  }
  return registry;
}

function getDefaultPet(): RegisteredPet {
  const pet = petRegistry.get(DEFAULT_PET_ID);
  if (!pet) {
    throw new Error(`Required default pet "${DEFAULT_PET_ID}" was not found.`);
  }
  return pet;
}

function normalizeRelativeAssetPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  const segments = normalized.split("/");
  if (
    normalized.startsWith("/") ||
    segments.some((segment) => segment === "" || segment === ".." || segment === ".")
  ) {
    throw new Error(`Invalid pet asset path "${path}".`);
  }
  return normalized;
}

function fileNameFromPath(path: string): string {
  return path.split("/").pop() ?? path;
}

function getPetFolderId(manifestPath: string): string {
  const segments = manifestPath.split("/");
  return segments[segments.length - 2] ?? "";
}

function assertPetManifest(
  value: unknown,
  manifestPath: string,
): asserts value is PetAssetManifest {
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2)) {
    throw new Error(`Pet manifest "${manifestPath}" has an unsupported schema.`);
  }
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.name)) {
    throw new Error(`Pet manifest "${manifestPath}" requires an id and name.`);
  }
  if (
    !Array.isArray(value.supportedStates) ||
    !value.supportedStates.every(isPetState) ||
    !isPetState(value.fallbackState) ||
    !isRecord(value.states)
  ) {
    throw new Error(`Pet manifest "${manifestPath}" contains invalid states.`);
  }

  const supportedStates = new Set(value.supportedStates);
  if (!supportedStates.has(value.fallbackState)) {
    throw new Error(`Pet manifest "${manifestPath}" must support its fallback.`);
  }
  for (const [state, resource] of Object.entries(value.states)) {
    if (!isPetState(state) || !supportedStates.has(state) || !isStateResource(resource)) {
      throw new Error(
        `Pet manifest "${manifestPath}" has invalid state resource "${state}".`,
      );
    }
  }
  if (!value.states[value.fallbackState]) {
    throw new Error(`Pet manifest "${manifestPath}" is missing its fallback resource.`);
  }
}

function isStateResource(value: unknown): value is PetStateResourceConfig {
  if (!isRecord(value) || !Array.isArray(value.frames) || value.frames.length === 0) {
    return false;
  }
  if (!value.frames.every((frame) =>
    isNonEmptyString(frame) ||
    (isRecord(frame) &&
      isNonEmptyString(frame.path) &&
      isNonNegativeNumber(frame.durationMs)))) {
    return false;
  }
  if (value.animation === undefined) {
    return true;
  }
  if (!isRecord(value.animation)) {
    return false;
  }
  if (value.animation.loop !== undefined && typeof value.animation.loop !== "boolean") {
    return false;
  }
  if (
    value.animation.frameDurationMs !== undefined &&
    !isNonNegativeNumber(value.animation.frameDurationMs)
  ) {
    return false;
  }
  if (
    value.animation.loopDelayOptionsMs !== undefined &&
    (!Array.isArray(value.animation.loopDelayOptionsMs) ||
      !value.animation.loopDelayOptionsMs.every(isNonNegativeNumber))
  ) {
    return false;
  }
  return value.animation.replay === undefined || isReplay(value.animation.replay);
}

function isReplay(value: unknown): boolean {
  if (!isRecord(value) || !isReplayMode(value.mode)) {
    return false;
  }
  return (
    (value.delayMs === undefined || isNonNegativeNumber(value.delayMs)) &&
    (value.delayOptionsMs === undefined ||
      (Array.isArray(value.delayOptionsMs) &&
        value.delayOptionsMs.every(isNonNegativeNumber)))
  );
}

function isReplayMode(value: unknown): value is PetReplayMode {
  return value === "continuous" || value === "fixed" || value === "random";
}

function isPetState(value: unknown): value is PetState {
  return typeof value === "string" && (PET_STATES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
