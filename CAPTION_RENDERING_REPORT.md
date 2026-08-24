# AutoCaption Studio: Caption Rendering & Parity Engineering Report

## 1. Overview & Problem Statement

Discrepancies were identified between the web browser DOM preview (`VideoPlayer.jsx`) and the video export engine (`renderer.py` using FFmpeg + `libass`):
1. **Big Text & Stroke Inflation (200% Over-stroking)**: CSS `-webkit-text-stroke` with `paint-order: stroke fill` exposes only 50% of the stroke outward, whereas ASS `Outline` expands radially outward by 100%, causing characters to merge into solid black blobs.
2. **Synthetic Faux-Bolding**: Specifying `Bold: -1` on natively heavy fonts (`Montserrat Black`, `Russo One`) caused DirectWrite/libass to apply synthetic faux-bolding on top of heavy weights.
3. **Broken Preset Mini-Previews**: Preset cards in `StyleInspector.jsx` rendered clipped/broken text because of missing `paint-order: stroke fill` and `display: inline-block`.
4. **Vertical Alignment Shift**: Multi-line subtitle blocks drifted lower in the exported video than shown in the preview due to fixed line-height math.
5. **Missing Shadows on 0px Stroke**: In ASS, `\xshad0\yshad0` without an outline disabled the shadow layer completely.

---

## 2. Previewer Architecture & Code (Frontend)

* **Engine**: Browser DOM / React / WebKit CSS Box Model
* **Key Files**:
  * `VideoPlayer.jsx`
  * `layoutMeasurer.js`
  * `index.css`

### Method
1. **Container Dimensions**: A fixed-aspect CSS container (`310px × 550px` for 9:16 vertical).
2. **Text Positioning**: Absolute container positioned at `top: ${style.positionY}%`, `left: ${style.positionX}%` with `transform: translate(-50%, -50%)`.
3. **Word Rendering**: Each word is an inline `<span>` (`.word-token`) with:
   * `-webkit-text-stroke: ${style.strokeWidth}px ${style.strokeColor}`
   * `paint-order: stroke fill` (stroke drawn under fill, exposing only 50% outward)
   * `text-shadow: 0 4px ${style.shadowBlur}px ${style.shadowColor}` (2D Gaussian convolution)
   * `letter-spacing: -0.5px` (for Montserrat, Outfit, Russo) or `1px` (for Bebas Neue)
   * `margin: 0 4px` (inter-word gap)

### Previewer Rendering Code (`VideoPlayer.jsx`)
```jsx
<div style={{
  fontFamily: style.fontFamily,
  fontSize: `${style.fontSize}px`,
  fontWeight: style.fontWeight,
  lineHeight: 1.15,
  textTransform: style.textTransform,
  letterSpacing: style.fontFamily === 'Bebas Neue' ? '1px' : '-0.5px'
}}>
  {activeSegment.words.map((w, idx) => {
    const isActive = idx === activeWordIndex;
    const animClass = isActive ? `anim-${style.animationType}` : '';
    
    return (
      <span
        key={w.id || idx}
        className={`word-token ${isActive ? 'is-active' : ''} ${animClass}`}
        style={{
          color: isActive ? style.activeColor : style.primaryColor,
          WebkitTextStroke: style.strokeWidth ? `${style.strokeWidth}px ${style.strokeColor}` : 'none',
          textShadow: style.shadowBlur 
            ? `0 4px ${style.shadowBlur}px ${style.shadowColor}` 
            : 'none',
          display: 'inline-block',
          margin: '0 4px'
        }}
      >
        {w.word}
      </span>
    );
  })}
</div>
```

---

## 3. Renderer Architecture & Code (Backend)

* **Engine**: Python 3 + `imageio_ffmpeg` + FFmpeg `libass` Subtitle Filter (`-vf ass='...':fontsdir='...'`)
* **Key Files**:
  * `renderer.py`
  * `app.py`

### Method
1. **Resolution Scaling**: Computes `scale = video_width / preview_container_width` ($1080 / 310 \approx 3.484\text{x}$).
2. **Font Resolution**: Maps web font family names (`Montserrat` $\rightarrow$ `Montserrat Black`) to static TrueType TTF files in `storage/fonts/`.
3. **Stroke Calculation**: `ass_stroke_width = max(0, int(round((raw_stroke / 2.0) * scale)))`.
4. **Line-by-Line Placement**: Positions lines using measured vertical offsets from the DOM: `line_y = int(round(pos_y + (measured_offsets[i] * scale)))`.
5. **Color & Alpha Conversion**: Formats RGB hex to ASS BGR format (`&HAABBGGRR&`).
6. **FFmpeg Subtitle Filter Burn-In**:
   ```bash
   ffmpeg -y -i input.mp4 -vf "ass='temp.ass':fontsdir='backend/storage/fonts'" -c:v libx264 -preset ultrafast -crf 18 -c:a copy output.mp4
   ```

### Renderer ASS Generation Code (`renderer.py`)
```python
def generate_ass_subtitle(
    segments: list,
    style: dict,
    video_width: int = 1080,
    video_height: int = 1920,
    preview_base_width: float = 310.0,
    preview_metrics: dict = None
) -> str:
    base_w = preview_metrics.get("container_width", preview_base_width) if preview_metrics else preview_base_width
    scale = video_width / float(base_w if base_w > 0 else 310.0)
    
    raw_font_family = style.get("fontFamily", "Montserrat")
    font_family = FONT_NAME_MAP.get(raw_font_family, raw_font_family)
    
    raw_font_size = float(style.get("fontSize", 34))
    ass_font_size = int(round(raw_font_size * scale))
    
    pri_col = hex_to_ass_color(style.get("primaryColor", "#FFFFFF"))
    act_col = hex_to_ass_color(style.get("activeColor", "#FFE600"))
    stroke_col = hex_to_ass_color(style.get("strokeColor", "#000000"))
    shadow_col = hex_to_ass_color(style.get("shadowColor", "#000000"), alpha_hex="35")
    
    raw_stroke = float(style.get("strokeWidth", 6))
    ass_stroke_width = max(0, int(round((raw_stroke / 2.0) * scale)))
    
    raw_shadow = float(style.get("shadowBlur", 8))
    ass_blur = max(0.0, round((raw_shadow / 8.0) * 3.0, 1)) if raw_shadow > 0 else 0.0
    ass_spacing = 3 if raw_font_family == "Bebas Neue" else -2
    
    pos_x = int(round(video_width * (float(style.get("positionX", 50)) / 100.0)))
    pos_y = int(round(video_height * (float(style.get("positionY", 74)) / 100.0)))
    fallback_line_h = int(round(ass_font_size * 1.05))
    
    is_uppercase = style.get("textTransform", "uppercase") == "uppercase"
    anim_type = style.get("animationType", "pop")
    
    is_heavy_font = any(k in font_family.lower() for k in ["black", "extrabold", "bold", "russo", "bangers"])
    ass_bold_flag = 0 if is_heavy_font else -1
    
    ass_content = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {video_width}",
        f"PlayResY: {video_height}",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: BaseStyle,{font_family},{ass_font_size},{pri_col},{act_col},{stroke_col},{shadow_col},{ass_bold_flag},0,0,0,100,100,{ass_spacing},0,1,{ass_stroke_width},0,5,0,0,0,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
    ]
    
    shadow_tag = "\\xshad0\\yshad0" if raw_shadow > 0 else ""
    blur_tag = f"\\blur{ass_blur}" if ass_blur > 0 else ""

    for seg in segments:
        words = seg.get("words", [])
        if not words:
            continue
            
        n_words = len(words)
        measured_lines = seg.get("measured_lines")
        if measured_lines and isinstance(measured_lines, list) and len(measured_lines) > 0:
            lines = []
            for line_indices in measured_lines:
                lw = [words[i] for i in line_indices if 0 <= i < n_words]
                if lw:
                    lines.append(lw)
            if not lines:
                lines = [words]
        else:
            mid = (n_words + 1) // 2
            lines = [words[:mid], words[mid:]] if n_words > 3 else [words]

        num_lines = len(lines)
        measured_offsets = seg.get("measured_line_offsets")
        if measured_offsets and isinstance(measured_offsets, list) and len(measured_offsets) == num_lines:
            y_offsets = [int(round(pos_y + (measured_offsets[i] * scale))) for i in range(num_lines)]
        else:
            y_offsets = [int(round(pos_y + (i - (num_lines - 1) / 2.0) * fallback_line_h)) for i in range(num_lines)]

        for active_global_idx in range(n_words):
            w_active = words[active_global_idx]
            w_start = w_active.get("start", 0.0)
            w_end = w_active.get("end", w_start + 0.3)
            if w_end <= w_start:
                w_end = w_start + 0.25

            start_ts = format_ass_timestamp(w_start)
            end_ts = format_ass_timestamp(w_end)

            global_word_counter = 0
            for line_idx, line_words in enumerate(lines):
                line_y = y_offsets[line_idx]
                tokens = []
                for w in line_words:
                    is_active = (global_word_counter == active_global_idx)
                    global_word_counter += 1

                    raw_txt = w.get("word", "").strip()
                    word_txt = raw_txt.upper() if is_uppercase else raw_txt

                    if is_active:
                        if anim_type == "bounce":
                            tok = f"{{\\c{act_col}\\fscx106\\fscy106\\frz-1.5\\t(0,70,\\frz1.5)\\t(70,140,\\frz0)}}{word_txt}{{\\rBaseStyle}}"
                        elif anim_type == "karaoke":
                            tok = f"{{\\c{act_col}\\fscx102\\fscy102}}{word_txt}{{\\rBaseStyle}}"
                        elif anim_type == "fade":
                            tok = f"{{\\c{act_col}}}{word_txt}{{\\rBaseStyle}}"
                        else: # pop
                            tok = f"{{\\c{act_col}\\fscx106\\fscy106\\t(0,80,\\fscx102\\fscy102)}}{word_txt}{{\\rBaseStyle}}"
                    else:
                        tok = f"{{\\c{pri_col}}}{word_txt}{{\\rBaseStyle}}"

                    tokens.append(tok)

                line_str = "   ".join(tokens)
                ass_content.append(f"Dialogue: 0,{start_ts},{end_ts},BaseStyle,,0,0,0,,{{\\an5\\pos({pos_x},{line_y}){shadow_tag}{blur_tag}}}{line_str}")

    return "\n".join(ass_content)
```

---

## 4. Frontend-Backend Data Contract

```
[React VideoPlayer] -> [layoutMeasurer.js] -> [ExportModal.jsx] -> POST /api/render -> [app.py] -> [renderer.py] -> [FFmpeg libass]
```

### JSON Payload Schema
```json
{
  "video_filename": "sample.mp4",
  "segments": [
    {
      "id": "seg-1",
      "start": 0.0,
      "end": 2.0,
      "text": "GENTLE EMERGENCY EVALUATIONS",
      "words": [
        {"word": "GENTLE", "start": 0.0, "end": 0.6},
        {"word": "EMERGENCY", "start": 0.6, "end": 1.2},
        {"word": "EVALUATIONS", "start": 1.2, "end": 1.8}
      ],
      "measured_lines": [[0], [1], [2]],
      "measured_line_offsets": [-38.0, 0.0, 38.0],
      "measured_line_height": 39.1
    }
  ],
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
    "animationType": "pop"
  },
  "width": 1080,
  "height": 1920,
  "video_duration": 10.0,
  "encoder_mode": "cpu",
  "preview_metrics": {
    "container_width": 310,
    "container_height": 550,
    "box_width": 279
  }
}
```

---

## 5. Industry Comparison: How CapCut / Submagic / Remotion Render Captions

| Platform | Rendering Architecture | Parity Mechanism |
| :--- | :--- | :--- |
| **CapCut / Premiere** | Native GPU 2D Shaders (Direct2D / Metal / OpenGL) | Frame-buffer multi-pass convolution shaders for stroke, fill, and drop shadow. |
| **Submagic / Remotion / Veed** | Unified HTML5 Canvas / Chromium Skia Engine | The server executes the identical React DOM component via headless Chromium or Skia, producing transparent frame overlays composited with FFmpeg (`overlay=shortest=1`). |
| **AutoCaption Studio** | Mathematical DOM-to-libass Synchronizer | Measures exact DOM bounding boxes and line offsets in React and maps them mathematically into native FFmpeg `libass` directives for ultra-fast (sub-second) rendering. |
