# withXiaoyu12

一只住在 macOS 桌面上的像素小桌宠。她会陪你打字、感知你的鼠标、关心你的电脑负载，还能到点提醒你别忘了事情。

基于 Tauri 2 + Vue 3 + TypeScript 构建，macOS 优先（Apple Silicon / Intel），Windows 支持在路线图上。

> 当前版本：v0.4.0-preview。软件尚在开发期，功能与外观都可能变化，欢迎试用反馈。

## 功能特性

### 🐾 桌宠本体

- **透明置顶窗口**：200×200 起步的透明无边框窗口，始终浮在桌面上，可随意拖动
- **逐帧像素动画**：idle / happy / tired / sleep / working / alert / dragging 等状态各有独立动画，支持随机回放间隔
- **行为状态机**：多个状态请求按优先级仲裁（拖拽 > 警觉 > 睡眠 > 开心 > 工作 > 疲惫 > 待机），瞬时状态自动超时回落
- **点击与对话**：点她会有反应，配合气泡对话系统

### ⌨️ 输入感知（需要 Input Monitoring 权限）

- **实时按键显示**：全屏打字时，桌宠头顶会冒出你敲的键
- **方向性按键历史栈**：最近的按键像瀑布一样流过
- **打字反馈**：持续打字或手速起飞时触发专属台词
- **鼠标可视化**：点击、滚轮动作可视化展示
- **陪你工作**：检测到你持续输入时进入 working 状态——她在陪你加班

隐私说明：按键监听通过 macOS `CGEventTap` 以 **ListenOnly** 模式在本地实现，数据只用于驱动桌宠动画和显示，**不上传任何数据，不联网**。

### 🔔 提醒与闹钟

- 自定义提醒事项与触发时间，调度器精确唤醒
- 触发时桌宠切换 alert 状态并弹出提醒台词
- 内置三种提示音（默认 / 数字 / 轻柔），支持贪睡（5/10/30 分钟）与忽略
- 提醒按钮保持可见直到你做出回应，不会悄悄消失

### 📊 系统监控

- CPU、内存、网络吞吐、磁盘、电池五类指标采样
- 可自定义的系统状态气泡（跟随宠物 / 仅宠物 / 仅状态）
- 阈值联动：CPU 过载时桌宠会变疲惫，内存紧张会有专属对话

### 🎛️ 控制中心

独立设置窗口，集中管理：

- 外观：缩放（0.5×–2.0×）、置顶开关、各悬浮组件位置（可直接拖拽摆放）
- 动画：状态动画编辑器，支持上传自定义 PNG 序列帧
- 对话：内置台词编辑器 + 触发事件配置
- 提醒：提醒事项管理
- 监控：采样间隔、阈值、气泡显示项
- 背景：控制中心自定义背景图

所有设置实时跨窗口同步，自动持久化。

## 快速开始

### 环境要求

- Node.js ≥ 20 与 pnpm
- Rust 工具链（`rustup` 安装）
- Tauri 的系统依赖见 [Tauri prerequisites](https://tauri.app/start/prerequisites/)

### 本地开发

```bash
pnpm install
pnpm tauri dev    # 启动开发模式
```

### 构建打包

```bash
pnpm tauri build  # 产物在 src-tauri/target/release/bundle/
```

### 运行测试

```bash
pnpm test:reminders        # 提醒系统测试
pnpm test:input            # 输入感知测试
pnpm test:control-center   # 控制中心设置测试
```

### 授予输入监听权限（可选，为了输入感知功能）

首次启用键盘/鼠标监听时，macOS 会弹出权限请求；允许后键位历史和鼠标可视化立即生效。
如果错过了弹窗或曾经点过"拒绝"，监听会保持静默（开关开着但无可视化），此时：

1. 打开 **系统设置 → 隐私与安全性 → 输入监听**（Input Monitoring）
2. 在列表中找到并勾选 **withXiaoyu12**
3. 回到应用，在 控制中心 → 设置 → 输入监控 对应页签点击 **重新检测**
4. 若列表里没有 withXiaoyu12，先把监听开关关掉再打开，触发一次新的权限请求

> 授权后如果仍无反应，退出应用重新打开一次（macOS 偶发需要重启才对新授权生效）。

### 安装 Release 包（macOS）

当前 Release 的 DMG **未经 Apple 公证**。首次打开如提示"已损坏，无法打开"或无法验证开发者，
在终端执行（二选一）：

```bash
xattr -dr com.apple.quarantine /Applications/withXiaoyu12.app
# 或解除 DMG 自身的隔离标记后再安装：
xattr -dr com.apple.quarantine ~/Downloads/withXiaoyu12-macOS-*.dmg
```

- 提示"无法验证开发者"：右键 App → 打开 → 再点"打开"，只需一次
- Apple Silicon（M 系列）建议下载 `macOS-arm64` 包；`macOS-x64` 包在 M 系列上经 Rosetta 也能运行，
  但性能与权限体验以原生 arm64 包为准

## 项目结构

```
├── src/                    # Vue 3 前端
│   ├── pet/                # 桌宠核心：动画引擎、行为状态机、资源加载、交互
│   ├── input/              # 全局键鼠监听的前端侧：运行时、可视化、打字反馈
│   ├── reminder/           # 提醒调度、贪睡、铃声播放
│   ├── system/             # 五类系统指标的采集与格式化
│   ├── settings/           # 设置管理器、控制中心页面
│   └── components/         # 气泡、右键菜单等通用组件
├── src-tauri/              # Tauri 2 / Rust 后端
│   └── src/
│       ├── commands/       # 各领域 Tauri command（监控、存储、资产上传…）
│       └── input/          # 平台抽象的全局输入监听（macOS CGEventTap 实现）
└── tests/                  # 纯逻辑单元测试（Node 原生 test runner）
```

更详细的分层设计、通信协议与模块依赖规则见 [ARCHITECTURE.md](./ARCHITECTURE.md)，版本规划见 [ROADMAP.md](./ROADMAP.md)。

## 版本

| 版本 | 内容 |
|---|---|
| v0.3.0-preview | 首个公开预览：桌宠 + 对话 + 系统监控 + 控制中心 |
| v0.4.0-preview | 新增输入感知（键鼠监听）、提醒闹钟、Intel Mac 支持、新图标 |

下载最新预览版请移步 [Releases](https://github.com/Xiaoyu12-CPU/Xiaoyu12-with-U/releases)。

> 预览版未经公证，首次打开如遇 macOS 安全拦截，请右键 → 打开，或在系统设置中放行。

## 许可证

暂未声明许可证。个人学习交流使用，转载请注明出处。
