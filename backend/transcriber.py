import os
import sys
import time
import tempfile
import uuid
import subprocess
import datetime
import imageio_ffmpeg
from faster_whisper import WhisperModel

_MODEL_CACHE = {}
LOG_HISTORY = []

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
    On Windows, adds nvidia-cublas and nvidia-cudnn directories from pip
    packages to the DLL search path so CTranslate2 can locate cublas64_12.dll.
    """
    if sys.platform == "win32":
        import site
        dirs_to_check = []
        try:
            dirs_to_check.extend(site.getsitepackages())
        except Exception:
            pass
        try:
            dirs_to_check.append(site.getusersitepackages())
        except Exception:
            pass
            
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
                        except Exception:
                            pass
                        if bin_path not in os.environ.get("PATH", ""):
                            os.environ["PATH"] = bin_path + os.pathsep + os.environ.get("PATH", "")
        log_msg("SYSTEM", "NVIDIA CUDA DLL search directories initialized.")

# Initialize DLL paths on module import
setup_cuda_dlls()

def get_ffmpeg_path() -> str:
    return imageio_ffmpeg.get_ffmpeg_exe()

def get_whisper_model(model_size: str = "base", device: str = "auto", compute_type: str = "default") -> WhisperModel:
    cache_key = f"{model_size}_{device}_{compute_type}"
    if cache_key in _MODEL_CACHE:
        return _MODEL_CACHE[cache_key]

    # Attempt CUDA first
    if device in ("cuda", "auto"):
        try:
            log_msg("AI", f"Attempting to load Whisper '{model_size}' on NVIDIA GPU (CUDA float16)...")
            model = WhisperModel(model_size, device="cuda", compute_type="float16")
            _MODEL_CACHE[cache_key] = model
            log_msg("AI", f"Successfully initialized Whisper '{model_size}' on NVIDIA GPU (CUDA).")
            return model
        except Exception as cuda_err:
            log_msg("WARN", f"CUDA init failed ({cuda_err}), falling back to CPU int8...")

    # CPU int8 fallback
    try:
        log_msg("AI", f"Loading Whisper '{model_size}' on CPU (int8 AVX)...")
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        _MODEL_CACHE[cache_key] = model
        log_msg("AI", f"Whisper '{model_size}' initialized on CPU.")
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

def chunk_word_tokens(words_list: list, max_words: int = 3, max_gap: float = 0.35) -> list:
    if not words_list:
        return []
        
    segments = []
    current_words = []
    
    for word_obj in words_list:
        clean_word = word_obj["word"].strip()
        if not clean_word:
            continue
            
        if not current_words:
            current_words.append(word_obj)
            continue
            
        prev_word = current_words[-1]
        time_gap = word_obj["start"] - prev_word["end"]
        prev_text = prev_word["word"].strip()
        has_ending_punct = prev_text[-1] in ".?!," if prev_text else False
        
        if len(current_words) >= max_words or time_gap > max_gap or has_ending_punct:
            seg_start = current_words[0]["start"]
            seg_end = current_words[-1]["end"]
            seg_text = " ".join([w["word"].strip() for w in current_words])
            segments.append({
                "id": f"seg-{uuid.uuid4().hex[:8]}",
                "start": round(seg_start, 3),
                "end": round(seg_end, 3),
                "text": seg_text,
                "words": current_words
            })
            current_words = [word_obj]
        else:
            current_words.append(word_obj)
            
    if current_words:
        seg_start = current_words[0]["start"]
        seg_end = current_words[-1]["end"]
        seg_text = " ".join([w["word"].strip() for w in current_words])
        segments.append({
            "id": f"seg-{uuid.uuid4().hex[:8]}",
            "start": round(seg_start, 3),
            "end": round(seg_end, 3),
            "text": seg_text,
            "words": current_words
        })
        
    return segments

def transcribe_media(file_path: str, model_name: str = "base", language: str = None, max_words_per_segment: int = 3) -> dict:
    t_start = time.time()
    log_msg("TRANSCRIBE", f"Starting job for '{os.path.basename(file_path)}' (Model: {model_name}, Max words/line: {max_words_per_segment})")
    
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_audio:
        tmp_audio_path = tmp_audio.name
        
    try:
        extract_audio(file_path, tmp_audio_path)
        
        model = get_whisper_model(model_size=model_name, device="auto")
        
        transcribe_kwargs = {
            "vad_filter": True,
            "vad_parameters": dict(min_silence_duration_ms=300),
            "word_timestamps": True
        }
        if language and language != "auto":
            transcribe_kwargs["language"] = language
            
        log_msg("TRANSCRIBE", "Running Whisper inference with word timestamp alignment...")
        raw_segments, info = model.transcribe(tmp_audio_path, **transcribe_kwargs)
        
        all_words = []
        segment_count = 0
        
        for segment in raw_segments:
            segment_count += 1
            log_msg("TRANSCRIBE", f"Processed speech segment {segment_count}: '{segment.text.strip()}' ({segment.start:.2f}s - {segment.end:.2f}s)")
            if segment.words:
                for w in segment.words:
                    all_words.append({
                        "id": f"w-{uuid.uuid4().hex[:8]}",
                        "word": w.word,
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "confidence": round(w.probability, 3)
                    })
                    
        log_msg("TRANSCRIBE", f"Applying short-form viral chunking to {len(all_words)} total words...")
        chunked_segments = chunk_word_tokens(all_words, max_words=max_words_per_segment)
        
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
