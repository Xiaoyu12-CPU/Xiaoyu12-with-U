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
    activeReminderFeedback,
    createReminderBehaviorSource,
    dismissReminderFeedback,
    handleReminderTrigger,
    REMINDER_ALERT_DURATION_MS,
    snoozeReminderFeedback,
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
    const firstSource = createReminderBehaviorSource(firstPayload.occurrenceId);
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

    let disabledSoundRequests = 0;
    handleReminderTrigger(firstPayload, {
      requestBehavior() {},
      triggerDialogue() {},
      async playSound() {
        disabledSoundRequests += 1;
      },
    });
    assert.equal(disabledSoundRequests, 0);

    let soundRequest;
    handleReminderTrigger({
      ...payload("sound-enabled", "有声音的提醒"),
      soundEnabled: true,
      soundId: "digital",
    }, {
      requestBehavior() {},
      triggerDialogue() {},
      async playSound(soundId, volume) {
        soundRequest = { soundId, volume };
      },
      getSoundVolume: () => 0.35,
    });
    assert.deepEqual(soundRequest, { soundId: "digital", volume: 0.35 });

    let behaviorHandled = false;
    let dialogueHandled = false;
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      handleReminderTrigger({
        ...payload("sound-failure", "声音失败也要反馈"),
        soundEnabled: true,
        soundId: "soft",
      }, {
        requestBehavior() {
          behaviorHandled = true;
        },
        triggerDialogue() {
          dialogueHandled = true;
        },
        async playSound() {
          throw new Error("test playback failure");
        },
      });
      await Promise.resolve();
    } finally {
      console.error = originalConsoleError;
    }
    assert.equal(behaviorHandled, true);
    assert.equal(dialogueHandled, true);

    mock.timers.tick(REMINDER_ALERT_DURATION_MS);
    assert.equal(behavior.effectiveState.value, "idle");

    behavior.requestState({
      source: behavior.BEHAVIOR_SOURCES.DEVELOPMENT_TIRED,
      state: "tired",
    });
    const tiredPayload = payload("with-tired", "休息一下");
    reminderSources.push(createReminderBehaviorSource(tiredPayload.occurrenceId));
    handleReminderTrigger(tiredPayload, { triggerDialogue() {} });
    assert.equal(behavior.effectiveState.value, "alert");
    mock.timers.tick(REMINDER_ALERT_DURATION_MS);
    assert.equal(behavior.effectiveState.value, "tired");

    behavior.requestState({
      source: behavior.BEHAVIOR_SOURCES.INTERACTION_DRAG,
      state: "dragging",
    });
    const dragPayload = payload("during-drag", "拖动期间提醒");
    reminderSources.push(createReminderBehaviorSource(dragPayload.occurrenceId));
    handleReminderTrigger(dragPayload, { triggerDialogue() {} });
    assert.equal(behavior.effectiveState.value, "dragging");
    behavior.releaseState(behavior.BEHAVIOR_SOURCES.INTERACTION_DRAG);
    assert.equal(behavior.effectiveState.value, "alert");
    mock.timers.tick(REMINDER_ALERT_DURATION_MS);
    assert.equal(behavior.effectiveState.value, "tired");

    const simultaneousA = payload("same-reminder", "A", "occurrence-a");
    const simultaneousB = payload("same-reminder", "B", "occurrence-b");
    const sourceA = createReminderBehaviorSource(simultaneousA.occurrenceId);
    const sourceB = createReminderBehaviorSource(simultaneousB.occurrenceId);
    reminderSources.push(sourceA, sourceB);
    handleReminderTrigger(simultaneousA, { triggerDialogue() {} });
    handleReminderTrigger(simultaneousB, { triggerDialogue() {} });
    const sources = behavior.activeRequests.value.map(({ source }) => source);
    assert.ok(sources.includes(sourceA));
    assert.ok(sources.includes(sourceB));
    assert.notEqual(sourceA, sourceB);

    const dismissPayload = payload("dismiss", "完成测试");
    const dismissSource = createReminderBehaviorSource(dismissPayload.occurrenceId);
    reminderSources.push(dismissSource);
    handleReminderTrigger(dismissPayload, { triggerDialogue() {} });
    let dialogueHidden = false;
    let soundStopped = false;
    assert.equal(dismissReminderFeedback(dismissPayload.occurrenceId, {
      hideDialogue() {
        dialogueHidden = true;
      },
      stopSound() {
        soundStopped = true;
      },
    }), true);
    assert.equal(dialogueHidden, true);
    assert.equal(soundStopped, true);
    assert.ok(!behavior.activeRequests.value.some(({ source }) => source === dismissSource));
    assert.equal(activeReminderFeedback.value, undefined);

    const snoozePayload = {
      ...payload("daily-source", "提交报告"),
      scheduleType: "daily",
      soundEnabled: true,
      soundId: "soft",
    };
    const snoozeSource = createReminderBehaviorSource(snoozePayload.occurrenceId);
    reminderSources.push(snoozeSource);
    handleReminderTrigger(snoozePayload, {
      triggerDialogue() {},
      async playSound() {},
    });
    let snoozeInput;
    let snoozeSoundStopped = false;
    const snoozed = await snoozeReminderFeedback(snoozePayload.occurrenceId, 10, {
      now: () => new Date("2026-08-25T12:00:00.000Z"),
      async createSnooze(input) {
        snoozeInput = input;
        return {
          id: "created-snooze",
          ...input,
          createdAt: "2026-08-25T12:00:00.000Z",
        };
      },
      stopSound() {
        snoozeSoundStopped = true;
      },
    });
    assert.equal(snoozed.id, "created-snooze");
    assert.equal(snoozeInput.triggerAt, "2026-08-25T12:10:00.000Z");
    assert.equal(snoozeInput.scheduleType, "daily");
    assert.equal(snoozeInput.text, "提交报告");
    assert.equal(snoozeInput.soundId, "soft");
    assert.equal(snoozeSoundStopped, true);
    assert.ok(!behavior.activeRequests.value.some(({ source }) => source === snoozeSource));

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
    const eventSource = createReminderBehaviorSource(eventPayload.occurrenceId);
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

  function payload(id, text, occurrenceId = `${id}-occurrence`) {
    return {
      id,
      occurrenceId,
      occurrenceType: "reminder",
      text,
      scheduleType: "once",
      scheduledAt: "2026-08-25T12:00:00.000Z",
      triggeredAt: "2026-08-25T12:00:01.000Z",
      soundEnabled: false,
      soundId: null,
    };
  }
} finally {
  await vite.close();
}
