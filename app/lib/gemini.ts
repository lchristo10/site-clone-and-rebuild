import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { AeoContent, AeoScore, DesignTokens, EntityMap } from './types';

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
  detectedFontLinks: string[] = []
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

  const fontHint = detectedFontLinks.length > 0
    ? `DETECTED FONT LINKS (extracted directly from the site's HTML — use these font family names exactly):\n${detectedFontLinks.join('\n')}`
    : 'No font links were detected in the HTML — infer font names from the screenshot.';

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

WEBSITE MARKDOWN CONTENT (first 3000 chars):
${markdown.substring(0, 3000)}

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

export async function generateAeoContent(
  markdown: string,
  entityMap: EntityMap,
  originalMeta: { title?: string; description?: string },
  navLinks: string[] = []  // Option 3A: extracted nav link labels from original HTML
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

  const prompt = `You are an AEO (Answer Engine Optimization) expert rebuilding a website for maximum AI visibility.

ORIGINAL SITE METADATA:
- Title: ${originalMeta.title || 'Unknown'}
- Description: ${originalMeta.description || 'Unknown'}

ENTITY MAP:
- Business: ${entityMap.businessName}
- Industry: ${entityMap.industry}
- Primary Service: ${entityMap.primaryService}
- Key Entities: ${entityMap.entities.join(', ')}
- Target Audience: ${entityMap.targetAudience}

ORIGINAL CONTENT (markdown):
${markdown.substring(0, 6000)}

NAV LINKS FROM ORIGINAL SITE (use these as section labels where relevant):
${navLinks.length > 0 ? navLinks.join(', ') : 'Not detected — infer from content'}

AEO REQUIREMENTS (follow strictly):
1. title: Include primary entity in first 60 chars. Include business name.
2. metaDescription: 155 chars max. Answer "what does this business do?" directly.
3. h1: Single H1 containing the primary entity + business name. Max 70 chars.
4. sections: Create 4-7 semantic sections. CRITICAL RULES:
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
5. jsonLd: Generate 2-3 Schema.org blocks as plain objects (type, name, description, etc.):
   - Always include Organization schema (include address here if found)
   - Add Service schema for each primary service
   - Add FAQPage schema if FAQ section exists
6. internalLinkSuggestions: 3-5 topic clusters to interlink (e.g. "services → case studies")

Preserve the brand's voice but make copy authoritative, direct, and scannable. Avoid fluff.`;

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
