import { NextRequest } from 'next/server';
import { getJob } from '@/lib/job-store';

type RouteContext = { params: Promise<{ jobId: string }> };

const PREVIEW_HEADERS = {
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com data: 'unsafe-inline'; img-src * data: blob:;",
  // Never cache — content changes after every refine/apply
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

export async function HEAD(_req: NextRequest, ctx: RouteContext) {
  const { jobId } = await ctx.params;
  const job = getJob(jobId);

  // Ready if homepage or legacy builtHtml exists
  const ready = job && (job.pages['home']?.html || job.phases.synthesize.builtHtml);
  if (!ready) return new Response(null, { status: 404 });

  return new Response(null, { status: 200, headers: PREVIEW_HEADERS });
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { jobId } = await ctx.params;
  const job = getJob(jobId);

  if (!job) return new Response('Job not found', { status: 404 });

  // ?page=slug — serve a specific page
  const pageSlug = new URL(req.url).searchParams.get('page') || 'home';
  const page = job.pages[pageSlug];

  if (page?.html) {
    return new Response(page.html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...PREVIEW_HEADERS },
    });
  }

  // Fallback: homepage from legacy synthesize phase field
  const fallbackHtml = job.phases.synthesize.builtHtml;
  if (fallbackHtml) {
    return new Response(fallbackHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...PREVIEW_HEADERS },
    });
  }

  return new Response('Preview not ready yet', { status: 202 });
}
