# A04 慌张脸 v1

- 生成日期：2026-09-16
- 方式：内置 image_gen，以 A01 为编辑参考。
- 原图：`src/assets/pets/default/idle/normal-001.png`
- 输出：[a04-panicked-v1.png](a04-panicked-v1.png)
- 当前文件规格：200 × 200，RGBA PNG，54,536 字节，已验证包含透明像素。
- 表情：抬眉、嘴巴微张、角色自身右脸（画面左侧）一滴汗、头顶紫色慌张符号。
- 状态：已接入 tired 连续循环的第 1、3 帧，时长分别为 120 / 160 ms；运行资源为 `src/assets/pets/default/tired/panicked-001.png` 与 `panicked-003.png`。
- 2026-09-18 接入 dragging 第 1、3 帧：运行资源为 `src/assets/pets/default/dragging/panicked-001.png` 与 `panicked-003.png`，第 2 帧 `panicked-002.png` 使用 A05。内置和本机用户配置均为 `A04 (120 ms) → A05 (120 ms) → A04 (160 ms)`，400 ms 连续循环、无额外等待。原 tired 映射和配置不变。
- 原 [A01 → A04 → A05 → A04 GIF](a01-a04-a05-a04-preview.gif) 保留为转场预览；tired 和 dragging 实际循环不包含 A01。

2026-09-16 修订：使用内置 image_gen 修平上唇左上凸起；最近邻缩小为 200 × 200 后，只合入嘴部 11 × 8 像素区域。已验证嘴部以外的像素与原 A04 最近邻缩小结果一致。全透明像素的隐藏 RGB 清零并重新压缩 PNG。原始大图保留在工具生成目录，工程内使用优化后的同名文件。

## 嘴部修正提示词

```text
Precise local pixel-art correction. Image 1 is the full existing transparent A04 sprite to EDIT. Image 2 is a magnified locator showing its mouth defect, not a separate artwork to generate. At the upper-left edge of the open pink mouth, a single logical pink pixel block protrudes upward above the top lip. Move that protruding pixel block down by one pixel-art grid step to be LEVEL with the rest of the horizontal upper lip. Replace its old protruding position with matching surrounding pale skin. The result must have one flat continuous horizontal upper-lip edge, no pink bump above it. Keep the mouth slightly open and the same width and height otherwise. CRITICAL: change only this tiny mouth defect. Preserve every other element of Image 1 including eyebrows, eyes, right-cheek sweat drop (viewer left), blush, expression, panic marks, hair, crown, sleeping mask, outfit, framing, precise position, colors, pixel-art style, and existing genuine alpha transparency. Do not redraw, beautify, move, or redesign the sprite. Output only the edited full square sprite as a transparent PNG, no text, no checkerboard, no border.
```

## 初次生成提示词

```text
Use case: precise-object-edit. Edit the attached A01 sprite into one flustered/panicked expression for the same desktop pet. Preserve its original pixel-art identity, pixel density, face shape, blue-green eyes, black twin tails, purple crown and ribbons, black sleep mask with white bunny ornament, black outfit and neck bow, pose, framing and character alignment. Change only: raise both eyebrows visibly in a worried expression; part the mouth slightly into a tiny nervous open mouth; put one subtle cyan sweat drop on the CHARACTER'S OWN RIGHT cheek (VIEWER'S LEFT); add a small pixel-art panic symbol consisting of three short angular alarm strokes just above the head on the viewer's right, clear of the crown. Keep the emotion cute and mildly panicked. Preserve the square canvas and 200x200 sprite composition with crisp pixel edges. Output one standalone PNG with genuine transparent background and alpha, including transparent space around the panic symbol. No checkerboard painted into the image, no background, no text, no border or white sticker outline, no extra characters.
```
