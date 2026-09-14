import os
import sys
import json
import time
import base64
import shutil
import subprocess
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
import imageio_ffmpeg

FONTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage", "fonts")

def get_browser_executable() -> str:
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%PROGRAMFILES%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
            
    for binary in ["chrome", "google-chrome", "msedge", "edge", "chromium"]:
        p = shutil.which(binary)
        if p and os.path.exists(p):
            return p
            
    raise RuntimeError("No Google Chrome or Microsoft Edge browser executable found on system.")

def get_base64_fonts_css() -> str:
    css_rules = []
    if not os.path.exists(FONTS_DIR):
        return ""
        
    font_files = {
        'Montserrat': ['Montserrat-Black.ttf', 'Montserrat-ExtraBold.ttf'],
        'Russo One': ['RussoOne-Regular.ttf'],
        'Bebas Neue': ['BebasNeue-Regular.ttf'],
        'Outfit': ['Outfit-Bold.ttf'],
        'Bangers': ['Bangers-Regular.ttf'],
        'Plus Jakarta Sans': ['PlusJakartaSans-Bold.ttf']
    }
    
    for family, files in font_files.items():
        for f in files:
            full_p = os.path.join(FONTS_DIR, f)
            if os.path.exists(full_p):
                try:
                    with open(full_p, "rb") as font_f:
                        b64 = base64.b64encode(font_f.read()).decode('utf-8')
                        css_rules.append(f"""
@font-face {{
  font-family: '{family}';
  font-weight: 400 900;
  font-style: normal;
  src: url('data:font/truetype;charset=utf-8;base64,{b64}') format('truetype');
}}""")
                except Exception:
                    pass
    return "\n".join(css_rules)

def generate_state_html(style: dict, words_data: list, video_width: int, video_height: int, scale: float) -> str:
    font_family = style.get("fontFamily", "Montserrat")
    font_size = round(float(style.get("fontSize", 34)) * scale, 1)
    font_weight = style.get("fontWeight", "900")
    font_style = style.get("fontStyle", "normal")
    text_transform = style.get("textTransform", "uppercase")
    line_height = style.get("lineHeight", 1.02)
    letter_spacing = round(float(style.get("letterSpacing", -0.5)) * scale, 1)
    word_margin = round((float(style.get("wordSpacing", 8)) / 2.0) * scale, 1)
    text_align = style.get("textAlign", "center")
    
    # Colors & Stroke
    primary_color = style.get("primaryColor", "#FFFFFF")
    active_color = style.get("activeColor", "#FFE600")
    
    stroke_enabled = style.get("strokeEnabled", True)
    stroke_width = round((float(style.get("strokeWidth", 6)) / 2.0) * scale, 1) if stroke_enabled else 0
    stroke_color = style.get("strokeColor", "#000000")
    stroke_css = f"-webkit-text-stroke: {stroke_width}px {stroke_color};" if stroke_width > 0 else "-webkit-text-stroke: none;"
    
    # Shadow & Glow
    shadow_enabled = style.get("shadowEnabled", True)
    shadow_parts = []
    if shadow_enabled and float(style.get("shadowBlur", 8)) > 0 and style.get("shadowColor", "#000000") != "transparent":
        sx = round(float(style.get("shadowOffsetX", 0)) * scale, 1)
        sy = round(float(style.get("shadowOffsetY", 4)) * scale, 1)
        sb = round(float(style.get("shadowBlur", 8)) * scale, 1)
        sc = style.get("shadowColor", "#000000")
        shadow_parts.append(f"{sx}px {sy}px {sb}px {sc}")
        
    glow_enabled = bool(style.get("glowEnabled", False))
    if glow_enabled and float(style.get("glowBlur", 14)) > 0 and style.get("glowColor", "#38BDF8") != "transparent":
        gb = round(float(style.get("glowBlur", 14)) * scale, 1)
        gc = style.get("glowColor", "#38BDF8")
        shadow_parts.append(f"0 0 {gb}px {gc}")
        shadow_parts.append(f"0 0 {round(gb * 1.6, 1)}px {gc}")
        
    text_shadow_css = f"text-shadow: {', '.join(shadow_parts)};" if shadow_parts else "text-shadow: none;"
    
    # Background Pill Box
    is_bg_active = style.get("backgroundEnabled", False) or (style.get("backgroundColor") and style.get("backgroundColor") != "transparent")
    bg_css = "background: transparent;"
    pad_css = "padding: 0px;"
    radius_css = "border-radius: 0px;"
    border_css = "border: none;"
    backdrop_css = "backdrop-filter: none; -webkit-backdrop-filter: none;"
    box_width_css = f"width: {int(video_width * (float(style.get('containerWidthPercent', 90)) / 100.0))}px;"
    
    if is_bg_active:
        hex_col = style.get("backgroundColor", "#0F172A")
        op = float(style.get("backgroundOpacity", 85)) / 100.0
        if hex_col.startswith("#") and len(hex_col) == 7:
            r = int(hex_col[1:3], 16)
            g = int(hex_col[3:5], 16)
            b = int(hex_col[5:7], 16)
            bg_css = f"background: rgba({r}, {g}, {b}, {op});"
        else:
            bg_css = f"background: {hex_col};"
            
        px = round(float(style.get("backgroundPaddingX", 16)) * scale, 1)
        py = round(float(style.get("backgroundPaddingY", 8)) * scale, 1)
        pad_css = f"padding: {py}px {px}px;"
        
        rad = round(float(style.get("borderRadius", 12)) * scale, 1)
        radius_css = f"border-radius: {rad}px;"
        
        if style.get("backgroundBorderEnabled", False):
            bw = round(float(style.get("backgroundBorderWidth", 2)) * scale, 1)
            bc = style.get("backgroundBorderColor", "rgba(255,255,255,0.25)")
            border_css = f"border: {bw}px solid {bc};"
            
        blur_val = round(float(style.get("backgroundBlur", 12)) * scale, 1)
        if blur_val > 0:
            backdrop_css = f"backdrop-filter: blur({blur_val}px); -webkit-backdrop-filter: blur({blur_val}px);"
        box_width_css = f"max-width: {int(video_width * (float(style.get('containerWidthPercent', 90)) / 100.0))}px; width: fit-content; display: inline-block;"
        
    pos_x = float(style.get("positionX", 50))
    pos_y = float(style.get("positionY", 74))
    anim_type = style.get("animationType", "pop")

    # Auto-Emoji & Keyword Emphasis Style Settings
    auto_emoji_enabled = bool(style.get("autoEmojiEnabled", True))
    emoji_anim = style.get("emojiAnimation", "pop")
    emoji_pos = style.get("emojiPosition", "above_word")
    emoji_size = round(float(style.get("emojiSize", 42)) * scale, 1)

    auto_emphasis_enabled = bool(style.get("autoEmphasisEnabled", True))
    emphasis_color = style.get("emphasisColor", "#00FF66")
    emphasis_scale = float(style.get("emphasisScale", 1.15))
    emphasis_mode = str(style.get("emphasisMode", "active_only")).lower()
    
    inlined_fonts = get_base64_fonts_css()
    
    spans = []
    for w in words_data:
        is_act = bool(w.get("active", False))
        is_emph = bool(w.get("is_emphasized", False))
        emoji_str = w.get("emoji", None)

        classes = ["word-token"]
        if is_act:
            classes.append("is-active")
            classes.append(f"anim-{anim_type}")
            if is_emph and auto_emphasis_enabled:
                classes.append("is-emphasized")
        elif is_emph and auto_emphasis_enabled and emphasis_mode == "always":
            classes.append("is-emphasized-always")

        emoji_html = ""
        if auto_emoji_enabled and is_act and emoji_str:
            emoji_style = str(style.get("emojiStyle", "apple")).lower()
            if emoji_style != "system":
                apple_url = f"https://emojicdn.elk.sh/{urllib.parse.quote(emoji_str.strip())}?style=apple"
                emoji_html = f'<img class="emoji-sticker anim-{emoji_anim} pos-{emoji_pos}" src="{apple_url}" alt="{emoji_str}" />'
            else:
                emoji_html = f'<span class="emoji-sticker anim-{emoji_anim} pos-{emoji_pos}">{emoji_str}</span>'

        word_text = w["text"]
        if emoji_pos == "above_word" and emoji_html:
            spans.append(f'<span class="{" ".join(classes)}" style="position: relative;">{emoji_html}{word_text}</span>')
        elif emoji_pos == "inline" and emoji_html:
            spans.append(f'<span class="{" ".join(classes)}">{word_text} {emoji_html}</span>')
        else:
            spans.append(f'<span class="{" ".join(classes)}">{word_text}</span>')

    body_content = "".join(spans) if words_data else ""
    
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Bangers&family=Bebas+Neue&family=Inter:wght@400;700;900&family=Montserrat:wght@700;800;900&family=Outfit:wght@600;700;800;900&family=Plus+Jakarta+Sans:wght@600;700;800&family=Russo+One&display=swap');
{inlined_fonts}

* {{
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}}

body {{
  width: {video_width}px;
  height: {video_height}px;
  background: transparent;
  overflow: hidden;
  position: relative;
}}

#caption-wrapper {{
  position: absolute;
  top: {pos_y}%;
  left: {pos_x}%;
  transform: translate(-50%, -50%);
  text-align: {text_align};
  {box_width_css}
  {bg_css}
  {pad_css}
  {radius_css}
  {border_css}
  {backdrop_css}
  font-family: '{font_family}', sans-serif;
  font-size: {font_size}px;
  font-weight: {font_weight};
  font-style: {font_style};
  line-height: {line_height};
  text-transform: {text_transform};
  letter-spacing: {letter_spacing}px;
  paint-order: stroke fill;
}}

.word-token {{
  display: inline-block;
  margin: 0 {word_margin}px;
  color: {primary_color};
  {stroke_css}
  {text_shadow_css}
  paint-order: stroke fill;
  stroke-linejoin: round;
  -webkit-text-stroke-linejoin: round;
  transform-origin: center center;
  transition: transform 0.1s ease-out;
}}

.word-token.is-active {{
  color: {active_color};
}}

.word-token.is-emphasized-always {{
  color: {emphasis_color};
}}

.word-token.is-active.is-emphasized {{
  color: {emphasis_color} !important;
}}

.word-token.is-active.anim-pop {{
  transform: scale(1.12) translateY(0);
}}

.word-token.is-active.anim-bounce {{
  transform: translateY(-8px) scale(1.05) rotate(0deg);
}}

.word-token.is-active.anim-karaoke {{
  transform: scale(1.05);
}}

.word-token.is-active.anim-fade {{
  opacity: 1.0;
}}

/* Auto-Emoji & Kinetic Sticker Styling */
.emoji-sticker {{
  display: inline-block;
  width: {emoji_size}px;
  height: {emoji_size}px;
  font-size: {emoji_size}px;
  line-height: 1;
  pointer-events: none;
  object-fit: contain;
  vertical-align: middle;
  font-family: "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif;
}}

.emoji-sticker.pos-above_word {{
  position: absolute;
  left: 50%;
  bottom: 110%;
  transform: translateX(-50%);
  white-space: nowrap;
}}

.emoji-sticker.pos-inline {{
  margin-left: 4px;
  vertical-align: middle;
}}

.emoji-sticker.anim-pop {{
  animation: emojiPop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}}

.emoji-sticker.anim-bounce {{
  animation: emojiBounce 0.4s ease-out forwards;
}}

@keyframes emojiPop {{
  0% {{ transform: translateX(-50%) scale(0.6); opacity: 0.8; }}
  50% {{ transform: translateX(-50%) scale(1.35); opacity: 1; }}
  100% {{ transform: translateX(-50%) scale(1.0); opacity: 1; }}
}}

@keyframes emojiBounce {{
  0% {{ transform: translateX(-50%) translateY(0) scale(0.9); }}
  50% {{ transform: translateX(-50%) translateY(-14px) scale(1.15); }}
  100% {{ transform: translateX(-50%) translateY(0) scale(1.0); }}
}}
</style>
</head>
<body>
  <div id="caption-wrapper">
    {body_content}
  </div>
</body>
</html>
"""

def extract_timeline_intervals(segments: list, total_duration: float) -> list:
    intervals = []
    current_time = 0.0
    
    sorted_segs = sorted(segments, key=lambda s: float(s.get("start", 0)))
    
    for seg in sorted_segs:
        words = seg.get("words", [])
        if not words:
            continue
            
        seg_start = float(seg.get("start", 0))
        seg_end = float(seg.get("end", seg_start))
        
        # Gap before segment
        if seg_start > current_time + 0.03:
            intervals.append({
                "type": "empty",
                "start": current_time,
                "end": seg_start,
                "duration": round(seg_start - current_time, 3),
                "words_data": []
            })
            
        n_words = len(words)
        for idx, w in enumerate(words):
            w_start = max(seg_start, float(w.get("start", seg_start)))
            if idx + 1 < n_words:
                next_start = float(words[idx + 1].get("start", w_start))
                w_end = min(seg_end, next_start)
            else:
                w_end = seg_end
                
            if w_end <= w_start:
                w_end = w_start + 0.25
            w_end = min(seg_end, w_end)
            
            words_data = []
            for j, word_obj in enumerate(words):
                raw_txt = (word_obj.get("word", "") if isinstance(word_obj, dict) else str(word_obj)).strip()
                is_active = (j == idx)
                is_emph = bool(word_obj.get("isEmphasized", False)) if isinstance(word_obj, dict) else False
                emoji_str = word_obj.get("emoji", None) if isinstance(word_obj, dict) else None
                words_data.append({
                    "text": raw_txt,
                    "active": is_active,
                    "is_emphasized": is_emph,
                    "emoji": emoji_str
                })
                
            dur = max(0.04, round(w_end - w_start, 3))
            intervals.append({
                "type": "caption",
                "start": w_start,
                "end": w_end,
                "duration": dur,
                "words_data": words_data
            })
            
        current_time = seg_end
        
    if total_duration and total_duration > current_time + 0.05:
        intervals.append({
            "type": "empty",
            "start": current_time,
            "end": total_duration,
            "duration": round(total_duration - current_time, 3),
            "words_data": []
        })
        
    return intervals

def capture_single_snapshot(browser_exe: str, html_path: str, out_png_path: str, video_width: int, video_height: int) -> bool:
    file_url = 'file:///' + os.path.abspath(html_path).replace('\\', '/')
    abs_out_png = os.path.abspath(out_png_path)
    
    cmd = [
        browser_exe,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--default-background-color=00000000",
        f"--window-size={video_width},{video_height}",
        f"--screenshot={abs_out_png}",
        file_url
    ]
    try:
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15)
        return res.returncode == 0 and os.path.exists(abs_out_png)
    except (subprocess.TimeoutExpired, Exception):
        return False

def render_captioned_video_dom(
    source_video_path: str,
    output_video_path: str,
    segments: list,
    style: dict,
    video_width: int = 1080,
    video_height: int = 1920,
    video_duration: float = None,
    encoder_mode: str = "gpu_nvenc",
    on_proc_ready = None,
    progress_callback = None
) -> None:
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    browser_exe = get_browser_executable()
    
    # Uniform Scale from 360 canonical preview baseline to target resolution
    base_w = 360.0 if video_width <= video_height else 640.0
    scale = video_width / base_w
    
    temp_dir = os.path.join(os.path.dirname(os.path.abspath(output_video_path)), f"tmp_dom_{int(time.time() * 1000)}")
    os.makedirs(temp_dir, exist_ok=True)
    
    try:
        # 1. Extract Timeline intervals
        intervals = extract_timeline_intervals(segments, video_duration or 10.0)
        
        # 2. Identify unique display states and generate HTML files
        state_map = {} # html_content -> png_path
        tasks_to_render = []
        frame_manifest = []
        
        for idx, inter in enumerate(intervals):
            html_str = generate_state_html(style, inter.get("words_data", []), video_width, video_height, scale)
            
            if html_str not in state_map:
                state_idx = len(state_map)
                html_path = os.path.join(temp_dir, f"state_{state_idx:04d}.html")
                png_path = os.path.join(temp_dir, f"state_{state_idx:04d}.png")
                
                with open(html_path, "w", encoding="utf-8") as f:
                    f.write(html_str)
                    
                state_map[html_str] = png_path
                tasks_to_render.append((browser_exe, html_path, png_path, video_width, video_height))
                
            frame_manifest.append({
                "path": state_map[html_str],
                "duration": inter["duration"]
            })
            
        # 3. Parallel snapshot capture using ThreadPool (4 workers)
        completed_count = 0
        total_tasks = len(tasks_to_render)
        
        with ThreadPoolExecutor(max_workers=min(4, os.cpu_count() or 4)) as executor:
            futures = [
                executor.submit(capture_single_snapshot, t[0], t[1], t[2], t[3], t[4])
                for t in tasks_to_render
            ]
            for f in futures:
                f.result()
                completed_count += 1
                if progress_callback and total_tasks > 0:
                    pct = int(completed_count / total_tasks * 50)
                    progress_callback(pct)
                    
        # 4. Generate FFmpeg Concat List
        concat_txt = os.path.join(temp_dir, "concat_frames.txt")
        with open(concat_txt, "w", encoding="utf-8") as f:
            f.write("ffconcat version 1.0\n")
            for item in frame_manifest:
                clean_p = item["path"].replace("\\", "/")
                f.write(f"file '{clean_p}'\n")
                f.write(f"duration {max(0.03, item['duration']):.3f}\n")
            # FFmpeg concat requires repeating the last file
            last_p = frame_manifest[-1]["path"].replace("\\", "/")
            f.write(f"file '{last_p}'\n")
            
        # 5. FFmpeg Video Normalization (Cover Crop to 1080x1920) + Concat Overlay
        cmd = [
            ffmpeg_exe,
            "-y",
            "-i", source_video_path,
            "-f", "concat",
            "-safe", "0",
            "-i", concat_txt,
            "-filter_complex",
            f"[0:v]scale={video_width}:{video_height}:force_original_aspect_ratio=increase,crop={video_width}:{video_height}[bg]; [bg][1:v]overlay=0:0:shortest=1[outv]",
            "-map", "[outv]",
            "-map", "0:a?",
        ]
        
        if encoder_mode == "gpu_nvenc":
            cmd.extend(["-c:v", "h264_nvenc", "-preset", "p4", "-cq", "20"])
        else:
            cmd.extend(["-c:v", "libx264", "-preset", "fast", "-crf", "18"])
            
        cmd.extend(["-c:a", "aac", "-b:a", "192k", output_video_path])
        
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if on_proc_ready:
            try:
                on_proc_ready(proc)
            except Exception:
                pass
        stdout, stderr = proc.communicate()
        
        if proc.returncode != 0:
            # Fallback to CPU libx264 if GPU NVENC was not supported
            if encoder_mode == "gpu_nvenc":
                cmd_fallback = [c if c != "h264_nvenc" else "libx264" for c in cmd]
                cmd_fallback = [c if c != "-cq" else "-crf" for c in cmd_fallback]
                cmd_fallback = [c if c != "20" else "18" for c in cmd_fallback]
                p2 = subprocess.Popen(cmd_fallback, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                if on_proc_ready:
                    try:
                        on_proc_ready(p2)
                    except Exception:
                        pass
                p2.communicate()
                if p2.returncode != 0:
                    raise RuntimeError(f"FFmpeg render error: {stderr}")
            else:
                raise RuntimeError(f"FFmpeg render error: {stderr}")
                
        if progress_callback:
            progress_callback(100)
            
    finally:
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass
