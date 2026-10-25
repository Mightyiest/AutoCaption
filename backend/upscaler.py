import os
import sys
import subprocess
import time
import re
import shutil
import tempfile
import urllib.request
import zipfile
import threading
import io
from typing import Optional, Callable, Dict, Any

import imageio_ffmpeg
from transcriber import log_msg

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR = os.path.join(BASE_DIR, "tools")
REALESRGAN_DIR = os.path.join(TOOLS_DIR, "realesrgan")
REALESRGAN_EXE = os.path.join(REALESRGAN_DIR, "realesrgan-ncnn-vulkan.exe")
MODELS_DIR = os.path.join(REALESRGAN_DIR, "models")

RELEASE_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip"

AVAILABLE_MODELS = [
    {
        "id": "realesr-animevideov3",
        "name": "Real-ESRGAN Video V3 (Fast & Smooth)",
        "scales": [2, 3, 4],
        "description": "Temporal-smoothed video model optimized for 30/60 FPS social clips without flickering.",
        "recommended": True
    },
    {
        "id": "realesrgan-x4plus",
        "name": "Real-ESRGAN+ (Photorealistic Detail)",
        "scales": [4],
        "description": "High-fidelity texture restoration for faces, skin, clinical footage, and fine materials.",
        "recommended": False
    },
    {
        "id": "realesrnet-x4plus",
        "name": "Real-ESRNet+ (Natural Smooth)",
        "scales": [4],
        "description": "Smooth real-world super-resolution without artificial sharpening.",
        "recommended": False
    }
]

def is_upscaler_installed() -> bool:
    """Returns True if the Real-ESRGAN Vulkan binary and models exist."""
    return os.path.isfile(REALESRGAN_EXE) and os.path.isdir(MODELS_DIR)

def ensure_upscaler_ready(progress_callback: Optional[Callable[[int, str], None]] = None) -> bool:
    """Downloads and extracts the standalone Real-ESRGAN package if missing."""
    if is_upscaler_installed():
        return True

    os.makedirs(REALESRGAN_DIR, exist_ok=True)
    zip_path = os.path.join(TOOLS_DIR, "realesrgan.zip")

    try:
        log_msg("UPSCALER", "Downloading Real-ESRGAN NCNN Vulkan binary package (~43 MB)...")
        if progress_callback:
            progress_callback(10, "Downloading Real-ESRGAN Vulkan engine...")

        headers = {"User-Agent": "Mozilla/5.0 AutoCaption Studio"}
        req = urllib.request.Request(RELEASE_URL, headers=headers)

        with urllib.request.urlopen(req, timeout=60) as resp, open(zip_path, "wb") as out_f:
            total_size = int(resp.headers.get("Content-Length", 45000000))
            downloaded = 0
            while True:
                chunk = resp.read(1024 * 512)
                if not chunk:
                    break
                out_f.write(chunk)
                downloaded += len(chunk)
                if progress_callback and total_size > 0:
                    pct = 10 + int((downloaded / total_size) * 60)
                    progress_callback(min(70, pct), f"Downloading AI engine: {int(downloaded / (1024*1024))} MB...")

        if progress_callback:
            progress_callback(75, "Extracting Real-ESRGAN engine...")

        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(REALESRGAN_DIR)

        try:
            os.remove(zip_path)
        except Exception:
            pass

        # Flatten subfolder if zip contained one
        subdirs = [
            d for d in os.listdir(REALESRGAN_DIR)
            if os.path.isdir(os.path.join(REALESRGAN_DIR, d)) and "realesrgan" in d.lower()
        ]
        if subdirs:
            sub = os.path.join(REALESRGAN_DIR, subdirs[0])
            for item in os.listdir(sub):
                shutil.move(os.path.join(sub, item), os.path.join(REALESRGAN_DIR, item))
            os.rmdir(sub)

        # Also ensure optional extra models like realesrnet-x4plus are fetched
        ensure_model_available("realesrnet-x4plus")

        installed = is_upscaler_installed()
        log_msg("UPSCALER", f"Real-ESRGAN engine installation status: {installed}")
        if progress_callback:
            progress_callback(100 if installed else 0, "Ready" if installed else "Installation failed")
        return installed

    except Exception as e:
        log_msg("ERROR", f"Failed to download/install Real-ESRGAN: {e}")
        try:
            if os.path.isfile(zip_path):
                os.remove(zip_path)
        except Exception:
            pass
        return False

def ensure_model_available(model_name: str) -> bool:
    """Ensures specific model weights and param files exist in MODELS_DIR."""
    param_file = os.path.join(MODELS_DIR, f"{model_name}.param")
    bin_file = os.path.join(MODELS_DIR, f"{model_name}.bin")
    if os.path.isfile(param_file) and os.path.isfile(bin_file):
        return True

    # Real-ESRNet is hosted in the official v0.1.1 package
    if "realesrnet" in model_name:
        extra_url = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.1/RealESRGAN-ncnn-vulkan-20210725-windows.zip"
        try:
            log_msg("UPSCALER", f"Downloading missing weights for model: {model_name}...")
            headers = {"User-Agent": "Mozilla/5.0 AutoCaption Studio"}
            req = urllib.request.Request(extra_url, headers=headers)
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                for item in zf.namelist():
                    if "realesrnet" in item:
                        fname = os.path.basename(item)
                        if fname:
                            out_p = os.path.join(MODELS_DIR, fname)
                            with zf.open(item) as src, open(out_p, "wb") as dst:
                                dst.write(src.read())
            return os.path.isfile(param_file) and os.path.isfile(bin_file)
        except Exception as e:
            log_msg("ERROR", f"Failed to download extra model {model_name}: {e}")
            return False

    return False

def get_video_stream_info(video_path: str) -> Dict[str, Any]:
    """Inspects video file to get exact (duration, fps, width, height)."""
    try:
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        cmd = [ffmpeg_exe, "-hide_banner", "-i", video_path]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10)
        output = res.stderr

        dur = 10.0
        dur_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", output)
        if dur_match:
            h, m, s = dur_match.groups()
            dur = int(h) * 3600 + int(m) * 60 + float(s)

        fps = 30.0
        fps_match = re.search(r"(\d+(?:\.\d+)?)\s*fps", output)
        if fps_match:
            fps = float(fps_match.group(1))

        width, height = 1080, 1920
        dim_match = re.search(r"Video:.*?,.*?(\d{2,5})x(\d{2,5})", output)
        if dim_match:
            width = int(dim_match.group(1))
            height = int(dim_match.group(2))

        return {
            "duration": max(0.1, dur),
            "fps": max(1.0, fps),
            "width": width,
            "height": height
        }
    except Exception:
        return {"duration": 10.0, "fps": 30.0, "width": 1080, "height": 1920}

def upscale_video(
    source_video_path: str,
    output_video_path: str,
    scale: int = 2,
    model_name: str = "realesr-animevideov3",
    target_width: Optional[int] = None,
    target_height: Optional[int] = None,
    encoder_mode: str = "gpu_nvenc",
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    on_proc_ready: Optional[Callable[[Any], None]] = None
) -> Dict[str, Any]:
    """
    Upscales a video using Real-ESRGAN Vulkan GPU acceleration.
    Preserves native framerate, lossless audio, and universal yuv420p color fidelity.
    """
    if not is_upscaler_installed():
        success = ensure_upscaler_ready()
        if not success:
            raise RuntimeError("Real-ESRGAN engine is not installed and could not be downloaded.")

    # Ensure the requested model weights (.param and .bin) exist
    if not ensure_model_available(model_name):
        model_param = os.path.join(MODELS_DIR, f"{model_name}.param")
        if not os.path.isfile(model_param):
            raise RuntimeError(f"Real-ESRGAN model '{model_name}' could not be located in {MODELS_DIR}")

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    info = get_video_stream_info(source_video_path)
    src_w, src_h = info["width"], info["height"]
    duration = info["duration"]
    fps = info["fps"]

    # Compute target resolution (must be even numbers for H.264)
    out_w = target_width if target_width else src_w * scale
    out_h = target_height if target_height else src_h * scale

    # Enforce standard 4K UHD bounds (max dimension 3840) to guarantee universal compatibility & avoid exceeding hardware NVENC encoder limits (4096)
    MAX_DIM = 3840
    if out_w > MAX_DIM or out_h > MAX_DIM:
        if out_h >= out_w:
            ratio = out_w / out_h
            out_h = MAX_DIM
            out_w = int(round(MAX_DIM * ratio))
        else:
            ratio = out_h / out_w
            out_w = MAX_DIM
            out_h = int(round(MAX_DIM * ratio))

    out_w = out_w if out_w % 2 == 0 else out_w + 1
    out_h = out_h if out_h % 2 == 0 else out_h + 1

    total_frames = max(1, int(round(duration * fps)))

    temp_dir = tempfile.mkdtemp(prefix="autocaption_upscale_")
    in_frames_dir = os.path.join(temp_dir, "in_frames")
    out_frames_dir = os.path.join(temp_dir, "out_frames")
    temp_audio = os.path.join(temp_dir, "audio.aac")

    os.makedirs(in_frames_dir, exist_ok=True)
    os.makedirs(out_frames_dir, exist_ok=True)

    log_msg("UPSCALER", f"Starting AI Upscale ({scale}x): {src_w}x{src_h} -> {out_w}x{out_h} ({total_frames} frames @ {fps} FPS)")

    try:
        # Step 1: Extract Audio losslessly
        cmd_audio = [
            ffmpeg_exe, "-y", "-i", source_video_path,
            "-vn", "-c:a", "aac", "-b:a", "192k", temp_audio
        ]
        subprocess.run(cmd_audio, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20)
        has_audio = os.path.isfile(temp_audio) and os.path.getsize(temp_audio) > 100

        # Step 2: Extract Frames to JPG (q:v 2 provides virtually lossless intermediate frames with maximum speed)
        if progress_callback:
            progress_callback({
                "percent": 5,
                "current_frame": 0,
                "total_frames": total_frames,
                "stage": "extracting",
                "message": f"Extracting {total_frames} video frames..."
            })

        cmd_extract = [
            ffmpeg_exe, "-y", "-i", source_video_path,
            "-vsync", "0",
            "-q:v", "2",
            os.path.join(in_frames_dir, "frame_%08d.jpg")
        ]
        p_ext = subprocess.Popen(cmd_extract, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if on_proc_ready:
            on_proc_ready(p_ext)
        p_ext.wait()

        extracted_files = [f for f in os.listdir(in_frames_dir) if f.endswith(".jpg")]
        actual_total_frames = len(extracted_files)
        if actual_total_frames > 0:
            total_frames = actual_total_frames

        # Step 3: Run Real-ESRGAN Vulkan GPU Upscaling
        # Note: Real-ESRGAN binary internally prepends its own directory to the -m argument.
        # Passing relative path "models" and setting cwd=REALESRGAN_DIR prevents malformed concatenated paths.
        log_msg("UPSCALER", f"Running Real-ESRGAN Vulkan ({model_name}, scale {scale}x)...")
        cmd_upscale = [
            REALESRGAN_EXE,
            "-i", in_frames_dir,
            "-o", out_frames_dir,
            "-m", "models",
            "-n", model_name,
            "-s", str(scale),
            "-f", "jpg"
        ]

        start_time = time.time()
        p_up = subprocess.Popen(
            cmd_upscale,
            cwd=REALESRGAN_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if on_proc_ready:
            on_proc_ready(p_up)

        # Monitor output directory to compute live progress, speed (FPS), and ETA
        stop_monitoring = threading.Event()

        def _monitor_progress():
            while not stop_monitoring.is_set():
                try:
                    done_count = len(os.listdir(out_frames_dir))
                    elapsed = time.time() - start_time
                    cur_fps = round(done_count / max(0.1, elapsed), 1)
                    rem_frames = max(0, total_frames - done_count)
                    eta_sec = int(rem_frames / max(0.1, cur_fps))
                    pct = 10 + int((done_count / max(1, total_frames)) * 75)

                    if progress_callback:
                        progress_callback({
                            "percent": min(85, pct),
                            "current_frame": done_count,
                            "total_frames": total_frames,
                            "fps": cur_fps,
                            "eta_seconds": eta_sec,
                            "stage": "upscaling",
                            "message": f"AI Super-Resolution: {done_count}/{total_frames} frames ({cur_fps} FPS)"
                        })
                except Exception:
                    pass
                time.sleep(0.5)

        t_mon = threading.Thread(target=_monitor_progress, daemon=True)
        t_mon.start()

        stdout, stderr = p_up.communicate()
        stop_monitoring.set()
        t_mon.join(timeout=1.0)

        if p_up.returncode != 0:
            raise RuntimeError(f"Real-ESRGAN process failed with return code {p_up.returncode}: {stderr}")

        # Step 4: Re-multiplex into silky-smooth MP4 with original audio
        if progress_callback:
            progress_callback({
                "percent": 88,
                "current_frame": total_frames,
                "total_frames": total_frames,
                "stage": "encoding",
                "message": "Finalizing high-resolution MP4..."
            })

        vf_filters = []
        actual_upscaled_w = src_w * scale
        actual_upscaled_h = src_h * scale
        if actual_upscaled_w != out_w or actual_upscaled_h != out_h:
            vf_filters.append(f"scale={out_w}:{out_h}:flags=lanczos:out_color_matrix=bt709:out_range=tv")

        cmd_merge = [
            ffmpeg_exe, "-y",
            "-framerate", str(fps),
            "-i", os.path.join(out_frames_dir, "frame_%08d.jpg")
        ]

        if has_audio:
            cmd_merge.extend(["-i", temp_audio])

        if vf_filters:
            cmd_merge.extend(["-vf", ",".join(vf_filters)])

        cmd_merge.extend([
            "-pix_fmt", "yuv420p",
            "-colorspace", "bt709",
            "-color_primaries", "bt709",
            "-color_trc", "bt709",
            "-color_range", "tv",
            "-r", str(fps)
        ])

        if encoder_mode == "gpu_nvenc":
            cmd_merge.extend(["-c:v", "h264_nvenc", "-preset", "p4", "-cq", "19"])
        else:
            cmd_merge.extend(["-c:v", "libx264", "-preset", "fast", "-crf", "18"])

        if has_audio:
            cmd_merge.extend(["-c:a", "copy"])

        cmd_merge.extend(["-movflags", "+faststart"])

        cmd_merge.append(output_video_path)

        p_merge = subprocess.Popen(cmd_merge, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if on_proc_ready:
            on_proc_ready(p_merge)
        stdout_m, stderr_m = p_merge.communicate()

        if p_merge.returncode != 0:
            # Fallback to CPU libx264 if GPU NVENC was unavailable
            if encoder_mode == "gpu_nvenc":
                cmd_fb = [c if c != "h264_nvenc" else "libx264" for c in cmd_merge]
                cmd_fb = [c if c != "-cq" else "-crf" for c in cmd_fb]
                cmd_fb = [c if c != "19" else "18" for c in cmd_fb]
                p_fb = subprocess.Popen(cmd_fb, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                if on_proc_ready:
                    on_proc_ready(p_fb)
                _, stderr_fb = p_fb.communicate()
                if p_fb.returncode != 0:
                    raise RuntimeError(f"FFmpeg assembly failed: {stderr_fb}")
            else:
                raise RuntimeError(f"FFmpeg assembly failed: {stderr_m}")

        if progress_callback:
            progress_callback({
                "percent": 100,
                "current_frame": total_frames,
                "total_frames": total_frames,
                "stage": "completed",
                "message": f"Successfully upscaled to {out_w}x{out_h}!"
            })

        log_msg("SUCCESS", f"AI Video Upscaling complete -> {os.path.basename(output_video_path)} ({out_w}x{out_h} @ {fps} FPS)")

        return {
            "status": "completed",
            "output_path": output_video_path,
            "width": out_w,
            "height": out_h,
            "fps": fps,
            "duration": duration
        }

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
