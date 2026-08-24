# Export & Video Rendering Pipeline

## 1. Overview
The export engine permanently burns styled, animated captions onto the source video. It provides both server-side native FFmpeg rendering (high speed, hardware-accelerated) and browser-based client export.

---

## 2. Rendering Pipelines

### Method A: Backend Native FFmpeg (Recommended for Production)
The backend converts the active style and word-level timestamps into an `.ass` (Advanced SubStation Alpha) file and executes FFmpeg:

```bash
ffmpeg -y -i input.mp4 \
  -vf "ass=subtitles.ass:fontsdir=fonts/" \
  -c:v libx264 -preset veryfast -crf 18 \
  -c:a copy \
  output_captioned.mp4
```

#### Hardware Acceleration Support:
- **NVIDIA GPU**: `-c:v h264_nvenc -preset p4` (10x faster export).
- **Intel QuickSync**: `-c:v h264_qsv`.
- **Apple Silicon**: `-c:v h264_videotoolbox`.

### Method B: Client-Side WebCodecs / Canvas Recorder (Zero-Server Mode)
1. Hidden offscreen `<canvas width="1080" height="1920">`.
2. Step through video frame-by-frame (`video.requestVideoFrameCallback` or seek loop).
3. Draw video frame + draw animated text overlay directly to 2D canvas context.
4. Capture stream via `canvas.captureStream(60)` or WebCodecs `VideoEncoder`.
5. Multiplex original audio track using `WebAudio` / `MediaRecorder` or `@ffmpeg/ffmpeg` WASM.
6. Trigger direct browser download.

---

## 3. Dynamic ASS Subtitle Generator Logic

```python
def generate_ass_file(segments, style, video_width=1080, video_height=1920):
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {video_width}
PlayResY: {video_height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,{style['fontFamily']},{style['fontSize']},{hex_to_ass(style['primaryColor'])},{hex_to_ass(style['activeColor'])},{hex_to_ass(style['strokeColor'])},{hex_to_ass(style['shadowColor'])},-1,0,0,0,100,100,0,0,1,{style['strokeWidth']},{style['shadowBlur']},2,40,40,{int(video_height * (1 - style['positionY']/100))},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for seg in segments:
        start_fmt = format_ass_time(seg["start"])
        end_fmt = format_ass_time(seg["end"])
        
        # Build karaoke text with timing tags
        karaoke_text = ""
        for w in seg["words"]:
            duration_cs = int((w["end"] - w["start"]) * 100)
            clean_word = w["word"].strip().upper() if style.get("uppercase") else w["word"].strip()
            karaoke_text += f"{{\\k{duration_cs}}}{clean_word} "
            
        events.append(f"Dialogue: 0,{start_fmt},{end_fmt},Caption,,0,0,0,,{karaoke_text.strip()}")
        
    return header + "\n".join(events)
```

---

## 4. Export Configurations & Presets

| Target Platform | Aspect Ratio | Resolution | Frame Rate | Bitrate |
|---|---|---|---|---|
| **TikTok / Reels / Shorts** | 9:16 | 1080 x 1920 | 60 fps / 30 fps | 8,000 kbps |
| **Instagram Feed** | 1:1 | 1080 x 1080 | 30 fps | 6,000 kbps |
| **YouTube Standard** | 16:9 | 1920 x 1080 | 60 fps / 30 fps | 10,000 kbps |
