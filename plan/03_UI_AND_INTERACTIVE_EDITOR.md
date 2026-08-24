# UI & Interactive Editor Specification

## 1. Interface Layout & UX Philosophy
AutoCaption features a modern, ultra-responsive dark-mode studio interface designed around short-form vertical editing (9:16 aspect ratio).

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [Logo] AutoCaption Studio           [Upload Video] [Transcribe] [Export Video]  │
├─────────────────────────┬───────────────────────────────┬────────────────────────┤
│ LEFT PANEL              │ CENTER VIEWPORT               │ RIGHT PANEL            │
│ ┌─────────────────────┐ │ ┌───────────────────────────┐ │ ┌────────────────────┐ │
│ │ Presets Gallery     │ │ │       9:16 Viewport       │ │ │ Typography & Text  │ │
│ │ • Hormozi Impact    │ │ │                           │ │ │ • Font Family      │ │
│ │ • MrBeast Viral     │ │ │     [ Draggable Bounding ]│ │ │ • Size & Weight    │ │
│ │ • Neon Karaoke      │ │ │     [ Caption Box        ]│ │ │ • Uppercase Switch │ │
│ │ • Clean Subtitle    │ │ │                           │ │ ├────────────────────┤ │
│ ├─────────────────────┤ │ │                           │ │ │ Colors & Effects   │ │
│ │ Video Properties    │ │ │   [Play / Pause / Scrub]  │ │ │ • Main / Active Col│ │
│ │ • Aspect Ratio      │ │ └───────────────────────────┘ │ │ • Stroke & Shadow  │ │
│ │ • Volume / Speed    │ │                               │ │ • Animation Type   │ │
│ └─────────────────────┘ │                               │ └────────────────────┘ │
├─────────────────────────┴───────────────────────────────┴────────────────────────┤
│ BOTTOM: Interactive Timeline & Word-Level Editor                                 │
│ [Playhead: 00:04.25] [Segment 1: "DISCOVER THE SECRET"] [Segment 2: "TO SUCCESS"]│
│ └── Word blocks: [DISCOVER (0.2s)] [THE (0.1s)] [SECRET (0.4s)] ─────────────────┘
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Specifications

### 1. Viewport & Canvas Container (`VideoPlayer.jsx`)
- **Dimensions**: Scaled 9:16 container (e.g., 360x640 preview, renderable at 1080x1920).
- **Draggable Caption Box**:
  - Drag to position vertically (top, middle, bottom safe zones).
  - Visual guides for TikTok/Reels UI overlay safe areas (avoiding bottom captions/right action buttons).
- **Playback Controls**: Spacebar play/pause, J-K-L scrubbing, left/right frame stepping (±50ms).

### 2. Interactive Timeline & Word Editor (`TimelineEditor.jsx`)
- **Segment Strips**: Displays all transcribed speech chunks with start/end time pills.
- **Word Pill Granularity**:
  - Click any word to edit spelling (instant auto-sync with state).
  - Drag word boundary edges to trim or extend word duration.
  - Split segment (`Ctrl + Enter`) or Merge adjacent segments (`Ctrl + M`).
- **Waveform Canvas**: Decoded audio peaks overlaid beneath timeline blocks for precision visual alignment.

### 3. Style & Animation Inspector (`StyleInspector.jsx`)
- **Preset One-Click Cards**: Visual thumbnail representations of styles.
- **Custom Controls**:
  - Font Picker: Integrated Google Fonts selector.
  - Color Pickers: Primary, Active Word, Outline, Glow.
  - Sliders: Font size, Stroke width, Shadow distance, Position Y.
  - Animation Selector: `Pop`, `Karaoke`, `Bounce`, `Zoom`, `Fade`.
  - Pacing Setting: Max words per chunk (1, 2, 3, 4 words).

### 4. Audio Waveform & File Ingest (`FileUploader.jsx`)
- Drag & Drop zone for video files (`.mp4`, `.mov`, `.webm`).
- Instant local `blob:` URL playback (zero upload wait for local preview).
- Automatic audio extraction & transcription trigger.
