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
  const storage = {
    async load() {
      return storedDocument ? structuredClone(storedDocument) : undefined;
    },
    async save(document) {
      storedDocument = structuredClone(document);
    },
    async broadcast() {},
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
  assert.equal(once.text, "开会时间到了");
  assert.equal(daily.date, null);
  assert.equal(manager.reminders.value.length, 2);

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

  const reloadedManager = createManager();
  await reloadedManager.load();
  assert.deepEqual(reloadedManager.reminders.value, manager.reminders.value);

  await manager.delete(once.id);
  assert.deepEqual(manager.reminders.value.map(({ id }) => id), [daily.id]);

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
    assert.match(corruptManager.lastError.value, /Unsupported reminders JSON format/);
  } finally {
    console.error = originalConsoleError;
  }

  console.log("Reminder manager tests passed.");
} finally {
  await vite.close();
}
