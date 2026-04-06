import { NextRequest, NextResponse } from 'next/server';
import { getJob, upsertPage, updateJob } from '@/lib/job-store';
import { buildHtml } from '@/lib/synthesizer';
import { BrandDNA } from '@/lib/types';

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * POST /api/clone/apply-brand/[jobId]
 *
 * Accepts an optional BrandDNA override in the request body (user may have
 * edited hex codes / font names in the UI). Falls back to the job's extracted
 * BrandDNA if none is supplied.
 *
 * Rebuilds the stored HTML for ALL built pages with the brand DNA baked in,
 * then sets job.brandThemeApplied = true and stores the edited DNA so future
 * status calls expose it.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const tokens = job.phases.analyze.tokens;
  const entityMap = job.phases.analyze.entityMap;

  if (!tokens || !entityMap) {
    return NextResponse.json(
      { error: 'Job not fully analysed yet — tokens or entityMap missing' },
      { status: 400 }
    );
  }

  // Accept an edited BrandDNA from the request body, or fall back to the
  // DNA that was extracted during the pipeline run.
  let body: { brandDna?: Partial<BrandDNA>; brandMode?: 'full' | 'accent-only' } = {};
  try { body = await req.json(); } catch { /* no body is fine */ }

  const sourceDna = job.brandDna;
  if (!sourceDna && !body.brandDna) {
    return NextResponse.json(
      { error: 'No brand DNA available on this job — run the pipeline first' },
      { status: 400 }
    );
  }

  const brandMode = body.brandMode ?? 'full';

  // Merge user edits on top of the extracted DNA
  const appliedDna: BrandDNA = {
    ...(sourceDna ?? { typePairing: { heading: 'Inter', body: 'Inter' }, voiceTone: '', industry: '', brandName: '' }),
    ...body.brandDna,
    palette: {
      ...(sourceDna?.palette ?? { dominant: '#ffffff', supporting: '#1a1a1a', accent: '#2563eb', text: '#111827', textMuted: '#6b7280' }),
      ...(body.brandDna?.palette ?? {}),
    },
    typePairing: {
      ...(sourceDna?.typePairing ?? { heading: 'Inter', body: 'Inter' }),
      ...(body.brandDna?.typePairing ?? {}),
    },
  };

  const allPages = Object.values(job.pages).filter(p => p.status === 'done' && p.aeoContent);
  if (allPages.length === 0) {
    return NextResponse.json({ error: 'No built pages found' }, { status: 400 });
  }

  const allSitePages = allPages.map(p => ({ slug: p.slug, title: p.title }));
  let pagesUpdated = 0;

  for (const page of allPages) {
    if (!page.aeoContent) continue;
    try {
      const rebuilt = buildHtml(tokens, page.aeoContent, entityMap, page.url, {
        detectedFontLinks: [],
        fidelityMode: 'aeo-first',
        brandDna: appliedDna,
        sitePages: allSitePages,
      });
      upsertPage(jobId, { ...page, html: rebuilt });
      pagesUpdated++;
    } catch (err) {
      console.error(`[apply-brand] Failed to rebuild page ${page.slug}:`, err);
    }
  }

  // Persist the applied DNA and flag on the job
  updateJob(jobId, { brandDna: appliedDna, brandThemeApplied: true });

  return NextResponse.json({ ok: true, pagesUpdated, appliedDna });
}
