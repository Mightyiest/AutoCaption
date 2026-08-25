---
name: caption-engine
description: >-
  Guide for modifying and extending the AutoCaption styling, presets, animation algorithms,
  and ensuring 1:1 fidelity between the browser DOM preview and FFmpeg/ASS export outputs.
---

# Caption Engine & Preset Extension Guide

Use this guide when creating new caption presets, adding animation types, adjusting typography metrics, or updating subtitle rendering tags.

---

## 1. Adding a New Style Preset

1. **Open** [`frontend/src/engine/presets.js`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/engine/presets.js).
2. **Add preset definition**:
   ```javascript
   {
     id: 'custom_glow',
     name: 'Custom Glow',
     fontFamily: 'Montserrat',
     fontSize: 48,
     primaryColor: '#FFFFFF',
     secondaryColor: '#FF007F',
     strokeColor: '#000000',
     strokeWidth: 4,
     shadowColor: 'rgba(255, 0, 127, 0.8)',
     shadowBlur: 12,
     animation: 'pop',
     positionY: 75,
     maxWordsPerLine: 4
   }
   ```
3. **Verify Font Asset**:
   - Check if font TTF exists in [`backend/storage/fonts/`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/backend/storage/fonts).
   - If not, download using [`backend/download_fonts.py`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/backend/download_fonts.py) or place `.ttf` manually.

---

## 2. Adding a New Animation Effect

1. **Frontend CSS Animation**:
   - Update [`frontend/src/engine/animator.js`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/engine/animator.js) with the CSS transform / transition classes.
   - Test live animation in [`frontend/src/components/VideoPlayer.jsx`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/frontend/src/components/VideoPlayer.jsx).
2. **Backend ASS Tag Equivalent**:
   - In [`backend/renderer.py`](file:///c:/Users/ownin/Documents/Antigravity%20Projects/AutoCaption/backend/renderer.py), map the animation identifier to corresponding ASS override tags (`\t`, `\fscx`, `\fscy`, `\pos`, `\alpha`).
   - Run a test render to ensure FFmpeg libass renders the exact same visual curve.
