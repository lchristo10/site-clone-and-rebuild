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
  markdown: string
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
                  heroType: { type: SchemaType.STRING },
                  columnCount: { type: SchemaType.NUMBER },
                },
                required: ['navType', 'heroType', 'columnCount'],
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

  const prompt = `You are a senior UI/UX designer and technical analyst.

Analyze this website screenshot and the markdown content below. Extract:

1. Design tokens — exact colors (as hex codes), fonts, spacing values, layout type:
   - navType: "fixed", "sticky", or "static"
   - heroType: "full-viewport", "split", or "minimal"
   - columnCount: main content column count (1, 2, or 3)
   - containerWidthPx: approx max content width in pixels
   - sectionPaddingPx: approx vertical padding between sections
   - columnGapPx: approx gap between columns

2. Entity map — identify the core semantic entities:
   - businessName: the company/brand name
   - industry: e.g. "SaaS", "Legal Services", "E-commerce"
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

// ─── Phase 3: AEO Content Generation ─────────────────────────────────────────

export async function generateAeoContent(
  markdown: string,
  entityMap: EntityMap,
  originalMeta: { title?: string; description?: string }
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
5. jsonLd: Generate 2-3 Schema.org blocks as plain objects (type, name, description, etc.):
   - Always include Organization schema
   - Add Service schema for each primary service
   - Add FAQPage schema if FAQ section exists
6. internalLinkSuggestions: 3-5 topic clusters to interlink (e.g. "services → case studies")

Preserve the brand's voice but make copy authoritative, direct, and scannable. Avoid fluff.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as AeoContent;
}

// ─── Phase 5: AEO Audit ───────────────────────────────────────────────────────

export async function auditAeoScore(builtHtml: string): Promise<AeoScore> {
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
        },
        required: ['overall', 'content_structure', 'eeat', 'technical', 'entity_alignment', 'aiSummary', 'recommendations', 'canSummarizeIn2Sentences'],
      },
    },
  });

  const prompt = `You are an AI answer engine (like Perplexity or Google AI Overviews). Read the following HTML page and evaluate its AEO (Answer Engine Optimization) quality.

HTML CONTENT:
${builtHtml.substring(0, 8000)}

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

Score honestly. This is used to show users what still needs human refinement.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as AeoScore;
}
