import { NextRequest, NextResponse } from 'next/server';
import { getJob, getPage, upsertPage } from '@/lib/job-store';
import { generateAeoContent } from '@/lib/gemini';
import { buildHtml } from '@/lib/synthesizer';
import { AeoSection } from '@/lib/types';

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * POST /api/clone/refine/[jobId]
 *
 * Regenerates a single section within an already-built page without
 * re-running the full pipeline. Expects:
 *   { pageSlug: string; sectionType: string; instruction: string }
 *
 * Returns:
 *   { sectionHtml: string }   — the rebuilt section's outer HTML
 *   { pageHtml: string }      — the full updated page HTML
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { jobId } = await params;

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  if (job.status !== 'done') {
    return NextResponse.json({ error: 'Job is not complete yet' }, { status: 400 });
  }

  const body = await req.json() as {
    pageSlug?: string;
    sectionType?: string;
    instruction?: string;
    recommendationId?: string;
    userComment?: string;
  };
  const { pageSlug, sectionType, userComment, recommendationId } = body;
  let { instruction } = body;

  // If applying a strategist recommendation, build instruction from it
  if (recommendationId && job.strategistReport) {
    const rec = job.strategistReport.recommendations.find(r => r.id === recommendationId);
    if (rec) {
      instruction = rec.suggestedAction;
      if (userComment?.trim()) {
        instruction += `\n\nAdditional user direction: ${userComment.trim()}`;
      }
    }
  }

  if (!pageSlug || !sectionType || !instruction?.trim()) {
    return NextResponse.json({ error: 'pageSlug, sectionType, and instruction are required' }, { status: 400 });
  }


  const page = getPage(jobId, pageSlug);
  if (!page) {
    return NextResponse.json({ error: `Page "${pageSlug}" not found` }, { status: 404 });
  }
  if (!page.aeoContent) {
    return NextResponse.json({ error: 'Page has no section schema — cannot refine' }, { status: 400 });
  }

  const tokens = job.phases.analyze.tokens;
  const entityMap = job.phases.analyze.entityMap;
  if (!tokens || !entityMap) {
    return NextResponse.json({ error: 'Design tokens not available on this job' }, { status: 400 });
  }

  // Find the section to refine
  const sectionIdx = page.aeoContent.sections.findIndex(s => s.type === sectionType);
  if (sectionIdx === -1) {
    return NextResponse.json({ error: `Section type "${sectionType}" not found in page` }, { status: 404 });
  }

  // Build an enriched markdown prompt for Gemini that includes the current section
  // content + the user's refinement instruction
  const currentSection = page.aeoContent.sections[sectionIdx];
  const refinementPrompt = `
You are refining a single page section. Keep the same section type, semantic structure, and brand voice.

## Current section data
Type: ${currentSection.type}
Heading: ${currentSection.heading}
Body: ${currentSection.body}
Items: ${currentSection.listItems?.join(' | ') ?? 'none'}

## Refinement instruction from user
${instruction}

## Business context
Business: ${entityMap.businessName} (${entityMap.industry})
Primary service: ${entityMap.primaryService}

Rewrite ONLY this section following the instruction. Maintain brand consistency.
Return a short markdown summary of the updated section content — the heading, a one-paragraph body, and key bullet points if applicable.
`.trim();

  try {
    // Re-generate just this section's content via Gemini
    const refinedContent = await generateAeoContent(
      refinementPrompt,
      entityMap,
      { title: page.aeoContent.title, description: page.aeoContent.metaDescription },
      []
    );

    // Take the first section from the result (it will contain our refined section)
    const refinedSection: AeoSection = refinedContent.sections[0] ?? {
      ...currentSection,
      body: instruction, // last-resort fallback
    };
    // Keep the original section type
    refinedSection.type = currentSection.type as AeoSection['type'];

    // Splice the refined section into the page's aeoContent
    const updatedAeoContent = {
      ...page.aeoContent,
      sections: [
        ...page.aeoContent.sections.slice(0, sectionIdx),
        refinedSection,
        ...page.aeoContent.sections.slice(sectionIdx + 1),
      ],
    };

    // Re-synthesize the full page with the updated section schema
    const updatedHtml = buildHtml(tokens, updatedAeoContent, entityMap, page.url, {
      fidelityMode: 'aeo-first',
      brandDna: job.brandDna,
    });

    // Extract just the refined section's HTML for the partial response
    const sectionMatch = updatedHtml.match(
      new RegExp(`<section[^>]*data-section="${sectionType}"[^>]*>[\\s\\S]*?</section>`, 'i')
    );
    const sectionHtml = sectionMatch ? sectionMatch[0] : '';

    // Persist the updated page
    upsertPage(jobId, {
      slug: page.slug,
      title: page.title,
      url: page.url,
      html: updatedHtml,
      status: 'done',
      aeoContent: updatedAeoContent,
    });

    return NextResponse.json({
      sectionHtml,
      pageHtml: updatedHtml,
      sectionType,
      pageSlug,
    });

  } catch (err) {
    console.error('[refine] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Refinement failed' },
      { status: 500 }
    );
  }
}
