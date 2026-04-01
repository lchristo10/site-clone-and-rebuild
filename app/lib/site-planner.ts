import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import {
  EntityMap,
  SiteObjective,
  SitePersona,
  PlannedPage,
  PlannedSection,
  SitePlan,
} from './types';

/**
 * Generates an AEO-optimised site structure plan (the tactical grid) before
 * synthesis begins. The plan determines which pages exist, how many sections
 * each page has, the purpose of each section, and its AEO criticality.
 *
 * The synthesizer then uses this plan as a strict blueprint, so Gemini fills
 * in content for exactly the sections specified rather than guessing freely.
 */
export async function generateSitePlan(
  entityMap: EntityMap,
  objective: SiteObjective,
  persona: SitePersona | undefined,
  discoveredPages: { slug: string; title: string; url: string }[],
): Promise<SitePlan> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          pages: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                slug:     { type: SchemaType.STRING },
                title:    { type: SchemaType.STRING },
                intent:   { type: SchemaType.STRING },
                sections: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      type:       { type: SchemaType.STRING },
                      label:      { type: SchemaType.STRING },
                      rationale:  { type: SchemaType.STRING },
                      importance: { type: SchemaType.STRING },
                    },
                    required: ['type', 'label', 'rationale', 'importance'],
                  },
                },
              },
              required: ['slug', 'title', 'intent', 'sections'],
            },
          },
        },
        required: ['pages'],
      },
    },
  });

  // ── Architecture + objective signals ──────────────────────────────────────
  const architectureNote = persona?.architecture === 'linear-story'
    ? 'ARCHITECTURE: Linear Story. Each page should have 4-5 focused sections maximum. Keep it narrative and flowing, not hub-and-spoke.'
    : 'ARCHITECTURE: Deep Hub. Pages can have 6-8 sections each. Each section is a self-contained information hub. Cross-references are valuable.';

  const objectiveNotes: Record<SiteObjective, string> = {
    'sell-products':  'OBJECTIVE: Sell Products. Home page MUST include: hero (critical), services/products (critical), testimonials (critical), cta (critical). FAQ is important.',
    'make-bookings':  'OBJECTIVE: Make Bookings. Home page MUST include: hero with booking CTA (critical), how-it-works/features (critical), about (critical), faq (critical), cta (critical).',
    'capture-leads':  'OBJECTIVE: Capture Leads. Home page MUST include: hero with lead hook (critical), about/credentials (critical), testimonials (critical), faq (critical), cta (critical).',
    'other':          'OBJECTIVE: Informational / Portfolio. Prioritise E-E-A-T. Hero (critical), about (critical), services (important), cta (important) as baseline.',
  };

  // ── AEO criticality rules (baked in) ─────────────────────────────────────
  const aeoRules = `
AEO CRITICALITY RULES — apply to every section:
- "critical": Sections an AI answer engine MUST read to accurately describe this business.
  Always critical: hero (with direct H1 answer capsule), about (with credentials/E-E-A-T signals),
  faq (structured Q&A for AI extraction), services/features (entity-rich service list), cta (conversion signal).
- "important": Sections that build trust and context but aren't load-bearing for AI summaries.
  Typically: testimonials, case studies, how-it-works, process steps, partnerships.
- "optional": Supplementary sections. Decorative or low signal-to-noise for AI crawlers.
  Typically: team bios beyond the founder, generic content, promotional banners.

Every page MUST have at least one "critical" section.
Home page MUST have at least 3 "critical" sections.`;

  // ── Discovered pages context ──────────────────────────────────────────────
  const isDeepHub = persona?.architecture === 'deep-hub';

  // For deep-hub: design a complete multi-page site regardless of what Firecrawl found.
  // For linear-story: only plan the pages that were actually discovered.
  const pagesContext = isDeepHub
    ? `\nARCHITECTURE MODE: Deep Hub (multi-page).
You MUST design a complete multi-page site structure optimised for AEO and the objective above.
Do NOT limit yourself to only the discovered pages — design the optimal full site.
The original site may be single-page or SPA-based; ignore that constraint.

DISCOVERED PAGES (if any — use as hints for naming/slugs only):
${discoveredPages.map(p => `- ${p.title} (slug: "${p.slug}")`).join('\n') || '- Only homepage discovered'}

REQUIRED: Generate 4-6 pages that are canonical for this business type and objective.
Each page must have a distinct AEO purpose and answer a different user question.
Use clean URL slugs (e.g. "services", "about", "faq", "contact", "gallery").`
    : `\nDISCOVERED PAGES ON THIS SITE (plan sections for each):
${discoveredPages.length > 0
  ? discoveredPages.map(p => `- ${p.title} (slug: "${p.slug}")`).join('\n')
  : '- Only homepage was found. Plan the Home page only.'}`;

  // Deep-hub page design guidance per objective
  const deepHubPageGuide: Record<SiteObjective, string> = {
    'sell-products': `
PAGES TO CREATE (sell-products + deep-hub):
1. Home (slug: "home") — brand intro, hero CTA, featured products, trust signals
2. Products / Shop (slug: "products") — full product catalogue, categories, featured items
3. About (slug: "about") — brand story, values, E-E-A-T credentials. Include a FAQ section here.
4. Contact (slug: "contact") — store locator, contact form, support CTA`,

    'make-bookings': `
PAGES TO CREATE (make-bookings + deep-hub):
1. Home (slug: "home") — hero with booking CTA, services summary, social proof
2. Services (slug: "services") — full service menu with descriptions, pricing hints, durations. Include a FAQ section.
3. About (slug: "about") — team credentials, studio story, E-E-A-T signals
4. Contact / Book (slug: "contact") — booking widget, location, hours`,

    'capture-leads': `
PAGES TO CREATE (capture-leads + deep-hub):
1. Home (slug: "home") — hero lead hook, credentials intro, results teaser
2. Services (slug: "services") — detailed service descriptions, outcomes, process. Include a FAQ section.
3. About (slug: "about") — founder story, qualifications, case studies
4. Contact (slug: "contact") — lead capture form, free consult offer`,

    'other': `
PAGES TO CREATE (informational + deep-hub):
1. Home (slug: "home") — brand overview, key services, navigation hub
2. About (slug: "about") — full story, team, mission, credentials
3. Services / Work (slug: "services") — detailed service or portfolio breakdown. Include a FAQ section.
4. Contact (slug: "contact") — inquiry form, location, availability`,
  };

  const prompt = `You are an AEO (Answer Engine Optimization) strategist. Your job is to design the optimal site structure for a rebuilt website — one that maximises performance for AI answer engines like Perplexity, Google AI Overviews, and Claude.

BUSINESS CONTEXT:
- Business: ${entityMap.businessName}
- Industry: ${entityMap.industry}
- Primary Service: ${entityMap.primaryService}
- Key Entities: ${entityMap.entities.join(', ')}
- Target Audience: ${entityMap.targetAudience}
${pagesContext}

${objectiveNotes[objective] ?? objectiveNotes['other']}
${architectureNote}
${isDeepHub ? (deepHubPageGuide[objective] ?? deepHubPageGuide['other']) : ''}

${aeoRules}

SECTION TYPES AVAILABLE:
hero | features | services | about | testimonials | faq | cta | generic

LABEL RULES:
- Write a 2-4 word "label" that describes this specific section's purpose for THIS business.
- Examples: "Direct answer capsule", "Core services list", "Trust signals", "Booking FAQ", "Lead capture CTA"
- Never use generic labels like "Section 1" or "Hero Section" — the label should be specific to the business.

RATIONALE RULES:
- Write 1-2 sentences explaining why this section exists from an AEO perspective.
- Be specific to the business type and objective.

OUTPUT:
${isDeepHub
  ? `- Generate ALL pages listed in PAGES TO CREATE above. Adapt the slugs/titles to fit this specific business.
- Each page MUST have a distinct purpose and answer different user questions.
- Home MUST be the first page. All other pages should be logically ordered.
- Each page's sections should be ordered from most to least AEO-critical.`
  : `- Return exactly the pages from the discovered list, in the same order, with optimal sections for each.
- Do NOT invent new pages — only plan sections for the pages provided.
- Each page's sections should be ordered from most to least AEO-critical.`}

STRICT PLANNING CONSTRAINTS (non-negotiable):
- NEVER create a standalone FAQ page. FAQ content belongs as a section (type="faq") within the most relevant page (e.g. Services, About).
- Use the MINIMUM number of pages needed to communicate the business clearly. Do not add pages for the sake of completeness.
- Use the MINIMUM number of sections per page needed for AEO impact. Prefer 3-5 focused sections over 7-8 diluted ones.
- Every section must earn its place: if a section doesn't directly answer a user question or signal E-E-A-T, omit it.

PAGE TITLE RULES (CRITICAL):
- Page titles must be SHORT and GENERIC — 1-2 words maximum.
- CORRECT: "Home", "Services", "About", "Contact", "Gallery", "Work", "Pricing"
- WRONG: "M11 Hair Salon", "Hairdressing Services | Newmarket", "About Our Studio", "FAQ Page"
- Do NOT include the business name in any page title.
- Do NOT include qualifying words like "Our", "Your", "Professional", "Premium".
- Use the slug as a guide: slug="services" → title="Services"
- The title is a navigation label, not an SEO heading.`;


  const result = await model.generateContent(prompt);

  const raw = JSON.parse(result.response.text()) as { pages: Array<{
    slug: string; title: string; intent: string;
    sections: Array<{ type: string; label: string; rationale: string; importance: string }>;
  }> };

  // Validate and normalise importance values
  const validImportance = new Set(['critical', 'important', 'optional']);
  const validTypes = new Set(['hero', 'features', 'services', 'about', 'testimonials', 'faq', 'cta', 'generic']);

  // Slug → canonical short title (hard override to prevent verbose Gemini titles)
  const CANONICAL_PAGE_TITLE: Record<string, string> = {
    home:          'Home',
    services:      'Services',
    service:       'Services',
    about:         'About',
    faq:           'FAQ',
    faqs:          'FAQ',
    contact:       'Contact',
    'contact-us':  'Contact',
    gallery:       'Gallery',
    work:          'Work',
    portfolio:     'Portfolio',
    pricing:       'Pricing',
    prices:        'Pricing',
    team:          'Team',
    blog:          'Blog',
    news:          'News',
    products:      'Products',
    shop:          'Shop',
    reviews:       'Reviews',
    testimonials:  'Reviews',
    booking:       'Book',
    book:          'Book',
    bookings:      'Book',
  };

  const pages: PlannedPage[] = raw.pages.map(p => ({
    slug: p.slug,
    title: CANONICAL_PAGE_TITLE[p.slug]
      ?? p.title.replace(/\s*[|–—].*$/, '').trim().split(/\s+/).slice(0, 2).join(' '),
    intent: p.intent,
    sections: p.sections.map(s => ({
      type: (validTypes.has(s.type) ? s.type : 'generic') as PlannedSection['type'],
      label: s.label,
      rationale: s.rationale,
      importance: (validImportance.has(s.importance) ? s.importance : 'optional') as PlannedSection['importance'],
    })),
  }));

  // ── Hard post-processing rules ─────────────────────────────────────────────
  // Rule 1: strip any standalone FAQ page (FAQ belongs as a section, not a page)
  const FAQ_SLUGS = new Set(['faq', 'faqs', 'faq-page', 'frequently-asked-questions']);
  const filteredPages = pages.filter(p => !FAQ_SLUGS.has(p.slug.toLowerCase()));

  // Rule 2: cap sections at 6 per page (sections are already ordered AEO-critical first)
  const MAX_SECTIONS_PER_PAGE = 6;
  const trimmedPages = filteredPages.map(p => ({
    ...p,
    sections: p.sections.slice(0, MAX_SECTIONS_PER_PAGE),
  }));

  return { generatedAt: Date.now(), pages: trimmedPages };
}
