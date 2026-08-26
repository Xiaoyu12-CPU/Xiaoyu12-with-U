<script setup lang="ts">
import { computed, onMounted } from "vue";
import { DEFAULT_SETTINGS } from "./defaultSettings";
import { settingsManager } from "./settingsManager";
import { SYSTEM_STATUS_ITEMS } from "../system/statusItems";
import type { SystemStatusItemId } from "../system/statusItems";
import type {
  DesktopDisplayMode,
  DesktopPetSettings,
  KeyDisplayFlowDirection,
  KeyDisplayPosition,
  SettingsSection,
} from "./settingsTypes";
import { resetKeyHistoryOffset } from "../input/keyHistoryDrag";

const settings = settingsManager.settings;
const scalePercent = computed(() =>
  Math.round(settings.value.appearance.petScale * 100),
);
const panelScalePercent = computed(() =>
  Math.round(settings.value.systemStatusBubble.panelScale * 100),
);
const reminderSoundVolumePercent = computed(() =>
  Math.round(settings.value.reminder.soundVolume * 100),
);
const keyDisplayDurationSeconds = computed(() =>
  (settings.value.input.keyDisplayDurationMs / 1000).toFixed(1),
);
const keyDisplayStartLineOpacityPercent = computed(() =>
  Math.round(settings.value.input.keyDisplayStartLineOpacity * 100),
);

onMounted(() => {
  void settingsManager.initialize();
});

function update<
  Section extends SettingsSection,
  Key extends keyof DesktopPetSettings[Section],
>(
  section: Section,
  key: Key,
  value: DesktopPetSettings[Section][Key],
): void {
  settingsManager.updateSetting(section, key, value);
}

function updateScale(event: Event): void {
  const percent = Number((event.target as HTMLInputElement).value);
  update("appearance", "petScale", percent / 100);
}

function updateNumber<
  Section extends SettingsSection,
  Key extends keyof DesktopPetSettings[Section],
>(section: Section, key: Key, event: Event): void {
  update(
    section,
    key,
    Number((event.target as HTMLInputElement).value) as DesktopPetSettings[Section][Key],
  );
}

function updateBoolean<
  Section extends SettingsSection,
  Key extends keyof DesktopPetSettings[Section],
>(section: Section, key: Key, event: Event): void {
  update(
    section,
    key,
    (event.target as HTMLInputElement).checked as DesktopPetSettings[Section][Key],
  );
}

function updateDisplayMode(displayMode: DesktopDisplayMode): void {
  const bubble = settings.value.systemStatusBubble;
  const usesInitialPosition =
    bubble.offsetX === DEFAULT_SETTINGS.systemStatusBubble.offsetX &&
    bubble.offsetY === DEFAULT_SETTINGS.systemStatusBubble.offsetY;

  if (displayMode === "both" && usesInitialPosition) {
    settingsManager.update({
      systemStatusBubble: {
        displayMode,
        offsetX: getRightSideBubbleOffset(),
      },
    });
    return;
  }

  update("systemStatusBubble", "displayMode", displayMode);
}

function updatePanelScale(event: Event): void {
  const percent = Number((event.target as HTMLInputElement).value);
  update("systemStatusBubble", "panelScale", percent / 100);
}

function updateReminderSoundVolume(event: Event): void {
  const percent = Number((event.target as HTMLInputElement).value);
  update("reminder", "soundVolume", percent / 100);
}

function updateKeyDisplayPosition(event: Event): void {
  update(
    "input",
    "keyDisplayPosition",
    (event.target as HTMLSelectElement).value as KeyDisplayPosition,
  );
}

function updateKeyDisplayFlowDirection(event: Event): void {
  update(
    "input",
    "keyDisplayFlowDirection",
    (event.target as HTMLSelectElement).value as KeyDisplayFlowDirection,
  );
}

function updateKeyDisplayStartLineColor(event: Event): void {
  update(
    "input",
    "keyDisplayStartLineColor",
    (event.target as HTMLInputElement).value,
  );
}

function updateKeyDisplayStartLineOpacity(event: Event): void {
  const percent = Number((event.target as HTMLInputElement).value);
  update("input", "keyDisplayStartLineOpacity", percent / 100);
}

function resetKeyDisplayPosition(): void {
  const offset = resetKeyHistoryOffset();
  settingsManager.update({
    input: {
      keyDisplayOffsetX: offset.x,
      keyDisplayOffsetY: offset.y,
    },
  });
}

function updateVisibleItem(itemId: SystemStatusItemId, event: Event): void {
  const checked = (event.target as HTMLInputElement).checked;
  const currentItems = settings.value.systemStatusBubble.visibleItems;
  const nextItems = SYSTEM_STATUS_ITEMS
    .map(({ id }) => id)
    .filter((id) => id === itemId ? checked : currentItems.includes(id));

  update("systemStatusBubble", "visibleItems", nextItems);
}

function updateColor(
  key: "backgroundColor" | "textColor" | "borderColor",
  event: Event,
): void {
  update(
    "systemStatusBubble",
    key,
    (event.target as HTMLInputElement).value,
  );
}

function resetSystemStatusBubblePosition(): void {
  settingsManager.update({
    systemStatusBubble: {
      offsetX: getRightSideBubbleOffset(),
      offsetY: DEFAULT_SETTINGS.systemStatusBubble.offsetY,
    },
  });
}

function getRightSideBubbleOffset(): number {
  return Math.round(180 * settings.value.appearance.petScale + 10);
}
</script>

<template>
  <section class="settings-page">
    <header>
      <div>
        <p class="eyebrow">Application Settings</p>
        <h2>设置</h2>
      </div>
      <div class="save-state">
        <span v-if="settingsManager.isSaving.value">自动保存中…</span>
        <span v-else-if="settingsManager.lastSavedAt.value">已自动保存</span>
        <span v-else>加载完成后自动保存</span>
      </div>
    </header>

    <p v-if="settingsManager.lastError.value" class="error">
      {{ settingsManager.lastError.value }}
    </p>

    <div class="settings-sections">
      <article>
        <div class="section-heading">
          <div>
            <h3>外观</h3>
            <p>立即应用到桌宠窗口。</p>
          </div>
        </div>

        <label class="setting-row scale-row">
          <span>
            <strong>桌宠大小</strong>
            <small>窗口会在超过 100% 时同步扩大，避免裁切。</small>
          </span>
          <div class="scale-control">
            <input
              type="range"
              min="50"
              max="200"
              step="10"
              :value="scalePercent"
              @input="updateScale"
            />
            <output>{{ scalePercent }}%</output>
          </div>
        </label>

        <label class="setting-row">
          <span>
            <strong>Always On Top</strong>
            <small>控制桌宠窗口是否始终置顶。</small>
          </span>
          <input
            class="toggle"
            type="checkbox"
            :checked="settings.appearance.alwaysOnTop"
            @change="updateBoolean('appearance', 'alwaysOnTop', $event)"
          />
        </label>
      </article>

      <article>
        <div class="section-heading">
          <div>
            <h3>System Status Bubble</h3>
            <p>在同一个桌宠窗口内显示长期系统状态，可直接拖动面板调整位置。</p>
          </div>
        </div>

        <h4 class="settings-group-heading">显示</h4>

        <div class="setting-row">
          <span>
            <strong>桌面显示</strong>
            <small>修改后立即同步到主桌宠窗口。</small>
          </span>
          <div class="display-mode-options" role="radiogroup" aria-label="桌面显示">
            <label>
              <input
                type="radio"
                name="display-mode"
                :checked="settings.systemStatusBubble.displayMode === 'both'"
                @change="updateDisplayMode('both')"
              />
              宠物 + 系统状态
            </label>
            <label>
              <input
                type="radio"
                name="display-mode"
                :checked="settings.systemStatusBubble.displayMode === 'pet-only'"
                @change="updateDisplayMode('pet-only')"
              />
              仅宠物
            </label>
            <label>
              <input
                type="radio"
                name="display-mode"
                :checked="settings.systemStatusBubble.displayMode === 'status-only'"
                @change="updateDisplayMode('status-only')"
              />
              仅系统状态
            </label>
          </div>
        </div>

        <div class="setting-row">
          <span>
            <strong>显示内容</strong>
            <small>全部取消时仍保留最小 System Status 标题。</small>
          </span>
          <div class="item-options" aria-label="系统状态面板显示内容">
            <label v-for="item in SYSTEM_STATUS_ITEMS" :key="item.id">
              <input
                type="checkbox"
                :checked="settings.systemStatusBubble.visibleItems.includes(item.id)"
                @change="updateVisibleItem(item.id, $event)"
              />
              {{ item.label }}
            </label>
          </div>
        </div>

        <h4 class="settings-group-heading">尺寸</h4>

        <label class="setting-row">
          <span>
            <strong>面板宽度</strong>
            <small>180 ～ 420 logical px</small>
          </span>
          <div class="scale-control">
            <input
              type="range"
              min="180"
              max="420"
              step="1"
              :value="settings.systemStatusBubble.panelWidth"
              @input="updateNumber('systemStatusBubble', 'panelWidth', $event)"
            />
            <output>{{ settings.systemStatusBubble.panelWidth }} px</output>
          </div>
        </label>

        <label class="setting-row">
          <span>
            <strong>面板缩放</strong>
            <small>整体缩放字体、间距、进度条和圆角。</small>
          </span>
          <div class="scale-control">
            <input
              type="range"
              min="70"
              max="160"
              step="5"
              :value="panelScalePercent"
              @input="updatePanelScale"
            />
            <output>{{ panelScalePercent }}%</output>
          </div>
        </label>

        <div class="setting-row">
          <span>
            <strong>面板位置</strong>
            <small>直接拖动状态面板调整；位置在松手后保存。</small>
          </span>
          <button type="button" @click="resetSystemStatusBubblePosition">
            重置系统状态面板位置
          </button>
        </div>

        <h4 class="settings-group-heading">外观</h4>

        <label class="setting-row">
          <span><strong>背景颜色</strong></span>
          <div class="color-control">
            <input
              type="color"
              :value="settings.systemStatusBubble.backgroundColor"
              @input="updateColor('backgroundColor', $event)"
            />
            <code>{{ settings.systemStatusBubble.backgroundColor }}</code>
          </div>
        </label>

        <label class="setting-row">
          <span><strong>背景透明度</strong></span>
          <div class="scale-control">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="settings.systemStatusBubble.backgroundOpacity"
              @input="updateNumber('systemStatusBubble', 'backgroundOpacity', $event)"
            />
            <output>{{ Math.round(settings.systemStatusBubble.backgroundOpacity * 100) }}%</output>
          </div>
        </label>

        <label class="setting-row">
          <span><strong>字体颜色</strong></span>
          <div class="color-control">
            <input
              type="color"
              :value="settings.systemStatusBubble.textColor"
              @input="updateColor('textColor', $event)"
            />
            <code>{{ settings.systemStatusBubble.textColor }}</code>
          </div>
        </label>

        <label class="setting-row">
          <span><strong>边框颜色</strong></span>
          <div class="color-control">
            <input
              type="color"
              :value="settings.systemStatusBubble.borderColor"
              @input="updateColor('borderColor', $event)"
            />
            <code>{{ settings.systemStatusBubble.borderColor }}</code>
          </div>
        </label>

        <label class="setting-row">
          <span><strong>边框粗细</strong><small>0 ～ 6 px</small></span>
          <div class="number-control">
            <input
              type="number"
              min="0"
              max="6"
              step="1"
              :value="settings.systemStatusBubble.borderWidth"
              @change="updateNumber('systemStatusBubble', 'borderWidth', $event)"
            />
            <span>px</span>
          </div>
        </label>
      </article>

      <article id="system-monitor-settings">
        <div class="section-heading">
          <div>
            <h3>System Monitor</h3>
            <p>由桌宠主窗口调用 Rust 读取真实 CPU、内存、网络、系统卷与电池数据。</p>
          </div>
        </div>

        <label class="setting-row">
          <span>
            <strong>System Monitor</strong>
            <small>暂停时保留各硬件子开关；重新开启后按原设置恢复。</small>
          </span>
          <input
            class="toggle"
            type="checkbox"
            :checked="settings.systemMonitor.enabled"
            @change="updateBoolean('systemMonitor', 'enabled', $event)"
          />
        </label>

        <label class="setting-row">
          <span>
            <strong>System Poll Interval</strong>
            <small>CPU、Memory 与 Network 共用，500 ～ 10000 毫秒。</small>
          </span>
          <div class="number-control">
            <input
              type="number"
              min="500"
              max="10000"
              step="500"
              :value="settings.systemMonitor.cpuPollIntervalMs"
              :disabled="!settings.systemMonitor.enabled || (!settings.systemMonitor.cpuEnabled && !settings.systemMonitor.memoryEnabled && !settings.systemMonitor.networkEnabled)"
              @change="updateNumber('systemMonitor', 'cpuPollIntervalMs', $event)"
            />
            <span>ms</span>
          </div>
        </label>

        <h4 class="settings-group-heading">CPU</h4>

        <label class="setting-row">
          <span><strong>Enable CPU Monitor</strong></span>
          <input
            class="toggle"
            type="checkbox"
            :checked="settings.systemMonitor.cpuEnabled"
            :disabled="!settings.systemMonitor.enabled"
            @change="updateBoolean('systemMonitor', 'cpuEnabled', $event)"
          />
        </label>

        <label class="setting-row">
          <span>
            <strong>CPU High Threshold</strong>
            <small>进入 High 的阈值；退出阈值比它低 10 个百分点。</small>
          </span>
          <div class="number-control">
            <input
              type="number"
              min="10"
              max="100"
              step="5"
              :value="settings.systemMonitor.cpuHighThreshold"
              :disabled="!settings.systemMonitor.enabled || !settings.systemMonitor.cpuEnabled"
              @change="updateNumber('systemMonitor', 'cpuHighThreshold', $event)"
            />
            <span>%</span>
          </div>
        </label>

        <h4 class="settings-group-heading">Memory</h4>

        <label class="setting-row">
          <span><strong>Enable Memory Monitor</strong></span>
          <input
            class="toggle"
            type="checkbox"
            :checked="settings.systemMonitor.memoryEnabled"
            :disabled="!settings.systemMonitor.enabled"
            @change="updateBoolean('systemMonitor', 'memoryEnabled', $event)"
          />
        </label>

        <label class="setting-row">
          <span>
            <strong>Memory High Threshold</strong>
            <small>进入 High 的阈值；退出阈值比它低 5 个百分点。</small>
          </span>
          <div class="number-control">
            <input
              type="number"
              min="50"
              max="100"
              step="5"
              :value="settings.systemMonitor.memoryHighThreshold"
              :disabled="!settings.systemMonitor.enabled || !settings.systemMonitor.memoryEnabled"
              @change="updateNumber('systemMonitor', 'memoryHighThreshold', $event)"
            />
            <span>%</span>
          </div>
        </label>

        <h4 class="settings-group-heading">Network</h4>

        <label class="setting-row">
          <span>
            <strong>Enable Network Monitor</strong>
            <small>显示整个系统的实时下载与上传速度。</small>
          </span>
          <input
            class="toggle"
            type="checkbox"
            :checked="settings.systemMonitor.networkEnabled"
            :disabled="!settings.systemMonitor.enabled"
            @change="updateBoolean('systemMonitor', 'networkEnabled', $event)"
          />
        </label>

        <h4 class="settings-group-heading">Storage</h4>

        <label class="setting-row">
          <span>
            <strong>Enable Storage Monitor</strong>
            <small>每 30 秒读取一次系统主要卷的可用空间。</small>
          </span>
          <input
            class="toggle"
            type="checkbox"
            :checked="settings.systemMonitor.storageEnabled"
            :disabled="!settings.systemMonitor.enabled"
            @change="updateBoolean('systemMonitor', 'storageEnabled', $event)"
          />
        </label>

        <h4 class="settings-group-heading">Battery</h4>

        <label class="setting-row">
          <span>
            <strong>Enable Battery Monitor</strong>
            <small>每 30 秒读取一次主电池的电量与充放电状态。</small>
          </span>
          <input
            class="toggle"
            type="checkbox"
            :checked="settings.systemMonitor.batteryEnabled"
            :disabled="!settings.systemMonitor.enabled"
            @change="updateBoolean('systemMonitor', 'batteryEnabled', $event)"
          />
        </label>

      </article>

      <article>
        <div class="section-heading">
          <div>
            <h3>Dialogue</h3>
            <p>事件仍然正常执行；关闭选项只影响气泡文本。</p>
          </div>
        </div>

        <label class="setting-row">
          <span>
            <strong>气泡显示时间</strong>
            <small>250 ～ 60000 毫秒</small>
          </span>
          <div class="number-control">
            <input
              type="number"
              min="250"
              max="60000"
              step="250"
              :value="settings.dialogue.bubbleDurationMs"
              @change="updateNumber('dialogue', 'bubbleDurationMs', $event)"
            />
            <span>ms</span>
          </div>
        </label>

        <label class="setting-row">
          <span><strong>启动时显示开发提示</strong></span>
          <input
            class="toggle"
            type="checkbox"
            :checked="settings.dialogue.showDevelopmentMessageOnStartup"
            @change="updateBoolean('dialogue', 'showDevelopmentMessageOnStartup', $event)"
          />
        </label>
        <label class="setting-row">
          <span><strong>Click Dialogue</strong></span>
          <input
            class="toggle"
            type="checkbox"
            :checked="settings.dialogue.enableClickDialogue"
            @change="updateBoolean('dialogue', 'enableClickDialogue', $event)"
          />
        </label>
        <label class="setting-row">
          <span><strong>Drag Dialogue</strong></span>
          <input
            class="toggle"
            type="checkbox"
            :checked="settings.dialogue.enableDragDialogue"
            @change="updateBoolean('dialogue', 'enableDragDialogue', $event)"
          />
        </label>
      </article>

      <article>
        <div class="section-heading">
          <div>
            <h3>Animation</h3>
            <p>关闭后保持当前有效帧，重新开启后继续播放。</p>
          </div>
        </div>

        <label class="setting-row">
          <span><strong>Animation Enabled</strong></span>
          <input
            class="toggle"
            type="checkbox"
            :checked="settings.animation.enabled"
            @change="updateBoolean('animation', 'enabled', $event)"
          />
        </label>
      </article>

      <article>
        <div class="section-heading">
          <div>
            <h3>Input Monitor</h3>
            <p>全局输入监听默认关闭；只维护当前按键或鼠标状态，不保存输入内容、坐标或历史。</p>
          </div>
        </div>

        <label class="setting-row">
          <span>
            <strong>Keyboard Monitoring</strong>
            <small>macOS 可能要求在隐私与安全性中授予输入监听权限。</small>
          </span>
          <input
            class="toggle"
            type="checkbox"
            :checked="settings.input.keyboardEnabled"
            @change="updateBoolean('input', 'keyboardEnabled', $event)"
          />
        </label>
        <label class="setting-row">
          <span>
            <strong>Mouse Monitoring</strong>
            <small>监听全局鼠标按键与滚轮；不监听移动、坐标或轨迹。</small>
          </span>
          <input
            class="toggle"
            type="checkbox"
            :checked="settings.input.mouseEnabled"
            @change="updateBoolean('input', 'mouseEnabled', $event)"
          />
        </label>
        <label class="setting-row">
          <span>
            <strong>Show Pressed Keys</strong>
            <small>只在桌宠旁短暂显示当前按键，不保存输入历史。</small>
          </span>
          <input
            class="toggle"
            type="checkbox"
            :checked="settings.input.keyDisplayEnabled"
            @change="updateBoolean('input', 'keyDisplayEnabled', $event)"
          />
        </label>
        <label class="setting-row scale-row">
          <span>
            <strong>同时显示数量</strong>
            <small>保留最新 1～8 条短时按键记录。</small>
          </span>
          <div class="scale-control">
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              :value="settings.input.keyDisplayMaxItems"
              @input="updateNumber('input', 'keyDisplayMaxItems', $event)"
            />
            <output>{{ settings.input.keyDisplayMaxItems }}</output>
          </div>
        </label>
        <label class="setting-row">
          <span>
            <strong>永久显示</strong>
            <small>只在本次运行期间保留，仍受同时显示数量限制。</small>
          </span>
          <input
            class="toggle"
            type="checkbox"
            :checked="settings.input.keyDisplayPersistent"
            @change="updateBoolean('input', 'keyDisplayPersistent', $event)"
          />
        </label>
        <label class="setting-row scale-row">
          <span>
            <strong>自动消失时间</strong>
            <small>每条记录拥有独立计时；永久显示时暂停计时。</small>
          </span>
          <div class="scale-control">
            <input
              type="range"
              min="500"
              max="10000"
              step="500"
              :value="settings.input.keyDisplayDurationMs"
              :disabled="settings.input.keyDisplayPersistent"
              @input="updateNumber('input', 'keyDisplayDurationMs', $event)"
            />
            <output>{{ keyDisplayDurationSeconds }}s</output>
          </div>
        </label>
        <label class="setting-row">
          <span>
            <strong>Key History Position</strong>
            <small>只决定整个 History Stack 位于桌宠哪一侧。</small>
          </span>
          <select
            class="select-control"
            :value="settings.input.keyDisplayPosition"
            @change="updateKeyDisplayPosition"
          >
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </label>
        <label class="setting-row">
          <span>
            <strong>History Flow Direction</strong>
            <small>独立控制旧记录被新记录推动的方向。</small>
          </span>
          <select
            class="select-control"
            :value="settings.input.keyDisplayFlowDirection"
            @change="updateKeyDisplayFlowDirection"
          >
            <option value="auto">Auto（远离桌宠）</option>
            <option value="up">Up ↑</option>
            <option value="down">Down ↓</option>
            <option value="left">Left ←</option>
            <option value="right">Right →</option>
          </select>
        </label>
        <label class="setting-row">
          <span>
            <strong>起始线颜色</strong>
            <small>起始线标记 Key History 的展开原点。</small>
          </span>
          <input
            type="color"
            :value="settings.input.keyDisplayStartLineColor"
            @input="updateKeyDisplayStartLineColor"
          />
        </label>
        <label class="setting-row scale-row">
          <span>
            <strong>起始线与键位间距</strong>
            <small>只调整键位记录相对起始线的展开距离，不移动起始线。</small>
          </span>
          <div class="scale-control">
            <input
              type="range"
              min="0"
              max="80"
              step="1"
              :value="settings.input.keyDisplayStartLineGapPx"
              @input="updateNumber('input', 'keyDisplayStartLineGapPx', $event)"
            />
            <output>{{ settings.input.keyDisplayStartLineGapPx }} px</output>
          </div>
        </label>
        <label class="setting-row scale-row">
          <span>
            <strong>起始线透明度</strong>
            <small>完全透明时拖动区域仍然可用。</small>
          </span>
          <div class="scale-control">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              :value="keyDisplayStartLineOpacityPercent"
              @input="updateKeyDisplayStartLineOpacity"
            />
            <output>{{ keyDisplayStartLineOpacityPercent }}%</output>
          </div>
        </label>
        <div class="setting-row">
          <span>
            <strong>键位显示位置</strong>
            <small>清除手动拖动偏移，回到当前 Position 的桌宠边缘锚点。</small>
          </span>
          <button type="button" @click="resetKeyDisplayPosition">
            重置位置
          </button>
        </div>
      </article>

      <article>
        <div class="section-heading">
          <div>
            <h3>Reminder</h3>
            <p>启用后由桌宠主窗口按本机当前时区调度 once / daily Reminder。</p>
          </div>
        </div>

        <label class="setting-row">
          <span>
            <strong>Enable Reminder System</strong>
            <small>关闭只暂停 Scheduler，保留每条 Reminder 的启用状态。</small>
          </span>
          <input
            class="toggle"
            type="checkbox"
            :checked="settings.reminder.enabled"
            @change="updateBoolean('reminder', 'enabled', $event)"
          />
        </label>

        <label class="setting-row scale-row">
          <span>
            <strong>Reminder Sound Volume</strong>
            <small>作用于之后触发或试听的内置提醒声音。</small>
          </span>
          <div class="scale-control">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              :value="reminderSoundVolumePercent"
              @input="updateReminderSoundVolume"
            />
            <output>{{ reminderSoundVolumePercent }}%</output>
          </div>
        </label>
      </article>
    </div>

    <footer>
      <p>System Status Bubble 使用真实 CPU、Memory、Network、Storage 与 Battery 数据。</p>
      <button type="button" @click="settingsManager.resetDefaults">
        恢复默认设置
      </button>
    </footer>
  </section>
</template>

<style scoped>
.settings-page { display: grid; gap: 20px; }
header, .setting-row, footer { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.eyebrow { margin: 0 0 4px; color: #8d78db; font-size: 11px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
h2, h3, p { margin: 0; }
h2 { color: #211b31; font-size: 26px; }
.save-state { color: #6e6579; font-size: 12px; }
.settings-sections { display: grid; gap: 14px; }
article { display: grid; gap: 4px; padding: 17px; background: #faf9fd; border: 1px solid #e8e4f0; border-radius: 13px; }
#system-monitor-settings { scroll-margin-top: 16px; }
.section-heading { padding-bottom: 12px; }
.section-heading h3 { color: #2d253a; font-size: 16px; }
.section-heading p, footer p { margin-top: 3px; color: #857c91; font-size: 11px; }
.settings-group-heading { margin: 12px 0 0; color: #756a82; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
.setting-row { min-height: 42px; padding: 9px 0; border-top: 1px solid #ede9f2; }
.setting-row > span { display: grid; gap: 3px; }
.setting-row strong { color: #403649; font-size: 13px; }
.setting-row small { color: #8c8397; font-size: 10px; }
.scale-control { display: flex; align-items: center; gap: 10px; min-width: 230px; }
.scale-control input { flex: 1; accent-color: #745bc9; }
.scale-control output { width: 56px; color: #604ca5; font-size: 12px; font-weight: 700; text-align: right; }
.number-control { display: flex; align-items: center; gap: 6px; color: #777080; font-size: 11px; }
.number-control input { width: 100px; padding: 7px 8px; color: #30283d; font: inherit; font-size: 12px; background: #fff; border: 1px solid #dcd6e7; border-radius: 7px; }
.select-control { min-width: 170px; padding: 7px 9px; color: #30283d; font: inherit; font-size: 12px; background: #fff; border: 1px solid #dcd6e7; border-radius: 7px; }
.display-mode-options { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.display-mode-options label { display: flex; align-items: center; gap: 5px; padding: 7px 9px; color: #5c5267; font-size: 11px; background: #fff; border: 1px solid #ded8e8; border-radius: 8px; cursor: pointer; }
.display-mode-options label:has(input:checked) { color: #5d48a6; background: #f3efff; border-color: #b9aae4; }
.display-mode-options input { accent-color: #745bc9; }
.item-options { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.item-options label { display: flex; align-items: center; gap: 5px; padding: 7px 9px; color: #5c5267; font-size: 11px; background: #fff; border: 1px solid #ded8e8; border-radius: 8px; cursor: pointer; }
.item-options label:has(input:checked) { color: #5d48a6; background: #f3efff; border-color: #b9aae4; }
.item-options input { accent-color: #745bc9; }
.color-control { display: flex; align-items: center; gap: 8px; }
.color-control input { width: 36px; height: 28px; padding: 2px; background: #fff; border: 1px solid #dcd6e7; border-radius: 7px; cursor: pointer; }
.color-control code { color: #706579; font-size: 11px; }
.toggle { width: 18px; height: 18px; accent-color: #745bc9; cursor: pointer; }
.toggle:disabled, .number-control input:disabled, .scale-control input:disabled { cursor: default; opacity: .5; }
.error { padding: 10px 12px; color: #9d3f4b; font-size: 12px; background: #fff0f2; border-radius: 9px; }
footer { align-items: flex-end; padding-top: 2px; }
footer p { max-width: 430px; }
button { padding: 8px 11px; color: #5d48a6; font: inherit; font-size: 12px; font-weight: 650; background: #fff; border: 1px solid #d9d1ef; border-radius: 8px; cursor: pointer; }
button:hover { background: #f3efff; }
@media (max-width: 680px) { .setting-row, footer { align-items: flex-start; flex-direction: column; } .scale-control { width: 100%; min-width: 0; } }
</style>
