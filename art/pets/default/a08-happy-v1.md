# A08 开心！ v1

- 日期：2026-09-17；基于清理后的 [A01](../../../src/assets/pets/default/idle/normal-001.png)。
- 输出：[a08-happy-v1.png](a08-happy-v1.png)，200 × 200，RGBA 透明 PNG，50,736 字节。
- 表情：画面左眼为 `>`、右眼为 `<`，眼形稍扁、眉毛内侧略下倾；张开的粉色倒三角嘴；头顶画面右侧金色 ✨。
- 方式：内置 image_gen 编辑 A01；生成稿最近邻缩至 200 × 200 后，仅合入眉眼、嘴和独立星光区域，其余 A01 像素保留。
- 眼部范围（左闭右开）：`(68,111)–(95,131)`、`(109,111)–(138,131)`。
- 嘴部范围：`(94,137)–(110,148)`，将生成稿嘴部下移 5 px 合入原嘴所在区域，保持居中。
- 星光：289 个有效像素，相对生成稿右移 2 px，避开原头发；无裁切或重叠。
- 验证：当前相对 A01 共 1,595 个像素变化，均在眉眼、嘴和星光区域；其余 RGBA 与 A01 逐像素一致。PNG 无损回读与尺寸检查通过；深浅背景均未见残留眼白、彩色虹膜、明显拼接接缝或新增白边。
- 状态：已接入 happy 第 1、3 帧；下移差分 [A09](a09-happy-down-v1.md) 为第 2 帧。内置和本机用户覆盖均为 `A08 (120 ms) → A09 (120 ms) → A08 (160 ms)`，400 ms 连续循环、无额外等待。
- 运行副本：`src/assets/pets/default/happy/happy-001.png` 和 `happy-003.png` 使用本图；`happy-002.png` 使用 A09。首末帧使用独立文件路径。
- 原 [A01 → A08 → A09 → A08 GIF](a01-a08-a09-a08-preview.gif) 保留为转场预览；happy 实际循环不包含 A01。最新编号见资源索引。

## 眉眼微调（2026-09-17）

- 两眉内侧原像素向下移动 1 px：左眉 x=85–87，右眉 x=118–119，y=100 → 101；空出的位置补为附近皮肤。
- `><` 双眼更扁；深色主轮廓高度由 15 px 减至 12 px，仍处于原眼部位置。
- 本次仅更新眼部 `(73,114)–(91,131)`、`(113,114)–(131,131)`（左闭右开）与上述眉内侧位置，共 620 个像素。嘴巴、星光及其余 RGBA 全部保持微调前原样，alpha 全图不变。
- 内置 image_gen 生成眼形候选，局部合成并校准位置；未采用候选中其他区域的重绘。深浅背景视觉复核通过。
- SHA-256：`56a1b8abdaea7d6ac8b54fc2948c531898a4deb239ebcd759e1b2633b139a1a8`。

### 本次内置 image_gen 提示词

```text
Use case: precise-object-edit. Edit target: the attached current A08 HAPPY pixel sprite. Make ONLY TWO small local refinements: (1) gently tilt each eyebrow's INNER end DOWN toward the bridge of the nose by about one pixel, keeping its outer end at the same place, producing excited happiness rather than anger; (2) make the squeezed-shut >< eyes slightly FLATTER: reduce each chevron's vertical height by about 25-30 percent around its existing center, preserving horizontal width, position, slim stroke thickness and dark warm color. The left eye must still be > and right eye <, with crisp angular joins. Everything else must remain exactly unchanged, especially the triangular pink mouth and its position, nose, blush, the golden sparkle cluster, hair and original thin silhouette, crown, mask/bunny, ribbons, clothing, pose, scale and colors. Same 200x200 RGBA transparent canvas. No new drawing outside eyebrows and eyes; no thick black outline, white fringe, background, new symbols or text.
```

## 内置 image_gen 提示词

```text
Use case: precise-object-edit. Edit target and sole identity reference: attached cleaned A01 desktop pet sprite. Create A08, an exuberantly HAPPY expression. Keep the exact character, pose, proportions, position, hair silhouette, crown, purple ribbons, forehead sleep mask with bunny decoration, clothing and colors unchanged. Change ONLY the actual two eyes and the mouth, and add the floating symbol: replace both open eyes completely with sharply angled squeezed-shut happy eyes reading >< (VIEWER'S LEFT eye shaped >, VIEWER'S RIGHT eye shaped <); each eye is a clean pair of dark slim pixel strokes, no remaining iris or eyeball. Replace the tiny smile with a small cheerful OPEN TRIANGULAR mouth, flat upper edge and downward-pointing tip, coral-pink interior, centered under the midpoint of the two eyes. Retain the original skin, blush and other facial details. Above the head toward the VIEWER'S RIGHT, in free transparent space separate from hair and crown, add one compact pixel-art sparkle cluster like the emoji ✨: one larger golden four-point twinkle and two small companion twinkles, with pale-yellow centers and subtle warm edges. Avoid thick dark sticker outlines. Preserve all unrequested original pixels and the cleaned silhouette. Exact 200x200 square RGBA canvas, genuine alpha transparency, crisp pixel art. Do not enlarge or shift the character; no white fringe, background, drop shadow, text, exclamation mark or sweat.
```
