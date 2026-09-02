/**
 * Word Chunking & Viral Segmentation Engine
 * Dynamically re-segments word tokens into 1-word, 2-word, 3-word, or N-word captions
 * with exact millisecond start/end boundaries and punctuation awareness.
 */

/**
 * Strips all punctuation marks from text.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripPunctuation(text = '') {
  if (!text) return '';
  return String(text)
    .replace(/^[\s.,/#!$%^&*;:{}=\-_`~()?"'«»“”‘’—–]+|[\s.,/#!$%^&*;:{}=\-_`~()?"'«»“”‘’—–]+$/g, '')
    .trim();
}

/**
 * Extracts a flattened, sorted list of all word tokens from caption segments.
 *
 * @param {Array} segments - Current caption segments
 * @param {boolean} [removePunctuation=false] - Whether to strip punctuation from words
 * @returns {Array} List of word objects
 */
export function extractAllWords(segments = [], removePunctuation = false) {
  if (!Array.isArray(segments) || segments.length === 0) return [];
  const words = [];

  for (const seg of segments) {
    if (seg.words && seg.words.length > 0) {
      for (const w of seg.words) {
        let cleanWord = String(w.word || '').trim();
        if (removePunctuation) {
          cleanWord = stripPunctuation(cleanWord);
        }
        if (cleanWord) {
          words.push({
            id: w.id || `w-${Math.random().toString(36).slice(2, 9)}`,
            word: cleanWord,
            start: Number(w.start) || 0,
            end: Number(w.end) || (Number(w.start) + 0.2),
            confidence: Number(w.confidence) || 0.95,
            emoji: w.emoji || null,
            isEmphasized: w.isEmphasized
          });
        }
      }
    } else if (seg.text && seg.text.trim()) {
      // Fallback: tokenize manual segment text into words
      let rawText = seg.text.trim();
      if (removePunctuation) {
        rawText = stripPunctuation(rawText);
      }
      const textWords = rawText.split(/\s+/).filter(Boolean);
      const totalDur = Math.max(0.1, (Number(seg.end) || 1) - (Number(seg.start) || 0));
      const wordDur = totalDur / Math.max(1, textWords.length);
      const segStart = Number(seg.start) || 0;

      textWords.forEach((tw, idx) => {
        words.push({
          id: `w-${Math.random().toString(36).slice(2, 9)}`,
          word: tw,
          start: Math.round((segStart + idx * wordDur) * 1000) / 1000,
          end: Math.round((segStart + (idx + 1) * wordDur) * 1000) / 1000,
          confidence: 0.95,
          emoji: seg.emoji || null,
          isEmphasized: undefined
        });
      });
    }
  }

  // Sort by start timestamp to ensure sequential order
  return words.sort((a, b) => a.start - b.start);
}

/**
 * Rechunks word tokens into viral short-form segments based on maxWords per screen.
 *
 * @param {Array} wordsList - Array of word objects
 * @param {number} [maxWords=3] - Maximum words per caption block (1-5)
 * @param {number} [maxGap=1.0] - Maximum silence gap (seconds) before forcing a new segment
 * @param {boolean} [removePunctuation=false] - Whether to strip punctuation from tokens
 * @returns {Array} Array of rechunked caption segments
 */
export function chunkWordsIntoSegments(wordsList = [], maxWords = 3, maxGap = 1.0, removePunctuation = false) {
  const safeMax = Math.max(1, Math.min(6, parseInt(maxWords, 10) || 3));
  if (!Array.isArray(wordsList) || wordsList.length === 0) return [];

  const segments = [];
  let currentWords = [];

  for (const wordObj of wordsList) {
    let cleanWord = String(wordObj.word || '').trim();
    if (removePunctuation) {
      cleanWord = stripPunctuation(cleanWord);
    }
    if (!cleanWord) continue;

    const formattedWordObj = {
      ...wordObj,
      word: cleanWord,
      emoji: wordObj.emoji || null,
      isEmphasized: wordObj.isEmphasized
    };

    if (currentWords.length === 0) {
      currentWords.push(formattedWordObj);
      continue;
    }

    const prevWord = currentWords[currentWords.length - 1];
    const timeGap = formattedWordObj.start - prevWord.end;
    const prevText = prevWord.word.trim();
    const hasSentencePunct = !removePunctuation && Boolean(prevText && ['.', '?', '!'].includes(prevText[prevText.length - 1]));

    // Check chunk break conditions:
    // 1. Reached max words per screen limit
    // 2. Audible pause/silence between words (> maxGap)
    // 3. Strong sentence ending punctuation (. ? !)
    if (currentWords.length >= safeMax || timeGap > maxGap || hasSentencePunct) {
      const segStart = currentWords[0].start;
      const segEnd = currentWords[currentWords.length - 1].end;
      const segText = currentWords.map(w => w.word.trim()).join(' ');
      const segEmoji = currentWords.find(w => w.emoji)?.emoji || null;

      segments.push({
        id: `seg-${Math.random().toString(36).slice(2, 9)}`,
        start: Math.round(segStart * 1000) / 1000,
        end: Math.round(segEnd * 1000) / 1000,
        text: segText,
        emoji: segEmoji,
        words: [...currentWords]
      });
      currentWords = [formattedWordObj];
    } else {
      currentWords.push(formattedWordObj);
    }
  }

  // Flush remaining words
  if (currentWords.length > 0) {
    const segStart = currentWords[0].start;
    const segEnd = currentWords[currentWords.length - 1].end;
    const segText = currentWords.map(w => w.word.trim()).join(' ');
    const segEmoji = currentWords.find(w => w.emoji)?.emoji || null;

    segments.push({
      id: `seg-${Math.random().toString(36).slice(2, 9)}`,
      start: Math.round(segStart * 1000) / 1000,
      end: Math.round(segEnd * 1000) / 1000,
      text: segText,
      emoji: segEmoji,
      words: [...currentWords]
    });
  }

  return segments;
}

/**
 * Strips all punctuation from an existing array of segments in-place.
 *
 * @param {Array} segments
 * @returns {Array} Cleaned segments
 */
export function stripPunctuationFromSegments(segments = []) {
  if (!Array.isArray(segments)) return [];
  return segments.map((seg) => {
    const cleanedWords = (seg.words || []).map((w) => ({
      ...w,
      word: stripPunctuation(w.word)
    })).filter(w => w.word.length > 0);

    const cleanedText = cleanedWords.length > 0
      ? cleanedWords.map(w => w.word).join(' ')
      : stripPunctuation(seg.text);

    return {
      ...seg,
      text: cleanedText,
      words: cleanedWords
    };
  });
}
