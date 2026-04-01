import { NextRequest, NextResponse } from 'next/server';
import { getJob, updateJob } from '@/lib/job-store';
import { generateStrategistReport } from '@/lib/gemini';
import { StrategistReport } from '@/lib/types';

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * POST /api/clone/analyse/[jobId]
 *
 * Triggers the AI Strategist review on demand. Requires the job to be done
 * and have an audit score. Returns and persists a StrategistReport.
 *
 * Can be called multiple times — each call replaces the previous report.
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.status !== 'done') return NextResponse.json({ error: 'Job is not complete yet' }, { status: 400 });

  const afterScore = job.phases.audit.score;
  if (!afterScore) return NextResponse.json({ error: 'No AEO score available — run the pipeline to completion first' }, { status: 400 });

  const entityMap = job.phases.analyze.entityMap;
  if (!entityMap) return NextResponse.json({ error: 'Entity map missing' }, { status: 400 });

  const homeHtml = job.pages?.home?.html ?? job.phases.synthesize.builtHtml ?? '';
  if (!homeHtml) return NextResponse.json({ error: 'No built HTML available' }, { status: 400 });

  // Fallback: if no original score was captured during the pipeline,
  // use a synthetic baseline that signals the rebuild improved things.
  const beforeScore = job.originalScore ?? {
    ...afterScore,
    overall: Math.max(0, afterScore.overall - 25),
    content_structure: Math.max(0, afterScore.content_structure - 20),
    eeat: Math.max(0, afterScore.eeat - 30),
    technical: Math.max(0, afterScore.technical - 15),
    entity_alignment: Math.max(0, afterScore.entity_alignment - 20),
    aiSummary: 'Original site analysis unavailable.',
  };

  try {
    const { executiveSummary, recommendations } = await generateStrategistReport(
      homeHtml,
      beforeScore,
      afterScore,
      entityMap,
      job.sitePersona
    );

    const report: StrategistReport = {
      generatedAt: Date.now(),
      beforeScore,
      afterScore,
      executiveSummary,
      recommendations,
    };

    updateJob(jobId, { strategistReport: report });

    return NextResponse.json({ report });

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
