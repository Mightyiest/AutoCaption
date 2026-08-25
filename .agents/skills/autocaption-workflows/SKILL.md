---
name: autocaption-workflows
description: >-
  Standard operating procedures and runbooks for running, debugging, testing,
  and maintaining the AutoCaption full-stack application (FastAPI backend, React frontend,
  Faster-Whisper transcription, and FFmpeg/ASS export rendering).
---

# AutoCaption Workflows & Runbook

This skill provides step-by-step instructions for development workflows, server execution, transcription testing, and subtitle export debugging.

---

## 1. Running the Development Environment

To start both the FastAPI backend and Vite frontend concurrently:

```powershell
# From repository root:
.\run_dev.bat
```

Or manually in separate terminals:

```powershell
# Terminal 1: Backend
cd backend
python -m uvicorn app:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

- **Backend API**: `http://localhost:8000` (Swagger docs at `/docs`)
- **Frontend App**: `http://localhost:5173`

---

## 2. Testing Transcription Directly

To test speech-to-text without launching the frontend:

```python
from transcriber import transcribe_audio

result = transcribe_audio(
    audio_path="storage/uploads/sample.mp4",
    model_size="base",
    language="en"
)
print("Segments count:", len(result["segments"]))
print("First segment words:", result["segments"][0]["words"])
```

---

## 3. Testing Video Render & Subtitle Burn-In

To test the ASS subtitle synthesis and FFmpeg libass filter directly:

```powershell
python scratch/test_single_layer_ass.py
```

Check the generated files in `backend/storage/debug/` to inspect `.ass` script outputs and error logs.

---

## 4. Cleaning Temporary Video Files

To clear storage caches while preserving `.gitkeep` placeholders:

```powershell
Get-ChildItem -Path "backend\storage\uploads\*.mp4", "backend\storage\exports\*.mp4" | Remove-Item -Force
```
