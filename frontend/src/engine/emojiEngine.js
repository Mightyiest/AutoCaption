/**
 * AI Semantic Emoji & Kinetic Sticker Engine
 * Maps spoken keywords, topics, and sentiments to high-impact emojis/stickers.
 */

export const EMOJI_DICTIONARY = {
  // Viral Reactions & Emotions
  fire: '🔥', lit: '🔥', burn: '🔥', flame: '🔥', hot: '🔥', blazing: '🔥',
  mindblown: '🤯', crazy: '🤯', insane: '🤯', unbelievable: '🤯', shock: '🤯', shocking: '🤯',
  dead: '💀', skull: '💀', dying: '💀', lol: '😂', haha: '😂', funny: '🤣', hilarious: '🤣',
  love: '❤️', heart: '❤️', romantic: '😍', loved: '❤️', favorite: '❤️', best: '❤️',
  scared: '😱', omg: '😱', wow: '😲', amazed: '😲', excited: '🤩',
  cool: '😎', boss: '😎', badass: '😎', vibe: '✨', vibes: '✨', magic: '✨',
  strong: '💪', gym: '🏋️‍♂️', workout: '💪', power: '⚡', flex: '💪', energy: '⚡',
  angry: '😡', mad: '😡', hate: '🤬', sad: '😢', cry: '😭', crying: '😭',
  clap: '👏', cheer: '🎉', celebrate: '🥳', party: '🎉', congrats: '🎉',

  // Finance, Wealth, Business & Numbers
  money: '💰', rich: '💰', cash: '💵', dollar: '💵', dollars: '💵', bucks: '💵',
  profit: '💸', wealth: '💰', luxury: '💎', expensive: '💎', diamond: '💎',
  revenue: '📈', growth: '📈', grow: '📈', income: '💳', price: '🏷️', cost: '💳',
  crypto: '🪙', bitcoin: '🪙', btc: '🪙', eth: '🪙', stocks: '📊', trade: '📊', investment: '📈',
  hundred: '💯', thousand: '💎', million: '🤑', billion: '👑', bankrupt: '📉', loss: '📉',

  // Action, Hooks, Urgency & Strategy
  rocket: '🚀', launch: '🚀', fast: '⚡', speed: '⚡', turbo: '🚀', boost: '🚀',
  stop: '🛑', pause: '⏸️', warning: '⚠️', danger: '⚠️', alert: '🚨', mistake: '❌', error: '❌',
  target: '🎯', goal: '🎯', focus: '🎯', bullseye: '🎯', mission: '🎯',
  secret: '🔒', locked: '🔒', hack: '🔓', cheat: '🔓', key: '🔑', unlock: '🔑',
  winner: '🏆', trophy: '🏆', win: '🥇', first: '🥇', champ: '👑', king: '👑', queen: '👑',
  idea: '💡', think: '🧠', brain: '🧠', smart: '💡', genius: '💡', remember: '📌', note: '📝',
  time: '⏱️', clock: '⏰', watch: '⌚', hour: '⏱️', minute: '⏱️', late: '⏳', future: '🔮',
  question: '❓', why: '❓', how: '❓', what: '❓', search: '🔍', look: '👀', see: '👀',

  // Tech, Creators, Media & Objects
  ai: '🤖', robot: '🤖', bot: '🤖', code: '💻', computer: '💻', laptop: '💻', developer: '👨‍💻',
  phone: '📱', mobile: '📱', iphone: '📱', video: '🎥', camera: '📸', photo: '📸', film: '🎬',
  audio: '🎙️', mic: '🎙️', podcast: '🎙️', music: '🎵', sound: '🔊', voice: '🗣️', speak: '🗣️',
  youtube: '▶️', viral: '💥', views: '👀', post: '📲', share: '📤', subscribe: '🔔',
  car: '🏎️', drive: '🚗', plane: '✈️', travel: '✈️', trip: '🧳', world: '🌍', global: '🌐',
  house: '🏠', home: '🏡', realestate: '🏢', building: '🏢',
  food: '🍔', pizza: '🍕', coffee: '☕', drink: '🥤', eat: '🍽️', snack: '🍿',
  game: '🎮', gaming: '🎮', play: '🕹️', book: '📚', read: '📖', study: '📚'
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
 *
 * @param {string} text
 * @returns {string}
 */
export function cleanToken(text = '') {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Detects an emoji match for a single word token, prioritizing custom user rules.
 *
 * @param {string} wordText
 * @param {Object} [customDictionary={}] - User custom keyword-to-emoji mapping
 * @returns {string|null} Matching emoji or null
 */
export function detectEmojiForWord(wordText = '', customDictionary = {}) {
  const token = cleanToken(wordText);
  if (!token) return null;

  // 1. Check user custom keyword rules first
  if (customDictionary && typeof customDictionary === 'object') {
    if (customDictionary[token] !== undefined) {
      return customDictionary[token] || null;
    }
  }

  // 2. Fallback to built-in semantic dictionary
  return EMOJI_DICTIONARY[token] || null;
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

  return segments.map((seg) => {
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

    return {
      ...seg,
      emoji: segmentEmoji,
      words: wordsWithEmojis
    };
  });
}
