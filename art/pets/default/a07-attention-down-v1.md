# A07 注意下移差分 v1

- 日期：2026-09-16；基于用户确认的 [A06](a06-attention-v1.png)。
- 输出：[a07-attention-down-v1.png](a07-attention-down-v1.png)，200 × 200 RGBA 透明 PNG，50,699 字节。
- 人物整体下移 3 px；保持所有原 RGBA 像素、表情、尺寸与横坐标。
- 感叹号独立平移：相对 A06 右移 2 px、上移 1 px。
- 验证：人物 24,913 个非透明像素，感叹号 203 个非透明像素全部保留，无裁切、无碰撞；PNG 解码回读与理论平移逐像素一致。
- 人物边界（含端点）：`(6,17)–(193,193)` → `(6,20)–(193,196)`；感叹号：`(169,13)–(177,38)` → `(171,12)–(179,37)`。
- A06 未修改，SHA-256：`cafe5841076f819456d501532c21e9cff48c96f7a7a56a5da8e4f05cb74ab39b`。
- A07 SHA-256：`eb0e41490afba16f852096b05a3f48d084792cad893317e2a44dbbc192388a0d`。
- [动画预览](a01-a06-a07-a06-preview.gif)：`A01 → A06 → A07 → A06`，时长 `500 / 120 / 120 / 160 ms`，无限循环，400 × 400，深色背景仅用于展示；GIF 为 169,717 字节。
- 状态：当前仅接入 alert 第 2 帧，120 ms，运行副本为 `src/assets/pets/default/alert/attention-002.png`，与本图逐字节一致。最新编号见资源索引。
- alert 顺序为 A06/A07/A06（120/120/160 ms），400 ms 连续循环，内置与本机用户配置一致，保持不变。working 现已改用 A10/A11/A10（120/120/160 ms）；旧 `working/attention-001.png` 至 `attention-004.png` 仅保留供旧配置兼容，当前 working 不再使用。原四帧 GIF 仍作为含 A01 的表情转场预览。

## 制作方式

内置 image_gen 生成位移候选；最终为精确保留 A06，直接分离其人物和感叹号，按整数坐标复制原像素，不重采样或重绘。最终交付以此 PNG 和动画预览为准。

## image_gen 候选提示词

```text
Use case: precise-object-edit. Attached approved A06 is the sole edit target. Make A07, a strict animation offset frame on the identical 200x200 transparent canvas. Move the ENTIRE CHARACTER straight DOWN by exactly 3 pixels, with no horizontal motion. Independently move ONLY the purple exclamation mark 2 pixels to the VIEWER'S RIGHT and 1 pixel UP relative to A06. Preserve every original pixel, facial expression, o mouth, eyes, brows, colors, silhouette, outline thickness and alpha. No redrawing, rescaling, new facial details or pose change. Exposed regions must be genuinely transparent. Intended animation A01-A06-A07-A06. Output one 200x200 RGBA PNG.
```
