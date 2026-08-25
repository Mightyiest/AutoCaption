# AutoCaption Full Codebase File Map

## Directory & File Breakdown

### 1. Frontend Core (`frontend/`)
- [`frontend/index.html`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/index.html): HTML shell with viewport, fonts, and root container.
- [`frontend/vite.config.js`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/vite.config.js): Vite bundler configuration, dev server port and proxy definitions.
- [`frontend/package.json`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/package.json): Frontend dependencies (React, Lucide icons, Tailwind, Zustand).
- [`frontend/src/main.jsx`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/main.jsx): React application bootstrapping.
- [`frontend/src/App.jsx`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/App.jsx): Main layout structure hosting Navbar, Left Drawer, Video Player, Timeline, Right Inspector, and floating Modals.
- [`frontend/src/App.css`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/App.css): Layout styling, panel sizing, transitions.
- [`frontend/src/index.css`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/index.css): Theme design tokens, font declarations (`@font-face`), scrollbar styles.

### 2. Frontend State Management (`frontend/src/store/`)
- [`frontend/src/store/useEditorStore.js`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/store/useEditorStore.js):
  - **Video State**: `videoFile`, `videoUrl`, `duration`, `currentTime`, `isPlaying`, `resolution`, `fps`.
  - **Caption State**: `words`, `segments`, `activeWordIndex`, `activeSegmentIndex`, history buffer for undo/redo.
  - **Style State**: `preset`, `fontFamily`, `fontSize`, `primaryColor`, `secondaryColor`, `strokeColor`, `strokeWidth`, `shadowColor`, `shadowBlur`, `shadowOffset`, `animation`, `positionY`, `maxWordsPerLine`.
  - **Export State**: `isExporting`, `exportProgress`, `exportLogs`, `downloadUrl`.
  - **UI State**: `activeTab`, `isUploadOpen`, `isExportOpen`, `isConsoleOpen`, `theme`.

### 3. Frontend UI Components (`frontend/src/components/`)
- [`frontend/src/components/Navbar.jsx`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/components/Navbar.jsx): Application bar with project actions, open video button, export trigger, and theme toggle.
- [`frontend/src/components/VideoPlayer.jsx`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/components/VideoPlayer.jsx): HTML5 video player wrapper with custom controls, time-accurate overlay sync, responsive scaling, and live DOM caption rendering.
- [`frontend/src/components/StyleInspector.jsx`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/components/StyleInspector.jsx): Comprehensive styling inspector (Presets grid, Typography picker, Fill/Highlight/Stroke/Shadow color controls, Animation selector, Position sliders).
- [`frontend/src/components/CaptionListEditor.jsx`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/components/CaptionListEditor.jsx): Tabular/card list of all segments and individual words, supporting inline text editing, timestamp nudging, and word splitting.
- [`frontend/src/components/HorizontalTimeline.jsx`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/components/HorizontalTimeline.jsx): Interactive zoomable timeline showing audio waveform track, playhead scrubbing, segment blocks, and word boundary handles.
- [`frontend/src/components/TimelineEditor.jsx`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/components/TimelineEditor.jsx): Alternative timeline scrubber and track component.
- [`frontend/src/components/UploadModal.jsx`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/components/UploadModal.jsx): Modal for uploading video files and configuring transcription parameters (Whisper model, compute type, language).
- [`frontend/src/components/ExportModal.jsx`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/components/ExportModal.jsx): Export modal with output resolution options, CRF quality presets, rendering progress bar, and log output.
- [`frontend/src/components/ConsoleDrawer.jsx`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/components/ConsoleDrawer.jsx): Real-time collapsible terminal drawer displaying logs, backend task updates, and FFmpeg outputs.

### 4. Frontend Rendering Engine (`frontend/src/engine/`)
- [`frontend/src/engine/presets.js`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/engine/presets.js): Definition of visual presets (MrBeast, Hormozi, Neon, Karaoké, Minimalist, Cyberpunk, Comic, etc.).
- [`frontend/src/engine/layoutMeasurer.js`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/engine/layoutMeasurer.js): DOM text geometry measuring for line-breaking and boundary calculations.
- [`frontend/src/engine/animator.js`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/engine/animator.js): CSS keyframe generation and class names for active word transitions (`pop`, `bounce`, `glow`, `slide`).

### 5. Backend Server & APIs (`backend/`)
- [`backend/app.py`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/backend/app.py):
  - `POST /transcribe`: Transcribes uploaded video audio via Faster-Whisper.
  - `POST /render`: Synthesizes ASS subtitles and invokes FFmpeg for hardsub burning.
  - `GET /fonts`: Returns available font list from `backend/storage/fonts/`.
  - `GET /download/{filename}`: File download endpoint for exported videos.
  - Static file mounts: `/static/uploads`, `/static/exports`, `/static/fonts`.
- [`backend/transcriber.py`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/backend/transcriber.py): Faster-Whisper wrapper with word-level timestamp extraction, voice activity detection (VAD), and segment clustering.
- [`backend/renderer.py`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/backend/renderer.py): Advanced ASS subtitle generator mapping JSON caption styles to libass tags (`\pos`, `\fscx`, `\fscy`, `\1c`, `\3c`, `\4c`, `\bord`, `\shad`, `\t`) and executing FFmpeg subtitle burning commands.
- [`backend/download_fonts.py`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/backend/download_fonts.py): Font downloader script for Google Fonts TTFs.
- [`backend/download_models.py`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/backend/download_models.py): Whisper model pre-fetcher script.

### 6. Storage Directories (`backend/storage/`)
- [`backend/storage/uploads/`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/backend/storage/uploads): Uploaded source video files.
- [`backend/storage/exports/`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/backend/storage/exports): Final exported videos with burned-in captions.
- [`backend/storage/fonts/`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/backend/storage/fonts): TrueType (`.ttf`) font files utilized by libass.
- [`backend/storage/debug/`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/backend/storage/debug): Export payloads (`.json`) and generated ASS subtitle files (`.ass`).

### 7. Benchmarks & Testing (`scratch/`)
- [`scratch/test_single_layer_ass.py`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/scratch/test_single_layer_ass.py): ASS subtitle tag generation and frame testing.
- [`scratch/test_overlay_bench.py`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/scratch/test_overlay_bench.py): Rendering pipeline benchmark.
- [`scratch/test_fast_dom_pipeline.py`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/scratch/test_fast_dom_pipeline.py): Puppeteer-based DOM frame rendering comparison.
