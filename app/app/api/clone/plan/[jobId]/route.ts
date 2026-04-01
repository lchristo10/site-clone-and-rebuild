import { NextRequest, NextResponse } from 'next/server';
import { getJob, updateJob, getPage, upsertPage } from '@/lib/job-store';
import { generateAeoContent } from '@/lib/gemini';
import { buildHtml } from '@/lib/synthesizer';
import { PlannedPage, SitePlan } from '@/lib/types';

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * GET /api/clone/plan/[jobId]
 * Returns the current site plan.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  return NextResponse.json({ sitePlan: job.sitePlan ?? null });
}

/**
 * PATCH /api/clone/plan/[jobId]
 *
 * Updates a single page in the site plan. Supports:
 *   - Updating a page's sections (triggers full page regeneration from the new plan)
 *   - Deleting a page (removes from both sitePlan and job.pages)
 *
 * Body: { action: 'update-page', page: PlannedPage }
 *       | { action: 'delete-page', slug: string }
 *
 * Changes are scoped to ONLY the affected page. All other pages are untouched.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.status !== 'done') return NextResponse.json({ error: 'Job is not complete yet' }, { status: 400 });

  const body = await req.json() as
    | { action: 'update-page'; page: PlannedPage }
    | { action: 'delete-page'; slug: string };

  const currentPlan = job.sitePlan;
  if (!currentPlan) return NextResponse.json({ error: 'No site plan found on this job' }, { status: 404 });

  // ── DELETE PAGE ─────────────────────────────────────────────────────────────
  if (body.action === 'delete-page') {
    const { slug } = body;
    if (slug === 'home') {
      return NextResponse.json({ error: 'Cannot delete the home page' }, { status: 400 });
    }

    // Remove from plan — other pages untouched
    const updatedPlan: SitePlan = {
      ...currentPlan,
      pages: currentPlan.pages.filter(p => p.slug !== slug),
    };

    // Remove from built pages — other pages untouched
    const updatedPages = { ...job.pages };
    delete updatedPages[slug];

    updateJob(jobId, { sitePlan: updatedPlan, pages: updatedPages });

    return NextResponse.json({ sitePlan: updatedPlan });
  }

  // ── UPDATE PAGE (section changes) ────────────────────────────────────────────
  if (body.action === 'update-page') {
    const { page: updatedPage } = body;

    // 1. Persist the updated plan — only replace this page's entry
    const updatedPlan: SitePlan = {
      ...currentPlan,
      pages: currentPlan.pages.map(p => p.slug === updatedPage.slug ? updatedPage : p),
    };
    updateJob(jobId, { sitePlan: updatedPlan });

    // 2. Rebuild just this page using the updated section blueprint
    const tokens = job.phases.analyze.tokens;
    const entityMap = job.phases.analyze.entityMap;
    if (!tokens || !entityMap) {
      return NextResponse.json({ error: 'Design tokens not available' }, { status: 400 });
    }

    const existingPage = getPage(jobId, updatedPage.slug);
    if (!existingPage) {
      return NextResponse.json({ error: `Page "${updatedPage.slug}" not found — cannot rebuild` }, { status: 404 });
    }

    try {
      // Generate new AeoContent using the updated plan as the section blueprint
      const aeoContent = await generateAeoContent(
        existingPage.aeoContent
          ? JSON.stringify(existingPage.aeoContent) // use existing content as source material
          : '',
        entityMap,
        { title: existingPage.title },
        [],
        job.siteObjective,
        job.sitePersona,
        updatedPage.sections, // ← the blueprint from the edited plan
      );

      // Re-synthesize only this page — all other pages are untouched
      const updatedHtml = buildHtml(tokens, aeoContent, entityMap, existingPage.url, {
        fidelityMode: 'aeo-first',
        brandDna: job.brandDna,
      });

      // Persist — only this page is updated
      upsertPage(jobId, {
        slug: existingPage.slug,
        title: existingPage.title,
        url: existingPage.url,
        html: updatedHtml,
        status: 'done',
        aeoContent,
      });

      return NextResponse.json({ sitePlan: updatedPlan, pageSlug: updatedPage.slug });

    } catch (err) {
      console.error('[plan patch] rebuild error:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Page rebuild failed' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
