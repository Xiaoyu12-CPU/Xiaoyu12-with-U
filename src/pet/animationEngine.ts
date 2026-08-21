import {
  computed,
  getCurrentScope,
  onScopeDispose,
  readonly,
  ref,
  toValue,
  watch,
} from "vue";
import type { ComputedRef, MaybeRefOrGetter, Ref } from "vue";
import type { ResolvedPetAsset } from "./types";

export interface PetAnimationController {
  currentFrame: ComputedRef<string>;
  currentFrameIndex: Readonly<Ref<number>>;
  isPaused: Readonly<Ref<boolean>>;
  pause: () => void;
  resume: () => void;
  dispose: () => void;
}

export interface PetAnimationOptions {
  random?: () => number;
}

export function usePetAnimation(
  assetSource: MaybeRefOrGetter<ResolvedPetAsset>,
  options: PetAnimationOptions = {},
): PetAnimationController {
  const currentFrameIndex = ref(0);
  const isPaused = ref(false);
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const random = options.random ?? Math.random;

  const currentFrame = computed(() => {
    const frames = toValue(assetSource).frames;
    return (frames[currentFrameIndex.value] ?? frames[0]).src;
  });

  function clearFrameTimer(): void {
    if (timerId !== undefined) {
      clearTimeout(timerId);
      timerId = undefined;
    }
  }

  function scheduleNextFrame(): void {
    clearFrameTimer();

    const asset = toValue(assetSource);
    if (disposed || isPaused.value || asset.frames.length < 2) {
      return;
    }

    const frame = asset.frames[currentFrameIndex.value] ?? asset.frames[0];

    timerId = setTimeout(advanceFrame, frame.durationMs);
  }

  function advanceFrame(): void {
    timerId = undefined;

    if (disposed || isPaused.value) {
      return;
    }

    const asset = toValue(assetSource);
    const nextFrameIndex = currentFrameIndex.value + 1;

    if (nextFrameIndex < asset.frames.length) {
      currentFrameIndex.value = nextFrameIndex;
      scheduleNextFrame();
      return;
    }

    if (asset.animation.loop) {
      const replayDelay = selectReplayDelay(asset.animation.replay, random);
      timerId = setTimeout(() => {
        timerId = undefined;

        if (disposed || isPaused.value) {
          return;
        }

        currentFrameIndex.value = 0;
        scheduleNextFrame();
      }, replayDelay);
    }
  }

  function resetForAssetChange(): void {
    clearFrameTimer();
    currentFrameIndex.value = 0;
    scheduleNextFrame();
  }

  function pause(): void {
    if (disposed || isPaused.value) {
      return;
    }

    isPaused.value = true;
    clearFrameTimer();
  }

  function resume(): void {
    if (disposed || !isPaused.value) {
      return;
    }

    isPaused.value = false;
    scheduleNextFrame();
  }

  const stopWatchingAsset = watch(
    () => toValue(assetSource),
    resetForAssetChange,
    {
      immediate: true,
      flush: "sync",
    },
  );

  function dispose(): void {
    if (disposed) {
      return;
    }

    disposed = true;
    isPaused.value = true;
    clearFrameTimer();
    stopWatchingAsset();
  }

  if (getCurrentScope()) {
    onScopeDispose(dispose);
  }

  return {
    currentFrame,
    currentFrameIndex: readonly(currentFrameIndex),
    isPaused: readonly(isPaused),
    pause,
    resume,
    dispose,
  };
}

function selectReplayDelay(
  replay: ResolvedPetAsset["animation"]["replay"],
  random: () => number,
): number {
  if (replay.mode === "continuous") {
    return 0;
  }

  if (replay.mode === "fixed") {
    return replay.delayMs;
  }

  if (replay.delayOptionsMs.length === 0) {
    return 0;
  }

  const randomValue = Math.min(Math.max(random(), 0), 1 - Number.EPSILON);
  return replay.delayOptionsMs[
    Math.floor(randomValue * replay.delayOptionsMs.length)
  ] ?? 0;
}
