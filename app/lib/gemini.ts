import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { AeoChecklist, AeoContent, AeoScore, AeoStrategy, DesignTokens, EntityMap, RealSiteContent, SitePersona } from './types';

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
              businessName:      { type: SchemaType.STRING },
              industry:          { type: SchemaType.STRING },
              businessCategory:  { type: SchemaType.STRING },
              businessType:      { type: SchemaType.STRING },
              valueProposition:  { type: SchemaType.STRING },
              primaryService:    { type: SchemaType.STRING },
              entities:          { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              targetAudience:    { type: SchemaType.STRING },
            },
            required: ['businessName', 'industry', 'businessCategory', 'businessType', 'valueProposition', 'primaryService', 'entities', 'targetAudience'],
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
   - industry: e.g. "SaaS", "Legal Services", "Hair Salon" (kept for compatibility)
   - businessCategory: the BROAD category this business falls into. Must be one of:
       "service" (selling expertise/time — salon, law firm, consulting),
       "product" (physical goods — retail, manufacturing),
       "ecommerce" (primarily online sales),
       "saas" (software-as-a-service),
       "marketplace" (connects buyers and sellers),
       "hospitality" (hotels, restaurants, events),
       "healthcare" (clinics, practitioners, wellness),
       "education" (schools, training, courses),
       "non-profit" (charities, associations),
       "other" (if none fit)
   - businessType: the SPECIFIC type within that category — be precise, e.g. "hair salon", "yoga studio", "chartered accounting firm", "property management company". Use 2-4 words, all lowercase.
   - valueProposition: exactly TWO sentences that articulate what makes this specific business distinctive versus other businesses of the same type. Focus on specific differentiators (location, credentials, specialisation, approach) — not generic claims like "quality service".
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
  pageTitle?: string,          // e.g. "Services", "About", "FAQ"
  pageIntent?: string,         // the site planner's intent for this page
  crossPageOwnership?: Record<string, string>, // Option A: { sectionType -> owningPageTitle }
  originalChecklist?: AeoChecklist,  // binary audit of original site — drives content mandates
  realSiteContent?: RealSiteContent, // real extracted content to use verbatim
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
  const mandateBlock = buildAeoMandateBlock(originalChecklist, realSiteContent);

  // ── Blueprint block — page-aware instruction ──────────────────────────────────
  const blueprintBlock = plannedSections && plannedSections.length > 0
    ? `\nSECTION BLUEPRINT (STRICT — follow this exactly):\nYou MUST generate sections in EXACTLY this order and for EXACTLY these types.\nDo NOT add, remove, or reorder sections. Fill each with content specific to the PAGE identified above.\n${plannedSections.map((s, i) => `${i + 1}. type="${s.type}" | purpose: "${s.label}" — ${s.rationale}`).join('\n')}\n\nEach section's "type" field must match the blueprint type above exactly.`
    : '';

  // ── Option A: Cross-page ownership block — prevents content duplication ────────
  const currentPage = pageTitle ?? 'Home';
  const ownershipLines: string[] = [];
  if (crossPageOwnership && Object.keys(crossPageOwnership).length > 0) {
    for (const [sectionType, ownerPage] of Object.entries(crossPageOwnership)) {
      // Only inject the rule if this page does NOT own the type
      if (ownerPage.toLowerCase() !== currentPage.toLowerCase()) {
        const guidance: Record<string, string> = {
          testimonials: `Do NOT include customer testimonials, reviews, star ratings, or client quotes. These live on the ${ownerPage} page. You may write one sentence directing readers there.`,
          about:        `Do NOT reproduce team biographies, the founder story, or staff credential lists. That depth lives on the ${ownerPage} page. A single sentence of brand context is acceptable.`,
          faq:          `Do NOT include a FAQ section or any Q&A formatted content. FAQs are consolidated on the ${ownerPage} page to avoid dilution.`,
          services:     `Do NOT list or describe individual services in detail. Service descriptions live on the ${ownerPage} page. Reference services briefly by name only.`,
          features:     `Do NOT include a How-It-Works or feature-list section. That content lives on the ${ownerPage} page. Mention the process in one sentence at most.`,
        };
        const rule = guidance[sectionType];
        if (rule) ownershipLines.push(`- "${sectionType}" is owned by the ${ownerPage} page: ${rule}`);
      }
    }
  }
  const ownershipBlock = ownershipLines.length > 0
    ? `\nCROSS-PAGE CONTENT OWNERSHIP (STRICT — do NOT repeat content from other pages):\nThe following content types are owned by other pages in this site. Violating these rules creates duplicate content across pages, which harms AEO performance:\n${ownershipLines.join('\n')}`
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
${mandateBlock}

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
${ownershipBlock}

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


// ─── Real content extractor ───────────────────────────────────────────────────

/**
 * Extracts real E-E-A-T signals from the original site's scraped markdown.
 * Uses temperature=0 and a strict schema so it only surfaces what's genuinely
 * present — empty arrays are the correct return when content doesn't exist.
 *
 * Designed to run BEFORE content generation so generateAeoContent() can inject
 * real testimonials, staff names, stats, etc. rather than fabricating them.
 */
export async function extractRealSiteContent(markdown: string): Promise<RealSiteContent> {
  const model = getClient().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          testimonials:  { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          staffMembers:  { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          stats:         { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          trustSignals:  { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          services:      { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          locations:     { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['testimonials', 'staffMembers', 'stats', 'trustSignals', 'services', 'locations'],
      },
    },
  });

  const prompt = `You are an AEO content analyst. Extract specific, verbatim E-E-A-T signals from this website markdown.

CRITICAL RULES:
- Return ONLY content that is EXPLICITLY present in the markdown below.
- Return EMPTY arrays for categories where nothing is found. Do NOT invent or infer.
- Prefer verbatim quotes and exact phrasings from the source text.

EXTRACT THE FOLLOWING:

testimonials:
  Client reviews, quotes, or testimonials — include the quote text and any attribution.
  Format: "[Quote text]" — [Client name/initials if given]
  Example: "Best salon in Auckland, would recommend to everyone!" — Sarah M.

staffMembers:
  Named team members with their role and any credentials or experience mentioned.
  Format: [Name] — [Role], [Credential/experience if given]
  Example: Jessica — Senior Colourist, Schwarzkopf certified

stats:
  Specific quantitative claims — years in business, client counts, ratings, team size, etc.
  Format: the exact claim as it appears, e.g. "Over 500 satisfied clients", "15 years experience"

trustSignals:
  Certifications, awards, industry memberships, guarantees, partner brands.
  Example: "Schwarzkopf Professional partner", "Winner Best Auckland Salon 2023"

services:
  Specific named services with any details (pricing, duration, description).
  Format: [Service name] — [detail if given]
  Example: Balayage — from $180, 2-3 hour appointment

locations:
  Geographic locations served or audience segments explicitly named.
  Example: "Newmarket, Auckland", "serving Parnell and Epsom clients"

MARKDOWN CONTENT:
${markdown.substring(0, 20000)}

Return only valid JSON. Empty arrays are correct when no content is found for a category.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as RealSiteContent;
}


// ─── AEO Mandate Block Builder ────────────────────────────────────────────────

/**
 * Builds a hard-mandate block for the generateAeoContent prompt.
 * Maps false checklist flags → specific content requirements that Gemini MUST satisfy.
 * When realSiteContent is supplied, injects the actual extracted content to use.
 * This closes the gap between the AI Strategist's post-hoc recommendations
 * and the first-generation site output.
 */
function buildAeoMandateBlock(
  cl?: AeoChecklist,
  rc?: RealSiteContent,
): string {
  if (!cl) return '';

  const mandates: string[] = [];

  // ── E-E-A-T mandates ───────────────────────────────────────────────────────

  if (!cl.ee_hasNamedPeopleOrCredentials) {
    const real = rc?.staffMembers.length
      ? `USE THIS REAL CONTENT → ${rc.staffMembers.slice(0, 3).join(' | ')}`
      : `No named staff found in source. Describe team composition specifically instead (e.g. "our 4 certified stylists" or "our team of licensed practitioners").`;
    mandates.push(
      `✗ MISSING — Named staff / credentials\n` +
      `  MANDATE: Include at least one real person\'s name with their specific role and qualification in the about or features section.\n` +
      `  ${real}`,
    );
  }

  if (!cl.ee_hasTestimonialsOrReviews) {
    const real = rc?.testimonials.length
      ? `USE THIS REAL CONTENT → ${rc.testimonials.slice(0, 2).join(' | ')}`
      : `No testimonials found in source. Write 1-2 representative, specific testimonials for the type of service offered — avoid generic praise like "great service".`;
    mandates.push(
      `✗ MISSING — Client testimonials / reviews\n` +
      `  MANDATE: Include at least one attributed client quote in the testimonials section.\n` +
      `  ${real}`,
    );
  }

  if (!cl.ee_hasSpecificStats) {
    const real = rc?.stats.length
      ? `USE THIS REAL CONTENT → ${rc.stats.slice(0, 3).join(' | ')}`
      : `No stats found in source. Include a conservative, reasonable quantitative claim based on context (years operating, team size, approximate client volume).`;
    mandates.push(
      `✗ MISSING — Specific numbers / stats\n` +
      `  MANDATE: Include at least one concrete quantitative claim (years, client count, rating, etc.).\n` +
      `  ${real}`,
    );
  }

  if (!cl.ee_hasCertificationsOrTrust) {
    const real = rc?.trustSignals.length
      ? `USE THIS REAL CONTENT → ${rc.trustSignals.slice(0, 3).join(' | ')}`
      : `No trust signals found in source. Include a trust statement relevant to the business type (e.g. industry-standard certifications, satisfaction guarantee, professional affiliations).`;
    mandates.push(
      `✗ MISSING — Trust signals / certifications\n` +
      `  MANDATE: Include trust signals in the hero, about, or features section.\n` +
      `  ${real}`,
    );
  }

  // ── Content structure mandates ─────────────────────────────────────────────

  if (!cl.cs_hasQuestionDrivenHeadings) {
    mandates.push(
      `✗ MISSING — Question-driven headings\n` +
      `  MANDATE: At least one section heading (H2 or H3) MUST begin with a question word: What, How, Why, Which, Is, Are, Can, Do, Does, Should.`,
    );
  }

  if (!cl.cs_hasAnswerCapsule) {
    mandates.push(
      `✗ MISSING — Answer capsule / inverted pyramid\n` +
      `  MANDATE: The first substantive section must open with a 40-60 word direct answer paragraph stating what this business does and for whom, before any descriptive detail.`,
    );
  }

  if (!cl.cs_hasListsOrTables) {
    mandates.push(
      `✗ MISSING — Machine-readable lists\n` +
      `  MANDATE: At least one section MUST use isList:true with bullet listItems (services, features, process steps, or FAQ pairs).`,
    );
  }

  // ── Entity / geographic mandate ────────────────────────────────────────────

  if (!cl.ea_hasGeographicOrAudienceTargeting) {
    const real = rc?.locations.length
      ? `USE THIS REAL CONTENT → locations: ${rc.locations.join(', ')}`
      : `No specific location found. Include audience targeting in H1 or opening paragraph (e.g. "for [audience type]" or the city/region if inferable from context).`;
    mandates.push(
      `✗ MISSING — Geographic / audience targeting\n` +
      `  MANDATE: Name the location served OR the specific target audience in the H1 or first paragraph.\n` +
      `  ${real}`,
    );
  }

  if (mandates.length === 0) return '';

  return `

AEO CONTENT MANDATES — NON-NEGOTIABLE:
The following signals are ABSENT from the original site. You MUST address EVERY item below in the
content you generate. Each mandate is a direct requirement, not a suggestion.
Where real extracted content is provided, you MUST use it verbatim or as a close rewrite.

${mandates.join('\n\n')}

COMPLIANCE IS REQUIRED across all sections you generate. Do not skip any mandate.
`;
}


// ─── Phase 5: AEO Audit ───────────────────────────────────────────────────────

/**
 * Converts raw page HTML into a compact structured signal document for AEO auditing.
 *
 * WHY: Raw HTML can be 15,000–30,000 chars and is dominated by CSS, JS, and markup
 * boilerplate that contributes zero AEO signal but consumes token budget and
 * risks truncating real signals (JSON-LD, headings, body text, links).
 *
 * This extractor surfaces ALL 20 checklist signals explicitly in plain text,
 * keeping the audit input under ~3,000 chars regardless of page size.
 * Pairing this with temperature=0 removes the two largest sources of score variance.
 */
export function extractAeoSignals(html: string): string {
  const lines: string[] = [];

  // Strip HTML tags and decode basic entities
  const txt = (s: string): string =>
    s.replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ').trim();

  // ── 1. Meta ──────────────────────────────────────────────────────────────
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch =
    html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) ??
    html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
  lines.push('=== META ===');
  lines.push(`TITLE: ${titleMatch ? txt(titleMatch[1]) : '(missing)'}`);
  lines.push(`META_DESCRIPTION: ${descMatch ? descMatch[1].trim() : '(missing)'}`);

  // ── 2. JSON-LD (complete — critical for tc_hasJsonLd) ────────────────────
  const jsonLdBlocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  lines.push('\n=== JSON-LD SCHEMAS ===');
  if (jsonLdBlocks.length === 0) {
    lines.push('(none — tc_hasJsonLd = false)');
  } else {
    jsonLdBlocks.forEach((m, i) => lines.push(`Schema ${i + 1}: ${m[1].trim().substring(0, 600)}`));
  }

  // ── 3. Semantic HTML5 landmarks (tc_hasSemanticHtml) ─────────────────────
  const landmarks = ['main', 'nav', 'header', 'footer', 'article', 'aside', 'section'];
  const presentLandmarks = landmarks
    .map(t => ({ t, n: (html.match(new RegExp(`<${t}[\\s>]`, 'gi')) ?? []).length }))
    .filter(x => x.n > 0)
    .map(x => `<${x.t}>×${x.n}`);
  lines.push('\n=== SEMANTIC LANDMARKS ===');
  lines.push(presentLandmarks.length > 0 ? presentLandmarks.join(', ') : '(none)');

  // ── 4. All headings (cs_hasH1, tc_hasSingleH1, cs_hasQuestionDrivenHeadings) ──
  const headings = [...html.matchAll(/<(h[1-4])[^>]*>([\s\S]*?)<\/\1>/gi)];
  lines.push('\n=== HEADINGS ===');
  if (headings.length === 0) {
    lines.push('(none found)');
  } else {
    headings.forEach(m => lines.push(`${m[1].toUpperCase()}: ${txt(m[2]).substring(0, 120)}`));
  }

  // ── 5. First 15 paragraphs (cs_hasAnswerCapsule, ee_hasSpecificStats, ea_*) ──
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].slice(0, 15);
  lines.push('\n=== PARAGRAPHS (first 15) ===');
  if (paras.length === 0) {
    lines.push('(none)');
  } else {
    paras.forEach(m => { const t = txt(m[1]).substring(0, 250); if (t) lines.push(`• ${t}`); });
  }

  // ── 6. List items (cs_hasListsOrTables) ──────────────────────────────────
  const listItems = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].slice(0, 20);
  lines.push('\n=== LIST ITEMS (first 20) ===');
  if (listItems.length === 0) {
    lines.push('(none)');
  } else {
    listItems.forEach(m => { const t = txt(m[1]).substring(0, 150); if (t) lines.push(`– ${t}`); });
  }

  // ── 7. Tables ─────────────────────────────────────────────────────────────
  const tableCount = (html.match(/<table[\s>]/gi) ?? []).length;
  lines.push(`\nTABLES: ${tableCount > 0 ? `${tableCount} present` : 'none'}`);

  // ── 8. Links (ea_hasInternalLinks) ───────────────────────────────────────
  const allLinks = [...html.matchAll(/<a\s[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const internalLinks = allLinks.filter(m => m[1].startsWith('/') || !/^https?:\/\//.test(m[1]));
  const externalLinks = allLinks.filter(m => /^https?:\/\//.test(m[1]));
  lines.push('\n=== LINKS ===');
  lines.push(`Internal (${internalLinks.length}): ${internalLinks.slice(0, 10).map(m => m[1]).join(', ') || '(none)'}`);
  lines.push(`External (${externalLinks.length}): ${externalLinks.slice(0, 5).map(m => m[1]).join(', ') || '(none)'}`);

  // ── 9. Body text volume (tc_isReadableWithoutJs proxy) ───────────────────
  const bodyCharCount = paras.map(m => txt(m[1])).join(' ').length;
  lines.push(`\nBODY_TEXT_CHARS: ${bodyCharCount} (>=300 = readable without JS)`);

  return lines.join('\n');
}


/** Minimal HTML escaping for use inside normalizeMarkdownToAuditHtml. */
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Converts Firecrawl markdown to semantic audit HTML so the original site
 * can be scored on the same footing as the rebuilt HTML output.
 * Preserves heading hierarchy, lists, paragraphs, and inline links
 * (the signals the auditor actually checks) without adding semantic
 * elements that weren't in the source content.
 */
export function normalizeMarkdownToAuditHtml(markdown: string, metaDescription = ''): string {
  const inline = (s: string): string =>
    s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+|\/[^)]*)\)/g, '<a href="$2">$1</a>');

  const lines = markdown.split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { closeList(); continue; }

    const h1m = t.match(/^#\s+(.+)/);
    const h2m = t.match(/^##\s+(.+)/);
    const h3m = t.match(/^###\s+(.+)/);
    const h4m = t.match(/^####\s+(.+)/);
    const ulm = t.match(/^[-*]\s+(.+)/);
    const olm = t.match(/^\d+\.\s+(.+)/);

    if (h1m) { closeList(); out.push(`<h1>${inline(escHtml(h1m[1]))}</h1>`); continue; }
    if (h2m) { closeList(); out.push(`<h2>${inline(escHtml(h2m[1]))}</h2>`); continue; }
    if (h3m) { closeList(); out.push(`<h3>${inline(escHtml(h3m[1]))}</h3>`); continue; }
    if (h4m) { closeList(); out.push(`<h4>${inline(escHtml(h4m[1]))}</h4>`); continue; }

    if (ulm) {
      if (!inUl) { closeList(); out.push('<ul>'); inUl = true; }
      out.push(`<li>${inline(escHtml(ulm[1]))}</li>`);
      continue;
    }
    if (olm) {
      if (!inOl) { closeList(); out.push('<ol>'); inOl = true; }
      out.push(`<li>${inline(escHtml(olm[1]))}</li>`);
      continue;
    }

    if (/^[-*_]{3,}$/.test(t)) { closeList(); continue; } // horizontal rule

    closeList();
    out.push(`<p>${inline(escHtml(t))}</p>`);
  }
  closeList();

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head><meta charset="utf-8">',
    `<meta name="description" content="${escHtml(metaDescription)}">`,
    '</head>',
    '<body>',
    '<main>',
    ...out,
    '</main>',
    '</body></html>',
  ].join('\n');
}

/**
 * Compute all AEO dimension scores deterministically from the binary checklist.
 *
 * Weights match AEO_ASSESSMENT_CRITERIA.md exactly:
 *   Content Formatting & Structure — 30% total
 *     • Inverted Pyramid / Answer Capsules  15%
 *     • Machine-Readable Formatting         10%
 *     • Question-Driven Headings             5%
 *   E-E-A-T & Authority Signals — 30% total
 *     • Information Gain / Original Exp.    15%
 *     • Brand Authority / External Cites    10%
 *     • Explicit Authorship                  5%
 *   Technical AEO & Accessibility — 20% total
 *     • Schema Markup (JSON-LD)             12%
 *     • Raw HTML & DOM Simplicity            5%
 *     • Core Web Vitals                      3%
 *   Entity & Semantic Alignment — 15% total
 *     • Entity Salience & Consistency       10%
 *     • Topic Clustering                     5%
 *   Tracking & Refinement — 5% total
 *     • AI Share of Voice Tracking           5% (always 0 — cannot be measured automatically)
 *
 * overall = weighted sum of all five category raw scores (0-100 each).
 */
function computeAeoScoreFromChecklist(
  c: AeoChecklist,
  aiSummary: string,
  canSummarizeIn2Sentences: boolean,
  recommendations: string[],
  missingPageSuggestions: string[],
): AeoScore {
  // Helper: weighted sum of boolean flags normalised to 0-100
  const weighted = (items: { flag: boolean; weight: number }[]): number => {
    const totalWeight = items.reduce((s, i) => s + i.weight, 0);
    const earned = items.filter(i => i.flag).reduce((s, i) => s + i.weight, 0);
    return totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 0;
  };

  // ── Content Formatting & Structure (sub-weights sum to 30 within category) ──
  const content_structure = weighted([
    { flag: c.cs_hasAnswerCapsule,            weight: 15 }, // Inverted Pyramid / Answer Capsule
    { flag: c.cs_hasListsOrTables,            weight: 10 }, // Machine-Readable Formatting
    { flag: c.cs_hasQuestionDrivenHeadings,   weight:  5 }, // Question-Driven Headings
    // H1 and multiple sections are prerequisites; included with equal minor weight
    { flag: c.cs_hasH1,                       weight:  5 },
    { flag: c.cs_hasMultipleSections,         weight:  5 },
  ]);

  // ── E-E-A-T & Authority Signals (sub-weights sum to 30 within category) ────
  const eeat = weighted([
    { flag: c.ee_hasSpecificStats,            weight: 15 }, // Information Gain / Original Experience
    { flag: c.ee_hasCertificationsOrTrust,    weight: 10 }, // Brand Authority / External Citations
    { flag: c.ee_hasNamedPeopleOrCredentials, weight:  5 }, // Explicit Authorship
    { flag: c.ee_hasAboutOrAuthorship,        weight:  5 },
    { flag: c.ee_hasTestimonialsOrReviews,    weight:  5 },
  ]);

  // ── Technical AEO & Accessibility (sub-weights sum to 20 within category) ──
  const technical = weighted([
    { flag: c.tc_hasJsonLd,               weight: 12 }, // Schema Markup
    { flag: c.tc_hasSemanticHtml,         weight:  3 }, // Raw HTML & DOM Simplicity (part)
    { flag: c.tc_isReadableWithoutJs,     weight:  2 }, // Raw HTML & DOM Simplicity (part)
    { flag: c.tc_hasMetaDescription,      weight:  1 }, // Core Web Vitals proxy (meta = technical baseline)
    { flag: c.tc_hasSingleH1,             weight:  2 }, // Technical validity
  ]);

  // ── Entity & Semantic Alignment (sub-weights sum to 15 within category) ────
  const entity_alignment = weighted([
    { flag: c.ea_usesSpecificTerminology,            weight: 10 }, // Entity Salience & Consistency
    { flag: c.ea_businessNameInH1OrFirstPara,        weight:  5 }, // Entity Salience (prominence)
    { flag: c.ea_hasInternalLinks,                   weight:  5 }, // Topic Clustering
    { flag: c.ea_primaryServiceNamed,                weight:  3 },
    { flag: c.ea_hasGeographicOrAudienceTargeting,   weight:  2 },
  ]);

  // ── Tracking & Refinement — always 0 (cannot measure AI citations automatically) ──
  const tracking = 0;

  // ── Overall = weighted sum of category scores against their spec weights ──
  const overall = Math.round(
    content_structure * 0.30 +
    eeat              * 0.30 +
    technical         * 0.20 +
    entity_alignment  * 0.15 +
    tracking          * 0.05,
  );

  return {
    overall,
    content_structure,
    eeat,
    technical,
    entity_alignment,
    aiSummary,
    canSummarizeIn2Sentences,
    recommendations,
    missingPageSuggestions,
    checklist: c,
  };
}


export async function auditAeoScore(builtHtml: string, crawledPageTitles: string[] = []): Promise<AeoScore> {
  // Option A+B: Pre-extract structured signals from raw HTML before sending to Gemini.
  // This eliminates CSS/JS noise, avoids the 12k truncation problem, and produces a
  // stable ~3k-char input regardless of page size. Combined with temperature=0, this
  // is the primary mechanism for deterministic scoring on the same HTML input.
  const signalDoc = extractAeoSignals(builtHtml);

  const model = getClient().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0,   // Option A: binary classification must be deterministic
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          // ── Content Structure ──────────────────────────────────────────────
          cs_hasH1:                    { type: SchemaType.BOOLEAN },
          cs_hasQuestionDrivenHeadings: { type: SchemaType.BOOLEAN },
          cs_hasListsOrTables:         { type: SchemaType.BOOLEAN },
          cs_hasAnswerCapsule:          { type: SchemaType.BOOLEAN },
          cs_hasMultipleSections:      { type: SchemaType.BOOLEAN },
          // ── E-E-A-T ────────────────────────────────────────────────────────
          ee_hasAboutOrAuthorship:        { type: SchemaType.BOOLEAN },
          ee_hasNamedPeopleOrCredentials: { type: SchemaType.BOOLEAN },
          ee_hasTestimonialsOrReviews:    { type: SchemaType.BOOLEAN },
          ee_hasSpecificStats:            { type: SchemaType.BOOLEAN },
          ee_hasCertificationsOrTrust:   { type: SchemaType.BOOLEAN },
          // ── Technical ──────────────────────────────────────────────────────
          tc_hasJsonLd:            { type: SchemaType.BOOLEAN },
          tc_hasSemanticHtml:      { type: SchemaType.BOOLEAN },
          tc_hasSingleH1:          { type: SchemaType.BOOLEAN },
          tc_hasMetaDescription:   { type: SchemaType.BOOLEAN },
          tc_isReadableWithoutJs:  { type: SchemaType.BOOLEAN },
          // ── Entity Alignment ───────────────────────────────────────────────
          ea_businessNameInH1OrFirstPara:   { type: SchemaType.BOOLEAN },
          ea_primaryServiceNamed:           { type: SchemaType.BOOLEAN },
          ea_usesSpecificTerminology:       { type: SchemaType.BOOLEAN },
          ea_hasInternalLinks:              { type: SchemaType.BOOLEAN },
          ea_hasGeographicOrAudienceTargeting: { type: SchemaType.BOOLEAN },
          // ── Meta ───────────────────────────────────────────────────────────
          aiSummary:               { type: SchemaType.STRING },
          canSummarizeIn2Sentences: { type: SchemaType.BOOLEAN },
          recommendations:         { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          missingPageSuggestions:  { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: [
          'cs_hasH1', 'cs_hasQuestionDrivenHeadings', 'cs_hasListsOrTables', 'cs_hasAnswerCapsule', 'cs_hasMultipleSections',
          'ee_hasAboutOrAuthorship', 'ee_hasNamedPeopleOrCredentials', 'ee_hasTestimonialsOrReviews', 'ee_hasSpecificStats', 'ee_hasCertificationsOrTrust',
          'tc_hasJsonLd', 'tc_hasSemanticHtml', 'tc_hasSingleH1', 'tc_hasMetaDescription', 'tc_isReadableWithoutJs',
          'ea_businessNameInH1OrFirstPara', 'ea_primaryServiceNamed', 'ea_usesSpecificTerminology', 'ea_hasInternalLinks', 'ea_hasGeographicOrAudienceTargeting',
          'aiSummary', 'canSummarizeIn2Sentences', 'recommendations', 'missingPageSuggestions',
        ],
      },
    },
  });

  const crawledPagesInfo = crawledPageTitles.length > 0
    ? `Pages already crawled and rebuilt: ${crawledPageTitles.join(', ')}.`
    : '';

  const prompt = `You are an AI auditor evaluating a webpage for Answer Engine Optimization (AEO).
Below is a PRE-EXTRACTED SIGNAL DOCUMENT derived from the full page HTML.
All CSS, JavaScript, and markup boilerplate has been stripped — every AEO-relevant signal is surfaced explicitly.
Read the signal document carefully and answer each of the 20 binary questions with true or false.
Be strict — only mark true if the evidence is clearly and unambiguously present in the signal document.

SIGNAL DOCUMENT:
${signalDoc}
${ crawledPagesInfo ? `\n${crawledPagesInfo}` : '' }

── CONTENT STRUCTURE (cs_*) ─────────────────────────────────────────────────
cs_hasH1
  true if: the page contains at least one <h1> element with meaningful non-empty text.

cs_hasQuestionDrivenHeadings
  true if: at least one H2 or H3 heading starts with a question word (What, How, Why, When, Which, Is, Are, Can, Do, Does, Should).

cs_hasListsOrTables
  true if: the page contains at least one <ul>, <ol>, or <table> with visible list items or rows.

cs_hasAnswerCapsule
  true if: a short (40–90 word) declarative paragraph appears near the top of the body content that directly answers "what does this business/page do?" before lengthy detail.

cs_hasMultipleSections
  true if: the page has 3 or more distinct <section> elements, or 3 or more clearly delineated content blocks separated by headings.

── E-E-A-T (ee_*) ────────────────────────────────────────────────────────────
ee_hasAboutOrAuthorship
  true if: an About section OR a named team/author introduction is present on the page.

ee_hasNamedPeopleOrCredentials
  true if: at least one real person's name OR a specific credential (certification, qualification, years of experience) is explicitly in the text.

ee_hasTestimonialsOrReviews
  true if: at least one customer testimonial, quote, or review is present (may include attribution).

ee_hasSpecificStats
  true if: at least one specific quantitative claim is made (e.g. "20 years", "500+ clients", "98% satisfaction rate").

ee_hasCertificationsOrTrust
  true if: trust signals are mentioned — awards, industry certifications, partner badges, money-back guarantees, or similar.

── TECHNICAL (tc_*) ──────────────────────────────────────────────────────────
tc_hasJsonLd
  true if: the page <head> contains a <script type="application/ld+json"> block.

tc_hasSemanticHtml
  true if: the page uses at least two of the following semantic HTML5 landmarks: <main>, <nav>, <header>, <footer>, <article>, <aside>.

tc_hasSingleH1
  true if: the page contains EXACTLY one <h1> element (not zero, not two or more).

tc_hasMetaDescription
  true if: a <meta name="description" content="..."> tag appears in <head> with non-empty content.

tc_isReadableWithoutJs
  true if: the core body content is present as static HTML text (not reliant on JavaScript to render).

── ENTITY ALIGNMENT (ea_*) ───────────────────────────────────────────────────
ea_businessNameInH1OrFirstPara
  true if: the business or brand name appears in the H1 or in the first visible paragraph.

ea_primaryServiceNamed
  true if: the primary product or service is explicitly described within the first two sections of visible content.

ea_usesSpecificTerminology
  true if: the page uses specific, domain-relevant terminology (not vague filler phrases like "solutions", "services", or "cutting-edge").

ea_hasInternalLinks
  true if: the page contains 2 or more <a href> links pointing to other pages within the same site.

ea_hasGeographicOrAudienceTargeting
  true if: the page explicitly references a geographic location served OR a specific target audience segment.

── SUMMARY ───────────────────────────────────────────────────────────────────
aiSummary: Write a 2-sentence summary of this business from the page content alone. Be specific — name the business, what it does, and who it serves. Do not write generic filler.

canSummarizeIn2Sentences: true if you were able to write a clear, specific, informative 2-sentence summary above.

recommendations: List exactly 3 specific, actionable AEO improvements ranked by impact. Each should be one concise sentence.

missingPageSuggestions: Based on the business type and pages already crawled (${crawledPageTitles.join(', ') || 'none'}), list 2-5 page types that are genuinely absent and would add AEO value (e.g. "FAQ page", "Team page", "Pricing page").

Return only valid JSON. Answer every boolean field — do not omit any.`;

  const raw = await model.generateContent(prompt);
  const parsed = JSON.parse(raw.response.text()) as AeoChecklist & {
    aiSummary: string;
    canSummarizeIn2Sentences: boolean;
    recommendations: string[];
    missingPageSuggestions: string[];
  };

  return computeAeoScoreFromChecklist(
    parsed,
    parsed.aiSummary,
    parsed.canSummarizeIn2Sentences,
    parsed.recommendations,
    parsed.missingPageSuggestions,
  );
}

// ─── Expected gain calculator ────────────────────────────────────────────────

/**
 * Maps a recommendation's id/sectionType to the AEO checklist flags it would
 * flip, then computes the deterministic overall-score delta if those flags
 * changed from false → true.
 *
 * Weights mirror computeAeoScoreFromChecklist exactly:
 *   Content Structure (cs_*) contributes 30% to overall
 *   E-E-A-T         (ee_*)  contributes 30% to overall
 *   Technical        (tc_*)  contributes 20% to overall
 *   Entity Alignment (ea_*)  contributes 15% to overall
 *
 * Each flag's contribution = (flagWeight / categoryTotalWeight) * categoryOverallWeight
 */
export function computeExpectedGainForRec(
  checklist: AeoChecklist,
  recId: string,
  sectionType: string,
): number {
  // Helper: compute overall delta if a set of flags were forced true
  const deltaIfFlipped = (
    flags: (keyof AeoChecklist)[],
    categoryWeight: number,   // e.g. 0.30 for CS/EEAT
    flagWeights: Record<string, number>,
    categoryTotalWeight: number,
  ): number => {
    let gain = 0;
    for (const flag of flags) {
      if (!checklist[flag]) {  // only contributes if currently false
        const w = flagWeights[flag as string] ?? 0;
        // Contribution to overall = (w / categoryTotalWeight) * categoryWeight * 100
        gain += (w / categoryTotalWeight) * categoryWeight * 100;
      }
    }
    return Math.round(gain);
  };

  const id = recId.toLowerCase();
  const st = sectionType.toLowerCase();

  // ── Map recommendation patterns to checklist flags ───────────────────────

  // Testimonials / social proof
  if (st === 'testimonials' || id.includes('testimonial') || id.includes('review') || id.includes('social-proof')) {
    return deltaIfFlipped(
      ['ee_hasTestimonialsOrReviews'],
      0.30, { ee_hasTestimonialsOrReviews: 5 }, 40,
    );
  }

  // E-E-A-T: Stats / specific claims
  if (id.includes('stat') || id.includes('number') || id.includes('result') || id.includes('data') || id.includes('proof')) {
    return deltaIfFlipped(
      ['ee_hasSpecificStats'],
      0.30, { ee_hasSpecificStats: 15 }, 40,
    );
  }

  // E-E-A-T: Named people / credentials / about
  if (st === 'about' || id.includes('author') || id.includes('credential') || id.includes('team') || id.includes('bio') || id.includes('expertise')) {
    return deltaIfFlipped(
      ['ee_hasAboutOrAuthorship', 'ee_hasNamedPeopleOrCredentials'],
      0.30, { ee_hasAboutOrAuthorship: 5, ee_hasNamedPeopleOrCredentials: 5 }, 40,
    );
  }

  // Trust / Certifications
  if (id.includes('trust') || id.includes('certif') || id.includes('award') || id.includes('badge') || id.includes('guarantee')) {
    return deltaIfFlipped(
      ['ee_hasCertificationsOrTrust'],
      0.30, { ee_hasCertificationsOrTrust: 10 }, 40,
    );
  }

  // Content structure: Answer capsule / inverted pyramid
  if (id.includes('answer') || id.includes('capsule') || id.includes('summary') || id.includes('opening') || id.includes('lede')) {
    return deltaIfFlipped(
      ['cs_hasAnswerCapsule'],
      0.30, { cs_hasAnswerCapsule: 15 }, 40,
    );
  }

  // Content structure: Lists / tables
  if (id.includes('list') || id.includes('bullet') || id.includes('table') || id.includes('format')) {
    return deltaIfFlipped(
      ['cs_hasListsOrTables'],
      0.30, { cs_hasListsOrTables: 10 }, 40,
    );
  }

  // Content structure: Question-driven headings
  if (id.includes('question') || id.includes('heading') || id.includes('h2') || id.includes('faq')) {
    return deltaIfFlipped(
      ['cs_hasQuestionDrivenHeadings'],
      0.30, { cs_hasQuestionDrivenHeadings: 5 }, 40,
    );
  }

  // Technical: JSON-LD schema
  if (id.includes('schema') || id.includes('json') || id.includes('structured-data') || id.includes('jsonld')) {
    return deltaIfFlipped(
      ['tc_hasJsonLd'],
      0.20, { tc_hasJsonLd: 12 }, 20,
    );
  }

  // Entity alignment: Terminology / specificity
  if (id.includes('specific') || id.includes('terminolog') || id.includes('language') || id.includes('generic') || id.includes('vague')) {
    return deltaIfFlipped(
      ['ea_usesSpecificTerminology'],
      0.15, { ea_usesSpecificTerminology: 10 }, 25,
    );
  }

  // Hero / H1 clarity — hero sections often affect entity alignment + content structure
  if (st === 'hero' || id.includes('hero') || id.includes('sharpen') || id.includes('h1') || id.includes('headline')) {
    return deltaIfFlipped(
      ['ea_businessNameInH1OrFirstPara', 'cs_hasAnswerCapsule'],
      0.15, { ea_businessNameInH1OrFirstPara: 5 }, 25,
    ) + deltaIfFlipped(
      ['cs_hasAnswerCapsule'],
      0.30, { cs_hasAnswerCapsule: 15 }, 40,
    );
  }

  // CTA sections — internal links help entity alignment
  if (st === 'cta' || id.includes('cta') || id.includes('call-to-action') || id.includes('conversion')) {
    return deltaIfFlipped(
      ['ea_hasInternalLinks'],
      0.15, { ea_hasInternalLinks: 5 }, 25,
    );
  }

  // Geographic / audience targeting
  if (id.includes('local') || id.includes('geographic') || id.includes('audience') || id.includes('location') || id.includes('target')) {
    return deltaIfFlipped(
      ['ea_hasGeographicOrAudienceTargeting'],
      0.15, { ea_hasGeographicOrAudienceTargeting: 2 }, 25,
    );
  }

  // Fallback: no recognisable pattern → 0
  return 0;
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
   - sectionType: which section type this targets — MUST be one of: hero | features | services | about | faq | cta | testimonials | generic
     IMPORTANT: never use "global". If a recommendation affects multiple sections (e.g. "add CTAs throughout"), pick the single section where the change will have the highest impact (usually "cta" for conversion, "hero" for messaging).
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


// ─── Step 5: AEO Strategy ─────────────────────────────────────────────────────

/**
 * Derives a structured AeoStrategy from the original site's AEO score.
 * Bridges the gap between assessment (Step 4) and site structure (Step 6).
 *
 * The strategy identifies which AEO gaps are most critical for this specific
 * business type, then prescribes section priorities and content guidance
 * that feed directly into the site structure plan.
 */
export async function generateAeoStrategy(
  originalScore: AeoScore,
  entityMap: EntityMap,
): Promise<AeoStrategy> {
  // ── Derive focus areas from lowest-scoring categories ─────────────────────
  const categories = [
    { name: 'Content Formatting & Structure', score: originalScore.content_structure },
    { name: 'E-E-A-T & Authority Signals',   score: originalScore.eeat             },
    { name: 'Technical AEO',                 score: originalScore.technical         },
    { name: 'Entity & Semantic Alignment',   score: originalScore.entity_alignment  },
  ];
  const sortedByGap = [...categories].sort((a, b) => a.score - b.score);
  const focusAreas = sortedByGap.slice(0, 2).map(c => c.name);

  // ── Identify checklist gaps → specific content guidance ───────────────────
  const cl = originalScore.checklist;
  const gaps: string[] = [];
  if (cl) {
    if (!cl.cs_hasAnswerCapsule)             gaps.push('Open every section with a 40-60 word declarative answer capsule (inverted pyramid)');
    if (!cl.cs_hasQuestionDrivenHeadings)    gaps.push('Rewrite H2/H3 headings as natural language questions users actually ask');
    if (!cl.cs_hasListsOrTables)             gaps.push('Restructure key content as bullet points or tables for machine extractability');
    if (!cl.ee_hasSpecificStats)             gaps.push('Include real numbers, credentials, years of experience, or measurable outcomes');
    if (!cl.ee_hasNamedPeopleOrCredentials)  gaps.push('Add named staff members, qualifications, and verifiable expertise statements');
    if (!cl.ee_hasTestimonialsOrReviews)     gaps.push('Include attributed client quotes or review excerpts with names');
    if (!cl.tc_hasJsonLd)                    gaps.push('Add JSON-LD schema: Organization, Service, and FAQPage structured data');
    if (!cl.ea_usesSpecificTerminology)      gaps.push('Replace vague descriptors with exact, consistent industry terminology throughout');
    if (!cl.ea_hasGeographicOrAudienceTargeting) gaps.push('Include specific location or target audience in the H1 and opening paragraph');
    if (!cl.ee_hasCertificationsOrTrust)     gaps.push('Add trust signals: certifications, awards, partner logos, or guarantee statements');
  }

  // ── Build section priorities from gap signals + business type ─────────────
  const sectionPriorities: Record<string, 'critical' | 'important' | 'optional'> = {
    hero:     'critical',
    cta:      'critical',
    services: 'critical',  // always critical for service businesses
  };

  // E-E-A-T deficits → about + testimonials become critical
  if (!cl?.ee_hasAboutOrAuthorship || !cl?.ee_hasNamedPeopleOrCredentials) {
    sectionPriorities.about = 'critical';
  } else {
    sectionPriorities.about = 'important';
  }

  if (!cl?.ee_hasTestimonialsOrReviews) {
    sectionPriorities.testimonials = 'critical';
  } else {
    sectionPriorities.testimonials = 'important';
  }

  // Content structure deficits → FAQ becomes critical
  if (!cl?.cs_hasListsOrTables || !cl?.cs_hasAnswerCapsule) {
    sectionPriorities.faq = 'critical';
  } else {
    sectionPriorities.faq = 'important';
  }

  sectionPriorities.features = 'important';

  // ── Gemini writes a business-type-specific rationale paragraph ────────────
  const model = getClient().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.3 },
  });

  const strategyPrompt = `You are an AEO strategist preparing a site rebuild plan.

Business: "${entityMap.businessName}" — a ${entityMap.businessType} (${entityMap.businessCategory})
Value proposition: ${entityMap.valueProposition}
Target audience: ${entityMap.targetAudience}

AEO score of the ORIGINAL site:
- Content Formatting & Structure: ${originalScore.content_structure}/100
- E-E-A-T & Authority Signals:   ${originalScore.eeat}/100
- Technical AEO:                 ${originalScore.technical}/100
- Entity Alignment:              ${originalScore.entity_alignment}/100
- Overall:                       ${originalScore.overall}/100

Weakest categories: ${focusAreas.join(', ')}
Key gaps: ${gaps.slice(0, 5).join('; ')}

Write exactly one paragraph (3-4 sentences) that:
1. Names which 1-2 AEO categories are weakest and explains why this specifically matters for a "${entityMap.businessType}"
2. States which section types (hero, about, faq, services, testimonials, cta) must be prioritised and why
3. Describes the copy characteristics the rebuild needs to demonstrate

Be specific to this business type. No generic AEO advice. Return ONLY the paragraph — no JSON, no headers.`;

  const rationale = (await model.generateContent(strategyPrompt)).response.text().trim();

  return { focusAreas, sectionPriorities, contentGuidance: gaps, rationale };
}


