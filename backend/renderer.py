import os
import sys
import re
import uuid
import subprocess
import tempfile
import time
import json
import threading
import imageio_ffmpeg

FONTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage", "fonts")

FONT_NAME_MAP = {
    "Montserrat": "Montserrat Black",
    "Russo One": "Russo One",
    "Outfit": "Outfit Bold",
    "Bebas Neue": "Bebas Neue",
    "Bangers": "Bangers",
    "Plus Jakarta Sans": "Plus Jakarta Sans Bold",
    "Inter": "Montserrat Black"
}

def get_video_stream_info(path: str):
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    dur = 10.0
    fps = 30.0
    has_audio = False
    try:
        proc = subprocess.run(
            [ffmpeg_exe, "-hide_banner", "-i", path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=10
        )
        out = proc.stderr or ""
        dur_m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", out)
        if dur_m:
            h, m, s = dur_m.groups()
            dur = int(h) * 3600 + int(m) * 60 + float(s)
        fps_m = re.search(r"(\d+(?:\.\d+)?)\s*fps", out)
        if fps_m:
            fps = float(fps_m.group(1))
        if re.search(r"Stream\s+#\d+:\d+.*:\s*Audio:", out, re.IGNORECASE) or "Audio:" in out:
            has_audio = True
    except Exception:
        pass
    return dur, fps, has_audio

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
        
    r, g, b = val[0:2], val[2:4], val[4:6]
    return f"&H{alpha_hex}{b.upper()}{g.upper()}{r.upper()}&"

def format_ass_timestamp(seconds: float) -> str:
    total_ms = int(round(seconds * 100))
    cs = total_ms % 100
    total_s = total_ms // 100
    s = total_s % 60
    total_m = total_s // 60
    m = total_m % 60
    h = total_m // 60
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

def get_word_display_intervals(segment: dict) -> list:
    words = segment.get("words", [])
    if not words:
        return []
        
    intervals = []
    for i, w in enumerate(words):
        w_start = float(w.get("start", segment["start"]))
        w_end = float(w.get("end", segment["end"]))
        
        # Guard against zero-duration or inverted word intervals
        if w_end <= w_start:
            w_end = w_start + 0.15
            
        intervals.append({
            "active_index": i,
            "start": w_start,
            "end": w_end
        })
    return intervals

def build_animation_tags(anim_type: str, duration_ms: int, org_x: int, org_y: int) -> str:
    anim_type = (anim_type or "pop").lower()
    
    if anim_type == "none":
        return ""
        
    if anim_type == "pop":
        t1 = min(60, duration_ms)
        t2 = min(110, duration_ms)
        return f"\\org({org_x},{org_y})\\fscx95\\fscy95\\t(0,{t1},\\fscx112\\fscy112)\\t({t1},{t2},\\fscx100\\fscy100)"
        
    if anim_type == "bounce":
        t1 = min(70, duration_ms)
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
    preview_base_width: float = 1080.0,
    preview_metrics: dict = None
) -> str:
    metrics = preview_metrics or {}
    ref_w = 1080.0 if video_height >= video_width else 1920.0
    ref_h = 1920.0 if video_height >= video_width else 1080.0
    
    # If container_width is provided and >= 720, use it; otherwise normalize to canonical reference dimensions
    passed_w = float(metrics.get("container_width", 0) or 0)
    passed_h = float(metrics.get("container_height", 0) or 0)
    
    base_w = passed_w if passed_w >= 720.0 else ref_w
    base_h = passed_h if passed_h >= 720.0 else ref_h
    
    scale_x = video_width / base_w
    scale_y = video_height / base_h
    uniform_scale = scale_y
    
    raw_font_family = str(style.get("fontFamily", "Montserrat")).strip()
    font_family = FONT_NAME_MAP.get(raw_font_family, raw_font_family)
    
    raw_font_size = float(style.get("fontSize", 34))
    ass_font_size = int(round(raw_font_size * uniform_scale))
    
    pri_col = hex_to_ass_color(style.get("primaryColor", "#FFFFFF"))
    act_col = hex_to_ass_color(style.get("activeColor", "#FFE600"))
    emph_col = hex_to_ass_color(style.get("emphasisColor", "#00FF66"))
    auto_emphasis_enabled = bool(style.get("autoEmphasisEnabled", True))
    active_highlight_enabled = bool(style.get("activeHighlightEnabled", True))
    emphasis_mode = str(style.get("emphasisMode", "active_only")).lower()
    
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
    shad_tag = f"\\xshad{shadow_offset_x}\\yshad{shadow_offset_y}" if has_shadow else "\\xshad0\\yshad0"

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
                    is_emph = bool(w.get("isEmphasized", False)) if isinstance(w, dict) else False

                    if is_active:
                        anim_tag = build_animation_tags(anim_type, dur_ms, pos_x, line_y)
                        if is_emph and auto_emphasis_enabled:
                            target_col = emph_col
                        elif active_highlight_enabled:
                            target_col = act_col
                        else:
                            target_col = pri_col
                        tok = f"{{\\c{target_col}{italic_tag}{anim_tag}}}{word_txt}{{\\rMainStyle}}"
                    elif is_emph and auto_emphasis_enabled and emphasis_mode == "always":
                        tok = f"{{\\c{emph_col}{italic_tag}}}{word_txt}{{\\rMainStyle}}"
                    else:
                        tok = f"{{\\c{pri_col}{italic_tag}}}{word_txt}{{\\rMainStyle}}"
                    tokens.append(tok)

                line_str = " ".join(tokens)
                ass_content.append(
                    f"Dialogue: 1,{start_ts},{end_ts},MainStyle,,0,0,0,,{{\\an{align_num}\\pos({pos_x},{line_y})\\fsp{ass_spacing}{italic_tag}{blur_tag}{shad_tag}}}{line_str}"
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
    temp_ass_filename = f"sub_{uuid.uuid4().hex[:12]}.ass"
    temp_ass_path = os.path.join(temp_dir, temp_ass_filename)
    
    # Save debug snapshot
    debug_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage", "debug")
    os.makedirs(debug_dir, exist_ok=True)
    
    ass_text = generate_ass_subtitle(
        segments=segments,
        style=style,
        video_width=video_width,
        video_height=video_height,
        preview_base_width=1080.0,
        preview_metrics=preview_metrics
    )
    
    with open(temp_ass_path, "w", encoding="utf-8") as f:
        f.write(ass_text)
        
    debug_ass_path = os.path.join(debug_dir, f"render_{int(time.time())}.ass")
    with open(debug_ass_path, "w", encoding="utf-8") as f:
        f.write(ass_text)
        
    try:
        escaped_ass_path = temp_ass_path.replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
        escaped_fonts_dir = FONTS_DIR.replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
        
        audio_exts = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".wma"}
        _, src_ext = os.path.splitext(source_video_path.lower())
        is_audio_only = src_ext in audio_exts

        probed_dur, native_fps, has_audio = get_video_stream_info(source_video_path)
        duration = float(video_duration) if video_duration and float(video_duration) > 0.5 else probed_dur
        total_frames = int(round(duration * (native_fps if native_fps > 0 else 30.0)))

        def build_cmd(use_nvenc: bool):
            if use_nvenc:
                c_codec = ["-c:v", "h264_nvenc", "-preset", "p4", "-cq", "19", "-pix_fmt", "yuv420p"]
            else:
                c_codec = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p"]

            if is_audio_only:
                vf = f"ass=filename='{escaped_ass_path}':fontsdir='{escaped_fonts_dir}'"
                return [
                    ffmpeg_exe, "-y",
                    "-f", "lavfi",
                    "-i", f"color=c=white:s={video_width}x{video_height}:r=30:d={duration}",
                    "-i", source_video_path,
                    "-vf", vf,
                    *c_codec,
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-shortest",
                    "-progress", "pipe:1",
                    output_video_path
                ]
            else:
                vf = f"scale={video_width}:{video_height}:force_original_aspect_ratio=increase,crop={video_width}:{video_height},ass=filename='{escaped_ass_path}':fontsdir='{escaped_fonts_dir}'"
                audio_args = ["-c:a", "aac", "-b:a", "192k"] if has_audio else ["-an"]
                return [
                    ffmpeg_exe, "-y",
                    "-i", source_video_path,
                    "-vf", vf,
                    *c_codec,
                    *audio_args,
                    "-progress", "pipe:1",
                    output_video_path
                ]

        use_gpu = (encoder_mode == "gpu_nvenc")
        cmd = build_cmd(use_gpu)
        
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        if on_proc_ready:
            try:
                on_proc_ready(proc)
            except Exception:
                pass

        stderr_lines = []
        def _drain_stderr(p):
            try:
                for err_line in iter(p.stderr.readline, ''):
                    if not err_line:
                        break
                    line_clean = err_line.strip()
                    if line_clean:
                        stderr_lines.append(line_clean)
                        if len(stderr_lines) > 50:
                            stderr_lines.pop(0)
            except Exception:
                pass
            finally:
                try:
                    p.stderr.close()
                except Exception:
                    pass

        t_err = threading.Thread(target=_drain_stderr, args=(proc,), daemon=True)
        t_err.start()
        
        last_pct = 5
        cur_frame = 0
        cur_fps = 0.0
        cur_speed = "1x"
        
        while True:
            line = proc.stdout.readline()
            if not line and proc.poll() is not None:
                break
            if not line:
                continue
                
            line = line.strip()
            if line.startswith("frame="):
                try:
                    cur_frame = int(line.split("=")[1].strip())
                except Exception:
                    pass
            elif line.startswith("fps="):
                try:
                    cur_fps = float(line.split("=")[1].strip())
                except Exception:
                    pass
            elif line.startswith("speed="):
                try:
                    cur_speed = line.split("=")[1].strip()
                except Exception:
                    pass
            elif line.startswith("out_time_ms="):
                try:
                    out_ms = int(line.split("=")[1].strip())
                    if progress_callback and duration > 0:
                        pct = min(99, int((out_ms / 1000000.0) / duration * 100))
                        last_pct = max(last_pct, pct)
                        progress_callback({
                            "percent": last_pct,
                            "current_frame": cur_frame,
                            "total_frames": total_frames,
                            "fps": cur_fps,
                            "speed": cur_speed,
                            "message": f"Frame {cur_frame}/{total_frames} ({cur_fps} FPS)" if total_frames > 0 else f"Burning captions: {last_pct}%"
                        })
                except Exception:
                    pass
            elif line.startswith("duration="):
                try:
                    dur_val = float(line.split("=")[1].strip())
                    if dur_val > 0:
                        duration = dur_val
                        total_frames = int(round(duration * (native_fps if native_fps > 0 else 30.0)))
                except Exception:
                    pass
                    
        proc.wait()
        try:
            t_err.join(timeout=1.0)
        except Exception:
            pass

        # If GPU NVENC failed, fallback gracefully to CPU libx264
        if proc.returncode != 0 and use_gpu:
            cmd_fallback = build_cmd(use_nvenc=False)
            proc_fb = subprocess.Popen(
                cmd_fallback,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            if on_proc_ready:
                try:
                    on_proc_ready(proc_fb)
                except Exception:
                    pass

            stderr_lines = []
            t_err2 = threading.Thread(target=_drain_stderr, args=(proc_fb,), daemon=True)
            t_err2.start()

            while True:
                line = proc_fb.stdout.readline()
                if not line and proc_fb.poll() is not None:
                    break
                if not line:
                    continue
                line = line.strip()
                if line.startswith("frame="):
                    try:
                        cur_frame = int(line.split("=")[1].strip())
                    except Exception:
                        pass
                elif line.startswith("fps="):
                    try:
                        cur_fps = float(line.split("=")[1].strip())
                    except Exception:
                        pass
                elif line.startswith("out_time_ms="):
                    try:
                        out_ms = int(line.split("=")[1].strip())
                        if progress_callback and duration > 0:
                            pct = min(99, int((out_ms / 1000000.0) / duration * 100))
                            last_pct = max(last_pct, pct)
                            progress_callback({
                                "percent": last_pct,
                                "current_frame": cur_frame,
                                "total_frames": total_frames,
                                "fps": cur_fps,
                                "speed": cur_speed,
                                "message": f"Frame {cur_frame}/{total_frames} ({cur_fps} FPS)" if total_frames > 0 else f"Burning captions: {last_pct}%"
                            })
                    except Exception:
                        pass
            proc_fb.wait()
            try:
                t_err2.join(timeout=1.0)
            except Exception:
                pass
            proc = proc_fb

        if proc.returncode != 0:
            err_summary = "\n".join(stderr_lines[-10:]) if stderr_lines else "No stderr logged"
            raise RuntimeError(f"FFmpeg process failed with exit code {proc.returncode}:\n{err_summary}")
            
        if progress_callback and proc.returncode == 0:
            progress_callback({
                "percent": 100,
                "current_frame": total_frames,
                "total_frames": total_frames,
                "fps": cur_fps,
                "speed": cur_speed,
                "message": "Caption burn-in complete!"
            })
            
    finally:
        if os.path.exists(temp_ass_path):
            try:
                os.remove(temp_ass_path)
            except Exception:
                pass
