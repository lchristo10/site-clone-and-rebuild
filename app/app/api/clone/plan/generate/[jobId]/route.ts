import { NextRequest, NextResponse } from 'next/server';
import { getJob, updateJob } from '@/lib/job-store';
import { generateSitePlan } from '@/lib/site-planner';

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * POST /api/clone/plan/generate/[jobId]
 *
 * Generates a site plan on demand for a job that was built before the Plan
 * phase existed (or if the plan generation failed during the pipeline).
 *
 * Uses the already-stored entityMap + page list so no re-scraping is needed.
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const entityMap = job.phases.analyze.entityMap;
  if (!entityMap) {
    return NextResponse.json(
      { error: 'Entity map not available — re-run the pipeline to generate a plan' },
      { status: 400 }
    );
  }

  // Build the page list from what was already built
  const discoveredPages = Object.values(job.pages).map(p => ({
    slug: p.slug,
    title: p.title,
    url: p.url,
  }));

  if (discoveredPages.length === 0) {
    return NextResponse.json({ error: 'No built pages found' }, { status: 400 });
  }

  try {
    const sitePlan = await generateSitePlan(
      entityMap,
      job.siteObjective,
      job.sitePersona,
      discoveredPages,
    );

    updateJob(jobId, { sitePlan });

    return NextResponse.json({ sitePlan });
  } catch (err) {
    console.error('[plan/generate] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Plan generation failed' },
      { status: 500 }
    );
  }
}
