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
  detectedFontLinks: string[];    // Option 1: font <link> hrefs
  fetchedStylesheets: string[];   // Option C: raw CSS content from linked stylesheets
  links: string[];                // All page links from Firecrawl (most reliable for nav discovery)
  meta: {
    title?: string;
    description?: string;
    ogImage?: string;
    language?: string;
  };
}

// ── Option 1: Font link extraction ───────────────────────────────────────────

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

  return {
    markdown: doc.markdown || '',
    html: rawHtml,
    screenshotUrl: doc.screenshot || '',
    detectedFontLinks,
    fetchedStylesheets,
    links: Array.isArray(doc.links) ? doc.links : [],
    meta: {
      title: doc.metadata?.title,
      description: doc.metadata?.description,
      ogImage: doc.metadata?.ogImage,
      language: doc.metadata?.language || 'en',
    },
  };
}
