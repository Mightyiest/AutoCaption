/**
 * Locates the active segment and active word for the given playback time.
 */
export function getActiveSegmentAndWord(segments, currentTime) {
  if (!segments || segments.length === 0) {
    return { activeSegment: null, activeWord: null, activeWordIndex: -1 };
  }

  // Find active segment
  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start && currentTime <= seg.end
  );

  if (!activeSegment || !activeSegment.words || activeSegment.words.length === 0) {
    return { activeSegment: activeSegment || null, activeWord: null, activeWordIndex: -1 };
  }

  // Find active word in segment
  let activeWordIndex = activeSegment.words.findIndex(
    (w) => currentTime >= w.start && currentTime <= w.end
  );

  // If time is within segment but between words, pick closest previous word
  if (activeWordIndex === -1 && currentTime >= activeSegment.start) {
    for (let i = activeSegment.words.length - 1; i >= 0; i--) {
      if (currentTime >= activeSegment.words[i].start) {
        activeWordIndex = i;
        break;
      }
    }
  }

  const activeWord = activeWordIndex !== -1 ? activeSegment.words[activeWordIndex] : null;

  return {
    activeSegment,
    activeWord,
    activeWordIndex
  };
}

/**
 * Calculates time offset formatted as MM:SS.ms
 */
export function formatTimecode(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}
