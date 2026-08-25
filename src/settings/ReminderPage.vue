<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { reminderManager } from "../reminder/reminderManager";
import { playReminderSound } from "../reminder/reminderSoundPlayer";
import { sortReminderSnoozesByTriggerAt } from "../reminder/reminderSnooze";
import {
  DEFAULT_REMINDER_SOUND_ID,
  REMINDER_SOUNDS,
} from "../reminder/reminderSounds";
import type {
  Reminder,
  ReminderInput,
  ReminderScheduleType,
} from "../reminder/reminderTypes";
import type { PetRuntimeSnapshot } from "../pet/runtimeStatus";
import { settingsManager } from "./settingsManager";

defineProps<{
  runtime?: PetRuntimeSnapshot;
}>();

const isEditing = ref(false);
const editingId = ref<string>();
const pendingDeleteId = ref<string>();
const cancelingSnoozeId = ref<string>();
const formError = ref<string>();
const form = reactive<ReminderInput>(createEmptyForm());
const selectedSoundId = computed({
  get: () => form.soundId ?? DEFAULT_REMINDER_SOUND_ID,
  set: (value) => {
    form.soundId = value;
  },
});
const pendingSnoozes = computed(() =>
  sortReminderSnoozesByTriggerAt(reminderManager.snoozes.value),
);

onMounted(() => {
  void reminderManager.initialize();
  void settingsManager.initialize();
});

function beginCreate(): void {
  editingId.value = undefined;
  Object.assign(form, createEmptyForm());
  formError.value = undefined;
  isEditing.value = true;
}

function beginEdit(reminder: Reminder): void {
  editingId.value = reminder.id;
  Object.assign(form, {
    text: reminder.text,
    enabled: reminder.enabled,
    scheduleType: reminder.scheduleType,
    date: reminder.date,
    time: reminder.time,
    soundEnabled: reminder.soundEnabled,
    soundId: reminder.soundId,
  });
  formError.value = undefined;
  pendingDeleteId.value = undefined;
  isEditing.value = true;
}

function cancelEdit(): void {
  isEditing.value = false;
  editingId.value = undefined;
  formError.value = undefined;
}

function setScheduleType(scheduleType: ReminderScheduleType): void {
  form.scheduleType = scheduleType;
  form.date = scheduleType === "once" ? (form.date ?? today()) : null;
}

async function saveReminder(): Promise<void> {
  formError.value = undefined;

  try {
    const input: ReminderInput = {
      text: form.text,
      enabled: form.enabled,
      scheduleType: form.scheduleType,
      date: form.scheduleType === "once" ? form.date : null,
      time: form.time,
      soundEnabled: form.soundEnabled,
      soundId: form.soundEnabled ? selectedSoundId.value : form.soundId,
    };

    if (editingId.value) {
      await reminderManager.update(editingId.value, input);
    } else {
      await reminderManager.create(input);
    }
    cancelEdit();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error);
  }
}

function updateSoundEnabled(event: Event): void {
  form.soundEnabled = (event.target as HTMLInputElement).checked;
  if (form.soundEnabled && form.soundId === null) {
    form.soundId = DEFAULT_REMINDER_SOUND_ID;
  }
}

async function previewSound(): Promise<void> {
  formError.value = undefined;
  try {
    await playReminderSound(
      selectedSoundId.value,
      settingsManager.settings.value.reminder.soundVolume,
    );
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error);
  }
}

async function toggleReminder(reminder: Reminder): Promise<void> {
  try {
    await reminderManager.setEnabled(reminder.id, !reminder.enabled);
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error);
  }
}

async function confirmDelete(id: string): Promise<void> {
  try {
    await reminderManager.delete(id);
    pendingDeleteId.value = undefined;
    if (editingId.value === id) {
      cancelEdit();
    }
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error);
  }
}

async function cancelSnooze(id: string): Promise<void> {
  cancelingSnoozeId.value = id;
  try {
    await reminderManager.deleteSnooze(id);
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error);
  } finally {
    cancelingSnoozeId.value = undefined;
  }
}

function createEmptyForm(): ReminderInput {
  return {
    text: "",
    enabled: true,
    scheduleType: "once",
    date: today(),
    time: "09:00",
    soundEnabled: false,
    soundId: null,
  };
}

function today(): string {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function formatRuntimeDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
</script>

<template>
  <section class="reminder-page">
    <header>
      <div>
        <p class="eyebrow">Reminder Management</p>
        <h2>提醒</h2>
        <p class="subtitle">Scheduler 按本机当前时区调度，并提供 ALERT、文本与可选内置声音反馈。</p>
      </div>
      <button v-if="!isEditing" class="primary" type="button" @click="beginCreate">
        新增提醒
      </button>
    </header>

    <p v-if="reminderManager.lastError.value" class="error">
      读取提醒失败，当前使用安全空列表：{{ reminderManager.lastError.value }}
    </p>
    <p v-if="formError" class="error">{{ formError }}</p>

    <article class="scheduler-status">
      <div>
        <p class="eyebrow">Reminder System</p>
        <strong>{{ settingsManager.settings.value.reminder.enabled ? "Enabled" : "Paused" }}</strong>
      </div>
      <div class="runtime-detail">
        <span>Scheduler</span>
        <strong v-if="runtime">
          {{ runtime.reminderSchedulerStatus === "enabled" ? "Active" : "Paused" }}
        </strong>
        <strong v-else>连接中…</strong>
      </div>
      <div class="runtime-detail">
        <span>Next Reminder</span>
        <strong v-if="runtime?.nextReminder">{{ runtime.nextReminder.text }}</strong>
        <small v-if="runtime?.nextReminder">
          {{ runtime.nextReminder.occurrenceType === "snooze"
            ? "稍后提醒"
            : runtime.nextReminder.scheduleType === "once" ? "一次" : "每日" }} ·
          {{ formatRuntimeDate(runtime.nextReminder.nextTriggerAt) }}
        </small>
        <small v-else>暂无待触发提醒</small>
      </div>
      <div class="runtime-detail">
        <span>Last Trigger</span>
        <strong v-if="runtime?.lastReminderTrigger">
          {{ runtime.lastReminderTrigger.text }}
        </strong>
        <small v-if="runtime?.lastReminderTrigger">
          {{ formatRuntimeDate(runtime.lastReminderTrigger.triggeredAt) }}
        </small>
        <small v-else>暂无触发记录</small>
      </div>
    </article>

    <section class="pending-snoozes">
      <div class="pending-snoozes__heading">
        <div>
          <p class="eyebrow">Pending Snooze</p>
          <h3>稍后提醒</h3>
        </div>
        <span>{{ pendingSnoozes.length }} 项</span>
      </div>
      <div
        v-for="snooze in pendingSnoozes"
        :key="snooze.id"
        class="pending-snoozes__row"
      >
        <div>
          <strong>{{ snooze.text }}</strong>
          <small>{{ formatRuntimeDate(snooze.triggerAt) }}</small>
        </div>
        <button
          type="button"
          :disabled="cancelingSnoozeId === snooze.id"
          @click="cancelSnooze(snooze.id)"
        >
          {{ cancelingSnoozeId === snooze.id ? "取消中…" : "取消" }}
        </button>
      </div>
      <p v-if="pendingSnoozes.length === 0" class="pending-snoozes__empty">
        暂无稍后提醒
      </p>
    </section>

    <form v-if="isEditing" class="editor" @submit.prevent="saveReminder">
      <div class="editor-heading">
        <div>
          <p class="eyebrow">{{ editingId ? "Edit Reminder" : "New Reminder" }}</p>
          <h3>{{ editingId ? "编辑提醒" : "新增提醒" }}</h3>
        </div>
        <label class="enabled-control">
          <span>启用</span>
          <input v-model="form.enabled" type="checkbox" />
        </label>
      </div>

      <label class="field field--wide">
        <span>提醒内容</span>
        <input v-model="form.text" type="text" maxlength="500" placeholder="例如：开会时间到了" />
      </label>

      <fieldset>
        <legend>类型</legend>
        <label>
          <input
            type="radio"
            name="schedule-type"
            :checked="form.scheduleType === 'once'"
            @change="setScheduleType('once')"
          />
          一次
        </label>
        <label>
          <input
            type="radio"
            name="schedule-type"
            :checked="form.scheduleType === 'daily'"
            @change="setScheduleType('daily')"
          />
          每日
        </label>
      </fieldset>

      <div class="date-time-fields">
        <label v-if="form.scheduleType === 'once'" class="field">
          <span>日期</span>
          <input v-model="form.date" type="date" required />
        </label>
        <label class="field">
          <span>时间</span>
          <input v-model="form.time" type="time" required />
        </label>
      </div>

      <div class="sound-fields">
        <label class="enabled-control">
          <span>播放声音</span>
          <input
            type="checkbox"
            :checked="form.soundEnabled"
            @change="updateSoundEnabled"
          />
        </label>
        <label v-if="form.soundEnabled" class="field sound-select">
          <span>声音</span>
          <select v-model="selectedSoundId">
            <option
              v-for="sound in REMINDER_SOUNDS"
              :key="sound.id"
              :value="sound.id"
            >
              {{ sound.label }}
            </option>
          </select>
        </label>
        <button
          v-if="form.soundEnabled"
          type="button"
          @click="previewSound"
        >
          试听
        </button>
      </div>

      <div class="editor-actions">
        <button type="button" @click="cancelEdit">取消</button>
        <button class="primary" type="submit" :disabled="reminderManager.isSaving.value">
          {{ reminderManager.isSaving.value ? "保存中…" : "保存" }}
        </button>
      </div>
    </form>

    <div v-if="!reminderManager.isLoaded.value" class="empty-state">正在读取提醒…</div>
    <div v-else-if="reminderManager.reminders.value.length === 0" class="empty-state">
      <strong>还没有提醒</strong>
      <span>可以创建一次性或每日提醒，并按需启用内置声音。</span>
    </div>
    <div v-else class="reminder-list">
      <article v-for="reminder in reminderManager.reminders.value" :key="reminder.id">
        <div class="reminder-main">
          <div class="reminder-title">
            <span :class="['status-dot', { disabled: !reminder.enabled }]" />
            <strong>{{ reminder.text }}</strong>
          </div>
          <div class="schedule">
            <span>{{ reminder.scheduleType === "once" ? "一次" : "每日" }}</span>
            <time v-if="reminder.date">{{ reminder.date }}</time>
            <time>{{ reminder.time }}</time>
            <span>{{ reminder.enabled ? "已启用" : "已停用" }}</span>
            <span v-if="reminder.soundEnabled">声音</span>
          </div>
        </div>

        <div v-if="pendingDeleteId !== reminder.id" class="row-actions">
          <button type="button" @click="beginEdit(reminder)">编辑</button>
          <button type="button" @click="toggleReminder(reminder)">
            {{ reminder.enabled ? "停用" : "启用" }}
          </button>
          <button class="danger" type="button" @click="pendingDeleteId = reminder.id">
            删除
          </button>
        </div>
        <div v-else class="delete-confirmation">
          <span>确认删除？</span>
          <button class="danger" type="button" @click="confirmDelete(reminder.id)">确认</button>
          <button type="button" @click="pendingDeleteId = undefined">取消</button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.reminder-page { display: grid; gap: 18px; color: #30283d; }
header, .editor-heading, .editor-actions, .reminder-list article, .schedule, .row-actions, .delete-confirmation { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.eyebrow { margin: 0 0 4px; color: #8d78db; font-size: 11px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
h2, h3, p { margin: 0; }
h2 { color: #211b31; font-size: 26px; }
h3 { font-size: 17px; }
.subtitle { margin-top: 5px; color: #857c91; font-size: 11px; }
button { padding: 8px 11px; color: #5d48a6; font: inherit; font-size: 12px; font-weight: 650; background: #fff; border: 1px solid #d9d1ef; border-radius: 8px; cursor: pointer; }
button:hover { background: #f3efff; }
button:disabled { cursor: default; opacity: .55; }
.primary { color: #fff; background: #745bc9; border-color: #745bc9; }
.primary:hover { background: #654db9; }
.danger { color: #a44050; border-color: #e9cbd0; }
.editor, .reminder-list article, .empty-state, .scheduler-status, .pending-snoozes { padding: 17px; background: #faf9fd; border: 1px solid #e8e4f0; border-radius: 13px; }
.scheduler-status { display: grid; grid-template-columns: minmax(110px, .7fr) minmax(90px, .6fr) repeat(2, minmax(150px, 1fr)); gap: 16px; }
.scheduler-status > div { display: grid; align-content: start; gap: 4px; min-width: 0; }
.scheduler-status strong { overflow: hidden; color: #433750; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.runtime-detail { padding-left: 14px; border-left: 1px solid #e5dfed; }
.runtime-detail span, .runtime-detail small { color: #8a8094; font-size: 10px; }
.pending-snoozes { display: grid; gap: 10px; }
.pending-snoozes__heading, .pending-snoozes__row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.pending-snoozes__heading > span { color: #8a8094; font-size: 11px; }
.pending-snoozes__row { padding-top: 9px; border-top: 1px solid #ebe6f1; }
.pending-snoozes__row > div { display: grid; gap: 3px; min-width: 0; }
.pending-snoozes__row strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.pending-snoozes__row small { color: #8a8094; font-size: 10px; }
.pending-snoozes__empty { padding: 12px 0 2px; color: #8a8094; font-size: 12px; text-align: center; }
.editor { display: grid; gap: 15px; }
.enabled-control { display: flex; align-items: center; gap: 8px; color: #655b70; font-size: 12px; }
.enabled-control input, fieldset input { accent-color: #745bc9; }
.field { display: grid; gap: 6px; min-width: 180px; color: #6e6479; font-size: 11px; }
.field--wide { width: 100%; }
.field input { padding: 9px 10px; color: #30283d; font: inherit; font-size: 13px; background: #fff; border: 1px solid #dcd6e7; border-radius: 8px; }
.field select { padding: 9px 10px; color: #30283d; font: inherit; font-size: 12px; background: #fff; border: 1px solid #dcd6e7; border-radius: 8px; }
fieldset { display: flex; gap: 18px; margin: 0; padding: 0; border: 0; }
fieldset legend { margin-bottom: 7px; color: #6e6479; font-size: 11px; }
fieldset label { display: flex; align-items: center; gap: 6px; color: #4d4358; font-size: 12px; }
.date-time-fields { display: flex; gap: 14px; }
.sound-fields { display: flex; align-items: flex-end; gap: 14px; padding-top: 12px; border-top: 1px solid #ebe6f1; }
.sound-select { flex: 1; }
.editor-actions { justify-content: flex-end; padding-top: 2px; }
.empty-state { display: grid; gap: 5px; min-height: 110px; color: #8a8094; font-size: 12px; place-content: center; text-align: center; }
.empty-state strong { color: #4e4359; font-size: 14px; }
.reminder-list { display: grid; gap: 10px; }
.reminder-main { display: grid; gap: 7px; min-width: 0; }
.reminder-title { display: flex; align-items: center; gap: 8px; }
.reminder-title strong { overflow: hidden; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.status-dot { width: 8px; height: 8px; background: #6ab493; border-radius: 50%; flex: none; }
.status-dot.disabled { background: #b9b1c1; }
.schedule { justify-content: flex-start; gap: 7px; color: #81778c; font-size: 10px; }
.schedule span, .schedule time { padding: 3px 6px; background: #f0edf5; border-radius: 5px; }
.row-actions, .delete-confirmation { justify-content: flex-end; flex: none; }
.delete-confirmation span { color: #9b4552; font-size: 11px; }
.error { padding: 10px 12px; color: #9d3f4b; font-size: 12px; background: #fff0f2; border-radius: 9px; }
@media (max-width: 720px) {
  header, .reminder-list article { align-items: flex-start; flex-direction: column; }
  .date-time-fields { flex-direction: column; }
  .sound-fields { align-items: stretch; flex-direction: column; }
  .row-actions, .delete-confirmation { align-self: stretch; justify-content: flex-start; }
  .scheduler-status { grid-template-columns: 1fr; }
  .runtime-detail { padding: 10px 0 0; border-top: 1px solid #e5dfed; border-left: 0; }
}
</style>
