import assert from "node:assert/strict";
import { mock } from "node:test";
import { createServer } from "vite";

globalThis.window = new EventTarget();
globalThis.localStorage = {
  getItem() {
    return null;
  },
  setItem() {},
};

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  mock.timers.enable({ apis: ["setTimeout"] });
  const { useDialogue } = await vite.ssrLoadModule("/src/pet/dialogue.ts");
  const dialogue = useDialogue({
    displayDurationMs: 100,
    catalog: {
      click: ["普通文本"],
      reminder: ["Reminder fallback"],
    },
  });

  dialogue.notify({ type: "click" });
  assert.equal(dialogue.currentText.value, "普通文本");
  assert.equal(dialogue.isVisible.value, true);
  assert.equal(dialogue.isPersistent.value, false);
  mock.timers.tick(100);
  assert.equal(dialogue.isVisible.value, false);

  dialogue.notify({
    type: "reminder",
    textOverride: "Reminder A",
    persistent: true,
  });
  assert.equal(dialogue.isPersistent.value, true);
  mock.timers.tick(60_000);
  assert.equal(dialogue.isVisible.value, true);
  assert.equal(dialogue.currentText.value, "Reminder A");

  dialogue.notify({ type: "click", textOverride: "不能覆盖" });
  assert.equal(dialogue.currentText.value, "Reminder A");

  dialogue.notify({
    type: "reminder",
    textOverride: "Reminder B",
    persistent: true,
  });
  assert.equal(dialogue.currentText.value, "Reminder B");
  assert.equal(dialogue.isPersistent.value, true);

  dialogue.hide();
  assert.equal(dialogue.isVisible.value, false);
  assert.equal(dialogue.isPersistent.value, false);

  dialogue.notify({ type: "click" });
  assert.equal(dialogue.currentText.value, "普通文本");
  assert.equal(dialogue.isVisible.value, true);
  mock.timers.tick(100);
  assert.equal(dialogue.isVisible.value, false);

  dialogue.dispose();
  console.log("Dialogue lifecycle tests passed.");
} finally {
  mock.timers.reset();
  await vite.close();
  delete globalThis.window;
  delete globalThis.localStorage;
}
