# withXiaoyu12 桌宠项目 · 开发交接文档

> 交接时间：2026-08-28 · 交接自：DeepSeek Harness 会话（glm-4.7）· 接手：GPT5.6-sol
> 仓库：https://github.com/Xiaoyu12-CPU/Xiaoyu12-with-U（本地 `/data/dsh/home/Xy12/pet`，分支 `develop`）
> 用户：非技术背景。**沟通永远给 Releases 页面链接，绝不发 Actions 日志页**；方案先说人话再谈细节；改动要给出明确的工期预期。

---

## 1. 项目是什么

Tauri 2 + Vue 3 + TypeScript 桌面桌宠应用，三端（macOS arm64 / macOS x64 / Windows x64）。核心能力：桌宠动画与对话、全局键鼠监听、系统状态监控、提醒、控制中心设置。

## 2. 当前状态（截至交接）

**最新 Release：`v0.4.2-preview`**（三平台资产齐全）：
https://github.com/Xiaoyu12-CPU/Xiaoyu12-with-U/releases/tag/v0.4.2-preview

本地 `develop` = `10f1147`，与远端同步，工作区干净。版本号三处一致 `0.4.1`（package.json / tauri.conf.json / Cargo.toml）——**注意 tag 是 v0.4.2-preview 但版本字段还是 0.4.1，下一版记得一起升**。

### 已完成的两大里程碑（本会话交付）

**① Windows 全局键鼠监听**（`90f55cc` 及之前）
- `src-tauri/src/input/platform/windows.rs`：WH_KEYBOARD_LL/WH_MOUSE_LL 双钩子 + 专用消息泵线程；回调直接查表映射后调 sink（`static EVENT_SINK: Mutex<Option<Arc<dyn Fn + Send + Sync>>>`，mpsc::Sender 不是 Sync 不能放 static——这是踩过的坑）；`WM_APP+1` 优雅停止
- `windows_keymap.rs`：VK 码→键名，与 macOS 命名对齐
- Windows 无权限门槛（`permission_state()` 恒 Granted）；管理员程序按键不可见（UIPI，架构限制）

**② 桌面 UI 三窗口拆分**（`23287b8`、`764fe79`、`6134609`、`10f1147`）
- `main` 桌宠本体 / `system-status` 系统状态悬浮窗 / `input-monitor` 键鼠监视悬浮窗 / `control-center`
- 后端命令：`open_overlay_window`（异步，防 Windows 建窗死锁）、`move_overlay_window`、`set_overlay_click_through`、`save_window_position`/`load_window_position`（位置存 `window-positions.json`，与 settings.json 分离）
- 事件全广播：`monitor.rs` 输入/状态事件、`runtimeBridge` 快照、`settingsStorage.broadcast` 都改为 `emit()` 全窗广播（不再是 `emitTo('main')`）
- 跟随桌宠：`src/pet/followPet.ts` 监听 `onMoved` 计算位移增量转发给悬浮窗，**默认开启**
- 窗口开关：`settings.windows` 段（`petWindowEnabled`/`systemStatusWindowEnabled`/`inputMonitorWindowEnabled`/`systemStatusClickThrough`/`inputMonitorClickThrough`/`followPet`）；旧 `displayMode` 三态已标废弃并在 `normalizeSettings` 里自动迁移（legacy status-only/both → status 窗开）
- 开关联动：`src/pet/overlayWindowWatcher.ts` 在 Pet.vue 里 watch windows 段，开/关窗+应用穿透

## 3. 架构速查

```
事件流：Rust 钩子 → sink 广播 → 各窗口自行订阅
  keyboard-input / mouse-input（事件流）
  keyboard-status / mouse-status（监听器状态）
  desktop-pet://status-updated（桌宠运行时快照，main 窗广播）
  desktop-pet://settings-updated（设置文档，控制中心保存后广播）
  desktop-pet://pet-moved（预留）
数据主权：main 窗拥有监听器生命周期和轮询；悬浮窗只读广播（inputOverlayRuntime.ts 维护轻量按键状态）
窗口路由：App.vue 按 getCurrentWindow().label 分发
能力声明：src-tauri/capabilities/default.json 的 windows 数组必须含全部窗口 label，permissions 含 close/show/set-focus/set-position/set-ignore-cursor-events
```

关键文件：
| 文件 | 职责 |
|---|---|
| `src-tauri/src/commands/app.rs` | 窗口工厂/移动/穿透/位置持久化 |
| `src-tauri/src/input/monitor.rs` | 监听器生命周期+事件广播 |
| `src/pet/Pet.vue` | 桌宠主组件（837→约500行，覆盖层已拆走） |
| `src/components/SystemStatusWindow.vue` `InputMonitorWindow.vue` | 两个悬浮窗页面 |
| `src/components/overlayDrag.ts` | 悬浮窗拖拽+位置记忆 composable |
| `src/settings/settingsManager.ts` | 设置归一化/迁移（windows 段在 `normalizeWindowSettings`） |
| `.github/workflows/windows-x64-build.yml` | CI（含诊断通道，见 §5） |

## 4. 本地开发环境（必读）

- **每个 shell 都要先导出**：`export XDG_CONFIG_HOME=/data/dsh/home/Xy12/.config XDG_DATA_HOME=/data/dsh/home/Xy12/.local/share XDG_CACHE_HOME=/data/dsh/home/Xy12/.cache`，否则 pnpm/vue-tsc/vite 报错
- pnpm 10 / Node 24
- 测试：`pnpm run test:input` / `test:reminders` / `test:control-center`（`tests/*.test.mjs`，通过 vite.ssrLoadModule 加载 TS）
- 类型检查：`npx vue-tsc --noEmit`；构建验证：`npx vite build`
- **没有本地 cargo/rustc**，Rust 编译只能靠 GitHub Actions（Windows runner 一轮带 rust-cache 约 4~13 分钟）
- node 内联脚本**禁止用 `/dev/stdin` heredoc**（沙箱 ENOENT），先 `write` 到 `/tmp/*.js` 再 `node` 执行；也不能传 `sandbox_permissions` 参数
- 推送走 repo 内 `core.sshCommand`（deploy key `/data/dsh/home/Xy12/.ssh/id_ed25519`），**不要动 remote url**

## 5. CI 诊断通道（重要遗产）

`windows-x64-build.yml` 现在自带完整失败诊断链：
1. `cargo check` 独立步骤（先于前端打包），`tee check-log.txt`
2. 失败时 `Swatinem/rust-cache` 之后的步骤把日志推到公开 `ci-logs` 分支（**工作目录注意：check-log.txt 在 `src-tauri/` 下**，拷贝路径已修正）
3. 读取方式：`git clone --depth 1 --branch ci-logs` 后看 `check-log.txt`；也试过 raw.githubusercontent（有延迟）和 check-run summary（Windows runner 上不回传 API，不可靠）
4. artifact 下载需要认证（deploy key 不够），走不通
5. `permissions: contents: write` 是必须的（推分支要写权限）

修 Windows 编译错误的正确姿势：推代码 → 等 CI → 绿了继续 / 红了拉 ci-logs 分支看真实 rustc 输出 → 精修。**不要盲修**（本会话为此浪费了 6 个轮次）。

## 6. 已知遗留问题 / 待办

1. **`displayMode` 字段还在**（settingsTypes.ts:66、defaultSettings.ts:37，标了 @deprecated 但未删）——做设置 UI 清理时一并删除
2. **键鼠监视窗内容布局简单**：KeyHistoryStack 固定 `position="top" flow="down"`，没复用原来的 keyDisplayPosition 设置；鼠标可视化也没用 mouseVisualizerPosition/Offset——用户如果提"监视窗里位置可调"，从这里接
3. **状态窗拖拽与穿透冲突**：穿透开启时整个窗不可点（连拖动都不行），目前 UI 上用"跟随模式时禁用穿透开关"规避，但独立摆放+穿透的组合会让人无法再拖动该窗，可能需要"穿透时留一个拖拽把手"或"从控制中心关闭穿透"的引导
4. **systemStatusBubble.offsetX/offsetY** 原来是窗内偏移，拆窗后语义悬空（还在 settings 里），可改造成窗内 panel 微调或清理
5. **优先级 backlog**（用户已认可未排期）：设置合并/visibilitychange 优化（旧代码评审 #2-#7）、macOS 签名证书（TCC 持久化）、PNG 调色板优化（低）
6. **v0.4.1-preview.2 这个 tag 名不要再用**：它曾指向旧提交并发过一个空壳 release（后来转正为 v0.4.2-preview），softprops 的 publish 步骤撞上空壳会失败

## 7. 发布流程（背下来）

1. develop 上改完 → 本地 `vue-tsc --noEmit` + 三套 test → 提交推送
2. 等 Windows CI 绿（红则走 §5 诊断）
3. `git tag vX.Y.Z-preview.N && git push origin <tag>` → Release Build 工作流自动构建三平台并发布（prerelease: tag 含 `-` 即 true）
4. 完成后从 releases API 确认三资产；**给用户的链接形如** `https://github.com/Xiaoyu12-CPU/Xiaoyu12-with-U/releases/tag/<tag>`
5. 若 publish 步骤失败而三平台 job 全绿 → 八成是 tag 撞了旧空壳 release → 换新 tag 名（v0.4.2-preview 就是这样从 v0.4.1-preview.2 转正的）

## 8. 沟通备忘

- 用户中文交流；技术词翻译成大白话，解释"为什么"而不是堆术语
- 每轮工作结束给出：做了什么/怎么验证的/下一步；工期预估按"本会话历史均值"（三窗口拆分从动工到发版约 1.5 小时净工时，含 2 轮 CI 修复）
- macOS 安装需 `xattr -dr com.apple.quarantine` + 辅助功能权限（未签名应用），README 有说明
- 用户会在真机上验证功能后给反馈；下一版候选需求：监视窗位置设置接入、穿透+拖拽共存方案、清理 displayMode

—— 交接完毕。祝顺利。
