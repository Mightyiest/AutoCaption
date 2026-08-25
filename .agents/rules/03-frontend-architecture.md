# Frontend Architecture & Component Guide

## React Component Hierarchy

```
App.jsx
├── Navbar.jsx                      # Navigation, Project Actions, Export & Upload Modals Triggers
├── main-content-grid
│   ├── CaptionListEditor.jsx       # Left Sidebar: Segment and Word Editor
│   ├── center-viewport
│   │   ├── VideoPlayer.jsx         # Video Canvas + DOM Caption Overlay
│   │   └── HorizontalTimeline.jsx  # Audio Track Waveform, Word Block Scrubbing
│   └── StyleInspector.jsx          # Right Sidebar: Presets, Fonts, Colors, Animations
├── UploadModal.jsx                 # Video File Dropzone + Whisper Settings
├── ExportModal.jsx                 # Export Configuration (Resolution, Quality, Progress)
└── ConsoleDrawer.jsx               # Floating Terminal Console for Task Logs
```

## State Management (`frontend/src/store/useEditorStore.js`)

The Zustand store is the single source of truth:
1. **Video State**:
   - `videoFile` (File object), `videoUrl` (Blob or backend static URL)
   - `currentTime` (float seconds), `duration` (float seconds), `isPlaying` (boolean)
   - `videoResolution` (`{ width: 1080, height: 1920 }`)
2. **Caption State**:
   - `segments`: Array of `{ id, start, end, text, words: [{ word, start, end, id }] }`
   - `activeSegmentIndex`: Currently active segment based on `currentTime`
   - `activeWordIndex`: Currently active word within the active segment
   - `undoStack` / `redoStack`: Immutable history snapshots of caption edits
3. **Style State**:
   - `preset`: Selected style preset ID (`mrbeast`, `hormozi`, `neon`, etc.)
   - `fontFamily`: Active font (e.g. `Montserrat`, `Komika Axis`, `Anton`, `Bebas Neue`)
   - `fontSize`: Baseline font size in px relative to 1080p
   - `primaryColor`: Non-active word text fill color
   - `secondaryColor` / `highlightColor`: Active word text fill color
   - `strokeColor` & `strokeWidth`: Outline border color and thickness
   - `shadowColor`, `shadowBlur`, `shadowOffset`: Drop shadow parameters
   - `animation`: Transition style (`pop`, `bounce`, `fade`, `slide`, `none`)
   - `positionY`: Vertical position percentage (e.g. 75% for bottom thirds)
   - `maxWordsPerLine`: Limit for auto-splitting words per segment
4. **Rendering & Export State**:
   - `isExporting`: Boolean flag
   - `exportProgress`: Percentage float (0 - 100)
   - `exportLogs`: Array of timestamped log strings
   - `downloadUrl`: URL to finished exported video

## DOM Overlay Sync (`VideoPlayer.jsx`)
- The caption overlay sits directly on top of the `<video>` element.
- It computes relative scaling using the video container aspect ratio to ensure pixel-perfect rendering across different screen sizes.
- High-frequency updates (`requestAnimationFrame` / `timeupdate`) highlight the current word using CSS transition classes matching `frontend/src/engine/animator.js`.
