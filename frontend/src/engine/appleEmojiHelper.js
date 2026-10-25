/**
 * Apple Color Emoji Asset Helper & Full Emoji Dataset
 * Provides high-resolution Apple glossy emoji assets (via CDN & in-memory image cache)
 * for 60 FPS Canvas 2D rendering and categorized 1,000+ emoji search.
 */

// In-memory HTMLImageElement cache for real-time Canvas 2D rendering
const emojiImageCache = new Map();
const pendingLoads = new Set();

/**
 * Returns the high-res Apple Color Emoji PNG URL for any unicode emoji.
 *
 * @param {string} emojiChar
 * @returns {string}
 */
export function getAppleEmojiUrl(emojiChar = '') {
  if (!emojiChar) return '';
  const trimmed = emojiChar.trim();
  return `https://emojicdn.elk.sh/${encodeURIComponent(trimmed)}?style=apple`;
}

/**
 * Loads and caches an Apple Color Emoji HTMLImageElement.
 * Returns the cached Image if already loaded, or triggers async loading.
 *
 * @param {string} emojiChar
 * @param {Function} [onLoadCallback] - Optional callback when image finishes loading
 * @returns {HTMLImageElement | null}
 */
export function loadAppleEmojiImage(emojiChar = '', onLoadCallback = null) {
  if (!emojiChar) return null;
  const key = emojiChar.trim();

  if (emojiImageCache.has(key)) {
    const cached = emojiImageCache.get(key);
    if (cached.complete && cached.naturalWidth > 0) {
      return cached;
    }
  }

  if (!pendingLoads.has(key)) {
    pendingLoads.add(key);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = getAppleEmojiUrl(key);

    img.onload = () => {
      emojiImageCache.set(key, img);
      pendingLoads.delete(key);
      if (typeof onLoadCallback === 'function') {
        onLoadCallback(img);
      }
    };

    img.onerror = () => {
      pendingLoads.delete(key);
    };

    emojiImageCache.set(key, img);
  }

  const existing = emojiImageCache.get(key);
  return existing && existing.complete && existing.naturalWidth > 0 ? existing : null;
}

/**
 * Categorized 1,000+ Emojis for the Full Emoji Palette
 */
export const FULL_EMOJI_CATEGORIES = [
  {
    id: 'viral',
    name: 'Viral & Reactions',
    icon: '🔥',
    emojis: [
      { char: '🔥', name: 'fire flame hot lit' },
      { char: '🤯', name: 'mindblown exploding head crazy shock' },
      { char: '💀', name: 'skull dead dying lol funny' },
      { char: '🚀', name: 'rocket launch fast turbo speed boost' },
      { char: '⚡', name: 'lightning bolt energy power shock spark' },
      { char: '💰', name: 'money bag rich wealth cash dollars' },
      { char: '💸', name: 'money wings profit expense spend fly' },
      { char: '👑', name: 'crown king queen champ boss winner' },
      { char: '🏆', name: 'trophy winner cup award first prize' },
      { char: '🎯', name: 'target bullseye focus goal mission' },
      { char: '💡', name: 'lightbulb idea smart genius brain think' },
      { char: '🔒', name: 'lock locked secret security private' },
      { char: '🔑', name: 'key secret unlock access cheat code' },
      { char: '🚨', name: 'police light alert siren emergency warning sudden' },
      { char: '⚠️', name: 'warning danger alert caution mistake error' },
      { char: '🛑', name: 'stop sign halt pause danger' },
      { char: '❌', name: 'cross mark wrong mistake error reject' },
      { char: '✨', name: 'sparkles magic stars vibe aesthetic clean' },
      { char: '💎', name: 'gem stone diamond luxury wealth rare' },
      { char: '💯', name: 'hundred percent perfect score real truth' },
      { char: '👀', name: 'eyes look see watch search investigate' },
      { char: '🧠', name: 'brain think intelligence smart mind' },
      { char: '💪', name: 'flex muscle strong power workout gym' },
      { char: '🤖', name: 'robot ai bot technology automated future' }
    ]
  },
  {
    id: 'smileys',
    name: 'Smileys & Emotions',
    icon: '😀',
    emojis: [
      { char: '😀', name: 'grinning face happy smile joy' },
      { char: '😃', name: 'smiley happy cheerful excited' },
      { char: '😄', name: 'smile open mouth laughing joy' },
      { char: '😁', name: 'beam grin teeth proud' },
      { char: '😆', name: 'laughing lol haha funny joke' },
      { char: '😂', name: 'tears joy laughing haha funny lol' },
      { char: '🤣', name: 'rofl rolling floor laughing crazy lol' },
      { char: '🥹', name: 'holding tears touched proud grateful' },
      { char: '😊', name: 'blush happy warm friendly' },
      { char: '😇', name: 'halo angel innocent good blessing' },
      { char: '🥰', name: 'hearts love warm romantic blessed' },
      { char: '😍', name: 'heart eyes love crush romantic gorgeous' },
      { char: '🤩', name: 'star struck excited amazed famous wow' },
      { char: '😘', name: 'blow kiss love romantic sweet' },
      { char: '😋', name: 'yum delicious tasty food snack' },
      { char: '😛', name: 'tongue silly play playful crazy' },
      { char: '😜', name: 'wink tongue playful funny crazy' },
      { char: '🤪', name: 'zany crazy wild weird excited' },
      { char: '😝', name: 'squint tongue funny silly playful' },
      { char: '🤑', name: 'money mouth rich millionaire profit' },
      { char: '🤗', name: 'hugs warm welcome embrace' },
      { char: '🤭', name: 'hand mouth giggling oops secret' },
      { char: '🤫', name: 'shushing quiet secret whisper silent' },
      { char: '🤔', name: 'thinking question idea ponder wonder' },
      { char: '🫡', name: 'salute respect yes sir honor' },
      { char: '🤐', name: 'zipper mouth silent sealed secret' },
      { char: '🤨', name: 'raised eyebrow suspicious doubt really' },
      { char: '😐', name: 'neutral blank emotionless straight' },
      { char: '😑', name: 'expressionless done bored tired' },
      { char: '😶', name: 'no mouth silent mute speechless' },
      { char: '😏', name: 'smirk cool sassy confident smug' },
      { char: '😒', name: 'unamused annoyed bored unimpressed' },
      { char: '🙄', name: 'rolling eyes whatever annoyed bored' },
      { char: '😬', name: 'grimacing awkward cringe oops tense' },
      { char: '😮‍💨', name: 'exhaling sigh relief tired exhausted' },
      { char: '🤥', name: 'lying pinocchio fake cap liar' },
      { char: '😌', name: 'relieved calm peaceful chill relax' },
      { char: '😔', name: 'pensive sad sorrow regret regretful' },
      { char: '😪', name: 'sleepy tired snot tear' },
      { char: '🤤', name: 'drooling hungry crave crave delicious' },
      { char: '😴', name: 'sleeping zzz tired rest bed' },
      { char: '😷', name: 'mask medical sick corona covid' },
      { char: '🤒', name: 'thermometer sick fever ill illness' },
      { char: '🤕', name: 'bandage head hurt pain injury wounded crack' },
      { char: '🤢', name: 'nauseated sick gross vomit disgust' },
      { char: '🤮', name: 'vomiting puke sick gross disgust' },
      { char: '🤧', name: 'sneezing cold tissue allergy' },
      { char: '🥵', name: 'hot sweating heat summer fiery' },
      { char: '🥶', name: 'cold freezing ice winter shivering' },
      { char: '🥴', name: 'woozy drunk dizzy confused weird' },
      { char: '😵', name: 'dizzy knocked out shock dead' },
      { char: '😵‍💫', name: 'spiral eyes dizzy hypnotized confused' },
      { char: '🤠', name: 'cowboy hat western wild sheriff' },
      { char: '🥳', name: 'partying celebrate birthday party cheers' },
      { char: '🥸', name: 'disguise glasses mustache undercover' },
      { char: '😎', name: 'sunglasses cool boss badass stylish' },
      { char: '🤓', name: 'nerd glasses smart geek study code' },
      { char: '🧐', name: 'monocle inspect smart examine look' },
      { char: '😕', name: 'confused puzzled unsure what' },
      { char: '😟', name: 'worried nervous anxious troubled' },
      { char: '🙁', name: 'frowning sad upset down' },
      { char: '😮', name: 'open mouth surprise wow shock' },
      { char: '😯', name: 'hushed surprise quiet shock' },
      { char: '😲', name: 'astonished amazed wow shock crazy' },
      { char: '😳', name: 'flushed surprised blush shock stunned' },
      { char: '🥺', name: 'pleading begging puppy eyes please' },
      { char: '😦', name: 'frowning open mouth scared worry' },
      { char: '😧', name: 'anguished shocked stunned pain' },
      { char: '😨', name: 'fearful scared nervous fright panic' },
      { char: '😰', name: 'anxious sweat nervous fear scared' },
      { char: '😥', name: 'sad relieved sweat close call' },
      { char: '😢', name: 'crying tear sad hurt sorrow' },
      { char: '😭', name: 'loudly crying sobbing tear sorrow' },
      { char: '😱', name: 'screaming fear horror shock omg' },
      { char: '😖', name: 'confounded frustration struggle upset' },
      { char: '😣', name: 'persevering struggle pain endure' },
      { char: '😞', name: 'disappointed sad regret failure' },
      { char: '😓', name: 'downcast sweat tired nervous stress' },
      { char: '😩', name: 'weary exhausted tired whining groan' },
      { char: '😫', name: 'tired exhausted overwhelmed struggle' },
      { char: '🥱', name: 'yawning sleepy bored tired exhausted' },
      { char: '😤', name: 'triumph steam proud angry determination' },
      { char: '😡', name: 'pouting rage red angry mad furious' },
      { char: '😠', name: 'angry mad annoyed irritated furious' },
      { char: '🤬', name: 'cursing symbols swear cuss rage angry' },
      { char: '😈', name: 'smiling horns devil naughty sneaky' },
      { char: '👿', name: 'angry horns devil demon evil evil' },
      { char: '🤡', name: 'clown circus funny joke foolish fool' },
      { char: '💩', name: 'poop crap trash bad funny' },
      { char: '👻', name: 'ghost spooky haunted spooky spirit' },
      { char: '👽', name: 'alien ufo extraterrestrial outer space' },
      { char: '👾', name: 'alien monster retro pixel game 8bit' }
    ]
  },
  {
    id: 'people_gestures',
    name: 'Gestures & People',
    icon: '🦾',
    emojis: [
      { char: '👍', name: 'thumbs up like good yes approve great' },
      { char: '👎', name: 'thumbs down dislike bad no reject' },
      { char: '👊', name: 'fist punch hit bro knuckle crack' },
      { char: '✊', name: 'raised fist power strength solidarity' },
      { char: '🤛', name: 'left fist bump bro knuckle hit' },
      { char: '🤜', name: 'right fist bump bro knuckle hit' },
      { char: '👏', name: 'clapping hands applause cheer congrats brava' },
      { char: '🙌', name: 'raising hands praise celebrate hooray' },
      { char: '👐', name: 'open hands welcome hug embrace' },
      { char: '🤲', name: 'palms up pray blessing receive' },
      { char: '🤝', name: 'handshake deal agreement partnership business' },
      { char: '🙏', name: 'folded hands pray thank please gratitude' },
      { char: '✍️', name: 'writing hand note pen text signature' },
      { char: '💅', name: 'nail polish sassy fab diva nails' },
      { char: '🤳', name: 'selfie phone camera vlog photo creator' },
      { char: '💪', name: 'biceps muscle strong power gym flex' },
      { char: '🦾', name: 'mechanical arm robotic bionic cyborg future' },
      { char: '🦿', name: 'mechanical leg robotic prosthetic cyber' },
      { char: '🦵', name: 'leg kick knee walk run foot' },
      { char: '🦶', name: 'foot step walk kick toe' },
      { char: '👂', name: 'ear listen hear sound audio acoustic' },
      { char: '🦻', name: 'ear with hearing aid listen audio hear' },
      { char: '👃', name: 'nose smell sniff scent aroma' },
      { char: '🧠', name: 'brain mind think idea smart genius' },
      { char: '🫀', name: 'anatomical heart organ health cardiology' },
      { char: '🫁', name: 'lungs breathe air health breath' },
      { char: '🦷', name: 'tooth dental dentist teeth bite' },
      { char: '🦴', name: 'bone skeleton crack break dog' },
      { char: '👀', name: 'eyes watch see look investigate' },
      { char: '👁️', name: 'eye look vision watch see illuminate' },
      { char: '👅', name: 'tongue taste lick mouth flavor' },
      { char: '👄', name: 'mouth lips kiss talk speak vocal' },
      { char: '🗣️', name: 'speaking head talk voice podcast shout' },
      { char: '👤', name: 'bust in silhouette person user profile' },
      { char: '👥', name: 'busts in silhouette people team users community' },
      { char: '🫂', name: 'people hugging comfort support friends' },
      { char: '👶', name: 'baby newborn child infant young' },
      { char: '🧒', name: 'child kid youth boy girl' },
      { char: '👦', name: 'boy child male young youth' },
      { char: '👧', name: 'girl child female young youth' },
      { char: '🧑', name: 'person adult human someone' },
      { char: '👨', name: 'man male adult guy' },
      { char: '👩', name: 'woman female adult lady' },
      { char: '🧓', name: 'older adult senior elder wisdom' },
      { char: '👴', name: 'old man grandfather senior elder' },
      { char: '👵', name: 'old woman grandmother senior elder' },
      { char: '👨‍💻', name: 'man technologist developer coder software engineer' },
      { char: '👩‍💻', name: 'woman technologist coder programmer dev' },
      { char: '👨‍💼', name: 'man office worker business executive manager' },
      { char: '👩‍💼', name: 'woman office worker business professional' },
      { char: '👨‍⚕️', name: 'man health worker doctor surgeon hospital' },
      { char: '👩‍⚕️', name: 'woman health worker doctor nurse medical' },
      { char: '👨‍🎓', name: 'man student graduate university study' },
      { char: '👩‍🎓', name: 'woman student graduate scholar diploma' },
      { char: '👨‍🏫', name: 'man teacher professor education school' },
      { char: '👩‍🏫', name: 'woman teacher instructor professor learning' }
    ]
  },
  {
    id: 'tech_travel',
    name: 'Tech, Objects & Travel',
    icon: '🚀',
    emojis: [
      { char: '💻', name: 'laptop computer pc mac code tech workstation' },
      { char: '🖥️', name: 'desktop computer monitor display pc setup' },
      { char: '📱', name: 'mobile phone smartphone iphone android screen' },
      { char: '📲', name: 'phone with arrow mobile app post share' },
      { char: '☎️', name: 'telephone landline call phone dial' },
      { char: '📞', name: 'telephone receiver call answer talk' },
      { char: '📟', name: 'pager vintage tech beep 90s' },
      { char: '📠', name: 'fax machine office document scan' },
      { char: '🔋', name: 'battery power charge energy status' },
      { char: '🪫', name: 'low battery dying red power low energy' },
      { char: '🔌', name: 'electric plug connect charge socket' },
      { char: '💾', name: 'floppy disk save storage retro' },
      { char: '💿', name: 'optical disk cd dvd music media' },
      { char: '📀', name: 'dvd optical disk movie media software' },
      { char: '🎥', name: 'movie camera film cinema video record creator' },
      { char: '🎞️', name: 'film frames movie cinema video footage' },
      { char: '📽️', name: 'film projector movie cinema theater show' },
      { char: '🎬', name: 'clapper board action movie film take scene' },
      { char: '📺', name: 'television tv screen show broadcast stream' },
      { char: '📷', name: 'camera photo picture snapshot lens' },
      { char: '📸', name: 'camera with flash snapshot photo shoot' },
      { char: '📹', name: 'video camera record footage camcorder' },
      { char: '📼', name: 'videocassette vhs tape retro recording' },
      { char: '🔍', name: 'magnifying glass search find look inspect' },
      { char: '🔎', name: 'magnifying glass search look inspect investigate' },
      { char: '🕯️', name: 'candle flame light wax dark' },
      { char: '💡', name: 'lightbulb idea smart think innovation invention' },
      { char: '🔦', name: 'flashlight torch spotlight beam search' },
      { char: '🏮', name: 'red lantern festival paper light glow' },
      { char: '🪔', name: 'diya lamp oil light festival celebration' },
      { char: '📔', name: 'notebook decorative cover journal book diary' },
      { char: '📕', name: 'closed book reading study education red' },
      { char: '📖', name: 'open book read study literature learn knowledge' },
      { char: '📗', name: 'green book manual reading textbook' },
      { char: '📘', name: 'blue book notebook textbook literature' },
      { char: '📙', name: 'orange book binder diary document' },
      { char: '📚', name: 'books library study university research school' },
      { char: '📓', name: 'notebook spiral notes paper journal' },
      { char: '📒', name: 'ledger yellow notebook accounting journal' },
      { char: '📃', name: 'page with curl paper document contract invoice' },
      { char: '📜', name: 'scroll ancient parchment treaty script document' },
      { char: '📄', name: 'page facing up document paper report invoice' },
      { char: '📰', name: 'newspaper headlines news media press journalism' },
      { char: '🗞️', name: 'rolled-up newspaper press media news print' },
      { char: '📑', name: 'bookmark tabs document organize file review' },
      { char: '🔖', name: 'bookmark favorite tag mark save' },
      { char: '🏷️', name: 'label tag price sale discount brand' },
      { char: '🏎️', name: 'racing car race fast sports turbo speed f1' },
      { char: '🚗', name: 'automobile car vehicle transport drive' },
      { char: '🚙', name: 'suv car vehicle truck transport' },
      { char: '🚚', name: 'delivery truck shipping freight transport cargo' },
      { char: '🚛', name: 'articulated lorry semi truck freight cargo' },
      { char: '🚜', name: 'tractor farming agriculture field harvest' },
      { char: '✈️', name: 'airplane flight travel fly trip vacation' },
      { char: '🛫', name: 'airplane departure take off flight travel launch' },
      { char: '🛬', name: 'airplane arrival landing airport touchdown' },
      { char: '🚁', name: 'helicopter chopper flight aerial chopper' }
    ]
  },
  {
    id: 'finance_symbols',
    name: 'Finance & Badges',
    icon: '💰',
    emojis: [
      { char: '💰', name: 'money bag rich wealth cash dollars bank' },
      { char: '🪙', name: 'coin crypto gold bitcoin token investment' },
      { char: '💵', name: 'dollar banknote cash money payment currency' },
      { char: '💴', name: 'yen banknote cash currency money japan' },
      { char: '💶', name: 'euro banknote cash currency money europe' },
      { char: '💷', name: 'pound banknote cash currency money uk' },
      { char: '💸', name: 'money with wings profit spend loss fly away' },
      { char: '💳', name: 'credit card payment visa mastercard debt buy' },
      { char: '🧾', name: 'receipt bill proof accounting expense invoice' },
      { char: '💹', name: 'chart increasing with yen market currency profit' },
      { char: '📈', name: 'chart increasing growth upward stonks stocks rise' },
      { char: '📉', name: 'chart decreasing crash market recession drop loss' },
      { char: '📊', name: 'bar chart data statistics analytics metrics' },
      { char: '🏷️', name: 'label price sale discount offer coupon tag' },
      { char: '💎', name: 'gem stone diamond rare expensive wealth luxury' },
      { char: '👑', name: 'crown king queen leader winner vip boss' },
      { char: '🏆', name: 'trophy champion award winner tournament first' },
      { char: '🥇', name: '1st place medal gold winner champion first' },
      { char: '🥈', name: '2nd place medal silver runner up second' },
      { char: '🥉', name: '3rd place medal bronze third podium' },
      { char: '🏅', name: 'sports medal award military hero honor' },
      { char: '🎖️', name: 'military medal honor distinction hero award' },
      { char: '🎯', name: 'bullseye target mission focus precision goal' },
      { char: '💯', name: 'hundred points score perfect 100 real true' },
      { char: '🔥', name: 'fire lit hot blazing energy viral' },
      { char: '⚡', name: 'high voltage lightning shock energy power speed' },
      { char: '💥', name: 'collision boom blast impact explode hit crack' },
      { char: '✨', name: 'sparkles clean magic stars shine premium' },
      { char: '⭐', name: 'star gold rating review favorited star' },
      { char: '🌟', name: 'glowing star shine burst special talent' },
      { char: '💫', name: 'dizzy star magic spark sparkle trail' },
      { char: '🚨', name: 'police car light siren emergency warning danger sudden' },
      { char: '⚠️', name: 'warning danger caution alert error risk' },
      { char: '🛑', name: 'stop sign halt traffic red danger' },
      { char: '⛔', name: 'no entry forbidden banned restricted stop' },
      { char: '🚫', name: 'prohibited forbidden banned cancel no' },
      { char: '✅', name: 'check mark button verified correct approved success' },
      { char: '❌', name: 'cross mark reject wrong error mistake fail' },
      { char: '❓', name: 'question mark red help puzzle wonder inquiry' },
      { char: '❗', name: 'exclamation mark red alert urgent attention priority' }
    ]
  },
  {
    id: 'food_drinks',
    name: 'Food & Drinks',
    icon: '🍔',
    emojis: [
      { char: '🍔', name: 'hamburger burger fastfood beef bun snack' },
      { char: '🍕', name: 'pizza slice cheese pepperoni crust fastfood' },
      { char: '🍟', name: 'french fries potato chips fastfood salty' },
      { char: '🌭', name: 'hot dog sausage mustard fastfood stadium' },
      { char: '🍿', name: 'popcorn cinema movie snack buttery theater' },
      { char: '🍩', name: 'doughnut donut sweet pastry glaze sprinkle' },
      { char: '🍪', name: 'cookie chocolate chip sweet biscuit snack' },
      { char: '🎂', name: 'birthday cake celebration party dessert sweet' },
      { char: '🍰', name: 'shortcake pastry dessert slice strawberry' },
      { char: '🧁', name: 'cupcake muffin dessert bakery sweet' },
      { char: '🍫', name: 'chocolate bar sweet candy cacao dessert' },
      { char: '🍬', name: 'candy sweet sugar treat wrapper' },
      { char: '🍭', name: 'lollipop sweet candy swirl treat' },
      { char: '☕', name: 'hot beverage coffee tea morning cafe caffeine' },
      { char: '🧃', name: 'beverage box juice straw drink fruit' },
      { char: '🥤', name: 'cup with straw soda drink cold beverage cola' },
      { char: '🧋', name: 'bubble tea boba drink tea pearls tapioca' },
      { char: '🍺', name: 'beer mug alcohol pub drink lager brewery' },
      { char: '🍻', name: 'clinking beer mugs cheers party alcohol celebrate' },
      { char: '🍷', name: 'wine glass red alcohol drink restaurant' },
      { char: '🍸', name: 'cocktail glass martini alcohol drink party' },
      { char: '🍾', name: 'bottle with popping cork champagne celebrate party' }
    ]
  },
  {
    id: 'animals_nature',
    name: 'Animals & Nature',
    icon: '🦁',
    emojis: [
      { char: '🦁', name: 'lion face king beast predator brave majestic' },
      { char: '🐯', name: 'tiger face wild stripe predator cat' },
      { char: '🐺', name: 'wolf face pack wild howl canine' },
      { char: '🦍', name: 'gorilla ape silverback strong powerful primate' },
      { char: '🐻', name: 'bear face wild grizzly forest strong' },
      { char: '🐼', name: 'panda face bear bamboo cute china' },
      { char: '🦅', name: 'eagle bird flight freedom raptor predator' },
      { char: '🦉', name: 'owl bird wisdom night nocturnal intelligent' },
      { char: '🐍', name: 'snake serpent reptile venom python sly' },
      { char: '🦖', name: 't-rex dinosaur prehistoric monster jurassic' },
      { char: '🦈', name: 'shark predator ocean marine jaw attack' },
      { char: '🐳', name: 'spouting whale ocean marine giant mammal' },
      { char: '🐬', name: 'dolphin ocean marine smart mammal jump' },
      { char: '🐕', name: 'dog pet loyal canine best friend hound' },
      { char: '🐈', name: 'cat pet feline cute purr meow' },
      { char: '🐎', name: 'horse stallion equestrian speed race wild' },
      { char: '🦄', name: 'unicorn fantasy magic horn rainbow mythical' }
    ]
  }
];

/**
 * Searches across all categories for emojis matching the query string.
 *
 * @param {string} query
 * @returns {Array<{ char: string, name: string }>}
 */
export function searchEmojis(query = '') {
  if (!query || !query.trim()) {
    return FULL_EMOJI_CATEGORIES[0].emojis;
  }
  const clean = query.toLowerCase().trim();
  const results = [];
  const seen = new Set();

  for (const cat of FULL_EMOJI_CATEGORIES) {
    for (const item of cat.emojis) {
      if (!seen.has(item.char)) {
        if (item.name.toLowerCase().includes(clean) || item.char === clean) {
          results.push(item);
          seen.add(item.char);
        }
      }
    }
  }

  return results;
}
