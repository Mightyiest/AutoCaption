import os
import sys
import subprocess
import tempfile
import time
import json
import imageio_ffmpeg

FONTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage", "fonts")

FONT_NAME_MAP = {
    "Montserrat": "Montserrat Black",
    "Russo One": "Russo One",
    "Outfit": "Outfit ExtraBold",
    "Bebas Neue": "Bebas Neue",
    "Bangers": "Bangers",
    "Plus Jakarta Sans": "Plus Jakarta Sans ExtraBold",
    "Inter": "Montserrat Black"
}

def escape_ass_text(text: str) -> str:
    if not text:
        return ""
    return (
        str(text)
        .replace("\\", "\\\\")
        .replace("{", "\\{")
        .replace("}", "\\}")
    )

def hex_to_ass_color(hex_str: str, alpha_hex: str = "00") -> str:
    if not hex_str:
        return f"&H{alpha_hex}FFFFFF&"
        
    val = str(hex_str).strip()
    if val.lower() == "transparent":
        return "&HFF000000&"
        
    val = val.lstrip("#")
    if len(val) == 3:
        val = "".join([c * 2 for c in val])
        
    if len(val) == 8:
        r, g, b, a = val[0:2], val[2:4], val[4:6], val[6:8]
        ass_alpha = f"{255 - int(a, 16):02X}"
        return f"&H{ass_alpha}{b.upper()}{g.upper()}{r.upper()}&"
        
    if len(val) != 6:
        return f"&H{alpha_hex}FFFFFF&"
        
    r = val[0:2].upper()
    g = val[2:4].upper()
    b = val[4:6].upper()
    return f"&H{alpha_hex}{b}{g}{r}&"

def format_ass_timestamp(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centis = int(round((seconds - int(seconds)) * 100))
    if centis >= 100:
        centis = 99
    return f"{hrs}:{mins:02d}:{secs:02d}.{centis:02d}"

def get_word_display_intervals(segment: dict) -> list:
    words = segment.get("words", [])
    if not words:
        return []
        
    seg_start = float(segment.get("start", 0.0))
    seg_end = float(segment.get("end", seg_start))
    
    intervals = []
    for i, word in enumerate(words):
        w_start = max(seg_start, float(word.get("start", seg_start)))
        if i + 1 < len(words):
            next_start = float(words[i + 1].get("start", w_start))
            w_end = min(seg_end, next_start)
        else:
            w_end = seg_end
            
        if w_end <= w_start:
            fallback_dur = max(0.2, float(word.get("end", w_start + 0.25)) - w_start)
            w_end = w_start + fallback_dur
            
        w_end = min(seg_end, w_end)
        if w_end <= w_start:
            w_end = w_start + 0.2
            
        intervals.append({
            "active_index": i,
            "start": w_start,
            "end": w_end
        })
        
    return intervals

def build_animation_tags(anim_type: str, duration_ms: int, org_x: int, org_y: int) -> str:
    duration_ms = max(80, int(duration_ms))
    
    if anim_type == "pop":
        t1 = min(60, int(duration_ms * 0.4))
        t2 = min(130, duration_ms)
        return f"\\fscx96\\fscy96\\t(0,{t1},\\fscx112\\fscy112)\\t({t1},{t2},\\fscx104\\fscy104)"
        
    if anim_type == "bounce":
        t1 = min(60, int(duration_ms * 0.4))
        t2 = min(130, duration_ms)
        return f"\\org({org_x},{org_y})\\fscx96\\fscy96\\frz-1.5\\t(0,{t1},\\fscx110\\fscy110\\frz1.5)\\t({t1},{t2},\\fscx104\\fscy104\\frz0)"
        
    if anim_type == "karaoke":
        return "\\fscx102\\fscy102"
        
    if anim_type == "fade":
        return "\\alpha&H30&\\t(0,80,\\alpha&H00&)"
        
    return ""

def generate_ass_subtitle(
    segments: list,
    style: dict,
    video_width: int = 1080,
    video_height: int = 1920,
    preview_base_width: float = 310.0,
    preview_metrics: dict = None
) -> str:
    metrics = preview_metrics or {}
    base_w = float(metrics.get("container_width", preview_base_width) or 310.0)
    base_h = float(metrics.get("container_height", 550.0) or 550.0)
    
    scale_x = video_width / base_w
    scale_y = video_height / base_h
    uniform_scale = min(scale_x, scale_y)
    
    raw_font_family = str(style.get("fontFamily", "Montserrat")).strip()
    font_family = FONT_NAME_MAP.get(raw_font_family, raw_font_family)
    
    raw_font_size = float(style.get("fontSize", 34))
    ass_font_size = int(round(raw_font_size * uniform_scale))
    
    pri_col = hex_to_ass_color(style.get("primaryColor", "#FFFFFF"))
    act_col = hex_to_ass_color(style.get("activeColor", "#FFE600"))
    
    # Stroke Outline
    stroke_enabled = style.get("strokeEnabled", True)
    stroke_col = hex_to_ass_color(style.get("strokeColor", "#000000"))
    raw_stroke = float(style.get("strokeWidth", 6)) if stroke_enabled else 0.0
    ass_stroke_width = max(1, int(round((raw_stroke / 2.0) * uniform_scale))) if raw_stroke > 0 else 0
    
    # Directional Drop Shadow
    shadow_enabled = style.get("shadowEnabled", True)
    raw_shadow = float(style.get("shadowBlur", 8)) if shadow_enabled else 0.0
    raw_shadow_col = style.get("shadowColor", "#000000") if shadow_enabled else "transparent"
    shadow_col = hex_to_ass_color(raw_shadow_col, alpha_hex="30")
    
    # Scaled Letter-spacing
    css_letter_spacing = float(style.get("letterSpacing", 1.0 if raw_font_family == "Bebas Neue" else -0.5))
    ass_spacing = int(round(css_letter_spacing * uniform_scale))
    
    # Shadow offset & blur
    shadow_offset_y_css = float(style.get("shadowOffsetY", 4.0 if raw_shadow > 0 else 0.0))
    shadow_offset_x_css = float(style.get("shadowOffsetX", 0.0))
    shadow_offset_y = int(round(shadow_offset_y_css * scale_y))
    shadow_offset_x = int(round(shadow_offset_x_css * scale_x))
    ass_blur = max(0.0, round(raw_shadow * 0.35, 1)) if raw_shadow > 0 else 0.0
    
    # Outer Glow (Separated from Drop Shadow)
    glow_enabled = bool(style.get("glowEnabled", False))
    raw_glow = float(style.get("glowBlur", 14)) if glow_enabled else 0.0
    raw_glow_col = style.get("glowColor", "#38BDF8")
    if glow_enabled and raw_glow > 0:
        ass_blur = max(ass_blur, round(raw_glow * 0.4, 1))
    
    has_shadow = shadow_enabled and raw_shadow > 0 and raw_shadow_col.lower() != "transparent"
    
    pos_x = int(round(video_width * (float(style.get("positionX", 50)) / 100.0)))
    pos_y = int(round(video_height * (float(style.get("positionY", 74)) / 100.0)))
    
    text_transform = str(style.get("textTransform", "uppercase")).strip().lower()
    anim_type = style.get("animationType", "pop")
    
    # Suppress synthetic bold on native heavy weights
    is_heavy_font = any(k in font_family.lower() for k in ["black", "extrabold", "bold", "russo", "bangers", "bebas"])
    ass_bold_flag = 0 if is_heavy_font else -1
    
    # Italic styling
    is_italic = style.get("fontStyle") == "italic"
    ass_italic_flag = -1 if is_italic else 0
    italic_tag = "\\i1" if is_italic else ""
    
    def transform_word(txt: str) -> str:
        txt = (txt or "").strip()
        if text_transform == "uppercase":
            return txt.upper()
        if text_transform == "capitalize":
            return txt.capitalize()
        if text_transform == "lowercase":
            return txt.lower()
        return txt

    # Native Single-Layer Style with stroke and drop-shadow
    ass_shadow_depth = int(round(max(abs(shadow_offset_x), abs(shadow_offset_y), 4))) if has_shadow else 0
    back_col = shadow_col if has_shadow else "&H00000000&"
    blur_tag = f"\\blur{ass_blur}" if ass_blur > 0 else ""

    ass_content = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {video_width}",
        f"PlayResY: {video_height}",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: MainStyle,{font_family},{ass_font_size},{pri_col},{act_col},{stroke_col},{back_col},{ass_bold_flag},{ass_italic_flag},0,0,100,100,{ass_spacing},0,1,{ass_stroke_width},{ass_shadow_depth},5,0,0,0,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
    ]

    for seg in segments:
        words = seg.get("words", [])
        if not words:
            continue
            
        n_words = len(words)
        intervals = get_word_display_intervals(seg)
        
        # Unified Line-Stream Architecture (Natural Font Kerning & Tight Spacing)
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
            y_offsets = [int(round(pos_y + (measured_offsets[i] * scale_y))) for i in range(num_lines)]
        else:
            fallback_line_h = int(round(ass_font_size * float(style.get("lineHeight", 1.02))))
            y_offsets = [int(round(pos_y + (i - (num_lines - 1) / 2.0) * fallback_line_h)) for i in range(num_lines)]

        text_align = style.get("textAlign", "center")
        align_num = 4 if text_align == "left" else (6 if text_align == "right" else 5)

        for interval in intervals:
            act_idx = interval["active_index"]
            start_ts = format_ass_timestamp(interval["start"])
            end_ts = format_ass_timestamp(interval["end"])
            dur_ms = int((interval["end"] - interval["start"]) * 1000)

            global_counter = 0
            for line_idx, line_words in enumerate(lines):
                line_y = y_offsets[line_idx]
                tokens = []
                for w in line_words:
                    is_active = (global_counter == act_idx)
                    global_counter += 1

                    raw_txt = (w.get("word", "") if isinstance(w, dict) else str(w)).strip()
                    word_txt = escape_ass_text(transform_word(raw_txt))

                    if is_active:
                        anim_tag = build_animation_tags(anim_type, dur_ms, pos_x, line_y)
                        tok = f"{{\\c{act_col}{italic_tag}{anim_tag}}}{word_txt}{{\\rMainStyle}}"
                    else:
                        tok = f"{{\\c{pri_col}{italic_tag}}}{word_txt}{{\\rMainStyle}}"
                    tokens.append(tok)

                line_str = " ".join(tokens)
                ass_content.append(
                    f"Dialogue: 1,{start_ts},{end_ts},MainStyle,,0,0,0,,{{\\an{align_num}\\pos({pos_x},{line_y})\\fsp{ass_spacing}{italic_tag}{blur_tag}}}{line_str}"
                )

    return "\n".join(ass_content)

def render_captioned_video(
    source_video_path: str,
    output_video_path: str,
    segments: list,
    style: dict,
    video_width: int = 1080,
    video_height: int = 1920,
    video_duration: float = None,
    encoder_mode: str = "cpu",
    preview_metrics: dict = None,
    on_proc_ready=None,
    progress_callback=None
) -> None:
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    
    temp_dir = os.path.dirname(os.path.abspath(output_video_path))
    os.makedirs(temp_dir, exist_ok=True)
    temp_ass_path = os.path.join(temp_dir, f"sub_{os.path.basename(output_video_path)}.ass")
    
    # Save debug snapshot
    debug_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage", "debug")
    os.makedirs(debug_dir, exist_ok=True)
    
    ass_text = generate_ass_subtitle(
        segments=segments,
        style=style,
        video_width=video_width,
        video_height=video_height,
        preview_base_width=310.0,
        preview_metrics=preview_metrics
    )
    
    with open(temp_ass_path, "w", encoding="utf-8") as f:
        f.write(ass_text)
        
    debug_ass_path = os.path.join(debug_dir, f"render_{int(time.time())}.ass")
    with open(debug_ass_path, "w", encoding="utf-8") as f:
        f.write(ass_text)
        
    try:
        escaped_ass_path = temp_ass_path.replace("\\", "/").replace(":", "\\\\:")
        escaped_fonts_dir = FONTS_DIR.replace("\\", "/").replace(":", "\\\\:")
        
        vf_filter = f"ass={escaped_ass_path}:fontsdir={escaped_fonts_dir}"
        
        if encoder_mode == "gpu_nvenc":
            v_codec = ["-c:v", "h264_nvenc", "-preset", "p4", "-cq", "19"]
        else:
            v_codec = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "18"]
            
        cmd = [
            ffmpeg_exe,
            "-y",
            "-i", source_video_path,
            "-vf", vf_filter,
            *v_codec,
            "-c:a", "copy",
            "-progress", "pipe:1",
            output_video_path
        ]
        
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        if on_proc_ready:
            try:
                on_proc_ready(proc)
            except Exception:
                pass
        
        duration = float(video_duration) if video_duration and float(video_duration) > 0 else 0.0
        last_pct = 5
        
        while True:
            line = proc.stdout.readline()
            if not line and proc.poll() is not None:
                break
            if not line:
                continue
                
            line = line.strip()
            if line.startswith("out_time_ms="):
                try:
                    out_ms = int(line.split("=")[1])
                    if progress_callback and duration > 0:
                        pct = min(99, int((out_ms / 1000000.0) / duration * 100))
                        last_pct = max(last_pct, pct)
                        progress_callback(last_pct)
                except Exception:
                    pass
            elif line.startswith("duration="):
                try:
                    dur_val = float(line.split("=")[1])
                    if dur_val > 0:
                        duration = dur_val
                except Exception:
                    pass
                    
        proc.wait()
        if proc.returncode != 0 and proc.returncode not in [-15, -9, 1]:
            raise RuntimeError(f"FFmpeg process failed with exit code {proc.returncode}")
            
        if progress_callback and proc.returncode == 0:
            progress_callback(100)
            
    finally:
        if os.path.exists(temp_ass_path):
            try:
                os.remove(temp_ass_path)
            except Exception:
                pass
