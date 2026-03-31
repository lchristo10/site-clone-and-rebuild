import { NextRequest } from 'next/server';
import { getJob, updateJob, updatePhase, upsertPage } from '@/lib/job-store';
import { extractPage } from '@/lib/firecrawl';
import { analyzeDesignTokens, generateAeoContent, auditAeoScore, generateLayoutCss } from '@/lib/gemini';
import { resolveFonts } from '@/lib/font-resolver';
import { buildHtml } from '@/lib/synthesizer';
import { extractBrandDna } from '@/lib/brand-dna';
import { BrandDNA, DesignTokens, EntityMap, StreamEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteContext = { params: Promise<{ jobId: string }> };

function encode(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

// ── Nav page discovery ────────────────────────────────────────────────────────

interface NavPage {
  slug: string;
  title: string;
  url: string;
}

const MAX_NAV_PAGES = 8;

/**
 * Extract nav pages using 3 strategies in priority order:
 *
 * 1. Firecrawl `links` array — most reliable; already JS-rendered. Filter to
 *    same-origin, skip anchors/query-only, build title from URL path.
 *
 * 2. HTML full-document anchor scan — strips inner tags from link text so
 *    nested spans (<a><span>Text</span></a>) are handled correctly. Not limited
 *    to <nav>/<header> so it works regardless of markup conventions.
 *
 * 3. Markdown link extraction — last resort for sites where the HTML is missing.
 *
 * Always inserts 'home' as the first entry regardless of which strategy fires.
 */
function extractNavPages(
  html: string,
  baseUrl: string,
  firecrawlLinks: string[] = []
): NavPage[] {
  let origin = '';
  try { origin = new URL(baseUrl).origin; } catch { return []; }

  const homeUrl = baseUrl.replace(/\/$/, '');
  const seen = new Set<string>();
  seen.add(homeUrl);
  seen.add(homeUrl + '/');

  const pages: NavPage[] = [{ slug: 'home', title: 'Home', url: baseUrl }];

  // ── Helpers ────────────────────────────────────────────────────────────────
  const normalise = (u: string) => u.replace(/\/$/, '');

  /** Build a display title from a URL pathname segment */
  const titleFromPath = (href: string): string => {
    try {
      const segments = new URL(href).pathname.split('/').filter(Boolean);
      const last = segments[segments.length - 1] || '';
      return last
        .replace(/[-_]/g, ' ')
        .replace(/\.[^/.]+$/, '') // strip extension
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim() || 'Page';
    } catch { return 'Page'; }
  };

  /** Build a slug from a URL pathname */
  const slugFromUrl = (href: string, title: string): string => {
    try {
      const path = new URL(href).pathname.replace(/\//g, '-').replace(/^-|-$/g, '');
      return (path || title.toLowerCase().replace(/\s+/g, '-')).replace(/[^a-z0-9-]/gi, '').toLowerCase();
    } catch { return title.toLowerCase().replace(/[^a-z0-9-]/g, '-'); }
  };

  /** Try to add a discovered URL to the pages list */
  const tryAdd = (href: string, title: string): boolean => {
    if (pages.length >= MAX_NAV_PAGES + 1) return false;
    let resolved = href;
    try {
      if (href.startsWith('//')) resolved = 'https:' + href;
      else if (href.startsWith('/')) resolved = origin + href;
      else if (!href.startsWith('http')) resolved = origin + '/' + href;
    } catch { return false; }

    // Same-origin only
    try { if (new URL(resolved).origin !== origin) return false; } catch { return false; }

    // Skip anchors, files, and query-only hrefs
    try {
      const u = new URL(resolved);
      if (u.hash && !u.pathname.replace('/', '')) return false; // pure anchor
      if (/\.(pdf|jpg|jpeg|png|gif|svg|webp|zip|mp4|mp3)$/i.test(u.pathname)) return false;
    } catch { return false; }

    const norm = normalise(resolved);
    if (seen.has(norm) || seen.has(norm + '/')) return false;
    seen.add(norm);

    const cleanTitle = title.replace(/\s+/g, ' ').trim().replace(/^[•\-–—>»]+\s*/, '');
    if (!cleanTitle || cleanTitle.length < 1 || cleanTitle.length > 60) return false;

    const slug = slugFromUrl(resolved, cleanTitle);
    pages.push({ slug, title: cleanTitle, url: resolved });
    return true;
  };

  // ── Strategy 1: Firecrawl links array ─────────────────────────────────────
  // Firecrawl populates this from JS-rendered DOM — most reliable.
  // Links are plain URLs without titles; we build titles from the path.
  // Heuristic: prefer shorter paths (they're more likely to be nav pages).
  const sortedFcLinks = [...firecrawlLinks]
    .filter(l => l.startsWith('http') || l.startsWith('/'))
    .sort((a, b) => {
      try {
        const pa = new URL(a.startsWith('/') ? origin + a : a).pathname.split('/').filter(Boolean).length;
        const pb = new URL(b.startsWith('/') ? origin + b : b).pathname.split('/').filter(Boolean).length;
        return pa - pb; // prefer top-level paths (fewer segments)
      } catch { return 0; }
    });

  for (const link of sortedFcLinks) {
    if (pages.length > MAX_NAV_PAGES) break;
    const title = titleFromPath(link.startsWith('/') ? origin + link : link);
    tryAdd(link, title);
  }

  // ── Strategy 2: Full HTML anchor scan (tag-stripping) ─────────────────────
  // Searches the entire document (not just <nav>) and strips inner HTML tags
  // so <a href="/x"><span>Label</span></a> correctly yields "Label".
  if (pages.length < 3) { // only run if strategy 1 found very little
    const anchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = anchorRe.exec(html)) !== null && pages.length <= MAX_NAV_PAGES) {
      const href = m[1].trim();
      // Strip inner tags to get text
      const innerText = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const label = innerText || titleFromPath(href.startsWith('/') ? origin + href : href);
      tryAdd(href, label);
    }
  }

  // ── Strategy 3: Markdown link extraction ─────────────────────────────────
  // Final fallback — parse [Text](url) from the markdown representation.
  if (pages.length < 3) {
    const mdLinkRe = /\[([^\]]{1,60})\]\((https?:\/\/[^)]+|\/[^)]*)\)/g;
    let mm: RegExpExecArray | null;
    while ((mm = mdLinkRe.exec(html)) !== null && pages.length <= MAX_NAV_PAGES) {
      tryAdd(mm[2], mm[1]);
    }
  }

  return pages;
}


// ── Main GET handler ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { jobId } = await ctx.params;
  const job = getJob(jobId);

  if (!job) {
    return new Response('Job not found', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(encode(event)));
      };

      try {
        updateJob(jobId, { status: 'running' });
        emit({ phase: 'system', status: 'log', message: `▶ ALIAS COMPILER initializing job ${jobId}` });
        emit({ phase: 'system', status: 'log', message: `▶ Target URL: ${job.url}` });

        // ── PHASE 1: EXTRACT (homepage) ───────────────────────────────────────
        emit({ phase: 'extract', status: 'running', message: '[ EXTRACT ] Scraping target URL via Firecrawl...' });
        updatePhase(jobId, 'extract', { status: 'running', startedAt: Date.now() });

        const extracted = await extractPage(job.url);

        emit({ phase: 'extract', status: 'log', message: `✓ Markdown extracted: ${extracted.markdown.length} characters` });
        emit({ phase: 'extract', status: 'log', message: `✓ Raw HTML extracted: ${extracted.html.length} characters` });
        emit({ phase: 'extract', status: 'log', message: `✓ Screenshot captured: ${extracted.screenshotUrl ? 'success' : 'unavailable'}` });
        emit({ phase: 'extract', status: 'log', message: `✓ Page title: "${extracted.meta.title || 'unknown'}"` });

        updatePhase(jobId, 'extract', {
          status: 'done',
          completedAt: Date.now(),
          screenshotUrl: extracted.screenshotUrl,
          markdown: extracted.markdown,
          html: extracted.html,
          detectedFontLinks: extracted.detectedFontLinks,
          fetchedStylesheets: extracted.fetchedStylesheets,
          meta: extracted.meta,
        });
        emit({ phase: 'extract', status: 'done', message: '[ EXTRACT ] Complete.', data: { screenshotUrl: extracted.screenshotUrl, meta: extracted.meta } });
        if (extracted.detectedFontLinks.length > 0) {
          emit({ phase: 'extract', status: 'log', message: `✓ Font links detected: ${extracted.detectedFontLinks.length}` });
        }
        if (extracted.fetchedStylesheets.length > 0) {
          emit({ phase: 'extract', status: 'log', message: `✓ Option C: ${extracted.fetchedStylesheets.length} stylesheet(s) fetched` });
        }

        // ── NAV PAGE DISCOVERY ────────────────────────────────────────────────
        const navPages = extractNavPages(extracted.html, job.url, extracted.links);
        const subPages = navPages.filter(p => p.slug !== 'home');
        emit({ phase: 'system', status: 'log', message: `▶ Firecrawl links available: ${extracted.links.length}` });
        emit({ phase: 'system', status: 'log', message: `▶ Pages discovered: ${navPages.map(p => p.title).join(', ')} (${navPages.length} total)` });

        // ── BRAND DNA PRE-PASS ────────────────────────────────────────────────
        emit({ phase: 'analyze', status: 'log', message: '[ BRAND DNA ] Extracting 60-30-10 palette and brand identity...' });
        const brandDna: BrandDNA = await extractBrandDna({
          markdown:           extracted.markdown,
          html:               extracted.html,
          fetchedStylesheets: extracted.fetchedStylesheets,
          siteUrl:            job.url,
        });
        updateJob(jobId, { brandDna });
        emit({ phase: 'analyze', status: 'log', message: `✓ Brand DNA: "${brandDna.brandName}" | ${brandDna.industry} | ${brandDna.voiceTone}` });
        emit({ phase: 'analyze', status: 'log', message: `✓ Palette 60%: ${brandDna.palette.dominant} | 30%: ${brandDna.palette.supporting} | 10%: ${brandDna.palette.accent}` });
        emit({ phase: 'analyze', status: 'log', message: `✓ Type: ${brandDna.typePairing.heading} / ${brandDna.typePairing.body}` });

        // ── PHASE 2: ANALYZE (homepage) ───────────────────────────────────────
        emit({ phase: 'analyze', status: 'running', message: '[ ANALYZE ] Sending screenshot to Gemini Vision...' });
        updatePhase(jobId, 'analyze', { status: 'running', startedAt: Date.now() });

        const { tokens: rawTokens, entityMap } = await analyzeDesignTokens(
          extracted.screenshotUrl,
          extracted.markdown,
          extracted.detectedFontLinks
        );

        // Deduplicate colour tokens
        const colors = { ...rawTokens.colors };
        const seenColors = new Map<string, string>();

        const adjustHex = (hex: string, amount: number): string => {
          const n = parseInt(hex.replace('#', ''), 16);
          const r = Math.min(255, Math.max(0, (n >> 16) + amount));
          const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount));
          const b = Math.min(255, Math.max(0, (n & 0xff) + amount));
          return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
        };

        const colorKeys = ['primary', 'secondary', 'surface', 'text', 'accent', 'border'] as const;
        for (const key of colorKeys) {
          const raw = (colors[key] || '#888888').toLowerCase();
          if (seenColors.has(raw)) {
            const shifted = adjustHex(raw, key === 'border' || key === 'surface' ? 20 : -20);
            colors[key] = shifted;
            seenColors.set(shifted, key);
          } else {
            seenColors.set(raw, key);
          }
        }

        let tokens = { ...rawTokens, colors };

        const dupeCount = colorKeys.length - seenColors.size;
        if (dupeCount > 0) emit({ phase: 'analyze', status: 'log', message: `⚠ ${dupeCount} duplicate colour(s) resolved` });

        emit({ phase: 'analyze', status: 'log', message: `✓ Primary color: ${tokens.colors.primary}` });
        emit({ phase: 'analyze', status: 'log', message: `✓ Heading font: ${tokens.typography.headingFont}` });
        emit({ phase: 'analyze', status: 'log', message: `✓ Layout: ${tokens.layout.navType} nav (${tokens.layout.navStyle}), ${tokens.layout.heroType} hero, ${tokens.layout.columnCount}-col` });
        emit({ phase: 'analyze', status: 'log', message: `✓ Business: "${entityMap.businessName}" (${entityMap.industry})` });
        emit({ phase: 'analyze', status: 'log', message: `✓ Entities: ${entityMap.entities.join(', ')}` });

        updatePhase(jobId, 'analyze', { status: 'done', completedAt: Date.now(), tokens, entityMap });
        emit({ phase: 'analyze', status: 'done', message: '[ ANALYZE ] Complete.', data: { tokens, entityMap } });

        // ── FONT RESOLUTION (Options A + B) — shared across all pages ─────────
        const fontResolution = await resolveFonts(
          tokens.typography.headingFont,
          tokens.typography.bodyFont,
          extracted.detectedFontLinks
        );
        fontResolution.notes.forEach(note =>
          emit({ phase: 'analyze', status: 'log', message: `✓ Font: ${note}` })
        );
        tokens = {
          ...tokens,
          typography: { ...tokens.typography, headingFont: fontResolution.headingFont, bodyFont: fontResolution.bodyFont },
        };
        const allFontLinks = [...new Set([...extracted.detectedFontLinks, ...fontResolution.googleFontsUrls])];
        if (fontResolution.googleFontsUrls.length > 0) {
          emit({ phase: 'analyze', status: 'log', message: `✓ Font: ${fontResolution.googleFontsUrls.length} Google Fonts URL(s) queued` });
        }

        // ── Extract nav link labels for content hints ─────────────────────────
        const navLinkLabels = navPages.map(p => p.title);

        // ── Helper to build one page (shared between home + sub-pages) ─────────
        const buildPage = async (
          pageSlug: string,
          pageTitle: string,
          pageUrl: string,
          pageMarkdown: string,
          pageMeta: { title?: string; description?: string },
          pageHtml: string,
          pageTokens: typeof tokens,
          pageEntityMap: EntityMap,
          pageFetchedStylesheets: string[],
          isHomepage: boolean
        ): Promise<string> => {
          // DRAFT
          emit({ phase: 'draft', status: 'log', message: `[ DRAFT ] Generating content for: ${pageTitle}...` });
          const aeoContent = await generateAeoContent(pageMarkdown, pageEntityMap, pageMeta, navLinkLabels);
          emit({ phase: 'draft', status: 'log', message: `✓ ${pageTitle}: "${aeoContent.h1}" — ${aeoContent.sections.length} sections` });

          // Option A: only for homepage in brand-first mode
          let geminiLayoutCss = '';
          if (isHomepage && job.fidelityMode === 'brand-first' && extracted.screenshotUrl) {
            emit({ phase: 'synthesize', status: 'log', message: '[ OPTION A ] Generating layout CSS from screenshot...' });
            try {
              geminiLayoutCss = await generateLayoutCss(extracted.screenshotUrl, pageHtml);
              emit({ phase: 'synthesize', status: 'log', message: `✓ Option A: layout CSS generated (${geminiLayoutCss.length} chars)` });
            } catch (err) {
              emit({ phase: 'synthesize', status: 'log', message: `⚠ Option A failed: ${err instanceof Error ? err.message : 'unknown'}` });
            }
          }

          const built = buildHtml(pageTokens, aeoContent, pageEntityMap, pageUrl, {
            detectedFontLinks: allFontLinks,
            // Sub-pages always use AEO-First; only homepage gets brand-first treatment
            fidelityMode: isHomepage ? job.fidelityMode : 'aeo-first',
            originalHtml: isHomepage ? pageHtml : undefined,
            fetchedStylesheets: isHomepage ? pageFetchedStylesheets : [],
            geminiLayoutCss,
            brandDna,  // ← shared locked Brand DNA from pre-pass
          });

          // Persist aeoContent on the BuiltPage so the refine endpoint can patch sections
          upsertPage(jobId, { slug: pageSlug, title: pageTitle, url: pageUrl, html: built, status: 'done', aeoContent });

          return built;
        };

        // ── PHASE 3+4: HOMEPAGE ───────────────────────────────────────────────
        emit({ phase: 'draft', status: 'running', message: `[ DRAFT ] Processing homepage (1/${navPages.length})...` });
        updatePhase(jobId, 'draft', { status: 'running', startedAt: Date.now() });

        emit({ phase: 'synthesize', status: 'running', message: '[ SYNTHESIZE ] Building homepage HTML...' });
        updatePhase(jobId, 'synthesize', { status: 'running', startedAt: Date.now() });
        if (extracted.fetchedStylesheets.length === 0) {
          emit({ phase: 'synthesize', status: 'log', message: '⚠ Option C: no same-origin stylesheets found (site may use JS-injected CSS)' });
        }

        upsertPage(jobId, { slug: 'home', title: 'Home', url: job.url, html: '', status: 'running' });

        const homeHtml = await buildPage(
          'home', 'Home', job.url,
          extracted.markdown, extracted.meta, extracted.html,
          tokens, entityMap, extracted.fetchedStylesheets,
          true
        );

        // buildPage already calls upsertPage with aeoContent — just sync remaining phases
        updatePhase(jobId, 'draft', { status: 'done', completedAt: Date.now() });
        updatePhase(jobId, 'synthesize', { status: 'done', completedAt: Date.now(), builtHtml: homeHtml });
        emit({ phase: 'synthesize', status: 'log', message: `✓ Homepage: ${homeHtml.length} chars` });
        emit({ phase: 'synthesize', status: 'done', message: '[ SYNTHESIZE ] Homepage complete.' });

        // ── SUB-PAGES ─────────────────────────────────────────────────────────
        if (subPages.length > 0) {
          emit({ phase: 'system', status: 'log', message: `▶ Processing ${subPages.length} sub-page(s)...` });

          for (let i = 0; i < subPages.length; i++) {
            const page = subPages[i];
            emit({ phase: 'system', status: 'log', message: `▶ Page ${i + 2}/${navPages.length}: ${page.title} (${page.url})` });
            upsertPage(jobId, { slug: page.slug, title: page.title, url: page.url, html: '', status: 'running' });

            try {
              const pageExtracted = await extractPage(page.url);
              emit({ phase: 'system', status: 'log', message: `  ✓ Scraped: ${pageExtracted.markdown.length} chars of content` });

              const pageHtml = await buildPage(
                page.slug, page.title, page.url,
                pageExtracted.markdown, pageExtracted.meta, pageExtracted.html,
                tokens, entityMap, [], // sub-pages: no brand-first treatment
                false
              );

              // buildPage already calls upsertPage with aeoContent — no extra upsert needed
              emit({ phase: 'system', status: 'log', message: `  ✓ ${page.title} built: ${pageHtml.length} chars` });

            } catch (err) {
              const msg = err instanceof Error ? err.message : 'unknown error';
              upsertPage(jobId, { slug: page.slug, title: page.title, url: page.url, html: '', status: 'error', error: msg });
              emit({ phase: 'system', status: 'log', message: `  ✗ ${page.title} failed: ${msg}` });
            }
          }

          emit({ phase: 'system', status: 'log', message: `✓ All ${navPages.length} pages processed.` });
        }

        // ── PHASE 5: AUDIT (homepage) ─────────────────────────────────────────
        emit({ phase: 'audit', status: 'running', message: '[ AUDIT ] Running simulated AI crawler...' });
        updatePhase(jobId, 'audit', { status: 'running', startedAt: Date.now() });

        const crawledTitles = navPages.map(p => p.title);
        const score = await auditAeoScore(homeHtml, crawledTitles);

        emit({ phase: 'audit', status: 'log', message: `✓ Overall AEO Score: ${score.overall}/100` });
        emit({ phase: 'audit', status: 'log', message: `✓ Content Structure: ${score.content_structure}/100` });
        emit({ phase: 'audit', status: 'log', message: `✓ E-E-A-T: ${score.eeat}/100` });
        emit({ phase: 'audit', status: 'log', message: `✓ Technical: ${score.technical}/100` });
        emit({ phase: 'audit', status: 'log', message: `✓ Entity Alignment: ${score.entity_alignment}/100` });
        emit({ phase: 'audit', status: 'log', message: `✓ AI can summarize: ${score.canSummarizeIn2Sentences ? 'YES ✓' : 'NO — needs improvement'}` });
        emit({ phase: 'audit', status: 'log', message: `✓ AI summary: "${score.aiSummary}"` });
        if (score.missingPageSuggestions?.length > 0) {
          emit({ phase: 'audit', status: 'log', message: `⚠ Missing pages suggested: ${score.missingPageSuggestions.join(', ')}` });
        }

        updatePhase(jobId, 'audit', { status: 'done', completedAt: Date.now(), score });
        updateJob(jobId, { status: 'done' });
        emit({ phase: 'audit', status: 'done', message: '[ AUDIT ] Complete.', data: score });
        emit({ phase: 'system', status: 'done', message: `▶ ALIAS COMPILER complete. ${navPages.length} page(s) ready.` });

      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        emit({ phase: 'system', status: 'error', message: `✗ Pipeline error: ${message}` });
        updateJob(jobId, { status: 'error' });
        console.error('[stream] error:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
