/**
 * Pure functions for CapCut/Premiere-style caption text editing,
 * tokenization, and deterministic word timing reflow.
 */

/**
 * Normalizes input caption text (collapses duplicate spaces, trims whitespace).
 */
export function normalizeCaptionText(text = '') {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Tokenizes a sentence/line into distinct word strings.
 */
export function wordsFromText(text = '') {
  const normalized = normalizeCaptionText(text);
  if (!normalized) return [];
  return normalized.split(/\s+/).filter(Boolean);
}

/**
 * Deterministically reflows word timings when segment text is edited.
 *
 * Case 1 (Same word count): Preserves exact original start/end timestamps per word.
 * Case 2 (Word count changed): Proportioned reflow across [segmentStart, segmentEnd].
 *
 * @param {Object} params
 * @param {string} params.newText - Updated line text
 * @param {Array} params.oldWords - Existing words array with start/end/confidence
 * @param {number} params.segmentStart - Segment start timestamp in seconds
 * @param {number} params.segmentEnd - Segment end timestamp in seconds
 * @returns {Array} Reflowed words array with valid timestamps
 */
export function reflowWordTimings({
  newText = '',
  oldWords = [],
  segmentStart = 0,
  segmentEnd = 1.0
}) {
  const newTokens = wordsFromText(newText);
  if (newTokens.length === 0) return [];

  const segDuration = Math.max(0.1, segmentEnd - segmentStart);

  // Case 1: Word count matches old words -> 100% preserve existing timing, update spelling
  if (Array.isArray(oldWords) && oldWords.length === newTokens.length) {
    return newTokens.map((token, i) => {
      const old = oldWords[i] || {};
      return {
        id: old.id || `w-${Math.random().toString(36).substring(2, 9)}`,
        word: token,
        start: Math.max(segmentStart, Math.min(segmentEnd, Number(old.start ?? segmentStart))),
        end: Math.max(segmentStart, Math.min(segmentEnd, Number(old.end ?? segmentEnd))),
        confidence: old.confidence ?? 1.0
      };
    });
  }

  // Case 2: Word count changed -> Proportional distribution based on character count
  const totalChars = newTokens.reduce((sum, t) => sum + Math.max(1, t.length), 0);
  let currentStart = segmentStart;

  return newTokens.map((token, index) => {
    const charWeight = Math.max(1, token.length) / totalChars;
    let wordDuration = segDuration * charWeight;

    // Minimum legal word duration (0.05s)
    wordDuration = Math.max(0.05, wordDuration);

    let wordEnd = currentStart + wordDuration;
    if (index === newTokens.length - 1 || wordEnd > segmentEnd) {
      wordEnd = segmentEnd;
    }

    const wordObj = {
      id: `w-${Math.random().toString(36).substring(2, 9)}`,
      word: token,
      start: Math.round(currentStart * 1000) / 1000,
      end: Math.round(wordEnd * 1000) / 1000,
      confidence: 1.0
    };

    currentStart = wordEnd;
    return wordObj;
  });
}

/**
 * Merges two adjacent caption segments into a single segment.
 */
export function mergeAdjacentSegments(seg1, seg2) {
  if (!seg1 && !seg2) return null;
  if (!seg1) return seg2;
  if (!seg2) return seg1;

  const start = Math.min(seg1.start, seg2.start);
  const end = Math.max(seg1.end, seg2.end);
  const combinedWords = [...(seg1.words || []), ...(seg2.words || [])]
    .sort((a, b) => a.start - b.start);
  
  const text = combinedWords.map(w => (w.word || '').trim()).join(' ');

  return {
    id: seg1.id,
    start: Math.round(start * 1000) / 1000,
    end: Math.round(end * 1000) / 1000,
    text,
    words: combinedWords
  };
}

/**
 * Splits a segment at a specific word index.
 */
export function splitSegmentAtWordIndex(segment, wordIndex = 1) {
  if (!segment || !Array.isArray(segment.words) || segment.words.length <= 1) {
    return [segment];
  }

  const safeIdx = Math.max(1, Math.min(segment.words.length - 1, wordIndex));
  const words1 = segment.words.slice(0, safeIdx);
  const words2 = segment.words.slice(safeIdx);

  const seg1 = {
    id: `seg-${Math.random().toString(36).substring(2, 9)}`,
    start: words1[0].start,
    end: words1[words1.length - 1].end,
    text: words1.map(w => w.word.trim()).join(' '),
    words: words1
  };

  const seg2 = {
    id: `seg-${Math.random().toString(36).substring(2, 9)}`,
    start: words2[0].start,
    end: words2[words2.length - 1].end,
    text: words2.map(w => w.word.trim()).join(' '),
    words: words2
  };

  return [seg1, seg2];
}
