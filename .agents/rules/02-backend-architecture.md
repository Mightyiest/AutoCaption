# Backend Architecture & Endpoints

## Core Modules

### 1. `backend/app.py`
FastAPI server serving API endpoints and static assets.
- **CORS Config**: Configured for `localhost:5173` (Vite dev server) and `127.0.0.1`.
- **Static Routes**:
  - `/static/uploads` -> `backend/storage/uploads`
  - `/static/exports` -> `backend/storage/exports`
  - `/static/fonts` -> `backend/storage/fonts`
- **API Routes**:
  - `POST /transcribe`: Receives `file: UploadFile`, `model_size: str`, `language: str`. Saves to `uploads/` and calls `transcriber.transcribe_audio`.
  - `POST /render`: Receives payload with `video_filename`, `resolution`, `fps`, `style`, `captions` (segments with word-level timings). Calls `renderer.render_video`.
  - `GET /fonts`: Returns array of font family names available in `backend/storage/fonts/`.
  - `GET /download/{filename}`: FileResponse streaming the rendered MP4 file.

### 2. `backend/transcriber.py`
High-speed speech-to-text powered by `faster-whisper`.
- **Model Loading**: Cached instance of `WhisperModel(model_size, device="cuda" if available else "cpu", compute_type="float16" or "int8")`.
- **VAD (Voice Activity Detection)**: Uses Silero VAD to eliminate silence gaps.
- **Word Timestamps**: Emits word-level timestamps:
  ```json
  {
    "text": "Hello world",
    "start": 0.52,
    "end": 1.28,
    "words": [
      { "word": "Hello", "start": 0.52, "end": 0.84, "probability": 0.98 },
      { "word": "world", "start": 0.88, "end": 1.28, "probability": 0.99 }
    ]
  }
  ```

### 3. `backend/renderer.py`
Generates ASS (`.ass`) subtitle files and invokes FFmpeg libass filter.
- **ASS Script Generation**:
  - Sets script resolution (`PlayResX`, `PlayResY`) matching output video dimensions.
  - Registers custom fonts using `fontsdir=backend/storage/fonts/`.
  - Converts hex colors (`#RRGGBB` / `#RRGGBBAA`) to ASS BGR format (`&HAABBGGRR&`).
  - Generates line dialogue events with word animation overrides (e.g., `\fscx120\fscy120\1c&H00FFFF&` for active word highlights, pops, and glow effects).
- **FFmpeg Execution**:
  - Command pattern:
    ```bash
    ffmpeg -y -i <input_path> -vf "ass='<ass_path>':fontsdir='<fonts_dir>'" -c:v libx264 -crf 18 -preset fast -c:a copy <output_path>
    ```
