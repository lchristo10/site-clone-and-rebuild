import { NextRequest } from 'next/server';
import { getJob } from '@/lib/job-store';

type RouteContext = { params: Promise<{ jobId: string }> };

const PREVIEW_HEADERS = {
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com data: 'unsafe-inline'; img-src * data: blob:;",
};

export async function HEAD(_req: NextRequest, ctx: RouteContext) {
  const { jobId } = await ctx.params;
  const job = getJob(jobId);

  if (!job || !job.phases.synthesize.builtHtml) {
    return new Response(null, { status: 404 });
  }

  return new Response(null, { status: 200, headers: PREVIEW_HEADERS });
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { jobId } = await ctx.params;
  const job = getJob(jobId);

  if (!job) {
    return new Response('Job not found', { status: 404 });
  }

  const html = job.phases.synthesize.builtHtml;
  if (!html) {
    return new Response('Preview not ready yet', { status: 202 });
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...PREVIEW_HEADERS,
    },
  });
}
