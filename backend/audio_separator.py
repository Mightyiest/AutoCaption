import os
import sys
import time
import math
import uuid
import shutil
import subprocess
import threading
import numpy as np
import imageio_ffmpeg

# Storage paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
VOCALS_DIR = os.path.join(STORAGE_DIR, "vocals")
os.makedirs(VOCALS_DIR, exist_ok=True)

# Global cache for separation models
_SEPARATION_MODELS = {}

def get_ffmpeg_path() -> str:
    return imageio_ffmpeg.get_ffmpeg_exe()

def log_separator(level: str, message: str) -> None:
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] [SEPARATOR-{level}] {message}", flush=True)

def extract_audio_for_separation(input_path: str, output_wav: str, sample_rate: int = 44100) -> None:
    """Extracts high quality stereo audio from any input video or audio file."""
    ffmpeg_exe = get_ffmpeg_path()
    cmd = [
        ffmpeg_exe,
        "-y",
        "-i", input_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", str(sample_rate),
        "-ac", "2",
        output_wav
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg audio extraction failed: {res.stderr}")

def convert_wav_to_mp3(wav_path: str, mp3_path: str, bitrate: str = "320k") -> None:
    """Converts a WAV stem into high-bitrate MP3."""
    ffmpeg_exe = get_ffmpeg_path()
    cmd = [
        ffmpeg_exe,
        "-y",
        "-i", wav_path,
        "-acodec", "libmp3lame",
        "-b:a", bitrate,
        mp3_path
    ]
    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

def generate_waveform_peaks(wav_path: str, num_peaks: int = 150) -> list:
    """Extracts normalized amplitude peaks for fast UI waveform rendering."""
    try:
        import soundfile as sf
        data, _ = sf.read(wav_path)
        if data.ndim > 1:
            data = data.mean(axis=1) # mix to mono
        if len(data) == 0:
            return [0.0] * num_peaks
            
        chunk_size = max(1, len(data) // num_peaks)
        peaks = []
        for i in range(num_peaks):
            start = i * chunk_size
            end = min(len(data), start + chunk_size)
            if start < len(data):
                val = float(np.max(np.nan_to_num(np.abs(data[start:end]))))
                peaks.append(round(val, 3))
            else:
                peaks.append(0.0)
        max_p = max(peaks) if peaks else 1.0
        if max_p > 0:
            peaks = [round(float(np.nan_to_num(p / max_p)), 3) for p in peaks]
        return peaks
    except Exception as e:
        log_separator("WARN", f"Could not extract waveform peaks: {e}")
        return [0.2] * num_peaks

def get_demucs_model(model_name: str = "htdemucs"):
    """Loads and caches Meta Demucs model."""
    if model_name in _SEPARATION_MODELS:
        return _SEPARATION_MODELS[model_name]
        
    try:
        import torch
        from demucs.pretrained import get_model
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        log_separator("AI", f"Loading Meta Demucs model '{model_name}' on {device.upper()}...")
        model = get_model(model_name)
        try:
            model.to(device)
        except Exception as dev_err:
            log_separator("WARN", f"Could not place Demucs on {device}: {dev_err}, falling back to CPU")
            device = "cpu"
            model.to("cpu")
            
        model.eval()
        _SEPARATION_MODELS[model_name] = (model, device)
        log_separator("AI", f"Demucs '{model_name}' loaded successfully on {device.upper()}.")
        return _SEPARATION_MODELS[model_name]
    except Exception as e:
        log_separator("ERROR", f"Failed to load Demucs model: {e}")
        raise

def separate_with_demucs(input_wav: str, out_vocals_wav: str, out_inst_wav: str, progress_callback=None) -> None:
    """Performs 2-stem separation using Meta AI Demucs."""
    import torch
    import torchaudio
    import soundfile as sf
    from demucs.apply import apply_model
    
    model, device = get_demucs_model("htdemucs")
    
    if progress_callback:
        progress_callback(15, "Loading audio into neural model...")
        
    data, sr = sf.read(input_wav, dtype="float32")
    if data.ndim == 1:
        wav = torch.from_numpy(data).unsqueeze(0).repeat(2, 1) # convert mono to stereo [2, samples]
    else:
        wav = torch.from_numpy(data.T) # [2, samples]
        
    # Demucs expects sample rate matching model (typically 44100Hz)
    if sr != model.samplerate:
        resampler = torchaudio.transforms.Resample(sr, model.samplerate)
        wav = resampler(wav)
        sr = model.samplerate
        
    # Ensure stereo [2, samples]
    if wav.shape[0] == 1:
        wav = wav.repeat(2, 1)
    elif wav.shape[0] > 2:
        wav = wav[:2, :]
        
    ref = wav.mean(0)
    wav = (wav - ref.mean()) / (ref.std() + 1e-8)
    
    if progress_callback:
        progress_callback(30, "Running neural stem separation...")
        
    try:
        with torch.no_grad():
            sources = apply_model(model, wav[None].to(device), shifts=1, split=True, overlap=0.25, progress=False)[0]
    except Exception as exec_err:
        log_separator("WARN", f"Demucs separation on {device} failed ({exec_err}). Falling back to CPU...")
        model.to("cpu")
        with torch.no_grad():
            sources = apply_model(model, wav[None].to("cpu"), shifts=1, split=True, overlap=0.25, progress=False)[0]
        
    # sources: [4, 2, samples] -> sources map: model.sources (e.g. ['drums', 'bass', 'other', 'vocals'])
    sources = sources * ref.std() + ref.mean()
    sources = sources.cpu()
    
    source_names = model.sources
    vocal_idx = source_names.index("vocals") if "vocals" in source_names else 3
    
    vocals = sources[vocal_idx]
    
    # Instrumental is the sum of all non-vocal stems
    other_indices = [i for i in range(len(source_names)) if i != vocal_idx]
    instrumental = torch.zeros_like(vocals)
    for idx in other_indices:
        instrumental += sources[idx]
        
    if progress_callback:
        progress_callback(75, "Saving separated audio stems...")
        
    # Write stems with soundfile [samples, channels]
    vocals_np = vocals.numpy().T
    inst_np = instrumental.numpy().T
    sf.write(out_vocals_wav, vocals_np, sr)
    sf.write(out_inst_wav, inst_np, sr)

def separate_with_deepfilter_or_spectral(input_wav: str, out_vocals_wav: str, out_inst_wav: str, progress_callback=None) -> None:
    """
    Cleans dialogue / voice using DeepFilterNet if available,
    or falls back to high-fidelity harmonic speech extraction + spectral noise subtraction.
    """
    has_df = False
    try:
        import df
        from df.enhance import enhance, init_df, load_audio, save_audio
        has_df = True
    except Exception:
        has_df = False

    if has_df:
        if progress_callback:
            progress_callback(25, "Running DeepFilterNet speech enhancement...")
        model, df_state, _ = init_df()
        audio, _ = load_audio(input_wav, sr=df_state.sr())
        enhanced = enhance(model, df_state, audio)
        
        # Save clean vocal speech
        save_audio(out_vocals_wav, enhanced, df_state.sr())
        
        # Subtract vocal from original to produce background residual
        orig_audio, _ = load_audio(input_wav, sr=df_state.sr())
        min_len = min(orig_audio.shape[-1], enhanced.shape[-1])
        residual = orig_audio[..., :min_len] - enhanced[..., :min_len]
        save_audio(out_inst_wav, residual, df_state.sr())
    else:
        # High-Fidelity Harmonic-Percussive + Spectral Denoise Fallback
        if progress_callback:
            progress_callback(25, "Applying harmonic speech filtering & background separation...")
            
        import soundfile as sf
        import librosa
        
        y, sr = sf.read(input_wav)
        is_stereo = y.ndim > 1
        y_mono = y.mean(axis=1) if is_stereo else y
        
        # Harmonic components (vocals/speech) vs Percussive/Background components (beats, drums, noise)
        y_harmonic, y_percussive = librosa.effects.hpss(y_mono, margin=(1.8, 1.2))
        
        if is_stereo:
            # Reconstruct stereo
            scale = np.maximum(1e-6, np.abs(y_mono))
            ratio_h = np.abs(y_harmonic) / scale
            ratio_p = np.abs(y_percussive) / scale
            ratio_h = np.clip(ratio_h, 0.0, 1.0)
            ratio_p = np.clip(ratio_p, 0.0, 1.0)
            
            vocals_stereo = np.zeros_like(y)
            inst_stereo = np.zeros_like(y)
            for ch in range(y.shape[1]):
                vocals_stereo[:, ch] = y[:, ch] * ratio_h
                inst_stereo[:, ch] = y[:, ch] * ratio_p
                
            sf.write(out_vocals_wav, vocals_stereo, sr)
            sf.write(out_inst_wav, inst_stereo, sr)
        else:
            sf.write(out_vocals_wav, y_harmonic, sr)
            sf.write(out_inst_wav, y_percussive, sr)

def process_audio_separation(
    input_file_path: str,
    engine: str = "demucs",
    job_id: str = None,
    progress_callback=None
) -> dict:
    """
    Main separation entry point.
    Extracts audio, runs chosen engine (demucs / deepfilter),
    exports WAV + MP3 stems, and calculates waveform peaks.
    """
    job_id = job_id or f"sep_{uuid.uuid4().hex[:10]}"
    t_start = time.time()
    
    job_dir = os.path.join(VOCALS_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)
    
    tmp_input_wav = os.path.join(job_dir, "input_extracted.wav")
    vocals_wav = os.path.join(job_dir, "vocals.wav")
    inst_wav = os.path.join(job_dir, "instrumental.wav")
    vocals_mp3 = os.path.join(job_dir, "vocals.mp3")
    inst_mp3 = os.path.join(job_dir, "instrumental.mp3")
    
    try:
        if progress_callback:
            progress_callback(5, "Extracting audio track from media...")
            
        extract_audio_for_separation(input_file_path, tmp_input_wav, sample_rate=44100)
        
        if engine == "deepfilter":
            log_separator("INFO", f"[{job_id}] Processing with DeepFilter / Speech Enhancement engine...")
            separate_with_deepfilter_or_spectral(tmp_input_wav, vocals_wav, inst_wav, progress_callback)
        else:
            log_separator("INFO", f"[{job_id}] Processing with Meta Demucs neural engine...")
            separate_with_demucs(tmp_input_wav, vocals_wav, inst_wav, progress_callback)
            
        if progress_callback:
            progress_callback(85, "Encoding 320k MP3 stems and generating waveforms...")
            
        # Generate MP3 stems in parallel threads
        t1 = threading.Thread(target=convert_wav_to_mp3, args=(vocals_wav, vocals_mp3, "320k"))
        t2 = threading.Thread(target=convert_wav_to_mp3, args=(inst_wav, inst_mp3, "320k"))
        t1.start()
        t2.start()
        t1.join()
        t2.join()
        
        # Extract visual peaks for waveforms
        vocals_peaks = generate_waveform_peaks(vocals_wav, num_peaks=120)
        inst_peaks = generate_waveform_peaks(inst_wav, num_peaks=120)
        
        # Measure duration
        import soundfile as sf
        info = sf.info(vocals_wav)
        duration_sec = round(info.duration, 2)
        
        elapsed = round(time.time() - t_start, 2)
        log_separator("SUCCESS", f"[{job_id}] Vocal separation completed in {elapsed}s for {duration_sec}s audio.")
        
        if progress_callback:
            progress_callback(100, "Vocal extraction complete!")
            
        return {
            "job_id": job_id,
            "engine": engine,
            "duration": duration_sec,
            "elapsed_seconds": elapsed,
            "stems": {
                "vocals": {
                    "wav_url": f"/static/vocals/{job_id}/vocals.wav",
                    "mp3_url": f"/static/vocals/{job_id}/vocals.mp3",
                    "peaks": vocals_peaks
                },
                "instrumental": {
                    "wav_url": f"/static/vocals/{job_id}/instrumental.wav",
                    "mp3_url": f"/static/vocals/{job_id}/instrumental.mp3",
                    "peaks": inst_peaks
                }
            }
        }
    finally:
        if os.path.exists(tmp_input_wav):
            try:
                os.remove(tmp_input_wav)
            except Exception:
                pass
