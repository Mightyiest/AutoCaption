# AutoCaption Codebase Intelligence & Agent Directory

Welcome to the **AutoCaption** codebase. AutoCaption is a high-performance, real-time video captioning, styling, animation, and export system with 1:1 visual fidelity between the browser DOM preview and FFmpeg/libass hardcoded exports.

---

## 🧭 Repository Quick Map

| Path | Purpose | Key Technologies |
| :--- | :--- | :--- |
| [`frontend/`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend) | Single-page caption editor UI & live preview engine | React 18, Vite, Zustand, Tailwind/Vanilla CSS |
| [`backend/`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/backend) | AI speech-to-text & high-speed ASS/FFmpeg rendering | Python 3.10+, FastAPI, Faster-Whisper, libass |
| [`backend/storage/`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/backend/storage) | Temporary media, font assets, and render artifacts | uploads, exports, debug, fonts, demo |
| [`plan/`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/plan) | Architectural blueprints and feature specifications | Markdown specifications |
| [`install_requirements.bat`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/install_requirements.bat) | Automated installer for Python dependencies, npm packages, fonts, and Whisper models | Batch script |
| [`run_dev.bat`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/run_dev.bat) | Root runner script launching frontend + backend concurrently | Batch script |

---

## 🗂️ Detailed File Location Index

### 1. Frontend Architecture (`frontend/src/`)

```
frontend/src/
├── App.jsx                     # Root application frame, layout grid, keyboard shortcuts
├── App.css                     # Root application container & modal animations
├── index.css                   # Global CSS theme variables, fonts, glassmorphism, scrollbars
├── main.jsx                    # React entry point
│
├── store/
│   └── useEditorStore.js       # Central Zustand store (video, captions, styles, export, ui)
│
├── components/
│   ├── Navbar.jsx              # Header bar: quick actions, video open, export trigger, theme
│   ├── VideoPlayer.jsx         # Custom HTML5 video player + DOM caption overlay layer
│   ├── StyleInspector.jsx      # Right-panel inspector for typography, colors, animations, borders
│   ├── CaptionListEditor.jsx   # Left-panel word/segment list editor with live timestamps
│   ├── HorizontalTimeline.jsx  # Bottom zoomable multi-track timeline (audio waveforms, word blocks)
│   ├── TimelineEditor.jsx      # Alternative timeline track controller with scrubbing
│   ├── UploadModal.jsx         # Drag-and-drop video upload + transcription settings
│   ├── ExportModal.jsx         # Video export modal with resolution, CRF quality, live progress
│   └── ConsoleDrawer.jsx       # Bottom slide-out log drawer for backend & FFmpeg output
│
└── engine/
    ├── presets.js              # Built-in caption presets (MrBeast, Hormozi, Neon, Minimal, etc.)
    ├── layoutMeasurer.js       # Real-time DOM text metrics calculator matching libass bounding boxes
    └── animator.js             # CSS keyframe generation for active word pops, bounces, glows
```

### 2. Backend Architecture (`backend/`)

```
backend/
├── app.py                      # FastAPI REST application & static file mounts
├── transcriber.py              # Faster-Whisper audio transcription engine with word timestamps
├── renderer.py                 # ASS subtitle script generator & FFmpeg libass video burn-in
├── download_fonts.py           # Automated Google Fonts downloader (.ttf into storage/fonts)
├── download_models.py          # Faster-Whisper model pre-fetcher script
├── requirements.txt            # Python dependencies (fastapi, faster-whisper, uvicorn, etc.)
│
└── storage/
    ├── uploads/                # Incoming uploaded MP4/MOV/MKV video files
    ├── exports/                # Outgoing rendered MP4 video files with burned-in captions
    ├── fonts/                  # TrueType/OpenType font files for libass rendering
    ├── debug/                  # Render payloads (.json) and generated ASS files (.ass)
    └── demo/                   # Pre-bundled demo assets
```

### 3. Architecture Blueprints (`plan/`)

- [`00_MASTER_ARCHITECTURE.md`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/plan/00_MASTER_ARCHITECTURE.md): System design, data contracts, and pipeline overview.
- [`01_TRANSCRIPTION_ENGINE.md`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/plan/01_TRANSCRIPTION_ENGINE.md): Faster-Whisper pipeline, VAD, word-level segmentation.
- [`02_ANIMATION_AND_STYLING_ENGINE.md`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/plan/02_ANIMATION_AND_STYLING_ENGINE.md): Preset definitions, animation mechanics, CSS engine.
- [`03_UI_AND_INTERACTIVE_EDITOR.md`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/plan/03_UI_AND_INTERACTIVE_EDITOR.md): Timeline scrubbing, word editing, style inspector.
- [`04_EXPORT_AND_VIDEO_RENDERER.md`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/plan/04_EXPORT_AND_VIDEO_RENDERER.md): Libass subtitle synthesis, FFmpeg encoding matrix.
- [`05_STEP_BY_STEP_EXECUTION.md`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/plan/05_STEP_BY_STEP_EXECUTION.md): Implementation milestone checklist.
- [`1_1_fidelity_plan.md`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/plan/1_1_fidelity_plan.md): Exact 1:1 DOM-to-FFmpeg styling alignment guide.
- [`CAPTION_RENDERING_REPORT.md`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/CAPTION_RENDERING_REPORT.md): Deep-dive audit comparing ASS subtitle rendering with DOM layouts.

---

## ⚡ Core Data Flow

```
[User Video File]
       │
       ▼
[UploadModal.jsx] ──(POST /transcribe)──► [backend/app.py]
                                               │
                                               ▼
                                      [backend/transcriber.py]
                                      (Faster-Whisper + VAD)
                                               │
                                               ▼
                                      [Word-level Timestamps JSON]
                                               │
       ┌───────────────────────────────────────┘
       ▼
[useEditorStore.js] (Zustand State)
       │
       ├──► [VideoPlayer.jsx] ─── DOM Caption Overlay (1:1 Live Preview)
       ├──► [CaptionListEditor.jsx] ─── Edit Words & Timestamps
       ├──► [HorizontalTimeline.jsx] ─── Drag & Split Blocks
       └──► [StyleInspector.jsx] ─── Customize Presets, Colors, Strokes, Animations
       │
       ▼
[ExportModal.jsx] ──(POST /render)──► [backend/renderer.py]
                                            │
                                            ├─► Generate .ass Subtitle Script
                                            ├─► Apply Custom TTF Fonts from storage/fonts/
                                            └─► FFmpeg `ass=...` filter burn-in
                                            │
                                            ▼
                                   [backend/storage/exports/*.mp4]
```

---

## 🛠️ Key Developer Rules

1. **DOM to ASS Parity**: Any visual property added to `StyleInspector.jsx` or `presets.js` must have an exact equivalent in `backend/renderer.py` ASS generation.
2. **State Centralization**: Always mutate video, caption, and style data through `frontend/src/store/useEditorStore.js`.
3. **Storage Discipline**: Generated export and upload videos belong strictly in `backend/storage/uploads` and `backend/storage/exports`.
4. **Font Loading**: Fonts used in libass must exist in `backend/storage/fonts/` and be mirrored in `frontend/src/index.css`.

---

## 🧰 Available Project Skills (`.agents/skills/`)

- [`architectural-audit`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/.agents/skills/architectural-audit/SKILL.md): Comprehensive architectural audit, bug hunt, and 1:1 visual fidelity diagnostics.
- [`autocaption-workflows`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/.agents/skills/autocaption-workflows/SKILL.md): Standard dev runner, debugging, and testing runbooks.
- [`caption-engine`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/.agents/skills/caption-engine/SKILL.md): Caption rendering rules, styling, and ASS/FFmpeg parity.

