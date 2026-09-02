/**
 * AI Smart Keyword Emphasis Engine
 * Automatically detects hook/power words, emotional triggers, action commands,
 * and numerical metrics to highlight key moments in captions.
 */

export const POWER_KEYWORDS = new Set([
  // Hook & Urgency Words
  'never', 'always', 'secret', 'mistake', 'insane', 'massive', 'explosive',
  'guaranteed', 'free', 'urgent', 'destroy', 'hate', 'love', 'crazy',
  'worst', 'best', 'proven', 'warning', 'danger', 'stop', 'start',
  'watch', 'listen', 'remember', 'now', 'truth', 'exposed', 'shocking',
  'cheat', 'hack', 'hidden', 'critical', 'fatal', 'epic', 'legendary',
  'unbelievable', 'ultimate', 'instant', 'fast', 'quick', 'easy', 'simple',
  'only', 'first', 'last', 'dead', 'alive', 'died', 'killed', 'saved',

  // Action Verbs & Directives
  'click', 'buy', 'grab', 'discover', 'reveal', 'win', 'lose', 'drop',
  'boost', 'grow', 'scale', 'master', 'build', 'create', 'transform',
  'unlock', 'launch', 'smash', 'crush', 'dominate', 'quit', 'change',

  // Metrics & Quantifiers
  'million', 'billion', 'trillion', 'hundred', 'thousand', 'zero', 'percent',
  'double', 'triple', 'half', 'maximum', 'minimum', 'infinite', 'forever'
]);

/**
 * Checks if a word token qualifies as a power keyword, numerical metric, currency, or multiplier.
 *
 * @param {string} wordText
 * @param {Set|Array} [customKeywords] - Optional user custom keyword list/set
 * @returns {boolean}
 */
export function isPowerKeyword(wordText = '', customKeywords = null) {
  if (!wordText) return false;
  const raw = String(wordText).trim();
  const clean = raw.toLowerCase().replace(/[^a-z0-9$%]/g, '');

  if (!clean) return false;

  // 1. User custom power keywords
  if (customKeywords) {
    if (customKeywords instanceof Set) {
      if (customKeywords.has(clean)) return true;
    } else if (Array.isArray(customKeywords)) {
      if (customKeywords.some(k => String(k).toLowerCase().replace(/[^a-z0-9$%]/g, '') === clean)) return true;
    }
  }

  // 2. Direct power keyword dictionary match
  if (POWER_KEYWORDS.has(clean)) return true;

  // 3. Currency, numbers, and percentages ($100k, 50%, 10x, #1, 24/7, 100M)
  if (/^(\$?\d+[\d,.]*[kmb%x]?|\#\d+|\d+\/\d+)$/i.test(clean)) {
    return true;
  }

  // 4. ALL-CAPS words of 3+ letters in the original transcript (e.g. "DONT", "WARNING")
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
 * @returns {Array} Updated segments
 */
export function autoApplyEmphasis(segments = [], options = {}) {
  if (!Array.isArray(segments)) return [];
  const overwrite = Boolean(options.overwrite);
  const customKeywords = options.customKeywords || null;

  return segments.map((seg) => {
    const updatedWords = (seg.words || []).map((w) => {
      if (w.isEmphasized !== undefined && !overwrite) {
        return w;
      }
      const wordStr = String(w.word || w.text || '');
      return {
        ...w,
        isEmphasized: isPowerKeyword(wordStr, customKeywords)
      };
    });

    return {
      ...seg,
      words: updatedWords
    };
  });
}
