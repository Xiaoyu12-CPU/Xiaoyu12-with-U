import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const {
    createReminderSoundPlayer,
  } = await vite.ssrLoadModule("/src/reminder/reminderSoundPlayer.ts");
  const {
    DEFAULT_REMINDER_SOUND_ID,
    resolveReminderSound,
  } = await vite.ssrLoadModule("/src/reminder/reminderSounds.ts");
  const { normalizeSettings } = await vite.ssrLoadModule(
    "/src/settings/settingsManager.ts",
  );

  const createdAudio = [];
  const player = createReminderSoundPlayer({
    createAudio(url) {
      const audio = {
        url,
        currentTime: 0,
        preload: "",
        volume: 0,
        paused: false,
        pause() {
          this.paused = true;
        },
        async play() {},
      };
      createdAudio.push(audio);
      return audio;
    },
  });

  await player.play("soft", 0.4);
  assert.equal(createdAudio[0].url, resolveReminderSound("soft").url);
  assert.equal(createdAudio[0].volume, 0.4);
  assert.equal(createdAudio[0].preload, "auto");

  await player.play("invalid-sound-id", 2);
  assert.equal(createdAudio[0].paused, true);
  assert.equal(
    createdAudio[1].url,
    resolveReminderSound(DEFAULT_REMINDER_SOUND_ID).url,
  );
  assert.equal(createdAudio[1].volume, 1);

  assert.equal(normalizeSettings({ reminder: {} }).reminder.soundVolume, 0.7);
  assert.equal(
    normalizeSettings({ reminder: { soundVolume: -1 } }).reminder.soundVolume,
    0,
  );
  assert.equal(
    normalizeSettings({ reminder: { soundVolume: 5 } }).reminder.soundVolume,
    1,
  );
  assert.equal(
    normalizeSettings({ reminder: { soundVolume: Number.NaN } }).reminder.soundVolume,
    0.7,
  );

  console.log("Reminder sound tests passed.");
} finally {
  await vite.close();
}
