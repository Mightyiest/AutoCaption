import { sanitizeStyle, DEFAULT_STYLE } from './presets';

/**
 * Standard reference canvas dimensions for typography and layout math.
 * Standard portrait: 1080 x 1920. Reference height = 1920.
 */
export const REFERENCE_HEIGHT = 1920;
export const REFERENCE_WIDTH = 1080;

/**
 * Normalizes state into a single serializable Scene Graph consumed by
 * both the preview Canvas renderer and the client-side Mediabunny exporter.
 *
 * @param {Object} params
 * @param {Object} params.style - Raw or sanitized style object
 * @param {Array} params.segments - Array of transcription/caption segments with word timings
 * @param {Object} [params.canvasSize] - Target dimensions { width: number, height: number, fps: number }
 * @param {number} [params.currentTime] - Current playback/export timestamp in seconds
 * @param {Object} [params.videoInfo] - Video metadata { url, file, naturalWidth, naturalHeight, duration }
 * @returns {Object} Normalized CaptionScene
 */
export function createCaptionScene({
  style = {},
  segments = [],
  canvasSize = { width: 1080, height: 1920, fps: 30 },
  currentTime = 0,
  videoInfo = {}
}) {
  const sanitized = sanitizeStyle(style);
  const width = Math.max(1, Number(canvasSize.width || 1080));
  const height = Math.max(1, Number(canvasSize.height || 1920));
  const fps = Math.max(1, Number(canvasSize.fps || 30));
  const scaleFactor = height / REFERENCE_HEIGHT;

  const frameIndex = Math.max(0, Math.floor(currentTime * fps));

  // Compute scaled style metrics according to canonical reference height (1920px)
  const scaledStyle = {
    ...sanitized,
    scaledFontSize: sanitized.fontSize * scaleFactor,
    scaledStrokeWidth: (sanitized.strokeWidth || 0) * scaleFactor,
    scaledShadowBlur: (sanitized.shadowBlur || 0) * scaleFactor,
    scaledShadowOffsetX: (sanitized.shadowOffsetX || 0) * scaleFactor,
    scaledShadowOffsetY: (sanitized.shadowOffsetY || 0) * scaleFactor,
    scaledGlowBlur: (sanitized.glowBlur || 0) * scaleFactor,
    scaledWordSpacing: (sanitized.wordSpacing || 0) * scaleFactor,
    scaledLetterSpacing: (sanitized.letterSpacing || 0) * scaleFactor,
    scaledBackgroundPaddingX: (sanitized.backgroundPaddingX ?? sanitized.backgroundPadding ?? 16) * scaleFactor,
    scaledBackgroundPaddingY: (sanitized.backgroundPaddingY ?? sanitized.backgroundPadding ?? 8) * scaleFactor,
    scaledBorderRadius: (sanitized.borderRadius || 0) * scaleFactor,
    scaledBackgroundBorderWidth: (sanitized.backgroundBorderWidth || 0) * scaleFactor,
    scaledEmojiSize: (sanitized.emojiSize || 42) * scaleFactor,
    scaleFactor
  };

  return {
    canvas: {
      width,
      height,
      fps,
      aspectRatio: width / height,
      referenceHeight: REFERENCE_HEIGHT,
      referenceWidth: REFERENCE_WIDTH,
      scaleFactor
    },
    timing: {
      currentTime: Number(currentTime) || 0,
      frameIndex,
      fps
    },
    style: scaledStyle,
    rawStyle: sanitized,
    segments: Array.isArray(segments) ? segments : [],
    video: {
      url: videoInfo.url || '',
      file: videoInfo.file || null,
      naturalWidth: videoInfo.naturalWidth || width,
      naturalHeight: videoInfo.naturalHeight || height,
      duration: videoInfo.duration || 0,
      fit: videoInfo.fit || 'cover'
    }
  };
}
