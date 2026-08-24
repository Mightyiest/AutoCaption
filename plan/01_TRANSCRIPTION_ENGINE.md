# Transcription & Speech Alignment Engine

## 1. Overview
The transcription engine converts raw video speech into high-precision, word-level timestamps. For short-form viral videos (TikTok/Reels/Shorts), accurate word boundaries are critical to trigger snappy animations and karaoke highlighting without lag.

---

## 2. Audio Extraction Pipeline

1. **Input Video**: Ingest `.mp4`, `.mov`, `.webm`, `.mkv`.
2. **Audio Demuxing via FFmpeg**:
   ```bash
   ffmpeg -i input_video.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 audio_16k.wav
   ```
   - Downsamples to single-channel 16 kHz WAV (optimal Whisper input).
   - Strips video tracks to minimize memory footprint.

---

## 3. Faster-Whisper Backend Implementation

### Model Optimization & Execution
- Engine: `faster-whisper` (backed by CTranslate2).
- Supported Quantizations:
  - `float16` on NVIDIA GPU (CUDA).
  - `int8` on CPU (optimized for modern AVX2/AVX-512 instructions).
- Default Recommended Model: `base.en` or `small` for multi-language, upgradeable to `large-v3-turbo`.

### Voice Activity Detection (VAD) & Alignment
- Enabled Silero VAD filter with parameters:
  - `min_silence_duration_ms = 400`: Prevents halluncination during pauses.
  - `word_timestamps = True`: Forces cross-attention alignment for exact word start/end times.

```python
from faster_whisper import WhisperModel

model = WhisperModel("base", device="auto", compute_type="default")
segments, info = model.transcribe(
    "audio_16k.wav",
    vad_filter=True,
    vad_parameters=dict(min_silence_duration_ms=400),
    word_timestamps=True,
    language="en"
)
```

---

## 4. Short-Form Word Segmentation Algorithm

Whisper by default outputs full sentence segments (10–20 words). Short-form viewers demand compact, high-impact chunks (1 to 4 words at a time).

### Chunking Rules
1. **Max Words Constraint**: Split segment when `word_count >= maxWordsPerSegment` (default: 3 words).
2. **Pause Threshold**: Split segment if the gap between consecutive words > `250ms`.
3. **Punctuation Break**: Force a split on sentence-ending punctuation (`.`, `?`, `!`, `,`).
4. **Duration Window**: Keep segment display duration between `0.4s` and `1.6s`.

### Segment Aggregator Pseudo-Code:
```python
def chunk_words(words, max_words=3, max_gap=0.3):
    chunks = []
    current_chunk = []
    
    for i, word in enumerate(words):
        if not current_chunk:
            current_chunk.append(word)
            continue
            
        gap = word.start - current_chunk[-1].end
        has_punct = current_chunk[-1].word.rstrip()[-1] in ".?!,"
        
        if len(current_chunk) >= max_words or gap > max_gap or has_punct:
            chunks.append({
                "id": str(uuid.uuid4()),
                "start": current_chunk[0].start,
                "end": current_chunk[-1].end,
                "text": " ".join([w.word.strip() for w in current_chunk]),
                "words": current_chunk
            })
            current_chunk = [word]
        else:
            current_chunk.append(word)
            
    if current_chunk:
        chunks.append({
            "id": str(uuid.uuid4()),
            "start": current_chunk[0].start,
            "end": current_chunk[-1].end,
            "text": " ".join([w.word.strip() for w in current_chunk]),
            "words": current_chunk
        })
    return chunks
```

---

## 5. In-Browser Client Fallback (Transformers.js)
When no backend is active:
1. Decode uploaded file in browser using `AudioContext.decodeAudioData`.
2. Resample buffer to 16 kHz Float32Array.
3. Pass buffer to Web Worker running `@xenova/transformers` with `whisper-tiny` or `whisper-base`.
4. Output word chunks using timestamp token extraction.
