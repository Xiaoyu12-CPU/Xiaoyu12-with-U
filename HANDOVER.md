# withXiaoyu12 开发交接

## 当前发布目标

- 当前版本目标：`v0.5.0`
- 历史完整发布基线：`v0.4.5.1`
- 历史 Windows x64 修复版：`v0.4.5.2`
- 正式代码分支：`main`
- 日常开发分支：`develop`
- 本次发布标签：`v0.5.0`（新建，不复用旧标签）
- 版本变化：[CHANGELOG.md](./CHANGELOG.md)
- 架构说明：[ARCHITECTURE.md](./ARCHITECTURE.md)

v0.5.0 整合 Windows 拖动恢复修复、v0.4.6 / v0.4.6.1 的控制中心外观主题与主题数据模型修正，以及当前 A01–A11 美术资源和动画编辑器尺寸修复。发布目标是让 `main` 与 `develop` 指向同一个经过验证的发布提交，再由该提交创建 `v0.5.0`；实际分支、构建和发布状态须读取 Git 与 Actions 确认。本文件不表示这些步骤已经完成。旧发布标签只作为历史快照保留，不应复用或移动。

## v0.5.0 资源与兼容规则

- A01–A11 均为 200×200 RGBA 透明 PNG；A01/A02/A03 已清理发丝白边。动画编辑器读取实际图片尺寸，不再信任旧尺寸缓存，也不因刷新尺寸产生未保存修改。
- idle：A01 → A02 → A03 → A01，200 / 100 / 200 / 0 ms，末帧保持，随机等待 10 / 3 / 30 / 22 秒后重播。
- happy：A08 → A09 → A08；tired / dragging：A04 → A05 → A04；alert：A06 → A07 → A06；working：A10 → A11 → A10。以上三帧序列均为 120 / 120 / 160 ms、400 ms 连续循环，sleep 占位不变。
- working 中笔记本与灰色小熊标志保持固定，人物和感叹号独立位移。资源映射和制作记录见 [ART_ASSETS.md](./ART_ASSETS.md)。
- 既有用户设置与资源覆盖继续优先；本次不新增迁移，不为强制展示新默认动画而覆盖用户自定义动画、主题或其他设置。旧占位图和 working attention 帧保留兼容。

## 项目结构

- `src/`：Vue 3 + TypeScript 前端、控制中心和桌宠运行时。
- `src-tauri/`：Tauri 2 + Rust 后端、窗口、持久化、系统采样和平台输入监听。
- `tests/`：提醒、输入、控制中心和桌面窗口的 Node 回归测试。
- `.github/workflows/`：Windows、macOS 和标签驱动的 Release 构建。

主桌宠窗口是系统采样、提醒调度和输入监听的唯一 Runtime owner。系统状态、键盘历史、鼠标可视化和控制中心只消费主窗口广播的数据，不能创建第二套监听器或采样循环。

## 发布前验证

```bash
pnpm build
pnpm test:reminders
pnpm test:input
pnpm test:control-center
pnpm test:windows
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo fmt --check --manifest-path src-tauri/Cargo.toml
```

## 发布流程

1. 在开发分支完成修改、文档和上述验证，核对 package、Tauri、Cargo 与界面版本为 `0.5.0`。
2. 将确认后的提交合并到 `develop` 和 `main`，核对本地及远端两分支指向同一发布提交；保留其他有效工作，不以强制覆盖替代合并。
3. 验收完成后在该发布提交创建新的不可移动标签 `v0.5.0`，不要复用或移动已经公开的旧标签。
4. 推送标签后，`Release Build` 自动生成 Windows x64、macOS ARM64 和 macOS x64 安装包。
5. 等待三个平台构建与 `publish-release` 全部成功，再检查 Release 页面附件和说明。

## 当前发布限制

- 仓库尚未配置 Apple Developer 签名与公证 Secrets。macOS 构建会使用仓库默认的 ad-hoc 签名，用户可能需要移除 quarantine 标记。
- 纯逻辑测试不能模拟真实 macOS 主线程、窗口拖动和 Gatekeeper；每个 Release 仍需进行 ARM Mac、Intel Mac 和 Windows 实机验收。
- PNG 与 GIF 的逐像素检查只覆盖美术资源；不能替代安装包中动画加载、状态触发、编辑器显示与旧自定义设置保留的实机检查。
- Actions 构建附件是临时测试产物；面向用户始终提供 Releases 页面链接。
