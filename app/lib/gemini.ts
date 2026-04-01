import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { AeoContent, AeoScore, DesignTokens, EntityMap, SitePersona } from './types';

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY is not configured in .env.local');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

// ─── Phase 2: Vision Analysis → Design Tokens + Entity Map ───────────────────

export async function analyzeDesignTokens(
  screenshotUrl: string,
  markdown: string,
  detectedFontLinks: string[] = [],
  cssDefinedFonts?: { fontFaceNames: string[]; headingFont: string | null; bodyFont: string | null },
  cssTextColors?: { headingColor: string | null; bodyColor: string | null; linkColor: string | null }
): Promise<{ tokens: DesignTokens; entityMap: EntityMap }> {
  const model = getClient().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          tokens: {
            type: SchemaType.OBJECT,
            properties: {
              colors: {
                type: SchemaType.OBJECT,
                properties: {
                  primary: { type: SchemaType.STRING },
                  secondary: { type: SchemaType.STRING },
                  surface: { type: SchemaType.STRING },
                  text: { type: SchemaType.STRING },
                  accent: { type: SchemaType.STRING },
                  border: { type: SchemaType.STRING },
                },
                required: ['primary', 'secondary', 'surface', 'text', 'accent'],
              },
              typography: {
                type: SchemaType.OBJECT,
                properties: {
                  headingFont: { type: SchemaType.STRING },
                  bodyFont: { type: SchemaType.STRING },
                  baseSizePx: { type: SchemaType.NUMBER },
                  scaleRatio: { type: SchemaType.NUMBER },
                },
                required: ['headingFont', 'bodyFont', 'baseSizePx', 'scaleRatio'],
              },
              spacing: {
                type: SchemaType.OBJECT,
                properties: {
                  containerWidthPx: { type: SchemaType.NUMBER },
                  sectionPaddingPx: { type: SchemaType.NUMBER },
                  columnGapPx: { type: SchemaType.NUMBER },
                },
                required: ['containerWidthPx', 'sectionPaddingPx', 'columnGapPx'],
              },
              layout: {
                type: SchemaType.OBJECT,
                properties: {
                  navType: { type: SchemaType.STRING },
                  navStyle: { type: SchemaType.STRING }, // Option 3: 'horizontal' | 'stacked-display' | 'sidebar' | 'minimal'
                  heroType: { type: SchemaType.STRING },
                  columnCount: { type: SchemaType.NUMBER },
                },
                required: ['navType', 'navStyle', 'heroType', 'columnCount'],
              },
            },
            required: ['colors', 'typography', 'spacing', 'layout'],
          },
          entityMap: {
            type: SchemaType.OBJECT,
            properties: {
              businessName: { type: SchemaType.STRING },
              industry: { type: SchemaType.STRING },
              primaryService: { type: SchemaType.STRING },
              entities: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              targetAudience: { type: SchemaType.STRING },
            },
            required: ['businessName', 'industry', 'primaryService', 'entities', 'targetAudience'],
          },
        },
        required: ['tokens', 'entityMap'],
      },
    },
  });

  const imageResponse = await fetch(screenshotUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const imageBase64 = Buffer.from(imageBuffer).toString('base64');

  // Build the font hint — prioritise CDN links > @font-face names > element rules > screenshot
  let fontHint: string;
  if (detectedFontLinks.length > 0) {
    fontHint = `DETECTED FONT LINKS (extracted from the site HTML — use these font names exactly):\n${detectedFontLinks.join('\n')}`;
  } else if (cssDefinedFonts && (cssDefinedFonts.fontFaceNames.length > 0 || cssDefinedFonts.headingFont || cssDefinedFonts.bodyFont)) {
    const parts: string[] = ['CSS-DEFINED FONTS (extracted from the site\'s own stylesheets — use these exactly):'];
    if (cssDefinedFonts.fontFaceNames.length > 0)
      parts.push(`  @font-face declared families: ${cssDefinedFonts.fontFaceNames.join(', ')}`);
    if (cssDefinedFonts.headingFont)
      parts.push(`  Heading element (h1/h2/h3) font-family: ${cssDefinedFonts.headingFont}`);
    if (cssDefinedFonts.bodyFont)
      parts.push(`  Body/paragraph font-family: ${cssDefinedFonts.bodyFont}`);
    parts.push('Use these font names for headingFont and bodyFont. Do NOT default to Inter unless the CSS explicitly states it.');
    fontHint = parts.join('\n');
  } else {
    fontHint = 'No font data was extracted from stylesheets — infer font names from the screenshot. Be precise; do not default to Inter unless you can clearly identify it.';
  }

  // Build the text colour hint from CSS
  const textColorHint = cssTextColors && (cssTextColors.headingColor || cssTextColors.bodyColor || cssTextColors.linkColor)
    ? `TEXT COLOUR SIGNALS (extracted from CSS — prefer these over screenshot inference):\n` +
      (cssTextColors.headingColor ? `  Heading (h1/h2/h3) color: ${cssTextColors.headingColor}\n` : '') +
      (cssTextColors.bodyColor    ? `  Body/paragraph color: ${cssTextColors.bodyColor}\n` : '') +
      (cssTextColors.linkColor    ? `  Link/accent color: ${cssTextColors.linkColor}\n` : '')
    : '';

  const prompt = `You are a senior UI/UX designer and technical analyst with pixel-perfect colour vision.

Analyze this website screenshot and the markdown content below. Extract:

1. Design tokens:

   COLOUR RULES (critical — do not approximate):
   - Look at the actual rendered pixels in the screenshot
   - surface: the DOMINANT background colour as an exact hex code (e.g. #EDEAE4 not "cream")
   - text: the dominant body text colour as exact hex (e.g. #1A1A1A not "dark")
   - primary: the dominant brand/CTA colour as exact hex
   - secondary: a supporting brand colour as exact hex
   - accent: a highlight colour as exact hex
   - border: the subtle border/divider colour as exact hex
   - IMPORTANT: every colour field must be a UNIQUE hex value — no two fields may share the same hex code. If the site uses the same colour in two roles, choose the closest visually distinct alternative for the secondary role.
   ${textColorHint}

   FONT RULES:
   ${fontHint}
   - headingFont: the exact font family name used for headings
   - bodyFont: the exact font family name used for body text
   - baseSizePx: estimated base font size in pixels (usually 14-18)
   - scaleRatio: typographic scale ratio (usually 1.2-1.5)

   LAYOUT RULES:
   - navType: "fixed", "sticky", or "static"
   - navStyle: classify the navigation visual style:
       * "horizontal" — compact horizontal bar (most common)
       * "stacked-display" — large editorial nav where items are set at display/heading scale and may span multiple rows
       * "sidebar" — vertical sidebar navigation
       * "minimal" — logo only or logo + hamburger
   - heroType: "full-viewport", "split", or "minimal"
   - columnCount: main content column count (1, 2, or 3)
   - containerWidthPx: approx max content width in pixels
   - sectionPaddingPx: approx vertical padding between sections in pixels
   - columnGapPx: approx gap between columns in pixels

2. Entity map — identify the core semantic entities:
   - businessName: the company/brand name
   - industry: e.g. "SaaS", "Legal Services", "Hair Salon"
   - primaryService: what they primarily offer
   - entities: 5-8 key topic entities (specific terms this business is authoritative on)
   - targetAudience: who they serve

WEBSITE MARKDOWN CONTENT (for entity + design token extraction — extract all names, services, locations, credentials):
${markdown.substring(0, 6000)}

Return only valid JSON matching the schema.`;

  const result = await model.generateContent([
    { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
    { text: prompt },
  ]);

  const parsed = JSON.parse(result.response.text());
  return parsed as { tokens: DesignTokens; entityMap: EntityMap };
}

// ─── Option A: Screenshot-Driven Layout CSS Generation ────────────────────────

/**
 * Analyses the original screenshot and HTML structure to generate CSS that
 * visually replicates the layout. Used in Brand-First mode to restore styling
 * that was delivered via JavaScript (CSS-in-JS, CSS modules, etc.) and is
 * therefore unavailable to static scrapers.
 */
export async function generateLayoutCss(
  screenshotUrl: string,
  html: string
): Promise<string> {
  const model = getClient().getGenerativeModel({ model: 'gemini-2.5-flash' });

  const imageResponse = await fetch(screenshotUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const imageBase64 = Buffer.from(imageBuffer).toString('base64');

  // Send the first 4000 chars of HTML so Gemini can see actual class names / selectors
  const htmlSnippet = html.substring(0, 4000);

  const prompt = `You are a world-class CSS engineer reconstructing the visual layout of a website.

I'm giving you:
1. A screenshot of the original website (see image)
2. The first part of the original HTML (below)

Your task: write complete CSS that makes this HTML look visually identical to the screenshot.

CRITICAL REQUIREMENTS:
- Use the EXACT class names, IDs, and element selectors visible in the HTML below
- Replicate the layout structure faithfully:
  * Navigation: position (fixed/sticky/static), direction (horizontal/vertical), font size, spacing
  * Hero / main section: grid or flexbox layout, image position (left/right/background), text placement
  * Typography: font families, sizes, weights, letter-spacing as seen in the screenshot
  * Colors: background colors, text colors, border colors — sample exact hex values from the screenshot pixels
  * Spacing: padding, margin, gap values that match the visual density in the screenshot
- Use CSS Grid and/or Flexbox to accurately replicate multi-column or split layouts
- If the nav items appear at display scale (large font), reflect that in the CSS
- Position images correctly (e.g., if the hero photo spans the right 70% of the viewport, use grid/absolute positioning to achieve that)

ORIGINAL HTML (examine class names and structure):
${htmlSnippet}

Return ONLY raw CSS. No HTML. No explanations. No markdown code fences. Just CSS selectors and rules.`;

  const result = await model.generateContent([
    { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
    { text: prompt },
  ]);

  return result.response.text();
}

// ─── Phase 3: AEO Content Generation ─────────────────────────────────────────

const OBJECTIVE_GUIDANCE: Record<string, string> = {
  'sell-products': `
SITE OBJECTIVE: SELL PRODUCTS
- Hero section must lead with a compelling product value proposition and a "Shop Now" / "Browse Products" CTA
- Feature sections should highlight product quality, selection, USPs, and trust signals (reviews, returns, guarantees)
- Include a "Best Sellers" or "Featured Products" section concept
- CTA section must drive to purchase; use urgency/social proof where appropriate
- FAQ section should address common buying questions (shipping, returns, sizing, etc.)
- JSON-LD: include Product or ItemList schema alongside Organization`,

  'make-bookings': `
SITE OBJECTIVE: MAKE BOOKINGS
- Hero section must lead with a clear "Book Now" / "Schedule Appointment" CTA above the fold
- Feature sections should highlight ease of booking, availability, service variety, and what to expect
- Include a "How It Works" section (3-step process: browse → book → arrive)
- CTA section should drive directly to booking; mention convenience / no-waits
- FAQ should address booking process questions (cancellation, deposit, what to bring, etc.)
- JSON-LD: include Service schema with availability/booking hints`,

  'capture-leads': `
SITE OBJECTIVE: CAPTURE LEADS
- Hero must include a lead capture hook — a compelling offer, free resource, or consultation CTA
- Feature sections should build authority and trust (results, case studies, credentials)
- Include a "Why Choose Us" or "Our Process" section to reduce friction
- CTA section must be conversion-focused: offer a free consult, quote, or download
- FAQ should pre-empt objections and qualify the lead
- JSON-LD: include Organization + ProfessionalService schema`,

  'other': `
SITE OBJECTIVE: GENERAL / INFORMATIONAL
- Build a balanced, authoritative structure that informs and engages
- Ensure clear navigation signals and strong E-E-A-T content
- CTA should match the site's primary action (contact, learn more, explore)`,
};

/**
 * Build a persona guidance block from the 5-dimension Vibe Forge answers.
 * Injected into the AEO content prompt to shape copy tone, section count,
 * CTA style, and structural decisions.
 */
function buildPersonaGuidance(persona?: SitePersona): string {
  if (!persona) return '';

  const lines: string[] = ['\nSITE PERSONA (5-dimension design + copy profile):'];

  // Duel 1 — Layout
  if (persona.layout === 'spacious') {
    lines.push('- LAYOUT: Spacious & Airy. Use generous whitespace and large typography scale. Fewer elements per section. Apple/Stripe/Linear aesthetic. Prioritise breathing room over information density.');
  } else {
    lines.push('- LAYOUT: Information Dense. Pack value into every section. Bloomberg/product-dashboard aesthetic. More sections, tighter paragraphs. Lists over prose wherever possible.');
  }

  // Duel 2 — Tone
  if (persona.tone === 'professional') {
    lines.push('- TONE: The Professional. Authoritative, measured, evidence-backed. Formal register. Trust through expertise and social proof. Avoid slang, hyperbole, exclamation marks.');
  } else {
    lines.push('- TONE: The Disruptor. Punchy, provocative, electric. Short declarative sentences. Challenge industry norms directly. Use "X ≠ Y" and "Most agencies do A. We do B." constructs. Make bold claims and back them fast.');
  }

  // Duel 3 — Imagery
  if (persona.imagery === 'human-centric') {
    lines.push('- IMAGERY: Human-Centric. People-forward. Reference faces, stories, real transformation. Warm and relatable language. Body copy should evoke photography — the who, not the what.');
  } else {
    lines.push('- IMAGERY: Abstract / Tech. Geometric, systematic, data-precise. Reference architectures, vectors, systems thinking. Technical elegance over warmth. Body copy should feel like product documentation that also sells.');
  }

  // Duel 4 — Motion
  if (persona.motion === 'static') {
    lines.push('- MOTION: Static & Grounded. Deliberate, calm, focused. Content carries the weight. Do not reference animations or transitions in copy. Structural clarity is the experience.');
  } else {
    lines.push('- MOTION: High-Motion / Parallax. Alive, dynamic, expressive. Copy should feel kinetic — short punchy lines that land like reveals. Reference scroll-triggered moments and surprise transitions where it adds meaning.');
  }

  // Duel 5 — Architecture
  if (persona.architecture === 'linear-story') {
    lines.push('- ARCHITECTURE: Linear Story. One cohesive narrative arc per page. Build tension → resolve → CTA. Target 4-5 sections max. Each section flows into the next like a chapter.');
  } else {
    lines.push('- ARCHITECTURE: Deep Hub. Multi-layered content structure. More sections (6-7+) with distinct, self-contained purposes. Treat the page as a resource hub. Rich cross-references and internal link suggestions.');
  }

  lines.push('Let ALL copy and structure decisions flow from this persona profile.');
  return lines.join('\n');
}

export async function generateAeoContent(
  markdown: string,
  entityMap: EntityMap,
  originalMeta: { title?: string; description?: string },
  navLinks: string[] = [],
  siteObjective: string = 'other',
  sitePersona?: SitePersona,
  plannedSections?: Array<{ type: string; label: string; rationale: string }>,
  pageTitle?: string,   // e.g. "Services", "About", "FAQ"
  pageIntent?: string,  // the site planner's intent for this page
): Promise<AeoContent> {
  const model = getClient().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          metaDescription: { type: SchemaType.STRING },
          h1: { type: SchemaType.STRING },
          sections: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                type: { type: SchemaType.STRING },
                heading: { type: SchemaType.STRING },
                headingLevel: { type: SchemaType.STRING },
                body: { type: SchemaType.STRING },
                isList: { type: SchemaType.BOOLEAN },
                listItems: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              },
              required: ['type', 'heading', 'headingLevel', 'body', 'isList'],
            },
          },
          jsonLd: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { type: { type: SchemaType.STRING }, name: { type: SchemaType.STRING } } } },
          internalLinkSuggestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['title', 'metaDescription', 'h1', 'sections', 'jsonLd', 'internalLinkSuggestions'],
      },
    },
  });

  const objectiveBlock = OBJECTIVE_GUIDANCE[siteObjective] ?? OBJECTIVE_GUIDANCE['other'];
  const personaBlock = buildPersonaGuidance(sitePersona);

  // ── Blueprint block — page-aware instruction ──────────────────────────────────
  const blueprintBlock = plannedSections && plannedSections.length > 0
    ? `\nSECTION BLUEPRINT (STRICT — follow this exactly):\nYou MUST generate sections in EXACTLY this order and for EXACTLY these types.\nDo NOT add, remove, or reorder sections. Fill each with content specific to the PAGE identified above.\n${plannedSections.map((s, i) => `${i + 1}. type="${s.type}" | purpose: "${s.label}" — ${s.rationale}`).join('\n')}\n\nEach section's "type" field must match the blueprint type above exactly.`
    : '';

  // ── Page context block — defines page identity to prevent duplication ─────────
  const isHomePage = !pageTitle || pageTitle.toLowerCase() === 'home';
  const pageContextBlock = isHomePage
    ? `PAGE: Home (root page)\nPURPOSE: Introduce the business, establish credibility, and guide visitors to key sections.`
    : `PAGE: ${pageTitle}\nPURPOSE: ${pageIntent ?? `Dedicated ${pageTitle} page — deep, specific information about ${pageTitle.toLowerCase()} only.`}\n\nCRITICAL PAGE ISOLATION RULES:\n- This is the ${pageTitle} page, NOT the Home page. Do NOT write a generic business introduction.\n- Every section heading and body must be specific to "${pageTitle}" — not generic brand copy that repeats across pages.\n- The H1 must clearly identify this as the ${pageTitle} page (e.g. "${pageTitle} at ${entityMap.businessName}").\n- Do NOT reproduce the same hero intro or CTA text that appears on the Home page.\n- Focus exclusively on what a visitor landing directly on the ${pageTitle} page needs to know.`;

  const sectionInstructions = plannedSections && plannedSections.length > 0
    ? `4. sections: Generate EXACTLY ${plannedSections.length} sections following the SECTION BLUEPRINT above. Do not deviate.`
    : `4. sections: Create 4-7 semantic sections. CRITICAL RULES:
   - First section: answer-capsule style (40-60 words, declarative, inverted pyramid)
   - Use question-driven headings where appropriate (e.g. "What is X?", "How does Y work?")
   - For services/features: use isList:true with bullet-style listItems
   - For FAQ: use isList:true with question-answer format in listItems
   - Keep body under 150 words per section for machine readability
   - section types: hero | features | services | about | testimonials | faq | cta | generic
   - headingLevel: "h2" for main sections, "h3" for subsections
   - IMPORTANT: Do NOT create a contact, address, or location section in the main content.
     Physical addresses, phone numbers, email addresses, and business hours belong in
     the footer only. If a 'cta' section is needed, link to contact without listing the address.
   - If navLinks were provided above, try to match section headings to those nav labels.
   - Shape the CTA section and content emphasis to align with the SITE OBJECTIVE above.`;

  const prompt = `You are an AEO (Answer Engine Optimization) expert rebuilding a website for maximum AI visibility.

${pageContextBlock}

ORIGINAL SITE METADATA:
- Title: ${originalMeta.title || 'Unknown'}
- Description: ${originalMeta.description || 'Unknown'}

ENTITY MAP:
- Business: ${entityMap.businessName}
- Industry: ${entityMap.industry}
- Primary Service: ${entityMap.primaryService}
- Key Entities: ${entityMap.entities.join(', ')}
- Target Audience: ${entityMap.targetAudience}

ORIGINAL CONTENT (markdown) — extract factual details relevant to the PAGE above:
${markdown.substring(0, 15000)}

NAV LINKS FROM ORIGINAL SITE (use these as section labels where relevant):
${navLinks.length > 0 ? navLinks.join(', ') : 'Not detected — infer from content'}

${objectiveBlock}
${personaBlock}
${blueprintBlock}

AEO REQUIREMENTS (follow strictly):
1. title: Include primary entity in first 60 chars. Include business name.
2. metaDescription: 155 chars max. Answer "what does this page cover?" directly.
3. h1: Single H1 specific to THIS PAGE (${pageTitle ?? 'Home'}). Max 70 chars. Do not repeat the same H1 on every page.
${sectionInstructions}
5. jsonLd: Generate 2-3 Schema.org blocks as plain objects (type, name, description, etc.):
   - Always include Organization schema (include address here if found)
   - Add Service schema for each primary service
   - Add FAQPage schema if FAQ section exists
6. internalLinkSuggestions: 3-5 topic clusters to interlink (e.g. "services → case studies")

Preserve the brand's voice but make copy authoritative, direct, and scannable. Avoid fluff.
CRITICAL CONTENT FIDELITY RULES:
- Extract and REUSE real facts from the markdown above: staff names, service names, prices, locations, credentials, testimonials, and specific details.
- Do NOT invent people, services, prices, or claims that are not in the original content.
- If a staff member is mentioned in the markdown (e.g. "Sarah - Senior Stylist"), include them by name in relevant sections.
- If specific services, pricing tiers, or descriptions exist in the markdown, use them verbatim or as close rewrites.
- If testimonials or reviews appear in the markdown, quote or paraphrase them with attribution.
- Rewrite copy for clarity and AEO structure, but anchor all claims to the source content.
Both the SITE OBJECTIVE and SITE PERSONA above are ground truth — every copy and structural choice must reflect them.

CRITICAL OUTPUT RULES — JSON fields only, no exceptions:
- Do NOT use any markdown syntax in any string field. No **bold**, *italic*, # headings, bullet dashes, or backticks.
- All body, heading, and listItems strings must be plain prose sentences only.
- listItems should be complete sentences or concise phrases, never prefixed with -, *, or numbers.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as AeoContent;
}


// ─── Phase 5: AEO Audit ───────────────────────────────────────────────────────


export async function auditAeoScore(builtHtml: string, crawledPageTitles: string[] = []): Promise<AeoScore> {
  const model = getClient().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          overall: { type: SchemaType.NUMBER },
          content_structure: { type: SchemaType.NUMBER },
          eeat: { type: SchemaType.NUMBER },
          technical: { type: SchemaType.NUMBER },
          entity_alignment: { type: SchemaType.NUMBER },
          aiSummary: { type: SchemaType.STRING },
          recommendations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          canSummarizeIn2Sentences: { type: SchemaType.BOOLEAN },
          missingPageSuggestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['overall', 'content_structure', 'eeat', 'technical', 'entity_alignment', 'aiSummary', 'recommendations', 'canSummarizeIn2Sentences', 'missingPageSuggestions'],
      },
    },
  });

  const crawledPagesInfo = crawledPageTitles.length > 0
    ? `\nThe following pages were crawled and rebuilt: ${crawledPageTitles.join(', ')}.`
    : '';

  const prompt = `You are an AI answer engine (like Perplexity or Google AI Overviews). Read the following HTML page and evaluate its AEO (Answer Engine Optimization) quality.

HTML CONTENT:
${builtHtml.substring(0, 8000)}
${crawledPagesInfo}

TASKS:
1. Try to summarise this business in exactly 2 sentences. If you can do it clearly, canSummarizeIn2Sentences = true.
2. Set aiSummary to your 2-sentence summary of the business.
3. Score each category 0-100 based on these criteria:

content_structure (30% weight):
- Has clear inverted-pyramid answer capsules under headings
- Uses lists/tables for scannable content
- Uses question-driven H2/H3 headings

eeat (30% weight):
- Has explicit authorship/about section
- Contains original, specific claims
- Has authority signals (testimonials, stats, certifications)

technical (20% weight):
- Has proper JSON-LD structured data in <head>
- Semantic HTML5 (main, article, section, aside, nav)
- Single H1, logical H2→H3→H4 hierarchy
- No JS-only content that bots can't read

entity_alignment (20% weight):
- Key business entities appear in H1, first paragraph
- Consistent use of specific terminology (not vague)
- Evidence of topic clustering/internal linking

4. overall = weighted average (content_structure*0.3 + eeat*0.3 + technical*0.2 + entity_alignment*0.2)
5. recommendations: 3 specific, actionable improvements ranked by impact
6. missingPageSuggestions: Based on the business type and pages already crawled, list 2-5 pages this site should have for AEO completeness but currently lacks (e.g. "FAQ page", "About page", "Contact page", "Services detail pages", "Team page", "Pricing page", "Case studies", "Blog"). Only suggest pages that are genuinely missing and would add AEO value.

Score honestly. This is used to show users what still needs human refinement.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as AeoScore;
}

// ─── AI Strategist ────────────────────────────────────────────────────────────

import { SitePersona as _SitePersona, StrategistRecommendation } from './types';

/**
 * Generates a structured Strategist Report grounded in the E-E-A-T + conversion
 * copywriting rubric. Reviews the rebuilt page against the original AEO score
 * and returns prioritised, actionable recommendations.
 */
export async function generateStrategistReport(
  builtHtml: string,
  beforeScore: AeoScore,
  afterScore: AeoScore,
  entityMap: EntityMap,
  persona?: _SitePersona
): Promise<{ executiveSummary: string; recommendations: StrategistRecommendation[] }> {
  const model = getClient().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          executiveSummary: { type: SchemaType.STRING },
          recommendations: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                id:              { type: SchemaType.STRING },
                priority:        { type: SchemaType.STRING },
                sectionType:     { type: SchemaType.STRING },
                title:           { type: SchemaType.STRING },
                rationale:       { type: SchemaType.STRING },
                suggestedAction: { type: SchemaType.STRING },
                status:          { type: SchemaType.STRING },
              },
              required: ['id', 'priority', 'sectionType', 'title', 'rationale', 'suggestedAction', 'status'],
            },
          },
        },
        required: ['executiveSummary', 'recommendations'],
      },
    } as Parameters<ReturnType<typeof getClient>['getGenerativeModel']>[0]['generationConfig'],
  });

  const personaContext = persona
    ? `\nSITE PERSONA: layout=${persona.layout}, tone=${persona.tone}, imagery=${persona.imagery}`
    : '';

  const prompt = `You are an expert digital strategist reviewing a rebuilt website for ${entityMap.businessName} (${entityMap.industry}).

You are using the E-E-A-T rubric (Experience, Expertise, Authoritativeness, Trustworthiness) and conversion copywriting principles to assess the quality of the rebuilt site and identify the highest-impact improvements.

BEFORE SCORE (original site): ${beforeScore.overall}/100
  - Content Structure: ${beforeScore.content_structure}
  - E-E-A-T: ${beforeScore.eeat}
  - Technical: ${beforeScore.technical}
  - Entity Alignment: ${beforeScore.entity_alignment}

AFTER SCORE (rebuilt site): ${afterScore.overall}/100
  - Content Structure: ${afterScore.content_structure}
  - E-E-A-T: ${afterScore.eeat}
  - Technical: ${afterScore.technical}
  - Entity Alignment: ${afterScore.entity_alignment}
${personaContext}

REBUILT PAGE HTML (first 6000 chars):
${builtHtml.substring(0, 6000)}

TASK:
1. Write a sharp, honest executiveSummary (2-3 sentences) assessing the rebuild quality. Name specific strengths and weaknesses. Be direct.

2. Generate exactly 5 recommendations, ordered by impact (highest first). For each:
   - id: unique slug e.g. "add-social-proof", "sharpen-h1"
   - priority: "high" | "medium" | "low"
   - sectionType: which section type this targets — one of: hero | features | services | about | faq | cta | testimonials | global
   - title: short imperative title (max 8 words), e.g. "Add specific client results to About"
   - rationale: 1-2 sentences explaining WHY this matters for E-E-A-T / conversion
   - suggestedAction: specific instruction for Gemini to follow when patching this section (30-60 words)
   - status: always "pending"

RUBRIC TO APPLY:
- E-E-A-T: Is there proof of experience/expertise? Real numbers, specific claims, credentials?
- Copy specificity: Is the language specific ("20 years across 3 cities") or generic ("industry leading")?
- CTA clarity: Is the primary conversion action clear and frictionless?
- Answer-engine readiness: Can an AI summarise this business in 2 sentences from this page alone?
- Persona alignment: Does the copy and structure match the stated persona?

Return only valid JSON.`;

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text()) as {
    executiveSummary: string;
    recommendations: StrategistRecommendation[];
  };
  return parsed;
}

