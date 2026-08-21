<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { dialogueManager } from "../pet/dialogueManager";
import { DIALOGUE_EVENT_TYPE_LIST } from "../pet/dialogueEvents";
import type { DialogueEventType } from "../pet/dialogueEvents";
import type { PetControlAction } from "../pet/petControl";
import { PET_CONTROL_ACTION_TYPES } from "../pet/petControl";

const emit = defineEmits<{
  action: [action: PetControlAction];
}>();

const drafts = ref<Record<DialogueEventType, string[]>>(
  createDrafts(dialogueManager.catalog.value),
);
const savingEvent = ref<DialogueEventType>();
const savedEvent = ref<DialogueEventType>();
const localError = ref("");

const storageError = computed(
  () => localError.value || dialogueManager.lastStorageError.value || "",
);

watch(
  dialogueManager.catalog,
  (catalog) => {
    drafts.value = createDrafts(catalog);
  },
  { deep: true },
);

onMounted(() => {
  void dialogueManager.initialize();
});

function addText(eventType: DialogueEventType): void {
  drafts.value[eventType].push("");
}

function removeText(eventType: DialogueEventType, index: number): void {
  drafts.value[eventType].splice(index, 1);
}

async function saveEvent(eventType: DialogueEventType): Promise<void> {
  savingEvent.value = eventType;
  savedEvent.value = undefined;
  localError.value = "";

  try {
    await dialogueManager.setEventTexts(eventType, drafts.value[eventType]);
    savedEvent.value = eventType;
  } catch (error) {
    localError.value = error instanceof Error ? error.message : String(error);
  } finally {
    savingEvent.value = undefined;
  }
}

function testEvent(eventType: DialogueEventType): void {
  emit("action", {
    type: PET_CONTROL_ACTION_TYPES.TEST_EVENT,
    eventType,
  });
}

function createDrafts(
  catalog: Readonly<Partial<Record<DialogueEventType, readonly string[]>>>,
): Record<DialogueEventType, string[]> {
  return Object.fromEntries(
    DIALOGUE_EVENT_TYPE_LIST.map((eventType) => [
      eventType,
      [...(catalog[eventType] ?? [])],
    ]),
  ) as Record<DialogueEventType, string[]>;
}
</script>

<template>
  <section class="dialogue-editor">
    <header>
      <div>
        <p class="eyebrow">Dialogue Manager</p>
        <h2>Dialogue 编辑</h2>
      </div>
      <span>保存为本地 JSON</span>
    </header>

    <p v-if="storageError" class="error">{{ storageError }}</p>

    <div class="event-list">
      <article v-for="eventType in DIALOGUE_EVENT_TYPE_LIST" :key="eventType">
        <div class="event-heading">
          <div>
            <code>{{ eventType }}</code>
            <small>{{ drafts[eventType].length }} 条候选文本</small>
          </div>
          <button class="secondary" type="button" @click="testEvent(eventType)">
            测试
          </button>
        </div>

        <div class="candidate-list">
          <div
            v-for="(_, index) in drafts[eventType]"
            :key="`${eventType}-${index}`"
            class="candidate"
          >
            <input
              v-model="drafts[eventType][index]"
              type="text"
              :aria-label="`${eventType} 候选文本 ${index + 1}`"
            />
            <button
              class="remove"
              type="button"
              aria-label="删除候选文本"
              @click="removeText(eventType, index)"
            >
              删除
            </button>
          </div>
          <p v-if="drafts[eventType].length === 0" class="empty">
            当前事件不会显示文本。
          </p>
        </div>

        <footer>
          <button class="secondary" type="button" @click="addText(eventType)">
            新增文本
          </button>
          <button
            type="button"
            :disabled="savingEvent === eventType"
            @click="saveEvent(eventType)"
          >
            {{ savingEvent === eventType ? "保存中…" : "保存" }}
          </button>
          <span v-if="savedEvent === eventType">已保存</span>
        </footer>
      </article>
    </div>
  </section>
</template>

<style scoped>
.dialogue-editor {
  display: grid;
  gap: 18px;
}

header,
.event-heading,
footer,
.candidate {
  display: flex;
  align-items: center;
}

header,
.event-heading {
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #8d78db;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h2 {
  margin: 0;
  color: #211b31;
  font-size: 26px;
}

header > span,
small,
footer span {
  color: #81798f;
  font-size: 12px;
}

.event-list {
  display: grid;
  gap: 12px;
}

article {
  display: grid;
  gap: 13px;
  padding: 16px;
  background: #faf9fd;
  border: 1px solid #e8e4f0;
  border-radius: 13px;
}

.event-heading > div {
  display: grid;
  gap: 4px;
}

code {
  color: #54416f;
  font-size: 13px;
  font-weight: 700;
}

.candidate-list {
  display: grid;
  gap: 8px;
}

.candidate {
  gap: 8px;
}

input {
  flex: 1;
  min-width: 0;
  padding: 9px 10px;
  color: #30283d;
  font: inherit;
  font-size: 13px;
  background: #fff;
  border: 1px solid #dcd6e7;
  border-radius: 8px;
  outline: none;
}

input:focus {
  border-color: #8c75dc;
  box-shadow: 0 0 0 3px rgba(140, 117, 220, 0.13);
}

footer {
  gap: 8px;
}

button {
  padding: 7px 11px;
  color: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  background: #6f57c8;
  border: 1px solid #6f57c8;
  border-radius: 8px;
  cursor: pointer;
}

button.secondary {
  color: #5d48a6;
  background: #fff;
  border-color: #d9d1ef;
}

button.remove {
  color: #a64e5b;
  background: transparent;
  border-color: transparent;
}

button:disabled {
  opacity: 0.55;
  cursor: default;
}

.empty {
  margin: 0;
  color: #938b9f;
  font-size: 12px;
}

.error {
  margin: 0;
  padding: 10px 12px;
  color: #9d3f4b;
  font-size: 12px;
  background: #fff0f2;
  border-radius: 9px;
}
</style>
