# A11 工作中下移差分 v1

- 日期：2026-09-18；基于最新 [A10](a10-working-laptop-v1.png)，包含下移 2 px 的纯灰透视小熊标志。
- 正式文件：[a11-working-laptop-down-v1.png](a11-working-laptop-down-v1.png)，200 × 200，RGBA 真透明 PNG，47,632 字节。
- 人物层：从 A10 分离实际可见人物，21,991 个非透明源像素整体下移 3 px，横坐标、颜色、表情与 alpha 不变；以固定电脑为前景覆盖。
- 符号层：203 个感叹号像素独立右移 2 px、上移 1 px，保持原 RGBA。
- 电脑层：3,044 个笔记本原像素（包括边框、银色背板与全部灰色 logo）保持原位置、颜色和 alpha，逐像素与 A10 一致；范围 x43–158、y167–193（含端点）。
- 人物边界（含端点）：(6,17)–(193,193) → (6,20)–(193,196)；符号：(169,13)–(177,38) → (171,12)–(179,37)。无画布越界。
- 制作：内置 image_gen 生成候选，最终按 A10 的人物、符号、电脑三层整数像素合成，不重采样或重绘；没有从早期 A06 恢复原先被电脑遮住的躯干，避免电脑底部出现额外身体细条。
- 候选文件：`exec-09d36559-1c00-45f6-bd52-9c219600961b.png`；仅作生成候选，不进入运行目录。
- 验证：PNG 无损回读、尺寸、alpha、三层几何和原像素校验通过；深浅背景对照正常。电脑固定原像素没有任何变化。
- A11 SHA-256：`554b132010fc78ed13d6cf687fe2763030d057321a5aff17ded16d9746dea42e`。
- A10 SHA-256：`95774ecc807a59f11e8c4f9249ca848459a91c7585b253f9ae99cb8ffcde1624`，源图未修改。
- [动画预览](a01-a10-a11-a10-preview.gif)：A01 → A10 → A11 → A10，500 / 120 / 120 / 160 ms，无限循环；400 × 400 最近邻放大，深色背景仅用于展示，157,255 字节。GIF 解码后 A10/A11 各电脑像素也保持一致。
- 状态：已接入 working 第 2 帧，运行副本为 `src/assets/pets/default/working/laptop-002.png`；第 1、3 帧 `laptop-001.png`、`laptop-003.png` 对应 A10。内置与本机用户配置统一为 A10 → A11 → A10，120 / 120 / 160 ms、400 ms 连续循环；实际循环不包含 A01，上述 GIF 保留为转场预览。旧 working 的 `attention-001.png` 至 `attention-004.png` 保留供旧配置兼容，当前不再使用；alert 配置不变。下一张独立画面使用 A12。

## 内置 image_gen 提示词

```text
Use case: precise-object-edit. Edit target: attached latest A10 working desktop-pet sprite, 200×200 transparent pixel art.
Create A11 as a strict layered animation difference: move the ENTIRE CHARACTER (hair, face, crown, headband, clothing and shoulders) straight DOWN by exactly 3 logical pixels, with no horizontal motion. Independently move the purple exclamation mark RIGHT 2 pixels and UP 1 pixel relative to A10.
The silver laptop in the foreground is completely LOCKED: keep EVERY original laptop pixel, its trapezoid shape, position, border, shading and gray bear logo unchanged. Do not shift the laptop or its logo at all. The character moves BEHIND this fixed laptop; the laptop occludes her lower body naturally. Preserve all character expression pixels, sizes, colors and alpha, and keep the forehead ornament. No rescaling, warping, redrawing, extra outlines, new props or expression changes. Transparent background, identical 200×200 canvas.
Intended preview sequence is A01 → A10 → A11 → A10. Output only the A11 frame.
```
