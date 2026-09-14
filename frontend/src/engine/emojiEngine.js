/**
 * AI Semantic Emoji & Kinetic Sticker Engine
 * Maps spoken keywords, topics, sentiments, and hooks to high-impact emojis/stickers.
 */

export const EMOJI_DICTIONARY = {
  // High-Impact Reactions & Emotions
  fire: '🔥', lit: '🔥', burn: '🔥', flame: '🔥', hot: '🔥', blazing: '🔥',
  mindblown: '🤯', crazy: '🤯', insane: '🤯', shock: '🤯', shocking: '🤯',
  dead: '💀', skull: '💀', dying: '💀', hilarious: '🤣', lol: '😂',
  love: '❤️', heart: '❤️', romantic: '😍', obsessed: '😍',
  scared: '😱', omg: '😱', wow: '😲', amazed: '😲', hyped: '🤩', hype: '⚡',
  cool: '😎', badass: '😎', vibe: '✨', magic: '✨',
  strong: '💪', gym: '🏋️‍♂️', workout: '💪', power: '⚡', flex: '💪', beast: '🦍',
  angry: '😡', mad: '😡', hate: '🤬', cry: '😭', crying: '😭',
  clap: '👏', cheer: '🎉', celebrate: '🥳', party: '🎉', congrats: '🎉', victory: '✌️',

  // Finance, Wealth & Business Hooks
  money: '💰', rich: '💰', cash: '💵', dollar: '💵', dollars: '💵', bucks: '💵',
  profit: '💸', wealth: '💰', luxury: '💎', diamond: '💎',
  revenue: '📈', crypto: '🪙', bitcoin: '🪙', btc: '🪙', eth: '🪙', stocks: '📊',
  hundred: '💯', million: '🤑', billion: '👑', bankrupt: '📉',
  business: '💼', sales: '📈', founder: '🚀', ceo: '👑',

  // Viral & Media Hooks
  viral: '💥', views: '👀', tiktok: '🎵', youtube: '▶️', shorts: '⚡',
  instagram: '📸', podcast: '🎙️', creator: '🎥', studio: '🎙️',

  // Action, Hooks, Urgency & Impact
  rocket: '🚀', launch: '🚀', speed: '⚡', turbo: '🚀', boost: '🚀',
  stop: '🛑', warning: '⚠️', danger: '⚠️', alert: '🚨', mistake: '❌', error: '❌',
  target: '🎯', bullseye: '🎯', mission: '🎯',
  secret: '🔒', locked: '🔒', hack: '🔓', cheat: '🔓', key: '🔑', unlock: '🔑',
  winner: '🏆', trophy: '🏆', champ: '👑', champion: '👑', king: '👑', queen: '👑',
  brain: '🧠', genius: '💡', blueprint: '📐', formula: '🧪',
  crash: '💥', boom: '💥', crack: '⚡', cracks: '⚡', pain: '🤕', sudden: '🚨',

  // Tech & Innovation
  ai: '🤖', robot: '🤖', bot: '🤖', coding: '💻', software: '💻', developer: '👨‍💻'
};

/**
 * Curated list of quick-pick emojis for manual editor assignment.
 */
export const QUICK_EMOJI_PICKER_LIST = [
  '🔥', '🤯', '💀', '🚀', '💰', '💸', '⚡', '💡',
  '👑', '🏆', '🎯', '🔒', '🔑', '⚠️', '🛑', '❤️',
  '😎', '💪', '🧠', '🤖', '💻', '📱', '🎥', '💯'
];

/**
 * Cleans a token string to pure alphanumeric lowercase.
 */
export function cleanToken(text = '') {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Generates comprehensive stemming candidates for word matching (plurals, suffixes, tenses)
 */
export function getStemmedCandidates(wordText = '') {
  const clean = cleanToken(wordText);
  if (!clean) return [];
  const candidates = [clean];

  // Suffixes: -ful (painful -> pain), -less (painless -> pain)
  if (clean.endsWith('ful') && clean.length > 4) {
    candidates.push(clean.slice(0, -3));
  } else if (clean.endsWith('less') && clean.length > 5) {
    candidates.push(clean.slice(0, -4));
  }

  // Suffixes: -ly (suddenly -> sudden, insanely -> insane)
  if (clean.endsWith('ly') && clean.length > 4) {
    candidates.push(clean.slice(0, -2));
  }

  // Suffixes: -ness (craziness -> crazy, suddenness -> sudden)
  if (clean.endsWith('ness') && clean.length > 5) {
    const root = clean.slice(0, -4);
    candidates.push(root);
    if (root.endsWith('i')) candidates.push(root.slice(0, -1) + 'y');
  }

  // Plurals and suffixes: 'ies', 'es', 's'
  if (clean.endsWith('ies') && clean.length > 4) {
    candidates.push(clean.slice(0, -3) + 'y'); // strategies -> strategy
  } else if (clean.endsWith('es') && clean.length > 3) {
    candidates.push(clean.slice(0, -2)); // watches -> watch
    candidates.push(clean.slice(0, -1)); // plates -> plate
  } else if (clean.endsWith('s') && clean.length > 3) {
    candidates.push(clean.slice(0, -1)); // cracks -> crack
  }

  // Verb forms: 'ing', 'ed', 'er'
  if (clean.endsWith('ing') && clean.length > 4) {
    candidates.push(clean.slice(0, -3)); // growing -> grow, cracking -> crack
    candidates.push(clean.slice(0, -3) + 'e'); // caring -> care
    if (clean.length > 5 && clean[clean.length - 4] === clean[clean.length - 5]) {
      candidates.push(clean.slice(0, -4)); // winning -> win, stopping -> stop
    }
  } else if (clean.endsWith('ed') && clean.length > 4) {
    candidates.push(clean.slice(0, -2)); // worked -> work, cracked -> crack
    candidates.push(clean.slice(0, -1)); // saved -> save
  } else if (clean.endsWith('er') && clean.length > 4) {
    candidates.push(clean.slice(0, -2)); // winner -> win
  }

  return candidates;
}

/**
 * Detects an emoji match for a single word token, prioritizing user Keyword Library rules,
 * then direct vocabulary match, then stemmed candidates.
 *
 * @param {string} wordText
 * @param {Object} [customDictionary={}] - User custom keyword-to-emoji mapping
 * @param {Object} [options={}] - Configuration options { onlyCustom: boolean }
 * @returns {string|null} Matching emoji or null
 */
export function detectEmojiForWord(wordText = '', customDictionary = {}, options = {}) {
  const onlyCustom = Boolean(options.onlyCustom);
  const candidates = getStemmedCandidates(wordText);
  if (candidates.length === 0) return null;

  // 1. High-priority check against user's custom Keyword Library
  if (customDictionary && typeof customDictionary === 'object' && Object.keys(customDictionary).length > 0) {
    // 1a. Direct candidate match in customDictionary
    for (const cand of candidates) {
      if (customDictionary[cand]) {
        return customDictionary[cand];
      }
    }

    // 1b. Prefix / root matching against custom rules
    // (e.g. rule "pain" matches "painful", rule "crack" matches "cracking", rule "cracks" matches "crack")
    const cleanWord = candidates[0];
    for (const [kw, emoji] of Object.entries(customDictionary)) {
      if (!emoji) continue;
      const cleanKw = cleanToken(kw);
      if (!cleanKw) continue;

      if (cleanWord === cleanKw) return emoji;

      // Word starts with keyword (e.g. keyword "pain" matches word "painful")
      if (cleanKw.length >= 3 && cleanWord.startsWith(cleanKw)) {
        return emoji;
      }
      // Keyword starts with word (e.g. keyword "cracks" matches word "crack")
      if (cleanWord.length >= 4 && cleanKw.startsWith(cleanWord)) {
        return emoji;
      }
    }
  }

  // If onlyCustom is requested (e.g. from Keyword Library "Apply to Captions"), do NOT fall back to generic emojis
  if (onlyCustom) {
    return null;
  }

  // 2. Fallback to curated high-impact semantic dictionary
  for (const cand of candidates) {
    if (EMOJI_DICTIONARY[cand]) {
      return EMOJI_DICTIONARY[cand];
    }
  }

  return null;
}

/**
 * Analyzes segment text for an explicit hook sentiment (e.g. questions, exclamations, money).
 *
 * @param {string} segmentText
 * @param {number} [segmentIndex=0]
 * @returns {string|null}
 */
export function getContextualEmojiForSegment(segmentText = '', segmentIndex = 0) {
  const raw = String(segmentText || '').trim();
  const lower = raw.toLowerCase();

  // 1. Check questions
  if (raw.includes('?') || /^(why|how|what|where|who|when|can you|did you)\b/i.test(lower)) {
    return '❓';
  }

  // 2. Check exclamation marks / high excitement
  if (raw.includes('!') || /^(wow|omg|no way|listen|look|wait|stop)\b/i.test(lower)) {
    return '🔥';
  }

  // 3. Numbers, currency, money
  if (/(\$\d+|\d+\%|\d+x|\bmillion\b|\bbillion\b|\bmoney\b|\bcash\b)/i.test(lower)) {
    return '💰';
  }

  // 4. Secret / warning directives
  if (/(secret|hack|cheat|warning|danger)/i.test(lower)) {
    return '🔒';
  }

  // 5. Growth / launch
  if (/(launch|rocket|turbo)/i.test(lower)) {
    return '🚀';
  }

  // No arbitrary rotating fallback: only return an emoji if there's a genuine hook
  return null;
}

/**
 * Automatically scans segments and attaches semantic emojis to words & segments.
 *
 * @param {Array} segments - Caption segments
 * @param {Object} options - Configuration options
 * @param {boolean} [options.overwrite=false] - Whether to overwrite existing user emojis
 * @param {Object} [options.customDictionary={}] - Custom keyword dictionary
 * @param {boolean} [options.onlyCustom=false] - When true, only apply matches from customDictionary
 * @returns {Array} Updated segments
 */
export function autoAssignEmojis(segments = [], options = {}) {
  if (!Array.isArray(segments)) return [];
  const overwrite = Boolean(options.overwrite);
  const customDictionary = options.customDictionary || {};
  const onlyCustom = Boolean(options.onlyCustom);

  return segments.map((seg, sIdx) => {
    let segmentEmoji = overwrite ? null : (seg.emoji || null);
    let foundNewSegEmoji = false;

    const wordsWithEmojis = (seg.words || []).map((w) => {
      const existingEmoji = w.emoji;
      if (existingEmoji && !overwrite) {
        if (!segmentEmoji) segmentEmoji = existingEmoji;
        return w;
      }

      const wordStr = String(w.word || w.text || '');
      const detected = detectEmojiForWord(wordStr, customDictionary, { onlyCustom });
      if (detected) {
        if (!segmentEmoji || !foundNewSegEmoji) {
          segmentEmoji = detected;
          foundNewSegEmoji = true;
        }
        return { ...w, emoji: detected };
      }

      return overwrite ? { ...w, emoji: null } : w;
    });

    // If segmentEmoji is not set, only assign contextual emoji if there is a real sentiment hook
    if (!segmentEmoji && !onlyCustom) {
      segmentEmoji = getContextualEmojiForSegment(seg.text || '', sIdx);
    }

    return {
      ...seg,
      emoji: segmentEmoji || null,
      words: wordsWithEmojis
    };
  });
}
