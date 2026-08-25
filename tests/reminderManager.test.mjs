import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { createReminderManager } = await vite.ssrLoadModule(
    "/src/reminder/reminderManager.ts",
  );
  let storedDocument;
  const broadcasts = [];
  const storage = {
    async load() {
      return storedDocument ? structuredClone(storedDocument) : undefined;
    },
    async save(document) {
      storedDocument = structuredClone(document);
    },
    async broadcast(document) {
      broadcasts.push(structuredClone(document));
    },
    async subscribe() {
      return () => {};
    },
  };
  let timestamp = Date.parse("2026-08-24T00:00:00.000Z");
  let idSequence = 0;
  const createManager = () => createReminderManager({
    storage,
    now: () => new Date(timestamp += 1_000),
    createId: () => `reminder-${idSequence += 1}`,
  });
  const manager = createManager();
  await manager.initialize();
  assert.deepEqual(manager.reminders.value, []);
  assert.deepEqual(manager.snoozes.value, []);

  const once = await manager.create({
    text: "  开会时间到了  ",
    enabled: true,
    scheduleType: "once",
    date: "2026-08-26",
    time: "14:30",
  });
  const daily = await manager.create({
    text: "该吃饭啦",
    enabled: true,
    scheduleType: "daily",
    date: null,
    time: "12:00",
  });
  const audible = await manager.create({
    text: "有声音的提醒",
    enabled: true,
    scheduleType: "daily",
    date: null,
    time: "18:00",
    soundEnabled: true,
    soundId: "soft",
  });
  assert.equal(once.text, "开会时间到了");
  assert.equal(daily.date, null);
  assert.equal(once.soundEnabled, false);
  assert.equal(once.soundId, null);
  assert.equal(daily.soundEnabled, false);
  assert.equal(daily.soundId, null);
  assert.equal(audible.soundEnabled, true);
  assert.equal(audible.soundId, "soft");
  assert.equal(manager.reminders.value.length, 3);

  const snooze = await manager.createSnooze({
    reminderId: daily.id,
    scheduleType: daily.scheduleType,
    text: daily.text,
    soundEnabled: daily.soundEnabled,
    soundId: daily.soundId,
    triggerAt: "2026-08-24T00:10:00.000Z",
  });
  assert.equal(snooze.reminderId, daily.id);
  assert.equal(snooze.text, "该吃饭啦");
  assert.equal(manager.snoozes.value.length, 1);

  const updated = await manager.update(once.id, {
    text: "会议提前了",
    enabled: true,
    scheduleType: "once",
    date: "2026-08-26",
    time: "14:00",
  });
  assert.equal(updated.text, "会议提前了");
  assert.equal(updated.time, "14:00");

  await manager.setEnabled(daily.id, false);
  assert.equal(manager.reminders.value.find(({ id }) => id === daily.id)?.enabled, false);
  await manager.setEnabled(daily.id, true);
  assert.equal(manager.reminders.value.find(({ id }) => id === daily.id)?.enabled, true);

  await manager.update(daily.id, {
    text: "原提醒文本已修改",
    enabled: true,
    scheduleType: "daily",
    date: null,
    time: "12:00",
  });
  assert.equal(manager.snoozes.value[0].text, "该吃饭啦");

  const reloadedManager = createManager();
  await reloadedManager.load();
  assert.deepEqual(reloadedManager.reminders.value, manager.reminders.value);
  assert.deepEqual(reloadedManager.snoozes.value, manager.snoozes.value);
  assert.equal(
    reloadedManager.reminders.value.find(({ id }) => id === audible.id)?.soundId,
    "soft",
  );

  await manager.delete(once.id);
  assert.deepEqual(manager.reminders.value.map(({ id }) => id), [daily.id, audible.id]);
  assert.equal(manager.snoozes.value.length, 1);
  await manager.deleteSnooze(snooze.id);
  assert.deepEqual(manager.snoozes.value, []);
  assert.equal(manager.reminders.value.some(({ id }) => id === daily.id), true);
  assert.deepEqual(broadcasts.at(-1).snoozes, []);
  assert.equal(broadcasts.at(-1).reminders.some(({ id }) => id === daily.id), true);

  const legacyManager = createReminderManager({
    storage: {
      async load() {
        return { schemaVersion: 1, reminders: [] };
      },
      async save() {},
      async broadcast() {},
      async subscribe() {
        return () => {};
      },
    },
  });
  await legacyManager.load();
  assert.deepEqual(legacyManager.snoozes.value, []);

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const corruptManager = createReminderManager({
      storage: {
        async load() {
          return { schemaVersion: 1, reminders: "broken" };
        },
        async save() {},
        async broadcast() {},
        async subscribe() {
          return () => {};
        },
      },
    });
    await corruptManager.load();
    assert.deepEqual(corruptManager.reminders.value, []);
    assert.deepEqual(corruptManager.snoozes.value, []);
    assert.match(corruptManager.lastError.value, /Unsupported reminders JSON format/);
  } finally {
    console.error = originalConsoleError;
  }

  console.log("Reminder manager tests passed.");
} finally {
  await vite.close();
}
