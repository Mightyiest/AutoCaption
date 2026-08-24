# Implementation Plan: 1:1 Visual Fidelity & Animation Sync (Preview to Export)

Fix the visual, positioning, font weight, and animation discrepancies between the web previewer and the exported video.

## Problem Analysis

| Aspect | Web Preview (Image 1) | Previous Export (Image 2) | Root Cause |
|---|---|---|---|
| **Active Word Highlight** | Active word ("0") is bright yellow `#FFE600`, non-active words are white `#FFFFFF` | All words are white | `{\k}` karaoke tag does not apply per-word override colors in standard ASS without timed event splits |
| **Motion Animations** | Active word pops / scales up (`anim-pop` / `anim-bounce`) | Static text, zero motion | `\k` does not support CSS keyframe scale/transforms |
| **Positioning** | Positioned at exact `top: 22%` (`positionY: 22`) centered | Positioned at bottom margin | `MarginV` bottom-anchored alignment instead of exact `\pos(X, Y)\an5` center-anchored coordinates |
| **Font Family & Weight** | Bold/Black heavy Montserrat typeface | Fallback to regular/thin sans-serif | Variable font TTF file had "Thin" as default instance in the name table |
| **Layout & Wrapping** | 2-line wrap: "AND" / "FLEXIBLE 0" | Single continuous horizontal line | ASS Dialogue events lacked explicit line-wrapping logic |
| **Stroke & Outline** | Clean, proportional outline | Overly thick black block outline | ASS border style outline factor needed precise glyph-ratio scaling |

---

## Proposed Technical Solution

### 1. Download True Static TTF Fonts (Black / ExtraBold / Bold)
- Download static (non-variable) TrueType font files directly from Google Fonts repository:
  - `Montserrat-Black.ttf` (Static 900 weight)
  - `RussoOne-Regular.ttf` (Static Display)
  - `Outfit-ExtraBold.ttf` (Static 800 weight)
  - `BebasNeue-Regular.ttf` (Static 700 Condensed)
  - `Bangers-Regular.ttf` (Static Comic)
  - `PlusJakartaSans-Bold.ttf` (Static 700 weight)
- Embed the exact font name (`Montserrat`, `Russo One`, `Outfit`, etc.) in the ASS script with `-fontsdir`.

### 2. Timed Multi-Event ASS Animation Engine
Generate individual, synchronized Dialogue events for each active word interval in every segment:

For segment words: `[("AND", 16.5-16.8), ("FLEXIBLE", 16.8-17.4), ("0", 17.4-18.0)]`:
- **Interval 1 (16.50s - 16.80s)**:
  - "AND" -> `{\c&H00E6FF&\fscx118\fscy118\t(0,100,\fscx108\fscy108)}AND{\r}` (Yellow + Pop Scale)
  - "FLEXIBLE" -> `{\c&HFFFFFF&}FLEXIBLE{\r}` (White)
  - "0" -> `{\c&HFFFFFF&}0{\r}` (White)
- **Interval 2 (16.80s - 17.40s)**:
  - "AND" -> `{\c&HFFFFFF&}AND{\r}` (White)
  - "FLEXIBLE" -> `{\c&H00E6FF&\fscx118\fscy118\t(0,100,\fscx108\fscy108)}FLEXIBLE{\r}` (Yellow + Pop Scale)
  - "0" -> `{\c&HFFFFFF&}0{\r}` (White)
- **Interval 3 (17.40s - 18.00s)**:
  - "AND" -> `{\c&HFFFFFF&}AND{\r}` (White)
  - "FLEXIBLE" -> `{\c&HFFFFFF&}FLEXIBLE{\r}` (White)
  - "0" -> `{\c&H00E6FF&\fscx118\fscy118\t(0,100,\fscx108\fscy108)}0{\r}` (Yellow + Pop Scale)

### 3. Absolute Coordinate Positioning (`\an5` + `\pos(X, Y)`)
- In CSS: `top: ${style.positionY}%`, `left: ${style.positionX}%` with `transform: translate(-50%, -50%)`.
- In ASS:
  ```ass
  \an5\pos(posX, posY)
  ```
  Where:
  - `posX = int(video_width * (style.get("positionX", 50) / 100.0))`
  - `posY = int(video_height * (style.get("positionY", 74) / 100.0))`
  - `\an5` centers the text box both horizontally and vertically around `(posX, posY)`.

### 4. Smart Line Wrapping
- In web preview, segments with 3+ words or exceeding container width wrap into balanced lines (e.g. 2 words per line).
- We will apply identical word wrapping with `\N` in ASS so multi-word captions stack identically to the preview.

### 5. Proportional Stroke & Shadow Calibration
- Calibrate `ass_stroke_width = int(round(style.strokeWidth * (video_width / 310.0) * 0.45))`
- Calibrate `ass_shadow = int(round(style.shadowBlur * (video_width / 310.0) * 0.20))`
- Match font size `ass_font_size = int(round(style.fontSize * (video_width / 310.0) * 0.95))`

---

## Files to Modify

1. `backend/download_fonts.py` [NEW]:
   - Downloads authentic static TTF bold weights for all 6 preset fonts into `backend/storage/fonts/`.
2. `backend/renderer.py` [MODIFY]:
   - Implement `generate_animated_ass_events()` with per-word timed dialogue intervals, `\an5\pos(X,Y)` positioning, `\fscx` scale animation, and exact color tagging.
3. `frontend/src/engine/animator.js` [MODIFY]:
   - Ensure word splitting and line break heuristics in frontend match the backend formatter.

---

## Verification Plan

### Automated Tests
1. Run `download_fonts.py` and inspect font name tables to confirm `Montserrat Black`, `Outfit Bold`, `Plus Jakarta Sans Bold` are recognized.
2. Render a 5-second test video with 3-word segment and verify:
   - Yellow active word color on word "0"
   - Scale pop animation on active word
   - `\pos(X, Y)` placement matching `positionY: 22`
   - 2-line layout matching preview

### Manual Verification
- Load the user's video in the studio, position at `22%`, apply Hormozi preset, and export.
- Compare side-by-side screenshot of preview vs exported video at timestamp 0:17 to verify 1:1 match.
