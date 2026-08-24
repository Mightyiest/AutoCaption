import os
import shutil
import uuid
import subprocess
import psutil
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import imageio_ffmpeg
from transcriber import transcribe_media, setup_cuda_dlls, log_msg, LOG_HISTORY
from renderer import render_captioned_video, generate_ass_subtitle

# Optional: Canvas-based renderer for CapCut-style exact preview matching
try:
    from canvas_renderer import render_captioned_video_canvas
    CANVAS_RENDERER_AVAILABLE = True
except ImportError:
    CANVAS_RENDERER_AVAILABLE = False
    log_msg("INFO", "Canvas renderer not available, using ASS-based rendering")

setup_cuda_dlls()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "storage", "uploads")
EXPORTS_DIR = os.path.join(BASE_DIR, "storage", "exports")
DEMO_DIR = os.path.join(BASE_DIR, "storage", "demo")

os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(EXPORTS_DIR, exist_ok=True)
os.makedirs(DEMO_DIR, exist_ok=True)

app = FastAPI(title="AutoCaption Studio Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/static/exports", StaticFiles(directory=EXPORTS_DIR), name="exports")
app.mount("/static/demo", StaticFiles(directory=DEMO_DIR), name="demo")

RENDER_JOBS: Dict[str, Dict[str, Any]] = {}

class RenderRequest(BaseModel):
    video_filename: str
    segments: List[Dict[str, Any]]
    style: Dict[str, Any]
    width: Optional[int] = 1080
    height: Optional[int] = 1920
    video_duration: Optional[float] = 10.0
    encoder_mode: Optional[str] = "cpu"  # "cpu" (Option A) | "gpu_nvenc" (Option B)
    preview_metrics: Optional[Dict[str, Any]] = None
    use_canvas_renderer: Optional[bool] = False  # Use CapCut-style canvas rendering for exact preview match

class TranscribeSavedRequest(BaseModel):
    video_filename: str
    model_name: Optional[str] = "base"
    language: Optional[str] = None
    max_words_per_segment: Optional[int] = 3

def get_system_hardware_stats() -> dict:
    cpu_percent = psutil.cpu_percent(interval=None)
    mem = psutil.virtual_memory()
    
    gpu_info = {
        "available": False,
        "name": "CPU Only",
        "used_mb": 0,
        "total_mb": 0,
        "util_percent": 0
    }
    
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name,memory.used,memory.total,utilization.gpu", "--format=csv,nounits,noheader"],
            text=True,
            timeout=1.0
        )
        parts = [p.strip() for p in out.strip().split(",")]
        if len(parts) >= 4:
            gpu_info = {
                "available": True,
                "name": parts[0],
                "used_mb": int(parts[1]),
                "total_mb": int(parts[2]),
                "util_percent": int(parts[3])
            }
    except Exception:
        pass

    return {
        "cpu_percent": cpu_percent,
        "ram_used_gb": round(mem.used / (1024 ** 3), 2),
        "ram_total_gb": round(mem.total / (1024 ** 3), 2),
        "ram_percent": mem.percent,
        "gpu": gpu_info
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "AutoCaption Studio",
        "ffmpeg_path": imageio_ffmpeg.get_ffmpeg_exe(),
        "models_available": ["tiny", "base", "small", "medium", "large-v3-turbo"]
    }

@app.get("/api/stats")
def get_stats():
    hardware = get_system_hardware_stats()
    return {
        "hardware": hardware,
        "logs": LOG_HISTORY[-50:]
    }

@app.post("/api/upload-preview")
async def upload_for_preview(file: UploadFile = File(...)):
    file_id = uuid.uuid4().hex[:12]
    ext = os.path.splitext(file.filename)[1] or ".mp4"
    saved_filename = f"{file_id}{ext}"
    saved_path = os.path.join(UPLOADS_DIR, saved_filename)
    
    log_msg("UPLOAD", f"Ingesting video '{file.filename}' -> {saved_filename}")
    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {
        "video_filename": saved_filename,
        "video_url": f"/static/uploads/{saved_filename}",
        "original_name": file.filename
    }

@app.post("/api/transcribe-saved")
async def transcribe_saved_endpoint(req: TranscribeSavedRequest):
    source_path = os.path.join(UPLOADS_DIR, req.video_filename)
    if not os.path.exists(source_path):
        demo_path = os.path.join(DEMO_DIR, req.video_filename)
        if os.path.exists(demo_path):
            source_path = demo_path
        else:
            raise HTTPException(status_code=404, detail="Video file not found")
            
    try:
        result = transcribe_media(
            file_path=source_path,
            model_name=req.model_name or "base",
            language=req.language,
            max_words_per_segment=req.max_words_per_segment or 3
        )
        return {
            "video_filename": req.video_filename,
            "language": result["language"],
            "language_probability": result["language_probability"],
            "duration": result["duration"],
            "total_words": result["total_words"],
            "segments": result["segments"],
            "elapsed_seconds": result["elapsed_seconds"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transcribe")
async def transcribe_endpoint(
    file: UploadFile = File(...),
    model_name: str = Form("base"),
    language: Optional[str] = Form(None),
    max_words_per_segment: int = Form(3)
):
    file_id = uuid.uuid4().hex[:12]
    ext = os.path.splitext(file.filename)[1] or ".mp4"
    saved_filename = f"{file_id}{ext}"
    saved_path = os.path.join(UPLOADS_DIR, saved_filename)
    
    log_msg("UPLOAD", f"Received file upload '{file.filename}'")
    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        result = transcribe_media(
            file_path=saved_path,
            model_name=model_name,
            language=language,
            max_words_per_segment=max_words_per_segment
        )
        
        return {
            "video_filename": saved_filename,
            "video_url": f"/static/uploads/{saved_filename}",
            "language": result["language"],
            "language_probability": result["language_probability"],
            "duration": result["duration"],
            "total_words": result["total_words"],
            "segments": result["segments"],
            "elapsed_seconds": result["elapsed_seconds"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _do_render_task(job_id: str, req: RenderRequest, source_path: str, output_path: str, export_filename: str):
    total_dur = max(0.5, req.video_duration or 10.0)
    
    # Determine rendering method
    use_canvas = req.use_canvas_renderer and CANVAS_RENDERER_AVAILABLE
    mode_label = "Canvas (CapCut-style)" if use_canvas else ("CPU Ultra-Fast" if req.encoder_mode == "cpu" else "NVIDIA GPU NVENC")
    
    def on_progress(current_sec):
        if current_sec >= 999990:
            RENDER_JOBS[job_id]["percent"] = 100
            RENDER_JOBS[job_id]["status"] = "done"
        else:
            pct = min(99, int((current_sec / total_dur) * 100))
            RENDER_JOBS[job_id]["percent"] = max(RENDER_JOBS[job_id]["percent"], pct)
            
    try:
        RENDER_JOBS[job_id]["percent"] = 5
        RENDER_JOBS[job_id]["status"] = "rendering"
        log_msg("RENDER", f"[{mode_label}] Starting video export for '{req.video_filename}' ({req.width}x{req.height})")
        
        if use_canvas:
            # Use CapCut-style canvas renderer for exact preview matching
            render_captioned_video_canvas(
                source_video_path=source_path,
                output_video_path=output_path,
                segments=req.segments,
                style=req.style,
                video_width=req.width or 1080,
                video_height=req.height or 1920,
                encoder_mode=req.encoder_mode or "cpu",
                progress_callback=on_progress
            )
        else:
            # Use fast ASS-based renderer
            render_captioned_video(
                source_video_path=source_path,
                output_video_path=output_path,
                segments=req.segments,
                style=req.style,
                video_width=req.width or 1080,
                video_height=req.height or 1920,
                encoder_mode=req.encoder_mode or "cpu",
                preview_metrics=req.preview_metrics,
                progress_callback=on_progress
            )
        
        RENDER_JOBS[job_id]["percent"] = 100
        RENDER_JOBS[job_id]["status"] = "done"
        RENDER_JOBS[job_id]["download_url"] = f"/static/exports/{export_filename}"
        log_msg("SUCCESS", f"[{mode_label}] Export complete: {export_filename}")
    except Exception as e:
        RENDER_JOBS[job_id]["status"] = "error"
        RENDER_JOBS[job_id]["error"] = str(e)
        log_msg("ERROR", f"Render job {job_id} failed: {e}")

@app.post("/api/render")
async def render_endpoint(req: RenderRequest, background_tasks: BackgroundTasks):
    if not req.segments:
        raise HTTPException(status_code=400, detail="No caption segments provided")
    if (req.width or 0) <= 0 or (req.height or 0) <= 0:
        raise HTTPException(status_code=400, detail="Invalid export dimensions")

    source_path = os.path.join(UPLOADS_DIR, req.video_filename)
    if not os.path.exists(source_path):
        demo_path = os.path.join(DEMO_DIR, req.video_filename)
        if os.path.exists(demo_path):
            source_path = demo_path
        else:
            raise HTTPException(status_code=404, detail="Source video file not found")
            
    job_id = uuid.uuid4().hex[:12]
    export_filename = f"export_{job_id}.mp4"
    output_path = os.path.join(EXPORTS_DIR, export_filename)
    
    # Save debug payload snapshot
    debug_dir = os.path.join(BASE_DIR, "storage", "debug")
    os.makedirs(debug_dir, exist_ok=True)
    try:
        with open(os.path.join(debug_dir, f"render_{job_id}_payload.json"), "w", encoding="utf-8") as f:
            f.write(req.model_dump_json(indent=2))
    except Exception:
        pass
    
    RENDER_JOBS[job_id] = {
        "job_id": job_id,
        "percent": 0,
        "status": "queued",
        "download_url": f"/static/exports/{export_filename}",
        "error": None
    }
    
    background_tasks.add_task(_do_render_task, job_id, req, source_path, output_path, export_filename)
    
    return {
        "status": "queued",
        "job_id": job_id,
        "download_url": f"/static/exports/{export_filename}"
    }

@app.get("/api/render-progress/{job_id}")
def get_render_progress(job_id: str):
    if job_id not in RENDER_JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    return RENDER_JOBS[job_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
