# DesktopPet 架构说明

## 1. 项目定位与当前状态

DesktopPet 是一个以 macOS 为首要平台、后续支持 Windows 的像素桌宠应用。项目采用 Tauri 2 作为桌面运行时，Vue 3 + TypeScript 构建界面与交互，Rust 负责桌面窗口、系统能力和平台相关逻辑。

当前仓库已完成透明桌宠窗口、PetState、资源加载、逐帧动画、交互、Dialogue、拖动、控制中心、Phase 2-C6 State & Animation Editor、Phase 2-E Behavior Manager、Phase 3-A CPU / Phase 3-B Memory 真实系统监控，以及 Phase 3-C System Status Bubble。电池、Network / Storage 真实采样、提醒、全局输入、自定义皮肤和 AI 仍按路线图留待后续阶段。

Phase 2-D Application Settings System 也已完成：全局用户偏好通过统一 Settings Manager 管理，保存到 Tauri 应用数据目录，并在桌宠窗口和控制中心之间实时同步。

前端入口仍为 `src/main.ts`，根组件 `src/App.vue` 根据窗口 URL 装配桌宠窗口或控制中心；Rust 入口为 `src-tauri/src/main.rs`，应用初始化及 Tauri command 注册位于 `src-tauri/src/lib.rs`。

## 2. 总体架构

```text
┌─────────────────────────────────────────────────────────┐
│ Vue 3 + TypeScript                                      │
│                                                         │
│ components  pet  system  reminder  input  settings      │
└──────────────────────────┬──────────────────────────────┘
                           │ Tauri invoke / event
                           │ 仅传递可序列化数据
┌──────────────────────────▼──────────────────────────────┐
│ Tauri 2 + Rust                                           │
│                                                         │
│ commands  pet  system  input                             │
└──────────────────────────┬──────────────────────────────┘
                           │ 平台抽象接口
              ┌────────────┴────────────┐
              │                         │
        macOS 实现                 Windows 实现
        窗口/系统/输入              窗口/系统/输入
```

核心原则：

1. 前端负责展示、动画编排和用户交互，不直接依赖操作系统 API。
2. Rust 负责系统权限、原生窗口、系统信息、全局输入和持久后台任务。
3. 前后端通过稳定、类型明确的 command 与 event 协议通信。
4. 平台差异收敛在 Rust 平台实现层，上层业务尽量保持跨平台。
5. 先保证 macOS 体验，再通过统一接口补充 Windows 实现，避免在业务代码中散布平台判断。

## 3. 技术分层

### 3.1 Vue 3 + TypeScript 前端

前端运行在 Tauri WebView 中，主要职责包括：

- 渲染透明桌宠窗口中的像素角色、状态提示和交互界面。
- 管理像素动画状态机、帧序列播放、朝向和视觉反馈。
- 接收 Rust 推送的 CPU、内存、电池、提醒和输入事件，并转换为界面状态。
- 提供提醒、闹钟、皮肤和应用偏好设置界面。
- 发起 Tauri command 调用，但不直接实现系统监控或全局输入监听。
- 管理仅与视图有关的短期状态；需要跨会话保存的数据交由统一设置或持久化层处理。

前端不应承担：

- 直接访问 macOS 或 Windows 原生 API。
- 持续执行高频系统采样或全局键鼠监听。
- 保存 API 密钥等敏感信息。
- 在组件中拼接大量平台分支或散落调用 `invoke`。

建议后续为 Tauri command/event 建立集中的 TypeScript 适配层和共享类型，避免 Vue 组件直接依赖协议细节。

### 3.2 Tauri 2 桥接层

Tauri 是前端与原生能力之间的边界：

- `command` 用于前端主动请求，例如读取设置、创建提醒、切换皮肤。
- `event` 用于 Rust 主动推送，例如系统指标更新、闹钟触发、全局输入事件。
- capability 配置遵循最小权限原则，只开放实际需要的能力。
- 所有跨边界参数和返回值使用可序列化、可版本化的数据结构。
- 高频数据需要节流或聚合，避免持续向 WebView 发送无意义事件。

### 3.3 Rust 后端

Rust 侧主要职责包括：

- 初始化 Tauri 应用、插件和桌宠窗口。
- 管理无边框、透明、置顶、拖拽、点击穿透等原生窗口行为。
- 读取 CPU、内存、电池等系统信息，并控制采样周期。
- 管理提醒和闹钟的调度、恢复与触发。
- 在获得用户授权后监听全局键盘和鼠标事件。
- 管理需要原生文件访问或安全存储的数据。
- 将平台相关实现包装成统一接口，向 command 层暴露平台无关能力。
- 处理资源释放、后台任务生命周期和错误边界。

Rust command 应保持轻量：负责参数校验、调用业务模块、转换错误和返回数据；平台 API 调用与业务逻辑不直接堆放在 command 函数中。

## 4. 前后端通信约定

建议将通信协议视为应用内部 API：

- command 使用“动作 + 对象”的稳定命名，例如 `get_system_snapshot`、`create_reminder`。
- event 使用领域命名，例如 `system://metrics-updated`、`reminder://triggered`。
- 数据结构显式包含单位和语义，避免只有含义不明的数值。
- 可恢复错误返回结构化错误码；内部错误信息记录在 Rust 日志中，不直接暴露敏感细节。
- 对高频输入和监控事件进行节流、合并或按需订阅。
- 协议变更时同步更新 Rust 数据结构与 TypeScript 类型。

## 5. macOS / Windows 平台抽象设计

### 5.1 抽象边界

平台差异主要集中在以下领域：

- 窗口行为：透明、阴影、置顶、桌面层级、点击穿透和多显示器坐标。
- 系统监控：CPU、内存、电池信息来源与字段可用性。
- 输入监听：全局键盘和鼠标钩子、权限模型和事件格式。
- 通知与自启动：系统通知、登录启动和后台运行策略。
- 安全存储：凭据存储机制和权限提示。

上层模块只依赖平台无关的 trait 或服务接口。平台实现通过条件编译选择：

```rust
#[cfg(target_os = "macos")]
mod macos;

#[cfg(target_os = "windows")]
mod windows;
```

推荐的调用方向：

```text
commands / application service
              ↓
       platform-neutral trait
              ↓
      macOS or Windows adapter
              ↓
        native operating system
```

### 5.2 macOS 优先策略

第一阶段优先完善 macOS：

- 透明无边框窗口及正确的窗口层级。
- 多显示器与 Retina 缩放适配。
- 辅助功能、输入监听和通知权限的清晰引导。
- Apple Silicon 与 Intel 构建兼容性。
- 睡眠、唤醒和电池状态变化后的任务恢复。

平台无关接口需同步保留，但不要求在早期提供空洞的 Windows 假实现。

### 5.3 Windows 扩展策略

Windows 支持阶段为相同接口增加实现：

- 使用 Windows 对应 API 实现窗口样式、全局输入和系统指标。
- 正确处理 DPI、任务栏、多显示器和不同缩放比例。
- 将权限或能力缺失表达为统一的 capability 状态，而不是让前端依赖平台错误文本。
- 通过平台专项测试验证行为，不改变上层领域接口。

### 5.4 能力模型

不同平台不一定提供完全相同的数据。建议 Rust 层向前端返回能力描述，例如是否支持电池信息、全局输入或点击穿透。前端根据能力启用或隐藏功能，而不是通过 `navigator.platform` 判断系统。

## 6. 模块划分

### 6.1 前端目录 `src/`

```text
src/
├── components/   通用、无领域归属的 Vue 组件
├── pet/          桌宠渲染、动画状态、动作与交互表现
├── system/       系统指标的前端模型、订阅与展示
├── reminder/     提醒/闹钟的表单、列表和前端状态
├── input/        输入事件的前端适配与可视化反馈
├── settings/     用户偏好、权限状态、皮肤与配置界面
├── App.vue       当前根组件；后续负责应用级组合
└── main.ts       Vue 应用入口
```

各领域目录内部后续可按需要再划分 `components`、`composables`、`types`、`services`，但在出现实际代码前不提前制造层级。

### 6.2 Rust 目录 `src-tauri/src/`

```text
src-tauri/src/
├── commands/     Tauri command 边界、参数校验与结果转换
├── system/       系统指标采集、能力检测与平台适配
├── input/        全局键鼠监听、权限与事件归一化
├── pet/          桌宠原生窗口、位置和平台窗口行为
├── lib.rs        Tauri 应用构建与模块装配
└── main.rs       桌面程序入口
```

提醒调度功能加入时，Rust 侧建议新增独立的 `reminder/` 领域目录，不应塞入 `system/`；设置持久化和 AI 集成也应在职责明确后建立各自模块。

### 6.3 模块依赖规则

- `components/` 可以被各前端领域复用，但不依赖具体领域。
- 前端领域之间优先通过共享状态或明确服务交互，避免循环导入。
- Rust `commands/` 可以调用领域服务；领域服务不依赖 `commands/`。
- 平台实现只出现在 Rust 原生层，Vue 侧只消费统一数据模型。
- AI 功能作为可选领域接入，不侵入桌宠动画、系统监控等核心模块。

## 7. 跨领域数据流示例

以系统状态驱动桌宠表现为例：

```text
操作系统指标
    ↓
Rust system 采集与归一化
    ↓ event
前端 system 更新状态
    ↓
pet 根据规则选择动画状态
    ↓
Vue 渲染像素帧
```

其中 `system` 只提供事实数据，`pet` 决定视觉表现，避免系统采集模块直接控制动画。

## 8. 长期开发约束

- 新功能先确定领域归属和前后端边界，再添加依赖。
- 系统权限必须按需申请，并向用户解释用途。
- 像素资源、皮肤清单与用户数据应有明确的格式版本。
- 后台任务必须支持取消，并在窗口关闭、应用退出、睡眠/唤醒时正确处理生命周期。
- 优先保持核心功能离线可用；AI 功能应是可选增强项。
- 每个平台分别测试窗口、权限、DPI/缩放、睡眠恢复和打包结果。

## 9. Phase 2-C6：State & Animation Editor

Phase 2-C6 已建立状态与动画资源编辑链路。实现遵循“内置资源只读、用户资源可写”的边界：

```text
src/assets/pets/<petId>/
  pet.json + PNG                 built-in，随应用打包，只读

Tauri app_data_dir()/pets/<petId>/
  pet.json                       用户状态覆盖清单
  <state>/*.png                  用户上传的 PNG
```

### 9.1 State Registry

`src/pet/stateRegistry.ts` 以现有 `PET_STATES` 为唯一状态集合，为控制中心提供名称、生命周期和 fallback 元数据。当前状态均标记为 `active`；类型已允许未来把已定义但尚未开放的状态标记为 `planned`，不需要为此增加新的 `PetState`。

控制中心始终遍历 State Registry，因此即使某个状态尚无专属 PNG，也会显示帧数为 0，并明确显示 `fallback → idle`。

### 9.2 Manifest 与动画模型

Built-in `pet.json` 支持 schema v1 和 v2：

- v1：字符串帧数组、统一 `frameDurationMs`、旧版 `loopDelayOptionsMs`。
- v2：每帧 `{ path, durationMs }`，并通过单一 `replay` 配置表达 `continuous`、`fixed` 或 `random` 延迟。
- `loop` 与 replay 相互独立；`loop: false` 时播放到最后一帧停止。
- Animation Duration 只由各帧 `durationMs` 求和，不另存第二份总时长。

AssetLoader 在解析时统一生成 `ResolvedPetFrame`，其中包含来源、路径、文件名、时长和可选尺寸。AnimationEngine 消费解析后的逐帧时长，因此桌宠 Runtime 与控制中心预览使用同一播放规则。

### 9.3 Built-in / User 优先级

资源解析顺序为：

```text
有效 User State Override
  ↓ 不存在或无有效帧
对应 Built-in State
  ↓ 不存在
Pet Manifest fallbackState（当前为 idle）
  ↓ 用户 idle 损坏或缺失
Built-in idle 安全兜底
```

Built-in PNG 永不在运行时删除。将 built-in 帧从动画中移除时，只保存一个不包含该帧的用户覆盖清单。User PNG 的删除命令只允许操作经过校验的 `petId`、`PetState` 和单层文件名。

### 9.4 上传、安全与热重载

PNG 由 Control Center 读取后交给 Rust 写入 `app_data_dir()`。Rust 验证 PNG 扩展名、签名、IHDR、IEND、尺寸、文件上限，并拒绝 APNG；存储文件名由后端清洗并加入时间戳解决冲突。所有目录都从 Tauri 的跨平台路径 API 派生，不接受绝对路径或 `..`。

保存用户清单后，资源管理器广播 `desktop-pet://user-assets-updated`。主桌宠窗口重新读取清单与用户 PNG，递增资源 revision；AssetLoader 重新解析当前状态，AnimationEngine 因资源对象变化重置到第一帧。该过程不修改真实 `PetState`，也不要求重启应用。

控制中心预览创建独立 AnimationEngine 实例，只消费编辑草稿，不向主窗口发送状态切换或动画控制命令。

## 10. Phase 2-D：Application Settings System

Phase 2-D 将应用行为偏好集中到 `src/settings/`，不把动画资源参数混入全局配置：

```text
Control Center SettingsPage
            ↓
      Settings Manager
      响应式状态 / 校验 / 合并默认值 / 自动保存
            ↓
      Settings Storage
            ↓ Tauri command
app_data_dir()/settings.json
```

### 10.1 Schema 与默认值

`DesktopPetSettings` 使用 `schemaVersion: 1`，包含：

- `appearance`：桌宠缩放与 Always On Top。
- `dialogue`：气泡时长、启动提示和 Click/Drag 文本开关；旧 `enableHoverDialogue` 字段仅为 settings.json 兼容保留。
- `animation`：全局动画启停。
- Phase 2-D 完成时，`systemMonitor`、`input`、`reminder` 仅作为后续阶段的数据占位；其中 CPU 与 Memory 配置已在 Phase 3-A / 3-B 正式接入，Input 与 Reminder 仍未驱动功能。

所有默认值集中在 `defaultSettings.ts`。读取时按字段校验并与默认配置合并，缺失字段自动补齐，未知字段忽略；损坏 JSON 或不支持的 schemaVersion 会安全回退默认配置。

### 10.2 持久化与跨窗口同步

Rust 将配置写入 `app_data_dir()/settings.json`。保存先写入并同步临时文件，再使用原子替换；在不允许覆盖式 rename 的平台上使用备份文件完成替换与失败恢复。

Settings Manager 更新本窗口的响应式配置后进行短延迟自动保存，并广播 `desktop-pet://settings-updated`。主桌宠窗口和控制中心都复用该 Manager，因此不需要重启应用。

### 10.3 现有模块接入

- Dialogue Controller 在每次显示文本时读取当前 `bubbleDurationMs`。
- Interaction 只保留 Click 与 Drag 业务交互，并根据设置决定是否触发对应 Dialogue；Hover 不再改变状态或触发文本。
- Pet 启动完成后根据 `showDevelopmentMessageOnStartup` 决定是否触发 development 事件。
- `animation.enabled` 调用现有 AnimationEngine 的 pause/resume，不改写 State Manifest。
- Window Settings Adapter 将 `petScale` 和 `alwaysOnTop` 交给 Rust 主窗口命令处理，Settings Vue 组件不直接操作 Tauri Window。

桌宠图片以 160px 为 100% 基准缩放。主窗口在缩放超过 100% 时同步从 200px 放大到 `200 × petScale`；缩放低于 100% 时保留 200px 透明窗口，因此 50%～200% 均不会裁切角色。

## 11. Interaction Cleanup：Click + Drag

Phase 2-E 之前的 Interaction Cleanup 将桌宠主动鼠标交互收敛为 Click 与 Drag：

- `Pet.vue` 不再绑定 mouseenter / mouseleave，Interaction System 也不再定义 Hover 状态映射。
- `alert` 继续是完整 `PetState`，保留给提醒、系统警告和电池等未来事件，State & Animation Editor 不受影响。
- `hoverEnter` / `hoverLeave` 与 `enableHoverDialogue` 继续被 JSON schema 读取，避免破坏旧用户文件，但不再进入 Runtime 或主要编辑 UI。
- Drag 在 4px 阈值后只触发一次 `drag.start`。Tauri `startDragging()` Promise 仅代表原生拖动请求已提交，不代表用户已经松开，因此不用于结束 Session。
- Active Drag 只由真实 pointerup / mouseup 结束；原生接管产生的 pointercancel 不解释为 drag.end。Session 在结束处理前先清空，保证 `drag.end` 至多一次。
- `drag.end` 状态恢复在松开时立即发生，结束 Dialogue 延迟 500ms；新 Click 或 Drag 会取消尚未显示的旧结束文本。

## 12. Phase 2-E：Behavior Manager / State Arbitration

Behavior Manager 是业务事件与最终 `PetState` 之间的轻量仲裁层，不是通用状态机：

```text
Interaction / future System / Reminder / Input
                    ↓ requestState / releaseState
             Behavior Manager
        priority → sequence 决定 winner
                    ↓
              Effective State
                    ↓
                 petStore
                    ↓
        AssetLoader → AnimationEngine → Pet.vue
```

### 12.1 Request 与 winner

每个 Request 包含 `source`、`state`、`priority`、可选 `durationMs`、`createdAt` 和单调递增 `sequence`。同一 source 只保留一条请求，再次 request 会更新该请求，不形成队列。

默认优先级集中在 `behavior.ts`：`dragging 100`、`alert 80`、`sleep 70`、`happy 60`、`working 50`、`tired 30`、`idle 0`。仲裁先比较 priority；相同 priority 时 sequence 较新的请求获胜；最终以 source 字符序作为完全确定性的兜底。没有请求时 Effective State 为 `idle`。

Held Request 一直保留到对应 source 调用 `releaseState()`。Transient Request 使用 `durationMs` 自动释放；同一 source 更新时先清除旧 timer，timer 回调还会校验 request sequence，因此旧 timer 无法删除更新后的请求。

### 12.2 petStore 与现有交互

`petStore` 继续是最终有效 PetState 的响应式 Store；Behavior Manager 是正常业务路径中唯一调用 `setState()` 的模块。`setState()` 暂时保留为内部兼容 API，新的 Interaction、System、Reminder 和 Input 模块不应直接写最终状态。

- Click 请求 `interaction.click / happy / 1200ms`，Dialogue 仍由 Interaction 独立触发；关闭 Click Dialogue 不影响 Behavior。
- Drag Start 请求 held 的 `interaction.drag / dragging`；真实 pointerup 立即 release。释放后重新仲裁剩余 Request，而不是写死 `idle`。
- Drag End Dialogue 仍独立延迟 500ms，这个 timer 不参与 Behavior 生命周期。
- Hover 没有 Behavior source，也不会重新成为 Runtime Interaction。

### 12.3 Runtime Inspector 与未来接入

Runtime Status 在原有动画、帧和 Dialogue 信息之外，增加 `effectiveState`、`winningSource` 和序列化的 `activeBehaviorRequests`。控制中心“当前状态”页提供明确标记为 Development / Debug 的小型 Request/Release 区域，仅用于验收 tired、working 和 transient alert，不模拟真实系统数据。

Phase 3 CPU High 可请求 `system.cpu / tired`，CPU Normal release 同一 source；Reminder 可请求 `reminder.active / alert / durationMs`；Keyboard 可请求或释放 `input.keyboardActivity / working`。这些模块无需修改 Interaction、AssetLoader 或 AnimationEngine。

## 13. Phase 3-A：CPU Monitor

CPU Monitor 使用 Rust `sysinfo` 的 `system` feature 读取整个系统的总体 CPU 使用率。监控 owner 是主桌宠窗口；Control Center 不创建采样器，只通过现有 Runtime Bridge 接收同一份状态：

```text
Pet Window CPU Monitor（唯一调度者）
        ↓ Tauri command / configured interval
Rust CpuSampler（sysinfo global CPU usage）
        ↓
CPU hysteresis
   ├── Runtime Status → Runtime Bridge → Control Center
   ├── Behavior request/release system.cpu
   └── Dialogue system.cpu.high / system.cpu.normal
```

### 13.1 采样与生命周期

Rust `CpuSampler` 只保存 CPU delta 所需的 `sysinfo::System` 和 baseline 状态，不读取内存、电池或进程指标。Monitor 启动时第一次调用重建 baseline 并返回空值；前端等待 500ms 后取得首个有效 delta，之后使用 `cpuPollIntervalMs` 串行调度下一次采样。

调度使用单个 `setTimeout`，每次 invoke 完成后才安排下一次，因此不会重叠。enable、disable 或 Poll Interval 改变时会清理 timer 并递增 generation；旧异步结果因 generation 不匹配而丢弃。关闭任一总开关会停止采样、清空 CPU Runtime 数值、把状态设为 disabled，并 release `system.cpu`。

### 13.2 Threshold、Behavior 与 Dialogue

进入 High 的条件为 `usage >= cpuHighThreshold`；High 状态下只有 `usage <= cpuHighThreshold - 10` 才恢复 Normal，中间区间保持原状态。Threshold 变化会立即用最后一个有效样本重新判断，不要求重启或等待下一次 Poll。

Normal → High 只在边沿请求 held 的 `system.cpu / tired / priority 30` 并触发一次 `system.cpu.high`。High → Normal 只在边沿 release 同一 source 并触发一次 `system.cpu.normal`。持续 High 不重复 request 或显示文本。Drag 的 priority 100 会临时覆盖 tired；真实 pointerup release Drag 后，如果 CPU 仍 High，Behavior Manager 自动恢复 tired。

### 13.3 Settings 与跨窗口状态

Phase 2-D 已有的 `systemMonitor.enabled`、`cpuEnabled`、`cpuHighThreshold`、`cpuPollIntervalMs` 现在正式生效。阈值限制为 10%～100%，Poll Interval 限制为 500～10000ms。Runtime Snapshot 增加 CPU Usage、disabled/normal/high 状态、Monitoring 标记与当前 Threshold，Control Center 只展示该快照，不进行第二次采样。

## 14. Phase 3-B：Memory Monitor

Memory Monitor 与 CPU Monitor 保持为两个独立的小模块，避免重构已经稳定的 CPU 采样生命周期；两者只共享原有 `cpuPollIntervalMs` 配置字段作为系统采样间隔。唯一 owner 仍是主桌宠窗口：

```text
Pet Window Memory Monitor（唯一调度者）
        ↓ Tauri command / shared poll interval
Rust MemorySampler（sysinfo RAM-only refresh）
        ↓ used / total × 100
Memory hysteresis
   ├── Runtime Status → Runtime Bridge → Control Center
   ├── Behavior request/release system.memory
   └── Dialogue system.memory.high / system.memory.normal
```

### 14.1 数据、采样与生命周期

Rust 复用 `sysinfo 0.39.6`，每次只通过 `MemoryRefreshKind::with_ram()` 刷新 RAM，不读取 swap、进程或平台专属 Memory Pressure。返回 `totalMemory`、`usedMemory`、`availableMemory` 原始字节数，以及 `usedMemory / totalMemory × 100` 得到的百分比。Memory 不依赖两次采样之间的 delta，因此启用后可以立即取得有效值，无需 CPU warm-up。

前端使用单个 `setTimeout`，只在一次 invoke 完成后调度下一次。enable、disable 或共享 Poll Interval 改变时清理 timer 并递增 generation，陈旧的异步结果不会写回 Runtime。关闭 Master 或 Memory 开关时清空数值、设置 disabled，并 release `system.memory`。

### 14.2 独立 Behavior source 与边沿 Dialogue

Memory 达到 `memoryHighThreshold` 时进入 High；High 状态只有降至 `threshold - 5` 或更低才恢复 Normal。Threshold 变化会用最近样本立即重算。Normal → High 请求 held 的 `system.memory / tired / priority 30` 并触发一次 `system.memory.high`；High → Normal release 并触发一次 `system.memory.normal`。

CPU 和 Memory 使用不同 source。两者同时 High 时，Behavior Manager 同时保留 `system.cpu` 与 `system.memory`；任何一方恢复只释放自己的请求，另一方仍能维持 tired。Click 与 Drag 继续按既有更高优先级暂时覆盖，结束后自动恢复到仍有效的系统请求。

### 14.3 Settings 与跨窗口显示

Settings schemaVersion 保持为 1，并向 `systemMonitor` 增加带默认值的 `memoryEnabled` 与 `memoryHighThreshold`，所以旧 `settings.json` 缺少字段时会自动补齐而不需要迁移。阈值限制为 50%～100%；采样间隔继续复用 `cpuPollIntervalMs`，避免字段重命名破坏旧配置。

Runtime Snapshot 增加 Memory Usage、Used / Available / Total bytes、disabled/normal/high、Monitoring 与 Threshold。Control Center 只将字节格式化为人类可读单位，仍不创建第二个采样源。内置 Dialogue Catalog 包含 Memory High / Normal 事件，用户可在现有 Dialogue Editor 修改候选文本。

## 15. Phase 3-C：System Status Bubble

System Status Bubble 是与临时 `SpeechBubble` 完全分离的长期桌面面板。它和 Pet 仍渲染在 label 为 `main` 的同一个透明 Tauri Window 中，不创建第二个窗口，也不启动新的 CPU / Memory 采样器：

```text
CPU Monitor / Memory Monitor（现有唯一 owner）
                 ↓
          Runtime Status
                 ↓
      SystemStatusBubble.vue

SpeechBubble.vue                 临时 Dialogue
SystemStatusBubble.vue           长期系统状态
```

面板第一版显示 CPU、Memory、Network、Storage。CPU 与 Memory 直接读取 Runtime Snapshot；Monitor 关闭时显示“未启用”，不产生替代数据。Network 与 Storage 当前只显示 `--`，以后可在 Runtime Snapshot 增加速率与容量字段后接入，不需要改变窗口布局或建立第二个面板。

### 15.1 Display Mode 与 Settings

`DesktopPetSettings.systemStatusBubble` 保存 `pet-only`、`status-only`、`both` 三种 `displayMode`，以及 `offsetX / offsetY`、背景色与透明度、文字色、边框色和边框宽度。旧 settings.json 缺少整段配置时自动补默认值，schemaVersion 仍为 1。

颜色只接受六位 HEX；透明度限制为 0～1；边框宽度限制为 0～6；offset 限制为相对 Pet 的 -500～500 logical pixels，防止单窗口透明区域无限扩大。Control Center 仍通过现有 Settings Manager 自动保存与跨窗口广播，样式和模式不要求重启。

### 15.2 动态 Window Layout

`windowLayout.ts` 只负责一个纯 Bounding Box 计算：Pet 的场景矩形从 `(0, 0)` 开始，Bubble 矩形从持久化 offset 开始；根据 displayMode 选择可见矩形，再计算 `minX / minY / maxX / maxY`。内部位置使用 `-minX / -minY` 作为 content origin，因此负 offset 也不会被窗口裁切。

```text
visible Pet Rectangle + visible Bubble Rectangle
                      ↓
             min / max Bounding Box
                      ↓
logical Window Size + internal content origin
```

当 Bounding Box 的 `minX / minY` 改变时，Window Settings Adapter 把新旧 min 的差值交给 Rust。Rust 读取主窗口当前 outer position 和 scale factor，将 logical delta 转换为 physical pixels 后同步调用 `set_position`，并用 logical size 调整窗口边界。这样把 Bubble 拖到 Pet 左侧或上方时，窗口左上角可以变化，但场景内容的屏幕绝对位置不会因扩窗而跳动。petScale 继续决定 Pet Rectangle：不超过 100% 时为 200×200，超过 100% 时为 `200 × petScale`。

### 15.3 Drag 边界

- `both`：Pet 继续走现有 4px threshold 与原生 Window Drag；Bubble 的 pointer event 在独立组件边界内 stop propagation，只更新本地 offset，pointerup 才提交一次 Settings。
- `status-only`：Pet 不渲染，Bubble pointerdown 直接调用现有 Window Drag Adapter，作为整个主窗口的拖动手柄，不改变持久化 offset。
- `pet-only`：只计算 Pet Rectangle，窗口不会为隐藏面板保留空间。

Bubble 局部拖动使用屏幕坐标计算 delta，避免窗口左上角因负 offset 补偿移动时反过来干扰 pointer delta。布局更新会调整 Window size / position，但不会写监控数据或在 pointermove 中写 settings.json。

### 15.4 Phase 3-C 收尾：面板尺寸、内容与窗口阴影

主窗口配置显式关闭 native window shadow，只作用于静态创建且 label 为 `main` 的透明桌宠窗口；动态创建的 Control Center 不受影响。`SystemStatusBubble` 自己的用户边框和局部 CSS 阴影仍属于面板视觉样式，不与主窗口外框混用。

`systemStatusBubble` 增加 `panelWidth`、`panelScale` 与 `visibleItems`。宽度限制为 180～420 logical px，整体缩放限制为 0.7～1.6；默认分别为原视觉宽度 184px 与 1.0。缩放通过实际 CSS 长度同时作用于宽度、字体、padding、section 间距、进度条与圆角，不使用 `transform`，因此 ResizeObserver 得到的就是实际布局尺寸。

可见项目由轻量 `SYSTEM_STATUS_ITEMS` 定义集中维护，当前包括 CPU、Memory、Network、Storage。组件只渲染 `visibleItems` 中的 section；列表为空时仍保留 System Status header，不保存固定高度。项目增删、宽度或缩放变化都会自然改变面板尺寸，既有 ResizeObserver 再把实测宽高送入 Window Bounding Box 计算，offset 不会被重置，Pet 的屏幕绝对位置也继续由原有 position delta 补偿保持稳定。旧 settings.json 缺少新增字段时由 normalizeSettings 补默认值，schemaVersion 保持为 1。

## 16. Phase 3-D：Network Monitor

Network Monitor 延续 CPU / Memory 的单 owner 模式：只有 main Pet Window 创建前端调度器，Control Center 与 SystemStatusBubble 仅通过 Runtime Status / Runtime Bridge 消费结果。

```text
Rust NetworkSampler（sysinfo Networks）
        ↓ total counters + Instant elapsed
main Pet Window networkMonitor.ts
        ↓
Runtime Status → Runtime Bridge → Control Center
        └────────────────────────→ SystemStatusBubble
```

Rust 在启用 `sysinfo` 的 `network` feature 后枚举所有网络接口，排除接口名或全部 IP 地址明确为 loopback 的接口，并合计其余接口的 `total_received / total_transmitted`。第一次采样只建立累计 counter 与 `Instant` baseline；后续速率按 `delta bytes / elapsed seconds` 计算，不假设 timer 精确命中设置间隔。

如果 elapsed 超过 `max(pollInterval × 3, 30 秒)`、时间无法单调推进，或任一合计 counter 小于上次值，本次不发布速率，只以当前 counter 和时间重新建立 baseline。这样睡眠/唤醒、接口重置或网络切换不会产生负值或异常速率。

Settings schemaVersion 仍为 1，在 `systemMonitor` 中增加默认关闭的 `networkEnabled`，继续复用兼容字段 `cpuPollIntervalMs` 作为共同 System Poll Interval。Monitor 使用单个串行 `setTimeout` 和 generation：Enable、Disable、Master 开关或间隔变化都会使旧 loop 失效；Disable 清空速率并发布 `disabled`，Enable 从 `warming` 开始，第二个有效样本进入 `active`，采样错误进入 `error`。

Runtime Snapshot 增加下载/上传 bytes per second、`disabled / warming / active / error` 和 monitoring 标记。统一前端 formatter 将数值显示为 B/s、KB/s、MB/s 或 GB/s；Rust 与 Runtime 始终保存数值。Network 当前只展示状态，不请求 Behavior，也不触发 Dialogue。

## 17. Phase 3-E：Storage Monitor

Storage Monitor 保持与 CPU、Memory、Network 相同的单 owner 边界，但拥有独立的 30 秒低频周期。只有 main Pet Window 调度 Rust command，Control Center 与 SystemStatusBubble 只消费 Runtime Status：

```text
Rust StorageSampler（sysinfo Disks）
        ↓ root/system volume bytes
main Pet Window storageMonitor.ts（30s）
        ↓
Runtime Status → Runtime Bridge → Control Center
        └────────────────────────→ SystemStatusBubble
```

Rust 启用 `sysinfo 0.39.6` 的 `disk` feature，通过 `Disks::refresh(true)` 更新磁盘列表，并只选择与系统根目录 mount point 完全相等的条目。macOS 对应 `/`，不依赖卷名称，因此不会把外接盘、DMG、Time Machine、网络挂载或临时文件系统求和。多个条目意外拥有同一根挂载点时，选择 total / available 最大的有效条目；total 为 0 或找不到根卷会返回可恢复错误。

容量在 Rust 中始终保存为 bytes：`used = total - available`，`usage = used / total × 100`，同时使用饱和减法和 total 非零校验。macOS 的 `available_space` 来自 sysinfo/OS filesystem 容量语义，APFS 共享容器、purgeable、snapshot 与系统“储存空间”分类不在本阶段计算范围内。

Settings schemaVersion 继续为 1，仅在 `systemMonitor` 增加默认关闭的 `storageEnabled`。Monitor Enable 后立即采样，之后使用单个串行 `setTimeout` 每 30 秒刷新；Disable、Master OFF 或组件销毁会清理 timer、递增 generation、清空有效值并发布 disabled，错误发布 error 且不影响桌宠运行。Storage 只展示信息，不请求 Behavior，也不触发 Dialogue。

Runtime Snapshot 增加 Total / Used / Available bytes、Usage Percent、`disabled / active / error` 与 monitoring 标记。统一前端 byte formatter 同时服务 Memory 和 Storage；SystemStatusBubble 的既有 Storage item 直接显示百分比、Used / Total 与进度条，`visibleItems` 仍只控制渲染，不改变 Monitor 生命周期。

## 18. Phase 3-F：Battery Monitor

`sysinfo 0.39.6` 不提供电池容量 API，因此 Battery Monitor 使用单一跨平台依赖 `starship-battery`。Rust 只读取第一块能够成功解析的电池，百分比直接采用库的 `state_of_charge`，不重新用能量字段计算：

```text
starship-battery Manager（first valid battery）
        ↓ percentage + normalized state
main Pet Window batteryMonitor.ts（30s）
        ↓
Runtime Status → Runtime Bridge → Control Center
        └────────────────────────→ SystemStatusBubble
```

Rust 将 Charging、Discharging、Full、Unknown 映射到统一 Runtime state；底层 Empty 归为 discharging。枚举为空是正常的无电池设备，返回 `batteryPresent = false / unavailable`，不会作为读取错误。Manager 初始化、枚举或设备读取失败才返回 error。多电池设备第一版不聚合容量或健康度，只采用枚举中第一块读取成功的电池。

Settings schemaVersion 保持为 1，在 `systemMonitor` 增加默认关闭的 `batteryEnabled`。启用后立即采样，之后使用单个串行 `setTimeout` 每 30 秒刷新；Disable、Master OFF 与组件销毁会清理 timer、递增 generation、清空有效电量并发布 disabled。Battery 是当前状态快照，不需要 Network 式 delta baseline 或睡眠事件监听。

Runtime Snapshot 增加 Battery Percent、`disabled / charging / discharging / full / unknown / unavailable / error`、monitoring 与 present。Battery 注册为新的轻量 Status Item，但默认 `visibleItems` 仍只有原有 CPU、Memory、Network、Storage；旧配置不会自动显示 Battery。当前阶段 Battery 只展示数据，不请求 Behavior，也不触发 Dialogue。

## 19. Phase 3-G：System Monitor Integration & UX Cleanup

Phase 3-G 不新增采样源，只统一 CPU、Memory、Network、Storage、Battery 的设置、Runtime 状态表达和导航体验。主桌宠窗口继续是五项 Monitor 的唯一 owner；Control Center 与 SystemStatusBubble 仍只消费 Runtime Snapshot。

`systemMonitor.enabled` 是暂停所有 Monitor 的 Master Switch，但不会修改 `cpuEnabled / memoryEnabled / networkEnabled / storageEnabled / batteryEnabled`。重新启用 Master 后，各模块按保留的子开关恢复。兼容字段 `cpuPollIntervalMs` 在 UI 中显示为 System Poll Interval，继续只驱动 CPU、Memory、Network；Storage 与 Battery 保持各自固定 30 秒周期。

五个 Monitor 继续独立维护单个串行 `setTimeout` 与 generation。Enable、Disable、Master 切换和共享间隔热更新都会使旧 generation 失效，因此每项最多只有一个有效 polling loop；单项读取错误由本模块捕获并发布 Error，不影响其他 Monitor。

Control Center 的 Current Status 固定按 CPU、Memory、Network、Storage、Battery 排列，并统一展示 Active、Disabled、Warming、Error、Unavailable 等生命周期状态。Disabled 项目的“前往设置”直接切换到 Settings 的 System Monitor 区域。SystemStatusBubble 提供相同行为：主窗口先打开或聚焦 Control Center，再通过现有跨窗口 Runtime Bridge 的 navigation ready / acknowledgement 事件可靠导航，不会自动修改 Monitor 开关。

SystemStatusBubble 的 ResizeObserver 只在实测宽高变化时上报，Pet 端再次去重相同尺寸；动态百分比和速率文本使用固定单行布局，常规 Runtime 数值更新不会持续触发 Window Bounding Box resize。`visibleItems` 正式支持 Battery，但默认值和旧用户数组都不会自动加入 Battery，只有用户主动勾选后才显示。
