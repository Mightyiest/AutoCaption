import { buildCanvasFontString, ensureFontLoaded } from './fontLoader';
import { createCaptionScene } from './captionScene';
import { detectEmojiForWord } from './emojiEngine';
import { isPowerKeyword } from './emphasisEngine';
import { loadAppleEmojiImage } from './appleEmojiHelper';

/**
 * Applies text transformation to a string.
 */
function transformText(text = '', transform = 'uppercase') {
  const str = String(text || '');
  if (transform === 'uppercase') return str.toUpperCase();
  if (transform === 'capitalize') {
    return str.replace(/\b\w/g, c => c.toUpperCase());
  }
  return str;
}

/**
 * Clamp helper.
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Finds the currently active segment for a given playback timestamp.
 */
export function findActiveSegment(segments = [], currentTime = 0) {
  if (!Array.isArray(segments) || segments.length === 0) return null;

  // Exact time window match
  const match = segments.find(seg => currentTime >= (seg.start - 0.05) && currentTime <= (seg.end + 0.1));
  if (match) return match;

  // If between segments or scrubbing before start, find closest if near
  return segments.find(seg => currentTime >= seg.start && currentTime <= seg.end) || null;
}

/**
 * Measures layout and performs deterministic word-wrapping on Canvas 2D.
 *
 * @param {Object} params
 * @param {Object} params.scene - Normalized CaptionScene
 * @param {Object} params.segment - Caption segment to layout
 * @param {CanvasRenderingContext2D} params.ctx - 2D Rendering context
 * @returns {Object} Measured layout with lines, word bounding boxes, and total bounds
 */
export function measureCaptionLayout({ scene, segment, ctx }) {
  if (!segment) return null;

  const style = scene.style;
  const canvasWidth = scene.canvas.width;
  const canvasHeight = scene.canvas.height;
  const scaleFactor = scene.canvas.scaleFactor;

  const fontString = buildCanvasFontString({
    fontFamily: style.fontFamily,
    fontSize: style.scaledFontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle
  });

  ctx.save();
  ctx.font = fontString;
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${style.scaledLetterSpacing}px`;
  }

  // Max allowed width for caption block
  const containerWidthPercent = style.containerWidthPercent || 90;
  const maxBlockWidth = (canvasWidth * (containerWidthPercent / 100));

  // Extract or synthesize word tokens
  let words = [];
  if (Array.isArray(segment.words) && segment.words.length > 0) {
    words = segment.words.map(w => ({
      id: w.id,
      rawText: w.word || w.text || '',
      text: transformText(w.word || w.text || '', style.textTransform),
      start: Number(w.start ?? segment.start),
      end: Number(w.end ?? segment.end),
      score: w.score,
      emoji: w.emoji || null,
      isEmphasized: w.isEmphasized
    }));
  } else {
    // Split segment text into synthetic words
    const rawTokens = String(segment.text || '').trim().split(/\s+/).filter(Boolean);
    const segDuration = Math.max(0.1, (segment.end - segment.start));
    const wordDur = segDuration / Math.max(1, rawTokens.length);
    words = rawTokens.map((t, idx) => ({
      id: `w-syn-${idx}`,
      rawText: t,
      text: transformText(t, style.textTransform),
      start: segment.start + idx * wordDur,
      end: segment.start + (idx + 1) * wordDur,
      score: 1.0,
      emoji: segment.emoji || null,
      isEmphasized: undefined
    }));
  }

  // Measure word dimensions
  const baseWordSpacing = style.scaledWordSpacing;
  // Ensure minimum safe inter-word spacing so animated or emphasized words never collide
  const minSafeGap = Math.round(style.scaledFontSize * 0.28);
  const wordSpacing = Math.max(baseWordSpacing, minSafeGap);
  const scaledEmojiSize = style.scaledEmojiSize || (42 * scaleFactor);
  const customDict = scene?.customDictionary || {};
  const isInlineEmoji = (style.autoEmojiEnabled !== false) && (style.emojiPosition === 'inline');

  const measuredWords = words.map(w => {
    const metrics = ctx.measureText(w.text);
    let width = metrics.width;
    let emojiWidth = 0;

    const hasEmoji = w.emoji || (style.autoEmojiEnabled ? detectEmojiForWord(w.rawText, customDict) : null);
    if (isInlineEmoji && hasEmoji) {
      emojiWidth = scaledEmojiSize + (wordSpacing * 0.4);
      width += emojiWidth;
    }

    return {
      ...w,
      width,
      textWidth: metrics.width,
      emojiWidth,
      metrics
    };
  });

  // Deterministic line wrapping
  const lines = [];
  let currentLineWords = [];
  let currentLineWidth = 0;

  for (const w of measuredWords) {
    const additionalWidth = currentLineWords.length > 0 ? (wordSpacing + w.width) : w.width;
    if (currentLineWords.length > 0 && (currentLineWidth + additionalWidth > maxBlockWidth)) {
      lines.push({
        words: currentLineWords,
        width: currentLineWidth
      });
      currentLineWords = [w];
      currentLineWidth = w.width;
    } else {
      currentLineWords.push(w);
      currentLineWidth += additionalWidth;
    }
  }

  if (currentLineWords.length > 0) {
    lines.push({
      words: currentLineWords,
      width: currentLineWidth
    });
  }

  ctx.restore();

  // Compute block metrics and positioning
  const lineHeightPx = style.scaledFontSize * style.lineHeight;
  const totalBlockHeight = lines.length * lineHeightPx;

  // Center anchor point in pixels
  const anchorX = (canvasWidth * (style.positionX / 100));
  const anchorY = (canvasHeight * (style.positionY / 100));

  // Layout lines and words relative to anchor
  let maxLineWidth = 0;
  const positionedLines = lines.map((line, lineIndex) => {
    maxLineWidth = Math.max(maxLineWidth, line.width);
    const lineY = anchorY - (totalBlockHeight / 2) + (lineIndex * lineHeightPx) + (lineHeightPx / 2);

    let startX = anchorX - (line.width / 2); // Default center align
    if (style.textAlign === 'left') {
      startX = anchorX - (maxBlockWidth / 2);
    } else if (style.textAlign === 'right') {
      startX = anchorX + (maxBlockWidth / 2) - line.width;
    }

    let runningX = startX;
    const positionedWords = line.words.map(w => {
      const wordX = runningX + (w.width / 2); // center of word
      const wordRect = {
        left: runningX,
        top: lineY - (lineHeightPx / 2),
        width: w.width,
        height: lineHeightPx,
        centerX: wordX,
        centerY: lineY
      };
      runningX += w.width + wordSpacing;
      return {
        ...w,
        rect: wordRect,
        lineIndex
      };
    });

    return {
      ...line,
      lineY,
      startX,
      words: positionedWords
    };
  });

  const blockBounds = {
    left: anchorX - (maxLineWidth / 2) - style.scaledBackgroundPaddingX,
    top: anchorY - (totalBlockHeight / 2) - style.scaledBackgroundPaddingY,
    width: maxLineWidth + (style.scaledBackgroundPaddingX * 2),
    height: totalBlockHeight + (style.scaledBackgroundPaddingY * 2),
    centerX: anchorX,
    centerY: anchorY
  };

  return {
    lines: positionedLines,
    blockBounds,
    fontString,
    totalBlockHeight,
    maxLineWidth,
    lineHeightPx,
    segment,
    segmentEmoji: segment.emoji || null
  };
}

/**
 * Computes deterministic animation state for the active word.
 */
function resolveWordAnimation({ word, currentTime, animationType, scaleFactor, style, customKeywords = null }) {
  const isSpoken = currentTime >= word.end;
  const isUpcoming = currentTime < word.start;
  const isActive = currentTime >= word.start && currentTime <= word.end;

  // Check emphasis status (strictly disabled when style.autoEmphasisEnabled is false)
  const isEmphasized = (style?.autoEmphasisEnabled !== false) && (
    word.isEmphasized !== undefined
      ? Boolean(word.isEmphasized)
      : isPowerKeyword(word.rawText || word.text, customKeywords)
  );

  let scale = 1.0;
  let translateY = 0;
  let alpha = 1.0;
  let glowBoost = 1.0;

  if (isActive) {
    const duration = Math.max(0.001, word.end - word.start);
    const progress = clamp((currentTime - word.start) / duration, 0, 1);
    const sinCurve = Math.sin(progress * Math.PI);

    // Harmonize animationType with smart keyword emphasis to prevent compounding/collision
    const emphasisScale = Number(style?.emphasisScale || 1.15);
    const emphasisDelta = isEmphasized ? Math.max(0, emphasisScale - 1.0) : 0;

    switch (animationType) {
      case 'pop': {
        // Pop scale: smooth overshoot and settle, harmonized with emphasis without double-stacking
        const popAmp = Math.min(0.18, 0.14 + emphasisDelta * 0.3);
        scale = 1.0 + popAmp * sinCurve;
        break;
      }
      case 'bounce': {
        // Vertical bounce jump: punchy vertical motion without excessive horizontal distortion
        translateY = -10 * scaleFactor * sinCurve;
        scale = 1.0 + (isEmphasized ? 0.10 : 0.06) * sinCurve;
        break;
      }
      case 'glow': {
        glowBoost = isEmphasized ? (1.5 + 1.8 * sinCurve) : (1.0 + 1.2 * sinCurve);
        scale = 1.0 + 0.05 * sinCurve;
        break;
      }
      case 'fade': {
        alpha = 0.4 + 0.6 * progress;
        scale = 1.0;
        break;
      }
      case 'none': {
        // Static: no active pop scaling unless keyword emphasis boost is specified
        scale = isEmphasized ? Math.min(1.10, 1.0 + emphasisDelta * 0.5) : 1.0;
        translateY = 0;
        alpha = 1.0;
        glowBoost = 1.0;
        break;
      }
      case 'karaoke':
      default: {
        scale = isEmphasized ? 1.06 : 1.02;
        break;
      }
    }
  }

  // Strict clamp to guarantee words never blow out and overlap neighbors
  scale = Math.min(scale, 1.18);

  return {
    isActive,
    isSpoken,
    isUpcoming,
    isEmphasized,
    scale,
    translateY,
    alpha,
    glowBoost
  };
}

/**
 * Draws the complete layered caption frame onto the provided 2D Canvas context.
 *
 * @param {Object} params
 * @param {CanvasRenderingContext2D} params.ctx - Target Canvas context
 * @param {Object} params.scene - Normalized CaptionScene
 * @param {Object} params.layout - Measured layout result from measureCaptionLayout
 * @param {number} params.currentTime - Playback timestamp
 */
export function drawCaptionFrame({ ctx, scene, layout, currentTime, isPlaying = false }) {
  if (!layout || !layout.lines || layout.lines.length === 0) return;

  const style = scene.style;
  const scaleFactor = scene.canvas.scaleFactor;

  ctx.save();
  ctx.font = layout.fontString;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${style.scaledLetterSpacing}px`;
  }

  // ----------------------------------------------------
  // Layer 1: Background Pill / Container Box
  // ----------------------------------------------------
  if (style.backgroundEnabled && style.backgroundColor && style.backgroundColor !== 'transparent') {
    ctx.save();
    const bounds = layout.blockBounds;
    const radius = clamp(style.scaledBorderRadius, 0, Math.min(bounds.width, bounds.height) / 2);
    
    ctx.globalAlpha = clamp((style.backgroundOpacity ?? 85) / 100, 0, 1);
    ctx.fillStyle = style.backgroundColor;

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bounds.left, bounds.top, bounds.width, bounds.height, radius);
    } else {
      ctx.rect(bounds.left, bounds.top, bounds.width, bounds.height);
    }
    ctx.fill();

    // Background border
    if (style.backgroundBorderEnabled && style.scaledBackgroundBorderWidth > 0) {
      ctx.lineWidth = style.scaledBackgroundBorderWidth;
      ctx.strokeStyle = style.backgroundBorderColor || 'rgba(255, 255, 255, 0.25)';
      ctx.stroke();
    }
    ctx.restore();
  }

  // Flatten all words across lines for uniform pass rendering
  const allWords = [];
  for (const line of layout.lines) {
    for (const w of line.words) {
      const anim = resolveWordAnimation({
        word: w,
        currentTime,
        animationType: style.animationType,
        scaleFactor,
        style,
        customKeywords: scene?.customEmphasisKeywords
      });
      allWords.push({ ...w, anim });
    }
  }

  // Draw order: inactive words first, active words last so active/emphasized words always stay on top
  const inactiveWords = allWords.filter(item => !item.anim.isActive);
  const activeWords = allWords.filter(item => item.anim.isActive);
  const drawOrderedWords = [...inactiveWords, ...activeWords];

  // ----------------------------------------------------
  // Layer 2: Outer Glow Pass
  // ----------------------------------------------------
  if (style.glowEnabled && style.scaledGlowBlur > 0) {
    ctx.save();
    ctx.shadowColor = style.glowColor || style.activeColor;
    ctx.shadowBlur = style.scaledGlowBlur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = style.glowColor || style.activeColor;

    for (const item of drawOrderedWords) {
      const { rect, anim, text } = item;
      ctx.save();
      ctx.translate(rect.centerX, rect.centerY + anim.translateY);
      ctx.scale(anim.scale, anim.scale);
      if (anim.isActive) {
        ctx.shadowBlur = style.scaledGlowBlur * anim.glowBoost;
      }
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // ----------------------------------------------------
  // Layer 3: Drop Shadow Pass
  // ----------------------------------------------------
  if (style.shadowEnabled && style.scaledShadowBlur > 0) {
    ctx.save();
    ctx.shadowColor = style.shadowColor || '#000000';
    ctx.shadowBlur = style.scaledShadowBlur;
    ctx.shadowOffsetX = style.scaledShadowOffsetX;
    ctx.shadowOffsetY = style.scaledShadowOffsetY;
    ctx.fillStyle = style.shadowColor || '#000000';

    for (const item of drawOrderedWords) {
      const { rect, anim, text } = item;
      ctx.save();
      ctx.translate(rect.centerX, rect.centerY + anim.translateY);
      ctx.scale(anim.scale, anim.scale);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // ----------------------------------------------------
  // Layer 4: Text Stroke / Outline Pass
  // ----------------------------------------------------
  if (style.strokeEnabled && style.scaledStrokeWidth > 0) {
    ctx.save();
    ctx.strokeStyle = style.strokeColor || '#000000';
    ctx.lineWidth = style.scaledStrokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (const item of drawOrderedWords) {
      const { rect, anim, text } = item;
      ctx.save();
      ctx.translate(rect.centerX, rect.centerY + anim.translateY);
      ctx.scale(anim.scale, anim.scale);
      ctx.strokeText(text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // ----------------------------------------------------
  // Layer 5: Word Fill & Active Color Highlight Pass
  // ----------------------------------------------------
  for (const item of drawOrderedWords) {
    const { rect, anim, text } = item;
    ctx.save();
    ctx.translate(rect.centerX, rect.centerY + anim.translateY);
    ctx.scale(anim.scale, anim.scale);
    ctx.globalAlpha = anim.alpha;

    if (anim.isActive) {
      if (anim.isEmphasized) {
        ctx.fillStyle = style.emphasisColor || '#00FF66';
      } else {
        ctx.fillStyle = style.activeColor || '#FFE600';
      }
    } else if (anim.isEmphasized && (style.emphasisMode === 'always' || !isPlaying)) {
      ctx.fillStyle = style.emphasisColor || '#00FF66';
    } else {
      ctx.fillStyle = style.primaryColor || '#FFFFFF';
    }

    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // ----------------------------------------------------
  // Layer 6: Auto-Emoji & Kinetic Sticker Pop Pass
  // ----------------------------------------------------
  if (style.autoEmojiEnabled !== false) {
    const customDict = scene?.customDictionary || {};
    const scaledEmojiSize = style.scaledEmojiSize || (42 * scaleFactor);
    const emojiAnimType = style.emojiAnimation || 'pop';
    const emojiPosition = style.emojiPosition || 'above_word';

    if (emojiPosition === 'top_center') {
      // Continuous top-center emoji across the active segment window
      const segEmoji = layout.segmentEmoji || allWords.find(w => w.emoji)?.emoji || (style.autoEmojiEnabled ? allWords.map(w => detectEmojiForWord(w.rawText, customDict)).find(Boolean) : null);
      if (segEmoji && layout.segment) {
        const segStart = layout.segment.start;
        const segEnd = layout.segment.end;
        const segDuration = Math.max(0.001, segEnd - segStart);
        const progress = clamp((currentTime - segStart) / segDuration, 0, 1);

        let emojiScale = 1.0;
        let emojiTranslateY = 0;

        if (isPlaying) {
          switch (emojiAnimType) {
            case 'pop': {
              emojiScale = 1.0 + 0.30 * Math.sin(Math.min(1, progress * 4) * Math.PI);
              break;
            }
            case 'bounce': {
              emojiTranslateY = -14 * scaleFactor * Math.sin(Math.min(1, progress * 3) * Math.PI);
              emojiScale = 1.0 + 0.12 * Math.sin(Math.min(1, progress * 3) * Math.PI);
              break;
            }
            case 'float': {
              emojiTranslateY = -6 * scaleFactor * Math.sin(currentTime * 6);
              break;
            }
            case 'none':
            default: {
              emojiScale = 1.0;
              emojiTranslateY = 0;
              break;
            }
          }
        }

        ctx.save();
        const posX = layout.blockBounds.centerX;
        const posY = Math.max(scaledEmojiSize * 0.6, layout.blockBounds.top - (scaledEmojiSize * 0.7) + emojiTranslateY);

        ctx.translate(posX, posY);
        ctx.scale(emojiScale, emojiScale);

        const appleImg = style.emojiStyle !== 'system' ? loadAppleEmojiImage(segEmoji) : null;
        if (appleImg) {
          ctx.drawImage(appleImg, -scaledEmojiSize / 2, -scaledEmojiSize / 2, scaledEmojiSize, scaledEmojiSize);
        } else {
          ctx.font = `${scaledEmojiSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(segEmoji, 0, 0);
        }
        ctx.restore();
      }
    } else {
      // Word-level positioning: above_word or inline
      for (const item of drawOrderedWords) {
        const { rect, anim, emoji, start, end, rawText } = item;
        const targetEmoji = emoji || (style.autoEmojiEnabled ? detectEmojiForWord(rawText, customDict) : null);

        const shouldShowEmoji = Boolean(
          targetEmoji && (
            anim.isActive || 
            !isPlaying || 
            emojiPosition === 'inline'
          )
        );

        if (shouldShowEmoji) {
          const duration = Math.max(0.001, end - start);
          const progress = clamp((currentTime - start) / duration, 0, 1);

          let emojiScale = 1.0;
          let emojiTranslateY = 0;

          if (isPlaying && anim.isActive) {
            switch (emojiAnimType) {
              case 'pop': {
                emojiScale = 1.0 + 0.35 * Math.sin(progress * Math.PI);
                break;
              }
              case 'bounce': {
                emojiTranslateY = -16 * scaleFactor * Math.sin(progress * Math.PI);
                emojiScale = 1.0 + 0.15 * Math.sin(progress * Math.PI);
                break;
              }
              case 'float': {
                emojiTranslateY = -6 * scaleFactor * Math.sin(currentTime * 6);
                break;
              }
              case 'none':
              default: {
                emojiScale = 1.0;
                emojiTranslateY = 0;
                break;
              }
            }
          }

          ctx.save();
          let posX = rect.centerX;
          const wordTopExpansion = (anim.scale - 1.0) * (layout.lineHeightPx * 0.5);
          let posY = Math.max(scaledEmojiSize * 0.6, rect.top - (scaledEmojiSize * 0.75) - wordTopExpansion + anim.translateY + emojiTranslateY);

          if (emojiPosition === 'inline') {
            const wordTextW = item.textWidth || rect.width;
            posX = rect.left + wordTextW + (scaledEmojiSize * 0.5);
            posY = rect.centerY + anim.translateY + emojiTranslateY;
          }

          ctx.translate(posX, posY);
          ctx.scale(emojiScale, emojiScale);

          const appleImg = style.emojiStyle !== 'system' ? loadAppleEmojiImage(targetEmoji) : null;
          if (appleImg) {
            ctx.drawImage(appleImg, -scaledEmojiSize / 2, -scaledEmojiSize / 2, scaledEmojiSize, scaledEmojiSize);
          } else {
            ctx.font = `${scaledEmojiSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(targetEmoji, 0, 0);
          }
          ctx.restore();
        }
      }
    }
  }

  ctx.restore();
}

/**
 * High-level renderer for the live player preview overlay canvas.
 *
 * @param {Object} params
 * @param {HTMLCanvasElement} params.canvas - Transparent overlay canvas
 * @param {Object} params.scene - Normalized CaptionScene
 * @param {number} params.currentTime - Current video playback timestamp
 */
export function renderPreviewOverlay({ canvas, scene, currentTime, isPlaying = false }) {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Ensure canvas internal resolution matches scene dimensions
  if (canvas.width !== scene.canvas.width || canvas.height !== scene.canvas.height) {
    canvas.width = scene.canvas.width;
    canvas.height = scene.canvas.height;
  }

  // Clear previous frame
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Trigger font preloader in background if not cached yet
  ensureFontLoaded(scene.style.fontFamily, scene.style.fontWeight, scene.style.fontStyle).catch(() => {});

  // Find active segment
  const activeSegment = findActiveSegment(scene.segments, currentTime);
  if (!activeSegment) return;

  // Measure and draw
  const layout = measureCaptionLayout({ scene, segment: activeSegment, ctx });
  if (layout) {
    drawCaptionFrame({ ctx, scene, layout, currentTime, isPlaying });
  }
}

/**
 * High-level composite frame renderer used during video export.
 * Draws background video frame followed by styled caption overlay.
 *
 * @param {Object} params
 * @param {HTMLCanvasElement|OffscreenCanvas} params.canvas - Master export canvas
 * @param {CanvasImageSource} [params.videoFrame] - Decoded video frame bitmap or canvas
 * @param {Object} params.scene - Normalized CaptionScene
 * @param {number} params.currentTime - Export frame timestamp
 */
export async function renderCompositeFrame({ canvas, videoFrame, scene, currentTime }) {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const targetWidth = scene.canvas.width;
  const targetHeight = scene.canvas.height;

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  // Clear canvas
  ctx.clearRect(0, 0, targetWidth, targetHeight);

  // 1. Draw video background with aspect ratio scaling / cover
  if (videoFrame) {
    const srcWidth = videoFrame.width || videoFrame.naturalWidth || targetWidth;
    const srcHeight = videoFrame.height || videoFrame.naturalHeight || targetHeight;

    const fit = scene.video.fit || 'cover';
    if (fit === 'cover') {
      const scale = Math.max(targetWidth / srcWidth, targetHeight / srcHeight);
      const drawW = srcWidth * scale;
      const drawH = srcHeight * scale;
      const dx = (targetWidth - drawW) / 2;
      const dy = (targetHeight - drawH) / 2;
      ctx.drawImage(videoFrame, dx, dy, drawW, drawH);
    } else {
      // contain
      const scale = Math.min(targetWidth / srcWidth, targetHeight / srcHeight);
      const drawW = srcWidth * scale;
      const drawH = srcHeight * scale;
      const dx = (targetWidth - drawW) / 2;
      const dy = (targetHeight - drawH) / 2;
      ctx.drawImage(videoFrame, dx, dy, drawW, drawH);
    }
  }

  // 2. Draw styled caption overlay
  const activeSegment = findActiveSegment(scene.segments, currentTime);
  if (activeSegment) {
    await ensureFontLoaded(scene.style.fontFamily, scene.style.fontWeight, scene.style.fontStyle);
    const layout = measureCaptionLayout({ scene, segment: activeSegment, ctx });
    if (layout) {
      drawCaptionFrame({ ctx, scene, layout, currentTime });
    }
  }
}
