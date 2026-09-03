"""
AutoCaption Dependency, Acceleration & Model Manager
Inspects, installs, updates, and manages system dependencies (PyTorch CUDA,
Faster-Whisper, Demucs vocal models, FFmpeg, cuDNN) with real-time log streaming.
"""

import os
import sys
import time
import json
import uuid
import shutil
import urllib.request
import threading
import subprocess
from typing import Dict, Any, List, Optional
import importlib.metadata

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
MODELS_DIR = os.path.join(STORAGE_DIR, "models")
VOCALS_DIR = os.path.join(STORAGE_DIR, "vocals")

# Active pip & model tasks: task_id -> task dict
TASK_REGISTRY: Dict[str, Dict[str, Any]] = {}
ACTIVE_TASK_PROCS: Dict[str, subprocess.Popen] = {}

# Packages tracked in the dependency manager
TRACKED_PACKAGES = [
    {
        "id": "torch",
        "name": "PyTorch",
        "pypi_name": "torch",
        "category": "ai_compute",
        "required": True,
        "description": "Core tensor and deep learning runtime for Whisper and Demucs.",
        "cuda_relevant": True
    },
    {
        "id": "torchaudio",
        "name": "TorchAudio",
        "pypi_name": "torchaudio",
        "category": "ai_compute",
        "required": True,
        "description": "Audio signal processing, resampling, and tensor transforms.",
        "cuda_relevant": True
    },
    {
        "id": "faster_whisper",
        "name": "Faster-Whisper",
        "pypi_name": "faster-whisper",
        "category": "ai_compute",
        "required": True,
        "description": "High-efficiency CTranslate2 engine for real-time speech transcription.",
        "cuda_relevant": True
    },
    {
        "id": "ctranslate2",
        "name": "CTranslate2",
        "pypi_name": "ctranslate2",
        "category": "ai_compute",
        "required": True,
        "description": "Inference engine executing quantized Whisper models with CUDA / CPU.",
        "cuda_relevant": True
    },
    {
        "id": "nvidia_cuda_libs",
        "name": "NVIDIA CUDA 12 Runtime (cuBLAS & cuDNN)",
        "pypi_name": "nvidia-cublas-cu12",
        "category": "ai_compute",
        "required": False,
        "description": "Hardware acceleration binaries for NVIDIA GeForce & RTX GPUs.",
        "cuda_relevant": True
    },
    {
        "id": "demucs",
        "name": "Meta Demucs",
        "pypi_name": "demucs",
        "category": "vocal_separation",
        "required": True,
        "description": "AI neural vocal separation for isolating vocals and background music.",
        "cuda_relevant": True
    },
    {
        "id": "soundfile",
        "name": "SoundFile",
        "pypi_name": "soundfile",
        "category": "media_engine",
        "required": True,
        "description": "Audio file I/O library supporting 24-bit/32-bit float WAV stems.",
        "cuda_relevant": False
    },
    {
        "id": "librosa",
        "name": "Librosa",
        "pypi_name": "librosa",
        "category": "media_engine",
        "required": True,
        "description": "Music & speech analysis library for harmonic waveform decomposition.",
        "cuda_relevant": False
    },
    {
        "id": "deepfilternet",
        "name": "DeepFilterNet (Optional)",
        "pypi_name": "deepfilternet",
        "category": "vocal_separation",
        "required": False,
        "description": "Low-latency speech enhancement and microphone noise reduction.",
        "cuda_relevant": False
    },
    {
        "id": "ffmpeg",
        "name": "FFmpeg Engine",
        "pypi_name": "imageio-ffmpeg",
        "category": "media_engine",
        "required": True,
        "description": "Hardware-accelerated media multiplexer and libass video renderer.",
        "cuda_relevant": True
    }
]

# Demucs Vocal Separation Model Definitions
VOCAL_MODELS = [
    {
        "id": "htdemucs",
        "name": "HTDemucs (Default High-Speed)",
        "category": "vocal_model",
        "size_label": "~80 MB",
        "approx_size_bytes": 80 * 1024 * 1024,
        "description": "Fast 4-source separation (vocals, drums, bass, other) optimized for shorts and social clips.",
        "speed": "Fast (GPU: ~5s / CPU: ~25s)",
        "recommended": True
    },
    {
        "id": "htdemucs_ft",
        "name": "HTDemucs Fine-Tuned (Studio Quality)",
        "category": "vocal_model",
        "size_label": "~160 MB",
        "approx_size_bytes": 160 * 1024 * 1024,
        "description": "Fine-tuned model with higher vocal clarity and minimal audio bleeding.",
        "speed": "Medium (GPU: ~8s / CPU: ~45s)",
        "recommended": False
    },
    {
        "id": "mdx_extra_q",
        "name": "MDX-Net Extra Q (Acapella Specialist)",
        "category": "vocal_model",
        "size_label": "~185 MB",
        "approx_size_bytes": 185 * 1024 * 1024,
        "description": "Specialized architecture for isolating clean speech from complex, heavily mixed music.",
        "speed": "Standard (GPU: ~10s / CPU: ~60s)",
        "recommended": False
    }
]

# Cached PyPI latest versions: pkg_name -> {"version": "x.x.x", "timestamp": ts}
_PYPI_CACHE: Dict[str, Dict[str, Any]] = {}

def get_installed_version(package_name: str) -> Optional[str]:
    """Retrieves the installed version of a Python package."""
    try:
        return importlib.metadata.version(package_name)
    except Exception:
        # Fallback to direct import inspection for special cases
        try:
            mod = __import__(package_name.replace("-", "_"))
            return getattr(mod, "__version__", None)
        except Exception:
            return None

def fetch_pypi_latest_version(package_name: str, timeout: float = 2.0) -> Optional[str]:
    """Queries PyPI API for the latest release with quick timeout."""
    cached = _PYPI_CACHE.get(package_name)
    if cached and (time.time() - cached["timestamp"] < 3600):
        return cached["version"]

    try:
        url = f"https://pypi.org/pypi/{package_name}/json"
        req = urllib.request.Request(url, headers={"User-Agent": "AutoCaption-Studio/2.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                latest = data.get("info", {}).get("version")
                if latest:
                    _PYPI_CACHE[package_name] = {"version": latest, "timestamp": time.time()}
                    return latest
    except Exception:
        pass
    return None

def get_torch_cuda_details() -> Dict[str, Any]:
    """Inspects PyTorch CUDA readiness, device name, and cuDNN."""
    details = {
        "installed": False,
        "version": None,
        "cuda_available": False,
        "cuda_version": None,
        "device_name": "CPU Only",
        "device_count": 0,
        "cudnn_version": None,
        "vram_total_mb": 0,
        "vram_free_mb": 0,
        "is_cpu_only": True
    }
    try:
        import torch
        details["installed"] = True
        details["version"] = torch.__version__
        
        # Check if installed torch was compiled with CUDA
        cuda_compiled = hasattr(torch.version, "cuda") and torch.version.cuda is not None
        details["cuda_version"] = getattr(torch.version, "cuda", None)
        details["cuda_available"] = bool(torch.cuda.is_available())
        details["is_cpu_only"] = not details["cuda_available"]

        if details["cuda_available"]:
            details["device_count"] = torch.cuda.device_count()
            details["device_name"] = torch.cuda.get_device_name(0)
            if hasattr(torch.backends, "cudnn") and torch.backends.cudnn.is_available():
                details["cudnn_version"] = str(torch.backends.cudnn.version())
            
            try:
                free_b, total_b = torch.cuda.mem_get_info(0)
                details["vram_free_mb"] = int(free_b / (1024 * 1024))
                details["vram_total_mb"] = int(total_b / (1024 * 1024))
            except Exception:
                pass
    except Exception:
        pass
    return details

def get_ffmpeg_details() -> Dict[str, Any]:
    """Inspects FFmpeg binary and hardware encoder capabilities."""
    details = {
        "installed": False,
        "path": None,
        "version": None,
        "nvenc_h264": False,
        "nvenc_hevc": False,
        "libass": False
    }
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if os.path.exists(exe):
            details["installed"] = True
            details["path"] = exe
            
            # Check version & encoder support
            res = subprocess.run([exe, "-encoders"], capture_output=True, text=True, timeout=2)
            if res.returncode == 0:
                stdout = res.stdout.lower()
                details["nvenc_h264"] = "h264_nvenc" in stdout
                details["nvenc_hevc"] = "hevc_nvenc" in stdout

            ver_res = subprocess.run([exe, "-version"], capture_output=True, text=True, timeout=2)
            if ver_res.returncode == 0:
                first_line = ver_res.stdout.split("\n")[0]
                details["version"] = first_line.split("version")[-1].split("Copyright")[0].strip() if "version" in first_line else "Available"
                details["libass"] = "--enable-libass" in ver_res.stdout
    except Exception:
        pass
    return details

def get_vocal_models_status() -> List[Dict[str, Any]]:
    """Checks download status and file sizes for Demucs vocal separation models."""
    hub_cache_dir = os.path.expanduser("~/.cache/torch/hub/checkpoints")
    models_status = []

    for m in VOCAL_MODELS:
        model_id = m["id"]
        is_downloaded = False
        disk_size_bytes = 0
        file_path = None

        if os.path.exists(hub_cache_dir):
            for fname in os.listdir(hub_cache_dir):
                if model_id in fname.lower() and fname.endswith(".th"):
                    fpath = os.path.join(hub_cache_dir, fname)
                    fsize = os.path.getsize(fpath)
                    if fsize > 10 * 1024 * 1024:
                        is_downloaded = True
                        disk_size_bytes = fsize
                        file_path = fpath
                        break

        # Calculate human-readable size
        if disk_size_bytes > 0:
            disk_size_label = f"{round(disk_size_bytes / (1024 * 1024), 1)} MB"
        else:
            disk_size_label = m["size_label"]

        models_status.append({
            **m,
            "is_downloaded": is_downloaded,
            "disk_size_bytes": disk_size_bytes,
            "disk_size_label": disk_size_label,
            "file_path": file_path
        })
    return models_status

def inspect_all_dependencies(check_pypi: bool = False) -> Dict[str, Any]:
    """Aggregates comprehensive status across all dependencies, hardware, and models."""
    torch_details = get_torch_cuda_details()
    ffmpeg_details = get_ffmpeg_details()
    packages_status = []

    for pkg in TRACKED_PACKAGES:
        pkg_id = pkg["id"]
        installed_ver = None
        is_installed = False

        if pkg_id == "torch":
            is_installed = torch_details["installed"]
            installed_ver = torch_details["version"]
        elif pkg_id == "ffmpeg":
            is_installed = ffmpeg_details["installed"]
            installed_ver = ffmpeg_details["version"]
        elif pkg_id == "nvidia_cuda_libs":
            cublas_v = get_installed_version("nvidia-cublas-cu12")
            cudnn_v = get_installed_version("nvidia-cudnn-cu12")
            is_installed = bool(cublas_v or cudnn_v)
            installed_ver = f"cuBLAS {cublas_v or 'N/A'}, cuDNN {cudnn_v or 'N/A'}" if is_installed else None
        else:
            installed_ver = get_installed_version(pkg["pypi_name"])
            is_installed = bool(installed_ver is not None)

        latest_ver = None
        if check_pypi:
            latest_ver = fetch_pypi_latest_version(pkg["pypi_name"])
        elif pkg["pypi_name"] in _PYPI_CACHE:
            latest_ver = _PYPI_CACHE[pkg["pypi_name"]]["version"]

        # Determine update availability
        update_available = False
        if is_installed and latest_ver and installed_ver:
            try:
                # Strip build tags like '+cu126' or '+cpu' or 'cuBLAS ...' for clean semver comparison
                clean_installed = installed_ver.split("+")[0].replace("v", "").strip()
                clean_latest = latest_ver.split("+")[0].replace("v", "").strip()

                def _to_tuple(v_str):
                    tokens = []
                    for seg in v_str.replace("-", ".").split("."):
                        tokens.append(int(seg) if seg.isdigit() else seg)
                    return tuple(tokens)

                if _to_tuple(clean_latest) > _to_tuple(clean_installed):
                    update_available = True
            except Exception:
                if clean_installed != clean_latest:
                    update_available = True

        packages_status.append({
            **pkg,
            "is_installed": is_installed,
            "installed_version": installed_ver,
            "latest_version": latest_ver,
            "update_available": update_available
        })

    vocal_models = get_vocal_models_status()

    return {
        "torch_cuda": torch_details,
        "ffmpeg": ffmpeg_details,
        "packages": packages_status,
        "vocal_models": vocal_models,
        "python_version": sys.version.split()[0],
        "python_executable": sys.executable,
        "timestamp": time.time()
    }

# ---------------------------------------------------------------------------
# Asynchronous Background Pip Task Runner
# ---------------------------------------------------------------------------

def run_pip_command_async(task_id: str, cmd: List[str], description: str):
    """Executes pip in background with non-blocking line streaming into TASK_REGISTRY."""
    TASK_REGISTRY[task_id] = {
        "id": task_id,
        "description": description,
        "status": "running", # running | completed | failed | cancelled
        "percent": 10,
        "logs": [f"[{time.strftime('%H:%M:%S')}] Starting: {' '.join(cmd)}"],
        "start_time": time.time(),
        "end_time": None,
        "error": None
    }

    def _worker():
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            )
            ACTIVE_TASK_PROCS[task_id] = proc

            for line in iter(proc.stdout.readline, ""):
                if not line:
                    break
                clean = line.rstrip("\r\n")
                if clean:
                    TASK_REGISTRY[task_id]["logs"].append(clean)
                    # Limit log length to last 300 lines to avoid memory balloon
                    if len(TASK_REGISTRY[task_id]["logs"]) > 300:
                        TASK_REGISTRY[task_id]["logs"] = TASK_REGISTRY[task_id]["logs"][-200:]
                    
                    # Estimate percent from typical pip output keywords
                    low = clean.lower()
                    if "downloading" in low or "collecting" in low:
                        TASK_REGISTRY[task_id]["percent"] = min(60, TASK_REGISTRY[task_id]["percent"] + 5)
                    elif "installing collected" in low or "running setup" in low:
                        TASK_REGISTRY[task_id]["percent"] = 80
                    elif "successfully installed" in low or "successfully uninstalled" in low:
                        TASK_REGISTRY[task_id]["percent"] = 100

            proc.stdout.close()
            proc.wait()

            if proc.returncode == 0:
                TASK_REGISTRY[task_id]["status"] = "completed"
                TASK_REGISTRY[task_id]["percent"] = 100
                TASK_REGISTRY[task_id]["logs"].append(f"[{time.strftime('%H:%M:%S')}] Process finished successfully!")
            else:
                TASK_REGISTRY[task_id]["status"] = "failed"
                TASK_REGISTRY[task_id]["error"] = f"Process exited with non-zero exit code: {proc.returncode}"
                TASK_REGISTRY[task_id]["logs"].append(f"[{time.strftime('%H:%M:%S')}] [ERROR] {TASK_REGISTRY[task_id]['error']}")
        except Exception as e:
            TASK_REGISTRY[task_id]["status"] = "failed"
            TASK_REGISTRY[task_id]["error"] = str(e)
            TASK_REGISTRY[task_id]["logs"].append(f"[{time.strftime('%H:%M:%S')}] [EXCEPTION] {e}")
        finally:
            TASK_REGISTRY[task_id]["end_time"] = time.time()
            ACTIVE_TASK_PROCS.pop(task_id, None)

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()

def clean_orphaned_site_packages() -> int:
    """Removes leftover ~* temporary directories from aborted pip installs."""
    import site
    freed_bytes = 0
    paths_to_check = []
    try:
        paths_to_check = site.getsitepackages() + [site.getusersitepackages()]
    except Exception:
        pass

    for p in paths_to_check:
        if p and os.path.exists(p):
            try:
                for entry in os.listdir(p):
                    if entry.startswith("~"):
                        full_path = os.path.join(p, entry)
                        try:
                            for root, dirs, files in os.walk(full_path):
                                for f in files:
                                    fp = os.path.join(root, f)
                                    if os.path.exists(fp):
                                        freed_bytes += os.path.getsize(fp)
                            shutil.rmtree(full_path, ignore_errors=True)
                        except Exception:
                            pass
            except Exception:
                pass
    return freed_bytes

def clean_pip_cache() -> int:
    """Purges the pip wheel download cache."""
    freed_bytes = 0
    try:
        res = subprocess.run([sys.executable, "-m", "pip", "cache", "dir"], capture_output=True, text=True, timeout=3)
        if res.returncode == 0:
            cache_dir = res.stdout.strip()
            if os.path.exists(cache_dir):
                for root, dirs, files in os.walk(cache_dir):
                    for f in files:
                        fp = os.path.join(root, f)
                        if os.path.exists(fp):
                            freed_bytes += os.path.getsize(fp)
        subprocess.run([sys.executable, "-m", "pip", "cache", "purge"], capture_output=True, timeout=5)
    except Exception:
        pass
    return freed_bytes

def clean_all_caches() -> Dict[str, Any]:
    """Cleans orphaned site-packages and purges pip cache."""
    orphans_freed = clean_orphaned_site_packages()
    pip_freed = clean_pip_cache()
    total_freed_bytes = orphans_freed + pip_freed
    total_freed_mb = round(total_freed_bytes / (1024 * 1024), 1)
    return {
        "success": True,
        "freed_mb": total_freed_mb,
        "orphans_freed_mb": round(orphans_freed / (1024 * 1024), 1),
        "pip_cache_freed_mb": round(pip_freed / (1024 * 1024), 1),
        "message": f"Successfully reclaimed {total_freed_mb} MB of disk space!"
    }

def get_pytorch_cuda_index_url() -> str:
    """Returns the correct PyTorch CUDA index URL based on the Python version."""
    py_ver = sys.version_info
    if py_ver >= (3, 14):
        # Python 3.14+ wheels are hosted under CUDA 12.6
        return "https://download.pytorch.org/whl/cu126"
    elif py_ver >= (3, 13):
        return "https://download.pytorch.org/whl/cu126"
    else:
        # Python 3.10 - 3.12 default to CUDA 12.4
        return "https://download.pytorch.org/whl/cu124"

def install_package_task(package_id: str) -> str:
    """Dispatches asynchronous install task based on target package or bundle."""
    task_id = f"task_{uuid.uuid4().hex[:8]}"
    py_exe = sys.executable

    if package_id == "torch_cuda":
        cuda_index = get_pytorch_cuda_index_url()
        clean_orphaned_site_packages()
        # --no-cache-dir prevents duplicating 2.5 GB wheel in pip cache
        cmd = [
            py_exe, "-m", "pip", "install", "--upgrade", "--force-reinstall", "--no-cache-dir",
            "torch", "torchaudio",
            "--index-url", cuda_index
        ]
        desc = f"Installing PyTorch with NVIDIA CUDA 12 Acceleration ({cuda_index.split('/')[-1].upper()})"
    elif package_id == "torch_cpu":
        clean_orphaned_site_packages()
        cmd = [
            py_exe, "-m", "pip", "install", "--upgrade", "--force-reinstall", "--no-cache-dir",
            "torch", "torchaudio",
            "--index-url", "https://download.pytorch.org/whl/cpu"
        ]
        desc = "Installing PyTorch (CPU-only Mode)"
    elif package_id == "nvidia_cuda_libs":
        cmd = [
            py_exe, "-m", "pip", "install", "--upgrade",
            "nvidia-cublas-cu12", "nvidia-cudnn-cu12"
        ]
        desc = "Installing NVIDIA cuBLAS & cuDNN Acceleration Binaries"
    elif package_id == "demucs":
        cmd = [py_exe, "-m", "pip", "install", "--upgrade", "demucs"]
        desc = "Installing Meta Demucs Neural Vocal Separator"
    elif package_id == "faster_whisper":
        cmd = [py_exe, "-m", "pip", "install", "--upgrade", "faster-whisper", "ctranslate2"]
        desc = "Installing Faster-Whisper & CTranslate2 Speech Engine"
    elif package_id == "deepfilternet":
        cmd = [py_exe, "-m", "pip", "install", "--upgrade", "deepfilternet"]
        desc = "Installing DeepFilterNet Speech Denoising Engine"
    elif package_id == "all_essential":
        req_file = os.path.join(BASE_DIR, "requirements.txt")
        cmd = [py_exe, "-m", "pip", "install", "--upgrade", "-r", req_file]
        desc = "Installing All AutoCaption Essential Dependencies"
    else:
        # Standard pypi install
        pkg_name = package_id.replace("_", "-")
        cmd = [py_exe, "-m", "pip", "install", "--upgrade", pkg_name]
        desc = f"Installing {pkg_name}"

    run_pip_command_async(task_id, cmd, desc)
    return task_id

def uninstall_package_task(package_id: str) -> str:
    """Dispatches asynchronous uninstall task."""
    task_id = f"task_{uuid.uuid4().hex[:8]}"
    py_exe = sys.executable

    if package_id in ("torch", "torch_cuda", "torch_cpu"):
        cmd = [py_exe, "-m", "pip", "uninstall", "-y", "torch", "torchaudio"]
        desc = "Uninstalling PyTorch & TorchAudio"
    elif package_id == "nvidia_cuda_libs":
        cmd = [py_exe, "-m", "pip", "uninstall", "-y", "nvidia-cublas-cu12", "nvidia-cudnn-cu12"]
        desc = "Uninstalling NVIDIA CUDA Binaries"
    elif package_id == "faster_whisper":
        cmd = [py_exe, "-m", "pip", "uninstall", "-y", "faster-whisper"]
        desc = "Uninstalling Faster-Whisper"
    else:
        pkg_name = package_id.replace("_", "-")
        cmd = [py_exe, "-m", "pip", "uninstall", "-y", pkg_name]
        desc = f"Uninstalling {pkg_name}"

    run_pip_command_async(task_id, cmd, desc)
    return task_id

def download_vocal_model_task(model_id: str) -> str:
    """Pre-downloads Demucs vocal separation model checkpoints in background."""
    task_id = f"task_{uuid.uuid4().hex[:8]}"
    
    TASK_REGISTRY[task_id] = {
        "id": task_id,
        "description": f"Pre-caching Demucs '{model_id}' vocal separation weights",
        "status": "running",
        "percent": 15,
        "logs": [f"[{time.strftime('%H:%M:%S')}] Initializing checkpoint fetch for '{model_id}'..."],
        "start_time": time.time(),
        "end_time": None,
        "error": None
    }

    def _worker():
        try:
            from demucs.pretrained import get_model
            TASK_REGISTRY[task_id]["logs"].append(f"[{time.strftime('%H:%M:%S')}] Downloading weights from Torch Hub CDN...")
            TASK_REGISTRY[task_id]["percent"] = 40
            
            # This triggers download to ~/.cache/torch/hub/checkpoints
            model = get_model(model_id)
            del model

            TASK_REGISTRY[task_id]["status"] = "completed"
            TASK_REGISTRY[task_id]["percent"] = 100
            TASK_REGISTRY[task_id]["logs"].append(f"[{time.strftime('%H:%M:%S')}] Demucs model '{model_id}' ready!")
        except Exception as e:
            TASK_REGISTRY[task_id]["status"] = "failed"
            TASK_REGISTRY[task_id]["error"] = str(e)
            TASK_REGISTRY[task_id]["logs"].append(f"[{time.strftime('%H:%M:%S')}] [ERROR] {e}")
        finally:
            TASK_REGISTRY[task_id]["end_time"] = time.time()

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()
    return task_id

def delete_vocal_model(model_id: str) -> bool:
    """Deletes cached Demucs model checkpoint from disk."""
    hub_cache_dir = os.path.expanduser("~/.cache/torch/hub/checkpoints")
    deleted = False
    if os.path.exists(hub_cache_dir):
        for fname in os.listdir(hub_cache_dir):
            if model_id in fname.lower() and fname.endswith(".th"):
                fpath = os.path.join(hub_cache_dir, fname)
                try:
                    os.remove(fpath)
                    deleted = True
                except Exception:
                    pass
    return deleted

def cancel_task(task_id: str) -> bool:
    """Cancels a running background pip or model download process."""
    proc = ACTIVE_TASK_PROCS.get(task_id)
    if proc and proc.poll() is None:
        try:
            import psutil
            parent = psutil.Process(proc.pid)
            for child in parent.children(recursive=True):
                try:
                    child.kill()
                except Exception:
                    pass
            parent.kill()
        except Exception:
            if sys.platform == "win32":
                try:
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception:
                    pass
            try:
                proc.kill()
            except Exception:
                pass

    if task_id in TASK_REGISTRY:
        TASK_REGISTRY[task_id]["status"] = "cancelled"
        TASK_REGISTRY[task_id]["logs"].append(f"[{time.strftime('%H:%M:%S')}] Task was cancelled by user.")
        return True
    return False
