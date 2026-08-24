# Master Architecture & Technical Blueprint

## 1. System Overview
AutoCaption is a lightweight, dedicated short-form video captioning studio designed specifically for vertical content (TikTok, YouTube Shorts, Instagram Reels). It delivers word-level precision transcription, viral caption styling, real-time synchronized playback animations, and high-performance video rendering.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             FRONTEND (React + Vite)                         │
│                                                                             │
│  ┌───────────────────────┐  ┌─────────────────────┐  ┌───────────────────┐  │
│  │ 9:16 Video Canvas     │  │ Timeline & Waveform │  │ Style Inspector   │  │
│  │ - HTML5 Video Layer   │  │ - Segment Blocks    │  │ - Presets Engine  │  │
│  │ - Dynamic Overlay     │  │ - Word-Level Timing │  │ - Font/Stroke/Glow│  │
│  │ - Interactive Bounding│  │ - In-Place Editor   │  │ - Animation Props │  │
│  └───────────┬───────────┘  └──────────┬──────────┘  └─────────┬─────────┘  │
│              │                         │                       │            │
│              └─────────────────────────┼───────────────────────┘            │
│                                        ▼                                    │
│                            Caption State Store (Zustand)                    │
│                                        │                                    │
└────────────────────────────────────────┼────────────────────────────────────┘
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   │ REST API / WebSocket                      │
                   ▼                                           ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────────┐
│ BACKEND (FastAPI + Python)           │   │ CLIENT-SIDE FALLBACK (Browser)   │
│                                      │   │                                  │
│ 1. Audio Extraction (FFmpeg)         │   │ 1. Audio Decode (Web Audio API)  │
│ 2. Word Transcription                │   │ 2. Whisper ONNX (Transformers.js)│
│    - faster-whisper (CTranslate2)    │   │ 3. Canvas Frame Recording        │
│    - Word-level timestamps & VAD     │   │    (WebCodecs / MediaRecorder)   │
│ 3. Chunking & Pacing Engine          │   └──────────────────────────────────┘
│ 4. Video Burner / Exporter           │
│    - Dynamic ASS Generator           │
│    - Hardware FFmpeg NVENC/CPU       │
└──────────────────────────────────────┘
```

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend Framework** | React 18 + Vite | Minimal bundle footprint, instant HMR, reactive rendering. |
| **State Management** | Zustand | Lightweight (<2KB), performant decoupled state for playback sync. |
| **Styling & UI** | Vanilla CSS + CSS Modules | Zero runtime overhead, pixel-perfect keyframe animations. |
| **Video Engine** | HTML5 Video + Canvas 2D Overlay | Sub-millisecond synchronised word highlighting with hardware acceleration. |
| **Backend Framework** | FastAPI (Python 3.10+) | High throughput async endpoints, direct integration with native AI libs. |
| **ASR Model** | `faster-whisper` (CTranslate2) | 4x faster than vanilla OpenAI Whisper, word-level alignment, low RAM. |
| **Video Processing** | Native FFmpeg CLI | Lossless stream handling, ASS subtitle filter, NVENC/QuickSync/libx264. |
| **Client Fallback** | `@xenova/transformers` | Zero-install offline transcription directly in browser Web Worker. |

---

## 3. Core Data Schema

### Word-Level Timestamp Schema (`WordToken`)
```typescript
interface WordToken {
  id: string;
  word: string;
  start: number;      // Seconds with millisecond precision (e.g. 1.240)
  end: number;        // Seconds with millisecond precision (e.g. 1.580)
  confidence: number; // 0.0 - 1.0
  highlighted?: boolean;
}
```

### Caption Segment Schema (`CaptionSegment`)
```typescript
interface CaptionSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words: WordToken[];
  styleOverride?: Partial<CaptionStyle>;
}
```

### Caption Styling Schema (`CaptionStyle`)
```typescript
interface CaptionStyle {
  presetId: 'hormozi' | 'beast' | 'karaoke' | 'minimal' | 'neon' | 'custom';
  fontFamily: string;
  fontSize: number;          // Relative % of viewport height or px
  fontWeight: string | number;
  textTransform: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
  primaryColor: string;      // Inactive word color (e.g. #FFFFFF)
  activeColor: string;       // Active/spoken word color (e.g. #00FF66)
  strokeColor: string;       // Outline color (e.g. #000000)
  strokeWidth: number;       // Outline width (px)
  shadowColor: string;
  shadowBlur: number;
  backgroundColor?: string;
  backgroundPadding?: number;
  borderRadius?: number;
  positionY: number;         // Vertical position percentage (0-100%)
  positionX: number;         // Horizontal position percentage (0-100%)
  maxWordsPerSegment: number;// Typically 2 to 4 words for short-form
  animationType: 'pop' | 'karaoke' | 'bounce' | 'slide' | 'fade' | 'none';
}
```

---

## 4. Key Performance Targets
- **Transcription Latency**: < 3.0s for a 60-second video on modern CPU/GPU.
- **Preview Frame Rate**: Rock-solid 60 FPS synchronized playback with 0ms visual jitter.
- **Export Speed**: 60s 1080x1920 video rendered in < 5.0s via FFmpeg ASS filter.
