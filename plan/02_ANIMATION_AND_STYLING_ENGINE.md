# Animation & Styling Engine

## 1. Overview
The animation and styling engine transforms static transcribed text into dynamic, visually arresting video captions. It supports both real-time canvas/DOM rendering during playback and exact translation into ASS (Advanced SubStation Alpha) subtitle tags for lossless video burning.

---

## 2. Real-Time Playback Synchronization Pipeline

```
Video currentTime (from requestAnimationFrame)
       │
       ▼
Binary Search: Find Active Segment (start <= t <= end)
       │
       ▼
Binary Search: Find Active Word (word.start <= t <= word.end)
       │
       ▼
Compute Animation Interpolation (progress: 0.0 -> 1.0)
       │
       ▼
Apply CSS Transforms / Canvas Render (Scale, Color, Stroke, Glow)
```

- **Loop Frequency**: 60fps via `requestAnimationFrame` anchored to `<video>.currentTime`.
- **Latency Compensation**: Micro-offset slider (default: `-50ms`) to align visual animation with human auditory perception.

---

## 3. Viral Caption Style Presets

### Preset 1: "Hormozi Impact"
- **Style**: Ultra-bold sans-serif, uppercase, heavy black stroke, vivid yellow active highlight.
- **Animation**: Active word pops up in scale (`scale(1.18)`) with a snappy spring curve (`cubic-bezier(0.175, 0.885, 0.32, 1.275)`).
- **Typography**: `TheBoldFont` or `Montserrat ExtraBold`, font size 36–48px.
- **Colors**: Inactive `#FFFFFF`, Active `#FFE600`, Stroke `#000000` (8px), Shadow `0 8px 16px rgba(0,0,0,0.8)`.

### Preset 2: "MrBeast Explosive"
- **Style**: Thick angled letters, vibrant multi-color accents (green/yellow/cyan), individual word rotation (`rotate(-3deg)`).
- **Animation**: Pop-in with bouncy overshoot.
- **Typography**: `Komika Axis` or `Impact`, font size 42px.
- **Colors**: Inactive `#FFFFFF`, Active `#00FF66`, Stroke `#000000` (10px).

### Preset 3: "Neon Karaoke"
- **Style**: Glowing neon aesthetic, smooth progressive fill per word.
- **Animation**: Active word glows intensely (`filter: drop-shadow(0 0 12px #00FFFF)`) and shifts from cool white to cyan.
- **Typography**: `Outfit` or `Poppins Bold`, font size 34px.
- **Colors**: Inactive `#E2E8F0`, Active `#00FFFF`, Stroke `#0F172A` (4px).

### Preset 4: "Clean Minimalist"
- **Style**: Elegant lower-third captioning with semi-transparent frosted-glass backdrop pill.
- **Animation**: Subtle opacity fade-in with smooth tracking.
- **Typography**: `Inter` / `System Sans`, font size 26px, letter-spacing 0.5px.
- **Colors**: Inactive `#FFFFFF`, Active `#60A5FA`, Background `rgba(15, 23, 42, 0.75)` with `backdrop-filter: blur(8px)`.

---

## 4. Animation Easing & Mechanics

### CSS Keyframe Definitions
```css
@keyframes wordPop {
  0% {
    transform: scale(0.92) translateY(2px);
    filter: brightness(0.9);
  }
  60% {
    transform: scale(1.2) translateY(-2px);
    filter: brightness(1.3);
  }
  100% {
    transform: scale(1.12) translateY(0);
    filter: brightness(1.1);
  }
}

@keyframes wordBounce {
  0% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-8px) scale(1.1);
  }
  100% {
    transform: translateY(0) scale(1.0);
  }
}
```

---

## 5. ASS Subtitle Style Tag Mapping
To ensure exported videos match browser preview with 100% fidelity:

```ass
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Hormozi,Montserrat ExtraBold,72,&H00FFFFFF,&H0000E6FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,8,4,2,20,20,180,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.24,0:00:02.10,Hormozi,,0,0,0,,{\k34}THIS {\k28}IS {\k24}CRAZY
```
- Karaoke tag `{\k<centiseconds>}` smoothly highlights words in FFmpeg without extra video re-encoding passes.
