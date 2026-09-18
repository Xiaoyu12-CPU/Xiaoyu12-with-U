# A05 慌张下移差分 v1

- 日期：2026-09-16；基于用户已确认的 [A04](a04-panicked-v1.png)。
- 输出：[a05-panicked-down-v1.png](a05-panicked-down-v1.png)，200 × 200 RGBA PNG，54,563 字节。
- 人物整体下移 3 px，保持横坐标、尺寸、颜色、alpha 和表情原像素。
- 慌张符号独立平移：相对 A04 右移 2 px、上移 1 px。
- 验证：人物 25,481 个非全透明像素、符号 410 个非全透明像素全部保留，无裁切、无重叠。PNG 解码回读与预期逐像素一致。
- 原 [转场预览](a01-a04-a05-a04-preview.gif) 保留：`A01 → A04 → A05 → A04`，帧时长 `500 / 120 / 120 / 160 ms`。预览深色背景和 400 × 400 放大仅用于展示；tired 和 dragging 实际循环不包含 A01。
- 已接入 tired 连续循环第 2 帧，120 ms；运行资源为 `src/assets/pets/default/tired/panicked-002.png`。tired 顺序为 `A04 → A05 → A04`（120 / 120 / 160 ms），A04 原图未修改。
- 2026-09-18 接入 dragging 第 2 帧，120 ms；运行资源为 `src/assets/pets/default/dragging/panicked-002.png`，`panicked-001.png`、`panicked-003.png` 使用 A04。内置和本机用户配置均为 `A04 (120 ms) → A05 (120 ms) → A04 (160 ms)`，400 ms 连续循环、无额外等待。原 tired 映射和配置不变。

## 制作方式

先使用内置 image_gen 生成位移候选。候选对表情细节有重绘；为保持用户确认的 A04，最终文件直接从 A04 分离人物和符号，按上述整数偏移逐像素放置。最终帧无重采样，无新增绘制；保留透明 PNG 并无损压缩。

## image_gen 候选提示词

```text
Precise sprite animation difference-frame edit, using the attached approved A04 as the sole edit target. Create A05 on the SAME square transparent canvas. Think on its original 200x200 pixel grid: translate the ENTIRE CHARACTER straight DOWN by exactly 3 pixels (1.5% of canvas height), with NO horizontal movement, rotation, scaling, deformation or redrawing. Separately move ONLY the three purple panic marks at the upper-right of the head 2 pixels to the RIGHT and 1 pixel UP relative to their positions in A04. All newly exposed areas are genuine alpha transparency. Keep the raised eyebrows, open flat-topped mouth, one sweat drop on the character's right cheek/viewer's left, eyes, blush, black hair, crown, mask, ribbons and clothing exactly unchanged. This is one in-between frame in A01-A04-A05-A04: the desired effect is a tiny vertical nervous bob, not a different pose or expression. Preserve crisp pixel art, palette, character size and all details. Output one 200x200 transparent PNG. No background, checkerboard, text, shadow or border.
```
