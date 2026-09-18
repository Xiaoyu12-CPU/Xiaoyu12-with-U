# A10 工作中！ v1

- 日期：2026-09-18；唯一基准为用户确认的 [A06](a06-attention-v1.png)。
- 输出：[a10-working-laptop-v1.png](a10-working-laptop-v1.png)，200 × 200、RGBA 真透明 PNG，48,363 字节。
- 新增内容：下方银白色笔记本屏幕背面，居中放在胸前，保留完整脸部、颈部与领口，上方露出部分肩膀；背板中央为参考额头头饰的小熊 logo，现采用纯灰色、随背板透视压扁和收窄的样式。
- 当前范围（坐标含端点）：笔记本 x43–158、y167–193，最大宽 116 px、高 27 px；按后续要求由 89 × 21 宽高各放大 30% 后取整，底边 y193 不变，保留底部 6 px 透明边距。本轮明确放大要求更新了最初的肩宽上限。
- 方式：内置 image_gen 编辑 A06 得到候选；候选最近邻缩到 200 × 200 后，仅提取笔记本区域，将其从 89 × 26 调整为 89 × 21 并局部合成。人物未整体采用生成稿，所有未被笔记本遮挡的 A06 原像素保留。
- 原始候选：`exec-fb2b1497-b192-4a70-900e-9bc03b2430ae.png`，1254 × 1254，仅作生成源，不进入运行资源。
- 验证：当前相对 A06 共 3,044 个像素变化，均在上述笔记本范围；范围外 RGBA 逐像素一致。脸、表情、头顶感叹号及外侧头发均保持原样。PNG 解码回读无损，尺寸/透明度检查通过，完全透明像素隐藏 RGB 为 0；深浅背景检查未见新增白边或接缝。
- SHA-256：`95774ecc807a59f11e8c4f9249ca848459a91c7585b253f9ae99cb8ffcde1624`。
- A06 源文件 SHA-256：`cafe5841076f819456d501532c21e9cff48c96f7a7a56a5da8e4f05cb74ab39b`，未修改。
- 状态：已接入 working 第 1、3 帧，运行副本分别为 `src/assets/pets/default/working/laptop-001.png` 和 `laptop-003.png`；第 2 帧 `laptop-002.png` 对应下移动作差分 [A11](a11-working-laptop-down-v1.md)。内置与本机用户配置统一为 A10 → A11 → A10，120 / 120 / 160 ms、400 ms 连续循环。旧 working 的 `attention-001.png` 至 `attention-004.png` 保留供旧配置兼容，当前不再使用；alert 保持原配置。
- [动画预览](a01-a10-a11-a10-preview.gif) 保留为 A01 → A10 → A11 → A10 的转场预览；实际 working 循环不包含 A01。下一张独立画面使用 A12。


## 小熊标志下移 2 px（2026-09-18）

- 用户要求标志再往下一点，本次向下移动 2 px。
- 原 90 个 `#888888` 标志像素保持颜色、形状和透视，仅做整数位移 (0,+2)；新范围 x95–106、y177–187，12 × 11 px，中心 (100.5,182)。
- 空出的位置恢复未加 logo 的原银色背板，负形眼孔露出新位置背板。实际变化 56 个像素，全部在旧/新 logo 范围内；其他 RGBA 和全图 alpha 不变。
- 内置 image_gen 候选：`exec-18e65c5d-1ebc-413e-956e-286a9f464226.png`。最终按上述整数像素平移合成，保留原图，未使用候选整图重绘。

### 本轮内置 image_gen 提示词

```text
Use case: precise-object-edit. Edit the attached current A10 transparent 200×200 pixel-art sprite. Move ONLY the small gray bear logo on the laptop straight DOWN by exactly 2 logical pixels: its bounding box changes from x95–106, y175–185 to x95–106, y177–187. Preserve its exact size, silhouette, #888888 gray, negative-space eye holes, perspective and horizontal position. Restore the vacated logo area with the original silver laptop surface. Keep every other pixel unchanged, including the laptop edges, character, face, hair, accessories, exclamation mark and background alpha. No resizing, redrawing, new outlines or new objects.
```


## 纯灰与透视修订（2026-09-18）

- 用户要求：小熊图案随电脑背板的倒梯形角度产生透视变化，改为纯灰色。
- 内置 image_gen 候选：`exec-d3bdbde5-e5ef-4c10-8aa7-e39ffe390e3c.png`。
- 用未添加 logo 的背板原像素清除旧白色标志，仅提取新候选的小熊轮廓与负形眼孔。统一填充中性灰 `#888888`，共 90 个标志像素，取消白色填充、描边、渐变和阴影。
- 该次图案包围盒为 12 × 11 px，x95–106、y175–185（含端点），中心 (100.5,180)；相比旧 12 × 13 标志更扁。此后下移 2 px，最新位置见上方记录。
- 对候选轮廓做轻微投影采样：局部平面上宽 12 px、下宽 11 px、高 11 px，表现上宽下窄；取整数像素保持像素画边缘。背板实际主侧边约从 116 收窄到 110 px，因此采用克制的收窄而非夸张倾斜。
- 本轮相对旧白色 logo 版仅变化 112 个像素，范围 x95–106、y174–186；其中包含将旧标志上下多出的像素恢复为银色背板。其余 RGBA 与全图 alpha 不变。深浅背景检查通过。

### 本轮内置 image_gen 提示词

```text
Use case: precise-object-edit.
Edit target: the current A10 pixel-art desktop pet with the small white animal-head emblem centered on a silver laptop.
Make ONLY a local refinement to that laptop emblem. The silver laptop's visible back is a tilted inverted trapezoid: its top is slightly wider and its bottom narrower. The emblem must be printed/etched ON that same plane, rather than facing the camera independently.
Replace the current white outlined face logo with an understated SINGLE MEDIUM-GRAY bear-head emblem, using the same recognizable two-ear head silhouette as the original forehead animal ornament. Flat neutral gray around #858585, one ink/color only. Any tiny eyes/nose may be minimal negative-space cutouts showing the underlying silver surface, never black or white paint. No border, white interior, glow, bevel, gradient, or drop shadow on the mark. Premium subtle metallic etching aesthetic like a minimal laptop manufacturer emblem, without any actual brand or lettering.
Apply a modest projective transform matching the laptop: slightly foreshorten the emblem vertically and gently taper it toward the bottom. Preserve both ears and the recognizable head. Keep its visual center at logical pixel (100.5,180), with a footprint of roughly 12×10 to 12×11 pixels on the 200×200 canvas. The top of its local plane is a little wider than its bottom; avoid exaggerated skew or a large chunky sticker.
Everything else is absolutely locked: preserve laptop position, 116×27 size and existing trapezoid shape, silver colors and border; preserve character, exact face, hair, crown, forehead ornament, purple exclamation mark, clothing, background alpha, framing and scale. ONLY the tiny central logo area changes. Pixel art, transparent RGBA 200×200 layout.
```


## 居中小熊 logo 初版（2026-09-18）

- 用户要求：图案参考人物头上的白色小熊，电脑标识布局参考 MacBook Pro。
- 内置 image_gen 编辑当前 A10，候选为 `exec-4fb9ffe4-72d9-489d-8cff-c894c4312edf.png`。
- 仅提取候选的动物头徽标，裁去周围生成背板，以最近邻调整为 12 × 13 px，居中放在 x95–106、y174–186（含端点），中心 (100.5,180) 与原电脑背板一致。
- 图案为浅色动物头、简洁耳朵和细小深色五官；没有品牌文字或其他符号。
- 本轮相对放大版 A10 仅 110 个像素变化，均在 logo 范围内；全图 alpha 不变，人物和笔记本其余像素完全一致。PNG 仍为 200 × 200 RGBA，深浅背景检查通过。

### 本轮内置 image_gen 提示词

```text
Use case: precise-object-edit.
Edit target: the attached current A10 transparent pixel-art desktop pet.
Make ONE very small local addition: add a centered white/silver little bear-head emblem to the BACK of the silver laptop at the bottom. Use the white animal head ornament already attached to the character's black forehead sleep mask as the exact motif reference: same recognizable head/ear silhouette and tiny facial features. The user calls it a little bear. Preserve its cute identity and do not substitute an unrelated animal.
Design reference: the clean centered standalone emblem layout on a MacBook Pro lid, but using THIS character's small animal emblem instead of an Apple logo. Make it a subtle white/silver inset metal mark, minimal, compact, no lettering, no sticker border, no glow, no dark thick outline.
On the 200×200 logical pixel canvas, the laptop remains exactly x43–158, y167–193. Center the new emblem around x100, y180. Keep the entire emblem about 11 pixels wide and 12 pixels tall, well clear of the laptop edges. It should read as a small light-colored animal-head logo against the slightly darker silver laptop, with tiny restrained charcoal eye/nose pixels if needed. Match the sprite's crisp pixel-art grid.
Constraints: ONLY the new logo may change. Preserve the laptop dimensions, its position, silver shading and border. Preserve the whole character, facial expression, hair, crown, original forehead animal ornament, exclamation mark, pose, scale, framing and ALL original pixels outside the small emblem region. True transparent background, square 200×200 composition. No Apple symbol, no words, no additional objects.
```


## 笔记本放大 30%（2026-09-18）

- 用户指令：将笔记本背面放大 30%。
- 内置 image_gen 生成编辑候选，输出 `exec-6736709d-e4c4-4429-b6a8-b8ba72f7829b.png`。
- 最终为精确满足尺寸并保留人物原像素，提取初版 A10 的现有笔记本及轮廓掩膜，以最近邻将 89 × 21 放大到 116 × 27，底部居中合回 A06；未采用候选整图的其他区域重绘。
- 对初版 A10 共改变 3,007 个像素，均在当前笔记本边界内；其余像素相同。

### 本轮内置 image_gen 提示词

```text
Use case: precise-object-edit. Edit target: attached current A10 desktop pet sprite. Make ONLY the silver-white laptop back 30% larger in WIDTH AND HEIGHT. On the 200×200 logical pixel canvas the current laptop measures 89×21 pixels; the enlarged laptop should measure approximately 116×27 pixels, located x43–158 and y167–193 inclusive. Keep its bottom edge at the same y193 and horizontally centered. This new explicit size supersedes the previous shoulder-width limit. Preserve the same plain silver-white aluminum surface, gray thin border, stepped rounded corners and pixel style, with no logo or text. Enlarge the existing laptop rather than designing a different laptop. Do not move, scale, redraw or recolor the character or purple exclamation mark. The entire face and collar remain visible. Preserve every pixel outside the laptop edit region exactly, including original transparent background. Only laptop size changes; no extra hands, accessories, outlines or shadows. True RGBA transparent 200×200 layout.
```


## 初版内置 image_gen 提示词

```text
Use case: precise-object-edit.
Asset type: A10, a transparent pixel-art sprite for an existing desktop pet.
Input image 1 is the edit target A06, a 200×200 RGBA sprite. Preserve its exact framing, proportions, expression, position, colors, hair, accessories, clothes, and purple exclamation mark.
Primary request: Add ONLY the visible silver-white rear of a small open laptop in front of the LOWER TORSO, so she looks like she is working. The viewer sees the back of the laptop screen, never its keyboard or display. This is a partial laptop cropped by the character's lower edge.
Placement on the 200×200 logical pixel grid: laptop occupies roughly x56–144 and y173–193. Center it on the torso. Its maximum width is 89 logical pixels, narrower than the shoulders (shoulders span roughly x53–147). The top of the laptop sits BELOW the collar and BELOW the tops of the shoulders, leaving about 8–10 logical pixels of both shoulders visible above it. The entire face, chin, neck, and collar must remain visible.
Laptop appearance: plain silver-white aluminum back, subtle cool-gray pixel shading, a thin gray edge, small stepped pixel corner rounding. Simple, recognizable laptop silhouette in the SAME pixel scale as the character. No logos, symbols, lettering, stickers, or extra decorations. No hands added.
Constraints: Only the laptop occludes the lower clothing. The eyes and centered small o mouth stay EXACTLY unchanged. Keep the purple exclamation mark exactly as in A06; do not add the words "working" or "工作中". Do not enlarge, move, redraw, outline, blur, smooth, or recolor the character. Keep all outside regions unchanged. Genuinely transparent background, not white, black, or checkerboard. Square composition, preserve 200×200 pixel-art layout.
```
