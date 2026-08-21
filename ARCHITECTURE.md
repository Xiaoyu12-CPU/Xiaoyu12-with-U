# DesktopPet 架构说明

## 1. 项目定位与当前状态

DesktopPet 是一个以 macOS 为首要平台、后续支持 Windows 的像素桌宠应用。项目采用 Tauri 2 作为桌面运行时，Vue 3 + TypeScript 构建界面与交互，Rust 负责桌面窗口、系统能力和平台相关逻辑。

当前仓库已完成透明桌宠窗口、PetState、资源加载、逐帧动画、交互、Dialogue、拖动、控制中心，以及 Phase 2-C6 State & Animation Editor。系统监控、提醒、全局输入、自定义皮肤和 AI 仍按路线图留待后续阶段。

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
