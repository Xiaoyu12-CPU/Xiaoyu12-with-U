# A01 发丝边缘清理

- 日期：2026-09-16。
- 更新：`src/assets/pets/default/idle/normal-001.png` 与其相同副本 `normal-004.png`。
- 规格：200 × 200，RGBA 真透明，每张 49,710 字节。
- 修改范围：74 个发丝边缘或透明发丝间隙中的浅灰残留像素。皇冠、兔子、发带、衣领、脸部和头发内部高光保持原像素。
- 方式：内置 image_gen 生成边缘清理稿；缩小到原画布后，仅合入已核查的 74 个位置，其他 39,926 个像素逐字节保留。低 alpha 残留归零，其余修正不增加原像素不透明度。
- 验证：深浅背景放大对照；逐像素核对修改范围；001/004 文件完全相同。慌张预览同步换用清理后的 A01。
- 旧版 A01 可从 Git 基线 `61c3ad8` 恢复。

## 内置 image_gen 提示词

```text
Precise transparent pixel-art edge cleanup of this existing A01 sprite. Remove ONLY stray white/light-gray matte contamination bordering the dark hair and twin tails: the isolated pale dots, thin pale streaks along the two ponytail outer edges and the cutout gaps between hair strands. Replace these unwanted fringe pixels with genuine transparency or the immediately adjacent dark hair edge color where needed to preserve the silhouette. Preserve ALL intentional highlights: lavender crown, purple ribbons, white bunny decoration on black sleep mask, eyes, skin, collar, neck bow, and interior purple hair shading. Keep the exact same character, calm open-eyed expression, pose, composition, proportions, pixel grid, scale, placement and transparent background. No smoothing, no new outlines, no redesign, no changes to the face or outfit. Output a clean transparent PNG sprite on the same 200x200 canvas. Hair edges should read naturally dark on both black and white backgrounds, without white fringe. No background, checkerboard, text or border.
```
