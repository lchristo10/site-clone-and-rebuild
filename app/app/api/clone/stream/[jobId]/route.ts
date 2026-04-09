import { NextRequest } from 'next/server';
import { getJob, updateJob, updatePhase, upsertPage } from '@/lib/job-store';
import { extractPage } from '@/lib/firecrawl';
import { analyzeDesignTokens, generateAeoContent, generateAeoStrategy, auditAeoScore, generateLayoutCss, normalizeMarkdownToAuditHtml, extractRealSiteContent } from '@/lib/gemini';
import { generateSitePlan, computeOwnershipMap } from '@/lib/site-planner';
import { resolveFonts } from '@/lib/font-resolver';
import { buildHtml } from '@/lib/synthesizer';
import { extractBrandDna } from '@/lib/brand-dna';
import { BrandDNA, DesignTokens, EntityMap, PlannedSection, RealSiteContent, StreamEvent } from '@/lib/types';

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

  // ── Strategy 1b: <nav> element anchor scan (highest priority) ──────────────
  // Real navigation menus have short, human-readable labels (e.g. "Services",
  // "About Us", "Contact"). Scan <nav> elements first before hitting the full
  // document so that genuine nav text wins over paragraph copy.
  const navElementRe = /<nav[\s\S]*?<\/nav>/gi;
  let navMatch: RegExpExecArray | null;
  while ((navMatch = navElementRe.exec(html)) !== null) {
    const navBlock = navMatch[0];
    const navAnchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let na: RegExpExecArray | null;
    while ((na = navAnchorRe.exec(navBlock)) !== null && pages.length <= MAX_NAV_PAGES) {
      const href = na[1].trim();
      const innerText = na[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      // Only use the label if it looks like a nav item (short, no sentence casing clue)
      const label = innerText.length > 0 && innerText.length <= 30
        ? innerText
        : titleFromPath(href.startsWith('/') ? origin + href : href);
      tryAdd(href, label);
    }
  }

  // ── Strategy 2: Firecrawl links array ─────────────────────────────────────
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

  // ── Strategy 3: Full HTML anchor scan (fallback) ───────────────────────────
  // Only run if the above found very little.
  if (pages.length < 3) {
    const anchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = anchorRe.exec(html)) !== null && pages.length <= MAX_NAV_PAGES) {
      const href = m[1].trim();
      const innerText = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      // Reject long anchor text — it's almost certainly paragraph copy, not a nav label
      const label = innerText.length > 0 && innerText.length <= 30
        ? innerText
        : titleFromPath(href.startsWith('/') ? origin + href : href);
      tryAdd(href, label);
    }
  }

  // ── Strategy 4: Markdown link extraction ─────────────────────────────────
  // Final fallback — parse [Text](url) from the markdown representation.
  if (pages.length < 3) {
    const mdLinkRe = /\[([^\]]{1,30})\]\((https?:\/\/[^)]+|\/[^)]*)\)/g;
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
          extracted.detectedFontLinks,
          extracted.cssDefinedFonts,
          extracted.cssTextColors
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
        emit({ phase: 'analyze', status: 'log', message: `✓ Business: "${entityMap.businessName}"` });
        emit({ phase: 'analyze', status: 'log', message: `✓ Category: ${entityMap.businessCategory} › ${entityMap.businessType}` });
        emit({ phase: 'analyze', status: 'log', message: `✓ Value Prop: ${entityMap.valueProposition}` });
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
          isHomepage: boolean,
          pagePlannedSections?: PlannedSection[],
          allPages?: { slug: string; title: string }[],
          pageIntent?: string,
          ownershipMap?: Record<string, string>,
          originalChecklist?: import('@/lib/types').AeoChecklist,
          realSiteContent?: RealSiteContent,
        ): Promise<string> => {
          // DRAFT
          emit({ phase: 'draft', status: 'log', message: `[ DRAFT ] Generating content for: ${pageTitle}...` });
          const aeoContent = await generateAeoContent(
            pageMarkdown, pageEntityMap, pageMeta, navLinkLabels,
            job.siteObjective, job.sitePersona,
            pagePlannedSections, // ← blueprint from site plan
            pageTitle,           // ← page identity for content isolation
            pageIntent,          // ← planner's stated purpose for this page
            ownershipMap,        // ← Option A: cross-page content ownership
            originalChecklist,   // ← checklist gaps → hard content mandates
            realSiteContent,     // ← real extracted content to use verbatim
          );
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
            fidelityMode: isHomepage ? job.fidelityMode : 'aeo-first',
            originalHtml: isHomepage ? pageHtml : undefined,
            fetchedStylesheets: isHomepage ? pageFetchedStylesheets : [],
            geminiLayoutCss,
            brandDna,
            sitePages: allPages ?? [],
          });

          // Persist aeoContent on the BuiltPage so the refine endpoint can patch sections
          upsertPage(jobId, { slug: pageSlug, title: pageTitle, url: pageUrl, html: built, status: 'done', aeoContent });

          return built;
        };

        // ── PHASE 3: STRATEGY — score original site + derive AEO strategy ─────
        emit({ phase: 'strategy', status: 'running', message: '[ STRATEGY ] Assessing original site and developing AEO strategy...' });
        let aeoStrategy;
        try {
          // Score the original site now (before synthesis) so the strategy
          // can drive the site structure plan (Steps 4+5 in PIPELINE_PROCESS.md).
          const originalAuditHtmlEarly = normalizeMarkdownToAuditHtml(
            extracted.markdown ?? '',
            extracted.meta?.description ?? '',
          );
          const originalScoreEarly = await auditAeoScore(originalAuditHtmlEarly, navPages.map(p => p.title)).catch(() => null);
          if (originalScoreEarly) {
            updateJob(jobId, { originalScore: originalScoreEarly });
            emit({ phase: 'strategy', status: 'log', message: `✓ Original site AEO score: ${originalScoreEarly.overall}/100` });
            emit({ phase: 'strategy', status: 'log', message: `  Content: ${originalScoreEarly.content_structure} | E-E-A-T: ${originalScoreEarly.eeat} | Technical: ${originalScoreEarly.technical} | Entity: ${originalScoreEarly.entity_alignment}` });

            aeoStrategy = await generateAeoStrategy(originalScoreEarly, entityMap);
            updateJob(jobId, { aeoStrategy });
            emit({ phase: 'strategy', status: 'log', message: `✓ Focus areas: ${aeoStrategy.focusAreas.join(', ')}` });
            emit({ phase: 'strategy', status: 'log', message: `✓ Priority sections: ${Object.entries(aeoStrategy.sectionPriorities).filter(([, v]) => v === 'critical').map(([k]) => k).join(', ')} (critical)` });
            aeoStrategy.contentGuidance.forEach(g =>
              emit({ phase: 'strategy', status: 'log', message: `  · ${g}` })
            );
          } else {
            emit({ phase: 'strategy', status: 'log', message: '⚠ Could not score original site — strategy will use defaults' });
          }
          emit({ phase: 'strategy', status: 'done', message: '[ STRATEGY ] AEO strategy complete.', data: { aeoStrategy } });
        } catch (stratErr) {
          emit({ phase: 'strategy', status: 'log', message: `⚠ Strategy phase error: ${stratErr instanceof Error ? stratErr.message : 'unknown'} — continuing` });
        }

        // ── E-E-A-T CONTENT EXTRACTION ─────────────────────────────────────────
        // Pull real testimonials, staff names, stats, trust signals from the scraped
        // markdown. If key E-E-A-T signals are missing, pre-scrape relevant sub-pages
        // (e.g. /about, /team) to find the content before homepage synthesis.
        emit({ phase: 'strategy', status: 'log', message: '[ EXTRACT ] Pulling real E-E-A-T signals from site content...' });

        const originalChecklist = getJob(jobId)?.originalScore?.checklist;
        let realContentMarkdown = extracted.markdown;

        // Pre-scrape cache: stores pageSlug → scraped data so we reuse it when
        // building those pages later rather than hitting Firecrawl twice.
        const preScrapeCache = new Map<string, { markdown: string; meta: { title?: string; description?: string }; html: string }>();

        if (originalChecklist) {
          const needsStaff = !originalChecklist.ee_hasNamedPeopleOrCredentials;
          const needsTestimonials = !originalChecklist.ee_hasTestimonialsOrReviews;
          const needsStats = !originalChecklist.ee_hasSpecificStats;

          // Only pre-scrape if we're actually missing E-E-A-T signals
          if (needsStaff || needsTestimonials || needsStats) {
            const pagesToPreScrape: { slug: string; title: string; url: string }[] = [];

            if (needsStaff || needsStats) {
              // About/Team pages are most likely to contain staff and credentials
              const aboutPage = navPages.find(p =>
                /^(about|team|staff|us)$/i.test(p.slug) ||
                /about|team|staff/i.test(p.title)
              );
              if (aboutPage && aboutPage.slug !== 'home') {
                pagesToPreScrape.push(aboutPage);
              }
            }

            if (needsTestimonials) {
              // Testimonials/Reviews pages
              const reviewPage = navPages.find(p =>
                /^(testimonials?|reviews?|clients?)$/i.test(p.slug) ||
                /testimonial|review/i.test(p.title)
              );
              if (reviewPage && reviewPage.slug !== 'home' && !pagesToPreScrape.some(p => p.slug === reviewPage.slug)) {
                pagesToPreScrape.push(reviewPage);
              }
            }

            if (pagesToPreScrape.length > 0) {
              emit({ phase: 'strategy', status: 'log', message: `[ EXTRACT ] Pre-scraping ${pagesToPreScrape.length} E-E-A-T page(s) for real content...` });
              for (const p of pagesToPreScrape) {
                try {
                  const pageData = await extractPage(p.url);
                  // Cache for reuse when building this page later — avoids double-scraping
                  preScrapeCache.set(p.slug, {
                    markdown: pageData.markdown,
                    meta: pageData.meta,
                    html: pageData.html,
                  });
                  realContentMarkdown += `\n\n--- ${p.title.toUpperCase()} PAGE ---\n${pageData.markdown}`;
                  emit({ phase: 'strategy', status: 'log', message: `  ✓ Pre-scraped: ${p.title} (${pageData.markdown.length} chars)` });
                } catch {
                  emit({ phase: 'strategy', status: 'log', message: `  ⚠ Could not pre-scrape ${p.title} — skipping` });
                }
              }
            }
          }
        }

        let realSiteContent: RealSiteContent | undefined;
        try {
          realSiteContent = await extractRealSiteContent(realContentMarkdown);
          emit({ phase: 'strategy', status: 'log', message:
            `✓ Real content extracted: ` +
            `${realSiteContent.staffMembers.length} staff, ` +
            `${realSiteContent.testimonials.length} testimonials, ` +
            `${realSiteContent.stats.length} stats, ` +
            `${realSiteContent.trustSignals.length} trust signals, ` +
            `${realSiteContent.services.length} services, ` +
            `${realSiteContent.locations.length} locations`
          });
          if (realSiteContent.staffMembers.length > 0) emit({ phase: 'strategy', status: 'log', message: `  • Staff: ${realSiteContent.staffMembers.slice(0, 2).join('; ')}` });
          if (realSiteContent.testimonials.length > 0) emit({ phase: 'strategy', status: 'log', message: `  • Testimonials: ${realSiteContent.testimonials[0].substring(0, 80)}...` });
          if (realSiteContent.stats.length > 0) emit({ phase: 'strategy', status: 'log', message: `  • Stats: ${realSiteContent.stats.slice(0, 2).join('; ')}` });
        } catch (extractErr) {
          emit({ phase: 'strategy', status: 'log', message: `⚠ Real content extraction failed — continuing without: ${extractErr instanceof Error ? extractErr.message : 'unknown'}` });
        }

        // ── PHASE 2.5: PLAN ───────────────────────────────────────────────────
        emit({ phase: 'plan', status: 'running', message: '[ PLAN ] Generating AEO site structure blueprint...' });
        let sitePlan;
        try {
          sitePlan = await generateSitePlan(
            entityMap,
            job.siteObjective,
            job.sitePersona,
            navPages,
            aeoStrategy,  // ← Step 5 feeds Step 6
          );
          updateJob(jobId, { sitePlan });
          emit({ phase: 'plan', status: 'log', message: `✓ Site plan: ${sitePlan.pages.length} page(s), ${sitePlan.pages.reduce((t, p) => t + p.sections.length, 0)} total sections` });
          sitePlan.pages.forEach(p => {
            const critical = p.sections.filter(s => s.importance === 'critical').length;
            emit({ phase: 'plan', status: 'log', message: `  · ${p.title}: ${p.sections.length} sections (${critical} critical)` });
          });
          emit({ phase: 'plan', status: 'done', message: '[ PLAN ] Site structure blueprint complete.', data: { sitePlan } });
        } catch (planErr) {
          emit({ phase: 'plan', status: 'log', message: `⚠ Site plan failed — falling back to free-form generation: ${planErr instanceof Error ? planErr.message : 'unknown'}` });
          emit({ phase: 'plan', status: 'done', message: '[ PLAN ] Skipped (using free-form fallback).' });
        }

        // Option A: compute cross-page ownership map from the plan
        const ownershipMap: Record<string, string> = sitePlan ? computeOwnershipMap(sitePlan) : {};
        if (Object.keys(ownershipMap).length > 0) {
          emit({ phase: 'plan', status: 'log', message: `✓ Ownership map: ${Object.entries(ownershipMap).map(([t, p]) => `${t}→${p}`).join(', ')}` });
        }

        // ── PHASE 3+4: HOMEPAGE ───────────────────────────────────────────────
        emit({ phase: 'draft', status: 'running', message: `[ DRAFT ] Processing homepage (1/${navPages.length})...` });
        updatePhase(jobId, 'draft', { status: 'running', startedAt: Date.now() });

        emit({ phase: 'synthesize', status: 'running', message: '[ SYNTHESIZE ] Building homepage HTML...' });
        updatePhase(jobId, 'synthesize', { status: 'running', startedAt: Date.now() });
        if (extracted.fetchedStylesheets.length === 0) {
          emit({ phase: 'synthesize', status: 'log', message: '⚠ Option C: no same-origin stylesheets found (site may use JS-injected CSS)' });
        }

        upsertPage(jobId, { slug: 'home', title: 'Home', url: job.url, html: '', status: 'running' });

        // Compute the canonical page list for cross-site nav — known ahead of time from plan
        const deepHubArch = job.sitePersona?.architecture === 'deep-hub';
        const allSitePagesForNav: { slug: string; title: string }[] = [
          { slug: 'home', title: 'Home' },
          ...subPages.map(p => ({ slug: p.slug, title: p.title })),
          ...(deepHubArch && sitePlan
            ? sitePlan.pages
                .filter(p => p.slug !== 'home' && !subPages.some(sp => sp.slug === p.slug))
                .map(p => ({ slug: p.slug, title: p.title }))
            : []),
        ];

        const homePlan = sitePlan?.pages.find(p => p.slug === 'home');
        const homeHtml = await buildPage(
          'home', 'Home', job.url,
          extracted.markdown, extracted.meta, extracted.html,
          tokens, entityMap, extracted.fetchedStylesheets,
          true,
          homePlan?.sections,
          allSitePagesForNav,
          homePlan?.intent,
          ownershipMap,
          originalChecklist,
          realSiteContent,
        );

        // buildPage already calls upsertPage with aeoContent — just sync remaining phases
        updatePhase(jobId, 'draft', { status: 'done', completedAt: Date.now() });
        emit({ phase: 'draft', status: 'done', message: '[ DRAFT ] Content strategy complete.' });
        updatePhase(jobId, 'synthesize', { status: 'done', completedAt: Date.now(), builtHtml: homeHtml });
        emit({ phase: 'synthesize', status: 'log', message: `✓ Homepage: ${homeHtml.length} chars` });
        emit({ phase: 'synthesize', status: 'done', message: '[ SYNTHESIZE ] Homepage complete.' });


        // ── SUB-PAGES ─────────────────────────────────────────────────────────
        //
        // Two sources of sub-pages:
        //  A. Firecrawl-discovered pages (real URLs we can scrape)
        //  B. Site-plan-only pages (deep-hub: generated from homepage content
        //     when the original site is single-page / SPA / anchor-based)
        //
        // When architecture='deep-hub', the sitePlan is authoritative — we
        // build ALL plan pages, even if Firecrawl couldn't discover them.
        const isDeepHub = job.sitePersona?.architecture === 'deep-hub';

        // Pages in the plan that were NOT discovered by Firecrawl
        const planOnlyPages: NavPage[] = [];
        if (isDeepHub && sitePlan) {
          for (const planPage of sitePlan.pages) {
            if (planPage.slug === 'home') continue;
            const alreadyDiscovered = subPages.some(p => p.slug === planPage.slug);
            if (!alreadyDiscovered) {
              planOnlyPages.push({
                slug: planPage.slug,
                title: planPage.title,
                url: `${job.url.replace(/\/$/, '')}/${planPage.slug}`,
              });
            }
          }
          if (planOnlyPages.length > 0) {
            emit({ phase: 'system', status: 'log', message: `▶ Deep Hub: ${planOnlyPages.length} plan-only page(s) will be synthesised from homepage content` });
          }
        }

        const allSubPages = [...subPages, ...planOnlyPages];

        if (allSubPages.length > 0) {
          emit({ phase: 'system', status: 'log', message: `▶ Processing ${allSubPages.length} sub-page(s)...` });

          for (let i = 0; i < allSubPages.length; i++) {
            const page = allSubPages[i];
            const isPlanOnly = planOnlyPages.some(p => p.slug === page.slug);
            emit({ phase: 'system', status: 'log', message: `▶ Page ${i + 2}/${allSubPages.length + 1}: ${page.title}${isPlanOnly ? ' (synthesised)' : ` (${page.url})`}` });
            upsertPage(jobId, { slug: page.slug, title: page.title, url: page.url, html: '', status: 'running' });

            try {
              let pageMarkdown: string;
              let pageMeta: { title?: string; description?: string };
              let pageHtmlSource: string;

              // Use cached pre-scrape data if available (avoids double Firecrawl call)
              if (isPlanOnly) {
                // No real URL — use homepage content as source material.
                // The sitePlan section blueprint ensures each page is distinct.
                pageMarkdown = extracted.markdown;
                pageMeta = { title: page.title, description: entityMap.primaryService };
                pageHtmlSource = extracted.html;
                emit({ phase: 'system', status: 'log', message: `  ↻ Synthesising from homepage content (plan-guided sections)` });
              } else if (preScrapeCache.has(page.slug)) {
                // Reuse content we already fetched during the E-E-A-T pre-scrape
                const cached = preScrapeCache.get(page.slug)!;
                pageMarkdown = cached.markdown;
                pageMeta = cached.meta;
                pageHtmlSource = cached.html;
                emit({ phase: 'system', status: 'log', message: `  ✓ Using pre-scraped content for ${page.title} (${pageMarkdown.length} chars)` });
              } else {
                const pageExtracted = await extractPage(page.url);
                pageMarkdown = pageExtracted.markdown;
                pageMeta = pageExtracted.meta;
                pageHtmlSource = pageExtracted.html;
                emit({ phase: 'system', status: 'log', message: `  ✓ Scraped: ${pageMarkdown.length} chars of content` });
              }

              const pagePlan = sitePlan?.pages.find(p => p.slug === page.slug);
              const pageHtml = await buildPage(
                page.slug, page.title, page.url,
                pageMarkdown, pageMeta, pageHtmlSource,
                tokens, entityMap, [],
                false,
                pagePlan?.sections,
                allSitePagesForNav,
                pagePlan?.intent,
                ownershipMap,
                originalChecklist,
                realSiteContent,
              );

              emit({ phase: 'system', status: 'log', message: `  ✓ ${page.title} built: ${pageHtml.length} chars` });

            } catch (err) {
              const msg = err instanceof Error ? err.message : 'unknown error';
              upsertPage(jobId, { slug: page.slug, title: page.title, url: page.url, html: '', status: 'error', error: msg });
              emit({ phase: 'system', status: 'log', message: `  ✗ ${page.title} failed: ${msg}` });
            }
          }

          emit({ phase: 'system', status: 'log', message: `✓ All ${allSubPages.length + 1} pages processed.` });
        }

        const totalPages = 1 + allSubPages.length;


        // ── PHASE 5: AUDIT ─────────────────────────────────────────────────────
        emit({ phase: 'audit', status: 'running', message: '[ AUDIT ] Running simulated AI crawler...' });
        updatePhase(jobId, 'audit', { status: 'running', startedAt: Date.now() });

        const crawledTitles = navPages.map(p => p.title);

        // Caching: skip re-audit if scores are already stored for this job
        let score: import('@/lib/types').AeoScore;
        let originalScore: import('@/lib/types').AeoScore | null = null;

        const cachedScore = getJob(jobId)?.phases.audit.score;
        if (cachedScore) {
          score = cachedScore;
          originalScore = getJob(jobId)?.originalScore ?? null;
          emit({ phase: 'audit', status: 'log', message: '✓ AEO scores loaded from cache — skipping re-audit' });
        } else {
          // Normalize original markdown → semantic HTML for a fair, comparable audit
          const originalAuditHtml = normalizeMarkdownToAuditHtml(
            extracted.markdown.substring(0, 15000),
            extracted.meta.description || '',
          );

          // Run rebuilt-site audit + original-site audit in parallel
          const [rebuiltScore, maybeOriginalScore] = await Promise.all([
            auditAeoScore(homeHtml, crawledTitles),
            auditAeoScore(originalAuditHtml, crawledTitles).catch(() => null),
          ]);

          score = rebuiltScore;
          originalScore = maybeOriginalScore;
          if (originalScore) updateJob(jobId, { originalScore });
        }

        emit({ phase: 'audit', status: 'log', message: `✓ Overall AEO Score: ${score.overall}/100` });
        if (originalScore) {
          emit({ phase: 'audit', status: 'log', message: `✓ Original site score: ${originalScore.overall}/100 → improvement: +${score.overall - originalScore.overall}` });
        }
        emit({ phase: 'audit', status: 'log', message: `✓ AI can summarize: ${score.canSummarizeIn2Sentences ? 'YES ✓' : 'NO — needs improvement'}` });

        updatePhase(jobId, 'audit', { status: 'done', completedAt: Date.now(), score });
        updateJob(jobId, { status: 'done' });
        emit({ phase: 'audit', status: 'done', message: '[ AUDIT ] Complete.', data: { score, originalScore } });
        emit({ phase: 'system', status: 'done', message: `▶ ALIAS COMPILER complete. ${totalPages} page(s) ready.` });



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
