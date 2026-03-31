import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/job-store';

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { jobId } = await ctx.params;
  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.jobId,
    url: job.url,
    status: job.status,
    createdAt: job.createdAt,
    phases: {
      extract: {
        status: job.phases.extract.status,
        screenshotUrl: job.phases.extract.screenshotUrl,
        meta: job.phases.extract.meta,
      },
      analyze: {
        status: job.phases.analyze.status,
        tokens: job.phases.analyze.tokens,
        entityMap: job.phases.analyze.entityMap,
      },
      draft: {
        status: job.phases.draft.status,
      },
      synthesize: {
        status: job.phases.synthesize.status,
        hasHtml: !!job.phases.synthesize.builtHtml,
      },
      audit: {
        status: job.phases.audit.status,
        score: job.phases.audit.score,
      },
    },
  });
}
