<script setup lang="ts">
import { computed } from "vue";
import {
  PET_CONTROL_ACTION_TYPES,
} from "../pet/petControl";
import type {
  PetControlAction,
  PetControlActionType,
} from "../pet/petControl";
import type { PetRuntimeSnapshot } from "../pet/runtimeStatus";

const props = defineProps<{
  snapshot?: PetRuntimeSnapshot;
  connected: boolean;
}>();

const emit = defineEmits<{
  action: [action: PetControlAction];
}>();

const frameName = computed(() => {
  if (!props.snapshot?.currentFrame) {
    return "—";
  }

  const path = props.snapshot.currentFrame.split("?")[0];
  return decodeURIComponent(path.split("/").pop() ?? path);
});

function execute(type: PetControlActionType): void {
  emit("action", { type });
}
</script>

<template>
  <section class="status-page">
    <header>
      <div>
        <p class="eyebrow">Runtime Inspector</p>
        <h2>当前状态</h2>
      </div>
      <span class="connection" :class="{ connected }">
        {{ connected ? "已连接桌宠" : "等待桌宠窗口" }}
      </span>
    </header>

    <div class="status-grid">
      <article>
        <span>PetState</span>
        <strong>{{ snapshot?.state ?? "—" }}</strong>
      </article>
      <article>
        <span>动画状态</span>
        <strong>{{ snapshot?.animationStatus ?? "—" }}</strong>
      </article>
      <article>
        <span>当前帧序号</span>
        <strong>
          {{ snapshot ? snapshot.currentFrameIndex + 1 : "—" }}
        </strong>
      </article>
      <article>
        <span>当前显示帧</span>
        <strong class="frame-name">{{ frameName }}</strong>
      </article>
      <article class="wide">
        <span>最近触发事件</span>
        <strong>{{ snapshot?.lastEvent ?? "尚未触发" }}</strong>
      </article>
      <article class="wide">
        <span>最近显示文本</span>
        <strong>{{ snapshot?.lastText || "尚未显示" }}</strong>
      </article>
    </div>

    <div class="actions">
      <button
        type="button"
        @click="execute(PET_CONTROL_ACTION_TYPES.TEST_EVENT)"
      >
        测试下一个事件
      </button>
      <button
        type="button"
        :disabled="snapshot?.animationStatus === 'paused'"
        @click="execute(PET_CONTROL_ACTION_TYPES.PAUSE_ANIMATION)"
      >
        暂停动画
      </button>
      <button
        type="button"
        :disabled="snapshot?.animationStatus !== 'paused'"
        @click="execute(PET_CONTROL_ACTION_TYPES.RESUME_ANIMATION)"
      >
        恢复动画
      </button>
    </div>
  </section>
</template>

<style scoped>
.status-page {
  display: grid;
  gap: 22px;
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
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

.connection {
  padding: 6px 10px;
  color: #8a5960;
  font-size: 12px;
  background: #fff0f1;
  border-radius: 999px;
}

.connection.connected {
  color: #3f735a;
  background: #e9f8ef;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

article {
  display: grid;
  gap: 7px;
  min-height: 72px;
  padding: 15px;
  background: #faf9fd;
  border: 1px solid #ebe7f3;
  border-radius: 13px;
}

article.wide {
  grid-column: 1 / -1;
}

article span {
  color: #81798f;
  font-size: 12px;
}

article strong {
  color: #2b2438;
  font-size: 15px;
  overflow-wrap: anywhere;
}

.frame-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

button {
  padding: 9px 13px;
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  background: #6f57c8;
  border: 0;
  border-radius: 9px;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: #5d47b2;
}

button:disabled {
  color: #9b94a8;
  background: #e8e5ed;
  cursor: default;
}
</style>
