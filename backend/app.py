import os
import sys
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
import time
import hashlib
import zipfile
from typing import Optional, List, Dict, Any, Union
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request, Body
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import imageio_ffmpeg
from transcriber import transcribe_media, scan_model_cache, trigger_model_download, get_model_download_status, delete_cached_model, get_models_cache_dir, setup_cuda_dlls, log_msg, LOG_HISTORY
from renderer import render_captioned_video, render_hybrid_overlay_video
from dom_renderer import render_captioned_video_dom
from audio_separator import process_audio_separation, VOCALS_DIR
from upscaler import is_upscaler_installed, ensure_upscaler_ready, upscale_video, AVAILABLE_MODELS, get_video_stream_info as get_upscaler_video_info

# Base Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
UPLOADS_DIR = os.path.join(STORAGE_DIR, "uploads")
EXPORTS_DIR = os.path.join(STORAGE_DIR, "exports")
FONTS_DIR = os.path.join(STORAGE_DIR, "fonts")
DEMO_DIR = os.path.join(STORAGE_DIR, "demo")
PROJECTS_DIR = os.path.join(STORAGE_DIR, "projects")
THUMBNAILS_DIR = os.path.join(STORAGE_DIR, "thumbnails")

for d in [UPLOADS_DIR, EXPORTS_DIR, FONTS_DIR, DEMO_DIR, VOCALS_DIR, PROJECTS_DIR, THUMBNAILS_DIR]:
    os.makedirs(d, exist_ok=True)

app = FastAPI(title="AutoCaption Studio API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/static/exports", StaticFiles(directory=EXPORTS_DIR), name="exports")
app.mount("/static/vocals", StaticFiles(directory=VOCALS_DIR), name="vocals")
app.mount("/static/demo", StaticFiles(directory=DEMO_DIR), name="demo")
app.mount("/static/thumbnails", StaticFiles(directory=THUMBNAILS_DIR), name="thumbnails")

RENDER_JOBS: Dict[str, Dict[str, Any]] = {}
ACTIVE_RENDER_PROCESSES: Dict[str, subprocess.Popen] = {}
SEPARATION_JOBS: Dict[str, Dict[str, Any]] = {}
ACTIVE_SEPARATION_PROCESSES: Dict[str, subprocess.Popen] = {}
UPSCALE_JOBS: Dict[str, Dict[str, Any]] = {}
ACTIVE_UPSCALE_PROCESSES: Dict[str, subprocess.Popen] = {}

def _prune_old_jobs():
    global RENDER_JOBS, SEPARATION_JOBS, UPSCALE_JOBS
    if len(RENDER_JOBS) > 80:
        for k in list(RENDER_JOBS.keys())[:-40]:
            RENDER_JOBS.pop(k, None)
    if len(SEPARATION_JOBS) > 80:
        for k in list(SEPARATION_JOBS.keys())[:-40]:
            SEPARATION_JOBS.pop(k, None)
    if len(UPSCALE_JOBS) > 80:
        for k in list(UPSCALE_JOBS.keys())[:-40]:
            UPSCALE_JOBS.pop(k, None)

    # Clean up temporary export and debug files older than 24 hours
    try:
        now = time.time()
        cutoff = now - (24 * 3600)
        for folder in [EXPORTS_DIR, os.path.join(STORAGE_DIR, "debug"), THUMBNAILS_DIR]:
            if os.path.exists(folder):
                for fname in os.listdir(folder):
                    if fname.startswith(".gitkeep"):
                        continue
                    fpath = os.path.join(folder, fname)
                    if os.path.isfile(fpath) and os.path.getmtime(fpath) < cutoff:
                        try:
                            os.remove(fpath)
                        except Exception:
                            pass
    except Exception:
        pass

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
    output_filename: Optional[str] = None
    ai_upscale: Optional[bool] = False
    ai_model: Optional[str] = "realesr-animevideov3"
    fps: Optional[float] = None
    video_quality: Optional[str] = None
    brightness: Optional[float] = 1.0
    contrast: Optional[float] = 1.0

class UpscaleRequest(BaseModel):
    video_filename: Optional[str] = None
    linked_path: Optional[str] = None
    scale: Optional[int] = 2
    model_name: Optional[str] = "realesr-animevideov3"
    target_width: Optional[int] = None
    target_height: Optional[int] = None
    encoder_mode: Optional[str] = "gpu_nvenc"
    output_filename: Optional[str] = None

class TranscribeSavedRequest(BaseModel):
    video_filename: str
    model_name: Optional[str] = "base"
    language: Optional[str] = None
    max_words_per_segment: Optional[int] = 3
    remove_punctuation: Optional[bool] = False
    linked_path: Optional[str] = None

class LinkPathRequest(BaseModel):
    file_path: str

class CheckMediaStatusRequest(BaseModel):
    paths: Optional[List[str]] = None

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

class BatchZipRequest(BaseModel):
    filenames: List[str]
    zip_name: Optional[str] = "AutoCaption_Batch_Export.zip"

class TagRec709Request(BaseModel):
    file_path: Optional[str] = None
    linked_path: Optional[str] = None
    filename: Optional[str] = None
    full_range: Optional[bool] = False

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

    is_color_tagged = bool(re.search(r"(bt709|rec709|smpte170m|bt2020)", out, re.IGNORECASE))

    return {
        "duration": round(dur, 2),
        "width": w,
        "height": h,
        "fps": fps,
        "is_color_tagged": is_color_tagged
    }

def resolve_media_path(filename: Optional[str] = None, linked_path: Optional[str] = None) -> Optional[str]:
    """
    Robustly resolves a video or audio file across all storage locations and project registries:
    1. Explicit linked_path (direct disk location)
    2. Absolute path in filename
    3. Storage uploads directory (UPLOADS_DIR)
    4. Storage demo directory (DEMO_DIR)
    5. Storage exports directory (EXPORTS_DIR)
    6. Relative or normalized path on disk
    7. Storage uploads directory using base filename or unquoted filename
    8. Saved projects directory (PROJECTS_DIR) matching filename, title, or project ID
    9. Fuzzy match in uploads directory
    """
    if linked_path and isinstance(linked_path, str) and linked_path.strip():
        unquoted_l = urllib.parse.unquote(linked_path.strip())
        norm_l = os.path.normpath(unquoted_l)
        if os.path.isfile(norm_l):
            return norm_l
        norm_raw = os.path.normpath(linked_path.strip())
        if os.path.isfile(norm_raw):
            return norm_raw

    if filename and isinstance(filename, str) and filename.strip():
        fn_raw = filename.strip()
        fn_unquoted = urllib.parse.unquote(fn_raw)

        candidate_names = list(dict.fromkeys([fn_raw, fn_unquoted, os.path.basename(fn_raw), os.path.basename(fn_unquoted)]))

        for fn in candidate_names:
            # 1. Direct path check
            norm_fn = os.path.normpath(fn)
            if os.path.isfile(norm_fn):
                return norm_fn

            # 2. Check uploads directory
            up_path = os.path.join(UPLOADS_DIR, fn)
            if os.path.isfile(up_path):
                return up_path

            # 3. Check demo directory
            dm_path = os.path.join(DEMO_DIR, fn)
            if os.path.isfile(dm_path):
                return dm_path

            # 4. Check exports directory
            exp_path = os.path.join(EXPORTS_DIR, fn)
            if os.path.isfile(exp_path):
                return exp_path

            # 4b. Check debug directory
            dbg_path = os.path.join(STORAGE_DIR, "debug", fn)
            if os.path.isfile(dbg_path):
                return dbg_path

        # 6. Check saved projects in PROJECTS_DIR
        if os.path.isdir(PROJECTS_DIR):
            try:
                for pf in os.listdir(PROJECTS_DIR):
                    if pf.endswith(".json"):
                        try:
                            with open(os.path.join(PROJECTS_DIR, pf), "r", encoding="utf-8") as f:
                                pdata = json.load(f)
                                matches = (
                                    pdata.get("videoFilename") in candidate_names or
                                    pdata.get("title") in candidate_names or
                                    pdata.get("id") in candidate_names or
                                    (os.path.basename(pdata.get("videoFilename") or "") in candidate_names)
                                )
                                if matches:
                                    # Check linkedSourcePath
                                    lsp = pdata.get("linkedSourcePath")
                                    if lsp:
                                        lsp_norm = os.path.normpath(urllib.parse.unquote(lsp))
                                        if os.path.isfile(lsp_norm):
                                            return lsp_norm
                                    # Check videoFilename in uploads
                                    pvf = pdata.get("videoFilename")
                                    if pvf:
                                        for cand_pvf in [pvf, urllib.parse.unquote(pvf), os.path.basename(pvf)]:
                                            cand_path = os.path.join(UPLOADS_DIR, cand_pvf)
                                            if os.path.isfile(cand_path):
                                                return cand_path
                        except Exception:
                            continue
            except Exception:
                pass

        # 7. Fuzzy match in uploads directory if filename contains words
        if os.path.isdir(UPLOADS_DIR):
            clean_needle = re.sub(r'[^a-zA-Z0-9]', '', fn_unquoted.lower())
            if len(clean_needle) > 3:
                for uf in os.listdir(UPLOADS_DIR):
                    clean_uf = re.sub(r'[^a-zA-Z0-9]', '', uf.lower())
                    if (clean_needle in clean_uf or clean_uf in clean_needle) and os.path.isfile(os.path.join(UPLOADS_DIR, uf)):
                        return os.path.join(UPLOADS_DIR, uf)

    return None

@app.post("/api/media/browse-file")
def browse_file_endpoint():
    """Launches the native Windows File Picker dialog in an isolated process without copying files."""
    try:
        picker_script = os.path.join(BASE_DIR, "file_picker.py")
        res = subprocess.run(
            [sys.executable, picker_script],
            capture_output=True,
            text=True,
            timeout=180
        )
        output = res.stdout.strip()
        if not output:
            return {"cancelled": True}

        selected_file = None
        try:
            parsed = json.loads(output)
            if parsed.get("cancelled", False):
                return {"cancelled": True}
            selected_file = parsed.get("file_path") or parsed.get("path")
        except Exception:
            selected_file = output

        if not selected_file or selected_file == "__CANCELLED__":
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
        "is_color_tagged": probe.get("is_color_tagged", False),
        "stream_url": f"/api/media/stream?path={quoted_path}"
    }

@app.post("/api/media/tag-rec709")
def tag_media_rec709_endpoint(req: TagRec709Request):
    """
    Losslessly injects Rec.709 VUI color metadata tags into an H.264 MP4 bitstream.
    Executes in <1 second with zero quality loss (-c copy) and preserves all video frames bit-for-bit.
    """
    target_path = resolve_media_path(filename=req.filename, linked_path=req.linked_path or req.file_path)
    if not target_path or not os.path.isfile(target_path):
        raise HTTPException(status_code=404, detail="Media file not found on disk")

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    dir_name = os.path.dirname(target_path)
    base_name, ext = os.path.splitext(os.path.basename(target_path))
    clean_base = re.sub(r"_rec709(_tv|_pc)?$", "", base_name)
    range_suffix = "_pc" if req.full_range else "_tv"
    tagged_filename = f"{clean_base}_rec709{range_suffix}{ext}"
    tagged_path = os.path.join(dir_name, tagged_filename)

    # If the tagged file already exists and has valid color tags, return instantly
    if os.path.isfile(tagged_path) and os.path.getsize(tagged_path) > 1000:
        probe = probe_media_file(tagged_path)
        if probe.get("is_color_tagged"):
            quoted = urllib.parse.quote(tagged_path)
            file_size_mb = round(os.path.getsize(tagged_path) / (1024 * 1024), 2)
            log_msg("MEDIA", f"Using existing Rec.709 tagged file: '{tagged_filename}' ({file_size_mb} MB)")
            return {
                "success": True,
                "tagged_path": tagged_path,
                "filename": tagged_filename,
                "size_mb": file_size_mb,
                "duration": probe.get("duration", 0),
                "width": probe.get("width", 1080),
                "height": probe.get("height", 1920),
                "fps": probe.get("fps", 30),
                "is_color_tagged": True,
                "stream_url": f"/api/media/stream?path={quoted}"
            }

    full_range_flag = 1 if req.full_range else 0
    cmd = [
        ffmpeg_exe, "-y",
        "-i", target_path,
        "-c", "copy",
        "-bsf:v", f"h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag={full_range_flag}",
        "-color_range", "pc" if req.full_range else "tv",
        "-movflags", "+faststart",
        tagged_path
    ]

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0 or not os.path.isfile(tagged_path):
        raise HTTPException(status_code=500, detail=f"Rec.709 color tagging failed: {res.stderr}")

    probe = probe_media_file(tagged_path)
    quoted = urllib.parse.quote(tagged_path)
    file_size_mb = round(os.path.getsize(tagged_path) / (1024 * 1024), 2)
    log_msg("MEDIA", f"Losslessly injected Rec.709 color tags: '{tagged_filename}' ({file_size_mb} MB)")

    return {
        "success": True,
        "tagged_path": tagged_path,
        "filename": tagged_filename,
        "size_mb": file_size_mb,
        "duration": probe.get("duration", 0),
        "width": probe.get("width", 1080),
        "height": probe.get("height", 1920),
        "fps": probe.get("fps", 30),
        "is_color_tagged": True,
        "stream_url": f"/api/media/stream?path={quoted}"
    }

@app.get("/api/media/stream")
def stream_media_endpoint(path: str, request: Request):
    """HTTP 206 Partial Content Range streaming of local video files directly from disk."""
    norm_path = os.path.normpath(urllib.parse.unquote(path))
    if not os.path.isfile(norm_path):
        raise HTTPException(status_code=404, detail="Media file not found on disk")

    valid_media_exts = {
        ".mp4", ".mov", ".mkv", ".webm", ".avi", ".wmv", ".m4v",
        ".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".wma",
        ".jpg", ".jpeg", ".png", ".webp"
    }
    _, ext = os.path.splitext(norm_path.lower())
    if ext not in valid_media_exts:
        raise HTTPException(status_code=403, detail="Forbidden media file type")

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

@app.get("/api/media/thumbnail")
def get_media_thumbnail_endpoint(
    filename: Optional[str] = None,
    path: Optional[str] = None,
    time_offset: Optional[float] = 0.0
):
    """
    Extracts, caches, and streams a real video snapshot thumbnail from a video file.
    Supports linked direct disk files, uploaded files, and demo files.
    Defaults to extracting the exact first frame (time_offset = 0.0s).
    """
    raw_path = urllib.parse.unquote(path) if path else None
    raw_filename = urllib.parse.unquote(filename) if filename else None

    source_path = resolve_media_path(raw_filename, raw_path)
    if not source_path or not os.path.isfile(source_path):
        raise HTTPException(status_code=404, detail="Media file not found for thumbnail generation")

    try:
        mtime = os.path.getmtime(source_path)
        size = os.path.getsize(source_path)
        offset = max(0.0, float(time_offset) if time_offset is not None else 0.0)
        cache_key = hashlib.md5(f"{source_path}_{mtime}_{size}_{offset:.2f}".encode("utf-8")).hexdigest()
        thumb_path = os.path.join(THUMBNAILS_DIR, f"{cache_key}.jpg")

        if os.path.isfile(thumb_path) and os.path.getsize(thumb_path) > 100:
            return FileResponse(thumb_path, media_type="image/jpeg")

        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

        # Extract first frame at specified offset (default 0.0s)
        cmd = [
            ffmpeg_exe, "-y",
            "-ss", f"{offset:.2f}",
            "-i", source_path,
            "-vframes", "1",
            "-vf", "scale=480:-2",
            "-q:v", "3",
            thumb_path
        ]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=12)

        # Fallback to direct first frame extraction if first attempt failed
        if not os.path.isfile(thumb_path) or os.path.getsize(thumb_path) == 0:
            cmd_fallback = [
                ffmpeg_exe, "-y",
                "-i", source_path,
                "-vframes", "1",
                "-vf", "scale=480:-2",
                "-q:v", "3",
                thumb_path
            ]
            subprocess.run(cmd_fallback, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=12)

        if os.path.isfile(thumb_path) and os.path.getsize(thumb_path) > 100:
            return FileResponse(thumb_path, media_type="image/jpeg")
        else:
            raise HTTPException(status_code=404, detail="Could not extract video frame (audio-only or corrupt stream)")
    except HTTPException:
        raise
    except Exception as e:
        log_msg("ERROR", f"Thumbnail generation error for '{source_path}': {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate thumbnail: {e}")


@app.post("/api/media/check-status")
def check_media_status_endpoint(body: Any = Body(...)):
    """Premiere Pro-style offline media check: verifies if linked files still exist on disk."""
    raw_paths = []
    if isinstance(body, dict):
        raw_paths = body.get("paths", [])
    elif isinstance(body, list):
        raw_paths = body
    elif hasattr(body, "paths"):
        raw_paths = body.paths or []

    results = {}
    for p in raw_paths:
        if not p or not isinstance(p, str):
            continue
        norm = os.path.normpath(p)
        exists = bool(norm and os.path.isfile(norm))
        results[p] = exists
        results[norm] = exists
        results[norm.replace('\\', '/')] = exists
        results[norm.replace('/', '\\')] = exists

    return {
        "status": "ok",
        "results": results,
        **results
    }

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
    projects.sort(key=lambda p: p.get("updated_at") or p.get("updatedAt") or p.get("created_at") or p.get("createdAt") or "", reverse=True)
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

    clean_pid = re.sub(r'[^a-zA-Z0-9_-]', '', pid) or f"proj_{uuid.uuid4().hex[:10]}"
    project_data["id"] = clean_pid
    fpath = os.path.join(PROJECTS_DIR, f"{clean_pid}.json")
    with open(fpath, "w", encoding="utf-8") as f:
        json.dump(project_data, f, indent=2)
    log_msg("PROJECTS", f"Saved project '{project_data.get('title', clean_pid)}' -> {clean_pid}.json")
    return {"status": "saved", "project": project_data}

@app.get("/api/projects/{project_id}")
def get_project_endpoint(project_id: str):
    clean_pid = re.sub(r'[^a-zA-Z0-9_-]', '', project_id)
    if not clean_pid:
        raise HTTPException(status_code=400, detail="Invalid project ID")
    fpath = os.path.join(PROJECTS_DIR, f"{clean_pid}.json")
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="Project not found")
    with open(fpath, "r", encoding="utf-8") as f:
        data = json.load(f)
    if data.get("is_linked") and data.get("linked_path"):
        data["media_online"] = os.path.isfile(data["linked_path"])
    return data

@app.delete("/api/projects/{project_id}")
def delete_project_endpoint(project_id: str):
    clean_pid = re.sub(r'[^a-zA-Z0-9_-]', '', project_id)
    if not clean_pid:
        raise HTTPException(status_code=400, detail="Invalid project ID")
    fpath = os.path.join(PROJECTS_DIR, f"{clean_pid}.json")
    if os.path.exists(fpath):
        os.remove(fpath)
        log_msg("PROJECTS", f"Deleted project {clean_pid}")
        return {"status": "deleted", "id": clean_pid}
    raise HTTPException(status_code=404, detail="Project not found")

@app.post("/api/transcribe-saved")
def transcribe_saved_endpoint(req: TranscribeSavedRequest):
    source_path = resolve_media_path(req.video_filename, req.linked_path)
    if not source_path:
        log_msg("TRANSCRIBE", f"File not found: video_filename='{req.video_filename}', linked_path='{req.linked_path}'")
        raise HTTPException(status_code=404, detail="Video file not found")
            
    try:
        log_msg("TRANSCRIBE", f"Transcribing '{os.path.basename(source_path)}' using model '{req.model_name}'")
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
def transcribe_endpoint(
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

@app.post("/api/upload-video")
async def upload_video_endpoint(file: UploadFile = File(...)):
    file_id = uuid.uuid4().hex[:12]
    ext = os.path.splitext(file.filename)[1] or ".mp4"
    saved_filename = f"{file_id}{ext}"
    saved_path = os.path.join(UPLOADS_DIR, saved_filename)
    
    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    probe = get_upscaler_video_info(saved_path)
    log_msg("UPLOAD", f"Uploaded video file '{file.filename}' -> {saved_filename} ({probe.get('width')}x{probe.get('height')})")
    
    return {
        "video_filename": saved_filename,
        "video_url": f"/static/uploads/{saved_filename}",
        "width": probe.get("width", 1080),
        "height": probe.get("height", 1920),
        "fps": probe.get("fps", 30),
        "duration": probe.get("duration", 0)
    }

def _do_render_task(job_id: str, req: RenderRequest, source_path: str, output_path: str, export_filename: str):
    engine_name = "Ultra-Fidelity Chrome DOM" if req.engine_type == "dom" else "Fast ASS Subtitles"
    mode_label = "CPU Ultra-Fast" if req.encoder_mode == "cpu" else "NVIDIA GPU NVENC"
    has_upscaled = False
    clean_filename = None
    
    def on_proc(proc):
        ACTIVE_RENDER_PROCESSES[job_id] = proc

    def is_cancelled():
        return RENDER_JOBS.get(job_id, {}).get("status") == "cancelled"

    def on_progress(pct_val):
        try:
            if isinstance(pct_val, dict):
                val = int(pct_val.get("percent", 0))
                cur_f = int(pct_val.get("current_frame", 0))
                tot_f = int(pct_val.get("total_frames", 0))
                fps_v = float(pct_val.get("fps", 0))
                spd_v = str(pct_val.get("speed", "1x"))
                msg_v = str(pct_val.get("message", ""))
                
                RENDER_JOBS[job_id]["render_details"] = {
                    "current_frame": cur_f,
                    "total_frames": tot_f,
                    "fps": fps_v,
                    "speed": spd_v
                }
            else:
                val = int(pct_val)
                msg_v = f"{val}%"

            if has_upscaled:
                overall = 70 + int(val * 0.29)
                RENDER_JOBS[job_id]["message"] = f"Phase 2/2 (Burning Captions): {msg_v or f'{val}%'}"
            else:
                overall = val
                RENDER_JOBS[job_id]["message"] = msg_v or f"Rendering Captions: {val}%"
                
            if overall >= 100:
                RENDER_JOBS[job_id]["percent"] = 100
            else:
                RENDER_JOBS[job_id]["percent"] = max(RENDER_JOBS[job_id]["percent"], min(99, overall))
        except Exception:
            pass
            
    actual_source_path = source_path
    try:
        RENDER_JOBS[job_id]["percent"] = 5
        RENDER_JOBS[job_id]["status"] = "rendering"
        RENDER_JOBS[job_id]["stage"] = "starting"
        RENDER_JOBS[job_id]["message"] = "Initializing render pipeline..."
        log_msg("RENDER", f"[{engine_name} | {mode_label}] Starting video export for '{req.video_filename}' ({req.width}x{req.height})")

        # Optional AI Super-Resolution Pre-pass (Real-ESRGAN Vulkan)
        if getattr(req, "ai_upscale", False) and is_upscaler_installed():
            src_info = get_upscaler_video_info(source_path)
            target_w = req.width or 1080
            target_h = req.height or 1920
            model_to_use = getattr(req, "ai_model", "realesr-animevideov3") or "realesr-animevideov3"
            log_msg("RENDER", f"AI Super-Resolution requested: upscaling source {src_info['width']}x{src_info['height']} -> {target_w}x{target_h} via Real-ESRGAN Vulkan ({model_to_use})...")
            RENDER_JOBS[job_id]["stage"] = "upscaling"
            RENDER_JOBS[job_id]["percent"] = 6
            RENDER_JOBS[job_id]["message"] = "Phase 1/2: Initializing Real-ESRGAN Vulkan super-resolution..."
            clean_filename = f"clean_upscaled_{job_id}.mp4"
            clean_path = os.path.join(EXPORTS_DIR, clean_filename)
            
            def on_up_prog(p_data: dict):
                pct = 6 + int(p_data.get("percent", 0) * 0.62)
                RENDER_JOBS[job_id]["percent"] = min(68, pct)
                RENDER_JOBS[job_id]["stage"] = "upscaling"
                RENDER_JOBS[job_id]["message"] = f"Phase 1/2 [AI Super-Resolution]: {p_data.get('message', '')}"
                RENDER_JOBS[job_id]["upscale_details"] = p_data
            
            try:
                upscale_scale = 2 if target_w <= src_info["width"] * 2.2 else 4
                upscale_video(
                    source_video_path=source_path,
                    output_video_path=clean_path,
                    scale=upscale_scale,
                    model_name=model_to_use,
                    target_width=target_w,
                    target_height=target_h,
                    encoder_mode=req.encoder_mode or "gpu_nvenc",
                    progress_callback=on_up_prog,
                    on_proc_ready=on_proc
                )
                if os.path.isfile(clean_path) and os.path.getsize(clean_path) > 1000:
                    actual_source_path = clean_path
                    has_upscaled = True
                    RENDER_JOBS[job_id]["clean_download_url"] = f"/static/exports/{clean_filename}"
                    RENDER_JOBS[job_id]["percent"] = 70
                    RENDER_JOBS[job_id]["stage"] = "rendering"
                    RENDER_JOBS[job_id]["message"] = "Phase 2/2: Burning in styled captions onto upscaled master..."
                    log_msg("RENDER", f"AI Super-Resolution pre-pass complete! Now rendering captions onto {clean_filename}.")
            except Exception as up_err:
                if is_cancelled():
                    log_msg("RENDER", f"Job {job_id} cancelled during upscaling, stopping pipeline.")
                    return
                log_msg("WARN", f"AI Super-Resolution pre-pass encountered issue ({up_err}), falling back to native source scaling.")
        
        if is_cancelled():
            return

        if req.engine_type == "dom":
            render_captioned_video_dom(
                source_video_path=actual_source_path,
                output_video_path=output_path,
                segments=req.segments,
                style=req.style,
                video_width=req.width or 1080,
                video_height=req.height or 1920,
                video_duration=req.video_duration,
                encoder_mode=req.encoder_mode or "gpu_nvenc",
                brightness=req.brightness or 1.0,
                contrast=req.contrast or 1.0,
                on_proc_ready=on_proc,
                progress_callback=on_progress,
                is_cancelled=is_cancelled
            )
        else:
            render_captioned_video(
                source_video_path=actual_source_path,
                output_video_path=output_path,
                segments=req.segments,
                style=req.style,
                video_width=req.width or 1080,
                video_height=req.height or 1920,
                video_duration=req.video_duration,
                encoder_mode=req.encoder_mode or "gpu_nvenc",
                preview_metrics=req.preview_metrics,
                brightness=req.brightness or 1.0,
                contrast=req.contrast or 1.0,
                on_proc_ready=on_proc,
                progress_callback=on_progress,
                is_cancelled=is_cancelled
            )
        
        if RENDER_JOBS[job_id].get("status") != "cancelled":
            RENDER_JOBS[job_id]["percent"] = 100
            RENDER_JOBS[job_id]["status"] = "done"
            RENDER_JOBS[job_id]["stage"] = "completed"
            RENDER_JOBS[job_id]["message"] = "Export successfully completed!"
            RENDER_JOBS[job_id]["download_url"] = f"/static/exports/{export_filename}"
            if clean_filename and os.path.isfile(os.path.join(EXPORTS_DIR, clean_filename)):
                RENDER_JOBS[job_id]["clean_download_url"] = f"/static/exports/{clean_filename}"
            log_msg("SUCCESS", f"[{engine_name} | {mode_label}] Export complete: {export_filename}")
    except Exception as e:
        if RENDER_JOBS[job_id].get("status") != "cancelled":
            RENDER_JOBS[job_id]["status"] = "error"
            RENDER_JOBS[job_id]["stage"] = "error"
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

    source_path = resolve_media_path(req.video_filename, req.linked_path)
    if not source_path:
        log_msg("RENDER", f"Source file not found: video_filename='{req.video_filename}', linked_path='{req.linked_path}'")
        raise HTTPException(status_code=404, detail="Source video file not found")
            
    _prune_old_jobs()
    job_id = uuid.uuid4().hex[:12]
    if req.output_filename and isinstance(req.output_filename, str) and req.output_filename.strip():
        safe_name = re.sub(r'[/\\?%*:|"<>]+', '', req.output_filename).strip()
        if safe_name.lower().endswith('.mp4'):
            safe_name = safe_name[:-4]
        export_filename = f"{safe_name}.mp4" if safe_name else f"export_{job_id}.mp4"
    else:
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

def _do_hybrid_render_task(
    job_id: str,
    overlay_webm_path: str,
    source_path: str,
    output_path: str,
    export_filename: str,
    width: int,
    height: int,
    fps: float,
    encoder_mode: str,
    video_quality: str,
    brightness: float,
    contrast: float,
    video_duration: Optional[float] = None
):
    def is_cancelled():
        return RENDER_JOBS.get(job_id, {}).get("status") == "cancelled"

    def on_proc(proc):
        ACTIVE_RENDER_PROCESSES[job_id] = proc

    def on_progress(p_data: dict):
        if is_cancelled():
            return
        pct = p_data.get("percent", 0)
        RENDER_JOBS[job_id]["percent"] = min(99, pct)
        RENDER_JOBS[job_id]["current_frame"] = p_data.get("current_frame", 0)
        RENDER_JOBS[job_id]["total_frames"] = p_data.get("total_frames", 0)
        RENDER_JOBS[job_id]["fps"] = p_data.get("fps", 0)
        RENDER_JOBS[job_id]["message"] = p_data.get("message", "Overlaying previewer captions...")

    try:
        RENDER_JOBS[job_id]["percent"] = 5
        RENDER_JOBS[job_id]["status"] = "rendering"
        RENDER_JOBS[job_id]["stage"] = "rendering"
        RENDER_JOBS[job_id]["message"] = "Phase 2/2: Compositing previewer captions with native video..."
        log_msg("RENDER", f"[Hybrid Studio Overlay] Starting hardware composite for '{export_filename}' ({width}x{height} @ {fps}fps)")

        render_hybrid_overlay_video(
            source_video_path=source_path,
            overlay_webm_path=overlay_webm_path,
            output_video_path=output_path,
            video_width=width,
            video_height=height,
            video_duration=video_duration,
            encoder_mode=encoder_mode,
            video_quality=video_quality,
            brightness=brightness,
            contrast=contrast,
            on_proc_ready=on_proc,
            progress_callback=on_progress,
            is_cancelled=is_cancelled
        )

        if RENDER_JOBS[job_id].get("status") != "cancelled":
            RENDER_JOBS[job_id]["percent"] = 100
            RENDER_JOBS[job_id]["status"] = "done"
            RENDER_JOBS[job_id]["stage"] = "completed"
            RENDER_JOBS[job_id]["message"] = "Hybrid Studio export successfully completed!"
            RENDER_JOBS[job_id]["download_url"] = f"/static/exports/{export_filename}"
            log_msg("SUCCESS", f"[Hybrid Studio Overlay] Export complete: {export_filename}")
    except Exception as e:
        if RENDER_JOBS[job_id].get("status") != "cancelled":
            RENDER_JOBS[job_id]["status"] = "error"
            RENDER_JOBS[job_id]["stage"] = "error"
            RENDER_JOBS[job_id]["error"] = str(e)
            log_msg("ERROR", f"Hybrid render job {job_id} failed: {e}")
    finally:
        if job_id in ACTIVE_RENDER_PROCESSES:
            del ACTIVE_RENDER_PROCESSES[job_id]
        if os.path.exists(overlay_webm_path):
            try:
                os.remove(overlay_webm_path)
            except Exception:
                pass

@app.post("/api/render-hybrid")
async def render_hybrid_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    video_filename: str = Form(""),
    linked_path: Optional[str] = Form(None),
    output_filename: Optional[str] = Form(None),
    width: int = Form(1080),
    height: int = Form(1920),
    fps: float = Form(30.0),
    encoder_mode: str = Form("gpu_nvenc"),
    video_quality: str = Form("crf18"),
    brightness: float = Form(1.0),
    contrast: float = Form(1.0),
    video_duration: Optional[float] = Form(None)
):
    source_path = resolve_media_path(video_filename, linked_path)
    if not source_path:
        log_msg("RENDER", f"Source file not found: video_filename='{video_filename}', linked_path='{linked_path}'")
        raise HTTPException(status_code=404, detail="Source video file not found")

    _prune_old_jobs()
    job_id = uuid.uuid4().hex[:12]

    # Save the incoming transparent WebM overlay file
    overlay_filename = f"overlay_{job_id}.webm"
    overlay_path = os.path.join(UPLOADS_DIR, overlay_filename)
    try:
        with open(overlay_path, "wb") as f_out:
            content = await file.read()
            f_out.write(content)
    except Exception as save_err:
        raise HTTPException(status_code=500, detail=f"Failed to save overlay track: {save_err}")

    if output_filename and isinstance(output_filename, str) and output_filename.strip():
        safe_name = re.sub(r'[/\\?%*:|"<>]+', '', output_filename).strip()
        if safe_name.lower().endswith('.mp4'):
            safe_name = safe_name[:-4]
        export_filename = f"{safe_name}.mp4" if safe_name else f"export_{job_id}.mp4"
    else:
        export_filename = f"export_{job_id}.mp4"
    output_path = os.path.join(EXPORTS_DIR, export_filename)

    RENDER_JOBS[job_id] = {
        "job_id": job_id,
        "percent": 0,
        "status": "queued",
        "stage": "starting",
        "message": "Initializing Hybrid Studio pipeline...",
        "download_url": f"/static/exports/{export_filename}",
        "error": None
    }

    background_tasks.add_task(
        _do_hybrid_render_task,
        job_id,
        overlay_path,
        source_path,
        output_path,
        export_filename,
        width,
        height,
        fps,
        encoder_mode,
        video_quality,
        brightness,
        contrast,
        video_duration
    )

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

@app.get("/api/download/{filename}")
def download_file_endpoint(filename: str):
    """
    Forces browser to download the file directly as an attachment without navigating or streaming in the active tab.
    """
    clean_name = os.path.basename(urllib.parse.unquote(filename))
    fpath = os.path.join(EXPORTS_DIR, clean_name)
    if not os.path.isfile(fpath):
        up_path = os.path.join(UPLOADS_DIR, clean_name)
        if os.path.isfile(up_path):
            fpath = up_path
        else:
            raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        fpath,
        media_type="application/octet-stream",
        filename=clean_name,
        headers={
            "Content-Disposition": f'attachment; filename="{clean_name}"'
        }
    )

@app.post("/api/batch/save-export")
async def save_batch_export_endpoint(
    file: UploadFile = File(...),
    filename: Optional[str] = Form(None)
):
    """
    Saves a finished client-rendered video export directly into EXPORTS_DIR
    with its real target filename for batch download and ZIP packaging.
    """
    target_name = filename or file.filename or "export.mp4"
    clean_name = re.sub(r'[/\\?%*:|"<>]+', '', target_name).strip()
    if not clean_name.lower().endswith(".mp4"):
        clean_name += ".mp4"

    out_path = os.path.join(EXPORTS_DIR, clean_name)
    with open(out_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = os.path.getsize(out_path)
    log_msg("EXPORT", f"Saved client export to backend storage: '{clean_name}' ({file_size} bytes)")
    return {
        "status": "saved",
        "filename": clean_name,
        "download_url": f"/static/exports/{clean_name}"
    }

@app.post("/api/batch/zip-exports")
def create_batch_zip_endpoint(req: BatchZipRequest):
    """
    Creates a single ZIP archive containing all specified exported video filenames
    and returns direct download metadata.
    """
    if not req.filenames:
        raise HTTPException(status_code=400, detail="No filenames provided for batch ZIP archive")

    clean_zip_name = re.sub(r'[/\\?%*:|"<>]+', '', req.zip_name or "AutoCaption_Batch_Export.zip").strip()
    if not clean_zip_name.lower().endswith(".zip"):
        clean_zip_name += ".zip"

    zip_id = uuid.uuid4().hex[:8]
    zip_output_filename = f"batch_{zip_id}_{clean_zip_name}"
    zip_path = os.path.join(EXPORTS_DIR, zip_output_filename)

    added_count = 0
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in req.filenames:
            clean_fname = os.path.basename(urllib.parse.unquote(fname))
            fpath = os.path.join(EXPORTS_DIR, clean_fname)
            if not os.path.isfile(fpath):
                if not clean_fname.lower().endswith(".mp4"):
                    alt_path = os.path.join(EXPORTS_DIR, f"{clean_fname}.mp4")
                    if os.path.isfile(alt_path):
                        fpath = alt_path
            if not os.path.isfile(fpath):
                up_path = os.path.join(UPLOADS_DIR, clean_fname)
                if os.path.isfile(up_path):
                    fpath = up_path
            if not os.path.isfile(fpath):
                resolved = resolve_media_path(clean_fname)
                if resolved and os.path.isfile(resolved):
                    fpath = resolved
            if os.path.isfile(fpath):
                arcname = clean_fname if clean_fname.lower().endswith(".mp4") else f"{clean_fname}.mp4"
                zf.write(fpath, arcname=arcname)
                added_count += 1

    if added_count == 0:
        if os.path.exists(zip_path):
            try:
                os.remove(zip_path)
            except Exception:
                pass
        raise HTTPException(status_code=404, detail="None of the specified export files were found on disk")

    log_msg("EXPORT", f"Created batch ZIP archive '{zip_output_filename}' containing {added_count} files")
    return {
        "status": "ready",
        "zip_filename": zip_output_filename,
        "download_url": f"/static/exports/{zip_output_filename}",
        "file_count": added_count
    }

# ---------------------------------------------------------------------------
# AI Super-Resolution Video Upscaler Endpoints (Real-ESRGAN Vulkan)
# ---------------------------------------------------------------------------

def _do_upscale_task(job_id: str, req: UpscaleRequest, source_path: str, output_path: str, output_filename: str):
    def on_proc(proc):
        ACTIVE_UPSCALE_PROCESSES[job_id] = proc

    def on_progress(p_data: dict):
        if job_id in UPSCALE_JOBS:
            UPSCALE_JOBS[job_id].update(p_data)

    try:
        UPSCALE_JOBS[job_id]["status"] = "processing"
        UPSCALE_JOBS[job_id]["stage"] = "preparing"
        UPSCALE_JOBS[job_id]["percent"] = 5
        UPSCALE_JOBS[job_id]["message"] = "Initializing Real-ESRGAN Vulkan engine..."

        res = upscale_video(
            source_video_path=source_path,
            output_video_path=output_path,
            scale=req.scale or 2,
            model_name=req.model_name or "realesr-animevideov3",
            target_width=req.target_width,
            target_height=req.target_height,
            encoder_mode=req.encoder_mode or "gpu_nvenc",
            progress_callback=on_progress,
            on_proc_ready=on_proc
        )

        if UPSCALE_JOBS[job_id].get("status") != "cancelled":
            UPSCALE_JOBS[job_id]["status"] = "done"
            UPSCALE_JOBS[job_id]["percent"] = 100
            UPSCALE_JOBS[job_id]["stage"] = "completed"
            UPSCALE_JOBS[job_id]["message"] = f"Super-resolution complete ({res['width']}x{res['height']})"
            UPSCALE_JOBS[job_id]["download_url"] = f"/static/exports/{urllib.parse.quote(output_filename)}"
            UPSCALE_JOBS[job_id]["output_path"] = output_path
            UPSCALE_JOBS[job_id]["output_filename"] = output_filename
            UPSCALE_JOBS[job_id]["width"] = res["width"]
            UPSCALE_JOBS[job_id]["height"] = res["height"]
            UPSCALE_JOBS[job_id]["fps"] = res["fps"]
            UPSCALE_JOBS[job_id]["duration"] = res["duration"]
            log_msg("SUCCESS", f"AI Video Upscale {job_id} complete: {output_filename}")
    except Exception as e:
        if UPSCALE_JOBS[job_id].get("status") != "cancelled":
            UPSCALE_JOBS[job_id]["status"] = "error"
            UPSCALE_JOBS[job_id]["error"] = str(e)
            UPSCALE_JOBS[job_id]["stage"] = "failed"
            UPSCALE_JOBS[job_id]["message"] = f"Upscale error: {str(e)}"
            log_msg("ERROR", f"AI Video Upscale {job_id} failed: {e}")
    finally:
        if job_id in ACTIVE_UPSCALE_PROCESSES:
            del ACTIVE_UPSCALE_PROCESSES[job_id]

@app.post("/api/upscale")
async def upscale_endpoint(req: UpscaleRequest, background_tasks: BackgroundTasks):
    source_path = resolve_media_path(req.video_filename, req.linked_path)
    if not source_path:
        log_msg("UPSCALER", f"Source file not found: video_filename='{req.video_filename}', linked_path='{req.linked_path}'")
        raise HTTPException(status_code=404, detail="Source video file not found")

    _prune_old_jobs()
    job_id = f"up_{uuid.uuid4().hex[:10]}"

    if req.output_filename and isinstance(req.output_filename, str) and req.output_filename.strip():
        safe_name = re.sub(r'[/\\?%*:|"<>]+', '', req.output_filename).strip()
        if safe_name.lower().endswith('.mp4'):
            safe_name = safe_name[:-4]
        output_filename = f"{safe_name}.mp4" if safe_name else f"upscaled_{job_id}.mp4"
    else:
        src_stem = os.path.splitext(os.path.basename(source_path))[0]
        output_filename = f"{src_stem}_upscaled_{req.scale}x_{job_id[:4]}.mp4"

    output_path = os.path.join(EXPORTS_DIR, output_filename)
    src_info = get_upscaler_video_info(source_path)

    UPSCALE_JOBS[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "stage": "queued",
        "percent": 0,
        "current_frame": 0,
        "total_frames": max(1, int(round(src_info["duration"] * src_info["fps"]))),
        "fps": 0,
        "eta_seconds": 0,
        "message": "Queued in AI upscaling pipeline...",
        "model_name": req.model_name or "realesr-animevideov3",
        "scale": req.scale or 2,
        "source_width": src_info["width"],
        "source_height": src_info["height"],
        "download_url": f"/static/exports/{urllib.parse.quote(output_filename)}",
        "error": None
    }

    background_tasks.add_task(_do_upscale_task, job_id, req, source_path, output_path, output_filename)

    return {
        "status": "queued",
        "job_id": job_id,
        "download_url": f"/static/exports/{urllib.parse.quote(output_filename)}",
        "source_info": src_info
    }

@app.get("/api/upscale-progress/{job_id}")
def get_upscale_progress_endpoint(job_id: str):
    if job_id not in UPSCALE_JOBS:
        raise HTTPException(status_code=404, detail="Upscale job not found")
    return UPSCALE_JOBS[job_id]

@app.post("/api/upscale-cancel/{job_id}")
def cancel_upscale_endpoint(job_id: str):
    if job_id in UPSCALE_JOBS:
        UPSCALE_JOBS[job_id]["status"] = "cancelled"
        UPSCALE_JOBS[job_id]["stage"] = "cancelled"
        UPSCALE_JOBS[job_id]["error"] = "Cancelled by user"
        log_msg("UPSCALER", f"Upscale job {job_id} cancelled by user")

    proc = ACTIVE_UPSCALE_PROCESSES.get(job_id)
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
        if job_id in ACTIVE_UPSCALE_PROCESSES:
            del ACTIVE_UPSCALE_PROCESSES[job_id]

    return {"status": "cancelled", "job_id": job_id}

@app.get("/api/upscale-models")
def get_upscale_models_endpoint():
    return {
        "installed": is_upscaler_installed(),
        "models": AVAILABLE_MODELS
    }

@app.post("/api/upscale-install")
def install_upscaler_endpoint():
    success = ensure_upscaler_ready()
    return {
        "installed": success,
        "status": "ready" if success else "failed"
    }

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
    linked_path: Optional[str] = Form(None),
    engine: Optional[str] = Form("demucs")
):
    if not file and not filename and not linked_path:
        raise HTTPException(status_code=400, detail="Must provide either an uploaded file, an existing filename, or a linked file path.")

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
        source_path = resolve_media_path(filename, linked_path)
        if not source_path:
            raise HTTPException(status_code=404, detail=f"Audio/video file not found on disk or storage.")
        input_file_path = source_path

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
        log_msg("SEPARATOR", f"Separation job {job_id} cancelled by user")

    proc = ACTIVE_SEPARATION_PROCESSES.get(job_id)
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
        if job_id in ACTIVE_SEPARATION_PROCESSES:
            del ACTIVE_SEPARATION_PROCESSES[job_id]

    return {"status": "cancelled", "job_id": job_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
