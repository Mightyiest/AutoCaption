/**
 * Layout & Typography Measurer Engine v2
 * 
 * Replicates the exact DOM geometry from VideoPlayer.jsx to measure
 * individual word bounding boxes, line groupings, and vertical offsets
 * for 1:1 mathematical ASS subtitle positioning.
 */

let measurementHost = null;

function getOrCreateHost() {
  if (typeof document === 'undefined') return null;
  if (!measurementHost) {
    measurementHost = document.createElement('div');
    measurementHost.id = 'autocaption-measurement-host';
    measurementHost.style.position = 'fixed';
    measurementHost.style.top = '-9999px';
    measurementHost.style.left = '-9999px';
    measurementHost.style.visibility = 'hidden';
    measurementHost.style.pointerEvents = 'none';
    measurementHost.style.zIndex = '-9999';
    measurementHost.style.contain = 'layout style size';
    document.body.appendChild(measurementHost);
  }
  return measurementHost;
}

/**
 * Ensures specific font family and weight are fully loaded in DOM before measuring
 */
export async function ensureFontLoaded(style = {}) {
  if (typeof document === 'undefined' || !document.fonts) return;
  
  try {
    const fontFamily = style.fontFamily || 'Montserrat';
    const fontWeight = style.fontWeight || '900';
    const fontSize = style.fontSize || 34;
    
    if (document.fonts.load) {
      await Promise.all([
        document.fonts.load(`${fontWeight} ${fontSize}px "${fontFamily}"`, 'ABCDEFGHIKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
        document.fonts.ready
      ]);
    } else if (document.fonts.ready) {
      await document.fonts.ready;
    }
  } catch (e) {
    // Fallback gracefully
  }
}

/**
 * Measures the exact word-wrapping lines and per-word bounding box coordinates
 * relative to the outer caption container center.
 */
export function measureSegmentLines(words, style = {}, previewWidth = 310) {
  if (!words || words.length === 0) {
    return {
      lines: [[]],
      lineOffsets: [0],
      lineHeight: 0,
      wordBoxes: [],
      outerRect: { width: previewWidth * 0.9, height: 40 }
    };
  }

  const host = getOrCreateHost();
  const boxWidthPx = previewWidth * 0.9;
  const paddingPx = Number(style.backgroundPadding ?? 0);

  if (!host) {
    return {
      lines: [words.map((_, i) => i)],
      lineOffsets: [0],
      lineHeight: (style.fontSize || 34) * 1.15,
      wordBoxes: words.map((_, i) => ({
        index: i,
        line: 0,
        center_x: 0,
        center_y: 0,
        width: 50,
        height: (style.fontSize || 34) * 1.15
      })),
      outerRect: { width: boxWidthPx, height: 40 }
    };
  }

  // 1. Replicate outer caption box (with padding & box-sizing)
  const outer = document.createElement('div');
  outer.style.width = `${Math.floor(boxWidthPx)}px`;
  outer.style.maxWidth = `${Math.floor(boxWidthPx)}px`;
  outer.style.boxSizing = 'border-box';
  outer.style.textAlign = 'center';
  outer.style.padding = paddingPx > 0 ? `${paddingPx}px` : '0px';

  // 2. Replicate inner text container
  const inner = document.createElement('div');
  inner.style.width = '100%';
  inner.style.fontFamily = style.fontFamily || 'Montserrat';
  inner.style.fontSize = `${style.fontSize || 34}px`;
  inner.style.fontWeight = style.fontWeight || '900';
  inner.style.lineHeight = '1.15';
  inner.style.textTransform = style.textTransform || 'uppercase';
  inner.style.letterSpacing = style.fontFamily === 'Bebas Neue' ? '1px' : '-0.5px';
  inner.style.textAlign = 'center';
  inner.style.whiteSpace = 'normal';
  inner.style.boxSizing = 'border-box';

  const strokeWidth = Number(style.strokeWidth ?? 0);
  const strokeColor = style.strokeColor || '#000000';

  const spans = words.map((w, idx) => {
    const span = document.createElement('span');
    span.textContent = w.word;
    span.dataset.idx = idx;
    span.style.display = 'inline-block';
    span.style.margin = '0 4px';
    span.style.boxSizing = 'border-box';
    span.style.paintOrder = 'stroke fill';
    span.style.transformOrigin = 'center center';
    if (strokeWidth > 0) {
      span.style.webkitTextStroke = `${(strokeWidth / 2)}px ${strokeColor}`;
    }
    inner.appendChild(span);
    return span;
  });

  outer.appendChild(inner);
  host.appendChild(outer);

  const outerRect = outer.getBoundingClientRect();
  const outerCenterX = outerRect.left + outerRect.width / 2.0;
  const outerCenterY = outerRect.top + outerRect.height / 2.0;

  // Group spans into lines using spanRect.top with 2.5px tolerance
  const lineTolerance = 2.5;
  const linesGroup = [];

  const spanInfos = spans.map((span, idx) => {
    const rect = span.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2.0 - outerCenterX;
    const centerY = rect.top + rect.height / 2.0 - outerCenterY;

    return {
      index: idx,
      rect,
      centerX,
      centerY
    };
  });

  spanInfos.forEach((info) => {
    let matchedLine = linesGroup.find(
      (l) => Math.abs(l.top - info.rect.top) <= lineTolerance
    );
    if (!matchedLine) {
      matchedLine = {
        top: info.rect.top,
        indices: [],
        infos: []
      };
      linesGroup.push(matchedLine);
    }
    matchedLine.indices.push(info.index);
    matchedLine.infos.push(info);
  });

  // Sort lines top-to-bottom
  linesGroup.sort((a, b) => a.top - b.top);

  const lines = linesGroup.map((l) => l.indices);
  const lineOffsets = linesGroup.map((l) => {
    const avgTop = l.infos.reduce((sum, inf) => sum + inf.rect.top, 0) / l.infos.length;
    const avgHeight = l.infos.reduce((sum, inf) => sum + inf.rect.height, 0) / l.infos.length;
    return avgTop + avgHeight / 2.0 - outerCenterY;
  });

  const wordBoxes = [];
  linesGroup.forEach((l, lineIdx) => {
    l.infos.forEach((inf) => {
      wordBoxes.push({
        index: inf.index,
        line: lineIdx,
        center_x: Math.round(inf.centerX * 100) / 100,
        center_y: Math.round(inf.centerY * 100) / 100,
        width: Math.round(inf.rect.width * 100) / 100,
        height: Math.round(inf.rect.height * 100) / 100
      });
    });
  });

  // Sort word boxes by word index
  wordBoxes.sort((a, b) => a.index - b.index);

  const avgLineHeight = linesGroup.length > 0
    ? linesGroup.reduce((sum, l) => {
        const lHeight = l.infos.reduce((s, inf) => s + inf.rect.height, 0) / l.infos.length;
        return sum + lHeight;
      }, 0) / linesGroup.length
    : (style.fontSize || 34) * 1.15;

  host.removeChild(outer);

  return {
    lines: lines.length > 0 ? lines : [words.map((_, i) => i)],
    lineOffsets: lineOffsets.length > 0 ? lineOffsets : [0],
    lineHeight: avgLineHeight,
    wordBoxes,
    outerRect: {
      width: Math.round(outerRect.width * 100) / 100,
      height: Math.round(outerRect.height * 100) / 100
    }
  };
}

/**
 * Measures layout for all segments in batch.
 * Attaches measured_lines, measured_line_offsets, and measured_word_boxes.
 */
export async function measureAllSegmentsLayout(segments, style, previewWidth, previewHeight) {
  await ensureFontLoaded(style);

  const boxWidthPx = previewWidth * 0.9;
  let totalOuterHeight = 0;

  const measuredSegments = (segments || []).map((seg) => {
    const words = seg.words || [];
    const { lines, lineOffsets, lineHeight, wordBoxes, outerRect } = measureSegmentLines(words, style, previewWidth);
    totalOuterHeight = Math.max(totalOuterHeight, outerRect.height);

    return {
      ...seg,
      measured_lines: lines,
      measured_line_offsets: lineOffsets,
      measured_line_height: lineHeight,
      measured_word_boxes: wordBoxes
    };
  });

  const previewMetrics = {
    version: 2,
    container_width: previewWidth,
    container_height: previewHeight,
    caption_outer_width: Math.round(boxWidthPx * 100) / 100,
    caption_outer_height: Math.round(totalOuterHeight * 100) / 100,
    background_padding: Number(style.backgroundPadding ?? 0),
    box_width: boxWidthPx,
    font_size: style.fontSize,
    stroke_width: Number(style.strokeWidth ?? 0),
    shadow_blur: Number(style.shadowBlur ?? 0),
    shadow_offset_x: Number(style.shadowOffsetX ?? 0),
    shadow_offset_y: Number(style.shadowOffsetY ?? 4),
    position_x: Number(style.positionX ?? 50),
    position_y: Number(style.positionY ?? 74)
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

  const { lines, lineOffsets, wordBoxes, outerRect } = measureSegmentLines(segment.words, style, previewWidth);
  const scale = exportWidth / previewWidth;
  const scaledFontSize = Math.round((style.fontSize || 34) * scale);
  const strokeWidth = Number(style.strokeWidth ?? 0);
  const scaledStrokeWidth = Math.round((strokeWidth / 2) * scale);

  const lineTexts = lines.map((lineIndices) =>
    lineIndices.map((i) => segment.words[i]?.word || '').join(' ')
  );

  const logData = {
    segment_text: segment.text,
    preview_viewport: `${previewWidth}px × ${previewHeight}px`,
    caption_box_width: `${(previewWidth * 0.9).toFixed(1)}px (90% width)`,
    caption_outer_rect: `${outerRect.width}px × ${outerRect.height}px`,
    font_style: `${style.fontSize}px ${style.fontFamily} (Weight: ${style.fontWeight}, Casing: ${style.textTransform})`,
    position: `X: ${style.positionX}%, Y: ${style.positionY}%`,
    stroke: `${strokeWidth}px ${style.strokeColor}`,
    shadow: `Blur: ${style.shadowBlur}px ${style.shadowColor}`,
    measured_lines: lineTexts,
    measured_word_boxes: wordBoxes,
    export_scaling: {
      target_resolution: `${exportWidth} × ${exportHeight}`,
      scale_factor: scale.toFixed(3),
      scaled_font_size: `${scaledFontSize}px`,
      scaled_stroke_width: `${scaledStrokeWidth}px (50% outward)`
    }
  };

  console.groupCollapsed(`%c📐 [LayoutMeasurer v2] ${segment.text}`, 'color: #38BDF8; font-weight: bold;');
  console.table(logData.export_scaling);
  console.log('Word Bounding Boxes:', wordBoxes);
  console.log('Full Measurement Snapshot:', logData);
  console.groupEnd();

  return logData;
}
