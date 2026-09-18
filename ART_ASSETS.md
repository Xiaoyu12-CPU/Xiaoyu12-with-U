# 桌宠美术资源索引

后续制作与状态替换先遵循 [ART_WORKFLOW.md](ART_WORKFLOW.md)，本文件负责编号和当前资源映射。

后续美术任务先读本文件，按 `A01 / A02 / A03 / A04 / A05 / A06 / A07 / A08 / A09 / A10 / A11` 引用，按需打开对应图片，省去重复扫描项目。表情 PNG 尺寸统一为 200 × 200，原文件名与动画配置保持不变。

初次核查日期：2026-09-16；发布基线与状态映射更新：2026-09-18。当前发布目标为 v0.5.0，包含 A01–A11 及下述内置动画；v0.4.6 / v0.4.6.1 作为历史开发基线保留。此索引依据当前源码及本机保存的资源配置，不代表已核查远端发布或已安装运行包。

## 三张主参考图

| 标记 | 用途与视觉特征 | 原始 PNG | 尺寸 | 透明通道 |
| --- | --- | --- | --- | --- |
| **A01** | 默认表情：睁眼、平静微笑；角色外观主参考 | [normal-001.png](src/assets/pets/default/idle/normal-001.png) | 200 × 200 | 有，含半透明边缘 |
| **A02** | 过渡表情：半闭眼，嘴角微笑 | [normal-002.png](src/assets/pets/default/idle/normal-002.png) | 200 × 200 | 有，alpha 为 0 / 255 |
| **A03** | 闭眼笑：双眼弯曲闭合，微笑 | [normal-003.png](src/assets/pets/default/idle/normal-003.png) | 200 × 200 | 有，alpha 为 0 / 255 |

三张均已逐张目视确认，并读取 PNG alpha 验证真实透明区域。角色共同特征：黑色双马尾、紫色发带与小皇冠、额头黑色眼罩及白色兔子装饰、蓝绿色眼睛、黑色颈部蝴蝶结。

`idle/normal-004.png` 是 **A01 的完全相同副本**（SHA-256 一致），用于动画回到默认表情；不是第四种表情。A03 虽然是笑脸，目前归属 `idle` 动画，不能直接等同于 `happy` 状态资源。

## 新生成资源

| 标记 | 表情 | PNG | 尺寸与状态 |
| --- | --- | --- | --- |
| **A04** | 基于 A01 的慌张脸：抬眉、微张嘴、角色右脸（画面左侧）微汗、头顶紫色慌张符号 | [a04-panicked-v1.png](art/pets/default/a04-panicked-v1.png) | 200 × 200，RGBA 真透明；已接入 tired、dragging 的第 1、3 帧 |
| **A05** | A04 的慌张动作差分：人物下移 3 px；慌张符号相对 A04 右移 2 px、上移 1 px | [a05-panicked-down-v1.png](art/pets/default/a05-panicked-down-v1.png) | 200 × 200，RGBA 真透明，54,563 字节；已接入 tired、dragging 的第 2 帧 |
| **A06** | 注意／“哦！”：小 o 嘴、头顶单个紫色感叹号；用户最终指定版本 | [a06-attention-v1.png](art/pets/default/a06-attention-v1.png) | 200 × 200，RGBA 真透明，50,725 字节；当前接入 alert 第 1、3 帧 |
| **A07** | A06 的注意动作差分：人物下移 3 px，感叹号右移 2 px、上移 1 px | [a07-attention-down-v1.png](art/pets/default/a07-attention-down-v1.png) | 200 × 200，RGBA 真透明，50,699 字节；当前接入 alert 第 2 帧 |
| **A08** | 开心！：稍扁的 `><` 闭眼、眉毛内侧略下倾、张开的粉色倒三角嘴、头顶金色 ✨ | [a08-happy-v1.png](art/pets/default/a08-happy-v1.png) | 200 × 200，RGBA 真透明，50,736 字节；已接入 happy 第 1、3 帧 |
| **A09** | A08 的开心动作差分：人物下移 3 px，三颗 ✨ 整体右移 2 px、上移 1 px | [a09-happy-down-v1.png](art/pets/default/a09-happy-down-v1.png) | 200 × 200，RGBA 真透明，50,780 字节；已接入 happy 第 2 帧 |
| **A10** | 工作中！：保留 A06 表情与感叹号，下方银白色笔记本背面带水平居中的纯灰小熊 logo，图案随背板透视压扁和收窄，并下移 2 px；笔记本已按后续要求放大 30% | [a10-working-laptop-v1.png](art/pets/default/a10-working-laptop-v1.png) | 200 × 200，RGBA 真透明，48,363 字节；已接入 working 第 1、3 帧 |
| **A11** | A10 的工作动作差分：人物下移 3 px，感叹号右移 2 px、上移 1 px；笔记本连同灰色小熊 logo 全部原像素固定不动 | [a11-working-laptop-down-v1.png](art/pets/default/a11-working-laptop-down-v1.png) | 200 × 200，RGBA 真透明，47,632 字节；已接入 working 第 2 帧 |

A08 于 2026-09-17 基于 A01 制作，仅合入眉眼、嘴与星光，其他像素保持原样；随后按用户要求将眉内侧下移 1 px、`><` 眼形压扁。已通过尺寸、透明度、深浅背景和局部合成检查。[A08 制作记录](art/pets/default/a08-happy-v1.md)。

A09 基于最新眉眼微调版 A08，保留全部原像素分别平移人物和三颗星光，无裁切或碰撞。[A09 差分记录](art/pets/default/a09-happy-down-v1.md)。原 [A01 → A08 → A09 → A08 转场预览](art/pets/default/a01-a08-a09-a08-preview.gif) 保留，时长为 `500 / 120 / 120 / 160 ms`，400 × 400 深色背景仅用于展示；happy 实际循环为 `A08 → A09 → A08`，不包含 A01。

A10 基于 A06，仅加入笔记本背面；后续按用户要求将笔记本宽高各放大 30%，由 89 × 21 取整为 116 × 27 px，当前范围 x43–158、y167–193（含端点），底边不变，保留完整脸部和领口。背板小熊 logo 参考额头头饰，现为 12 × 11 px，统一中性灰 `#888888`，以负形眼孔露出原银色背板；图案竖向压扁，并按背板平面轻微向下收窄。随后保留 90 个标志原像素整体下移 2 px，当前范围 x95–106、y177–187，中心 (100.5,182)；实际仅 56 个像素变化，空出部分恢复原背板，其他区域与 alpha 保持原样。笔记本范围外 RGBA 与 A06 逐像素一致，尺寸、透明度、深浅背景检查通过。[A10 制作记录及完整提示词](art/pets/default/a10-working-laptop-v1.md)。已接入 working 第 1、3 帧。

A11 基于最新 A10 分离人物、符号和电脑：21,991 个可见人物源像素下移 3 px，203 个感叹号像素右移 2 px、上移 1 px；3,044 个电脑像素含标志原位覆盖，完全不变。仅移动当前可见人物，不恢复原本被电脑挡住的躯干。[A11 差分记录](art/pets/default/a11-working-laptop-down-v1.md)。已接入 working 第 2 帧。[A01 → A10 → A11 → A10 动画预览](art/pets/default/a01-a10-a11-a10-preview.gif) 保留为含 A01 的转场预览，使用 500 / 120 / 120 / 160 ms、无限循环，400 × 400 深色背景仅作展示，157,255 字节；working 实际循环为 A10 → A11 → A10，不包含 A01。下一张独立画面使用 A12。

A06 以用户最后上传的 `codex-clipboard-6c1f70c1-415d-43c5-a888-e864ef2ffa49.png` 为唯一正式版本，原样保存并验证文件哈希一致。此前 A06 生成稿、两次修改产物和旧修改记录已清理。[A06 确认记录](art/pets/default/a06-attention-v1.md)。

A07 保留 A06 全部人物和感叹号原像素，分别按指定整数坐标平移，无裁切或碰撞。[差分记录](art/pets/default/a07-attention-down-v1.md)。[A01 → A06 → A07 → A06 循环预览](art/pets/default/a01-a06-a07-a06-preview.gif) 使用 `500 / 120 / 120 / 160 ms`，400 × 400 深色背景仅用于展示。

A04 于 2026-09-16 使用内置 image_gen 生成，已目视核查表情并验证 alpha；[生成记录与完整提示词](art/pets/default/a04-panicked-v1.md)。

A04 已获用户确认。A05 保留 A04 像素，仅分别平移人物与慌张符号；[差分记录](art/pets/default/a05-panicked-down-v1.md)。原 `A01 → A04 → A05 → A04` [转场预览 GIF](art/pets/default/a01-a04-a05-a04-preview.gif) 保留，时长为 `500 / 120 / 120 / 160 ms`，400 × 400 最近邻放大、深色背景仅用于展示。tired 和 dragging 实际循环均为 `A04 → A05 → A04`，不包含 A01。PNG 本身保持 200 × 200 透明。

同日按用户要求修平 A04 上唇左侧凸起，并将 A02/A03/A04 从 1254 × 1254 最近邻缩放为 200 × 200；保留 alpha，清零全透明像素的隐藏 RGB 并压缩 PNG。三张体积分别为 54,243 / 56,440 / 54,536 字节，合计由 5,343,325 降至 165,219 字节（减少约 96.9%）。A01/004 未修改。

随后按用户要求清理 A01 发丝边缘的 74 处浅灰残留，其他像素保持原样；同步更新完全相同的 `normal-004.png` 和上述慌张循环预览。A01/004 仍为 200 × 200 RGBA PNG，各 49,710 字节。[清理记录](art/pets/default/a01-edge-cleanup.md)。

A02/A03 后续也已完成白边清理并原位替换：分别修改 146 / 231 个边缘残留像素，其他像素保持原样。当前体积为 53,088 / 55,132 字节，仍为 200 × 200，alpha 仅 0 / 255。[两张图的清理记录](art/pets/default/a02-a03-edge-cleanup.md)。动画编辑器现会重新读取图片实际尺寸，不再直接显示旧用户配置中的 1254 × 1254；尺寸读取不产生未保存修改。

## 当前引用和播放

- 入口：[Pet.vue](src/pet/Pet.vue) → [assetLoader.ts](src/pet/assetLoader.ts) → [pet.json](src/assets/pets/default/pet.json)；渲染使用 [animationEngine.ts](src/pet/animationEngine.ts)。
- 仓库内置 idle：`A01 (200 ms) → A02 (100 ms) → A03 (200 ms) → A01/004 (0 ms)`；末帧保持显示，随机等待 `10 / 3 / 30 / 22 秒` 后重播，与本机确认的待机节奏一致。
- 仓库内置 tired：`A04 (120 ms) → A05 (120 ms) → A04 (160 ms)`，400 ms 连续循环、无额外等待。运行资源分别为 `src/assets/pets/default/tired/panicked-001.png`、`panicked-002.png`、`panicked-003.png`；首末帧内容相同，独立路径避免编辑器帧标识重复。本机 tired 用户配置与此序列一致。
- dragging：`A04 (120 ms) → A05 (120 ms) → A04 (160 ms)`，400 ms 连续循环、无额外等待。内置配置和本机用户配置使用同一序列。运行资源为 `src/assets/pets/default/dragging/panicked-001.png=A04`、`panicked-002.png=A05`、`panicked-003.png=A04`；首末帧使用独立路径。dragging 使用独立运行副本，原 tired 映射和配置不变。
- alert：`A06 (120 ms) → A07 (120 ms) → A06 (160 ms)`，400 ms 连续循环。运行资源为 `src/assets/pets/default/alert/attention-001.png` 至 `attention-003.png`。
- working：`A10 (120 ms) → A11 (120 ms) → A10 (160 ms)`，400 ms 连续循环、无额外等待。内置配置和本机用户配置使用同一序列。运行资源为 `src/assets/pets/default/working/laptop-001.png=A10`、`laptop-002.png=A11`、`laptop-003.png=A10`；首末帧使用独立路径，电脑与 logo 在三帧间保持固定。实际循环不包含 A01。
- happy：`A08 (120 ms) → A09 (120 ms) → A08 (160 ms)`，400 ms 连续循环、无额外等待。内置配置和本机用户覆盖使用同一序列。运行资源为 `src/assets/pets/default/happy/happy-001.png=A08`、`happy-002.png=A09`、`happy-003.png=A08`；首末帧使用独立路径。
- 当前本机确认的 idle、happy、tired、dragging、alert、working 序列与 v0.5.0 内置配置一致；sleep 保留原占位配置。接入帧使用独立路径，正式表情尺寸均为 200 × 200。
- 本机保存配置：`~/Library/Application Support/com.Xiaoyu12.desktoppet/pets/default/pet.json`。idle 仍引用这四张内置文件，时长为 `200 / 100 / 200 / 0 ms`；随机等待不变。该目录未发现用户上传 PNG。
- 本机 `happy` 的原空帧配置已替换为上述开心动画；不再因空帧回退 idle。浏览器预览可能另有 localStorage 覆盖，此索引的本机配置指上述磁盘配置。
- 升级时其他用户已保存的自定义设置和动画覆盖继续优先；本次发布不新增迁移，不将本机确认配置强制写入其他用户的保存文件。上述内置默认值用于新安装或缺少覆盖的状态。

## 其他资源的区分

- `src/assets/pets/default/sleep/placeholder-001.png`：睡眠状态占位资源，文件哈希与 A01–A03 不同；不纳入本轮三张主参考图。happy、tired、dragging、alert、working 的旧 `placeholder-001.png` 保留供旧配置兼容；这些状态的当前内置配置已使用正式动画。
- `src/assets/pets/default/working/attention-001.png` 至 `attention-004.png`：旧 working 的 A06/A07 副本，仅保留供旧配置兼容，当前 working 不再使用；A06/A07 当前状态映射仅为 alert。
- `src/assets/control-center/`：控制中心背景及缩略图。
- `src-tauri/icons/`：应用图标；图标源自默认 idle 首帧，但不是表情原图。

## 后续制作的简短引用

可直接使用：

> 读 ART_ASSETS.md，以 A01 为角色基准，参考 A02 的过渡表情和 A03 的闭眼笑，制作【目标表情/动作】透明像素 PNG。

新增帧需保持角色比例、画面位置和像素风格一致，交付画布统一为 200 × 200。生成或编辑时仍应实际打开并提供所需参考图，文字标记不能替代图像参考。
