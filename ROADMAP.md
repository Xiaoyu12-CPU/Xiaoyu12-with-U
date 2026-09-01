# DesktopPet 开发路线图

## 路线图原则

- macOS 优先验证交互与稳定性，同时保持 Rust 平台抽象可扩展到 Windows。
- 各阶段在上一阶段稳定后推进，避免系统能力和 UI 同时大范围扩张。
- 权限、隐私、资源占用和可恢复性属于每个相关阶段的完成条件。
- 本路线图描述目标，不代表对应功能当前已经实现。

当前实现进度：Phase 1、Phase 1.5、Phase 2-A 至 Phase 2-E、Phase 3-A 至 Phase 3-G、Phase 4 提醒系统和 Phase 5 输入感知均已完成；CPU、Memory、Network、Storage、Battery 使用真实采样。v0.4.4 已完成四窗口桌面重建后的 UI 与稳定性收尾。Phase 6 自定义皮肤包与 Phase 7 AI 互动仍属于后续规划。

Phase 2-D 后已完成一次小范围 Interaction Cleanup，Runtime 主动鼠标交互调整为 Click + Drag。

## Phase 1：基础桌宠窗口

目标：将默认 Tauri 窗口转变为可长期运行的基础桌宠容器。

计划内容：

- 建立透明、无边框、置顶的小型桌宠窗口。
- 支持拖拽移动、位置记忆和基础右键菜单。
- 明确鼠标点击与点击穿透的切换策略。
- 处理 Retina/DPI、多显示器、全屏应用和工作区切换。
- 建立 Rust 窗口控制与 Vue 展示之间的稳定接口。
- 优先完成 macOS 行为，并为 Windows 窗口适配保留统一边界。

完成标志：桌宠窗口在 macOS 上可稳定启动、移动、恢复位置和退出，不影响正常桌面操作。

## Phase 2：像素动画系统

目标：建立可扩展、资源消耗可控的像素动画运行机制。

计划内容：

- 定义帧序列、帧率、循环、朝向和锚点等动画数据格式。
- 建立待机、移动、点击反馈等基础动画状态机。
- 实现像素清晰渲染，避免缩放模糊和布局抖动。
- 预加载和缓存动画资源，控制内存占用。
- 将角色状态逻辑与具体皮肤资源解耦。

完成标志：桌宠可在多个基础状态之间稳定切换，长时间运行无明显卡顿或资源增长。

### Phase 2-C6 完成记录：State & Animation Editor

已完成：

- Control Center 增加“状态与动画”页面，并显示所有已定义的 `PetState`。
- 建立 State Registry，支持 `active` / `planned` 生命周期元数据。
- 动画清单升级为向后兼容的 schema v2，支持逐帧 duration。
- 支持 Continuous、Fixed Delay、Random Delay、Loop 与 Non-loop。
- 支持 PNG 单个/批量上传、顺序调整、从动画移除及 User PNG 物理删除。
- Built-in 资源保持只读，User Assets 保存到 Tauri `app_data_dir()/pets/`。
- AssetLoader 使用 User Override 优先、Built-in 与 idle 逐级 fallback。
- Control Center 使用独立 AnimationEngine 实例预览，不改变桌宠 Runtime State。
- 保存后通过跨窗口资源事件触发 AssetLoader / AnimationEngine 热重载。
- 上传边界仅接受静态 PNG；GIF、APNG 和其他格式留待后续资源系统扩展。

当前默认 idle 眨眼迁移为四个逐帧 duration：`250 / 250 / 250 / 0 ms`，Animation Duration 仍为 `750 ms`；Random Delay 继续使用 `3000 / 10000 / 22000 / 30000 ms` 候选值。

### Phase 2-D 完成记录：Application Settings System

已完成：

- 建立带 `schemaVersion` 的统一 DesktopPetSettings Schema 与集中默认值。
- Settings Manager 提供响应式读取、单字段更新、批量更新、恢复默认值、自动保存和跨窗口通知。
- 配置保存到 Tauri `app_data_dir()/settings.json`，不修改源码或 App Bundle。
- 损坏 JSON 安全回退；缺失字段补默认值；未知字段不会阻止启动。
- Control Center 增加“设置”页面，只展示当前真正生效的外观、Dialogue 和 Animation 配置。
- petScale 支持 50%～200%，大尺寸同步扩展透明窗口以避免裁切。
- Always On Top 可在运行时切换。
- 气泡时长、启动 development 提示以及 Click/Drag Dialogue 开关已接入现有事件系统；Hover 开关仅为旧配置兼容保留。
- Animation Enabled 复用 AnimationEngine pause/resume，关闭时稳定保留有效静态帧。
- `systemMonitor`、`input`、`reminder` 仅保留配置数据，没有提前实现或展示尚不可用功能。

### Interaction Cleanup 完成记录：Click + Drag

- Hover 不再是 Runtime Interaction；鼠标进入或离开不会修改 PetState、触发 Dialogue 或执行恢复逻辑。
- `alert` PetState 与对应资源编辑能力完整保留，供未来系统事件使用。
- `enableHoverDialogue`、`hoverEnter`、`hoverLeave` 继续兼容旧 JSON，但不显示在正常 Settings / Dialogue 编辑列表中。
- 修复 Drag Session 将 `startDragging()` resolve 误判为松开的时序问题。
- Drag 只在真实释放时触发一次 `drag.end`，结束文本延迟 500ms 显示。
- 保持 4px 阈值、拖动后 Click Suppression 和 `enableDragDialogue` 行为。

### Phase 2-E 完成记录：Behavior Manager / State Arbitration

- 新增轻量 Behavior Request 仲裁层；业务 source 不再直接决定最终 PetState。
- Request 支持 source、state、priority、可选 durationMs、createdAt 和 sequence；同一 source 更新替换，不无限堆积。
- 默认优先级集中定义为 dragging、alert、sleep、happy、working、tired、idle 的降序规则。
- 同优先级由最新 sequence 获胜，避免依赖对象遍历顺序。
- Held Request 显式 release；Transient Request 自动释放，并通过清除旧 timer 与 sequence 校验避免竞态。
- Click 迁移为 1200ms happy transient；快速再次点击会重新计时。
- Drag 迁移为 held dragging；真实 pointerup 立即 release 并恢复下一个有效 Request，500ms Dialogue 延迟保持独立。
- Runtime Status 与 Control Center 增加 Effective State、Winning Source、Active Behavior Requests 和明确标记的 Development / Debug 验收入口。
- Hover 没有 Behavior source；CPU、Reminder、Keyboard 仅记录未来 request/release 接入方式，没有实现真实功能。

## Phase 3：CPU / 内存 / 电池监控

目标：让桌宠安全、低开销地感知设备状态。

计划内容：

- 在 Rust 层采集 CPU、内存和电池信息。
- 统一不同平台的指标单位、缺失值和能力描述。
- 提供可配置的采样频率与事件节流。
- 在前端展示指标，并允许指标驱动桌宠状态。
- 处理睡眠、唤醒、电池设备缺失和权限异常。

完成标志：macOS 指标稳定准确，后台采样开销可接受，前端不会因高频更新产生明显负担。

### Phase 3-A 完成记录：CPU Monitor

- Rust 使用仅启用 `system` feature 的 `sysinfo` 读取整个系统总体 CPU 使用率，不调用 shell 或 Activity Monitor。
- 主桌宠窗口是唯一 Monitor owner；Control Center 只通过 Runtime Status / Runtime Bridge 接收数据。
- 首次采样只建立 delta baseline，500ms 后取得首个有效值；后续按 Settings 中的 Poll Interval 串行采样。
- `systemMonitor.enabled` 与 `cpuEnabled` 控制启停；Threshold 与 Poll Interval 可在运行时修改。
- Poll 使用单 timer、串行 invoke 和 generation 防护，避免重复 loop 与停用后的陈旧结果。
- 使用 10 percentage points hysteresis：达到 Threshold 进入 High，低于或等于 Threshold - 10 才恢复 Normal。
- CPU High 通过 Behavior Manager 请求 `system.cpu / tired / priority 30`；Normal 或 Disable release 请求。
- CPU High / Normal Dialogue 只在状态边沿各触发一次，持续 High 不重复显示。
- Runtime Status 与 Control Center 显示 CPU Usage、Status、Threshold 和 Monitoring State。
- 本阶段未实现 Memory、Battery、Temperature、历史图表或其他系统能力。

### Phase 3-B 完成记录：Memory Monitor

- Rust 复用 `sysinfo 0.39.6` 的 RAM-only refresh，读取整个系统的 Total、Used 与 Available Memory；百分比按 `used / total × 100` 计算。
- 主桌宠窗口是唯一 Memory Monitor owner；Control Center 仅通过 Runtime Status / Runtime Bridge 接收同一份快照。
- `systemMonitor` 增加 `memoryEnabled` 与默认 85% 的 `memoryHighThreshold`；旧 settings.json 缺失字段时自动补默认值。
- Memory 与 CPU 继续复用 `cpuPollIntervalMs` 作为共同采样间隔，避免重命名造成 Settings schema 迁移。
- Memory 使用单 timer、串行 invoke 与 generation 防护；关闭 Memory 或 Master 开关会停止、清空 Runtime 数值并 release 请求。
- 使用 5 percentage points hysteresis：达到 Threshold 进入 High，低于或等于 Threshold - 5 才恢复 Normal。
- Memory High 通过 Behavior Manager 请求独立的 `system.memory / tired / priority 30`；不会与 `system.cpu` 互相释放。
- `system.memory.high` / `system.memory.normal` 只在状态边沿触发，并已进入可编辑 Dialogue Catalog。
- Control Center 显示 Usage、Used、Available、Total、Status、Threshold 与 Monitoring State。
- 本阶段未实现 Battery、Temperature、Memory Pressure、Swap 专项、历史数据或其他系统能力。

### Phase 3-C 完成记录：System Status Bubble

- 新增与 Dialogue SpeechBubble 分离的长期 `SystemStatusBubble`，不创建第二个 Tauri Window。
- Settings 增加 `pet-only`、`status-only`、`both` 三种桌面显示模式，默认保持 `pet-only`。
- 面板直接消费现有 Runtime Status 的真实 CPU / Memory 数据；关闭 Monitor 时显示“未启用”。
- Network 与 Storage 只保留 `--` 入口，不制造假数据，也不启动新采样器。
- `both` 模式下拖 Pet 继续移动整个主窗口；拖 Bubble 只更新相对 offset，松手后才持久化。
- `status-only` 模式下 Bubble 成为主窗口原生拖动手柄。
- 新增纯 Window Bounding Box 计算，按当前可见 Pet / Bubble 矩形动态设置窗口 logical size。
- 支持负 offset；布局通过 content origin 和窗口 position delta 补偿避免扩窗时视觉跳动。
- Bubble offset 限制为 X / Y 各 -500～500，防止单窗口透明点击区域无限扩大。
- Control Center 设置可修改背景色、透明度、字体色、边框色与宽度，并可重置面板到 Pet 右侧。
- 50%～200% petScale 与三种 displayMode 共用同一布局规则；SpeechBubble、Click / Drag、CPU / Memory Monitor 保持原有链路。
- 本阶段未实现 Network、Storage、Battery、历史图或第二窗口方案。

### Phase 3-C 收尾记录：Bubble 可配置内容与尺寸

- 主透明桌宠窗口关闭 native shadow，消除动态 Bounding Box 外围的系统灰色矩形；Control Center 窗口不受影响。
- `systemStatusBubble` 增加 `panelWidth`（180～420）、`panelScale`（70%～160%）与数组型 `visibleItems`，旧配置自动补默认值且不升级 schemaVersion。
- Control Center 的面板设置按显示、尺寸、外观分组，可即时调整宽度、整体缩放并选择 CPU、Memory、Network、Storage。
- 所有项目可全部隐藏；面板仍保留最小 System Status header，高度始终由实际内容自动计算，不保存固定 panelHeight。
- 缩放使用真实 CSS 尺寸而非 transform，ResizeObserver 与现有 Window Bounding Box 会在内容或尺寸变化后同步调整主窗口，保持 offset 且不裁切。
- Network 与 Storage 继续仅显示 `--` 占位，本次未实现新的 Monitor。

### Phase 3-D 完成记录：Network Monitor

- Rust 复用 `sysinfo 0.39.6` 并仅增加 `network` feature，读取非 loopback 接口的累计接收/发送 bytes。
- main Pet Window 是唯一 Network Monitor owner；Control Center 与 SystemStatusBubble 只消费 Runtime Bridge 的同一份数据。
- 下载与上传速率按累计 counter delta / `Instant` 实际 elapsed seconds 计算，Runtime 保留 bytes per second 数值。
- 首次采样只建立 baseline；超出 `max(interval × 3, 30 秒)` 的睡眠/唤醒间隔与 counter reset 都丢弃当前结果并重建 baseline。
- Settings 增加默认关闭的 `networkEnabled`，继续复用兼容字段 `cpuPollIntervalMs` 作为共同 System Poll Interval。
- Network lifecycle 支持 warming、active、error、disabled，并使用单 timer、串行 invoke 与 generation 防止重复 loop。
- Control Center 增加 Network 设置与 Runtime 区域；SystemStatusBubble 的既有 Network item 显示真实 Download / Upload，隐藏机制保持不变。
- Network 不参与 Behavior 或 Dialogue；本阶段未实现 Storage、Battery、Temperature、历史统计或接口选择器。

### Phase 3-E 完成记录：Storage Monitor

- Rust 复用 `sysinfo 0.39.6` 的 `disk` feature，通过 `Disks` / `Disk` 读取系统根卷的 mount point、total space 与 available space。
- macOS 只选择 mount point 为 `/` 的条目，不按卷名称判断，也不合计外接盘、DMG、Time Machine、网络挂载或临时文件系统。
- 容量按 `used = total - available`、`usage = used / total × 100` 计算，保留原始 bytes 并防止 total 为 0。
- main Pet Window 是唯一 Storage Monitor owner；Control Center 与 SystemStatusBubble 只消费 Runtime Bridge 的同一份数据。
- Settings 增加默认关闭的 `storageEnabled`，旧 settings.json 自动补默认字段，schemaVersion 保持为 1。
- Storage 启用后立即采样，之后使用独立固定 30 秒周期；单 timer、串行 invoke 与 generation 防止重复 loop。
- Disable、Master OFF 或读取错误会安全清理/降级，不影响 DesktopPet 其他功能。
- Runtime Status 与 Control Center 增加 Usage、Used、Available、Total、Status 和 Monitoring；Bubble 的既有 Storage item 改为真实百分比、容量与进度条。
- Memory 与 Storage 共用统一 Byte formatter；Storage 不参与 Behavior 或 Dialogue。
- 本阶段未实现多磁盘、历史记录、Disk IO、SMART、APFS snapshot、Battery、Temperature 或其他系统能力。

### Phase 3-F 完成记录：Battery Monitor

- `sysinfo 0.39.6` 没有 Battery 容量 API，因此新增单一依赖 `starship-battery`，使用其跨平台 Manager、State 与 state_of_charge。
- Rust 读取第一块成功解析的电池，将 Charging、Discharging、Full、Unknown 统一映射；Empty 归为 discharging。
- 没有电池是正常 `batteryPresent = false / unavailable`，与 Manager 或设备读取 error 明确区分。
- main Pet Window 是唯一 Battery Monitor owner；Control Center 与 SystemStatusBubble 只消费 Runtime Bridge 的同一份快照。
- Settings 增加默认关闭的 `batteryEnabled`；旧 settings.json 自动补默认值，schemaVersion 保持为 1。
- Battery Enable 后立即采样，之后使用固定 30 秒周期；单 timer、串行 invoke 与 generation 防止重复 loop。
- Runtime Status 与 Control Center 增加 Charge、State、Present 和 Monitoring。
- Battery 注册为可选 Status Item，但不加入默认 visibleItems，因此旧用户界面不会突然多出 Battery。
- Bubble 支持电量百分比、充电中、使用电池、已充满、状态未知、无电池、未启用与读取失败，并复用轻量进度条。
- Battery 当前不参与 Behavior 或 Dialogue；本阶段未实现低电量提醒、健康度、循环次数、温度、功耗、历史或高级分析。

### Phase 3-G 完成记录：System Monitor Integration & UX Cleanup

- Settings 的 System Monitor 区域统一为 Master Switch、System Poll Interval，以及 CPU、Memory、Network、Storage、Battery 五个独立分组。
- Master OFF 只暂停所有 Monitor，不重置五个子开关；重新开启后按原子项配置恢复。
- `cpuPollIntervalMs` 保持兼容字段名，UI 统一显示为 System Poll Interval，并继续只供 CPU、Memory、Network 使用。
- Storage 与 Battery 保持固定 30 秒周期，不受 System Poll Interval 影响。
- Current Status 固定按 CPU、Memory、Network、Storage、Battery 排列，统一显示 Active、Disabled、Warming、Error、Unavailable。
- Current Status 与 SystemStatusBubble 的 Disabled 项目均提供“前往设置”，打开或聚焦 Control Center 并导航至 System Monitor Settings，不自动启用 Monitor。
- 跨窗口导航复用 Runtime Bridge，并使用 ready / acknowledgement 处理 Control Center 首次创建时的事件时序。
- 五项 Monitor 生命周期审计确认继续使用独立单 timer、串行 invoke 与 generation，单项错误不影响其他 Monitor。
- Bubble 尺寸上报与 Pet 布局应用增加相同宽高去重；常规 CPU、Memory、Network 数值变化不会持续触发 Window resize。
- Battery 继续是可选 visible item；默认和旧用户 visibleItems 不会自动增加 Battery。
- develop 分支保留 HAPPY、SLEEP、TIRED、ALERT、WORKING、DRAGGING 文字 Placeholder，供 Behavior 与 Monitor Runtime 肉眼验收。

## Phase 4：提醒和闹钟

目标：提供可靠、可恢复的本地提醒能力。

计划内容：

- 支持一次性提醒、重复提醒和闹钟。
- 建立提醒数据模型、持久化与调度服务。
- 提供创建、编辑、暂停、删除和历史查看界面。
- 接入系统通知与桌宠动画反馈。
- 处理应用重启、系统睡眠和错过触发时间的恢复策略。
- 明确时区和夏令时行为。

完成标志：提醒在应用重启和系统睡眠后仍能按既定策略触发，并可被用户完整管理。

### Phase 4-A～4-F 完成记录

- Reminder 数据模型支持 once / daily，以及创建、编辑、启停、删除与 `app_data_dir()/reminders.json` 安全持久化。
- 主桌宠窗口持有唯一 Scheduler，按本地时区调度，支持 5 分钟 Grace Window、Sleep / Wake 恢复与 occurrence duplicate protection。
- Reminder Trigger 通过 Behavior Manager 显示约 5 秒 ALERT，并把 Reminder 自定义文本作为 persistent actionable feedback 展示。
- 内置 default / soft / digital 提醒音支持试听与全局音量；声音失败不阻塞 Behavior、Dialogue 或 Once 自动停用。
- 支持完成，以及 5 / 10 / 30 分钟持久化 Snooze；Snooze 保存文本与声音快照，不修改原 once / daily 时间。
- Control Center Reminder 页面统一展示 Master、Scheduler、权威 Next Reminder、Last Trigger、按时间排序的 Pending Snooze 和 Reminder 列表。
- Pending Snooze 可独立取消，保存后通过现有跨窗口事件让主 Scheduler 立即重算；旧文档缺失 Snooze 或声音字段仍兼容。
- Actionable Reminder Bubble 不受普通 `bubbleDurationMs` 限制，且不会被普通 Dialogue 覆盖；Dismiss / Snooze 后普通 Dialogue 恢复。
- Phase 4 当前范围已完成；System Notification、Weekly、Monthly、自定义音频与复杂历史不属于本阶段实现。

## Phase 5：键盘鼠标监听

目标：在用户明确授权后，以隐私友好的方式感知全局输入活动。

计划内容：

- 建立 macOS 辅助功能权限检测、申请引导和撤销说明。
- 在 Rust 层实现可启停的全局键盘与鼠标监听。
- 默认只统计活动或识别必要快捷操作，不记录输入文本。
- 对高频鼠标事件进行采样、聚合和节流。
- 定义 Windows 输入钩子的统一接口与后续实现边界。
- 提供清晰的隐私设置和总开关。

完成标志：用户可明确控制监听状态；未授权时应用正常降级；不保存敏感键入内容。

### Phase 5-A 实现记录：Global Keyboard Input Monitor Foundation

- macOS 使用 Core Graphics Session Event Tap 的 ListenOnly 模式接收真正的全局 KeyDown、KeyUp 与 Modifier FlagsChanged，不依赖 WebView 焦点。
- Rust App Runtime 是唯一 Native listener owner；main Pet Window 维护权威 pressedKeys，Control Center 只消费 Runtime Bridge 快照。
- Event schema 仅包含 down/up、稳定 key 名和 timestamp，不保存输入历史、不组合文字、不记录原始按键日志。
- `settings.input.keyboardEnabled` 默认关闭；启停会创建/停止监听并清空当前 pressedKeys，重复 start 不创建第二 Listener。
- Runtime 状态支持 Disabled、Starting、Permission Required、Active、Error、Unsupported，以及 Last Key / Last Activity 调试信息。
- macOS 使用系统 Input Monitoring 权限预检与标准请求，拒绝或缺失权限时安全降级；不会反复打开系统设置。
- Windows 当前保留 platform adapter 和统一 schema，Native Hook 尚未实现并明确返回 Unsupported。
- Phase 5-A 状态：Implemented；Phase 5 仍为 In Progress，尚未实现 Key Bubble、WORKING Behavior、鼠标监听、历史或统计。

### Phase 5-B / 5-B.1 实现记录：Directional Key History Stack

- 主桌宠窗口新增 Directional Key History Stack，直接消费 Phase 5-A 的权威 pressedKeys，不创建第二监听器。
- 普通键与当前 Modifier 聚合成独立 Chord Entry；Command 持续按住时可依次显示 `⌘ C`、`⌘ V`，不拼接 typed text。
- Entry 只存在于当前 Runtime 内存；支持 1～8 条最大数量、每条独立过期 duration，以及不跨重启的 Persistent 模式。
- 支持 Top / Bottom / Left / Right 锚点和 Auto / Up / Down / Left / Right Flow；Position 与 Flow 完全独立，Auto 才选择远离 Pet 的方向。
- Up / Down 为纵向 Stack，Left / Right 为横向 Stack；TransitionGroup 提供 enter、move 与四向离场动画。
- 主窗口按 Position、Flow、maxItems 与 petScale 使用固定预留区域，Entry 新增、过期和文本宽度不会触发 Window resize；status-only 模式不显示。
- Phase 5-B.2 保留固定 Reserved Area，并把 History Base Origin 锚定到 Position 对应的 Pet-facing edge；Entry 变化不触发 Window resize，Pet 与 SystemStatusBubble 的屏幕定位补偿保持稳定。
- Phase 5-B.3 增加始终水平的 Start Line 与 ±500px manual X/Y offset；Pointer Drag 实时移动 History，只在结束时持久化，Position 与 Flow 均不被反向修改。
- Start Line 支持颜色、透明度和重置位置；Opacity 为 0 时可见线消失但 Drag Hit Area 仍可使用。B.2 的 Distance Slider 已从最终设计移除，旧字段被安全忽略。
- Start Line 与 Newest Entry 支持 0～80px 独立视觉 Gap；Gap 根据 Flow 作用于 X 或 Y 轴，以 56×2px 可见线而非 72×24px Hit Area 为基准，并纳入固定 Window Bounding。
- Phase 5-B.3 状态：Implemented；Phase 5 仍为 In Progress。

### Phase 5-C 实现记录：Keyboard Activity → WORKING Behavior

- main Pet Window 只消费既有 lastActivityAt、pressedKeys 与 Keyboard Monitor Status，通过 Behavior Manager 请求 `input.keyboard / working`，不修改 Native Hook 或 Key History。
- 首次活动创建唯一 request；持续输入只重置约 2000ms idle timer，不反复 request / release。长按期间 pressedKeys 非空时不会退出 working。
- Keyboard Monitor 关闭或非 Active 会立即 release；dragging、alert、happy 按既有优先级覆盖 working，结束后自动恢复 working 或下一有效状态。
- Runtime Status 增加当前 Keyboard Activity Active / Idle，不保存历史。Phase 5-C 状态：Implemented；Phase 5 仍为 In Progress。

### Phase 5-C.1 Feature Freeze Exception：Configurable Typing Feedback

- Keyboard Runtime 增加独立 Typing Feedback Detector consumer；只统计已接受、非重复、非纯 Modifier 的 keydown timestamp，不保存 key 名或 typed content。
- Busy Typing 默认为 Rolling 120 秒 / 200 次，Fast Typing 默认为 Rolling 1 秒 / 5 次；阈值、Busy window 与两条文本可配置。
- 两个 Detector 各自使用 threshold-crossing latch，并共享 1～600 秒可配置 cooldown（默认 10 秒）；只有 Dialogue 真正显示才开始 cooldown，被抑制的 trigger 不排队或补播。
- Typing Feedback 使用 Low Dialogue Priority：不覆盖 Normal Dialogue 或 Protected Actionable Reminder，而 Normal / Reminder 可以覆盖已显示的 Typing Feedback。
- 所有 metrics 仅在 Runtime 内存中保存 timestamp；Keyboard Monitor 关闭或异常状态会全部重置。这是 Feature Freeze 的受控例外，不重新开放 Phase 5，不包含 WPM、History 或 Analytics。

### Phase 5-D 实现记录：Global Mouse Monitor Foundation

- macOS 复用并扩展 Phase 5-A 的单一 ListenOnly CGEventTap，监听 Left / Right / Middle / Mouse4 / Mouse5 / Other Down/Up 和 Scroll，不监听 Mouse Move。
- Native Input Monitor 是唯一 Hook owner；Keyboard 与 Mouse 在 Rust 事件路由和 Frontend Runtime 保持独立，两个开关互不重置。
- Mouse Event 只传稳定 button、scroll direction 与 timestamp，不传坐标、窗口、应用或原始 button number。
- main Mouse Runtime 仅维护当前 pressedButtons 与最近一次 Button / Scroll；重复 down 被 Set 过滤，关闭时清空，不保存点击或移动历史。
- `settings.input.mouseEnabled` 默认关闭，Control Center 增加独立开关和轻量 Runtime 状态；macOS 复用 Input Monitoring 权限。
- Mouse 模块不接入 Key History，也不接入 Behavior Manager，因此 Button / Scroll 不生成键盘 Entry 且不会触发 WORKING。
- Windows 当前沿用 platform adapter 边界并返回 Unsupported；Phase 5-D 状态：Implemented，Phase 5 仍为 In Progress，Mouse Visualizer 尚未实现。

### Phase 5-E 实现记录：Mouse Input Visualizer

- 主桌宠窗口新增独立抽象 Mouse Visualizer，只消费 Phase 5-D 的 pressedButtons、lastScrollDirection 与 lastScrollAt，不建立第二 Listener。
- Left、Right、Middle、Mouse4、Mouse5 可独立且同时高亮；Other 使用安全附加标记。
- Scroll Up / Down / Left / Right 使用约 600ms 的 Wheel Pulse，新 Scroll 刷新 Pulse；不建立 Mouse/Scroll History。
- `mouseVisualizerEnabled` 默认 true，但只在 Mouse Monitor Active、mouseEnabled 且 Pet 可见时显示；Keyboard 开关不影响它。
- Visualizer 使用简洁 SVG 鼠标线稿，Body、Button、Outline 与 Active 的颜色/透明度分层独立，Outline Width 统一控制线稿粗细；样式变化不进入 Window Layout。
- Visualizer 支持 Top / Bottom / Left / Right 独立 Position，以及 ±500px manual offset；明确 Drag Handle 实时预览、结束时持久化，Reset 只清零 offset。
- 固定 Visualizer Rect 纳入主 Window Bounding，并复用 position compensation 稳定 Pet；Mouse、Key History、SystemStatus 三套 offset 完全独立。
- Visualizer 不导入 Key History 或 Behavior Manager，因此 Mouse Input 不产生 Keyboard Entry，也不触发 WORKING。
- Phase 5-E 状态：Implemented；Phase 5 仍为 In Progress，不包含 Mouse Move、Mouse History、统计或品牌皮肤。

### Phase 5-F 完成记录：Input Awareness Integration & Cleanup

- Keyboard 与 Mouse 复用唯一 Rust Native Input Monitor；任一 channel 开启即保留 listener，两者均关闭才停止，不重复创建 CGEventTap。
- Keyboard Disable 会清空 pressedKeys、History entries/timers、Activity idle timer，并 release `input.keyboard`；Mouse Runtime 不受影响。
- Mouse Disable 会清空 pressedButtons、Scroll transient state 与 Visualizer pulse timer；Keyboard History / WORKING 不受影响。
- Show Keyboard History 与 Show Mouse Visualizer 只控制 UI visibility，不改变对应 Native Monitor 或 Runtime 生命周期。
- Mouse Input 继续不进入 Keyboard History、不请求 WORKING；WORKING 的唯一输入 source 是 `input.keyboard`，既有 Behavior priority 保持不变。
- Pet、SystemStatusBubble、Keyboard History、Mouse Visualizer 共同进入固定 Window Bounding，三套 offset 独立；按键、按钮、Scroll Pulse 与样式变化不会持续 resize OS Window。
- Input Runtime 只存在于内存，不持久化文本、raw key stream、History、Mouse 坐标、轨迹、点击记录、应用或窗口信息。
- macOS Input Monitoring 完整实现；Windows Native Hook 保持 Unsupported，留待 Phase 9。
- Phase 5 Input Awareness 状态：Completed。

## Platform Adaptation / Release Polish

Phase 1～5 Feature Development 已完成，项目进入 Feature Freeze。当前阶段只处理平台兼容、产品命名、图标、打包与发布质量；不新增产品功能，最终 PetState 美术由用户后续通过现有 Asset System 补齐。

### Phase 6-A：macOS Intel Compatibility & Build

- 正式 Product Name：`withXiaoyu12`；最终 macOS App：`withXiaoyu12.app`。
- Bundle Identifier 固定为 `com.Xiaoyu12.desktoppet`，保持现有 Settings、Reminder、User Assets 与 app_data_dir 连续性。
- macOS 分别发行 Apple Silicon 与 Intel 包，不制作 Universal Binary。
- 最终 DMG 命名锁定为 `withXiaoyu12-macOS-arm64.dmg` 与 `withXiaoyu12-macOS-x64.dmg`。
- App Icon 使用 default Pet idle 首帧，保持原比例放置到 1024×1024 透明安全画布，再生成 macOS `.icns`。
- 当前以 `x86_64-apple-darwin` cross-build 和 Bundle 静态验证为目标；Intel Runtime Verified 必须等待 Intel Mac 实机验收。
- x86_64 Cargo check、纯 Intel Release `.app` / `.dmg` 构建与 DMG 只读挂载验证已完成；测试包未签名、未公证，Intel 实机运行状态仍为待验收。

### Release UX Polish：Control Center Settings IA

- Settings 已拆成 General、System、Input、Dialogue & Interaction、Control Center Appearance 五个二级页面；Input 再拆分 Keyboard、Typing Feedback、Mouse 三级页，不再依赖单页滚动定位。
- Reminder Master 与 Sound Volume 移入 Reminder 页面，仍复用原 Settings 字段与 Scheduler / Sound Runtime。
- Control Center Theme 使用集中 Semantic Tokens，支持 WebView 内部背景色/透明度、托管背景图片、Cover / Contain / Stretch / Center / Tile、图片透明度、Sidebar、文字、Cards / Borders、Accent 与只重置Theme。
- 运行时导入的 PNG、JPG / JPEG、WebP 会复制到应用自己的 `app_data_dir()/control-center/background/`；settings.json 不保存Base64或外部绝对路径，损坏或缺失时回退背景颜色。
- 本阶段属于 Release UX Polish，Feature Freeze继续有效，不修改Reminder、System Monitor、Input、Behavior、Animation或Dialogue业务逻辑。

### Release Baseline Freeze：Shipping Appearance

- 当前确认的Control Center Appearance字段已冻结为新安装环境的Shipping Defaults；业务开关、Reminder数据、Monitor状态和跨设备不安全的各类Offset没有复制。
- 当前托管背景已复制为`src/assets/control-center/default-background.jpg`，通过Vite Asset URL跨平台打包；默认Settings保存`builtin:shipping-default`，不包含用户绝对路径或Base64。
- Built-in Shipping Background与用户Managed Background继续共存：existing settings优先，fresh install使用builtin，Reset Appearance恢复本次Shipping Theme并清理其后选择的Managed副本。

### v0.4.4：Control Center 与多窗口稳定性收尾

- 删除生产界面中的开发测试入口、启动开发提示和已经失效的旧 `displayMode` 设置。
- 合并重复的键盘历史/鼠标可视化开关，并为系统、键盘和鼠标状态增加直达设置导航。
- 动画、对话和提醒编辑器增加未保存修改保护；设置、主题和三个浮层位置提供范围明确的恢复入口。
- macOS 输入权限重试由主桌宠 Runtime 持有，不再依赖控制中心页面生命周期。
- 窗口同步只响应真正影响窗口的设置；持有全局窗口锁的命令改为异步调度，修复控制中心设置变更引发的主线程死锁。
- `main`、`develop` 与 v0.4.4 发布分支在发布时统一到同一代码树；旧 v0.4.2 实验窗口实现仅保留为历史。

## Phase 6：自定义皮肤

目标：允许安全地安装、切换和管理桌宠外观。

计划内容：

- 定义带版本号的皮肤包和清单格式。
- 规范动画名称、帧资源、缩放、锚点和预览图。
- 实现皮肤导入、校验、预览、启用、删除和回退。
- 防止路径穿越、超大资源和不受支持的文件格式。
- 兼容不同屏幕缩放和未来的皮肤格式迁移。

完成标志：用户可在不修改应用代码的情况下安全切换皮肤，损坏皮肤不会影响应用启动。

## Phase 7：AI 互动功能

目标：在不削弱核心离线体验的前提下，提供可选的智能互动。

计划内容：

- 定义聊天、情绪表现、上下文和桌宠动作之间的边界。
- 将模型提供方封装为可替换的服务接口。
- 安全保存凭据，不在前端或日志中暴露密钥。
- 提供明确的数据发送说明、用户授权和历史清理能力。
- 控制请求频率、成本、超时、取消与失败降级。
- 将 AI 输出限制为可验证的动作集合，避免直接获得系统权限。
- 保持动画、提醒和监控等核心功能在无网络或未配置 AI 时正常工作。

完成标志：AI 功能可独立启停，隐私边界清晰，网络或模型失败不会影响桌宠核心功能。

## 跨平台里程碑

macOS 是 Phase 1–7 的首要实现和验证平台。Windows 支持不作为单一末期移植任务，而是在各阶段保持接口兼容，并在核心功能稳定后逐模块补齐：

1. 窗口和显示器行为。
2. 系统指标与电池能力。
3. 通知、提醒恢复和自启动。
4. 全局输入与权限体验。
5. 打包、签名、升级和平台专项测试。
