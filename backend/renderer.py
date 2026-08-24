import os
import sys
import subprocess
import tempfile
import time
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

def hex_to_ass_color(hex_str: str, alpha_hex: str = "00") -> str:
    if not hex_str or hex_str == "transparent":
        return f"&H{alpha_hex}FFFFFF&"
    hex_str = hex_str.strip().lstrip("#")
    if len(hex_str) == 3:
        hex_str = "".join([c * 2 for c in hex_str])
    elif len(hex_str) == 8:
        r, g, b, a = hex_str[0:2], hex_str[2:4], hex_str[4:6], hex_str[6:8]
        inv_a = f"{255 - int(a, 16):02X}"
        return f"&H{inv_a}{b}{g}{r}&"
        
    if len(hex_str) != 6:
        return f"&H{alpha_hex}FFFFFF&"
        
    r = hex_str[0:2].upper()
    g = hex_str[2:4].upper()
    b = hex_str[4:6].upper()
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

def generate_ass_subtitle(
    segments: list,
    style: dict,
    video_width: int = 1080,
    video_height: int = 1920,
    preview_base_width: float = 310.0,
    preview_metrics: dict = None
) -> str:
    # Use preview_metrics for accurate scaling based on actual preview container dimensions
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
    
    # CSS paint-order: stroke fill exposes only 50% of the stroke outward
    # ASS Outline expands 100% outward, so we must halve the CSS stroke width
    raw_stroke = float(style.get("strokeWidth", 6))
    # Divide by 2 to compensate for ASS drawing 100% outward vs CSS 50% outward
    ass_stroke_width = max(0, int(round((raw_stroke / 2.0) * scale)))
    
    # Ambient soft-edge glow matching CSS text-shadow: 0 0 {shadowBlur}px (no directional shelf)
    raw_shadow = float(style.get("shadowBlur", 8))
    # Scale shadow blur proportionally; CSS shadowBlur of 8px maps to ASS blur of ~3
    ass_blur = max(0.0, round((raw_shadow / 8.0) * 3.0, 1)) if raw_shadow > 0 else 0.0
    
    # Character tracking / letter spacing (-0.5px CSS -> -2px in 1080p ASS, +3px for Bebas Neue)
    ass_spacing = 3 if raw_font_family == "Bebas Neue" else -2
    
    pos_x = int(round(video_width * (float(style.get("positionX", 50)) / 100.0)))
    pos_y = int(round(video_height * (float(style.get("positionY", 74)) / 100.0)))
    # Use measured line height from preview if available, otherwise fallback
    fallback_line_h = int(round(ass_font_size * 1.15))
    
    is_uppercase = style.get("textTransform", "uppercase") == "uppercase"
    anim_type = style.get("animationType", "pop")
    
    # Suppress synthetic faux-bolding on fonts that are already native Black/ExtraBold
    is_heavy_font = any(k in font_family.lower() for k in ["black", "extrabold", "bold", "russo", "bangers"])
    ass_bold_flag = 0 if is_heavy_font else -1
    
    # ASS Header
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
    
    # Shadow and blur tags for dialogue events
    # Always include shadow tags - even with 0 stroke, shadows should render
    # Use \blur tag for soft glow effect (CSS text-shadow equivalent)
    blur_tag = f"\\blur{ass_blur}" if ass_blur > 0 else ""

    for seg in segments:
        words = seg.get("words", [])
        if not words:
            continue
            
        n_words = len(words)
        
        # Use exact measured lines from previewer if provided
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
            # Fallback line splitting
            if n_words <= 3:
                lines = [words]
            else:
                mid = (n_words + 1) // 2
                lines = [words[:mid], words[mid:]]

        num_lines = len(lines)
        measured_offsets = seg.get("measured_line_offsets")
        measured_line_height = seg.get("measured_line_height")
        
        # Use measured line height from preview if available for accurate spacing
        effective_line_h = int(round(measured_line_height * scale)) if measured_line_height else fallback_line_h
        
        if measured_offsets and isinstance(measured_offsets, list) and len(measured_offsets) == num_lines:
            y_offsets = [
                int(round(pos_y + (measured_offsets[i] * scale)))
                for i in range(num_lines)
            ]
        else:
            y_offsets = [
                int(round(pos_y + (i - (num_lines - 1) / 2.0) * effective_line_h))
                for i in range(num_lines)
            ]

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
                        else: # "pop"
                            tok = f"{{\\c{act_col}\\fscx106\\fscy106\\t(0,80,\\fscx102\\fscy102)}}{word_txt}{{\\rBaseStyle}}"
                    else:
                        tok = f"{{\\c{pri_col}}}{word_txt}{{\\rBaseStyle}}"

                    tokens.append(tok)

                # 3 spaces between words replicate CSS margin: 0 4px in ASS video space
                line_str = "   ".join(tokens)
                ass_content.append(f"Dialogue: 0,{start_ts},{end_ts},BaseStyle,,0,0,0,,{{\\an5\\pos({pos_x},{line_y}){blur_tag}}}{line_str}")

    return "\n".join(ass_content)

def render_captioned_video(
    source_video_path: str,
    output_video_path: str,
    segments: list,
    style: dict,
    video_width: int = 1080,
    video_height: int = 1920,
    encoder_mode: str = "cpu",
    preview_metrics: dict = None,
    progress_callback=None
) -> None:
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    
    temp_dir = os.path.dirname(os.path.abspath(output_video_path))
    os.makedirs(temp_dir, exist_ok=True)
    temp_ass_path = os.path.join(temp_dir, f"sub_{os.path.basename(output_video_path)}.ass")
    
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
        
    try:
        escaped_ass_path = temp_ass_path.replace("\\", "/").replace(":", "\\:")
        escaped_fonts_dir = FONTS_DIR.replace("\\", "/").replace(":", "\\:")
        
        vf_filter = f"ass='{escaped_ass_path}':fontsdir='{escaped_fonts_dir}'"
        
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
        
        for line in proc.stdout:
            line = line.strip()
            if line.startswith("out_time_us=") and progress_callback:
                try:
                    us = int(line.split("=")[1])
                    current_sec = us / 1_000_000.0
                    progress_callback(current_sec)
                except Exception:
                    pass
            elif line.startswith("progress=end") and progress_callback:
                progress_callback(999999)
                
        proc.wait()
        
        if proc.returncode != 0 and encoder_mode == "gpu_nvenc":
            fallback_cmd = [
                ffmpeg_exe,
                "-y",
                "-i", source_video_path,
                "-vf", vf_filter,
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "18",
                "-c:a", "copy",
                "-progress", "pipe:1",
                output_video_path
            ]
            fb_proc = subprocess.Popen(fallback_cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
            fb_proc.wait()
            if fb_proc.returncode != 0:
                raise RuntimeError("FFmpeg render failed on both GPU and CPU fallback.")
        elif proc.returncode != 0:
            raise RuntimeError(f"FFmpeg render failed with exit code {proc.returncode}")

    finally:
        if os.path.exists(temp_ass_path):
            try:
                os.remove(temp_ass_path)
            except Exception:
                pass
