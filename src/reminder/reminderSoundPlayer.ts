import { resolveReminderSound } from "./reminderSounds";
import type { ReminderSoundId } from "./reminderTypes";

interface PlayableAudio {
  currentTime: number;
  preload: string;
  volume: number;
  pause: () => void;
  play: () => Promise<void>;
}

interface ReminderSoundPlayerDependencies {
  createAudio?: (url: string) => PlayableAudio;
}

export interface ReminderSoundPlayer {
  play: (
    soundId: ReminderSoundId | string | null,
    volume: number,
  ) => Promise<void>;
  stop: () => void;
}

export function createReminderSoundPlayer(
  dependencies: ReminderSoundPlayerDependencies = {},
): ReminderSoundPlayer {
  const createAudio = dependencies.createAudio
    ?? ((url: string) => new Audio(url));
  let activeAudio: PlayableAudio | undefined;

  async function play(
    soundId: ReminderSoundId | string | null,
    volume: number,
  ): Promise<void> {
    const sound = resolveReminderSound(soundId);

    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    }

    const audio = createAudio(sound.url);
    audio.preload = "auto";
    audio.volume = clampVolume(volume);
    activeAudio = audio;

    try {
      await audio.play();
    } catch (error) {
      if (activeAudio === audio) {
        activeAudio = undefined;
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to play built-in Reminder sound "${sound.id}": ${reason}`,
      );
    }
  }

  function stop(): void {
    if (!activeAudio) {
      return;
    }

    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = undefined;
  }

  return { play, stop };
}

export const reminderSoundPlayer = createReminderSoundPlayer();

export function playReminderSound(
  soundId: ReminderSoundId | string | null,
  volume: number,
): Promise<void> {
  return reminderSoundPlayer.play(soundId, volume);
}

export function stopReminderSound(): void {
  reminderSoundPlayer.stop();
}

function clampVolume(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0.7;
}
