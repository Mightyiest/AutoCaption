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
from transcriber import (
    transcribe_media, 
    setup_cuda_dlls, 
    log_msg, 
    LOG_HISTORY,
    scan_model_cache,
    trigger_model_download,
    get_model_download_status,
    delete_cached_model,
    get_models_cache_dir
)
from renderer import render_captioned_video, generate_ass_subtitle

# Ultra-fast native ASS line-stream rendering engine
setup_cuda_dlls()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "storage", "uploads")
EXPORTS_DIR = os.path.join(BASE_DIR, "storage", "exports")
DEMO_DIR = os.path.join(BASE_DIR, "storage", "demo")

os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(EXPORTS_DIR, exist_ok=True)
DEMO_DIR = os.path.join(BASE_DIR, "storage", "demo")
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
ACTIVE_RENDER_PROCESSES: Dict[str, subprocess.Popen] = {}

class RenderRequest(BaseModel):
    video_filename: str
    segments: List[Dict[str, Any]]
    style: Dict[str, Any]
    width: Optional[int] = 1080
    height: Optional[int] = 1920
    video_duration: Optional[float] = 10.0
    encoder_mode: Optional[str] = "cpu"  # "cpu" (Option A) | "gpu_nvenc" (Option B)
    preview_metrics: Optional[Dict[str, Any]] = None

class TranscribeSavedRequest(BaseModel):
    video_filename: str
    model_name: Optional[str] = "base"
    language: Optional[str] = None
    max_words_per_segment: Optional[int] = 3

class ModelDownloadRequest(BaseModel):
    model_name: str

def get_system_hardware_stats() -> dict:
    cpu_percent = psutil.cpu_percent(interval=None)
    mem = psutil.virtual_memory()
    total_gb = round(mem.total / (1024 ** 3), 1)
    used_gb = round(mem.used / (1024 ** 3), 1)
    avail_gb = round(mem.available / (1024 ** 3), 1)
    
    # GPU detection via nvidia-smi
    gpu_info = {
        "available": False,
        "name": "CPU Mode",
        "util_percent": 0,
        "used_mb": 0,
        "total_mb": 0
    }
    try:
        res = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,utilization.gpu,memory.used,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=1
        )
        if res.returncode == 0 and res.stdout.strip():
            parts = [p.strip() for p in res.stdout.strip().split(",")]
            if len(parts) >= 4:
                gpu_info = {
                    "available": True,
                    "name": parts[0],
                    "util_percent": int(parts[1]),
                    "used_mb": int(parts[2]),
                    "total_mb": int(parts[3])
                }
    except Exception:
        pass

    return {
        "cpu_percent": cpu_percent,
        "cpu_usage_percent": cpu_percent,
        "cpu_threads": os.cpu_count() or 4,
        "ram_total_gb": total_gb,
        "ram_used_gb": used_gb,
        "ram_available_gb": avail_gb,
        "ram_percent": mem.percent,
        "ram_usage_percent": mem.percent,
        "gpu": gpu_info
    }

@app.get("/api/system-status")
def get_system_status():
    hw = get_system_hardware_stats()
    return {
        "status": "online",
        "cpu_threads": hw["cpu_threads"],
        "cpu_percent": hw["cpu_percent"],
        "ram_total_gb": hw["ram_total_gb"],
        "ram_used_gb": hw["ram_used_gb"],
        "ram_available_gb": hw["ram_available_gb"],
        "ram_percent": hw["ram_percent"],
        "gpu": hw["gpu"],
        "logs": LOG_HISTORY[-50:]
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

@app.get("/api/models/status")
def get_models_status_endpoint():
    try:
        return scan_model_cache()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/models/download")
def download_model_endpoint(req: ModelDownloadRequest):
    try:
        res = trigger_model_download(req.model_name)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/models/download-progress/{model_name}")
def get_model_download_progress_endpoint(model_name: str):
    return get_model_download_status(model_name)

@app.delete("/api/models/{model_name}")
def delete_model_endpoint(model_name: str):
    try:
        deleted = delete_cached_model(model_name)
        updated_status = scan_model_cache()
        return {
            "success": deleted,
            "model_name": model_name,
            **updated_status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    mode_label = "CPU Ultra-Fast" if req.encoder_mode == "cpu" else "NVIDIA GPU NVENC"
    
    def on_proc(proc):
        ACTIVE_RENDER_PROCESSES[job_id] = proc

    def on_progress(pct_val):
        try:
            val = int(pct_val)
            if val >= 100:
                RENDER_JOBS[job_id]["percent"] = 100
            else:
                RENDER_JOBS[job_id]["percent"] = max(RENDER_JOBS[job_id]["percent"], min(99, val))
        except Exception:
            pass
            
    try:
        RENDER_JOBS[job_id]["percent"] = 5
        RENDER_JOBS[job_id]["status"] = "rendering"
        log_msg("RENDER", f"[{mode_label}] Starting video export for '{req.video_filename}' ({req.width}x{req.height})")
        
        render_captioned_video(
            source_video_path=source_path,
            output_video_path=output_path,
            segments=req.segments,
            style=req.style,
            video_width=req.width or 1080,
            video_height=req.height or 1920,
            video_duration=req.video_duration,
            encoder_mode=req.encoder_mode or "cpu",
            preview_metrics=req.preview_metrics,
            on_proc_ready=on_proc,
            progress_callback=on_progress
        )
        
        if RENDER_JOBS[job_id].get("status") != "cancelled":
            RENDER_JOBS[job_id]["percent"] = 100
            RENDER_JOBS[job_id]["status"] = "done"
            RENDER_JOBS[job_id]["download_url"] = f"/static/exports/{export_filename}"
            log_msg("SUCCESS", f"[{mode_label}] Export complete: {export_filename}")
    except Exception as e:
        if RENDER_JOBS[job_id].get("status") != "cancelled":
            RENDER_JOBS[job_id]["status"] = "error"
            RENDER_JOBS[job_id]["error"] = str(e)
            log_msg("ERROR", f"Render job {job_id} failed: {e}")
    finally:
        if job_id in ACTIVE_RENDER_PROCESSES:
            del ACTIVE_RENDER_PROCESSES[job_id]

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

@app.post("/api/render-cancel/{job_id}")
def cancel_render_endpoint(job_id: str):
    if job_id in RENDER_JOBS:
        RENDER_JOBS[job_id]["status"] = "cancelled"
        RENDER_JOBS[job_id]["error"] = "Cancelled by user"
        log_msg("RENDER", f"Job {job_id} cancelled by user")
        
    proc = ACTIVE_RENDER_PROCESSES.get(job_id)
    if proc:
        try:
            proc.kill()
            proc.wait(timeout=1.0)
        except Exception:
            pass
        if job_id in ACTIVE_RENDER_PROCESSES:
            del ACTIVE_RENDER_PROCESSES[job_id]
            
    return {"status": "cancelled", "job_id": job_id}

@app.get("/api/render-progress/{job_id}")
def get_render_progress(job_id: str):
    if job_id not in RENDER_JOBS:
        raise HTTPException(status_code=404, detail="Job not found")
    return RENDER_JOBS[job_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
