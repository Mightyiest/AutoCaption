# AutoCaption Studio ⚡

A high-performance, real-time AI video captioning, styling, and rendering studio designed for creators, editors, and social media repurposing (TikTok, YouTube Shorts, Instagram Reels).

Built with **Faster-Whisper AI**, **Apple Pro Studio Design System**, and **1:1 visual parity** between the live preview canvas and hardcoded video exports.

---

## 🌟 Key Features

### 🎙️ 1. Faster-Whisper Speech-to-Text (Offline AI)
- **Millisecond-Accurate Word Timestamps**: Powered by Faster-Whisper (CTranslate2) with Silero Voice Activity Detection (VAD).
- **Offline Model Cache Manager**: One-click download and offline execution of Whisper models (`Tiny`, `Base`, `Small`, `Medium`, `Large-v3-Turbo`, `Large-v3`).
- **Zero API Fees**: Runs 100% locally on your NVIDIA GPU (CUDA) or multi-threaded CPU with AVX2 vector instructions.

### 🎨 2. Creator Presets & Custom Typography
- **Built-in Viral Presets**:
  - **Hormozi Impact**: Bold uppercase typography with punchy yellow active word pop.
  - **MrBeast Explosive**: Dynamic tilt angles with energetic neon green bounce.
  - **Neon Cyberpunk**: Glowing cyan karaoke fill with vibrant radiance.
  - **Fire Flame**: High-hook red/orange gradient with heavy contrast outline.
  - **Clean Frosted Pill**: Minimalist subtitle pill with backdrop blur.
  - **Comic Marker**: Bangers comic font with playful bounce.
- **Customizable Styling**:
  - Font family, size, weight, letter-spacing, text transform (ALL CAPS / Title Case).
  - Multi-layer text strokes, drop shadows, glow radiance, and background pills.
  - Pacing controls (1 to 4 words per line).

### 🎛️ 3. Pro Multi-Track NLE Timeline
- **Real-Time Visual Audio Waveform**: Decodes audio transients to line up caption starts with spoken vocal peaks.
- **Bird's-Eye Minimap Bar**: Full-duration overview bar with a draggable viewport window to glide across long videos.
- **NLE Track Header Controls**: Left-side sticky track headers with quick audio mute (`A1`) and caption counters (`C1`).
- **Interactive Trimming & Snapping**: Drag, trim, and split blocks with magnetic snapping to playhead, word boundaries, and video frame edges.

### 🚀 4. High-Fidelity Video Export
- **1:1 Visual Parity**: Real-time browser Canvas 2D and FFmpeg rendering producing identical typography, colors, animations, and shadows.
- **Multi-Aspect Ratio**: 9:16 Vertical (Shorts/TikTok), 1:1 Square (Instagram/Feed), and 16:9 Landscape (YouTube).
- **Native Framerate Preservation**: Video exports preserve the exact native framerate (FPS) of the uploaded source video.

---

## ⌨️ Keyboard Shortcuts Cheat Sheet

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>⌘</kbd> + <kbd>Z</kbd> | **Undo** last change (moves, text edits, splits, deletes) | Global |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> + <kbd>Y</kbd> | **Redo** previously undone action | Global |
| <kbd>Space</kbd> or <kbd>K</kbd> | **Play / Pause** video playback | Transport |
| <kbd>S</kbd> | **Split Caption Block** at current playhead | Timeline |
| <kbd>Delete</kbd> or <kbd>Backspace</kbd> | **Delete** the selected caption block | Timeline |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> / <kbd>⌘</kbd> + <kbd>D</kbd> | **Duplicate** selected caption block | Timeline |
| <kbd>←</kbd> / <kbd>→</kbd> (or <kbd>J</kbd> / <kbd>L</kbd>) | **Step 0.1s** (Hold <kbd>Shift</kbd> to step 2.0s) | Transport |
| <kbd>↑</kbd> / <kbd>↓</kbd> | **Select Previous / Next Caption** | Timeline & List |
| <kbd>M</kbd> | Toggle **Magnetic Snapping** | Timeline |
| <kbd>N</kbd> | Toggle **Auto-Follow Playhead** | Timeline |
| <kbd>F</kbd> or <kbd>Ctrl</kbd> + <kbd>0</kbd> | **Zoom to Fit** entire duration | Timeline |
| <kbd>Ctrl</kbd> + <kbd>+</kbd> / <kbd>Ctrl</kbd> + <kbd>-</kbd> | **Zoom In / Out** horizontally | Timeline |
| <kbd>Ctrl</kbd> + <kbd>Wheel</kbd> | Smooth interactive timeline zooming | Timeline |
| <kbd>?</kbd> or <kbd>F1</kbd> | Open **Help & Shortcuts Cheat Sheet** | Global |
| <kbd>Escape</kbd> | Deselect block / Close modal / Exit text input | Global |

---

## ⚡ Quick Start & Setup

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **NVIDIA GPU** (Optional, for CUDA acceleration)

### 2. Automated Installation
Run the installer script to set up Python dependencies, fonts, and frontend packages:
```cmd
install_requirements.bat
```

### 3. Launch Development Server
Launch both the FastAPI backend and Vite frontend with a single click:
```cmd
run_dev.bat
```
- **Frontend App**: `http://localhost:5173`
- **Backend API**: `http://127.0.0.1:8000`

---

## 📁 Repository Structure

```
AutoCaption/
├── backend/
│   ├── app.py                  # FastAPI REST API & routes
│   ├── transcriber.py          # Faster-Whisper AI speech alignment & VAD
│   ├── renderer.py             # FFmpeg libass subtitle burning engine
│   └── storage/                # Local uploads, exports, fonts, and demo media
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx              # Translucent header & AI model selector
│   │   │   ├── VideoPlayer.jsx         # Canvas video stage & transport scrubber
│   │   │   ├── CaptionListEditor.jsx   # Transcript list editor with inline words
│   │   │   ├── StyleInspector.jsx      # Preset, typography, stroke & animation controls
│   │   │   ├── HorizontalTimeline.jsx  # Multi-track NLE timeline
│   │   │   ├── AudioWaveformTrack.jsx  # Real-time PCM audio waveform canvas
│   │   │   ├── TimelineMinimap.jsx     # Bird's-eye overview minimap bar
│   │   │   ├── HelpModal.jsx           # Guide & keyboard shortcuts modal
│   │   │   ├── UploadModal.jsx         # Video import sheet
│   │   │   ├── ExportModal.jsx         # Resolution & quality export sheet
│   │   │   └── SettingsModal.jsx       # Offline AI models manager
│   │   ├── engine/
│   │   │   ├── audioWaveformExtractor.js # Web Audio API PCM decoder
│   │   │   ├── useGlobalShortcuts.js     # Centralized keyboard shortcuts hook
│   │   │   ├── presets.js                # Caption presets definitions
│   │   │   └── timelineGeometry.js       # Timeline math, zooming, and snapping
│   │   └── store/
│   │       └── useEditorStore.js       # Central Zustand state store
├── install_requirements.bat    # Automated environment installer
└── run_dev.bat                 # Concurrent dev runner
```

---

## 📜 License
MIT License. Built with ❤️ for video creators and editors.
