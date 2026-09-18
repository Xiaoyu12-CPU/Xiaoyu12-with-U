# A02 / A03 白边清理

- 日期：2026-09-16。
- A02：[normal-002.png](../../../src/assets/pets/default/idle/normal-002.png)，200 × 200，53,088 字节。
- A03：[normal-003.png](../../../src/assets/pets/default/idle/normal-003.png)，200 × 200，55,132 字节。
- 两张均为 RGBA PNG，透明度保留 0 / 255。
- 分别清理 146 / 231 个边缘像素，覆盖马尾外缘白线、发丝间隙灰白杂点以及头顶明显中性白色残留。其他像素逐字节保持原样。
- 半闭眼/闭眼笑、脸部、皇冠、兔子、衣领、发带及头发正常高光保持不变。
- 制作方式：每张使用一次内置 image_gen，清理稿缩回 200 × 200 后仅合入核查过的边缘区域；未采用整图重绘。已作深浅背景目视对照和逐像素修改范围校验。
- 已原位替换项目 PNG，并确认运行中的开发 HTTP 服务返回与新文件相同的字节。
- 编辑器同时修复：载入草稿时清除旧尺寸显示，重新读取 `naturalWidth / naturalHeight`；尺寸变化不计入 dirty 状态，不修改帧顺序、时长或循环配置。

## 内置 image_gen 提示词

两图共用以下提示词；A02 追加“保留半闭眼和平静微笑”，A03 追加“保留弯曲闭眼笑和微笑”。

```text
Precise local edge cleanup for this transparent pixel-art desktop-pet sprite. Remove only the white/light-gray matte residue along the outside of the dark twin tails and in transparent gaps between hair strands, especially the thin nearly vertical pale line at the far left ponytail. Also remove isolated neutral gray/white specks bordering the dark hair silhouette, including the top hair silhouette where they are clearly leftover cutout artifacts. Use genuine alpha transparency in the cleared gaps and the adjacent original dark hair color where a continuous dark hair contour is needed. Preserve intentional colored highlights on the purple crown, purple ribbons and inside the black hair. Preserve the white bunny decoration, skin, collar, black neck bow, all facial details, expression, pose, silhouette, size, exact composition and pixel style. Change only this edge contamination; do not redraw or beautify the character. Keep the same 200x200 square canvas and true transparent background. No white outline, no background or checkerboard.
```
