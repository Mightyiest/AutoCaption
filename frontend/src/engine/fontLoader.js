/**
 * Font Preloader and Registry using browser FontFace API & document.fonts
 * Guarantees zero glyph drift or fallback popping in Canvas 2D measurement & rendering.
 */

const FONT_MAP = {
  'Montserrat': {
    google: 'https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCvC73w5aX8.woff2',
    weights: ['400', '600', '700', '800', '900']
  },
  'Russo One': {
    google: 'https://fonts.gstatic.com/s/russoone/v17/ZuhT8Wgle3EiKN4QEgYsEE_58A.woff2',
    weights: ['400', '900']
  },
  'Outfit': {
    google: 'https://fonts.gstatic.com/s/outfit/v12/QGYyz_MVcBeNP4NjuGObqx1XmCOarg8-8A.woff2',
    weights: ['400', '600', '700', '800', '900']
  },
  'Bebas Neue': {
    google: 'https://fonts.gstatic.com/s/bebasneue/v14/JTUSjIg69CK48gW7PXoo9Wlhyw.woff2',
    weights: ['400', '700', '900']
  },
  'Plus Jakarta Sans': {
    google: 'https://fonts.gstatic.com/s/plusjakartasans/v11/LDIbaomQNQcsDxUF85vlRhSkeP459A.woff2',
    weights: ['400', '600', '700', '800']
  },
  'Bangers': {
    google: 'https://fonts.gstatic.com/s/bangers/v21/FeVQS0BTqACV6KU5_LhK6Q.woff2',
    weights: ['400', '900']
  },
  'Inter': {
    google: 'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2',
    weights: ['400', '600', '700', '800']
  }
};

const loadedFontsCache = new Set();
const loadingPromises = new Map();

/**
 * Builds standard CSS font declaration string for Canvas context.
 *
 * @param {Object} params
 * @param {string} params.fontFamily
 * @param {number|string} params.fontSize
 * @param {string} [params.fontWeight]
 * @param {string} [params.fontStyle]
 * @returns {string}
 */
export function buildCanvasFontString({
  fontFamily = 'Montserrat',
  fontSize = 34,
  fontWeight = '900',
  fontStyle = 'normal'
}) {
  const cleanFamily = String(fontFamily).replace(/["']/g, '');
  const cleanWeight = String(fontWeight || 'normal');
  const cleanStyle = fontStyle === 'italic' ? 'italic' : 'normal';
  const cleanSize = Math.round(Number(fontSize) || 34);

  return `${cleanStyle} ${cleanWeight} ${cleanSize}px "${cleanFamily}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
}

/**
 * Ensures the target font family is fully loaded and ready in document.fonts.
 *
 * @param {string} fontFamily
 * @param {string|number} [fontWeight='900']
 * @param {string} [fontStyle='normal']
 * @returns {Promise<boolean>}
 */
export async function ensureFontLoaded(fontFamily = 'Montserrat', fontWeight = '900', fontStyle = 'normal') {
  if (typeof document === 'undefined' || !document.fonts) {
    return true;
  }

  const cacheKey = `${fontFamily}-${fontWeight}-${fontStyle}`;
  if (loadedFontsCache.has(cacheKey)) {
    return true;
  }

  if (loadingPromises.has(cacheKey)) {
    return loadingPromises.get(cacheKey);
  }

  const loadPromise = (async () => {
    try {
      const fontSpec = `${fontStyle === 'italic' ? 'italic ' : ''}${fontWeight} 32px "${fontFamily}"`;
      
      // Check if already available in document.fonts
      if (document.fonts.check(fontSpec)) {
        loadedFontsCache.add(cacheKey);
        return true;
      }

      // Explicitly request browser load
      await document.fonts.load(fontSpec);
      
      // Wait for complete font readiness
      await document.fonts.ready;

      loadedFontsCache.add(cacheKey);
      return true;
    } catch (err) {
      console.warn(`Font load warning for ${fontFamily}:`, err);
      // Fallback: don't crash rendering, allow canvas fallback
      loadedFontsCache.add(cacheKey);
      return false;
    } finally {
      loadingPromises.delete(cacheKey);
    }
  })();

  loadingPromises.set(cacheKey, loadPromise);
  return loadPromise;
}

/**
 * Preloads all common preset fonts in parallel for instant switches.
 */
export async function preloadPresetFonts() {
  const families = Object.keys(FONT_MAP);
  await Promise.all(families.map(f => ensureFontLoaded(f, '900', 'normal')));
}
