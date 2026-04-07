import { NextRequest, NextResponse } from 'next/server';
import { getJob, updateJob } from '@/lib/job-store';
import { auditAeoScore, generateStrategistReport, computeExpectedGainForRec } from '@/lib/gemini';
import { StrategistReport, AeoChecklist } from '@/lib/types';

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * POST /api/clone/analyse/[jobId]
 *
 * Triggers the AI Strategist review on demand. Requires the job to be done.
 *
 * On every call:
 *  1. Re-runs auditAeoScore on the current built HTML (captures any refinements)
 *  2. Persists the fresh score to job.phases.audit.score
 *  3. Generates the strategist report with Gemini
 *  4. Attaches deterministic expectedScoreGain to each recommendation
 *
 * Can be called multiple times — each call replaces the previous report.
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.status !== 'done') return NextResponse.json({ error: 'Job is not complete yet' }, { status: 400 });

  const entityMap = job.phases.analyze.entityMap;
  if (!entityMap) return NextResponse.json({ error: 'Entity map missing' }, { status: 400 });

  const homeHtml = job.pages?.home?.html ?? job.phases.synthesize.builtHtml ?? '';
  if (!homeHtml) return NextResponse.json({ error: 'No built HTML available' }, { status: 400 });

  const beforeScore = job.originalScore;
  if (!beforeScore) return NextResponse.json(
    { error: 'Original site score is unavailable. Re-run the pipeline for this URL to generate an honest before/after comparison.' },
    { status: 400 }
  );

  try {
    // ── 1. Re-audit the current rebuilt HTML ─────────────────────────────────
    const crawledTitles = Object.values(job.pages).map(p => p.title).filter(Boolean);
    const freshScore = await auditAeoScore(homeHtml, crawledTitles);

    // ── 2. Persist the fresh score ───────────────────────────────────────────
    updateJob(jobId, {
      phases: {
        ...job.phases,
        audit: { ...job.phases.audit, score: freshScore },
      },
    });

    // ── 3. Generate strategist report ────────────────────────────────────────
    const { executiveSummary, recommendations } = await generateStrategistReport(
      homeHtml,
      beforeScore,
      freshScore,
      entityMap,
      job.sitePersona
    );

    // ── 4. Attach deterministic score gains ──────────────────────────────────
    const checklist = freshScore.checklist as AeoChecklist | undefined;
    const recsWithGain = recommendations.map(rec => ({
      ...rec,
      expectedScoreGain: checklist
        ? computeExpectedGainForRec(checklist, rec.id, rec.sectionType)
        : undefined,
    }));

    const report: StrategistReport = {
      generatedAt: Date.now(),
      beforeScore,
      afterScore: freshScore,
      executiveSummary,
      recommendations: recsWithGain,
    };

    updateJob(jobId, { strategistReport: report });

    // Return both the full report and the freshScore so the UI can sync immediately
    return NextResponse.json({ report, freshScore });

  } catch (err) {
    console.error('[analyse] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Strategist analysis failed' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clone/analyse/[jobId]
 *
 * Updates the status of one or more recommendations (accept / reject / add comment).
 * Body: { updates: Array<{ id: string; status?: RecommendationStatus; userComment?: string }> }
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (!job.strategistReport) return NextResponse.json({ error: 'No strategist report found' }, { status: 404 });

  const { updates } = await req.json() as {
    updates: Array<{ id: string; status?: string; userComment?: string }>;
  };

  const updatedRecs = job.strategistReport.recommendations.map(rec => {
    const patch = updates.find(u => u.id === rec.id);
    if (!patch) return rec;
    return {
      ...rec,
      ...(patch.status ? { status: patch.status as typeof rec.status } : {}),
      ...(patch.userComment !== undefined ? { userComment: patch.userComment } : {}),
    };
  });

  const updatedReport = { ...job.strategistReport, recommendations: updatedRecs };
  updateJob(jobId, { strategistReport: updatedReport });

  return NextResponse.json({ report: updatedReport });
}
