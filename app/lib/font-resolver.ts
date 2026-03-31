/**
 * Font Resolution — Options A + B
 *
 * Option A: Verify whether a Gemini-detected font name actually exists on Google Fonts.
 *           If yes, build and return the full Google Fonts URL.
 *
 * Option B: If the font isn't on Google Fonts (proprietary / paid / self-hosted),
 *           look it up in a curated similarity map and substitute the closest
 *           visually equivalent Google Font.
 */

// ── Option B: Proprietary → Google Fonts similarity map ──────────────────────
// Keyed on lowercase font name (with common variants). Values are the closest
// visually equivalent font available on Google Fonts, annotated with genre.

const SIMILARITY_MAP: Record<string, string> = {
  // ── Geometric / Neo-grotesque sans ─────────────────────────────────────────
  'graphik':              'DM Sans',
  'gt walsheim':          'DM Sans',
  'aktiv grotesk':        'Plus Jakarta Sans',
  'neue haas grotesk':    'Inter',
  'helvetica neue':       'Inter',
  'helvetica':            'Inter',
  'circular':             'Plus Jakarta Sans',
  'circular std':         'Plus Jakarta Sans',
  'cabinet grotesk':      'Plus Jakarta Sans',
  'brandon grotesque':    'Nunito',
  'proxima nova':         'Nunito Sans',
  'sofia pro':            'Nunito Sans',
  'futura':               'Josefin Sans',
  'futura pt':            'Josefin Sans',
  'gotham':               'Montserrat',
  'gill sans':            'Lato',
  'trade gothic':         'Barlow Condensed',
  'trade gothic next':    'Barlow Condensed',
  'din':                  'Barlow',
  'din pro':              'Barlow',
  'din next':             'Barlow',
  'museo sans':           'Nunito Sans',
  'neuzeit grotesk':      'Inter',
  'avenir':               'Nunito',
  'avenir next':          'Nunito',
  'myriad pro':           'Source Sans 3',
  'myriad':               'Source Sans 3',
  'frutiger':             'Inter',
  'calibri':              'Inter',
  'humanist 521':         'Fira Sans',
  'effra':                'Lato',
  'brown':                'DM Sans',
  'brown pro':            'DM Sans',
  'roobert':              'DM Sans',
  'sohne':                'DM Sans',
  'signal':               'Jost',
  'haas grotesk':         'Inter',
  'adelle sans':          'Source Sans 3',
  'aller':                'Lato',
  'apercu':               'DM Sans',
  'apercu pro':           'DM Sans',
  'telegraf':             'Jost',
  'area':                 'DM Sans',
  'atlas grotesk':        'DM Sans',
  'le monde courrier':    'Libre Baskerville',
  'century gothic':       'Josefin Sans',

  // ── Serif ──────────────────────────────────────────────────────────────────
  'canela':               'Playfair Display',
  'canela text':          'Lora',
  'freight text':         'Lora',
  'freight display':      'Cormorant Garamond',
  'freight big':          'Cormorant Garamond',
  'tiempos':              'Cormorant',
  'tiempos text':         'Lora',
  'tiempos headline':     'Playfair Display',
  'chronicle':            'Lora',
  'chronicle display':    'Cormorant Garamond',
  'domaine display':      'Cormorant Garamond',
  'domaine text':         'Lora',
  'caslon':               'EB Garamond',
  'adobe caslon':         'EB Garamond',
  'itc american typewriter': 'Courier Prime',
  'garamond':             'EB Garamond',
  'adobe garamond':       'EB Garamond',
  'minion':               'EB Garamond',
  'minion pro':           'EB Garamond',
  'baskerville':          'Libre Baskerville',
  'new baskerville':      'Libre Baskerville',
  'times new roman':      'Lora',
  'times':                'Lora',
  'georgia':              'Lora',
  'bodoni':               'Libre Bodoni',
  'bodoni mt':            'Libre Bodoni',
  'didot':                'GFS Didot',
  'sabon':                'Lora',
  'palatino':             'EB Garamond',
  'palatino linotype':    'EB Garamond',
  'centaur':              'EB Garamond',
  'perpetua':             'EB Garamond',
  'trajan':               'Cinzel',
  'trajan pro':           'Cinzel',
  'optima':               'Josefin Sans',
  'syntax':               'Lato',
  'scala':                'Lora',
  'miller':               'Lora',
  'le monde sans':        'Lato',
  'archer':               'Josefin Slab',
  'clarendon':            'Zilla Slab',
  'sentinel':             'Zilla Slab',
  'new spirit':           'Playfair Display',
  'editoria':             'Lora',
  'lyons':                'Lora',

  // ── Display / condensed ────────────────────────────────────────────────────
  'tungsten':             'Oswald',
  'knockout':             'Barlow Condensed',
  'druk':                 'Barlow Condensed',
  'druk wide':            'Barlow Condensed',
  'impact':               'Anton',
  'black han sans':       'Anton',
  'compacta':             'Barlow Condensed',
  'agency fb':            'Barlow Condensed',
  'haettenschweiler':     'Anton',
  'tungsten narrow':      'Oswald',
  'vitesse':              'Zilla Slab',
  'harriet':              'Lora',
  'operator':             'JetBrains Mono',
  'operator mono':        'JetBrains Mono',
  'operator mono lig':    'JetBrains Mono',

  // ── Monospace ──────────────────────────────────────────────────────────────
  'input mono':           'JetBrains Mono',
  'fira code':            'Fira Code',
  'source code pro':      'Source Code Pro',
  'consolas':             'Roboto Mono',
  'courier new':          'Courier Prime',
  'menlo':                'Roboto Mono',
  'monaco':               'Roboto Mono',
  'sf mono':              'JetBrains Mono',

  // ── Script / handwritten ───────────────────────────────────────────────────
  'sign painter':         'Dancing Script',
  'snell roundhand':      'Great Vibes',
  'brush script':         'Pacifico',
  'zapfino':              'Great Vibes',
  'edwardian script':     'Great Vibes',
  'lobster':              'Lobster',  // Actually on Google Fonts

  // ── Apple system → common equivalents ─────────────────────────────────────
  'sf pro':               'Inter',
  'sf pro display':       'Inter',
  'sf pro text':          'Inter',
  '-apple-system':        'Inter',
  'system-ui':            'Inter',
  'new york':             'Lora',
};

// ── Option A: Google Fonts availability check ─────────────────────────────────

const GF_CHECK_TIMEOUT_MS = 3000;

/**
 * Check if a font is available on Google Fonts by probing the CSS endpoint.
 * Returns the Google Fonts CSS URL if available, or null.
 */
async function checkGoogleFonts(fontName: string): Promise<string | null> {
  // Skip generic CSS families
  if (['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
       'system-ui', '-apple-system', 'inherit', 'initial', 'unset'].includes(
    fontName.toLowerCase().trim()
  )) return null;

  const encoded = encodeURIComponent(fontName).replace(/%20/g, '+');
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encoded}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GF_CHECK_TIMEOUT_MS);
    const res = await fetch(cssUrl, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    return res.ok ? cssUrl : null;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface FontResolution {
  resolvedName: string;       // Font name to use in CSS
  googleFontsUrl: string | null;  // URL to inject into <head>, or null
  strategy: 'exact' | 'remapped' | 'fallback';
  note: string;               // Human-readable log note
}

/**
 * Resolve a font name to a loadable Google Font.
 * 1. If the font is already in detectedFontLinks (already handled), skip.
 * 2. Option A: check if it exists on Google Fonts directly.
 * 3. Option B: look up the similarity map for a visual substitute.
 * 4. Fall back gracefully (browser will use system-ui).
 */
export async function resolveFont(
  fontName: string,
  detectedFontLinks: string[] = []
): Promise<FontResolution> {
  const name = fontName.trim();

  // Already covered by a detected font link (e.g., Google Fonts <link> in original HTML)
  const alreadyCovered = detectedFontLinks.some(link =>
    link.toLowerCase().includes(encodeURIComponent(name).toLowerCase()) ||
    link.toLowerCase().includes(name.toLowerCase().replace(/\s+/g, '+'))
  );
  if (alreadyCovered) {
    return { resolvedName: name, googleFontsUrl: null, strategy: 'exact', note: 'already in detected font links' };
  }

  // Option A: direct Google Fonts check
  const gfUrl = await checkGoogleFonts(name);
  if (gfUrl) {
    return {
      resolvedName: name,
      googleFontsUrl: gfUrl,
      strategy: 'exact',
      note: `found on Google Fonts`,
    };
  }

  // Option B: similarity map lookup
  const key = name.toLowerCase().trim();
  const mapped = SIMILARITY_MAP[key];
  if (mapped) {
    const mappedUrl = await checkGoogleFonts(mapped);
    if (mappedUrl) {
      return {
        resolvedName: mapped,
        googleFontsUrl: mappedUrl,
        strategy: 'remapped',
        note: `"${name}" → "${mapped}" (visual substitute)`,
      };
    }
  }

  // Partial match in similarity map (e.g., "Graphik Pro" matches "Graphik")
  const partialKey = Object.keys(SIMILARITY_MAP).find(k => key.startsWith(k) || key.includes(k));
  if (partialKey) {
    const partialMapped = SIMILARITY_MAP[partialKey];
    const partialUrl = await checkGoogleFonts(partialMapped);
    if (partialUrl) {
      return {
        resolvedName: partialMapped,
        googleFontsUrl: partialUrl,
        strategy: 'remapped',
        note: `"${name}" → "${partialMapped}" (partial match substitute)`,
      };
    }
  }

  // No resolution found — original name in CSS, browser falls back to system font
  return {
    resolvedName: name,
    googleFontsUrl: null,
    strategy: 'fallback',
    note: `not on Google Fonts and no substitute found — browser will use system font`,
  };
}

/**
 * Resolve both heading and body fonts in parallel.
 * Returns updated font names and a deduplicated list of Google Fonts URLs to inject.
 */
export async function resolveFonts(
  headingFont: string,
  bodyFont: string,
  detectedFontLinks: string[] = []
): Promise<{
  headingFont: string;
  bodyFont: string;
  googleFontsUrls: string[];
  notes: string[];
}> {
  const [headingResult, bodyResult] = await Promise.all([
    resolveFont(headingFont, detectedFontLinks),
    resolveFont(bodyFont, detectedFontLinks),
  ]);

  const urls = [...new Set(
    [headingResult.googleFontsUrl, bodyResult.googleFontsUrl].filter(Boolean) as string[]
  )];

  return {
    headingFont: headingResult.resolvedName,
    bodyFont: bodyResult.resolvedName,
    googleFontsUrls: urls,
    notes: [
      `Heading font: ${headingResult.note}`,
      `Body font: ${bodyResult.note}`,
    ],
  };
}
