<script setup lang="ts">
import { ref } from "vue";
import {
  SNOOZE_OPTIONS_MINUTES,
  type SnoozeMinutes,
} from "../reminder/reminderSnooze";

const emit = defineEmits<{
  dismiss: [];
  snooze: [minutes: SnoozeMinutes];
}>();
const showsSnoozeOptions = ref(false);
</script>

<template>
  <div
    class="reminder-actions"
    @click.stop
    @pointerdown.stop
    @pointerup.stop
  >
    <div class="reminder-actions__primary">
      <button type="button" @click="emit('dismiss')">完成</button>
      <button
        type="button"
        @click="showsSnoozeOptions = !showsSnoozeOptions"
      >
        稍后提醒
      </button>
    </div>
    <div v-if="showsSnoozeOptions" class="reminder-actions__snooze">
      <button
        v-for="minutes in SNOOZE_OPTIONS_MINUTES"
        :key="minutes"
        type="button"
        @click="emit('snooze', minutes)"
      >
        {{ minutes }}分钟
      </button>
    </div>
  </div>
</template>

<style scoped>
.reminder-actions {
  display: grid;
  gap: 5px;
  margin-top: 7px;
  pointer-events: auto;
}

.reminder-actions__primary,
.reminder-actions__snooze {
  display: flex;
  justify-content: center;
  gap: 4px;
}

button {
  padding: 3px 6px;
  color: #5d48a6;
  font: inherit;
  font-size: 9px;
  font-weight: 700;
  background: #f7f3ff;
  border: 1px solid #d8cff1;
  border-radius: 5px;
  cursor: pointer;
}

button:hover {
  background: #ede6ff;
}
</style>
