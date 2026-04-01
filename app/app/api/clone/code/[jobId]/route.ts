import { NextRequest, NextResponse } from 'next/server';
import { getJob, getPage } from '@/lib/job-store';
import { buildTsxFiles } from '@/lib/tsx-synthesizer';

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * GET /api/clone/code/[jobId]?page=slug
 *
 * Returns generated TypeScript + Tailwind CSS source files for a built page.
 * Response: { files: { name, language, content }[] }
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const { jobId } = await params;
  const pageSlug   = req.nextUrl.searchParams.get('page') ?? 'home';

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const page = getPage(jobId, pageSlug);
  if (!page) {
    return NextResponse.json({ error: `Page "${pageSlug}" not found` }, { status: 404 });
  }
  if (!page.aeoContent) {
    return NextResponse.json({ error: 'Page has no content schema — run the pipeline first' }, { status: 400 });
  }

  const tokens   = job.phases.analyze.tokens;
  const entityMap = job.phases.analyze.entityMap;
  if (!tokens || !entityMap) {
    return NextResponse.json({ error: 'Design tokens not available' }, { status: 400 });
  }

  // Use Brand DNA if available, fall back to DesignTokens colours
  const dna = job.brandDna ?? {
    palette: {
      dominant:   tokens.colors.surface,
      supporting: tokens.colors.primary,
      accent:     tokens.colors.accent,
      text:       tokens.colors.text,
      textMuted:  tokens.colors.secondary,
    },
    typePairing: {
      heading: tokens.typography.headingFont,
      body:    tokens.typography.bodyFont,
    },
    voiceTone: 'professional',
    industry:  entityMap.industry,
    brandName: entityMap.businessName,
  };

  const files = buildTsxFiles(page.aeoContent, entityMap, dna, pageSlug);

  return NextResponse.json({ files, pageSlug, jobId });
}
