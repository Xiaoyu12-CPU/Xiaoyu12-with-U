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
    evaluateSnoozeOccurrence,
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
  assert.equal(dueOnce.triggers[0].soundEnabled, false);
  assert.equal(dueOnce.triggers[0].soundId, null);
  assert.equal(dueOnce.triggers[0].occurrenceType, "reminder");
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

  const futureSnooze = snooze({ triggerAt: "2026-08-25T14:10:00.000-04:00" });
  assert.equal(
    evaluateSnoozeOccurrence(futureSnooze, new Date(2026, 7, 25, 14, 0)).status,
    "future",
  );

  const snoozeFirst = createHarness({
    now: new Date(2026, 7, 25, 10, 0),
    reminders: [reminder({ id: "daily-source", scheduleType: "daily", date: null, time: "12:00" })],
    snoozes: [snooze({ id: "snooze-next", reminderId: "daily-source", triggerAt: new Date(2026, 7, 25, 10, 5).toISOString() })],
  });
  await snoozeFirst.scheduler.refresh();
  assert.equal(snoozeFirst.runtime.nextReminder.occurrenceType, "snooze");
  assert.equal(snoozeFirst.runtime.nextReminder.occurrenceId, "snooze-next");

  snoozeFirst.snoozes.splice(0, 1);
  await snoozeFirst.scheduler.refresh();
  assert.equal(snoozeFirst.runtime.nextReminder.occurrenceType, "reminder");
  assert.equal(snoozeFirst.runtime.nextReminder.id, "daily-source");
  assert.equal(snoozeFirst.reminders[0].time, "12:00");

  snoozeFirst.snoozes.push(snooze({
    id: "snooze-next",
    reminderId: "daily-source",
    triggerAt: new Date(2026, 7, 25, 10, 5).toISOString(),
  }));

  snoozeFirst.currentTime = new Date(2026, 7, 25, 10, 5);
  await snoozeFirst.scheduler.refresh();
  assert.equal(snoozeFirst.triggers.length, 1);
  assert.equal(snoozeFirst.triggers[0].occurrenceType, "snooze");
  assert.equal(snoozeFirst.triggers[0].occurrenceId, "snooze-next");
  assert.equal(snoozeFirst.snoozes.length, 0);
  assert.equal(snoozeFirst.reminders[0].time, "12:00");

  const snoozeGrace = createHarness({
    now: new Date(2026, 7, 25, 12, 4),
    reminders: [],
    snoozes: [snooze({ id: "snooze-grace", triggerAt: new Date(2026, 7, 25, 12, 0).toISOString() })],
  });
  await snoozeGrace.scheduler.refresh();
  assert.equal(snoozeGrace.triggers.length, 1);
  assert.equal(snoozeGrace.snoozes.length, 0);

  const snoozeExpired = createHarness({
    now: new Date(2026, 7, 25, 12, 6),
    reminders: [],
    snoozes: [snooze({ id: "snooze-expired", triggerAt: new Date(2026, 7, 25, 12, 0).toISOString() })],
  });
  await snoozeExpired.scheduler.refresh();
  assert.equal(snoozeExpired.triggers.length, 0);
  assert.equal(snoozeExpired.snoozes.length, 0);

  const snoozeMasterOff = createHarness({
    now: new Date(2026, 7, 25, 12, 0),
    reminders: [],
    snoozes: [snooze({ id: "snooze-paused", triggerAt: new Date(2026, 7, 25, 12, 0).toISOString() })],
  });
  snoozeMasterOff.masterEnabled = false;
  await snoozeMasterOff.scheduler.refresh();
  assert.equal(snoozeMasterOff.triggers.length, 0);
  assert.equal(snoozeMasterOff.snoozes.length, 1);
  snoozeMasterOff.masterEnabled = true;
  snoozeMasterOff.currentTime = new Date(2026, 7, 25, 11, 55);
  snoozeMasterOff.snoozes[0].triggerAt = new Date(2026, 7, 25, 12, 0).toISOString();
  await snoozeMasterOff.scheduler.refresh();
  assert.equal(snoozeMasterOff.runtime.status, "enabled");
  assert.equal(snoozeMasterOff.runtime.nextReminder.occurrenceType, "snooze");
  assert.equal(snoozeMasterOff.snoozes.length, 1);

  const snoozeDuplicate = createHarness({
    now: new Date(2026, 7, 25, 12, 0),
    reminders: [],
    snoozes: [snooze({ id: "snooze-duplicate", triggerAt: new Date(2026, 7, 25, 12, 0).toISOString() })],
    retainTriggeredSnooze: true,
  });
  await snoozeDuplicate.scheduler.refresh();
  await snoozeDuplicate.scheduler.refresh();
  assert.equal(snoozeDuplicate.triggers.length, 1);

  console.log("Reminder scheduler tests passed.");

  function createHarness({ now, reminders, snoozes = [], retainTriggeredSnooze = false }) {
    const timers = [];
    const triggers = [];
    const runtime = {};
    const harness = {
      currentTime: now,
      reminders,
      snoozes,
      triggers,
      runtime,
      masterEnabled: true,
      activeTimers: () => timers.filter(({ active }) => active),
    };
    harness.scheduler = createReminderScheduler({
      getReminders: () => harness.reminders,
      getSnoozes: () => harness.snoozes,
      isEnabled: () => harness.masterEnabled,
      async setReminderEnabled(id, enabled) {
        harness.reminders.find((item) => item.id === id).enabled = enabled;
      },
      async deleteSnooze(id) {
        if (!retainTriggeredSnooze) {
          const index = harness.snoozes.findIndex((item) => item.id === id);
          harness.snoozes.splice(index, 1);
        }
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
      soundEnabled: false,
      soundId: null,
      ...overrides,
    };
  }

  function snooze(overrides = {}) {
    return {
      id: "snooze",
      reminderId: "reminder",
      scheduleType: "once",
      text: "Snoozed Test",
      soundEnabled: true,
      soundId: "soft",
      triggerAt: "2026-08-25T14:30:00.000-04:00",
      createdAt: "2026-08-25T14:00:00.000-04:00",
      ...overrides,
    };
  }
} finally {
  await vite.close();
}
