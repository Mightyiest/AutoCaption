Below is a strong, production-grade implementation plan for fixing the preview/export rendering mismatch.

---

# Implementation Plan: Preview-to-Export Caption Parity Fix

## 1. Primary Goal

Make the browser preview the **single source of truth** for layout, and make the FFmpeg/libass export a **faithful reproduction of measured DOM geometry**.

The export engine should stop trying to “re-layout” subtitles using ASS text flow. Instead, it should place words using measured preview coordinates.

### Definition of Done

The fix is complete when:

1. Stroke width in export visually matches preview.
2. Shadows render correctly even when `strokeWidth: 0`.
3. Multi-line captions do not drift vertically.
4. Active-word pop/bounce animations do not horizontally stretch or reflow surrounding words.
5. Preset thumbnails render cleanly.
6. Export payload contains deterministic layout metrics.
7. Automated golden-frame tests can prove parity.

---

# 2. Root Causes and Strategic Fixes

| Problem | Root Cause | Required Fix |
|---|---|---|
| Stroke inflation / letters fusing | CSS `-webkit-text-stroke` with `paint-order: stroke fill` exposes only about half the stroke outward, while ASS `Outline` expands outward. Also synthetic bold may thicken glyphs. | Keep the 50% stroke conversion, remove synthetic bold on heavy fonts, map fonts correctly, and visually calibrate stroke. |
| Missing shadows when `strokeWidth: 0` | ASS shadow is disabled because style `Shadow` is 0 and `\xshad0\yshad0` is used. `\rBaseStyle` may also reset overrides. | Render shadow as a separate underlay layer, independent from outline. Remove dependence on `\xshad0\yshad0`. |
| Multi-line vertical drift | Measurement uses `offsetTop` / `offsetHeight`, ignores caption padding, uses integer values, and scales Y using width scale. | Use fractional `getBoundingClientRect()` values, measure the actual caption outer box including padding, and scale Y using vertical scale. |
| Active word stretching / layout shift | ASS line-level `\fscx`/`\fscy` changes line metrics, causing reflow/spacing shifts. | Render words as absolutely positioned ASS tokens using measured word boxes. Active transforms should not affect layout. |
| Broken preset thumbnails | Preset objects contain invalid keys/values and thumbnail container can clip stroked text. | Normalize presets, fix syntax/typos, and add safe thumbnail layout styles. |
| Font mismatch / faux bold | Font name map contains trailing spaces and uses generic bold flags. | Normalize font mapping, use exact font family/file names, and suppress synthetic bold on heavy fonts. |

---

# 3. Recommended Architecture Change

## Current Weak Architecture

Right now, the export pipeline mostly does:

```txt
React preview measures line indexes
        ↓
Backend receives measured_lines
        ↓
libass re-centers each line
        ↓
libass lays out words inside the line
        ↓
Active word scale changes line layout
```

This leaves too much layout responsibility to libass.

---

## New Target Architecture

```txt
React preview measures:
  - caption outer box
  - content box
  - each line
  - each word bounding box
        ↓
Export payload includes measured_word_boxes
        ↓
renderer.py converts each word center to ASS coordinates
        ↓
Each word becomes an absolutely positioned ASS Dialogue
        ↓
Active animation transforms only that word
        ↓
Shadow is rendered as a separate lower layer
```

This is the strongest fix because it prevents libass from making independent layout decisions.

---

# 4. Phased Implementation Plan

---

## Phase 0: Create a Parity Test Harness

Before changing rendering logic, create a repeatable way to compare preview and export.

### 0.1 Choose Test Cases

Use these presets:

1. `hormozi` — heavy stroke, yellow active word, pop animation.
2. `beast` — heavy stroke, bounce animation.
3. `neon` — glow/shadow-heavy karaoke style.
4. `minimal` — `strokeWidth: 0`, background padding, fade animation.
5. Custom style:
   - `strokeWidth: 0`
   - `shadowBlur: 12`
   - `shadowColor: #000000`
   - `animationType: pop`

Use these aspect ratios:

1. `9:16` — 310x550 preview, 1080x1920 export.
2. `1:1` — 420x420 preview, 1080x1080 export.
3. `16:9` — 540x304 preview, 1920x1080 export.

Use these caption cases:

1. Single word.
2. Two words.
3. Three words wrapping onto two lines.
4. Four words wrapping onto two or three lines.
5. Long word near edge.
6. Segment with gaps between word timings.
7. `backgroundPadding > 0`.

---

### 0.2 Capture Preview Frames

Use Playwright or Puppeteer to:

1. Load the editor.
2. Apply a preset.
3. Seek video to the middle of an active word.
4. Screenshot the caption container or full preview viewport.

Store as:

```txt
tests/golden/preview/{case}.png
```

---

### 0.3 Capture Export Frames

After export, extract the frame at the same timestamp:

```bash
ffmpeg -ss {time} -i exported.mp4 -frames:v 1 export_frame.png
```

Store as:

```txt
tests/golden/export/{case}.png
```

---

### 0.4 Compare Images

Use one of:

1. SSIM.
2. Pixel diff around caption crop.
3. Manual side-by-side debug grid.

Recommended acceptance thresholds:

- Word vertical center error: less than 2 export pixels.
- Stroke visual thickness error: less than 1 export pixel.
- Shadow visible whenever preview shadow is visible.
- No word overlap/fusion caused by excessive outline.
- SSIM caption crop: at least 0.90 after calibration.

---

### 0.5 Add Debug Outputs

During export, save:

1. Incoming JSON payload.
2. Generated `.ass` file.
3. Measured word boxes.
4. Preview metrics.
5. Final FFmpeg command.

Recommended temporary files:

```txt
storage/debug/render_{job_id}_payload.json
storage/debug/render_{job_id}_subtitle.ass
storage/debug/render_{job_id}_metrics.json
```

This is critical for diagnosing libass behavior.

---

# Phase 1: Fix Blocking Data and Code Hygiene Issues

Some issues in the current codebase can interfere with all later fixes.

---

## 1.1 Normalize `presets.js`

The preset file should be cleaned and normalized.

### Required Fixes

1. Fix invalid or corrupted property names:
   - `textT ransform` → `textTransform`
   - `activeCol or` → `activeColor`
   - `sty le` → `style`
   - `maxWordsPerSegm ent` → `maxWordsPerSegment`

2. Fix invalid values:
   - `'Montse rrat'` → `'Montserrat'`
   - `'transparen t'` → `'transparent'`
   - `'Plus Jakarta Sans '` → `'Plus Jakarta Sans'`

3. Add a preset sanitizer.

Example shape:

```js
const DEFAULT_STYLE = {
  fontFamily: 'Montserrat',
  fontSize: 34,
  fontWeight: '900',
  textTransform: 'uppercase',
  primaryColor: '#FFFFFF',
  activeColor: '#FFE600',
  strokeColor: '#000000',
  strokeWidth: 0,
  shadowColor: '#000000',
  shadowBlur: 0,
  backgroundColor: 'transparent',
  backgroundPadding: 0,
  borderRadius: 0,
  positionX: 50,
  positionY: 74,
  animationType: 'pop',
  maxWordsPerSegment: 3,
};
```

Add:

```js
export function sanitizeStyle(style = {}) {
  return {
    ...DEFAULT_STYLE,
    ...style,
    fontSize: Number(style.fontSize || DEFAULT_STYLE.fontSize),
    strokeWidth: Number(style.strokeWidth ?? DEFAULT_STYLE.strokeWidth),
    shadowBlur: Number(style.shadowBlur ?? DEFAULT_STYLE.shadowBlur),
    backgroundPadding: Number(style.backgroundPadding ?? DEFAULT_STYLE.backgroundPadding),
    positionX: Number(style.positionX ?? DEFAULT_STYLE.positionX),
    positionY: Number(style.positionY ?? DEFAULT_STYLE.positionY),
  };
}
```

Use this in:

- `useEditorStore.js`
- `ExportModal.jsx`
- `StyleInspector.jsx`

---

## 1.2 Fix Python Path Bug

Current code appears to use:

```py
FONTS_DIR = os.path.join(os.path.dirname(os.path.abspath(file)), "storage", "fonts")
```

This should be:

```py
FONTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage", "fonts")
```

Same for `app.py`:

```py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
```

---

## 1.3 Normalize Font Mapping

Current font map may contain trailing spaces or mismatched keys.

Use exact names:

```py
FONT_NAME_MAP = {
    "Montserrat": "Montserrat Black",
    "Russo One": "Russo One",
    "Outfit": "Outfit ExtraBold",
    "Bebas Neue": "Bebas Neue",
    "Bangers": "Bangers",
    "Plus Jakarta Sans": "Plus Jakarta Sans ExtraBold",
    "Inter": "Montserrat Black",
}
```

Then normalize incoming font family:

```py
raw_font_family = str(style.get("fontFamily", "Montserrat")).strip()
font_family = FONT_NAME_MAP.get(raw_font_family, raw_font_family)
```

---

## 1.4 Fix Synthetic Bold Handling

Do not apply ASS bold to fonts that are already heavy.

Use explicit detection:

```py
HEAVY_FONT_KEYWORDS = [
    "black",
    "extrabold",
    "bold",
    "russo",
    "bangers",
    "bebas",
]

font_family_lower = font_family.lower()
is_heavy_font = any(keyword in font_family_lower for keyword in HEAVY_FONT_KEYWORDS)

ass_bold_flag = 0 if is_heavy_font else -1
```

For maximum safety, prefer:

```py
ass_bold_flag = 0
```

if the mapped font file is already the intended heavy weight.

---

## 1.5 Fix Color Conversion

The ASS color helper should support:

1. `#RGB`
2. `#RRGGBB`
3. `#RRGGBBAA`
4. `rgba(...)`
5. `transparent`

Important ASS behavior:

- ASS alpha is inverted compared to CSS.
- ASS `00` = opaque.
- ASS `FF` = fully transparent.

Recommended implementation logic:

```py
def hex_to_ass_color(hex_str: str, alpha_hex: str = "00") -> str:
    if not hex_str:
        return f"&H{alpha_hex}FFFFFF&"

    value = str(hex_str).strip()

    if value.lower() == "transparent":
        return "&HFF000000&"

    value = value.lstrip("#")

    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)

    if len(value) == 8:
        r = value[0:2]
        g = value[2:4]
        b = value[4:6]
        a = value[6:8]
        ass_alpha = f"{255 - int(a, 16):02X}"
        return f"&H{ass_alpha}{b.upper()}{g.upper()}{r.upper()}&"

    if len(value) != 6:
        return f"&H{alpha_hex}FFFFFF&"

    r = value[0:2].upper()
    g = value[2:4].upper()
    b = value[4:6].upper()

    return f"&H{alpha_hex}{b}{g}{r}&"
```

This fixes the dangerous `transparent` conversion issue.

---

## 1.6 Escape ASS Text

Words may contain braces or backslashes. ASS treats braces as override blocks.

Add:

```py
def escape_ass_text(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
            .replace("{", "\\{")
            .replace("}", "\\}")
    )
```

Use this for every rendered word.

---

# Phase 2: Upgrade `layoutMeasurer.js`

This is the most important frontend change.

---

## 2.1 New Measurement Goal

The measurer must return enough data for the backend to place every word absolutely.

It should return:

```json
{
  "measured_lines": [[0, 1], [2, 3]],
  "measured_line_offsets": [-22.5, 22.5],
  "measured_word_boxes": [
    {
      "index": 0,
      "line": 0,
      "center_x": -58.2,
      "center_y": -22.5,
      "width": 68.4,
      "height": 39.1
    }
  ]
}
```

Coordinates should be relative to the **caption outer box center**.

---

## 2.2 Replicate the Real Caption Outer Box

The current measurer only replicates the inner text container.

It must also replicate:

```jsx
width: '90%'
padding: style.backgroundPadding
boxSizing: 'border-box'
textAlign: 'center'
```

Why this matters:

- `backgroundPadding` changes available text width.
- Padding changes the visual caption box center.
- Multi-line vertical alignment depends on the outer caption box, not just the text container.

### New DOM structure

```txt
measurement host
  caption outer box
    text container
      word span
      word span
      word span
```

### Outer box styles

```js
outer.style.width = `${Math.floor(previewWidth * 0.9)}px`;
outer.style.boxSizing = 'border-box';
outer.style.textAlign = 'center';
outer.style.padding = style.backgroundPadding
  ? `${style.backgroundPadding}px`
  : '0px';
```

### Inner text container styles

```js
inner.style.width = '100%';
inner.style.fontFamily = style.fontFamily || 'Montserrat';
inner.style.fontSize = `${style.fontSize || 34}px`;
inner.style.fontWeight = style.fontWeight || '900';
inner.style.lineHeight = '1.15';
inner.style.textTransform = style.textTransform || 'uppercase';
inner.style.letterSpacing = style.fontFamily === 'Bebas Neue' ? '1px' : '-0.5px';
inner.style.textAlign = 'center';
inner.style.whiteSpace = 'normal';
```

---

## 2.3 Use Fractional `getBoundingClientRect()`

Do not rely on:

```js
span.offsetTop
span.offsetHeight
```

Use:

```js
const outerRect = outer.getBoundingClientRect();
const spanRect = span.getBoundingClientRect();
```

Compute word center:

```js
const centerX =
  spanRect.left + spanRect.width / 2 -
  (outerRect.left + outerRect.width / 2);

const centerY =
  spanRect.top + spanRect.height / 2 -
  (outerRect.top + outerRect.height / 2);
```

Return fractional values.

Do not round them in the payload.

---

## 2.4 Group Lines Using Rect Tops

Group words into lines using `spanRect.top`.

Recommended logic:

```js
const lineTolerance = 2.0;

let lines = [];

for (const spanInfo of spanInfos) {
  const top = spanInfo.rect.top;

  let line = lines.find(
    (l) => Math.abs(l.top - top) <= lineTolerance
  );

  if (!line) {
    line = {
      top,
      indices: [],
      rects: []
    };
    lines.push(line);
  }

  line.indices.push(spanInfo.index);
  line.rects.push(spanInfo.rect);
}
```

Sort lines by `top`.

Compute line offset:

```js
const lineCenter =
  averageRectTop + averageRectHeight / 2 -
  (outerRect.top + outerRect.height / 2);
```

---

## 2.5 Load Fonts Before Measuring

`document.fonts.ready` is not always enough.

Load the actual font being used:

```js
if (document.fonts?.load) {
  const fontWeight = style.fontWeight || '900';
  const fontFamily = style.fontFamily || 'Montserrat';
  const fontSize = style.fontSize || 34;

  await Promise.all([
    document.fonts.load(`${fontWeight} ${fontSize}px ${fontFamily}`, 'ABCabc123'),
    document.fonts.ready
  ]);
}
```

This prevents measuring fallback font metrics.

---

## 2.6 New Payload Metrics

`preview_metrics` should include:

```js
{
  version: 2,
  container_width: previewWidth,
  container_height: previewHeight,
  caption_outer_width: outerRect.width,
  caption_outer_height: outerRect.height,
  caption_content_width: outer.clientWidth,
  background_padding: style.backgroundPadding || 0,
  box_width: previewWidth * 0.9,
  font_size: style.fontSize,
  stroke_width: style.strokeWidth,
  shadow_blur: style.shadowBlur,
  position_x: style.positionX,
  position_y: style.positionY
}
```

---

## 2.7 Fix the Logging Bug

Current logger uses:

```js
const scaledStrokeWidth = Math.round(((style.strokeWidth || 6) / 2) * scale);
```

This incorrectly treats `strokeWidth: 0` as `6`.

Change to:

```js
const strokeWidth = style.strokeWidth ?? 0;
const scaledStrokeWidth = Math.round((strokeWidth / 2) * scale);
```

---

# Phase 3: Rewrite `renderer.py` to Use Absolute Word Placement

This is the core export fix.

---

## 3.1 Do Not Let ASS Lay Out Words

The current renderer uses:

```py
line_str = "   ".join(tokens)
```

This is fragile.

Remove the three-space hack.

Instead, place each word using measured coordinates.

---

## 3.2 Compute Separate X and Y Scale

Do not use width scale for vertical offsets.

Use:

```py
scale_x = video_width / float(preview_metrics["container_width"])
scale_y = video_height / float(preview_metrics["container_height"])
```

For matching aspect ratios, these will be almost identical.

For safety, use a uniform scale for font/stroke:

```py
uniform_scale = min(scale_x, scale_y)
```

Use:

- `scale_x` for horizontal word positions.
- `scale_y` for vertical word positions.
- `uniform_scale` for font size, stroke, spacing, and animation displacement.

---

## 3.3 Convert Word Boxes to ASS Coordinates

Given:

```py
pos_x = video_width * positionX / 100
pos_y = video_height * positionY / 100
```

For each measured word box:

```py
word_x = int(round(pos_x + box["center_x"] * scale_x))
word_y = int(round(pos_y + box["center_y"] * scale_y))
```

Use `\an5` and `\pos(word_x,word_y)` for every word.

This centers each word exactly where the preview measured it.

---

## 3.4 Generate Word Display Intervals

The current renderer only shows each word from its own `start` to `end`.

That can create gaps between words.

Use continuous display intervals.

Example:

```py
def get_word_display_intervals(segment):
    words = segment.get("words", [])
    seg_start = float(segment.get("start", 0.0))
    seg_end = float(segment.get("end", seg_start))

    intervals = []

    for i, word in enumerate(words):
        word_start = max(seg_start, float(word.get("start", seg_start)))

        if i + 1 < len(words):
            next_start = float(words[i + 1].get("start", word_start))
            word_end = min(seg_end, next_start)
        else:
            word_end = seg_end

        if word_end <= word_start:
            fallback_duration = max(0.2, float(word.get("end", word_start + 0.25)) - word_start)
            word_end = word_start + fallback_duration

        word_end = min(seg_end, word_end)

        intervals.append({
            "active_index": i,
            "start": word_start,
            "end": word_end
        })

    return intervals
```

This ensures captions do not disappear between word timings.

---

## 3.5 Create Two ASS Styles

Use separate styles for main text and shadow.

### Main style

```txt
Style: MainStyle,{font_family},{font_size},{primary_color},{active_color},{stroke_color},{shadow_color},{bold_flag},0,0,0,100,100,{spacing},0,1,{stroke_width},0,5,0,0,0,1
```

### Shadow style

```txt
Style: ShadowStyle,{font_family},{font_size},{shadow_color},{shadow_color},{shadow_color},{shadow_color},0,0,0,0,100,100,{spacing},0,1,0,0,5,0,0,0,1
```

Important:

- Main style has outline.
- Shadow style has no outline.
- Shadow style has no ASS shadow field.
- Shadow is drawn as actual text on a lower layer.

This avoids the `strokeWidth: 0` shadow bug.

---

## 3.6 Render Shadow as a Separate Underlay Layer

For every display interval and every word:

1. Render a shadow word at Layer 0.
2. Render main text at Layer 1 or Layer 2.

Recommended layering:

```txt
Layer 0: shadow
Layer 1: inactive words
Layer 2: active word
```

This ensures the active word appears above neighboring words if it scales up.

---

## 3.7 Shadow Placement and Blur

The preview currently uses:

```css
text-shadow: 0 4px ${style.shadowBlur}px ${style.shadowColor};
```

So export should match that unless the product intentionally wants a pure glow.

Use:

```py
shadow_offset_y_preview = 4.0
shadow_y = int(round(shadow_offset_y_preview * scale_y))
```

Blur mapping can start as:

```py
ass_blur = max(0.0, round(raw_shadow * 0.35, 1))
```

This is close to the current mapping:

```py
(raw_shadow / 8.0) * 3.0
```

but easier to calibrate.

Example shadow dialogue:

```txt
Dialogue: 0,{start},{end},ShadowStyle,,0,0,0,,{\an5\pos({x},{y_plus_shadow})\blur{ass_blur}\fsp{spacing}}{word}
```

If the active word is animated, apply the same scale animation to the shadow word so the shadow stays attached.

---

## 3.8 Remove `\rBaseStyle`

The current renderer uses:

```ass
{\rBaseStyle}
```

inside tokens.

This can reset line-level overrides such as blur/shadow and creates fragile state transitions.

With absolute word dialogues, `\r` is unnecessary.

Each word dialogue should be self-contained.

---

## 3.9 Stroke Calculation

Keep the 50% conversion:

```py
raw_stroke = float(style.get("strokeWidth", 0))

if raw_stroke <= 0:
    ass_stroke_width = 0
else:
    ass_stroke_width = max(1, int(round((raw_stroke / 2.0) * uniform_scale)))
```

This prevents invisible stroke when the scaled value is tiny.

---

## 3.10 Letter Spacing

Use scaled CSS letter spacing.

Preview currently uses:

```js
letterSpacing: fontFamily === 'Bebas Neue' ? '1px' : '-0.5px'
```

So:

```py
css_letter_spacing = 1.0 if raw_font_family == "Bebas Neue" else -0.5
ass_spacing = int(round(css_letter_spacing * uniform_scale))
```

Use:

```ass
\fsp{ass_spacing}
```

in every word dialogue.

---

## 3.11 Text Casing

Apply the same casing as preview:

```py
text_transform = str(style.get("textTransform", "uppercase")).strip().lower()

def transform_word(raw_text: str) -> str:
    raw_text = raw_text.strip()

    if text_transform == "uppercase":
        return raw_text.upper()
    if text_transform == "capitalize":
        return raw_text.capitalize()
    if text_transform == "lowercase":
        return raw_text.lower()

    return raw_text
```

Then escape:

```py
word_txt = escape_ass_text(transform_word(raw_word))
```

---

# Phase 4: Fix Active Word Animation Rendering

---

## 4.1 Problem With Current Active Animation

Current renderer applies:

```ass
\fscx106\fscy106
```

inside a line.

That changes the line’s width and can shift or stretch surrounding layout.

---

## 4.2 New Animation Strategy

Because each word is absolutely positioned:

- active scaling no longer changes line layout.
- surrounding words stay fixed.
- word center remains anchored.
- no `\fsp` compensation is needed for layout stability.

---

## 4.3 Animation Tag Builder

Create a helper:

```py
def build_animation_tags(anim_type: str, duration_ms: int, org_x: int, org_y: int) -> str:
    duration_ms = max(80, int(duration_ms))

    if anim_type == "pop":
        t1 = min(80, int(duration_ms * 0.5))
        t2 = min(160, duration_ms)

        return (
            f"\\fscx90\\fscy90"
            f"\\t(0,{t1},\\fscx118\\fscy118)"
            f"\\t({t1},{t2},\\fscx108\\fscy108)"
        )

    if anim_type == "bounce":
        t1 = min(80, int(duration_ms * 0.4))
        t2 = min(160, duration_ms)

        return (
            f"\\org({org_x},{org_y})"
            f"\\fscx96\\fscy96\\frz-1.5"
            f"\\t(0,{t1},\\fscx112\\fscy112\\frz1.5)"
            f"\\t({t1},{t2},\\fscx104\\fscy104\\frz0)"
        )

    if anim_type == "karaoke":
        return "\\fscx102\\fscy102"

    # fade or unsupported
    return ""
```

For active word dialogue:

```ass
{\an5\pos(x,y)\fsp{spacing}\c{active_color}{animation_tags}}WORD
```

For inactive word dialogue:

```ass
{\an5\pos(x,y)\fsp{spacing}\c{primary_color}}WORD
```

---

## 4.4 Motion Parity Note

CSS animations and ASS animations will never be mathematically identical.

The target should be:

- same anchor point,
- same approximate scale,
- same approximate timing,
- no layout reflow,
- no aspect distortion.

If exact motion parity is required later, use headless Chromium frame overlays instead of libass.

---

# Phase 5: Fix Multi-Line Vertical Alignment

---

## 5.1 Use Outer Caption Box Center

The preview caption overlay is positioned using:

```jsx
top: `${style.positionY}%`,
left: `${style.positionX}%`,
transform: 'translate(-50%, -50%)'
```

That means the exported `pos_y` corresponds to the caption outer box center.

Therefore, measured offsets must be relative to the outer caption box center, including padding.

Do not measure only the inner text container.

---

## 5.2 Use Vertical Scale for Y Offsets

Current logic:

```py
pos_y + measured_offset * scale
```

should become:

```py
pos_y + measured_offset * scale_y
```

---

## 5.3 Do Not Use Fallback Line Height When Measured Boxes Exist

Use fallback only when measurement data is missing.

Recommended fallback:

```py
fallback_line_h = ass_font_size * 1.15
```

not `1.05`.

But fallback should be rare.

---

# Phase 6: Fix `ExportModal.jsx` and Backend Contract

---

## 6.1 Export Modal Should Send Measurement Version

Update payload:

```js
const { segments: measuredSegments, preview_metrics } = await measureAllSegmentsLayout(
  segments,
  style,
  previewDims.width,
  previewDims.height
);
```

Ensure payload includes:

```js
{
  video_filename,
  segments: measuredSegments,
  style,
  width,
  height,
  video_duration,
  encoder_mode,
  preview_metrics: {
    ...preview_metrics,
    version: 2
  }
}
```

---

## 6.2 Backend Should Validate Metrics

In `app.py`, validate:

1. `segments` is a list.
2. Each segment has `words`.
3. If `preview_metrics.version == 2`, each segment should ideally have `measured_word_boxes`.
4. `style` contains required fields.
5. `width` and `height` are positive integers.

Add a light validation helper:

```py
def validate_render_payload(req: RenderRequest) -> None:
    if not req.segments:
        raise HTTPException(status_code=400, detail="No caption segments provided")

    if req.width <= 0 or req.height <= 0:
        raise HTTPException(status_code=400, detail="Invalid export resolution")

    for segment in req.segments:
        if not segment.get("words"):
            raise HTTPException(status_code=400, detail="Caption segment has no words")
```

---

## 6.3 Backend Should Preserve Debug Artifacts

For each render job:

```py
debug_dir = os.path.join(BASE_DIR, "storage", "debug")
os.makedirs(debug_dir, exist_ok=True)
```

Save:

```py
payload.json
metrics.json
subtitle.ass
ffmpeg_command.txt
```

This will make parity debugging much easier.

---

# Phase 7: Fix `VideoPlayer.jsx` and `index.css`

The preview is the source of truth, so it must be stable.

---

## 7.1 Fix Global CSS Reset

Current CSS appears to have a bare block:

```css
{
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

Change to:

```css
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

---

## 7.2 Keep Word Tokens Stable for Measurement

Keep:

```jsx
display: 'inline-block'
margin: '0 4px'
paintOrder: 'stroke fill'
WebkitTextStroke
textShadow
```

Also ensure:

```css
.word-token {
  transform-origin: center center;
  backface-visibility: hidden;
}
```

---

## 7.3 Decide Shadow Source of Truth

Current preview uses:

```css
text-shadow: 0 4px ${style.shadowBlur}px ${style.shadowColor};
```

Therefore, export should use:

```txt
x offset: 0
y offset: 4px scaled
blur: shadowBlur mapped to ASS blur
```

If the design team actually wants a zero-offset glow, then both preview and export must change together.

Do not let preview and export have different shadow definitions.

Recommended style schema addition:

```js
shadowOffsetX: 0,
shadowOffsetY: 4
```

Then both preview and export use those values.

---

## 7.4 Background Pill Limitation

Current libass renderer does not render:

```js
backgroundColor
backgroundPadding
borderRadius
backdropFilter
```

For the current bug scope, this may be acceptable.

But if the `minimal` frosted pill preset must export accurately, add a separate phase:

### Background Export Options

1. Render a solid background rectangle using FFmpeg drawbox.
2. Generate transparent PNG overlays.
3. Use headless Chromium overlay rendering.
4. Approximate with ASS opaque box, though this is limited.

Recommendation:

- For now, warn the user that background/backdrop is preview-only.
- Later, implement PNG overlay compositing for full parity.

---

# Phase 8: Fix Preset Thumbnails in `StyleInspector.jsx`

---

## 8.1 Use Sanitized Presets

Before rendering:

```js
const safeStyle = sanitizeStyle(preset.style);
```

---

## 8.2 Prevent Clipping

Thumbnail container should not tightly clip stroked text.

Use:

```jsx
style={{
  padding: '8px 6px',
  borderRadius: '8px',
  backgroundColor: '#0F172A',
  textAlign: 'center',
  fontFamily: safeStyle.fontFamily,
  fontSize: '18px',
  fontWeight: safeStyle.fontWeight,
  textTransform: safeStyle.textTransform,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  overflow: 'visible'
}}
```

If parent card must hide overflow, add enough padding.

---

## 8.3 Use Correct Stroke Rendering

For thumbnails, scale stroke down:

```js
const thumbnailStroke = preset.style.strokeWidth
  ? Math.max(1, Math.min(2, preset.style.strokeWidth * 0.25))
  : 0;
```

Apply:

```jsx
WebkitTextStroke: thumbnailStroke ? `${thumbnailStroke}px ${safeStyle.strokeColor}` : 'none',
paintOrder: 'stroke fill',
display: 'inline-block'
```

---

## 8.4 Use Correct Shadow Preview

For thumbnails:

```js
const thumbnailShadow = safeStyle.shadowBlur
  ? `0 2px ${Math.max(2, safeStyle.shadowBlur / 3)}px ${safeStyle.shadowColor}`
  : 'none';
```

Apply to active word span.

---

# Phase 9: Optional Advanced Parity Enhancements

These are not required for the first fix, but they make the system much stronger.

---

## 9.1 Font Width Calibration

Browser font metrics and libass font metrics may differ slightly.

If word widths still differ:

1. Use `opentype.js` or Python `fontTools`.
2. Read the exact TTF advance widths.
3. Estimate ASS word width.
4. Compare to measured DOM word width.
5. Apply a tiny per-word `\fscx` correction.

Example:

```ass
\fscx{width_correction}
```

This is advanced but powerful.

---

## 9.2 Render Word Boxes Debug Overlay

Add a preview debug mode that draws boxes around measured word centers.

Also generate a debug ASS frame with markers.

This helps verify coordinate mapping.

---

## 9.3 Headless Chromium Export Mode

If the product eventually requires true pixel parity, the strongest architecture is:

```txt
React caption component
        ↓
Headless Chromium renders transparent PNG/WebM overlay
        ↓
FFmpeg composites overlay onto video
```

This removes libass approximation completely.

However, it is slower and more resource-heavy.

Recommended strategy:

1. Ship the DOM-to-libass absolute-placement fix first.
2. Add headless Chromium export later as a “pixel-perfect mode”.

---

# 10. Proposed File-by-File Change List

---

## `layoutMeasurer.js`

Changes:

1. Create outer caption box.
2. Include `backgroundPadding`.
3. Use `getBoundingClientRect()`.
4. Return `measured_word_boxes`.
5. Return fractional line offsets.
6. Load exact fonts before measuring.
7. Add `preview_metrics.version = 2`.
8. Fix `strokeWidth || 6` logging bug.

---

## `renderer.py`

Changes:

1. Fix `__file__`.
2. Fix font map.
3. Fix color conversion.
4. Add ASS text escaping.
5. Add display interval generation.
6. Add separate `MainStyle` and `ShadowStyle`.
7. Remove `\rBaseStyle`.
8. Remove three-space word gap hack.
9. Use absolute word positioning.
10. Render shadow as separate layer.
11. Use separate X/Y scale.
12. Use `scale_y` for vertical offsets.
13. Keep stroke at 50% of CSS stroke.
14. Suppress synthetic bold on heavy fonts.
15. Add debug ASS/payload logging.

---

## `ExportModal.jsx`

Changes:

1. Use sanitized style.
2. Send `preview_metrics.version`.
3. Ensure measured segments are sent.
4. Handle measurement errors gracefully.
5. Optionally show warning if backend does not support measurement v2.

---

## `app.py`

Changes:

1. Fix `__file__`.
2. Validate render payload.
3. Save debug artifacts.
4. Pass `preview_metrics` unchanged.
5. Add backend capability flag:

```py
{
  "supports_absolute_word_layout": true
}
```

---

## `presets.js`

Changes:

1. Fix corrupted keys/values.
2. Add `DEFAULT_STYLE`.
3. Add `sanitizeStyle()`.
4. Ensure every preset has every required field.

---

## `useEditorStore.js`

Changes:

1. Sanitize preset before applying.
2. Preserve numeric `0` values.
3. Avoid `||` for values where `0` is valid.
4. Add optional style version field.

Example:

```js
style: sanitizeStyle({ ...DEFAULT_PRESET.style })
```

---

## `VideoPlayer.jsx`

Changes:

1. Keep preview token styles stable.
2. Use sanitized style values.
3. Ensure caption outer box matches measurement.
4. Optionally expose debug bounding-box overlay.

---

## `StyleInspector.jsx`

Changes:

1. Use sanitized preset styles.
2. Fix thumbnail clipping.
3. Use safe thumbnail stroke/shadow.
4. Ensure active/inactive preview words are inline-block.

---

## `index.css`

Changes:

1. Fix global reset selector.
2. Keep `.word-token` paint order.
3. Add transform origin.
4. Ensure active animation classes do not affect layout.

---

# 11. New Data Contract Example

```json
{
  "video_filename": "sample.mp4",
  "width": 1080,
  "height": 1920,
  "video_duration": 10.0,
  "encoder_mode": "cpu",
  "style": {
    "fontFamily": "Montserrat",
    "fontSize": 34,
    "fontWeight": "900",
    "primaryColor": "#FFFFFF",
    "activeColor": "#FFE600",
    "strokeColor": "#000000",
    "strokeWidth": 6,
    "shadowColor": "#000000",
    "shadowBlur": 8,
    "positionX": 50,
    "positionY": 74,
    "textTransform": "uppercase",
    "animationType": "pop",
    "backgroundPadding": 0
  },
  "preview_metrics": {
    "version": 2,
    "container_width": 310,
    "container_height": 550,
    "caption_outer_width": 279,
    "caption_outer_height": 118.5,
    "caption_content_width": 279,
    "background_padding": 0,
    "box_width": 279,
    "font_size": 34,
    "stroke_width": 6,
    "shadow_blur": 8,
    "position_x": 50,
    "position_y": 74
  },
  "segments": [
    {
      "id": "seg-1",
      "start": 0.1,
      "end": 1.45,
      "text": "STOP SCROLLING RIGHT NOW",
      "words": [
        { "word": "STOP", "start": 0.1, "end": 0.42 },
        { "word": "SCROLLING", "start": 0.43, "end": 0.92 },
        { "word": "RIGHT", "start": 0.93, "end": 1.18 },
        { "word": "NOW", "start": 1.19, "end": 1.45 }
      ],
      "measured_lines": [[0, 1], [2, 3]],
      "measured_line_offsets": [-20.1, 20.3],
      "measured_word_boxes": [
        {
          "index": 0,
          "line": 0,
          "center_x": -62.4,
          "center_y": -20.1,
          "width": 64.2,
          "height": 38.9
        },
        {
          "index": 1,
          "line": 0,
          "center_x": 40.8,
          "center_y": -20.1,
          "width": 132.7,
          "height": 38.9
        },
        {
          "index": 2,
          "line": 1,
          "center_x": -35.6,
          "center_y": 20.3,
          "width": 63.2,
          "height": 38.9
        },
        {
          "index": 3,
          "line": 1,
          "center_x": 41.9,
          "center_y": 20.3,
          "width": 58.6,
          "height": 38.9
        }
      ]
    }
  ]
}
```

---

# 12. Implementation Order

## PR 1: Critical Hygiene and Bug Blockers

Scope:

1. Fix presets.
2. Add sanitizer.
3. Fix Python `__file__`.
4. Fix font map.
5. Fix color conversion.
6. Fix ASS escaping.
7. Fix `strokeWidth || 6` bug.
8. Fix global CSS reset.

Risk:

- Low.
- Mostly defensive.

---

## PR 2: Layout Measurer v2

Scope:

1. Measure outer caption box.
2. Include padding.
3. Use `getBoundingClientRect()`.
4. Return `measured_word_boxes`.
5. Add `preview_metrics.version`.

Risk:

- Medium.
- Frontend measurement must match preview exactly.

---

## PR 3: Renderer v2 Absolute Word Placement

Scope:

1. Add new ASS generation path.
2. Use measured word boxes.
3. Render shadow layer.
4. Remove `\rBaseStyle`.
5. Remove three-space hack.
6. Add display intervals.
7. Add debug artifacts.

Risk:

- Medium to high.
- Most important PR.

---

## PR 4: StyleInspector Thumbnails and Preset Polish

Scope:

1. Fix thumbnails.
2. Use sanitized presets.
3. Prevent clipping.
4. Add visual snapshot tests.

Risk:

- Low.

---

## PR 5: Visual Calibration

Scope:

1. Tune blur mapping.
2. Tune shadow alpha.
3. Tune stroke width.
4. Tune animation timing.
5. Compare golden frames.

Risk:

- Medium.
- Requires visual QA.

---

# 13. Acceptance Criteria

The implementation is successful if all of these pass.

---

## Stroke

Given:

```js
strokeWidth: 6
```

Export outline should be approximately:

```txt
6 / 2 * scale
```

No fused letters.

No closed glyph counters in letters like:

- R
- E
- O
- A
- B

---

## Shadow

Given:

```js
strokeWidth: 0
shadowBlur: 10
shadowColor: #000000
```

Export must still show shadow/glow.

Shadow must not require stroke to be visible.

---

## Vertical Alignment

Given a two-line caption:

- Preview line centers and export line centers should match within a few export pixels.
- Captions should not drift lower in export.
- `backgroundPadding` should not cause unexpected drift.

---

## Active Word

When active word pops:

- Active word scales around its own center.
- Surrounding words do not move.
- Active word does not stretch horizontally.
- Word gap remains stable.
- Active word renders above neighbors if overlap occurs.

---

## Presets

Preset thumbnails:

- Are not clipped.
- Show stroke correctly.
- Show active word color.
- Do not render blacked-out text.
- Use valid font families.

---

# 14. Risks and Mitigations

---

## Risk 1: libass Font Metrics Differ From Browser

Mitigation:

- Use exact TTF files.
- Use measured word positions.
- Add optional per-word width calibration.
- If unacceptable, move to headless Chromium overlay export.

---

## Risk 2: More ASS Events Reduce Performance

Mitigation:

- Current segments are usually 1 to 4 words.
- Event count is small.
- If longer segments are allowed, optimize by grouping inactive words or caching static word layers.

---

## Risk 3: ASS Animation Approximation Is Imperfect

Mitigation:

- Focus on geometry first.
- Use consistent anchor points.
- Keep animation transforms local.
- Add motion tuning later.

---

## Risk 4: Background Pill Cannot Be Rendered by libass

Mitigation:

- Treat background as preview-only for now.
- Add warning in UI.
- Later implement PNG overlay compositing.

---

# 15. Recommended Immediate Next Step

Start with this sequence:

1. Fix preset/style normalization.
2. Upgrade `layoutMeasurer.js` to return `measured_word_boxes`.
3. Rewrite `renderer.py` to use absolute word placement.
4. Add shadow underlay layer.
5. Run golden-frame comparison.

That sequence directly attacks the five reported problems:

- stroke inflation,
- missing shadows,
- vertical drift,
- active-word distortion,
- broken preset thumbnails.