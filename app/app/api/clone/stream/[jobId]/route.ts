import { NextRequest } from 'next/server';
import { getJob, updateJob, updatePhase } from '@/lib/job-store';
import { extractPage } from '@/lib/firecrawl';
import { analyzeDesignTokens, generateAeoContent, auditAeoScore } from '@/lib/gemini';
import { buildHtml } from '@/lib/synthesizer';
import { StreamEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteContext = { params: Promise<{ jobId: string }> };

function encode(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

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

        // ── PHASE 1: EXTRACT ─────────────────────────────────────────────────
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
          meta: extracted.meta,
        });
        emit({ phase: 'extract', status: 'done', message: '[ EXTRACT ] Complete.', data: { screenshotUrl: extracted.screenshotUrl, meta: extracted.meta } });

        // ── PHASE 2: ANALYZE ─────────────────────────────────────────────────
        emit({ phase: 'analyze', status: 'running', message: '[ ANALYZE ] Sending screenshot to Gemini Vision...' });
        updatePhase(jobId, 'analyze', { status: 'running', startedAt: Date.now() });

        const { tokens, entityMap } = await analyzeDesignTokens(extracted.screenshotUrl, extracted.markdown);

        emit({ phase: 'analyze', status: 'log', message: `✓ Primary color: ${tokens.colors.primary}` });
        emit({ phase: 'analyze', status: 'log', message: `✓ Heading font: ${tokens.typography.headingFont}` });
        emit({ phase: 'analyze', status: 'log', message: `✓ Layout: ${tokens.layout.navType} nav, ${tokens.layout.heroType} hero, ${tokens.layout.columnCount}-col` });
        emit({ phase: 'analyze', status: 'log', message: `✓ Business: "${entityMap.businessName}" (${entityMap.industry})` });
        emit({ phase: 'analyze', status: 'log', message: `✓ Entities: ${entityMap.entities.join(', ')}` });

        updatePhase(jobId, 'analyze', { status: 'done', completedAt: Date.now(), tokens, entityMap });
        emit({ phase: 'analyze', status: 'done', message: '[ ANALYZE ] Complete.', data: { tokens, entityMap } });

        // ── PHASE 3: DRAFT ───────────────────────────────────────────────────
        emit({ phase: 'draft', status: 'running', message: '[ DRAFT ] Generating AEO-first content outline...' });
        updatePhase(jobId, 'draft', { status: 'running', startedAt: Date.now() });

        const aeoContent = await generateAeoContent(extracted.markdown, entityMap, extracted.meta);

        emit({ phase: 'draft', status: 'log', message: `✓ Page title: "${aeoContent.title}"` });
        emit({ phase: 'draft', status: 'log', message: `✓ H1: "${aeoContent.h1}"` });
        emit({ phase: 'draft', status: 'log', message: `✓ Sections drafted: ${aeoContent.sections.length}` });
        emit({ phase: 'draft', status: 'log', message: `✓ JSON-LD schemas: ${aeoContent.jsonLd.length} blocks injected` });
        emit({ phase: 'draft', status: 'log', message: `✓ Internal link suggestions: ${aeoContent.internalLinkSuggestions.join(', ')}` });

        updatePhase(jobId, 'draft', { status: 'done', completedAt: Date.now(), aeoContent });
        emit({ phase: 'draft', status: 'done', message: '[ DRAFT ] Complete.', data: { sections: aeoContent.sections.length } });

        // ── PHASE 4: SYNTHESIZE ──────────────────────────────────────────────
        emit({ phase: 'synthesize', status: 'running', message: '[ SYNTHESIZE ] Assembling AEO-compliant HTML...' });
        updatePhase(jobId, 'synthesize', { status: 'running', startedAt: Date.now() });

        const builtHtml = buildHtml(tokens, aeoContent, entityMap, job.url);

        emit({ phase: 'synthesize', status: 'log', message: `✓ HTML generated: ${builtHtml.length} characters` });
        emit({ phase: 'synthesize', status: 'log', message: `✓ CSS tokens applied (${Object.keys(tokens.colors).length} color vars, 2 font stacks)` });
        emit({ phase: 'synthesize', status: 'log', message: `✓ Schema.org JSON-LD injected in <head>` });
        emit({ phase: 'synthesize', status: 'log', message: `✓ Semantic HTML5 structure: main/article/section/nav/footer` });

        updatePhase(jobId, 'synthesize', { status: 'done', completedAt: Date.now(), builtHtml });
        emit({ phase: 'synthesize', status: 'done', message: '[ SYNTHESIZE ] Complete.' });

        // ── PHASE 5: AUDIT ───────────────────────────────────────────────────
        emit({ phase: 'audit', status: 'running', message: '[ AUDIT ] Running simulated AI crawler...' });
        updatePhase(jobId, 'audit', { status: 'running', startedAt: Date.now() });

        const score = await auditAeoScore(builtHtml);

        emit({ phase: 'audit', status: 'log', message: `✓ Overall AEO Score: ${score.overall}/100` });
        emit({ phase: 'audit', status: 'log', message: `✓ Content Structure: ${score.content_structure}/100` });
        emit({ phase: 'audit', status: 'log', message: `✓ E-E-A-T: ${score.eeat}/100` });
        emit({ phase: 'audit', status: 'log', message: `✓ Technical: ${score.technical}/100` });
        emit({ phase: 'audit', status: 'log', message: `✓ Entity Alignment: ${score.entity_alignment}/100` });
        emit({ phase: 'audit', status: 'log', message: `✓ AI can summarize: ${score.canSummarizeIn2Sentences ? 'YES ✓' : 'NO — needs improvement'}` });
        emit({ phase: 'audit', status: 'log', message: `✓ AI summary: "${score.aiSummary}"` });

        updatePhase(jobId, 'audit', { status: 'done', completedAt: Date.now(), score });
        updateJob(jobId, { status: 'done' });
        emit({ phase: 'audit', status: 'done', message: '[ AUDIT ] Complete.', data: score });

        emit({ phase: 'system', status: 'done', message: '▶ ALIAS COMPILER pipeline complete. Preview ready.' });

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
