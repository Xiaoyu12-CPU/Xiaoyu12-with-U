# withXiaoyu12 开发交接

## 当前发布基线

- 当前开发版本：`v0.4.5`（尚未发布）
- 正式代码分支：`main`
- 日常开发分支：`develop`
- 本次开发分支：`codex/v0.4.5`
- 版本变化：[CHANGELOG.md](./CHANGELOG.md)
- 架构说明：[ARCHITECTURE.md](./ARCHITECTURE.md)

v0.4.5 完成验收并发布后，`main`、`develop` 和本次发布分支应指向同一个发布提交。在此之前不要创建或移动 v0.4.5 标签；旧发布标签只作为历史快照保留。

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

1. 在开发分支完成修改、文档和上述验证。
2. 将确认后的提交合并到 `develop` 和 `main`，避免长期分叉。
3. 验收完成后创建新的不可移动标签 `v0.4.5`，不要复用或移动已经公开的旧标签。
4. 推送标签后，`Release Build` 自动生成 Windows x64、macOS ARM64 和 macOS x64 安装包。
5. 等待三个平台构建与 `publish-release` 全部成功，再检查 Release 页面附件和说明。

## 当前发布限制

- 仓库尚未配置 Apple Developer 签名与公证 Secrets。macOS 构建会使用仓库默认的 ad-hoc 签名，用户可能需要移除 quarantine 标记。
- 纯逻辑测试不能模拟真实 macOS 主线程、窗口拖动和 Gatekeeper；每个 Release 仍需进行 ARM Mac、Intel Mac 和 Windows 实机验收。
- `src/assets/pets/default/idle/normal-002.png` 与 `normal-003.png` 体积较大，后续可在确认 Retina 清晰度后单独做资源优化。
- Actions 构建附件是临时测试产物；面向用户始终提供 Releases 页面链接。
