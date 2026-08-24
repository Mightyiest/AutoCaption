# Step-by-Step Implementation Roadmap

## Milestone 1: Project Scaffolding & State Core
- [ ] Initialize frontend: React 18 + Vite (`AutoCaption/frontend`).
- [ ] Setup Zustand global store for video state, caption segments, active word index, and current style preset.
- [ ] Initialize Python FastAPI backend skeleton (`AutoCaption/backend`) with CORS and file upload router.
- [ ] **Verification**: App boots, video file can be dropped into UI and plays smoothly.

---

## Milestone 2: Speech Recognition & Word Chunking Engine
- [ ] Implement backend audio demuxing using FFmpeg to 16kHz WAV.
- [ ] Integrate `faster-whisper` with Silero VAD and `word_timestamps=True`.
- [ ] Implement short-form chunking algorithm (splits long sentences into 2–4 word punchy segments).
- [ ] Implement frontend fallback with `@xenova/transformers` (Whisper ONNX).
- [ ] **Verification**: Upload 15-second voice video; verify JSON returned contains precise start/end seconds for each word.

---

## Milestone 3: Dynamic Animation & Preset Engine
- [ ] Build `animator.js` synchronization hook: connects `requestAnimationFrame` loop to `<video>.currentTime`.
- [ ] Implement active word locator and interpolation calculator.
- [ ] Create Preset Library:
  - Hormozi Impact (Spring Pop, Yellow Highlight, Heavy Outline)
  - MrBeast Viral (Word Rotation, Vibrant Bounce)
  - Neon Karaoke (Cyan Glow, Smooth Fill)
  - Clean Minimalist (Frosted Pill, Subtitle Style)
- [ ] **Verification**: Video plays with word-by-word highlights and pop animations in real-time sync with speech.

---

## Milestone 4: Interactive Studio & Timeline Editor
- [ ] Construct 9:16 vertical viewport with safe-zone guides and draggable caption position box.
- [ ] Build interactive bottom timeline:
  - Segment block visualizer with time stamps.
  - Individual word pills (clickable for spelling corrections).
  - Waveform canvas visualization.
- [ ] Build Right-Side Style Inspector:
  - Font picker, size sliders, stroke width, shadow, color pickers, animation selector.
- [ ] **Verification**: User can drag caption box, change fonts/colors on the fly, and edit a misspelled word with instant preview update.

---

## Milestone 5: Export & Subtitle Burning Engine
- [ ] Implement backend ASS subtitle generator with karaoke timing tags (`\k`).
- [ ] Implement FFmpeg render task runner with progress reporting via SSE/WebSocket.
- [ ] Implement client-side fallback recording using WebCodecs / Canvas stream recording.
- [ ] Build Export Modal with resolution selection (9:16, 1:1, 16:9) and download button.
- [ ] **Verification**: Export 1080x1920 video and verify caption styles, fonts, and sync match the browser preview.

---

## Milestone 6: Quality Assurance & Final Polish
- [ ] Test edge cases: overlapping speech, rapid speech, silent pauses, various video resolutions.
- [ ] Add sample demo video & demo transcript for instant zero-upload preview.
- [ ] Optimize render performance and memory cleanup on video unmount.
- [ ] Write user documentation and launch scripts (`run_dev.bat` / `run_dev.sh`).
