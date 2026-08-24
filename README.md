# AutoCaption Studio ⚡

A super lightweight, high-performance video captioning studio optimized for **short-form content** (TikTok, YouTube Shorts, Instagram Reels). Powered by **Whisper AI** with word-level speech alignment, customizable styling, viral presets, dynamic animations, and hardware-accelerated video export.

---

## Key Features

- **⚡ Word-Level Whisper Alignment**: Powered by `faster-whisper` (CTranslate2) with Silero VAD to provide millisecond-accurate timestamps for every spoken word.
- **🎨 Viral Caption Presets**:
  - **Hormozi Impact**: Bold uppercase font with punchy yellow active word pop.
  - **MrBeast Explosive**: Angle-rotated letters with energetic neon green bounce.
  - **Neon Cyberpunk**: Glowing cyan karaoke fill with pulsing radiance.
  - **Fire Flame**: High-hook red/orange gradient with heavy contrast outline.
  - **Clean Frosted Pill**: Minimalist subtitle pill with backdrop blur.
  - **Comic Marker**: Bangers / cartoon style with playful bounce.
- **📱 9:16 Short-Form Viewport**:
  - Safe-zone guides for TikTok/Shorts UI overlays (header, right-hand icons, bottom sound track).
  - Draggable & resizable caption overlay box.
- **✂️ Interactive Timeline & Word Editor**:
  - Click any word to fix typos or adjust spelling in-place.
  - Split / Merge caption segments with one click.
  - Adjust timing and word pacing (1–4 words per line).
- **🚀 High-Speed Hardware Video Burning**:
  - Generates ASS (Advanced SubStation Alpha) subtitles with karaoke tags (`\k`).
  - Burns subtitles into lossless 1080x1920 MP4 via native FFmpeg.

---

## Quick Start

### 1. Prerequisites
- Python 3.10+
- Node.js 18+

### 2. Launch
Double-click `run_dev.bat` or run manually:

**Backend**:
```bash
cd backend
python app.py
```
*Backend runs on `http://127.0.0.1:8000`*

**Frontend**:
```bash
cd frontend
npm run dev
```
*Open `http://localhost:5173` in your browser*

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause video |
| `←` / `→` | Step back / forward 2 seconds |
| `Click on Word` | Jump playhead to word timestamp |
| `Double Click / Edit icon` | Edit word spelling in timeline |
