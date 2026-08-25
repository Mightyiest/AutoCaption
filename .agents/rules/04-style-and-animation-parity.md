# Style & Animation Parity (DOM Preview vs Libass FFmpeg)

## 1:1 Visual Parity Architecture

To ensure what the user sees in the browser preview matches the exported MP4 video exactly, styles must maintain 1-to-1 parity between CSS styling and ASS subtitle tags.

---

### Property Mapping Table

| Visual Attribute | Frontend CSS (`VideoPlayer.jsx` / `animator.js`) | Backend ASS Tag (`backend/renderer.py`) | Notes |
| :--- | :--- | :--- | :--- |
| **Font Family** | `font-family: 'Komika Axis'` | `\fnKomika Axis` | Font file must exist in `backend/storage/fonts/` |
| **Font Size** | `font-size: ${size}px` | `\fs${size}` | Scaled relative to `PlayResY` (1080p base) |
| **Primary Fill Color** | `color: #FFFFFF` | `\1c&HFFFFFF&` | Note: ASS uses `&HBBGGRR&` hex order |
| **Active Highlight** | `color: #FFFF00` | `\1c&H00FFFF&` | Dynamic tag applied during active word interval |
| **Stroke / Border** | `-webkit-text-stroke: ${w}px ${c}` | `\bord${w}\3c${ass_color}` | Exact outline thickness |
| **Drop Shadow** | `filter: drop-shadow(...)` | `\shad${d}\4c${ass_color}` | Libass shadow offset and color |
| **Word Pop / Zoom** | `transform: scale(1.2)` | `\fscx120\fscy120` | Scale keyframe over word duration |
| **Word Bounce** | `transform: translateY(-8px)` | `\pos(x, y - offset)` or `\t(\fscy...)` | Smooth vertical displacement |
| **Word Fade** | `opacity: 0 -> 1` | `\t(0, 100, \alpha&H00&)` | Alpha channel transition |
| **Background Box** | `background: rgba(...)` | `\bord` with OpaqueBox or `\p1` drawing | Bounding box background |

---

### Key Guidelines for Adding New Presets

When adding a new preset to [`frontend/src/engine/presets.js`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/engine/presets.js):
1. **Define in `presets.js`**: Add preset ID, name, font, colors, stroke, animation type, shadow.
2. **Add Font Asset**: Ensure the corresponding `.ttf` file is in [`backend/storage/fonts/`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/backend/storage/fonts).
3. **Verify ASS Generator**: Ensure [`backend/renderer.py`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/backend/renderer.py) implements any special ASS override tags for the preset's animations or layout.
4. **Test with Harness**: Run `python scratch/test_single_layer_ass.py` or inspect `backend/storage/debug/` to verify exact ASS rendering.
