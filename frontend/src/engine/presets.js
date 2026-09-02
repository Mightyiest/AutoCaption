export const DEFAULT_STYLE = {
  fontFamily: 'Montserrat',
  fontSize: 34,
  fontWeight: '800',
  fontStyle: 'normal',           // 'normal' | 'italic'
  textTransform: 'uppercase',    // 'uppercase' | 'capitalize' | 'none'
  textAlign: 'center',           // 'center' | 'left' | 'right'
  wordSpacing: 8,                // 0px to 24px (gap between adjacent words)
  letterSpacing: -0.5,           // -3px to 12px character tracking
  lineHeight: 1.02,              // 0.85 to 2.0 leading multiplier
  containerWidthPercent: 90,     // 50% to 100% outer caption container width
  primaryColor: '#FFFFFF',
  activeColor: '#FFFFFF',

  // Stroke Outline
  strokeEnabled: true,
  strokeColor: '#000000',
  strokeWidth: 6,

  // Drop Shadow
  shadowEnabled: false,
  shadowColor: '#000000',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,

  // Outer Glow
  glowEnabled: false,
  glowColor: '#38BDF8',
  glowBlur: 0,

  // Background Pill / Box
  backgroundEnabled: false,
  backgroundColor: 'transparent',
  backgroundOpacity: 0,
  backgroundPadding: 0,
  backgroundPaddingX: 0,
  backgroundPaddingY: 0,
  borderRadius: 0,
  backgroundBorderEnabled: false,
  backgroundBorderWidth: 0,
  backgroundBorderColor: 'transparent',
  backgroundBlur: 0,

  positionX: 50,
  positionY: 74,
  animationType: 'none',
  maxWordsPerSegment: 3,

  // Auto-Emoji & Kinetic Stickers
  autoEmojiEnabled: true,
  emojiAnimation: 'pop',       // 'pop' | 'bounce' | 'float' | 'none'
  emojiPosition: 'above_word', // 'above_word' | 'inline' | 'top_center'
  emojiSize: 42,               // 20px to 80px

  // AI Smart Keyword Emphasis
  autoEmphasisEnabled: true,
  emphasisColor: '#00FF66',    // Neon punch accent color
  emphasisScale: 1.15,         // 1.0x to 1.35x font scale boost
  emphasisGlowEnabled: true,
  emphasisMode: 'active_only'  // 'active_only' | 'always'
};

export function sanitizeStyle(style = {}) {
  const s = style || {};
  return {
    ...DEFAULT_STYLE,
    ...s,
    fontFamily: String(s.fontFamily || DEFAULT_STYLE.fontFamily).trim(),
    fontSize: Math.max(12, Math.min(120, Number(s.fontSize ?? DEFAULT_STYLE.fontSize))),
    fontWeight: String(s.fontWeight || DEFAULT_STYLE.fontWeight),
    fontStyle: s.fontStyle === 'italic' ? 'italic' : 'normal',
    textTransform: ['uppercase', 'capitalize', 'none'].includes(String(s.textTransform || '').toLowerCase())
      ? String(s.textTransform).toLowerCase()
      : DEFAULT_STYLE.textTransform,
    textAlign: ['center', 'left', 'right'].includes(String(s.textAlign || '').toLowerCase())
      ? String(s.textAlign).toLowerCase()
      : DEFAULT_STYLE.textAlign,
    wordSpacing: Math.max(0, Math.min(40, Number(s.wordSpacing ?? DEFAULT_STYLE.wordSpacing))),
    letterSpacing: Math.max(-5, Math.min(20, Number(s.letterSpacing ?? DEFAULT_STYLE.letterSpacing))),
    lineHeight: Math.max(0.7, Math.min(3.0, Number(s.lineHeight ?? DEFAULT_STYLE.lineHeight))),
    containerWidthPercent: Math.max(40, Math.min(100, Number(s.containerWidthPercent ?? DEFAULT_STYLE.containerWidthPercent))),
    primaryColor: s.primaryColor || DEFAULT_STYLE.primaryColor,
    activeColor: s.activeColor || (s.primaryColor || DEFAULT_STYLE.activeColor),

    // Stroke
    strokeEnabled: s.strokeEnabled !== undefined ? Boolean(s.strokeEnabled) : (Number(s.strokeWidth ?? 6) > 0),
    strokeColor: s.strokeColor || DEFAULT_STYLE.strokeColor,
    strokeWidth: Math.max(0, Math.min(24, Number(s.strokeWidth ?? DEFAULT_STYLE.strokeWidth))),

    // Shadow
    shadowEnabled: s.shadowEnabled !== undefined ? Boolean(s.shadowEnabled) : (Number(s.shadowBlur ?? 0) > 0 && s.shadowColor !== 'transparent'),
    shadowColor: s.shadowColor || DEFAULT_STYLE.shadowColor,
    shadowBlur: Math.max(0, Math.min(40, Number(s.shadowBlur ?? DEFAULT_STYLE.shadowBlur))),
    shadowOffsetX: Number(s.shadowOffsetX ?? DEFAULT_STYLE.shadowOffsetX),
    shadowOffsetY: Number(s.shadowOffsetY ?? DEFAULT_STYLE.shadowOffsetY),

    // Glow
    glowEnabled: Boolean(s.glowEnabled),
    glowColor: s.glowColor || DEFAULT_STYLE.glowColor,
    glowBlur: Math.max(0, Math.min(50, Number(s.glowBlur ?? DEFAULT_STYLE.glowBlur))),

    // Background Pill Box
    backgroundEnabled: s.backgroundEnabled !== undefined ? Boolean(s.backgroundEnabled) : (Boolean(s.backgroundColor) && s.backgroundColor !== 'transparent'),
    backgroundColor: s.backgroundColor || DEFAULT_STYLE.backgroundColor,
    backgroundOpacity: Math.max(0, Math.min(100, Number(s.backgroundOpacity ?? DEFAULT_STYLE.backgroundOpacity))),
    backgroundPadding: Math.max(0, Math.min(50, Number(s.backgroundPadding ?? DEFAULT_STYLE.backgroundPadding))),
    backgroundPaddingX: Math.max(0, Math.min(60, Number(s.backgroundPaddingX ?? (s.backgroundPadding ?? DEFAULT_STYLE.backgroundPaddingX)))),
    backgroundPaddingY: Math.max(0, Math.min(40, Number(s.backgroundPaddingY ?? (s.backgroundPadding ?? DEFAULT_STYLE.backgroundPaddingY)))),
    borderRadius: Math.max(0, Math.min(999, Number(s.borderRadius ?? DEFAULT_STYLE.borderRadius))),
    backgroundBorderEnabled: Boolean(s.backgroundBorderEnabled),
    backgroundBorderWidth: Math.max(0, Math.min(12, Number(s.backgroundBorderWidth ?? DEFAULT_STYLE.backgroundBorderWidth))),
    backgroundBorderColor: s.backgroundBorderColor || DEFAULT_STYLE.backgroundBorderColor,
    backgroundBlur: Math.max(0, Math.min(30, Number(s.backgroundBlur ?? DEFAULT_STYLE.backgroundBlur))),

    positionX: Math.max(5, Math.min(95, Number(s.positionX ?? DEFAULT_STYLE.positionX))),
    positionY: Math.max(5, Math.min(95, Number(s.positionY ?? DEFAULT_STYLE.positionY))),
    animationType: s.animationType || DEFAULT_STYLE.animationType,
    maxWordsPerSegment: Math.max(1, Math.min(6, Number(s.maxWordsPerSegment ?? DEFAULT_STYLE.maxWordsPerSegment))),

    // Auto-Emoji & Kinetic Stickers
    autoEmojiEnabled: s.autoEmojiEnabled !== undefined ? Boolean(s.autoEmojiEnabled) : DEFAULT_STYLE.autoEmojiEnabled,
    emojiStyle: ['apple', 'system'].includes(String(s.emojiStyle || '').toLowerCase())
      ? String(s.emojiStyle).toLowerCase()
      : 'apple',
    emojiAnimation: ['pop', 'bounce', 'float', 'none'].includes(String(s.emojiAnimation || '').toLowerCase())
      ? String(s.emojiAnimation).toLowerCase()
      : DEFAULT_STYLE.emojiAnimation,
    emojiPosition: ['above_word', 'inline', 'top_center'].includes(String(s.emojiPosition || '').toLowerCase())
      ? String(s.emojiPosition).toLowerCase()
      : DEFAULT_STYLE.emojiPosition,
    emojiSize: Math.max(16, Math.min(96, Number(s.emojiSize ?? DEFAULT_STYLE.emojiSize))),

    // AI Smart Keyword Emphasis
    autoEmphasisEnabled: s.autoEmphasisEnabled !== undefined ? Boolean(s.autoEmphasisEnabled) : DEFAULT_STYLE.autoEmphasisEnabled,
    emphasisColor: s.emphasisColor || DEFAULT_STYLE.emphasisColor,
    emphasisScale: Math.max(1.0, Math.min(1.4, Number(s.emphasisScale ?? DEFAULT_STYLE.emphasisScale))),
    emphasisGlowEnabled: s.emphasisGlowEnabled !== undefined ? Boolean(s.emphasisGlowEnabled) : DEFAULT_STYLE.emphasisGlowEnabled,
    emphasisMode: ['active_only', 'always'].includes(String(s.emphasisMode || '').toLowerCase())
      ? String(s.emphasisMode).toLowerCase()
      : DEFAULT_STYLE.emphasisMode
  };
}

export const PRESETS = [
  {
    id: 'default',
    name: 'Default Clean',
    description: 'Clean white typography with solid black stroke outline, no animations or effects',
    badge: 'DEFAULT',
    style: sanitizeStyle({
      fontFamily: 'Montserrat',
      fontSize: 34,
      fontWeight: '800',
      fontStyle: 'normal',
      textTransform: 'uppercase',
      textAlign: 'center',
      wordSpacing: 8,
      letterSpacing: -0.5,
      lineHeight: 1.02,
      containerWidthPercent: 90,
      primaryColor: '#FFFFFF',
      activeColor: '#FFFFFF',
      strokeEnabled: true,
      strokeColor: '#000000',
      strokeWidth: 6,
      shadowEnabled: false,
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      glowEnabled: false,
      backgroundEnabled: false,
      backgroundColor: 'transparent',
      backgroundPadding: 0,
      borderRadius: 0,
      positionY: 74,
      positionX: 50,
      animationType: 'none',
      maxWordsPerSegment: 3
    })
  },
  {
    id: 'hormozi',
    name: 'Hormozi Impact',
    description: 'High-energy bold pop with yellow punch word highlight',
    badge: 'VIRAL',
    style: sanitizeStyle({
      fontFamily: 'Montserrat',
      fontSize: 34,
      fontWeight: '900',
      fontStyle: 'normal',
      textTransform: 'uppercase',
      textAlign: 'center',
      wordSpacing: 8,
      letterSpacing: -0.5,
      lineHeight: 1.02,
      containerWidthPercent: 90,
      primaryColor: '#FFFFFF',
      activeColor: '#FFE600',
      strokeColor: '#000000',
      strokeWidth: 6,
      shadowColor: '#000000',
      shadowBlur: 8,
      shadowOffsetX: 0,
      shadowOffsetY: 4,
      backgroundColor: 'transparent',
      backgroundPadding: 0,
      borderRadius: 0,
      positionY: 74,
      positionX: 50,
      animationType: 'pop',
      maxWordsPerSegment: 3
    })
  },
  {
    id: 'beast',
    name: 'MrBeast Explosive',
    description: 'Vibrant neon green bounce with heavy contrast',
    badge: 'POPULAR',
    style: sanitizeStyle({
      fontFamily: 'Russo One',
      fontSize: 36,
      fontWeight: '900',
      fontStyle: 'normal',
      textTransform: 'uppercase',
      textAlign: 'center',
      wordSpacing: 8,
      letterSpacing: -0.5,
      lineHeight: 1.02,
      containerWidthPercent: 90,
      primaryColor: '#FFFFFF',
      activeColor: '#00FF66',
      strokeColor: '#000000',
      strokeWidth: 7,
      shadowColor: '#000000',
      shadowBlur: 10,
      shadowOffsetX: 0,
      shadowOffsetY: 4,
      backgroundColor: 'transparent',
      backgroundPadding: 0,
      borderRadius: 0,
      positionY: 72,
      positionX: 50,
      animationType: 'bounce',
      maxWordsPerSegment: 3
    })
  },
  {
    id: 'neon',
    name: 'Neon Cyberpunk',
    description: 'Glowing cyan electric karaoke flow',
    badge: 'AESTHETIC',
    style: sanitizeStyle({
      fontFamily: 'Outfit',
      fontSize: 32,
      fontWeight: '800',
      fontStyle: 'normal',
      textTransform: 'uppercase',
      textAlign: 'center',
      wordSpacing: 8,
      letterSpacing: -0.5,
      lineHeight: 1.05,
      containerWidthPercent: 90,
      primaryColor: '#94A3B8',
      activeColor: '#00FFFF',
      strokeColor: '#020617',
      strokeWidth: 5,
      shadowColor: '#00FFFF',
      shadowBlur: 16,
      shadowOffsetX: 0,
      shadowOffsetY: 2,
      backgroundColor: 'transparent',
      backgroundPadding: 0,
      borderRadius: 0,
      positionY: 75,
      positionX: 50,
      animationType: 'glow',
      maxWordsPerSegment: 3
    })
  },
  {
    id: 'fire',
    name: 'Fire Red Hot',
    description: 'Blazing red energetic highlight with underline warmth',
    badge: 'TRENDING',
    style: sanitizeStyle({
      fontFamily: 'Bebas Neue',
      fontSize: 42,
      fontWeight: '900',
      fontStyle: 'normal',
      textTransform: 'uppercase',
      textAlign: 'center',
      wordSpacing: 10,
      letterSpacing: 1.0,
      lineHeight: 0.98,
      containerWidthPercent: 90,
      primaryColor: '#FFFFFF',
      activeColor: '#FF3B30',
      strokeColor: '#000000',
      strokeWidth: 6,
      shadowColor: '#FF3B30',
      shadowBlur: 12,
      shadowOffsetX: 0,
      shadowOffsetY: 4,
      backgroundColor: 'transparent',
      backgroundPadding: 0,
      borderRadius: 0,
      positionY: 70,
      positionX: 50,
      animationType: 'pop',
      maxWordsPerSegment: 3
    })
  },
  {
    id: 'minimal',
    name: 'Clean Modern Pill',
    description: 'Frosted dark pill backdrop with crisp white typography',
    badge: 'CLEAN',
    style: sanitizeStyle({
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 28,
      fontWeight: '700',
      fontStyle: 'normal',
      textTransform: 'none',
      textAlign: 'center',
      wordSpacing: 6,
      letterSpacing: 0.0,
      lineHeight: 1.10,
      containerWidthPercent: 85,
      primaryColor: '#E2E8F0',
      activeColor: '#38BDF8',
      strokeColor: '#000000',
      strokeWidth: 0,
      shadowColor: '#000000',
      shadowBlur: 10,
      shadowOffsetX: 0,
      shadowOffsetY: 4,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backgroundPadding: 12,
      borderRadius: 12,
      positionY: 82,
      positionX: 50,
      animationType: 'fade',
      maxWordsPerSegment: 3
    })
  },
  {
    id: 'comic',
    name: 'Comic Pop',
    description: 'Playful cartoon italic bounce with yellow pop',
    badge: 'FUN',
    style: sanitizeStyle({
      fontFamily: 'Bangers',
      fontSize: 44,
      fontWeight: '900',
      fontStyle: 'italic',
      textTransform: 'uppercase',
      textAlign: 'center',
      wordSpacing: 8,
      letterSpacing: 0.5,
      lineHeight: 0.96,
      containerWidthPercent: 90,
      primaryColor: '#FFFFFF',
      activeColor: '#FFDF00',
      strokeColor: '#000000',
      strokeWidth: 8,
      shadowColor: '#000000',
      shadowBlur: 6,
      shadowOffsetX: 3,
      shadowOffsetY: 5,
      backgroundColor: 'transparent',
      backgroundPadding: 0,
      borderRadius: 0,
      positionY: 68,
      positionX: 50,
      animationType: 'pop',
      maxWordsPerSegment: 3
    })
  }
];
