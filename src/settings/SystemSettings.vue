<script setup lang="ts">
import { computed } from "vue";
import { SYSTEM_STATUS_ITEMS } from "../system/statusItems";
import type { SystemStatusItemId } from "../system/statusItems";
import { settingsManager } from "./settingsManager";
import { OVERLAY_LABELS, resetOverlayPosition } from "../pet/desktopWindows";

const settings = settingsManager.settings;
const panelScalePercent = computed(() => Math.round(settings.value.systemStatusBubble.panelScale * 100));

function updateStatusWindowEnabled(event: Event): void {
  const enabled = (event.target as HTMLInputElement).checked;
  settingsManager.update({
    windows: { systemStatusWindowEnabled: enabled },
    systemStatusBubble: { displayMode: enabled ? "both" : "pet-only" },
  });
}
function updateWindowBoolean(key: "systemStatusClickThrough" | "followPet", event: Event): void {
  settingsManager.updateSetting("windows", key, (event.target as HTMLInputElement).checked);
}
function updateVisibleItem(itemId: SystemStatusItemId, event: Event): void {
  const checked = (event.target as HTMLInputElement).checked;
  const current = settings.value.systemStatusBubble.visibleItems;
  settingsManager.updateSetting("systemStatusBubble", "visibleItems", SYSTEM_STATUS_ITEMS.map(({ id }) => id).filter((id) => id === itemId ? checked : current.includes(id)));
}
function updateBubbleNumber(key: "panelWidth" | "backgroundOpacity" | "borderWidth", event: Event): void {
  settingsManager.updateSetting("systemStatusBubble", key, Number((event.target as HTMLInputElement).value));
}
function updatePanelScale(event: Event): void {
  settingsManager.updateSetting("systemStatusBubble", "panelScale", Number((event.target as HTMLInputElement).value) / 100);
}
function updateBubbleColor(key: "backgroundColor" | "textColor" | "borderColor", event: Event): void {
  settingsManager.updateSetting("systemStatusBubble", key, (event.target as HTMLInputElement).value);
}
function resetBubblePosition(): void {
  void resetOverlayPosition(OVERLAY_LABELS.systemStatus).catch((error) => {
    console.error("Failed to reset the system status window position.", error);
  });
}
function updateMonitorBoolean(key: "enabled" | "cpuEnabled" | "memoryEnabled" | "networkEnabled" | "storageEnabled" | "batteryEnabled", event: Event): void {
  settingsManager.updateSetting("systemMonitor", key, (event.target as HTMLInputElement).checked);
}
function updateMonitorNumber(key: "cpuPollIntervalMs" | "cpuHighThreshold" | "memoryHighThreshold", event: Event): void {
  settingsManager.updateSetting("systemMonitor", key, Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="settings-sections" data-settings-category="system">
    <article>
      <div class="section-heading"><h3>System Status Bubble</h3><p>显示、尺寸、位置与外观设置；Runtime逻辑保持不变。</p></div>
      <h4 class="settings-group-heading">显示</h4>
      <div class="setting-row">
        <span><strong>系统状态窗口</strong><small>与桌宠主窗口完全分离，可独立拖动。</small></span>
        <input class="toggle" type="checkbox" :checked="settings.windows.systemStatusWindowEnabled" @change="updateStatusWindowEnabled" />
      </div>
      <label class="setting-row"><span><strong>跟随桌宠</strong><small>三个浮层都保持各自相对位置；关闭后停在屏幕原位。</small></span><input class="toggle" type="checkbox" :checked="settings.windows.followPet" @change="updateWindowBoolean('followPet', $event)" /></label>
      <label class="setting-row"><span><strong>鼠标穿透</strong><small>开启后不能直接拖动此窗口，可在这里关闭。</small></span><input class="toggle" type="checkbox" :checked="settings.windows.systemStatusClickThrough" @change="updateWindowBoolean('systemStatusClickThrough', $event)" /></label>
      <div class="setting-row">
        <span><strong>显示内容</strong><small>全部取消时仍保留最小标题。</small></span>
        <div class="item-options"><label v-for="item in SYSTEM_STATUS_ITEMS" :key="item.id"><input type="checkbox" :checked="settings.systemStatusBubble.visibleItems.includes(item.id)" @change="updateVisibleItem(item.id, $event)" />{{ item.label }}</label></div>
      </div>
      <h4 class="settings-group-heading">尺寸与位置</h4>
      <label class="setting-row scale-row"><span><strong>面板宽度</strong><small>180～420 logical px</small></span><div class="scale-control"><input type="range" min="180" max="420" step="1" :value="settings.systemStatusBubble.panelWidth" @input="updateBubbleNumber('panelWidth', $event)" /><output>{{ settings.systemStatusBubble.panelWidth }} px</output></div></label>
      <label class="setting-row scale-row"><span><strong>面板缩放</strong><small>70%～160%</small></span><div class="scale-control"><input type="range" min="70" max="160" step="5" :value="panelScalePercent" @input="updatePanelScale" /><output>{{ panelScalePercent }}%</output></div></label>
      <div class="setting-row"><span><strong>窗口位置</strong><small>拖动结束后自动保存；重置到桌宠右侧。</small></span><button type="button" @click="resetBubblePosition">重置系统状态窗口位置</button></div>
      <h4 class="settings-group-heading">外观</h4>
      <label class="setting-row"><span><strong>背景颜色</strong></span><div class="color-control"><input type="color" :value="settings.systemStatusBubble.backgroundColor" @input="updateBubbleColor('backgroundColor', $event)" /><code>{{ settings.systemStatusBubble.backgroundColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>背景透明度</strong></span><div class="scale-control"><input type="range" min="0" max="1" step="0.05" :value="settings.systemStatusBubble.backgroundOpacity" @input="updateBubbleNumber('backgroundOpacity', $event)" /><output>{{ Math.round(settings.systemStatusBubble.backgroundOpacity * 100) }}%</output></div></label>
      <label class="setting-row"><span><strong>字体颜色</strong></span><div class="color-control"><input type="color" :value="settings.systemStatusBubble.textColor" @input="updateBubbleColor('textColor', $event)" /><code>{{ settings.systemStatusBubble.textColor }}</code></div></label>
      <label class="setting-row"><span><strong>边框颜色</strong></span><div class="color-control"><input type="color" :value="settings.systemStatusBubble.borderColor" @input="updateBubbleColor('borderColor', $event)" /><code>{{ settings.systemStatusBubble.borderColor }}</code></div></label>
      <label class="setting-row"><span><strong>边框粗细</strong><small>0～6px</small></span><div class="number-control"><input type="number" min="0" max="6" step="1" :value="settings.systemStatusBubble.borderWidth" @change="updateBubbleNumber('borderWidth', $event)" /><span>px</span></div></label>
    </article>

    <article id="system-monitor-settings">
      <div class="section-heading"><h3>System Monitor</h3><p>由桌宠主窗口调用Rust读取真实硬件状态。</p></div>
      <label class="setting-row"><span><strong>System Monitor Master</strong><small>暂停时保留各子Monitor开关。</small></span><input class="toggle" type="checkbox" :checked="settings.systemMonitor.enabled" @change="updateMonitorBoolean('enabled', $event)" /></label>
      <label class="setting-row"><span><strong>Fast Poll Interval</strong><small>CPU、Memory、Network共用，500～10000ms。</small></span><div class="number-control"><input type="number" min="500" max="10000" step="500" :value="settings.systemMonitor.cpuPollIntervalMs" :disabled="!settings.systemMonitor.enabled || (!settings.systemMonitor.cpuEnabled && !settings.systemMonitor.memoryEnabled && !settings.systemMonitor.networkEnabled)" @change="updateMonitorNumber('cpuPollIntervalMs', $event)" /><span>ms</span></div></label>
      <h4 class="settings-group-heading">CPU</h4>
      <label class="setting-row"><span><strong>Enable CPU Monitor</strong></span><input class="toggle" type="checkbox" :checked="settings.systemMonitor.cpuEnabled" :disabled="!settings.systemMonitor.enabled" @change="updateMonitorBoolean('cpuEnabled', $event)" /></label>
      <label class="setting-row"><span><strong>CPU High Threshold</strong><small>退出阈值低10个百分点。</small></span><div class="number-control"><input type="number" min="10" max="100" step="5" :value="settings.systemMonitor.cpuHighThreshold" :disabled="!settings.systemMonitor.enabled || !settings.systemMonitor.cpuEnabled" @change="updateMonitorNumber('cpuHighThreshold', $event)" /><span>%</span></div></label>
      <h4 class="settings-group-heading">Memory</h4>
      <label class="setting-row"><span><strong>Enable Memory Monitor</strong></span><input class="toggle" type="checkbox" :checked="settings.systemMonitor.memoryEnabled" :disabled="!settings.systemMonitor.enabled" @change="updateMonitorBoolean('memoryEnabled', $event)" /></label>
      <label class="setting-row"><span><strong>Memory High Threshold</strong><small>退出阈值低5个百分点。</small></span><div class="number-control"><input type="number" min="50" max="100" step="5" :value="settings.systemMonitor.memoryHighThreshold" :disabled="!settings.systemMonitor.enabled || !settings.systemMonitor.memoryEnabled" @change="updateMonitorNumber('memoryHighThreshold', $event)" /><span>%</span></div></label>
      <h4 class="settings-group-heading">Network</h4>
      <label class="setting-row"><span><strong>Enable Network Monitor</strong><small>显示全系统实时下载与上传速度。</small></span><input class="toggle" type="checkbox" :checked="settings.systemMonitor.networkEnabled" :disabled="!settings.systemMonitor.enabled" @change="updateMonitorBoolean('networkEnabled', $event)" /></label>
      <h4 class="settings-group-heading">Storage</h4>
      <label class="setting-row"><span><strong>Enable Storage Monitor</strong><small>每30秒读取主要系统卷。</small></span><input class="toggle" type="checkbox" :checked="settings.systemMonitor.storageEnabled" :disabled="!settings.systemMonitor.enabled" @change="updateMonitorBoolean('storageEnabled', $event)" /></label>
      <h4 class="settings-group-heading">Battery</h4>
      <label class="setting-row"><span><strong>Enable Battery Monitor</strong><small>每30秒读取主电池状态。</small></span><input class="toggle" type="checkbox" :checked="settings.systemMonitor.batteryEnabled" :disabled="!settings.systemMonitor.enabled" @change="updateMonitorBoolean('batteryEnabled', $event)" /></label>
    </article>
  </div>
</template>
