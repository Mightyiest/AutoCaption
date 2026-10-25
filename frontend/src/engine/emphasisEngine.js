/**
 * AI Smart Keyword Emphasis Engine
 * Automatically detects hook/power words, emotional triggers, action commands,
 * and numerical metrics to highlight key moments in captions.
 */

export const POWER_KEYWORDS = new Set([
  // Hook, Urgency & Attention Words
  'never', 'always', 'secret', 'mistake', 'insane', 'massive', 'explosive',
  'guaranteed', 'free', 'urgent', 'destroy', 'hate', 'love', 'crazy',
  'worst', 'best', 'proven', 'warning', 'danger', 'stop', 'start',
  'watch', 'listen', 'remember', 'now', 'today', 'truth', 'exposed', 'shocking',
  'cheat', 'hack', 'hidden', 'critical', 'fatal', 'epic', 'legendary',
  'unbelievable', 'ultimate', 'instant', 'fast', 'quick', 'easy', 'simple',
  'only', 'first', 'last', 'dead', 'alive', 'died', 'killed', 'saved',
  'viral', 'billion', 'million', 'trillion', 'hundred', 'thousand',
  'huge', 'big', 'wild', 'real', 'fake', 'proof', 'fact', 'trap',
  'fail', 'failure', 'succeed', 'success', 'rich', 'poor', 'broke',
  'winner', 'champion', 'king', 'queen', 'boss', 'beast', 'fire',
  'perfect', 'genius', 'smart', 'dumb', 'stupid', 'impossible', 'possible',

  // Action Verbs & Directives
  'click', 'buy', 'grab', 'discover', 'reveal', 'win', 'lose', 'drop',
  'boost', 'grow', 'scale', 'master', 'build', 'create', 'transform',
  'unlock', 'launch', 'smash', 'crush', 'dominate', 'quit', 'change',
  'avoid', 'learn', 'fix', 'step', 'rule', 'formula', 'blueprint', 'trick',
  'tip', 'method', 'system', 'strategy', 'secret', 'solution', 'problem',

  // Metrics, Multipliers & Currency
  'zero', 'percent', 'double', 'triple', 'half', 'maximum', 'minimum',
  'infinite', 'forever', 'profit', 'revenue', 'dollar', 'cash', 'money'
]);

// Common English stopwords to ignore when selecting fallback emphasis
const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also'
]);

/**
 * Cleans a token string to pure alphanumeric lowercase.
 */
function cleanKeywordToken(text = '') {
  return String(text || '').toLowerCase().replace(/[^a-z0-9$%]/g, '');
}

/**
 * Checks if a word token qualifies as a power keyword, numerical metric, currency, or multiplier.
 *
 * @param {string} wordText
 * @param {Set|Array} [customKeywords] - Optional user custom keyword list/set
 * @returns {boolean}
 */
export function isPowerKeyword(wordText = '', customKeywords = null, options = {}) {
  const onlyCustom = Boolean(options.onlyCustom);
  if (!wordText) return false;
  const raw = String(wordText).trim();
  const clean = cleanKeywordToken(raw);

  if (!clean) return false;

  // 1. User custom power keywords (top priority with smart prefix & root matching)
  if (customKeywords) {
    const list = customKeywords instanceof Set ? Array.from(customKeywords) : (Array.isArray(customKeywords) ? customKeywords : []);
    for (const k of list) {
      const cleanK = cleanKeywordToken(k);
      if (!cleanK) continue;
      if (clean === cleanK) return true;
      // Word starts with keyword (e.g. word "painful" starts with keyword "pain", "cracking" starts with "crack")
      if (cleanK.length >= 3 && clean.startsWith(cleanK)) return true;
      // Keyword starts with word (e.g. keyword "cracks" matches word "crack")
      if (clean.length >= 4 && cleanK.startsWith(clean)) return true;
    }
  }

  // If onlyCustom is requested (e.g. from Keyword Library "Apply to Captions"), do not fall back to generic keywords
  if (onlyCustom) return false;

  // 2. Direct power keyword dictionary match
  if (POWER_KEYWORDS.has(clean)) return true;

  // 3. Stemmed candidates (plurals/verb forms: secrets -> secret, tricks -> trick)
  if (clean.endsWith('s') && clean.length > 3 && POWER_KEYWORDS.has(clean.slice(0, -1))) {
    return true;
  }
  if (clean.endsWith('ing') && clean.length > 4 && POWER_KEYWORDS.has(clean.slice(0, -3))) {
    return true;
  }
  if (clean.endsWith('ed') && clean.length > 4 && POWER_KEYWORDS.has(clean.slice(0, -2))) {
    return true;
  }

  // 4. Currency, numbers, multipliers, and percentages ($100k, 50%, 10x, #1, 24/7, 100M)
  if (/^(\$?\d+[\d,.]*[kmb%x]?|\#\d+|\d+\/\d+)$/i.test(clean)) {
    return true;
  }

  // 5. ALL-CAPS words of 3+ letters in the original transcript (e.g. "DONT", "WARNING")
  if (raw.length >= 3 && raw === raw.toUpperCase() && /^[A-Z0-9!]+$/.test(raw)) {
    return true;
  }

  return false;
}

/**
 * Automatically applies keyword emphasis across all segments.
 *
 * @param {Array} segments - Array of caption segments
 * @param {Object} options - Configuration options
 * @param {boolean} [options.overwrite=false] - Whether to overwrite existing user emphasis choices
 * @param {Set|Array} [options.customKeywords] - Custom keyword list
 * @param {boolean} [options.onlyCustom=false] - When true, only apply emphasis to matched customKeywords
 * @returns {Array} Updated segments
 */
export function autoApplyEmphasis(segments = [], options = {}) {
  if (!Array.isArray(segments)) return [];
  const overwrite = Boolean(options.overwrite);
  const customKeywords = options.customKeywords || null;
  const onlyCustom = Boolean(options.onlyCustom);

  return segments.map((seg) => {
    let segmentHasEmphasis = false;

    let updatedWords = (seg.words || []).map((w) => {
      if (w.isEmphasized !== undefined && !overwrite) {
        if (w.isEmphasized) segmentHasEmphasis = true;
        return w;
      }
      const wordStr = String(w.word || w.text || '');
      const emph = isPowerKeyword(wordStr, customKeywords, { onlyCustom });
      if (emph) segmentHasEmphasis = true;
      return {
        ...w,
        isEmphasized: emph
      };
    });

    // If no word matched and NOT onlyCustom, smartly pick the highest-impact content word in the segment
    if (!onlyCustom && !segmentHasEmphasis && updatedWords.length > 0) {
      // Find candidate words excluding common stopwords
      let bestIdx = -1;
      let maxLen = 0;

      for (let i = 0; i < updatedWords.length; i++) {
        const wStr = String(updatedWords[i].word || updatedWords[i].text || '').toLowerCase().replace(/[^a-z]/g, '');
        if (!STOP_WORDS.has(wStr) && wStr.length > maxLen && wStr.length >= 4) {
          maxLen = wStr.length;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0 && bestIdx < updatedWords.length) {
        updatedWords = updatedWords.map((w, idx) => ({
          ...w,
          isEmphasized: idx === bestIdx ? true : Boolean(w.isEmphasized)
        }));
      }
    }

    return {
      ...seg,
      words: updatedWords
    };
  });
}
