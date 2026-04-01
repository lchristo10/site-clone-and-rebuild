import FirecrawlApp from '@mendable/firecrawl-js';

let client: FirecrawlApp | null = null;

function getClient(): FirecrawlApp {
  if (!client) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey || apiKey === 'your_firecrawl_api_key_here') {
      throw new Error('FIRECRAWL_API_KEY is not configured in .env.local');
    }
    client = new FirecrawlApp({ apiKey });
  }
  return client;
}

export interface ExtractResult {
  markdown: string;
  html: string;
  screenshotUrl: string;
  detectedFontLinks: string[];      // CDN font <link> hrefs (Google Fonts, Typekit etc.)
  fetchedStylesheets: string[];     // Raw CSS content from linked stylesheets
  links: string[];                  // All page links (nav discovery)
  /** Fix 1: Font families declared in @font-face rules in the fetched CSS */
  cssDefinedFonts: CssFontInfo;
  /** Fix 2: Distinct text colours (primary/secondary/accent) from CSS */
  cssTextColors: CssTextColors;
  meta: {
    title?: string;
    description?: string;
    ogImage?: string;
    language?: string;
  };
}

// ── CSS font & colour info types ──────────────────────────────────────────────

export interface CssFontInfo {
  /** All font-family names declared in @font-face blocks */
  fontFaceNames: string[];
  /** Font applied to h1/h2/h3 selectors (most specific match wins) */
  headingFont: string | null;
  /** Font applied to body/p selectors */
  bodyFont: string | null;
}

export interface CssTextColors {
  /** color: on h1/h2/h3 selectors — primary heading text colour */
  headingColor: string | null;
  /** color: on body/p selectors — primary body text colour */
  bodyColor: string | null;
  /** color: on a/button selectors — accent/interactive text colour */
  linkColor: string | null;
}

// ── Option 1: Font link extraction (CDN links in HTML) ────────────────────────

const FONT_DOMAINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'use.typekit.net',
  'fonts.bunny.net',
  'cloud.typography.com',
  'fast.fonts.net',
];

function extractFontLinks(html: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();

  const linkTagRe = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkTagRe.exec(html)) !== null) {
    const href = m[1];
    if (FONT_DOMAINS.some(d => href.includes(d)) && !seen.has(href)) {
      seen.add(href);
      links.push(href);
    }
  }

  const importRe = /@import\s+url\(["']?([^"')]+)["']?\)/gi;
  while ((m = importRe.exec(html)) !== null) {
    const href = m[1];
    if (FONT_DOMAINS.some(d => href.includes(d)) && !seen.has(href)) {
      seen.add(href);
      links.push(href);
    }
  }

  return links;
}

// ── Fix 1: @font-face + element font extraction ───────────────────────────────

/**
 * Extracts font family names from @font-face declarations in CSS.
 * Also scans heading (h1/h2/h3) and body/p selectors to determine
 * which fonts are actually applied to those elements.
 */
function extractCssFonts(cssChunks: string[]): CssFontInfo {
  const allCss = cssChunks.join('\n');

  // 1. All @font-face declared names
  const fontFaceNames: string[] = [];
  const fontFaceRe = /@font-face\s*\{[^}]*font-family\s*:\s*["']?([^"';}\n]+)["']?/gi;
  let m: RegExpExecArray | null;
  while ((m = fontFaceRe.exec(allCss)) !== null) {
    const name = m[1].trim().replace(/["']/g, '');
    if (name && !fontFaceNames.includes(name)) fontFaceNames.push(name);
  }

  // Helper: extract font-family value for a given CSS selector pattern
  function fontForSelector(selectorPattern: RegExp): string | null {
    // Find all rule blocks matching the selector
    // Strategy: scan for selector, then capture the { ... } block
    const ruleRe = new RegExp(
      `(?:^|[};])\\s*([^{]*${selectorPattern.source}[^{]*)\\s*\\{([^}]*)\\}`,
      'gim'
    );
    const candidates: string[] = [];
    let rm: RegExpExecArray | null;
    while ((rm = ruleRe.exec(allCss)) !== null) {
      const block = rm[2];
      const ffMatch = /font-family\s*:\s*([^;}\n]+)/i.exec(block);
      if (ffMatch) {
        // Take the first family name (before comma)
        const first = ffMatch[1].split(',')[0].trim().replace(/["']/g, '');
        if (first && first.length > 1) candidates.push(first);
      }
    }
    return candidates[0] ?? null;
  }

  const headingFont = fontForSelector(/h[123]/) ?? fontForSelector(/heading/);
  const bodyFont    = fontForSelector(/^body$/) ?? fontForSelector(/^p$/) ?? fontForSelector(/body/);

  return { fontFaceNames, headingFont, bodyFont };
}

// ── Fix 2: Text colour extraction ────────────────────────────────────────────

/**
 * Extracts distinct text colours from CSS for headings, body, and links.
 * Looks at actual selector context so we distinguish UI element colours
 * from text colours.
 */
function extractCssTextColors(cssChunks: string[]): CssTextColors {
  const allCss = cssChunks.join('\n');

  function colorForSelector(selectorPattern: RegExp): string | null {
    const ruleRe = new RegExp(
      `(?:^|[};])\\s*([^{]*${selectorPattern.source}[^{]*)\\s*\\{([^}]*)\\}`,
      'gim'
    );
    const candidates: string[] = [];
    let rm: RegExpExecArray | null;
    while ((rm = ruleRe.exec(allCss)) !== null) {
      const block = rm[2];
      // color: (but not background-color:)
      const colorMatch = /(?<!\S)color\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-z]+)/i.exec(block);
      if (colorMatch) {
        const c = colorMatch[1].trim();
        // Skip transparent/inherit/initial
        if (!['transparent', 'inherit', 'initial', 'currentcolor', 'unset'].includes(c.toLowerCase())) {
          candidates.push(c);
        }
      }
    }
    return candidates[0] ?? null;
  }

  const headingColor = colorForSelector(/h[123]/);
  const bodyColor    = colorForSelector(/^body$/) ?? colorForSelector(/^p$/);
  const linkColor    = colorForSelector(/^a$/) ?? colorForSelector(/^a:link/);

  return { headingColor, bodyColor, linkColor };
}

// ── Option C: Stylesheet fetching ─────────────────────────────────────────────

const SKIP_CSS_DOMAINS = [
  ...FONT_DOMAINS,        // font CDNs — we handle separately
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'stackpath.bootstrapcdn.com',
];

const CSS_FETCH_TIMEOUT_MS = 6000;
const MAX_CSS_FILES = 8;
const MAX_CSS_BYTES = 200_000; // 200 KB per file

/**
 * Extract <link rel="stylesheet"> hrefs from HTML, resolve them to absolute
 * URLs against the page's origin, and return only same-origin or relative ones
 * (skip font CDNs and other 3rd-party CDNs we don't want to inline).
 */
function extractStylesheetUrls(html: string, pageUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  let origin = '';
  try { origin = new URL(pageUrl).origin; } catch { return []; }

  const linkTagRe = /<link[^>]+>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkTagRe.exec(html)) !== null) {
    const tag = m[0];
    // Must be a stylesheet link
    if (!/rel=["']stylesheet["']/i.test(tag)) continue;
    const hrefMatch = /href=["']([^"']+)["']/i.exec(tag);
    if (!hrefMatch) continue;

    let href = hrefMatch[1];

    // Skip font CDNs and major 3rd-party CDNs
    if (SKIP_CSS_DOMAINS.some(d => href.includes(d))) continue;

    // Resolve to absolute URL
    try {
      if (href.startsWith('//')) href = 'https:' + href;
      else if (href.startsWith('/')) href = origin + href;
      else if (!href.startsWith('http')) href = origin + '/' + href;
    } catch { continue; }

    // Only same-origin (so we can reliably fetch without CORS issues)
    try {
      if (new URL(href).origin !== origin) continue;
    } catch { continue; }

    if (!seen.has(href)) {
      seen.add(href);
      urls.push(href);
    }
  }

  return urls.slice(0, MAX_CSS_FILES);
}

/**
 * Fetch each stylesheet URL and return the raw CSS content.
 * Individual failures are silently skipped.
 */
async function fetchStylesheets(urls: string[]): Promise<string[]> {
  const results: string[] = [];

  await Promise.allSettled(urls.map(async (url) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CSS_FETCH_TIMEOUT_MS);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) return;
      const text = await res.text();
      if (text.length <= MAX_CSS_BYTES) {
        results.push(`/* Source: ${url} */\n${text}`);
      } else {
        // Truncate very large files but still include them
        results.push(`/* Source: ${url} (truncated) */\n${text.substring(0, MAX_CSS_BYTES)}`);
      }
    } catch {
      // timeout or network error — skip silently
    }
  }));

  return results;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function extractPage(url: string): Promise<ExtractResult> {
  const fc = getClient();

  const doc = await fc.scrape(url, {
    formats: ['markdown', 'html', 'screenshot'],
    waitFor: 2000,
  });

  if (!doc) {
    throw new Error(`Firecrawl scrape returned empty result for ${url}`);
  }

  const rawHtml = doc.rawHtml || doc.html || '';
  const detectedFontLinks = extractFontLinks(rawHtml);

  // Option C: fetch same-origin stylesheets
  const stylesheetUrls = extractStylesheetUrls(rawHtml, url);
  const fetchedStylesheets = stylesheetUrls.length > 0
    ? await fetchStylesheets(stylesheetUrls)
    : [];

  // Fix 1 + 2: parse actual font names and text colors from the fetched CSS
  // Also scan the raw HTML inline styles as a fallback
  const allCssChunks = [
    ...fetchedStylesheets,
    // Extract any <style> blocks from the raw HTML
    ...[...rawHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]),
  ];
  const cssDefinedFonts = extractCssFonts(allCssChunks);
  const cssTextColors   = extractCssTextColors(allCssChunks);

  return {
    markdown: doc.markdown || '',
    html: rawHtml,
    screenshotUrl: doc.screenshot || '',
    detectedFontLinks,
    fetchedStylesheets,
    cssDefinedFonts,
    cssTextColors,
    links: Array.isArray(doc.links) ? doc.links : [],
    meta: {
      title: doc.metadata?.title,
      description: doc.metadata?.description,
      ogImage: doc.metadata?.ogImage,
      language: doc.metadata?.language || 'en',
    },
  };
}

