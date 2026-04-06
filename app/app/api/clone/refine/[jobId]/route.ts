import { NextRequest, NextResponse } from 'next/server';
import { getJob, getPage, upsertPage } from '@/lib/job-store';
import { buildHtml } from '@/lib/synthesizer';
import { AeoSection } from '@/lib/types';
import { GoogleGenerativeAI } from '@google/generative-ai';

type RouteContext = { params: Promise<{ jobId: string }> };

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  return new GoogleGenerativeAI(apiKey);
}

/**
 * POST /api/clone/refine/[jobId]
 *
 * Regenerates a SINGLE section within an already-built page without
 * re-running the full pipeline. Expects:
 *   { pageSlug: string; sectionType: string; instruction: string }
 *
 * Fixes over the original implementation:
 *  1. Uses a targeted single-section Gemini prompt (not generateAeoContent which always
 *     returns a hero section as sections[0], cause subsequent sectionType lookups to fail).
 *  2. Passes sitePages to buildHtml so the multi-page horizontal nav is preserved
 *     (previously omitted, causing the nav to revert to stacked-display mode).
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { jobId } = await params;

  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.status !== 'done') return NextResponse.json({ error: 'Job is not complete yet' }, { status: 400 });

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
      if (userComment?.trim()) instruction += `\n\nAdditional user direction: ${userComment.trim()}`;
    }
  }

  if (!pageSlug || !sectionType || !instruction?.trim()) {
    return NextResponse.json({ error: 'pageSlug, sectionType, and instruction are required' }, { status: 400 });
  }

  const page = getPage(jobId, pageSlug);
  if (!page) return NextResponse.json({ error: `Page "${pageSlug}" not found` }, { status: 404 });
  if (!page.aeoContent) return NextResponse.json({ error: 'Page has no section schema — cannot refine' }, { status: 400 });

  const tokens = job.phases.analyze.tokens;
  const entityMap = job.phases.analyze.entityMap;
  if (!tokens || !entityMap) return NextResponse.json({ error: 'Design tokens not available on this job' }, { status: 400 });

  // ── Locate the target section ─────────────────────────────────────────────
  let sectionIdx = page.aeoContent.sections.findIndex(s => s.type === sectionType);

  // If the section type doesn't exist on this page (e.g. strategist emitted 'global'),
  // fall back gracefully to the most contextually relevant section we can find.
  if (sectionIdx === -1) {
    // Priority order: cta (for conversion recs), hero (for messaging recs),
    // features/services (for content recs), then anything.
    const fallbackOrder = ['cta', 'hero', 'features', 'services', 'about', 'testimonials', 'faq', 'generic'];
    for (const fallback of fallbackOrder) {
      const idx = page.aeoContent.sections.findIndex(s => s.type === fallback);
      if (idx !== -1) { sectionIdx = idx; break; }
    }
  }

  if (sectionIdx === -1) {
    return NextResponse.json({ error: `Section type "${sectionType}" not found in page and no fallback section exists` }, { status: 404 });
  }
  const currentSection = page.aeoContent.sections[sectionIdx];

  // ── Single-section Gemini call ────────────────────────────────────────────
  // Ask Gemini to return only the fields for THIS section as raw JSON.
  // Avoids the old bug where generateAeoContent always returned a hero section
  // as sections[0], so the wrong content was spliced in and subsequent looks
  // for other section types failed.
  const singleSectionPrompt = `You are refining one section of an AEO-optimised website.

## Target section (type: "${sectionType}")
Current heading: ${currentSection.heading}
Current body: ${currentSection.body}
Current items: ${currentSection.listItems?.join(' | ') ?? 'none'}

## Refinement instruction
${instruction}

## Business context
Business: ${entityMap.businessName} (${entityMap.industry})
Primary service: ${entityMap.primaryService}
Target audience: ${entityMap.targetAudience}

## Your task
Rewrite ONLY this section following the instruction. Keep the same section type.
Return ONLY raw JSON with exactly these fields (no markdown fences, no extra commentary):
{
  "heading": "...",
  "body": "...",
  "isList": true,
  "listItems": ["item 1", "item 2", "item 3"]
}
Set isList to false and listItems to [] if bullet points are not appropriate.`;

  try {
    const model = getGemini().getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.3 },
    });

    const result = await model.generateContent(singleSectionPrompt);
    const raw = result.response.text() ?? '';
    // Strip markdown code fences if Gemini adds them despite instructions
    const jsonText = raw
      .replace(/^```(?:json)?\s*/im, '')
      .replace(/\s*```\s*$/im, '')
      .trim();

    let parsed: { heading?: string; body?: string; isList?: boolean; listItems?: string[] } = {};
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.warn('[refine] Gemini returned non-JSON — keeping current section content. Raw:', raw.slice(0, 200));
    }

    const refinedSection: AeoSection = {
      type:         currentSection.type,
      headingLevel: currentSection.headingLevel,
      heading:      parsed.heading   ?? currentSection.heading,
      body:         parsed.body      ?? currentSection.body,
      isList:       parsed.isList    ?? currentSection.isList,
      listItems:    parsed.listItems ?? currentSection.listItems,
    };

    // ── Splice refined section back into page schema ──────────────────────
    const updatedAeoContent = {
      ...page.aeoContent,
      sections: [
        ...page.aeoContent.sections.slice(0, sectionIdx),
        refinedSection,
        ...page.aeoContent.sections.slice(sectionIdx + 1),
      ],
    };

    // ── Re-synthesize page ────────────────────────────────────────────────
    // MUST pass sitePages so the multi-page horizontal nav is preserved.
    // Previously omitted, causing the nav to silently revert to single-page
    // stacked-display mode after every refine.
    const allDonePages = Object.values(job.pages)
      .filter(p => p.status === 'done')
      .map(p => ({ slug: p.slug, title: p.title }));

    const updatedHtml = buildHtml(tokens, updatedAeoContent, entityMap, page.url, {
      fidelityMode: 'aeo-first',
      // Only apply the brand theme if the user explicitly saved it via the brand panel.
      // job.brandDna is always extracted during the pipeline pre-pass, so passing it
      // unconditionally would apply the brand palette every time a section is refined —
      // even before the user has chosen to use it.
      brandDna: job.brandThemeApplied ? job.brandDna : undefined,
      sitePages: allDonePages,
    });

    // Extract the refined section's outer HTML for the response (best-effort)
    const sectionMatch = updatedHtml.match(
      new RegExp(`<section[^>]*data-section="${sectionType}"[^>]*>[\\s\\S]*?</section>`, 'i')
    );
    const sectionHtml = sectionMatch ? sectionMatch[0] : '';

    // ── Persist ───────────────────────────────────────────────────────────
    upsertPage(jobId, {
      slug:       page.slug,
      title:      page.title,
      url:        page.url,
      html:       updatedHtml,
      status:     'done',
      aeoContent: updatedAeoContent,
    });

    return NextResponse.json({ sectionHtml, pageHtml: updatedHtml, sectionType, pageSlug });

  } catch (err) {
    console.error('[refine] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Refinement failed' },
      { status: 500 }
    );
  }
}
