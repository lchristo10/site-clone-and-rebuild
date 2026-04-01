import { NextRequest, NextResponse } from 'next/server';
import { getJob, updatePhase } from '@/lib/job-store';

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * PATCH /api/clone/patch-tokens/[jobId]
 *
 * Merges user-edited color overrides into the in-memory job store so that
 * any downstream re-render or export picks up the adjusted palette.
 *
 * Body: { colors: { primary?, secondary?, surface?, accent?, text?, [custom]? } }
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { jobId } = await params;

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const body = await req.json() as { colors?: Record<string, string> };
  if (!body.colors || typeof body.colors !== 'object') {
    return NextResponse.json({ error: 'colors object required' }, { status: 400 });
  }

  const existingTokens = job.phases.analyze.tokens;
  if (!existingTokens) {
    return NextResponse.json({ error: 'No design tokens on this job yet' }, { status: 400 });
  }

  // Merge only the recognized core keys; extras are stored on a custom map
  const { primary, secondary, surface, accent, text, ...custom } = body.colors;

  const updatedColors = {
    ...existingTokens.colors,
    ...(primary   ? { primary }   : {}),
    ...(secondary ? { secondary } : {}),
    ...(surface   ? { surface }   : {}),
    ...(accent    ? { accent }    : {}),
    ...(text      ? { text }      : {}),
    // Keep any extra custom keys for downstream use
    ...custom,
  };

  updatePhase(jobId, 'analyze', {
    ...job.phases.analyze,
    tokens: {
      ...existingTokens,
      colors: updatedColors,
    },
  });

  return NextResponse.json({ ok: true, colors: updatedColors });
}
