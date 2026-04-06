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
    // Expose built pages as a summary list (no HTML) for the page-switcher UI
    pages: Object.values(job.pages).map(p => ({
      slug:       p.slug,
      title:      p.title,
      url:        p.url,
      status:     p.status,
      // Include aeoContent so the preview Refine panel knows which sections exist
      aeoContent: p.aeoContent,
    })),

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
      draft: { status: job.phases.draft.status },
      synthesize: {
        status: job.phases.synthesize.status,
        hasHtml: !!job.phases.synthesize.builtHtml || !!job.pages['home']?.html,
      },
      audit: {
        status: job.phases.audit.status,
        score: job.phases.audit.score,
      },
    },

    // Site structure plan (tactical grid)
    sitePlan: job.sitePlan ?? null,

    // AI Strategist report
    strategistReport: job.strategistReport ?? null,

    // Original (pre-rebuild) AEO score — null if the original-site audit failed
    originalScore: job.originalScore ?? null,

    // Brand DNA — extracted during the pipeline pre-pass
    brandDna: job.brandDna ?? null,

    // Whether the brand theme has been committed to all pages
    brandThemeApplied: job.brandThemeApplied ?? false,
  });
}
