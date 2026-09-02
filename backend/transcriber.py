import os
import sys
import time
import tempfile
import uuid
import subprocess
import datetime
import threading
import shutil
import imageio_ffmpeg
from faster_whisper import WhisperModel

try:
    from huggingface_hub.constants import HUGGINGFACE_HUB_CACHE
    DEFAULT_CACHE_DIR = os.path.abspath(HUGGINGFACE_HUB_CACHE)
except Exception:
    DEFAULT_CACHE_DIR = os.path.abspath(os.path.expanduser(os.path.join("~", ".cache", "huggingface", "hub")))

SUPPORTED_MODELS = [
    {
        "id": "tiny",
        "name": "Tiny",
        "size_label": "~75 MB",
        "approx_size_bytes": 75 * 1024 * 1024,
        "speed": "32x Realtime",
        "vram": "~1 GB VRAM / CPU",
        "description": "Ultra-fast speech recognition with minimal memory footprint.",
        "recommended": False
    },
    {
        "id": "base",
        "name": "Base",
        "size_label": "~145 MB",
        "approx_size_bytes": 145 * 1024 * 1024,
        "speed": "16x Realtime",
        "vram": "~1 GB VRAM / CPU",
        "description": "Recommended default. Fast processing with great accuracy for social clips.",
        "recommended": True
    },
    {
        "id": "small",
        "name": "Small",
        "size_label": "~480 MB",
        "approx_size_bytes": 480 * 1024 * 1024,
        "speed": "6x Realtime",
        "vram": "~2 GB VRAM / CPU",
        "description": "Enhanced accuracy on accents and technical terminology.",
        "recommended": False
    },
    {
        "id": "medium",
        "name": "Medium",
        "size_label": "~1.5 GB",
        "approx_size_bytes": 1500 * 1024 * 1024,
        "speed": "2x Realtime",
        "vram": "~5 GB VRAM / Multi-core CPU",
        "description": "Studio-grade precision. Ideal for noisy audio and complex speech.",
        "recommended": False
    },
    {
        "id": "large-v3-turbo",
        "name": "Large v3 Turbo",
        "size_label": "~1.6 GB",
        "approx_size_bytes": 1600 * 1024 * 1024,
        "speed": "8x Realtime",
        "vram": "~6 GB VRAM",
        "description": "High accuracy optimized for speed, near Large-v3 quality at 4x speed.",
        "recommended": False
    },
    {
        "id": "large-v3",
        "name": "Large v3",
        "size_label": "~3.1 GB",
        "approx_size_bytes": 3100 * 1024 * 1024,
        "speed": "1x Realtime",
        "vram": "~10 GB VRAM",
        "description": "State-of-the-art maximum precision across multilingual audio.",
        "recommended": False
    }
]

_MODEL_CACHE = {}
MODEL_DOWNLOAD_STATUS = {}
LOG_HISTORY = []

def get_models_cache_dir() -> str:
    return DEFAULT_CACHE_DIR

def get_directory_size(path: str) -> int:
    total = 0
    if not os.path.exists(path):
        return 0
    try:
        for entry in os.scandir(path):
            if entry.is_file():
                total += entry.stat().st_size
            elif entry.is_dir():
                total += get_directory_size(entry.path)
    except Exception:
        pass
    return total

def scan_model_cache() -> dict:
    cache_dir = get_models_cache_dir()
    os.makedirs(cache_dir, exist_ok=True)
    models_info = []

    for m in SUPPORTED_MODELS:
        mid = m["id"]
        folder_name = f"models--Systran--faster-whisper-{mid}"
        target_path = os.path.join(cache_dir, folder_name)
        
        is_downloaded = False
        disk_size_bytes = 0

        if os.path.exists(target_path):
            disk_size_bytes = get_directory_size(target_path)
            snapshots_dir = os.path.join(target_path, "snapshots")
            if os.path.exists(snapshots_dir) and disk_size_bytes > 10 * 1024 * 1024:
                is_downloaded = True

        dl_info = MODEL_DOWNLOAD_STATUS.get(mid, {})
        dl_status = dl_info.get("status", "completed" if is_downloaded else "idle")
        dl_percent = dl_info.get("percent", 100 if is_downloaded else 0)
        dl_error = dl_info.get("error", None)
        dl_mb = dl_info.get("downloaded_mb", f"{round(disk_size_bytes / (1024 * 1024), 1)} MB" if disk_size_bytes > 0 else "0 MB")
        total_mb = dl_info.get("total_mb", m["size_label"])

        models_info.append({
            **m,
            "is_downloaded": is_downloaded,
            "disk_size_bytes": disk_size_bytes,
            "disk_size_label": f"{round(disk_size_bytes / (1024 * 1024), 1)} MB" if disk_size_bytes > 0 else m["size_label"],
            "download_status": dl_status,
            "download_percent": dl_percent,
            "downloaded_mb": dl_mb,
            "total_mb": total_mb,
            "download_error": dl_error,
            "folder_path": target_path
        })

    return {
        "cache_dir": cache_dir,
        "models": models_info
    }

def _download_worker(model_name: str):
    import requests
    from huggingface_hub import HfApi
    
    target_model = next((m for m in SUPPORTED_MODELS if m["id"] == model_name), None)
    approx_bytes = target_model["approx_size_bytes"] if target_model else 500 * 1024 * 1024
    cache_dir = get_models_cache_dir()
    repo_id = f"Systran/faster-whisper-{model_name}"
    
    try:
        log_msg("AI", f"Connecting to Hugging Face Hub for '{repo_id}'...")
        api = HfApi()
        info = api.repo_info(repo_id)
        commit_hash = info.sha
        
        folder_name = f"models--Systran--faster-whisper-{model_name}"
        target_dir = os.path.join(cache_dir, folder_name)
        snapshot_dir = os.path.join(target_dir, "snapshots", commit_hash)
        os.makedirs(snapshot_dir, exist_ok=True)
        refs_dir = os.path.join(target_dir, "refs")
        os.makedirs(refs_dir, exist_ok=True)
        
        files_to_download = []
        total_repo_bytes = 0
        
        for sibling in info.siblings:
            rfilename = sibling.rfilename
            if rfilename.startswith("."):
                continue
            files_to_download.append(rfilename)
            if hasattr(sibling, "size") and sibling.size:
                total_repo_bytes += sibling.size
                
        if total_repo_bytes <= 0:
            total_repo_bytes = approx_bytes
            
        total_mb_str = f"{round(total_repo_bytes / (1024 * 1024), 1)} MB"
        
        MODEL_DOWNLOAD_STATUS[model_name] = {
            "status": "downloading",
            "percent": 1,
            "downloaded_bytes": 0,
            "total_bytes": total_repo_bytes,
            "downloaded_mb": "0.0 MB",
            "total_mb": total_mb_str,
            "error": None
        }
        
        cumulative_bytes = 0
        log_msg("AI", f"Streaming download for '{model_name}' ({total_mb_str})...")
        
        for filename in files_to_download:
            url = f"https://huggingface.co/{repo_id}/resolve/{commit_hash}/{filename}"
            out_file = os.path.join(snapshot_dir, filename)
            
            with requests.get(url, stream=True, timeout=60) as r:
                r.raise_for_status()
                with open(out_file, "wb") as f:
                    for chunk in r.iter_content(chunk_size=128 * 1024):
                        if chunk:
                            f.write(chunk)
                            cumulative_bytes += len(chunk)
                            pct = min(99, max(1, int((cumulative_bytes / total_repo_bytes) * 100)))
                            cur_mb_str = f"{round(cumulative_bytes / (1024 * 1024), 1)} MB"
                            
                            MODEL_DOWNLOAD_STATUS[model_name] = {
                                "status": "downloading",
                                "percent": pct,
                                "downloaded_bytes": cumulative_bytes,
                                "total_bytes": total_repo_bytes,
                                "downloaded_mb": cur_mb_str,
                                "total_mb": total_mb_str,
                                "error": None
                            }
                            
        with open(os.path.join(refs_dir, "main"), "w") as f:
            f.write(commit_hash)
            
        final_mb_str = f"{round(cumulative_bytes / (1024 * 1024), 1)} MB"
        MODEL_DOWNLOAD_STATUS[model_name] = {
            "status": "completed",
            "percent": 100,
            "downloaded_bytes": cumulative_bytes,
            "total_bytes": cumulative_bytes,
            "downloaded_mb": final_mb_str,
            "total_mb": final_mb_str,
            "error": None
        }
        log_msg("AI", f"Whisper model '{model_name}' successfully downloaded ({final_mb_str}) and ready for offline use.")
        
    except Exception as e:
        try:
            log_msg("WARN", f"Direct stream encountered error ({e}), running fallback loader...")
            WhisperModel(model_name, device="cpu", compute_type="int8")
            final_bytes = get_directory_size(os.path.join(cache_dir, f"models--Systran--faster-whisper-{model_name}"))
            final_mb_str = f"{round(final_bytes / (1024 * 1024), 1)} MB"
            MODEL_DOWNLOAD_STATUS[model_name] = {
                "status": "completed",
                "percent": 100,
                "downloaded_bytes": final_bytes,
                "total_bytes": final_bytes or approx_bytes,
                "downloaded_mb": final_mb_str,
                "total_mb": final_mb_str,
                "error": None
            }
            log_msg("AI", f"Whisper model '{model_name}' cached via fallback loader.")
        except Exception as fallback_err:
            MODEL_DOWNLOAD_STATUS[model_name] = {
                "status": "error",
                "percent": 0,
                "downloaded_bytes": 0,
                "total_bytes": approx_bytes,
                "downloaded_mb": "0 MB",
                "total_mb": f"{round(approx_bytes / (1024 * 1024), 1)} MB",
                "error": str(fallback_err)
            }
            log_msg("ERROR", f"Failed downloading Whisper model '{model_name}': {fallback_err}")

def trigger_model_download(model_name: str) -> dict:
    current = MODEL_DOWNLOAD_STATUS.get(model_name, {}).get("status")
    if current == "downloading":
        return {
            "status": "already_downloading",
            "model_name": model_name,
            **MODEL_DOWNLOAD_STATUS.get(model_name, {})
        }
    
    target_model = next((m for m in SUPPORTED_MODELS if m["id"] == model_name), None)
    total_bytes = target_model["approx_size_bytes"] if target_model else 500 * 1024 * 1024
    
    MODEL_DOWNLOAD_STATUS[model_name] = {
        "status": "downloading",
        "percent": 0,
        "downloaded_bytes": 0,
        "total_bytes": total_bytes,
        "downloaded_mb": "0.0 MB",
        "total_mb": f"{round(total_bytes / (1024 * 1024), 1)} MB",
        "error": None
    }
    thread = threading.Thread(target=_download_worker, args=(model_name,), daemon=True)
    thread.start()
    return {"status": "download_started", "model_name": model_name}

def get_model_download_status(model_name: str) -> dict:
    return MODEL_DOWNLOAD_STATUS.get(model_name, {"status": "idle", "error": None})

def delete_cached_model(model_name: str) -> bool:
    cache_dir = get_models_cache_dir()
    folder_name = f"models--Systran--faster-whisper-{model_name}"
    target_path = os.path.join(cache_dir, folder_name)

    # 1. Invalidate memory cache
    keys_to_remove = [k for k in list(_MODEL_CACHE.keys()) if k.startswith(f"{model_name}_")]
    for k in keys_to_remove:
        del _MODEL_CACHE[k]

    # 2. Reset status
    if model_name in MODEL_DOWNLOAD_STATUS:
        del MODEL_DOWNLOAD_STATUS[model_name]

    # 3. Remove folder
    if os.path.exists(target_path):
        shutil.rmtree(target_path, ignore_errors=True)
        log_msg("AI", f"Deleted cached Whisper model '{model_name}' from {target_path}")
        return True
    return False

def log_msg(level: str, message: str) -> None:
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    entry = {
        "timestamp": timestamp,
        "level": level,
        "message": message
    }
    LOG_HISTORY.append(entry)
    if len(LOG_HISTORY) > 150:
        LOG_HISTORY.pop(0)
    print(f"[{timestamp}] [{level}] {message}", flush=True)

def setup_cuda_dlls():
    """
    On Windows, adds nvidia-cublas, nvidia-cudnn, nvidia-cuda-nvrtc, etc.
    directories from pip packages or environment paths to the DLL search path so CTranslate2 can locate cublas64_12.dll.
    """
    if sys.platform == "win32":
        import site
        dirs_to_check = set()
        try:
            dirs_to_check.update(site.getsitepackages())
        except Exception:
            pass
        try:
            dirs_to_check.add(site.getusersitepackages())
        except Exception:
            pass
        try:
            for p in sys.path:
                if "site-packages" in p:
                    dirs_to_check.add(p)
        except Exception:
            pass

        added_paths = []
        for base in dirs_to_check:
            if not os.path.isdir(base):
                continue
            nvidia_root = os.path.join(base, "nvidia")
            if os.path.isdir(nvidia_root):
                for root, dirs, _ in os.walk(nvidia_root):
                    if "bin" in dirs:
                        bin_path = os.path.join(root, "bin")
                        try:
                            os.add_dll_directory(bin_path)
                            added_paths.append(bin_path)
                        except Exception:
                            pass
                        if bin_path not in os.environ.get("PATH", ""):
                            os.environ["PATH"] = bin_path + os.pathsep + os.environ.get("PATH", "")
        if added_paths:
            log_msg("SYSTEM", f"NVIDIA CUDA DLL search directories initialized ({len(added_paths)} dirs found).")

# Initialize DLL paths on module import
setup_cuda_dlls()

def get_ffmpeg_path() -> str:
    return imageio_ffmpeg.get_ffmpeg_exe()

def get_whisper_model(model_size: str = "base", device: str = "auto", compute_type: str = "default") -> WhisperModel:
    cache_key = f"{model_size}_{device}_{compute_type}"
    if cache_key in _MODEL_CACHE:
        return _MODEL_CACHE[cache_key]

    # Re-check CUDA DLLs before initializing
    setup_cuda_dlls()

    # Attempt CUDA first
    if device in ("cuda", "auto"):
        try:
            log_msg("AI", f"Attempting to load Whisper '{model_size}' on NVIDIA GPU (CUDA float16)...")
            model = WhisperModel(model_size, device="cuda", compute_type="float16")
            _MODEL_CACHE[cache_key] = model
            log_msg("AI", f"Initialized Whisper '{model_size}' on GPU.")
            return model
        except Exception as cuda_err:
            log_msg("WARN", f"CUDA init failed ({cuda_err}), falling back to CPU int8...")

    # CPU int8 fallback
    try:
        log_msg("AI", f"Loading Whisper '{model_size}' on CPU (int8 AVX)...")
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        _MODEL_CACHE[cache_key] = model
        log_msg("AI", f"Whisper '{model_size}' initialized on CPU (int8).")
        return model
    except Exception as cpu_err:
        log_msg("ERROR", f"CPU int8 init failed ({cpu_err}), using default CPU...")
        model = WhisperModel(model_size, device="cpu", compute_type="default")
        _MODEL_CACHE[cache_key] = model
        return model

def extract_audio(video_path: str, output_wav_path: str) -> None:
    ffmpeg_exe = get_ffmpeg_path()
    log_msg("FFMPEG", f"Extracting 16kHz mono audio from {os.path.basename(video_path)}...")
    cmd = [
        ffmpeg_exe,
        "-y",
        "-i", video_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        output_wav_path
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        log_msg("ERROR", f"FFmpeg extraction error: {result.stderr}")
        raise RuntimeError(f"FFmpeg audio extraction failed: {result.stderr}")
    log_msg("FFMPEG", f"Audio extraction complete -> {os.path.basename(output_wav_path)}")

def strip_punctuation_token(text: str) -> str:
    if not text:
        return ""
    cleaned = text.strip()
    return cleaned.strip(".,!?:;\"'—–-()[]{}/<>~`«»“”‘’")

def chunk_word_tokens(words_list: list, max_words: int = 3, max_gap: float = 0.35, remove_punctuation: bool = False) -> list:
    if not words_list:
        return []
        
    segments = []
    current_words = []
    
    for word_obj in words_list:
        raw_word = word_obj["word"].strip()
        if not raw_word:
            continue

        prev_text = current_words[-1]["word"].strip() if current_words else ""
        has_ending_punct = prev_text[-1] in ".?!," if prev_text else False

        word_entry = dict(word_obj)
        if remove_punctuation:
            word_entry["word"] = strip_punctuation_token(raw_word)

        if not current_words:
            current_words.append(word_entry)
            continue
            
        prev_word = current_words[-1]
        time_gap = word_entry["start"] - prev_word["end"]
        
        if len(current_words) >= max_words or time_gap > max_gap or has_ending_punct:
            seg_start = current_words[0]["start"]
            seg_end = current_words[-1]["end"]
            seg_text = " ".join([w["word"].strip() for w in current_words if w["word"].strip()])
            segments.append({
                "id": f"seg-{uuid.uuid4().hex[:8]}",
                "start": round(float(seg_start), 3),
                "end": round(float(seg_end), 3),
                "text": seg_text,
                "words": current_words
            })
            current_words = [word_entry]
        else:
            current_words.append(word_entry)
            
    if current_words:
        seg_start = current_words[0]["start"]
        seg_end = current_words[-1]["end"]
        seg_text = " ".join([w["word"].strip() for w in current_words if w["word"].strip()])
        segments.append({
            "id": f"seg-{uuid.uuid4().hex[:8]}",
            "start": round(float(seg_start), 3),
            "end": round(float(seg_end), 3),
            "text": seg_text,
            "words": current_words
        })
        
    return segments

def transcribe_media(
    file_path: str, 
    model_name: str = "base", 
    language: str = None, 
    max_words_per_segment: int = 3,
    remove_punctuation: bool = False
) -> dict:
    t_start = time.time()
    punct_label = " (No Punctuation)" if remove_punctuation else ""
    log_msg("TRANSCRIBE", f"Starting job for '{os.path.basename(file_path)}' (Model: {model_name}, Max words/line: {max_words_per_segment}{punct_label})")
    
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_audio:
        tmp_audio_path = tmp_audio.name
        
    try:
        extract_audio(file_path, tmp_audio_path)
        
        transcribe_kwargs = {
            "vad_filter": True,
            "vad_parameters": dict(min_silence_duration_ms=300),
            "word_timestamps": True
        }
        if language and language != "auto":
            transcribe_kwargs["language"] = language
            
        log_msg("TRANSCRIBE", "Running Whisper inference with word timestamp alignment...")
        
        model = get_whisper_model(model_size=model_name, device="auto")
        
        try:
            raw_segments, info = model.transcribe(tmp_audio_path, **transcribe_kwargs)
            # Materialize generator to catch any CUDA / cuBLAS runtime loading failure early
            segments_list = list(raw_segments)
        except Exception as inf_err:
            err_str = str(inf_err).lower()
            if "cublas" in err_str or "cuda" in err_str or "cudnn" in err_str or "dll" in err_str or "not found" in err_str:
                log_msg("WARN", f"CUDA execution failed ({inf_err}). Automatically falling back to CPU (int8)...")
                cpu_model = get_whisper_model(model_size=model_name, device="cpu", compute_type="int8")
                raw_segments, info = cpu_model.transcribe(tmp_audio_path, **transcribe_kwargs)
                segments_list = list(raw_segments)
            else:
                raise
        
        all_words = []
        segment_count = 0
        
        for segment in segments_list:
            segment_count += 1
            log_msg("TRANSCRIBE", f"Processed speech segment {segment_count}: '{segment.text.strip()}' ({segment.start:.2f}s - {segment.end:.2f}s)")
            if segment.words:
                for w in segment.words:
                    word_str = w.word
                    if remove_punctuation:
                        word_str = strip_punctuation_token(w.word)
                    if word_str.strip():
                        all_words.append({
                            "id": f"w-{uuid.uuid4().hex[:8]}",
                            "word": word_str,
                            "start": round(float(w.start), 3),
                            "end": round(float(w.end), 3),
                            "confidence": round(float(w.probability), 3)
                        })
                    
        log_msg("TRANSCRIBE", f"Applying short-form viral chunking to {len(all_words)} total words...")
        chunked_segments = chunk_word_tokens(all_words, max_words=max_words_per_segment, remove_punctuation=remove_punctuation)
        
        t_elapsed = time.time() - t_start
        log_msg("SUCCESS", f"Transcription complete in {t_elapsed:.2f}s! ({len(chunked_segments)} caption segments generated)")
        
        return {
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
            "duration": round(info.duration, 2),
            "segments": chunked_segments,
            "total_words": len(all_words),
            "elapsed_seconds": round(t_elapsed, 2)
        }
    except Exception as e:
        log_msg("ERROR", f"Transcription failed: {str(e)}")
        raise
    finally:
        if os.path.exists(tmp_audio_path):
            try:
                os.remove(tmp_audio_path)
            except Exception:
                pass

