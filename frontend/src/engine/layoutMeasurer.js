/**
 * Layout Measurer & Debug Logger Engine
 * 
 * Accurately calculates DOM word wrapping, bounding boxes, and scale metrics
 * for subtitle preview matching and export payload generation.
 * 
 * Replicates the exact VideoPlayer.jsx caption overlay styling (including
 * WebkitTextStroke, paintOrder, margins) so measured line breaks match
 * the preview pixel-for-pixel.
 */

let measurementHost = null;

function getOrCreateHost() {
  if (typeof document === 'undefined') return null;
  if (!measurementHost) {
    measurementHost = document.createElement('div');
    measurementHost.id = 'autocaption-measurer-host';
    measurementHost.style.position = 'fixed';
    measurementHost.style.top = '-9999px';
    measurementHost.style.left = '-9999px';
    measurementHost.style.visibility = 'hidden';
    measurementHost.style.pointerEvents = 'none';
    measurementHost.style.zIndex = '-1000';
    document.body.appendChild(measurementHost);
  }
  return measurementHost;
}

/**
 * Measures the exact word-wrapping lines for a segment's words given style and preview box width.
 * Must replicate every CSS property that affects layout width from VideoPlayer.jsx + index.css.
 * @returns {Array<Array<number>>} Array of lines, where each line is an array of word indices
 */
export function measureSegmentLines(words, style, boxWidthPx) {
  if (!words || words.length === 0) return { lines: [[]], lineOffsets: [0], lineHeight: 0 };
  if (words.length === 1) return { lines: [[0]], lineOffsets: [0], lineHeight: (style.fontSize || 34) * 1.15 };

  const host = getOrCreateHost();
  if (!host) {
    return { lines: [words.map((_, i) => i)], lineOffsets: [0], lineHeight: (style.fontSize || 34) * 1.15 };
  }

  // Replicate VideoPlayer.jsx caption text container exactly
  const container = document.createElement('div');
  container.style.width = `${Math.floor(boxWidthPx)}px`;
  container.style.maxWidth = `${Math.floor(boxWidthPx)}px`;
  container.style.textAlign = 'center';
  container.style.fontFamily = style.fontFamily || 'Montserrat';
  container.style.fontSize = `${style.fontSize || 34}px`;
  container.style.fontWeight = style.fontWeight || '900';
  container.style.lineHeight = '1.15';
  container.style.textTransform = style.textTransform || 'uppercase';
  container.style.letterSpacing = style.fontFamily === 'Bebas Neue' ? '1px' : '-0.5px';
  container.style.boxSizing = 'border-box';
  container.style.whiteSpace = 'normal';

  const strokeWidth = style.strokeWidth || 0;
  const strokeColor = style.strokeColor || '#000000';

  const spans = words.map((w, idx) => {
    const span = document.createElement('span');
    span.textContent = w.word;
    span.dataset.idx = idx;
    span.style.display = 'inline-block';
    span.style.margin = '0 4px';
    span.style.boxSizing = 'border-box';
    span.style.paintOrder = 'stroke fill';
    // Halve stroke width to match CSS paint-order: stroke fill (50% outward)
    // This ensures measured layout matches what user sees in preview and final render
    if (strokeWidth > 0) {
      span.style.webkitTextStroke = `${(strokeWidth / 2)}px ${strokeColor}`;
    }
    container.appendChild(span);
    return span;
  });

  host.appendChild(container);

  // Group spans by their rendered offsetTop and capture heights
  const linesMap = new Map();
  let totalMeasuredHeight = 0;
  spans.forEach((span, idx) => {
    const top = span.offsetTop;
    const height = span.offsetHeight;
    let matchedKey = null;
    for (const key of linesMap.keys()) {
      if (Math.abs(key - top) <= 4) {
        matchedKey = key;
        break;
      }
    }
    if (matchedKey === null) {
      matchedKey = top;
      linesMap.set(matchedKey, { indices: [], top, height });
    }
    linesMap.get(matchedKey).indices.push(idx);
  });

  const containerRect = container.getBoundingClientRect();
  const boxCenterY = containerRect.height / 2.0;

  const lineEntries = Array.from(linesMap.values());
  const lines = lineEntries.map((e) => e.indices);
  const lineOffsets = lineEntries.map((e) => {
    const lineCenterY = e.top + (e.height / 2.0);
    return lineCenterY - boxCenterY;
  });
  // Use CSS line-height (1.15) for accurate line height measurement matching preview
  const avgLineHeight = lineEntries.length > 0 
    ? lineEntries.reduce((acc, cur) => acc + cur.height, 0) / lineEntries.length 
    : (style.fontSize || 34) * 1.15;
  
  host.removeChild(container);

  return {
    lines: lines.length > 0 ? lines : [words.map((_, i) => i)],
    lineOffsets: lineOffsets.length > 0 ? lineOffsets : [0],
    lineHeight: avgLineHeight,
    containerHeight: containerRect.height
  };
}

/**
 * Measures layout for all segments. Waits for fonts to be loaded first.
 * Attaches `measured_lines` and `line_offsets` to each segment.
 */
export async function measureAllSegmentsLayout(segments, style, previewWidth, previewHeight) {
  // Ensure web fonts are fully loaded before measuring
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const boxWidthPx = previewWidth * 0.9;

  const measuredSegments = (segments || []).map((seg) => {
    const words = seg.words || [];
    const { lines, lineOffsets, lineHeight } = measureSegmentLines(words, style, boxWidthPx);
    return {
      ...seg,
      measured_lines: lines,
      measured_line_offsets: lineOffsets,
      measured_line_height: lineHeight
    };
  });

  const previewMetrics = {
    container_width: previewWidth,
    container_height: previewHeight,
    box_width: boxWidthPx,
    font_size: style.fontSize,
    stroke_width: style.strokeWidth,
    shadow_blur: style.shadowBlur,
    position_x: style.positionX,
    position_y: style.positionY
  };

  return {
    segments: measuredSegments,
    preview_metrics: previewMetrics
  };
}

/**
 * Captures live measurement data for active segment and logs details to console.
 */
export function captureAndLogLayoutMetrics(segment, style, previewWidth, previewHeight, exportWidth = 1080, exportHeight = 1920) {
  if (!segment || !segment.words) return null;

  const boxWidthPx = previewWidth * 0.9;
  const { lines } = measureSegmentLines(segment.words, style, boxWidthPx);
  const scale = (exportWidth / previewWidth);
  const scaledFontSize = Math.round((style.fontSize || 34) * scale);
  const scaledStrokeWidth = Math.round(((style.strokeWidth || 6) / 2) * scale);

  const lineTexts = lines.map((lineIndices) =>
    lineIndices.map((i) => segment.words[i]?.word || '').join(' ')
  );

  const logData = {
    segment_text: segment.text,
    preview_viewport: `${previewWidth}px × ${previewHeight}px`,
    caption_box_width: `${boxWidthPx.toFixed(1)}px (90% width)`,
    font_style: `${style.fontSize}px ${style.fontFamily} (Weight: ${style.fontWeight}, Casing: ${style.textTransform})`,
    position: `X: ${style.positionX}%, Y: ${style.positionY}%`,
    stroke: `${style.strokeWidth}px ${style.strokeColor}`,
    shadow: `Blur: ${style.shadowBlur}px ${style.shadowColor}`,
    measured_lines: lineTexts,
    export_scaling: {
      target_resolution: `${exportWidth} × ${exportHeight}`,
      scale_factor: scale.toFixed(3),
      scaled_font_size: `${scaledFontSize}px`,
      scaled_stroke_width: `${scaledStrokeWidth}px`
    }
  };

  console.groupCollapsed(`%c[AutoCaption Layout Logger] %c"${segment.text}" %c(${lineTexts.length} Lines)`, 'color: #38BDF8; font-weight: bold;', 'color: #FFE600; font-weight: bold;', 'color: #94A3B8;');
  console.table({
    'Preview Dimensions': logData.preview_viewport,
    'Caption Box Width': logData.caption_box_width,
    'Font Style': logData.font_style,
    'Vertical Pos (Y)': `${style.positionY}%`,
    'Lines Wrapped': lineTexts.join(' / '),
    'Scale to Export': `${scale.toFixed(3)}x (Export Font: ${scaledFontSize}px, Stroke: ${scaledStrokeWidth}px)`
  });
  console.log('Detailed Layout Metrics:', logData);
  console.groupEnd();

  return logData;
}
