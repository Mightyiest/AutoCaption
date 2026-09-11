/**
 * AI Semantic Emoji & Kinetic Sticker Engine
 * Maps spoken keywords, topics, sentiments, and hooks to high-impact emojis/stickers.
 */

export const EMOJI_DICTIONARY = {
  // Viral Reactions & Emotions
  fire: '🔥', lit: '🔥', burn: '🔥', flame: '🔥', hot: '🔥', blazing: '🔥',
  mindblown: '🤯', crazy: '🤯', insane: '🤯', unbelievable: '🤯', shock: '🤯', shocking: '🤯',
  dead: '💀', skull: '💀', dying: '💀', lol: '😂', haha: '😂', funny: '🤣', hilarious: '🤣', laugh: '😂',
  love: '❤️', heart: '❤️', romantic: '😍', loved: '❤️', favorite: '❤️', best: '❤️', obsessed: '😍',
  scared: '😱', omg: '😱', wow: '😲', amazed: '😲', excited: '🤩', hyped: '🤩', hype: '⚡',
  cool: '😎', boss: '😎', badass: '😎', vibe: '✨', vibes: '✨', magic: '✨', magical: '✨',
  strong: '💪', gym: '🏋️‍♂️', workout: '💪', power: '⚡', flex: '💪', energy: '⚡', beast: '🦍',
  angry: '😡', mad: '😡', hate: '🤬', sad: '😢', cry: '😭', crying: '😭', tear: '😢',
  clap: '👏', cheer: '🎉', celebrate: '🥳', party: '🎉', congrats: '🎉', victory: '✌️',
  peace: '✌️', salute: '🫡', respect: '🫡', trust: '🤝', partner: '🤝', deal: '🤝',

  // Finance, Wealth, Business & Numbers
  money: '💰', rich: '💰', cash: '💵', dollar: '💵', dollars: '💵', bucks: '💵',
  profit: '💸', wealth: '💰', luxury: '💎', expensive: '💎', diamond: '💎', valuable: '💎',
  revenue: '📈', growth: '📈', grow: '📈', income: '💳', price: '🏷️', cost: '💳', pay: '💳', paid: '💳',
  crypto: '🪙', bitcoin: '🪙', btc: '🪙', eth: '🪙', stocks: '📊', trade: '📊', investment: '📈', invest: '📈',
  hundred: '💯', thousand: '💎', million: '🤑', billion: '👑', bankrupt: '📉', loss: '📉', broke: '📉',
  business: '💼', sales: '📈', sell: '🏷️', buy: '🛍️', store: '🏪', market: '📊', client: '👔', customer: '👥',
  founder: '🚀', ceo: '👑', agency: '🏢', company: '🏢', career: '💼', job: '💼', work: '💼',

  // Audience, Social Media & Content Creation
  viral: '💥', views: '👀', post: '📲', share: '📤', subscribe: '🔔', follow: '👥', followers: '👥',
  audience: '👥', community: '🌐', comment: '💬', chat: '💬', like: '👍', likes: '👍', reels: '🎬',
  tiktok: '🎵', youtube: '▶️', shorts: '⚡', instagram: '📸', podcast: '🎙️', creator: '🎥', studio: '🎙️',
  stream: '📡', live: '🔴', video: '🎥', audio: '🎙️', content: '📱', algorithm: '🧠', trend: '📈',

  // Action, Hooks, Urgency & Strategy
  rocket: '🚀', launch: '🚀', fast: '⚡', speed: '⚡', turbo: '🚀', boost: '🚀', accelerate: '⚡',
  stop: '🛑', pause: '⏸️', warning: '⚠️', danger: '⚠️', alert: '🚨', mistake: '❌', error: '❌', wrong: '❌',
  target: '🎯', goal: '🎯', focus: '🎯', bullseye: '🎯', mission: '🎯', strategy: '🎯', tactic: '🎯',
  secret: '🔒', locked: '🔒', hack: '🔓', cheat: '🔓', key: '🔑', unlock: '🔑', revealed: '👁️',
  winner: '🏆', trophy: '🏆', win: '🥇', first: '🥇', champ: '👑', champion: '👑', king: '👑', queen: '👑',
  idea: '💡', think: '🧠', brain: '🧠', smart: '💡', genius: '💡', remember: '📌', note: '📝', tip: '💡', trick: '💡',
  time: '⏱️', clock: '⏰', watch: '⌚', hour: '⏱️', minute: '⏱️', second: '⏱️', late: '⏳', future: '🔮', past: '📜',
  question: '❓', why: '❓', how: '❓', what: '❓', search: '🔍', look: '👀', see: '👀', eye: '👁️', eyes: '👀',
  blueprint: '📐', formula: '🧪', system: '⚙️', method: '🛠️', step: '🪜', rule: '📜', guide: '🧭',

  // Tech, AI, Coding & Future
  ai: '🤖', robot: '🤖', bot: '🤖', code: '💻', coding: '💻', programmer: '👨‍💻', software: '💻', computer: '💻',
  laptop: '💻', developer: '👨‍💻', app: '📱', mobile: '📱', iphone: '📱', web: '🌐', website: '🌐', internet: '🌐',
  database: '💾', cloud: '☁️', server: '🖥️', tool: '🛠️', tools: '🛠️', automation: '⚡', prompt: '💬',

  // Daily Life, Food, Health, Travel
  coffee: '☕', tea: '🍵', drink: '🥤', water: '💧', food: '🍔', pizza: '🍕', burger: '🍔', eat: '🍽️', snack: '🍿',
  car: '🏎️', drive: '🚗', plane: '✈️', travel: '✈️', trip: '🧳', world: '🌍', global: '🌐', earth: '🌍',
  house: '🏠', home: '🏡', realestate: '🏢', building: '🏢', city: '🏙️', sleep: '😴', wake: '⏰', morning: '☀️',
  night: '🌙', game: '🎮', gaming: '🎮', play: '🕹️', book: '📚', read: '📖', study: '📚', learn: '🧠', tutorial: '🎓'
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
 * Fallback engaging viral emojis for contextual segment assignment.
 */
export const VIRAL_ROTATION_EMOJIS = ['🔥', '💡', '🚀', '⚡', '👀', '🎯', '✨', '💰', '🤯', '👑'];

/**
 * Cleans a token string to pure alphanumeric lowercase.
 */
export function cleanToken(text = '') {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Generates stemming candidates for word matching (plurals, verb tenses, etc.)
 */
export function getStemmedCandidates(wordText = '') {
  const clean = cleanToken(wordText);
  if (!clean) return [];
  const candidates = [clean];

  // Plurals and suffixes: 'ies', 'es', 's'
  if (clean.endsWith('ies') && clean.length > 4) {
    candidates.push(clean.slice(0, -3) + 'y'); // strategies -> strategy
  } else if (clean.endsWith('es') && clean.length > 3) {
    candidates.push(clean.slice(0, -2)); // watches -> watch
  } else if (clean.endsWith('s') && clean.length > 3) {
    candidates.push(clean.slice(0, -1)); // tricks -> trick, followers -> follower
  }

  // Verb forms: 'ing', 'ed', 'er'
  if (clean.endsWith('ing') && clean.length > 4) {
    candidates.push(clean.slice(0, -3)); // growing -> grow, learning -> learn
    if (clean.length > 5 && clean[clean.length - 4] === clean[clean.length - 5]) {
      candidates.push(clean.slice(0, -4)); // winning -> win, stopping -> stop
    }
  } else if (clean.endsWith('ed') && clean.length > 4) {
    candidates.push(clean.slice(0, -2)); // worked -> work
    candidates.push(clean.slice(0, -1)); // saved -> save
  } else if (clean.endsWith('er') && clean.length > 4) {
    candidates.push(clean.slice(0, -2)); // winner -> win
  }

  return candidates;
}

/**
 * Detects an emoji match for a single word token, prioritizing custom user rules,
 * then direct vocabulary match, then stemmed candidates.
 *
 * @param {string} wordText
 * @param {Object} [customDictionary={}] - User custom keyword-to-emoji mapping
 * @returns {string|null} Matching emoji or null
 */
export function detectEmojiForWord(wordText = '', customDictionary = {}) {
  const candidates = getStemmedCandidates(wordText);
  if (candidates.length === 0) return null;

  // 1. Check user custom keyword rules first
  if (customDictionary && typeof customDictionary === 'object') {
    for (const cand of candidates) {
      if (customDictionary[cand] !== undefined && customDictionary[cand]) {
        return customDictionary[cand];
      }
    }
  }

  // 2. Fallback to built-in semantic dictionary with stemming
  for (const cand of candidates) {
    if (EMOJI_DICTIONARY[cand]) {
      return EMOJI_DICTIONARY[cand];
    }
  }

  return null;
}

/**
 * Intelligently analyzes an entire segment text to find the best viral hook emoji.
 *
 * @param {string} segmentText
 * @param {number} [segmentIndex=0]
 * @returns {string}
 */
export function getContextualEmojiForSegment(segmentText = '', segmentIndex = 0) {
  const raw = String(segmentText || '').trim();
  const lower = raw.toLowerCase();

  // 1. Check question marks or interrogatives
  if (raw.includes('?') || /^(why|how|what|where|who|when|can you|did you)\b/i.test(lower)) {
    return '❓';
  }

  // 2. Check exclamation marks / high excitement
  if (raw.includes('!') || /^(wow|omg|no way|listen|look|wait|stop)\b/i.test(lower)) {
    return '🔥';
  }

  // 3. Numbers, metrics, money
  if (/(\$\d+|\d+\%|\d+x|\bmillion\b|\bbillion\b|\bmoney\b|\bcash\b)/i.test(lower)) {
    return '💰';
  }

  // 4. Secret / hook directives
  if (/(secret|hack|cheat|mistake|warning|danger|never|always)/i.test(lower)) {
    return '🔒';
  }

  // 5. Growth / future / rocket
  if (/(grow|scale|fast|speed|launch|future|win|winner)/i.test(lower)) {
    return '🚀';
  }

  // 6. Balanced viral rotation based on segment position
  return VIRAL_ROTATION_EMOJIS[segmentIndex % VIRAL_ROTATION_EMOJIS.length];
}

/**
 * Automatically scans segments and attaches semantic emojis to words & segments.
 *
 * @param {Array} segments - Caption segments
 * @param {Object} options - Configuration options
 * @param {boolean} [options.overwrite=false] - Whether to overwrite existing user emojis
 * @param {Object} [options.customDictionary={}] - Custom keyword dictionary
 * @returns {Array} Updated segments
 */
export function autoAssignEmojis(segments = [], options = {}) {
  if (!Array.isArray(segments)) return [];
  const overwrite = Boolean(options.overwrite);
  const customDictionary = options.customDictionary || {};

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
      const detected = detectEmojiForWord(wordStr, customDictionary);
      if (detected) {
        if (!segmentEmoji || !foundNewSegEmoji) {
          segmentEmoji = detected;
          foundNewSegEmoji = true;
        }
        return { ...w, emoji: detected };
      }

      return overwrite ? { ...w, emoji: null } : w;
    });

    // If no word-level emoji matched in this segment, assign an intelligent contextual emoji!
    if (!segmentEmoji) {
      segmentEmoji = getContextualEmojiForSegment(seg.text || '', sIdx);
      // Also attach this emoji to the first or central word of the segment so word-level animations display it
      if (wordsWithEmojis.length > 0) {
        const midIdx = Math.floor(wordsWithEmojis.length / 2);
        wordsWithEmojis[midIdx] = {
          ...wordsWithEmojis[midIdx],
          emoji: segmentEmoji
        };
      }
    }

    return {
      ...seg,
      emoji: segmentEmoji,
      words: wordsWithEmojis
    };
  });
}
