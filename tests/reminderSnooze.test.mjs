import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const {
    createReminderSnoozeInput,
    isSnoozeMinutes,
    SNOOZE_OPTIONS_MINUTES,
    sortReminderSnoozesByTriggerAt,
  } = await vite.ssrLoadModule("/src/reminder/reminderSnooze.ts");

  const now = new Date("2026-08-25T12:00:00.000Z");
  const payload = {
    id: "once-reminder",
    occurrenceId: "once-occurrence",
    occurrenceType: "reminder",
    text: "  原提醒文本  ",
    scheduleType: "once",
    scheduledAt: "2026-08-25T12:00:00.000Z",
    triggeredAt: "2026-08-25T12:00:00.000Z",
    soundEnabled: true,
    soundId: "digital",
  };

  assert.deepEqual(SNOOZE_OPTIONS_MINUTES, [5, 10, 30]);
  for (const minutes of SNOOZE_OPTIONS_MINUTES) {
    const snooze = createReminderSnoozeInput(payload, minutes, now);
    assert.equal(
      Date.parse(snooze.triggerAt) - now.getTime(),
      minutes * 60_000,
    );
    assert.equal(snooze.reminderId, payload.id);
    assert.equal(snooze.text, payload.text);
    assert.equal(snooze.soundEnabled, true);
    assert.equal(snooze.soundId, "digital");
  }

  assert.equal(isSnoozeMinutes(5), true);
  assert.equal(isSnoozeMinutes(7), false);
  assert.throws(
    () => createReminderSnoozeInput(payload, 7, now),
    /Unsupported snooze duration/,
  );

  const unsortedSnoozes = [
    { id: "late", triggerAt: "2026-08-25T12:30:00.000Z" },
    { id: "early", triggerAt: "2026-08-25T12:05:00.000Z" },
    { id: "middle", triggerAt: "2026-08-25T12:10:00.000Z" },
  ];
  assert.deepEqual(
    sortReminderSnoozesByTriggerAt(unsortedSnoozes).map(({ id }) => id),
    ["early", "middle", "late"],
  );
  assert.deepEqual(
    unsortedSnoozes.map(({ id }) => id),
    ["late", "early", "middle"],
  );

  console.log("Reminder snooze tests passed.");
} finally {
  await vite.close();
}
