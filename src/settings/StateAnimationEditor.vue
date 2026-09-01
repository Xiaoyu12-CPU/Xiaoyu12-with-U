<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { usePetAnimation } from "../pet/animationEngine";
import {
  assetRevision,
  getPetStateAssetInfo,
  initializePetAssets,
  resolvePetAsset,
} from "../pet/assetLoader";
import { PET_STATE_REGISTRY } from "../pet/stateRegistry";
import type { PetState } from "../pet/types";
import type {
  ResolvedPetAsset,
  ResolvedPetFrame,
} from "../pet/types";
import { userAssetManager } from "../pet/userAssetManager";
import type {
  UserAnimationConfig,
  UserPetFrameReference,
} from "../pet/userAssetTypes";

interface EditorFrame extends UserPetFrameReference {
  src: string;
}

defineProps<{
  runtimeState?: PetState;
}>();

const emit = defineEmits<{
  dirtyChange: [dirty: boolean];
}>();

const selectedState = ref<PetState>("idle");
const frames = ref<EditorFrame[]>([]);
const loop = ref(true);
const replayMode = ref<UserAnimationConfig["replay"]["mode"]>("continuous");
const fixedDelayMs = ref(0);
const randomDelaysText = ref("");
const isSaving = ref(false);
const isUploading = ref(false);
const message = ref("");
const error = ref("");
const savedDraftSignature = ref("");

const stateInfos = computed(() => {
  void assetRevision.value;
  return PET_STATE_REGISTRY.map((metadata) => ({
    metadata,
    asset: getPetStateAssetInfo(metadata.id),
  }));
});

const selectedInfo = computed(() => getPetStateAssetInfo(selectedState.value));
const animationDuration = computed(() =>
  frames.value.reduce((total, frame) => total + frame.durationMs, 0),
);
const randomDelayOptions = computed(() =>
  randomDelaysText.value
    .split(/[\s,，]+/)
    .filter(Boolean)
    .map(Number)
    .filter((value) => Number.isFinite(value) && value >= 0),
);
const dimensionsWarning = computed(() => {
  const dimensions = new Set(
    frames.value
      .filter((frame) => frame.width && frame.height)
      .map((frame) => `${frame.width}×${frame.height}`),
  );
  return dimensions.size > 1;
});
const draftSignature = computed(() => JSON.stringify({
  frames: frames.value.map(({ src: _src, width: _width, height: _height, ...frame }) => frame),
  loop: loop.value,
  replayMode: replayMode.value,
  fixedDelayMs: fixedDelayMs.value,
  randomDelaysText: randomDelaysText.value,
}));
const isDirty = computed(() => draftSignature.value !== savedDraftSignature.value);

const previewAsset = computed<ResolvedPetAsset>(() => {
  if (frames.value.length === 0) {
    return resolvePetAsset("default", selectedState.value);
  }

  return {
    requestedPetId: "default",
    petId: "default",
    petName: "Default Pet Preview",
    requestedState: selectedState.value,
    resolvedState: selectedState.value,
    frames: frames.value.map((frame) => ({ ...frame })) as [
      ResolvedPetFrame,
      ...ResolvedPetFrame[],
    ],
    animation: {
      loop: loop.value,
      replay: {
        mode: replayMode.value,
        delayMs: fixedDelayMs.value,
        delayOptionsMs: randomDelayOptions.value,
      },
    },
    usedFallback: false,
  };
});

const preview = usePetAnimation(previewAsset);

watch([selectedState, assetRevision], loadDraft, { immediate: true });
watch(isDirty, (dirty) => emit("dirtyChange", dirty), { immediate: true });

onMounted(async () => {
  await initializePetAssets();
  loadDraft();
});

function loadDraft(): void {
  const info = getPetStateAssetInfo(selectedState.value);
  frames.value = info.frames.map((frame) => ({ ...frame }));
  loop.value = info.animation.loop;
  replayMode.value = info.animation.replay.mode;
  fixedDelayMs.value = info.animation.replay.delayMs;
  randomDelaysText.value = info.animation.replay.delayOptionsMs.join("\n");
  savedDraftSignature.value = draftSignature.value;
  message.value = "";
  error.value = "";

  for (const frame of frames.value) {
    if (!frame.width || !frame.height) {
      void readImageDimensions(frame);
    }
  }
}

function selectState(state: PetState): void {
  if (state === selectedState.value) return;
  if (isDirty.value && !window.confirm("当前状态有未保存修改，确定切换并放弃修改吗？")) {
    return;
  }
  selectedState.value = state;
}

async function handleUpload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = "";

  if (files.length === 0) {
    return;
  }

  isUploading.value = true;
  error.value = "";
  message.value = "";

  try {
    for (const file of files) {
      const frame = await userAssetManager.uploadPng(selectedState.value, file);
      const src = userAssetManager.getFrameUrl(frame);
      if (!src) {
        throw new Error(`无法加载上传后的 PNG：${file.name}`);
      }
      frames.value.push({ ...frame, src });
    }
    message.value = `已上传 ${files.length} 个 PNG，请保存动画配置。`;
  } catch (uploadError) {
    error.value = toErrorMessage(uploadError);
  } finally {
    isUploading.value = false;
  }
}

function moveFrame(index: number, direction: -1 | 1): void {
  const target = index + direction;
  if (target < 0 || target >= frames.value.length) {
    return;
  }
  const [frame] = frames.value.splice(index, 1);
  if (frame) {
    frames.value.splice(target, 0, frame);
  }
}

function removeFrame(index: number): void {
  if (selectedState.value === "idle" && frames.value.length === 1) {
    error.value = "idle 状态必须至少保留一个有效帧。";
    return;
  }
  frames.value.splice(index, 1);
}

async function deleteFrame(index: number): Promise<void> {
  const frame = frames.value[index];
  if (!frame || frame.source !== "user") {
    return;
  }
  if (selectedState.value === "idle" && frames.value.length === 1) {
    error.value = "idle 状态必须至少保留一个有效帧。";
    return;
  }

  try {
    await userAssetManager.deletePng(selectedState.value, frame);
    frames.value.splice(index, 1);
    await save();
  } catch (deleteError) {
    error.value = toErrorMessage(deleteError);
  }
}

async function save(): Promise<void> {
  error.value = "";
  message.value = "";

  if (selectedState.value === "idle" && frames.value.length === 0) {
    error.value = "idle 状态必须至少保留一个有效帧。";
    return;
  }
  if (frames.value.some((frame) => !Number.isFinite(frame.durationMs) || frame.durationMs < 0)) {
    error.value = "每帧 duration 必须是大于或等于 0 的毫秒数。";
    return;
  }
  if (loop.value && replayMode.value === "random" && randomDelayOptions.value.length === 0) {
    error.value = "Random Delay 至少需要一个有效的毫秒值。";
    return;
  }

  isSaving.value = true;
  try {
    await userAssetManager.saveStateOverride(selectedState.value, {
      frames: frames.value.map(({ src: _src, ...frame }) => frame),
      animation: {
        loop: loop.value,
        replay: {
          mode: replayMode.value,
          delayMs: Math.max(0, fixedDelayMs.value || 0),
          delayOptionsMs: randomDelayOptions.value,
        },
      },
    });
    savedDraftSignature.value = draftSignature.value;
    message.value = "已保存并通知桌宠热重载。";
  } catch (saveError) {
    error.value = toErrorMessage(saveError);
  } finally {
    isSaving.value = false;
  }
}

async function readImageDimensions(frame: EditorFrame): Promise<void> {
  const image = new Image();
  image.src = frame.src;
  try {
    await image.decode();
    frame.width = image.naturalWidth;
    frame.height = image.naturalHeight;
  } catch {
    // AssetLoader already reports unreadable sources; dimension display is best effort.
  }
}

function animationMode(info: ReturnType<typeof getPetStateAssetInfo>): string {
  if (!info.animation.loop) {
    return "Non-loop";
  }
  const labels = {
    continuous: "Continuous",
    fixed: "Fixed Delay",
    random: "Random Delay",
  } as const;
  return labels[info.animation.replay.mode];
}

function toErrorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}
</script>

<template>
  <section class="state-editor">
    <header class="page-heading">
      <div>
        <p class="eyebrow">State & Animation Editor</p>
        <h2>状态与动画</h2>
      </div>
      <span>Built-in 只读 · User Assets 优先</span>
    </header>

    <div class="workspace">
      <div class="state-list" role="list">
        <button
          v-for="entry in stateInfos"
          :key="entry.metadata.id"
          type="button"
          :class="{ selected: selectedState === entry.metadata.id }"
          @click="selectState(entry.metadata.id)"
        >
          <div>
            <strong>{{ entry.metadata.id }}</strong>
            <small v-if="runtimeState === entry.metadata.id">Runtime</small>
          </div>
          <span :class="{ configured: entry.asset.isConfigured }">
            {{ entry.asset.isConfigured ? "已配置" : "未配置" }}
          </span>
          <p>
            {{ entry.asset.frames.length }} frames ·
            {{ animationMode(entry.asset) }}
          </p>
          <p v-if="!entry.asset.isConfigured">
            fallback → {{ entry.asset.fallbackState }}
          </p>
          <p v-if="entry.asset.errors.length" class="state-error">资源异常</p>
        </button>
      </div>

      <div class="detail">
        <div class="detail-heading">
          <div>
            <h3>{{ selectedState }}</h3>
            <p>
              {{ selectedInfo.isConfigured ? "已配置专属资源" : "未配置专属资源" }}
              · fallback → {{ selectedInfo.fallbackState }}
            </p>
          </div>
          <span class="source">{{ selectedInfo.source }}</span>
        </div>

        <p v-for="item in selectedInfo.errors" :key="item" class="warning">
          {{ item }}
        </p>
        <p v-if="dimensionsWarning" class="warning">
          当前动画帧尺寸不一致，可能导致动画跳动。
        </p>
        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="message" class="success">{{ message }}</p>

        <section class="preview-panel">
          <div>
            <h4>预览</h4>
            <p>独立播放器，不修改桌宠 Runtime State。</p>
          </div>
          <img :src="preview.currentFrame.value" alt="动画预览" />
          <button
            type="button"
            @click="preview.isPaused.value ? preview.resume() : preview.pause()"
          >
            {{ preview.isPaused.value ? "播放预览" : "暂停预览" }}
          </button>
        </section>

        <section>
          <div class="section-heading">
            <div>
              <h4>动画帧</h4>
              <p>Animation Duration：{{ animationDuration }} ms</p>
            </div>
            <label class="upload">
              {{ isUploading ? "上传中…" : "上传 PNG" }}
              <input
                type="file"
                accept="image/png,.png"
                multiple
                :disabled="isUploading"
                @change="handleUpload"
              />
            </label>
          </div>

          <div v-if="frames.length" class="frame-list">
            <article v-for="(frame, index) in frames" :key="frame.id">
              <span class="order">{{ index + 1 }}</span>
              <img :src="frame.src" :alt="frame.fileName" />
              <div class="frame-meta">
                <strong>{{ frame.fileName }}</strong>
                <span>
                  {{ frame.width && frame.height ? `${frame.width}×${frame.height}` : "读取尺寸中" }}
                  · {{ frame.source }}
                </span>
              </div>
              <label class="duration">
                <input v-model.number="frame.durationMs" type="number" min="0" /> ms
              </label>
              <div class="frame-actions">
                <button type="button" :disabled="index === 0" @click="moveFrame(index, -1)">↑</button>
                <button type="button" :disabled="index === frames.length - 1" @click="moveFrame(index, 1)">↓</button>
                <button type="button" @click="removeFrame(index)">移除</button>
                <button
                  v-if="frame.source === 'user'"
                  class="danger"
                  type="button"
                  @click="deleteFrame(index)"
                >
                  删除文件
                </button>
              </div>
            </article>
          </div>
          <p v-else class="empty">暂无专属帧；Runtime 将使用 fallback。</p>
        </section>

        <section class="playback">
          <h4>播放设置</h4>
          <label class="check"><input v-model="loop" type="checkbox" /> Loop</label>
          <label v-if="loop">
            Replay Delay
            <select v-model="replayMode">
              <option value="continuous">Continuous</option>
              <option value="fixed">Fixed Delay</option>
              <option value="random">Random Delay</option>
            </select>
          </label>
          <label v-if="loop && replayMode === 'fixed'">
            Fixed Delay (ms)
            <input v-model.number="fixedDelayMs" type="number" min="0" />
          </label>
          <label v-if="loop && replayMode === 'random'">
            Random Delay 数组（毫秒，换行或逗号分隔）
            <textarea v-model="randomDelaysText" rows="4" />
          </label>
          <p v-if="!loop" class="playback-note">非循环动画播放一次后停留在末帧，不使用 Replay Delay。</p>
        </section>

        <footer class="save-bar">
          <button type="button" :disabled="isSaving" @click="save">
            {{ isSaving ? "保存中…" : "保存并热重载" }}
          </button>
        </footer>
      </div>
    </div>
  </section>
</template>

<style scoped>
.state-editor { display: grid; gap: 18px; }
.page-heading, .detail-heading, .section-heading, .preview-panel { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.eyebrow { margin: 0 0 4px; color: var(--cc-accent, #8d78db); font-size: 11px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
h2, h3, h4, p { margin: 0; }
h2 { color: var(--cc-text-primary, #211b31); font-size: 26px; }
.page-heading > span, .detail-heading p, .section-heading p, .preview-panel p { color: var(--cc-text-secondary, #81798f); font-size: 12px; }
.workspace { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 16px; align-items: start; }
.state-list { display: grid; gap: 7px; position: sticky; top: 0; }
.state-list > button { display: grid; gap: 5px; padding: 11px; color: var(--cc-text-primary, #51485e); text-align: left; background: var(--cc-card-bg, #faf9fd); border: var(--cc-card-border-width, 1px) solid var(--cc-card-border, #e9e5f0); border-radius: 10px; cursor: pointer; }
.state-list > button.selected { border-color: var(--cc-accent, #9b87de); box-shadow: 0 0 0 2px color-mix(in srgb, var(--cc-accent, #8b78ff) 10%, transparent); }
.state-list button > div { display: flex; align-items: center; justify-content: space-between; }
.state-list strong { color: var(--cc-text-primary, #2d253a); font-size: 13px; }
.state-list small { padding: 2px 5px; color: var(--cc-on-accent, #fff); background: var(--cc-accent, #725bc7); border-radius: 999px; font-size: 9px; }
.state-list span, .state-list p { font-size: 10px; }
.state-list span { color: var(--cc-text-secondary, #9b6970); }
.state-list span.configured { color: var(--cc-success, #438064); }
.state-list .state-error { color: var(--cc-danger, #b14855); font-weight: 700; }
.detail { display: grid; gap: 16px; min-width: 0; }
.detail-heading { padding-bottom: 12px; border-bottom: 1px solid var(--cc-card-border, #eeeaf4); }
.detail-heading h3 { font-size: 22px; }
.source { padding: 5px 8px; color: var(--cc-accent, #6550ac); font-size: 11px; background: var(--cc-card-bg, #f0ecff); border-radius: 999px; }
.warning, .error, .success { padding: 9px 11px; font-size: 12px; border-radius: 8px; }
.warning { color: var(--cc-warning, #8a5f20); background: var(--cc-warning-bg, #fff7df); }
.error { color: var(--cc-danger, #a13e4a); background: var(--cc-danger-bg, #fff0f2); }
.success { color: var(--cc-success, #397256); background: var(--cc-success-bg, #ebf8f0); }
.preview-panel { padding: 13px; background: var(--cc-card-bg, #f7f4fc); border: var(--cc-card-border-width, 1px) solid var(--cc-card-border, #e5dff0); border-radius: 12px; }
.preview-panel img { width: 96px; height: 96px; object-fit: contain; image-rendering: pixelated; }
section { display: grid; gap: 12px; }
.upload { padding: 8px 11px; color: var(--cc-accent, #5f4aaa); font-size: 12px; font-weight: 650; background: var(--cc-input-bg, #fff); border: 1px solid var(--cc-card-border, #d8cff0); border-radius: 8px; cursor: pointer; }
.upload input { display: none; }
.frame-list { display: grid; gap: 8px; }
.frame-list article { display: grid; grid-template-columns: 24px 54px minmax(120px, 1fr) 105px auto; gap: 9px; align-items: center; padding: 9px; background: var(--cc-card-bg, #faf9fd); border: var(--cc-card-border-width, 1px) solid var(--cc-card-border, #e9e5ef); border-radius: 10px; }
.order { color: var(--cc-text-secondary, #8d8299); font-size: 11px; text-align: center; }
.frame-list img { width: 52px; height: 52px; object-fit: contain; background: repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 50% / 12px 12px; image-rendering: pixelated; }
.frame-meta { display: grid; gap: 3px; min-width: 0; }
.frame-meta strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.frame-meta span { color: var(--cc-text-secondary, #867d92); font-size: 10px; }
.duration { display: flex; align-items: center; gap: 4px; color: var(--cc-text-secondary, #756d80); font-size: 11px; }
.duration input { width: 68px; }
input, select, textarea { box-sizing: border-box; padding: 7px 8px; color: var(--cc-text-primary, #30283d); font: inherit; font-size: 12px; background: var(--cc-input-bg, #fff); border: 1px solid var(--cc-card-border, #dcd6e7); border-radius: 7px; }
.frame-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
button { padding: 7px 9px; color: var(--cc-on-accent, #fff); font: inherit; font-size: 11px; font-weight: 650; background: var(--cc-accent, #6f57c8); border: 1px solid var(--cc-accent, #6f57c8); border-radius: 7px; cursor: pointer; }
button:disabled { opacity: .45; cursor: default; }
button.danger { color: var(--cc-danger, #a14552); background: var(--cc-input-bg, #fff); border-color: color-mix(in srgb, var(--cc-danger, #a14552) 35%, transparent); }
.empty { padding: 18px; color: var(--cc-text-secondary, #8d8498); font-size: 12px; text-align: center; background: var(--cc-card-bg, #faf9fd); border: 1px dashed var(--cc-card-border, #dcd6e7); border-radius: 10px; }
.playback { padding: 14px; background: var(--cc-card-bg, #faf9fd); border: var(--cc-card-border-width, 1px) solid var(--cc-card-border, #e9e5ef); border-radius: 11px; }
.playback label { display: grid; gap: 6px; color: var(--cc-text-secondary, #645b70); font-size: 12px; }
.playback label.check { display: flex; align-items: center; }
.playback textarea { resize: vertical; }
.playback-note { color: var(--cc-text-secondary, #81798f); font-size: 11px; }
.save-bar { display: flex; justify-content: flex-end; padding-top: 4px; }
.save-bar button { padding: 9px 14px; font-size: 12px; }
@media (max-width: 820px) { .workspace { grid-template-columns: 1fr; } .state-list { grid-template-columns: repeat(2,minmax(0,1fr)); position: static; } .frame-list article { grid-template-columns: 24px 50px 1fr; } .duration, .frame-actions { grid-column: 3; justify-content: flex-start; } }
</style>
