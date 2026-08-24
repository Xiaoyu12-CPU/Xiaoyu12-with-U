import assert from "node:assert/strict";
import { mock } from "node:test";
import { createServer } from "vite";

const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  mock.timers.enable({ apis: ["setTimeout"] });
  const behavior = await vite.ssrLoadModule("/src/pet/behavior.ts");
  const { selectDialogueText } = await vite.ssrLoadModule("/src/pet/dialogue.ts");
  const {
    createReminderBehaviorSource,
    handleReminderTrigger,
    REMINDER_ALERT_DURATION_MS,
    useReminderRuntimeConsumer,
  } = await vite.ssrLoadModule("/src/reminder/reminderRuntimeConsumer.ts");
  const { REMINDER_TRIGGERED_EVENT } = await vite.ssrLoadModule(
    "/src/reminder/reminderScheduler.ts",
  );

  const reminderSources = [];
  const cleanup = () => {
    for (const source of reminderSources) {
      behavior.releaseState(source);
    }
    behavior.releaseState(behavior.BEHAVIOR_SOURCES.DEVELOPMENT_TIRED);
    behavior.releaseState(behavior.BEHAVIOR_SOURCES.INTERACTION_DRAG);
  };

  try {
    let dialogueEvent;
    const firstPayload = payload("first", "该吃饭啦");
    const firstSource = createReminderBehaviorSource(firstPayload.id);
    reminderSources.push(firstSource);
    handleReminderTrigger(firstPayload, {
      triggerDialogue(type, options) {
        dialogueEvent = { type, ...options };
      },
    });

    assert.equal(behavior.effectiveState.value, "alert");
    const firstRequest = behavior.activeRequests.value.find(
      ({ source }) => source === firstSource,
    );
    assert.equal(firstRequest.priority, behavior.DEFAULT_BEHAVIOR_PRIORITIES.alert);
    assert.equal(firstRequest.durationMs, REMINDER_ALERT_DURATION_MS);
    assert.equal(selectDialogueText(dialogueEvent, {}), "该吃饭啦");

    mock.timers.tick(REMINDER_ALERT_DURATION_MS);
    assert.equal(behavior.effectiveState.value, "idle");

    behavior.requestState({
      source: behavior.BEHAVIOR_SOURCES.DEVELOPMENT_TIRED,
      state: "tired",
    });
    const tiredPayload = payload("with-tired", "休息一下");
    reminderSources.push(createReminderBehaviorSource(tiredPayload.id));
    handleReminderTrigger(tiredPayload, { triggerDialogue() {} });
    assert.equal(behavior.effectiveState.value, "alert");
    mock.timers.tick(REMINDER_ALERT_DURATION_MS);
    assert.equal(behavior.effectiveState.value, "tired");

    behavior.requestState({
      source: behavior.BEHAVIOR_SOURCES.INTERACTION_DRAG,
      state: "dragging",
    });
    const dragPayload = payload("during-drag", "拖动期间提醒");
    reminderSources.push(createReminderBehaviorSource(dragPayload.id));
    handleReminderTrigger(dragPayload, { triggerDialogue() {} });
    assert.equal(behavior.effectiveState.value, "dragging");
    behavior.releaseState(behavior.BEHAVIOR_SOURCES.INTERACTION_DRAG);
    assert.equal(behavior.effectiveState.value, "alert");
    mock.timers.tick(REMINDER_ALERT_DURATION_MS);
    assert.equal(behavior.effectiveState.value, "tired");

    const simultaneousA = payload("simultaneous-a", "A");
    const simultaneousB = payload("simultaneous-b", "B");
    const sourceA = createReminderBehaviorSource(simultaneousA.id);
    const sourceB = createReminderBehaviorSource(simultaneousB.id);
    reminderSources.push(sourceA, sourceB);
    handleReminderTrigger(simultaneousA, { triggerDialogue() {} });
    handleReminderTrigger(simultaneousB, { triggerDialogue() {} });
    const sources = behavior.activeRequests.value.map(({ source }) => source);
    assert.ok(sources.includes(sourceA));
    assert.ok(sources.includes(sourceB));
    assert.notEqual(sourceA, sourceB);

    let fallbackEvent;
    handleReminderTrigger(payload("fallback", "   "), {
      requestBehavior() {},
      triggerDialogue(type, options) {
        fallbackEvent = { type, ...options };
      },
    });
    assert.equal(selectDialogueText(fallbackEvent, {}), "提醒时间到了");

    globalThis.window = new EventTarget();
    const eventPayload = payload("event-only", "只响应 Trigger");
    const eventSource = createReminderBehaviorSource(eventPayload.id);
    reminderSources.push(eventSource);
    useReminderRuntimeConsumer();
    const triggerEvent = new Event(REMINDER_TRIGGERED_EVENT);
    Object.defineProperty(triggerEvent, "detail", { value: eventPayload });
    window.dispatchEvent(triggerEvent);
    assert.ok(
      behavior.activeRequests.value.some(({ source }) => source === eventSource),
    );
    const requestCountAfterTrigger = behavior.activeRequests.value.length;
    window.dispatchEvent(new Event("desktop-pet://reminders-updated"));
    assert.equal(behavior.activeRequests.value.length, requestCountAfterTrigger);
    delete globalThis.window;

    console.log("Reminder runtime consumer tests passed.");
  } finally {
    cleanup();
    mock.timers.reset();
  }

  function payload(id, text) {
    return {
      id,
      text,
      scheduleType: "once",
      scheduledAt: "2026-08-25T12:00:00.000Z",
      triggeredAt: "2026-08-25T12:00:01.000Z",
    };
  }
} finally {
  await vite.close();
}
