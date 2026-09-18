# A09 开心下移差分 v1

- 日期：2026-09-17；基于最新眉眼微调版 [A08](a08-happy-v1.png)。
- 输出：[a09-happy-down-v1.png](a09-happy-down-v1.png)，200 × 200，RGBA 透明 PNG，50,780 字节。
- 人物整体下移 3 px；保留 A08 原表情及全部 RGBA 像素。
- 三颗金色 ✨ 作为一组独立移动：相对 A08 右移 2 px、上移 1 px。
- 人物 24,913 个非透明像素，边界（含端点）`(6,17)–(193,193)` → `(6,20)–(193,196)`。
- 星光 289 个非透明像素（204＋44＋41），整体边界 `(168,13)–(196,48)` → `(170,12)–(198,47)`。
- 验证：无裁切、无碰撞；PNG 解码回读与理论平移的 RGBA 逐字节一致，A08 未改变。
- A08 SHA-256：`56a1b8abdaea7d6ac8b54fc2948c531898a4deb239ebcd759e1b2633b139a1a8`。
- A09 SHA-256：`cf79856fec2e5721380427c29d450be428622290adce4baa4eb2758e108c56e6`。
- 原 [转场预览](a01-a08-a09-a08-preview.gif) 保留：`A01 → A08 → A09 → A08`，时长 `500 / 120 / 120 / 160 ms`，无限循环，400 × 400，169,655 字节。深色背景和最近邻放大仅用于展示；PNG 本身为 200 × 200 透明。此 GIF 不代表 happy 的实际帧序列。
- 状态：已接入 happy 第 2 帧，运行副本为 `src/assets/pets/default/happy/happy-002.png`；`happy-001.png`、`happy-003.png` 使用 A08。
- 内置和本机用户覆盖均为 `A08 (120 ms) → A09 (120 ms) → A08 (160 ms)`，400 ms 连续循环、无额外等待，不包含 A01；下一张独立画面使用 A10。

## 制作方式

内置 image_gen 生成位移候选；最终文件从 A08 分离人物和三颗星光，按指定整数坐标逐像素复制，保证表情与全部原像素不变，无重采样或重绘。交付以本 PNG 和循环预览为准。

## image_gen 候选提示词

```text
Use case: precise-object-edit. Sole edit target: attached approved A08 happy pixel-art sprite. Create A09 as an exact animation offset frame on the identical 200x200 RGBA transparent canvas. Translate the ENTIRE CHARACTER straight DOWN by exactly 3 pixels; no horizontal motion, resizing, rotation or redraw. Independently translate the COMPLETE golden sparkle cluster (all three twinkles) 2 pixels toward the VIEWER'S RIGHT and 1 pixel UP relative to A08. Preserve the original flatter >< eyes, slightly inward-down eyebrows, triangle mouth, skin, colors, alpha, hair silhouette, crown, mask, bunny, ribbons and clothing pixel for pixel. Keep every original character pixel and symbol pixel, with no clipping and no overlap. Newly exposed areas must be genuinely transparent. Intended animation sequence A01-A08-A09-A08. No added outline, background, shadow, text, symbols or changes of expression.
```
