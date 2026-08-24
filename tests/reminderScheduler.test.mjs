import assert from "node:assert/strict";
import { createServer } from "vite";

process.env.TZ = "America/New_York";

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const {
    createReminderScheduler,
    evaluateReminderOccurrence,
    findNextReminder,
    REMINDER_MAX_TIMER_DELAY_MS,
  } = await vite.ssrLoadModule("/src/reminder/reminderScheduler.ts");

  const futureOnce = reminder({
    id: "future-once",
    date: "2026-08-25",
    time: "14:30",
  });
  const futureOccurrence = evaluateReminderOccurrence(
    futureOnce,
    new Date(2026, 7, 25, 14, 0),
  );
  assert.equal(futureOccurrence.status, "future");
  assert.equal(futureOccurrence.scheduledAt.getHours(), 14);
  assert.equal(futureOccurrence.scheduledAt.getMinutes(), 30);

  const pastOccurrence = evaluateReminderOccurrence(
    futureOnce,
    new Date(2026, 7, 25, 15, 0),
  );
  assert.equal(pastOccurrence.status, "expired");

  const daily = reminder({
    id: "daily",
    scheduleType: "daily",
    date: null,
    time: "12:00",
  });
  const dailyBefore = evaluateReminderOccurrence(daily, new Date(2026, 7, 25, 11, 0));
  assert.equal(dailyBefore.scheduledAt.getDate(), 25);
  const dailyAfter = evaluateReminderOccurrence(daily, new Date(2026, 7, 25, 13, 0));
  assert.equal(dailyAfter.scheduledAt.getDate(), 26);

  const beforeDst = new Date(2026, 2, 7, 13, 0);
  const afterDstOccurrence = evaluateReminderOccurrence(daily, beforeDst);
  assert.equal(
    afterDstOccurrence.scheduledAt.getTime() - beforeDst.getTime(),
    22 * 60 * 60 * 1_000,
  );
  assert.equal(afterDstOccurrence.scheduledAt.getHours(), 12);

  const disabled = reminder({ id: "disabled", enabled: false });
  assert.equal(findNextReminder([disabled], new Date(2026, 7, 25, 10, 0)), undefined);

  const harness = createHarness({
    now: new Date(2026, 7, 25, 10, 0),
    reminders: [
      reminder({ id: "later", date: "2026-08-25", time: "11:00" }),
      reminder({ id: "sooner", date: "2026-08-25", time: "10:30" }),
    ],
  });
  await harness.scheduler.refresh();
  assert.equal(harness.runtime.nextReminder.id, "sooner");
  assert.equal(harness.activeTimers().length, 1);

  harness.reminders[1].time = "12:00";
  await harness.scheduler.refresh();
  assert.equal(harness.runtime.nextReminder.id, "later");
  assert.equal(harness.activeTimers().length, 1);

  harness.reminders.splice(0, 1);
  await harness.scheduler.refresh();
  assert.equal(harness.runtime.nextReminder.id, "sooner");
  assert.equal(harness.activeTimers().length, 1);

  harness.masterEnabled = false;
  await harness.scheduler.refresh();
  assert.equal(harness.runtime.status, "disabled");
  assert.equal(harness.activeTimers().length, 0);

  const longWait = createHarness({
    now: new Date(2026, 7, 25, 10, 0),
    reminders: [reminder({ date: "2026-08-26", time: "10:00" })],
  });
  await longWait.scheduler.refresh();
  assert.equal(longWait.activeTimers()[0].delayMs, REMINDER_MAX_TIMER_DELAY_MS);

  const dueOnce = createHarness({
    now: new Date(2026, 7, 25, 12, 3),
    reminders: [reminder({ id: "once-due", date: "2026-08-25", time: "12:00" })],
  });
  await dueOnce.scheduler.refresh();
  assert.equal(dueOnce.triggers.length, 1);
  assert.equal(dueOnce.reminders[0].enabled, false);
  await dueOnce.scheduler.refresh();
  assert.equal(dueOnce.triggers.length, 1);

  const outsideGrace = createHarness({
    now: new Date(2026, 7, 25, 12, 6),
    reminders: [reminder({ id: "once-missed", date: "2026-08-25", time: "12:00" })],
  });
  await outsideGrace.scheduler.refresh();
  assert.equal(outsideGrace.triggers.length, 0);
  assert.equal(outsideGrace.reminders[0].enabled, false);

  const dailyGrace = createHarness({
    now: new Date(2026, 7, 25, 12, 4),
    reminders: [reminder({
      id: "daily-grace",
      scheduleType: "daily",
      date: null,
      time: "12:00",
    })],
  });
  await dailyGrace.scheduler.refresh();
  await dailyGrace.scheduler.refresh();
  assert.equal(dailyGrace.triggers.length, 1);
  assert.equal(dailyGrace.reminders[0].enabled, true);
  assert.equal(new Date(dailyGrace.runtime.nextReminder.nextTriggerAt).getDate(), 26);

  const dailyMissed = createHarness({
    now: new Date(2026, 7, 25, 12, 6),
    reminders: [reminder({
      id: "daily-missed",
      scheduleType: "daily",
      date: null,
      time: "12:00",
    })],
  });
  await dailyMissed.scheduler.refresh();
  assert.equal(dailyMissed.triggers.length, 0);
  assert.equal(new Date(dailyMissed.runtime.nextReminder.nextTriggerAt).getDate(), 26);

  console.log("Reminder scheduler tests passed.");

  function createHarness({ now, reminders }) {
    const timers = [];
    const triggers = [];
    const runtime = {};
    const harness = {
      currentTime: now,
      reminders,
      triggers,
      runtime,
      masterEnabled: true,
      activeTimers: () => timers.filter(({ active }) => active),
    };
    harness.scheduler = createReminderScheduler({
      getReminders: () => harness.reminders,
      isEnabled: () => harness.masterEnabled,
      async setReminderEnabled(id, enabled) {
        harness.reminders.find((item) => item.id === id).enabled = enabled;
      },
      async publishTrigger(payload) {
        triggers.push(payload);
      },
      updateRuntime(input) {
        Object.assign(runtime, input);
        if (!("nextReminder" in input) || input.nextReminder === undefined) {
          delete runtime.nextReminder;
        }
      },
      now: () => new Date(harness.currentTime),
      setTimer(callback, delayMs) {
        const timer = { callback, delayMs, active: true };
        timers.push(timer);
        return timer;
      },
      clearTimer(timer) {
        timer.active = false;
      },
    });
    return harness;
  }

  function reminder(overrides = {}) {
    return {
      id: "reminder",
      text: "Scheduler Test",
      enabled: true,
      scheduleType: "once",
      date: "2026-08-25",
      time: "14:30",
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
      ...overrides,
    };
  }
} finally {
  await vite.close();
}
