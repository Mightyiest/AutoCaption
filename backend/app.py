import os
# Disable Windows symlink warning from huggingface_hub
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
import shutil
import uuid
import subprocess
import psutil
import mimetypes
import re
import urllib.parse
import json
import datetime
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import imageio_ffmpeg
from transcriber import transcribe_media, scan_model_cache, trigger_model_download, get_model_download_status, delete_cached_model, get_models_cache_dir, setup_cuda_dlls, log_msg, LOG_HISTORY
from renderer import render_captioned_video
from dom_renderer import render_captioned_video_dom
from audio_separator import process_audio_separation, VOCALS_DIR

# Base Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
UPLOADS_DIR = os.path.join(STORAGE_DIR, "uploads")
EXPORTS_DIR = os.path.join(STORAGE_DIR, "exports")
FONTS_DIR = os.path.join(STORAGE_DIR, "fonts")
DEMO_DIR = os.path.join(STORAGE_DIR, "demo")
PROJECTS_DIR = os.path.join(STORAGE_DIR, "projects")

for d in [UPLOADS_DIR, EXPORTS_DIR, FONTS_DIR, DEMO_DIR, VOCALS_DIR, PROJECTS_DIR]:
    os.makedirs(d, exist_ok=True)

app = FastAPI(title="AutoCaption Studio API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/static/exports", StaticFiles(directory=EXPORTS_DIR), name="exports")
app.mount("/static/vocals", StaticFiles(directory=VOCALS_DIR), name="vocals")
app.mount("/static/demo", StaticFiles(directory=DEMO_DIR), name="demo")

RENDER_JOBS: Dict[str, Dict[str, Any]] = {}
ACTIVE_RENDER_PROCESSES: Dict[str, subprocess.Popen] = {}
SEPARATION_JOBS: Dict[str, Dict[str, Any]] = {}

def _prune_old_jobs():
    global RENDER_JOBS, SEPARATION_JOBS
    if len(RENDER_JOBS) > 80:
        for k in list(RENDER_JOBS.keys())[:-40]:
            RENDER_JOBS.pop(k, None)
    if len(SEPARATION_JOBS) > 80:
        for k in list(SEPARATION_JOBS.keys())[:-40]:
            SEPARATION_JOBS.pop(k, None)

class RenderRequest(BaseModel):
    video_filename: str
    segments: List[Dict[str, Any]]
    style: Dict[str, Any]
    width: Optional[int] = 1080
    height: Optional[int] = 1920
    video_duration: Optional[float] = 10.0
    encoder_mode: Optional[str] = "gpu_nvenc"  # "cpu" | "gpu_nvenc"
    engine_type: Optional[str] = "dom"        # "dom" (Ultra 1:1 Fidelity) | "ass" (Fast Burn)
    preview_metrics: Optional[Dict[str, Any]] = None
    linked_path: Optional[str] = None

class TranscribeSavedRequest(BaseModel):
    video_filename: str
    model_name: Optional[str] = "base"
    language: Optional[str] = None
    max_words_per_segment: Optional[int] = 3
    remove_punctuation: Optional[bool] = False

class LinkPathRequest(BaseModel):
    file_path: str

class TranscribeLinkedRequest(BaseModel):
    file_path: str
    model_name: Optional[str] = "base"
    language: Optional[str] = None
    max_words_per_segment: Optional[int] = 3
    remove_punctuation: Optional[bool] = False

class ModelDownloadRequest(BaseModel):
    model_name: str

class DependencyActionRequest(BaseModel):
    package_id: str

class VocalModelActionRequest(BaseModel):
    model_id: str

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

@app.get("/api/models")
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

# ---------------------------------------------------------------------------
# Dependency, CUDA Acceleration & Vocal Model Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/dependencies/status")
def get_dependencies_status_endpoint(check_pypi: bool = False):
    from dependency_manager import inspect_all_dependencies
    try:
        return inspect_all_dependencies(check_pypi=check_pypi)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/dependencies/check-updates")
def check_dependencies_updates_endpoint():
    from dependency_manager import inspect_all_dependencies
    try:
        return inspect_all_dependencies(check_pypi=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/dependencies/install")
def install_dependency_endpoint(req: DependencyActionRequest):
    from dependency_manager import install_package_task
    try:
        task_id = install_package_task(req.package_id)
        return {"status": "started", "task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/dependencies/uninstall")
def uninstall_dependency_endpoint(req: DependencyActionRequest):
    from dependency_manager import uninstall_package_task
    try:
        task_id = uninstall_package_task(req.package_id)
        return {"status": "started", "task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dependencies/task/{task_id}")
def get_dependency_task_endpoint(task_id: str):
    from dependency_manager import TASK_REGISTRY
    task = TASK_REGISTRY.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.post("/api/dependencies/task/{task_id}/cancel")
def cancel_dependency_task_endpoint(task_id: str):
    from dependency_manager import cancel_task
    cancelled = cancel_task(task_id)
    return {"status": "cancelled" if cancelled else "not_running"}

@app.get("/api/dependencies/cache-info")
def get_dependencies_cache_info_endpoint():
    from dependency_manager import get_cache_info
    try:
        return get_cache_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/dependencies/clean-cache")
def clean_dependencies_cache_endpoint():
    from dependency_manager import clean_all_caches
    try:
        res = clean_all_caches()
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/vocal-models/status")
def get_vocal_models_endpoint():
    from dependency_manager import get_vocal_models_status
    try:
        return {"models": get_vocal_models_status()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/vocal-models/download")
def download_vocal_model_endpoint(req: VocalModelActionRequest):
    from dependency_manager import download_vocal_model_task
    try:
        task_id = download_vocal_model_task(req.model_id)
        return {"status": "started", "task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/vocal-models/{model_id}")
def delete_vocal_model_endpoint(model_id: str):
    from dependency_manager import delete_vocal_model, get_vocal_models_status
    try:
        deleted = delete_vocal_model(model_id)
        return {"status": "deleted" if deleted else "not_found", "models": get_vocal_models_status()}
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

# ---------------------------------------------------------------------------
# Premiere Pro Zero-Copy Media Linking & Streaming Subsystem
# ---------------------------------------------------------------------------

def probe_media_file(file_path: str) -> dict:
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [ffmpeg_exe, "-hide_banner", "-i", file_path]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    out = res.stderr
    dur = 0.0
    w = 1080
    h = 1920
    fps = 30.0

    dur_m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", out)
    if dur_m:
        h_val, m_val, s_val = dur_m.groups()
        dur = int(h_val) * 3600 + int(m_val) * 60 + float(s_val)

    res_m = re.search(r"Video:.*?,\s*(\d{3,5})x(\d{3,5})", out)
    if res_m:
        w = int(res_m.group(1))
        h = int(res_m.group(2))

    fps_m = re.search(r"(\d+(?:\.\d+)?)\s*fps", out)
    if fps_m:
        fps = float(fps_m.group(1))

    return {"duration": round(dur, 2), "width": w, "height": h, "fps": fps}

@app.post("/api/media/browse-file")
def browse_file_endpoint():
    """Launches the native Windows File Picker dialog in an STA process without copying files."""
    try:
        ps_cmd = (
            "Add-Type -AssemblyName System.Windows.Forms; "
            "$f = New-Object System.Windows.Forms.OpenFileDialog; "
            "$f.Filter = 'Video Files (*.mp4;*.mov;*.mkv;*.webm;*.avi;*.m4v)|*.mp4;*.mov;*.mkv;*.webm;*.avi;*.m4v|Audio Files (*.mp3;*.wav;*.m4a;*.aac)|*.mp3;*.wav;*.m4a;*.aac|All Files (*.*)|*.*'; "
            "$f.Title = 'Select Video to Link (AutoCaption Zero-Copy)'; "
            "$f.RestoreDirectory = $true; "
            "$f.Multiselect = $false; "
            "$res = $f.ShowDialog(); "
            "if ($res -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::WriteLine($f.FileName) }"
        )
        ps_run = subprocess.run(
            ["powershell", "-STA", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            timeout=120
        )
        selected_file = ps_run.stdout.strip()
        if not selected_file:
            return {"cancelled": True}

        norm_path = os.path.normpath(selected_file)
        if not os.path.isfile(norm_path):
            return {"cancelled": True}

        file_size_mb = round(os.path.getsize(norm_path) / (1024 * 1024), 2)
        probe = probe_media_file(norm_path)
        quoted_path = urllib.parse.quote(norm_path)

        log_msg("MEDIA", f"Linked local file: '{os.path.basename(norm_path)}' ({file_size_mb} MB) [Zero Copy]")
        return {
            "cancelled": False,
            "file_path": norm_path,
            "filename": os.path.basename(norm_path),
            "size_mb": file_size_mb,
            "duration": probe.get("duration", 0),
            "width": probe.get("width", 1080),
            "height": probe.get("height", 1920),
            "fps": probe.get("fps", 30),
            "stream_url": f"/api/media/stream?path={quoted_path}"
        }
    except Exception as e:
        log_msg("ERROR", f"Native browse file failed: {e}")
        return {"cancelled": True, "error": str(e)}

@app.post("/api/media/link-path")
def link_path_endpoint(req: LinkPathRequest):
    """Directly links a known absolute path on the user's hard drive."""
    p = os.path.normpath(req.file_path)
    if not os.path.isfile(p):
        raise HTTPException(status_code=404, detail="Specified media file does not exist on disk")

    file_size_mb = round(os.path.getsize(p) / (1024 * 1024), 2)
    probe = probe_media_file(p)
    quoted_path = urllib.parse.quote(p)

    log_msg("MEDIA", f"Linked media path: '{os.path.basename(p)}' ({file_size_mb} MB)")
    return {
        "file_path": p,
        "filename": os.path.basename(p),
        "size_mb": file_size_mb,
        "duration": probe.get("duration", 0),
        "width": probe.get("width", 1080),
        "height": probe.get("height", 1920),
        "fps": probe.get("fps", 30),
        "stream_url": f"/api/media/stream?path={quoted_path}"
    }

@app.get("/api/media/stream")
def stream_media_endpoint(path: str, request: Request):
    """HTTP 206 Partial Content Range streaming of local video files directly from disk."""
    norm_path = os.path.normpath(urllib.parse.unquote(path))
    if not os.path.isfile(norm_path):
        raise HTTPException(status_code=404, detail="Media file not found on disk")

    file_size = os.path.getsize(norm_path)
    mime_type, _ = mimetypes.guess_type(norm_path)
    if not mime_type:
        mime_type = "video/mp4"

    range_header = request.headers.get("range")
    if range_header:
        range_match = re.match(r"bytes=(\d+)-(\d+)?", range_header)
        if range_match:
            start = int(range_match.group(1))
            end = int(range_match.group(2)) if range_match.group(2) else file_size - 1
            start = max(0, start)
            end = min(file_size - 1, end)
            content_length = (end - start) + 1

            def iter_chunk():
                with open(norm_path, "rb") as f:
                    f.seek(start)
                    remaining = content_length
                    chunk_sz = 256 * 1024
                    while remaining > 0:
                        read_bytes = min(remaining, chunk_sz)
                        buf = f.read(read_bytes)
                        if not buf:
                            break
                        remaining -= len(buf)
                        yield buf

            headers = {
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Content-Type": mime_type,
            }
            return StreamingResponse(iter_chunk(), status_code=206, headers=headers)

    def iter_full():
        with open(norm_path, "rb") as f:
            while chunk := f.read(256 * 1024):
                yield chunk

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": mime_type,
    }
    return StreamingResponse(iter_full(), status_code=200, headers=headers)

@app.post("/api/media/check-status")
def check_media_status_endpoint(paths: List[str]):
    """Premiere Pro-style offline media check: verifies if linked files still exist on disk."""
    results = {}
    for p in paths:
        norm = os.path.normpath(p) if p else ""
        results[p] = bool(norm and os.path.isfile(norm))
    return results

@app.post("/api/transcribe-linked")
def transcribe_linked_endpoint(req: TranscribeLinkedRequest):
    """Transcribes linked media directly from local disk path using ephemeral audio extraction."""
    p = os.path.normpath(req.file_path)
    if not os.path.isfile(p):
        raise HTTPException(status_code=404, detail="Linked video file not found on disk")

    try:
        log_msg("TRANSCRIBE", f"Direct linked transcription: '{os.path.basename(p)}' (Model: {req.model_name})")
        result = transcribe_media(
            file_path=p,
            model_name=req.model_name or "base",
            language=req.language,
            max_words_per_segment=req.max_words_per_segment or 3,
            remove_punctuation=bool(req.remove_punctuation)
        )
        return {
            "file_path": p,
            "filename": os.path.basename(p),
            "language": result["language"],
            "language_probability": result["language_probability"],
            "duration": result["duration"],
            "total_words": result["total_words"],
            "segments": result["segments"],
            "elapsed_seconds": result["elapsed_seconds"]
        }
    except Exception as e:
        log_msg("ERROR", f"Linked transcription failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/media/prune-storage")
def prune_storage_endpoint():
    """Cleans up stale duplicates in backend/storage/uploads to reclaim disk space."""
    cleaned_bytes = 0
    removed_files = 0
    if os.path.exists(UPLOADS_DIR):
        for fname in os.listdir(UPLOADS_DIR):
            fpath = os.path.join(UPLOADS_DIR, fname)
            try:
                if os.path.isfile(fpath):
                    cleaned_bytes += os.path.getsize(fpath)
                    os.remove(fpath)
                    removed_files += 1
            except Exception:
                pass
    mb = round(cleaned_bytes / (1024 * 1024), 2)
    log_msg("CLEANUP", f"Pruned {removed_files} files from uploads ({mb} MB reclaimed)")
    return {"freed_mb": mb, "files_removed": removed_files}

# ---------------------------------------------------------------------------
# Project Management Storage Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/projects")
def list_projects_endpoint():
    projects = []
    if os.path.exists(PROJECTS_DIR):
        for fname in os.listdir(PROJECTS_DIR):
            if fname.endswith(".json"):
                fpath = os.path.join(PROJECTS_DIR, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if data.get("is_linked") and data.get("linked_path"):
                            data["media_online"] = os.path.isfile(data["linked_path"])
                        projects.append(data)
                except Exception:
                    pass
    projects.sort(key=lambda p: p.get("updated_at", ""), reverse=True)
    return {"projects": projects}

@app.post("/api/projects")
def save_project_endpoint(project_data: Dict[str, Any]):
    pid = project_data.get("id")
    if not pid:
        pid = f"proj_{uuid.uuid4().hex[:10]}"
        project_data["id"] = pid
    if not project_data.get("created_at"):
        project_data["created_at"] = datetime.datetime.now().isoformat()
    project_data["updated_at"] = datetime.datetime.now().isoformat()

    fpath = os.path.join(PROJECTS_DIR, f"{pid}.json")
    with open(fpath, "w", encoding="utf-8") as f:
        json.dump(project_data, f, indent=2)
    log_msg("PROJECTS", f"Saved project '{project_data.get('title', pid)}' -> {pid}.json")
    return {"status": "saved", "project": project_data}

@app.get("/api/projects/{project_id}")
def get_project_endpoint(project_id: str):
    fpath = os.path.join(PROJECTS_DIR, f"{project_id}.json")
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="Project not found")
    with open(fpath, "r", encoding="utf-8") as f:
        data = json.load(f)
    if data.get("is_linked") and data.get("linked_path"):
        data["media_online"] = os.path.isfile(data["linked_path"])
    return data

@app.delete("/api/projects/{project_id}")
def delete_project_endpoint(project_id: str):
    fpath = os.path.join(PROJECTS_DIR, f"{project_id}.json")
    if os.path.exists(fpath):
        os.remove(fpath)
        log_msg("PROJECTS", f"Deleted project {project_id}")
        return {"status": "deleted", "id": project_id}
    raise HTTPException(status_code=404, detail="Project not found")

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
            max_words_per_segment=req.max_words_per_segment or 3,
            remove_punctuation=bool(req.remove_punctuation)
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
    max_words_per_segment: int = Form(3),
    remove_punctuation: bool = Form(False)
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
            max_words_per_segment=max_words_per_segment,
            remove_punctuation=bool(remove_punctuation)
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
    engine_name = "Ultra-Fidelity Chrome DOM" if req.engine_type == "dom" else "Fast ASS Subtitles"
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
        log_msg("RENDER", f"[{engine_name} | {mode_label}] Starting video export for '{req.video_filename}' ({req.width}x{req.height})")
        
        if req.engine_type == "dom":
            render_captioned_video_dom(
                source_video_path=source_path,
                output_video_path=output_path,
                segments=req.segments,
                style=req.style,
                video_width=req.width or 1080,
                video_height=req.height or 1920,
                video_duration=req.video_duration,
                encoder_mode=req.encoder_mode or "gpu_nvenc",
                on_proc_ready=on_proc,
                progress_callback=on_progress
            )
        else:
            render_captioned_video(
                source_video_path=source_path,
                output_video_path=output_path,
                segments=req.segments,
                style=req.style,
                video_width=req.width or 1080,
                video_height=req.height or 1920,
                video_duration=req.video_duration,
                encoder_mode=req.encoder_mode or "gpu_nvenc",
                preview_metrics=req.preview_metrics,
                on_proc_ready=on_proc,
                progress_callback=on_progress
            )
        
        if RENDER_JOBS[job_id].get("status") != "cancelled":
            RENDER_JOBS[job_id]["percent"] = 100
            RENDER_JOBS[job_id]["status"] = "done"
            RENDER_JOBS[job_id]["download_url"] = f"/static/exports/{export_filename}"
            log_msg("SUCCESS", f"[{engine_name} | {mode_label}] Export complete: {export_filename}")
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

    source_path = ""
    if req.linked_path and os.path.isfile(req.linked_path):
        source_path = req.linked_path
    elif os.path.isabs(req.video_filename) and os.path.isfile(req.video_filename):
        source_path = req.video_filename
    else:
        source_path = os.path.join(UPLOADS_DIR, req.video_filename)
        if not os.path.exists(source_path):
            demo_path = os.path.join(DEMO_DIR, req.video_filename)
            if os.path.exists(demo_path):
                source_path = demo_path
            else:
                raise HTTPException(status_code=404, detail="Source video file not found")
            
    _prune_old_jobs()
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
            parent = psutil.Process(proc.pid)
            for child in parent.children(recursive=True):
                try:
                    child.kill()
                except Exception:
                    pass
            parent.kill()
            proc.wait(timeout=1.0)
        except Exception:
            try:
                proc.kill()
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

def _do_separation_task(job_id: str, input_file_path: str, engine: str):
    def on_progress(pct, msg=""):
        if job_id in SEPARATION_JOBS:
            SEPARATION_JOBS[job_id]["percent"] = pct
            SEPARATION_JOBS[job_id]["message"] = msg

    try:
        SEPARATION_JOBS[job_id]["status"] = "processing"
        SEPARATION_JOBS[job_id]["percent"] = 5
        SEPARATION_JOBS[job_id]["message"] = "Initializing separation model..."
        
        result = process_audio_separation(
            input_file_path=input_file_path,
            engine=engine,
            job_id=job_id,
            progress_callback=on_progress
        )
        
        if SEPARATION_JOBS[job_id].get("status") != "cancelled":
            SEPARATION_JOBS[job_id]["status"] = "done"
            SEPARATION_JOBS[job_id]["percent"] = 100
            SEPARATION_JOBS[job_id]["message"] = "Separation complete"
            SEPARATION_JOBS[job_id]["result"] = result
    except Exception as e:
        if SEPARATION_JOBS[job_id].get("status") != "cancelled":
            SEPARATION_JOBS[job_id]["status"] = "error"
            SEPARATION_JOBS[job_id]["error"] = str(e)
            SEPARATION_JOBS[job_id]["message"] = f"Separation error: {str(e)}"

@app.post("/api/separate-audio")
async def separate_audio_endpoint(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    filename: Optional[str] = Form(None),
    engine: Optional[str] = Form("demucs")
):
    if not file and not filename:
        raise HTTPException(status_code=400, detail="Must provide either an uploaded file or an existing filename.")

    _prune_old_jobs()
    job_id = f"sep_{uuid.uuid4().hex[:10]}"
    
    if file:
        orig_name = file.filename or "audio_input.mp3"
        safe_ext = os.path.splitext(orig_name)[1] or ".mp3"
        saved_filename = f"{job_id}_input{safe_ext}"
        saved_path = os.path.join(UPLOADS_DIR, saved_filename)
        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        input_file_path = saved_path
    else:
        input_file_path = os.path.join(UPLOADS_DIR, filename)
        if not os.path.exists(input_file_path):
            raise HTTPException(status_code=404, detail=f"File '{filename}' not found in uploads directory.")

    SEPARATION_JOBS[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "percent": 0,
        "message": "Queued in separation pipeline...",
        "engine": engine or "demucs",
        "error": None,
        "result": None
    }

    background_tasks.add_task(_do_separation_task, job_id, input_file_path, engine or "demucs")

    return {
        "status": "queued",
        "job_id": job_id,
        "engine": engine or "demucs"
    }

@app.get("/api/separate-progress/{job_id}")
def get_separation_progress(job_id: str):
    if job_id not in SEPARATION_JOBS:
        raise HTTPException(status_code=404, detail="Separation job not found")
    return SEPARATION_JOBS[job_id]

@app.post("/api/separate-cancel/{job_id}")
def cancel_separation_endpoint(job_id: str):
    if job_id in SEPARATION_JOBS:
        SEPARATION_JOBS[job_id]["status"] = "cancelled"
        SEPARATION_JOBS[job_id]["error"] = "Cancelled by user"
    return {"status": "cancelled", "job_id": job_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
