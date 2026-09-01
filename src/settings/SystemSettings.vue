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
  settingsManager.updateSetting("windows", "systemStatusWindowEnabled", enabled);
}
function updateWindowBoolean(key: "systemStatusClickThrough", event: Event): void {
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
      <div class="section-heading"><h3>{{ $t("系统状态窗口") }}</h3><p>{{ $t("管理显示、尺寸、位置和外观，不改变监控运行逻辑。") }}</p></div>
      <h4 class="settings-group-heading">{{ $t("显示") }}</h4>
      <div class="setting-row">
        <span><strong>{{ $t("系统状态窗口") }}</strong><small>{{ $t("与桌宠主窗口完全分离，可独立拖动。") }}</small></span>
        <input class="toggle" type="checkbox" :checked="settings.windows.systemStatusWindowEnabled" @change="updateStatusWindowEnabled" />
      </div>
      <label class="setting-row"><span><strong>{{ $t("点击穿透") }}</strong><small>{{ $t("开启后不能直接拖动此窗口，可在这里关闭。") }}</small></span><input class="toggle" type="checkbox" :checked="settings.windows.systemStatusClickThrough" :disabled="!settings.windows.systemStatusWindowEnabled" @change="updateWindowBoolean('systemStatusClickThrough', $event)" /></label>
      <div class="setting-row">
        <span><strong>{{ $t("显示内容") }}</strong><small>{{ $t("全部取消时仍保留最小标题。") }}</small></span>
        <div class="item-options"><label v-for="item in SYSTEM_STATUS_ITEMS" :key="item.id"><input type="checkbox" :checked="settings.systemStatusBubble.visibleItems.includes(item.id)" @change="updateVisibleItem(item.id, $event)" />{{ $t(item.label) }}</label></div>
      </div>
      <h4 class="settings-group-heading">{{ $t("尺寸与位置") }}</h4>
      <label class="setting-row scale-row"><span><strong>{{ $t("面板宽度") }}</strong><small>180～420 logical px</small></span><div class="scale-control"><input type="range" min="180" max="420" step="1" :value="settings.systemStatusBubble.panelWidth" @input="updateBubbleNumber('panelWidth', $event)" /><output>{{ settings.systemStatusBubble.panelWidth }} px</output></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("面板缩放") }}</strong><small>70%～160%</small></span><div class="scale-control"><input type="range" min="70" max="160" step="5" :value="panelScalePercent" @input="updatePanelScale" /><output>{{ panelScalePercent }}%</output></div></label>
      <div class="setting-row"><span><strong>{{ $t("窗口位置") }}</strong><small>{{ $t("拖动结束后自动保存；重置到当前默认布局。") }}</small></span><button type="button" @click="resetBubblePosition">{{ $t("重置系统状态窗口位置") }}</button></div>
      <h4 class="settings-group-heading">{{ $t("外观") }}</h4>
      <label class="setting-row"><span><strong>{{ $t("背景颜色") }}</strong></span><div class="color-control"><input type="color" :value="settings.systemStatusBubble.backgroundColor" @input="updateBubbleColor('backgroundColor', $event)" /><code>{{ settings.systemStatusBubble.backgroundColor }}</code></div></label>
      <label class="setting-row scale-row"><span><strong>{{ $t("背景透明度") }}</strong></span><div class="scale-control"><input type="range" min="0" max="1" step="0.05" :value="settings.systemStatusBubble.backgroundOpacity" @input="updateBubbleNumber('backgroundOpacity', $event)" /><output>{{ Math.round(settings.systemStatusBubble.backgroundOpacity * 100) }}%</output></div></label>
      <label class="setting-row"><span><strong>{{ $t("字体颜色") }}</strong></span><div class="color-control"><input type="color" :value="settings.systemStatusBubble.textColor" @input="updateBubbleColor('textColor', $event)" /><code>{{ settings.systemStatusBubble.textColor }}</code></div></label>
      <label class="setting-row"><span><strong>{{ $t("边框颜色") }}</strong></span><div class="color-control"><input type="color" :value="settings.systemStatusBubble.borderColor" @input="updateBubbleColor('borderColor', $event)" /><code>{{ settings.systemStatusBubble.borderColor }}</code></div></label>
      <label class="setting-row"><span><strong>{{ $t("边框粗细") }}</strong><small>0～6 px</small></span><div class="number-control"><input type="number" min="0" max="6" step="1" :value="settings.systemStatusBubble.borderWidth" @change="updateBubbleNumber('borderWidth', $event)" /><span>px</span></div></label>
    </article>

    <article id="system-monitor-settings">
      <div class="section-heading"><h3>{{ $t("系统监控") }}</h3><p>{{ $t("由桌宠主窗口读取真实硬件状态。") }}</p></div>
      <label class="setting-row"><span><strong>{{ $t("启用系统监控") }}</strong><small>{{ $t("暂停时保留各项监控开关。") }}</small></span><input class="toggle" type="checkbox" :checked="settings.systemMonitor.enabled" @change="updateMonitorBoolean('enabled', $event)" /></label>
      <label class="setting-row"><span><strong>{{ $t("快速采样间隔") }}</strong><small>{{ $t("CPU、内存、网络共用；总开关关闭时仍保留配置。") }}</small></span><div class="number-control"><input type="number" min="500" max="10000" step="500" :value="settings.systemMonitor.cpuPollIntervalMs" :disabled="!settings.systemMonitor.cpuEnabled && !settings.systemMonitor.memoryEnabled && !settings.systemMonitor.networkEnabled" @change="updateMonitorNumber('cpuPollIntervalMs', $event)" /><span>ms</span></div></label>
      <h4 class="settings-group-heading">CPU</h4>
      <label class="setting-row"><span><strong>{{ $t("启用 CPU 监控") }}</strong></span><input class="toggle" type="checkbox" :checked="settings.systemMonitor.cpuEnabled" @change="updateMonitorBoolean('cpuEnabled', $event)" /></label>
      <label class="setting-row"><span><strong>{{ $t("CPU 高负载阈值") }}</strong><small>{{ $t("恢复阈值比此值低 10 个百分点。") }}</small></span><div class="number-control"><input type="number" min="10" max="100" step="5" :value="settings.systemMonitor.cpuHighThreshold" :disabled="!settings.systemMonitor.cpuEnabled" @change="updateMonitorNumber('cpuHighThreshold', $event)" /><span>%</span></div></label>
      <h4 class="settings-group-heading">{{ $t("内存") }}</h4>
      <label class="setting-row"><span><strong>{{ $t("启用内存监控") }}</strong></span><input class="toggle" type="checkbox" :checked="settings.systemMonitor.memoryEnabled" @change="updateMonitorBoolean('memoryEnabled', $event)" /></label>
      <label class="setting-row"><span><strong>{{ $t("内存高负载阈值") }}</strong><small>{{ $t("恢复阈值比此值低 5 个百分点。") }}</small></span><div class="number-control"><input type="number" min="50" max="100" step="5" :value="settings.systemMonitor.memoryHighThreshold" :disabled="!settings.systemMonitor.memoryEnabled" @change="updateMonitorNumber('memoryHighThreshold', $event)" /><span>%</span></div></label>
      <h4 class="settings-group-heading">{{ $t("网络") }}</h4>
      <label class="setting-row"><span><strong>{{ $t("启用网络监控") }}</strong><small>{{ $t("显示全系统实时下载与上传速度。") }}</small></span><input class="toggle" type="checkbox" :checked="settings.systemMonitor.networkEnabled" @change="updateMonitorBoolean('networkEnabled', $event)" /></label>
      <h4 class="settings-group-heading">{{ $t("储存") }}</h4>
      <label class="setting-row"><span><strong>{{ $t("启用储存监控") }}</strong><small>{{ $t("每 30 秒读取主要系统卷。") }}</small></span><input class="toggle" type="checkbox" :checked="settings.systemMonitor.storageEnabled" @change="updateMonitorBoolean('storageEnabled', $event)" /></label>
      <h4 class="settings-group-heading">{{ $t("电池") }}</h4>
      <label class="setting-row"><span><strong>{{ $t("启用电池监控") }}</strong><small>{{ $t("每 30 秒读取主电池状态。") }}</small></span><input class="toggle" type="checkbox" :checked="settings.systemMonitor.batteryEnabled" @change="updateMonitorBoolean('batteryEnabled', $event)" /></label>
    </article>
  </div>
</template>
