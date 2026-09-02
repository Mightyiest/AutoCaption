/**
 * Pure geometric and time math calculations for the zoomable multi-track timeline.
 */

export const MIN_SEGMENT_DURATION = 0.2; // minimum length in seconds
export const DEFAULT_PIXELS_PER_SECOND_BASE = 60; // base px per second at 1x zoom

/**
 * Calculates pixels per second based on duration, viewport width, and zoom factor.
 */
export function getPixelsPerSecond({ duration = 10, viewportWidth = 800, zoom = 1.0, minPps = 10 }) {
  const safeDuration = Math.max(0.1, duration);
  const fitPps = Math.max(minPps, (viewportWidth - 40) / safeDuration);
  const basePps = Math.max(fitPps, DEFAULT_PIXELS_PER_SECOND_BASE);
  return Math.max(minPps, basePps * zoom);
}

/**
 * Converts a time in seconds to an x coordinate in content pixels.
 */
export function timeToContentX(time, pixelsPerSecond) {
  return Math.max(0, time) * pixelsPerSecond;
}

/**
 * Converts an x coordinate in content pixels to time in seconds.
 */
export function contentXToTime(x, pixelsPerSecond) {
  return Math.max(0, x / Math.max(1, pixelsPerSecond));
}

/**
 * Snaps a target time to nearby magnetic snap points (playhead, neighbor edges, frame grid).
 */
export function snapTime({
  targetTime,
  currentTime = 0,
  segments = [],
  ignoreSegmentId = null,
  fps = 30,
  snapThresholdSeconds = 0.08,
  enabled = true
}) {
  if (!enabled) return targetTime;

  let bestSnap = targetTime;
  let minDiff = snapThresholdSeconds;

  // 1. Snap to Playhead
  const diffPlayhead = Math.abs(targetTime - currentTime);
  if (diffPlayhead < minDiff) {
    minDiff = diffPlayhead;
    bestSnap = currentTime;
  }

  // 2. Snap to neighbor segment boundaries (start and end edges)
  for (const seg of segments) {
    if (seg.id === ignoreSegmentId) continue;
    
    const diffStart = Math.abs(targetTime - seg.start);
    if (diffStart < minDiff) {
      minDiff = diffStart;
      bestSnap = seg.start;
    }

    const diffEnd = Math.abs(targetTime - seg.end);
    if (diffEnd < minDiff) {
      minDiff = diffEnd;
      bestSnap = seg.end;
    }
  }

  // 3. Snap to frame boundary if no close object snap
  if (minDiff === snapThresholdSeconds && fps > 0) {
    const frameDuration = 1 / fps;
    const frameIndex = Math.round(targetTime / frameDuration);
    const frameSnap = frameIndex * frameDuration;
    if (Math.abs(targetTime - frameSnap) < frameDuration / 2) {
      bestSnap = frameSnap;
    }
  }

  return Math.round(bestSnap * 1000) / 1000;
}

/**
 * Formats timecode adaptively based on the tick step interval.
 */
export function formatAdaptiveTimecode(seconds, step = 1) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const minStr = mins.toString().padStart(2, '0');
  const secStr = secs.toString().padStart(2, '0');

  if (step >= 1) {
    return `${minStr}:${secStr}`;
  }

  const fraction = Math.max(0, seconds % 1);
  if (step < 0.05) {
    const ms = Math.round(fraction * 1000) % 1000;
    return `${minStr}:${secStr}.${ms.toString().padStart(3, '0')}`;
  } else if (step <= 0.25) {
    const cs = Math.round(fraction * 100) % 100;
    return `${minStr}:${secStr}.${cs.toString().padStart(2, '0')}`;
  } else {
    const ds = Math.round(fraction * 10) % 10;
    return `${minStr}:${secStr}.${ds}`;
  }
}

/**
 * Computes ruler ticks and intervals based on current pixels-per-second.
 */
export function calculateRulerTicks(duration = 10, pixelsPerSecond = 60) {
  const safeDur = Math.max(1, duration);
  
  // Decide tick step in seconds based on visual density
  // Target: tick labels every ~80px
  const targetPx = 80;
  const rawStep = targetPx / pixelsPerSecond;

  const candidateSteps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
  let step = candidateSteps[candidateSteps.length - 1];
  for (const s of candidateSteps) {
    if (s >= rawStep) {
      step = s;
      break;
    }
  }

  const ticks = [];
  let index = 0;
  for (let t = 0; t <= safeDur + (step * 0.05); t += step) {
    const roundedTime = Math.round(t * 1000) / 1000;
    ticks.push({
      time: roundedTime,
      isMajor: index % 2 === 0
    });
    index++;
  }

  return { ticks, step };
}

/**
 * Clamps segment move within total duration and computes shifted words.
 */
export function clampSegmentMove({ segment, deltaSeconds, maxDuration = 1000 }) {
  const segDur = segment.end - segment.start;
  let newStart = Math.max(0, segment.start + deltaSeconds);
  let newEnd = newStart + segDur;

  if (newEnd > maxDuration) {
    newEnd = maxDuration;
    newStart = Math.max(0, newEnd - segDur);
  }

  const actualDelta = newStart - segment.start;
  const updatedWords = (segment.words || []).map(w => ({
    ...w,
    start: Math.round((w.start + actualDelta) * 1000) / 1000,
    end: Math.round((w.end + actualDelta) * 1000) / 1000
  }));

  return {
    start: Math.round(newStart * 1000) / 1000,
    end: Math.round(newEnd * 1000) / 1000,
    words: updatedWords,
    actualDelta
  };
}

/**
 * Clamps segment trimming (start or end) ensuring minimum legal duration.
 */
export function clampSegmentTrim({ segment, edge = 'start', newTime, maxDuration = 1000 }) {
  let start = segment.start;
  let end = segment.end;

  if (edge === 'start') {
    start = Math.max(0, Math.min(end - MIN_SEGMENT_DURATION, newTime));
  } else {
    end = Math.min(maxDuration, Math.max(start + MIN_SEGMENT_DURATION, newTime));
  }

  // Adjust edge words to stay within new segment interval
  const updatedWords = (segment.words || []).map(w => {
    return {
      ...w,
      start: Math.max(start, Math.min(end, w.start)),
      end: Math.max(start, Math.min(end, w.end))
    };
  }).filter(w => (w.end - w.start) > 0.01);

  return {
    start: Math.round(start * 1000) / 1000,
    end: Math.round(end * 1000) / 1000,
    words: updatedWords
  };
}
