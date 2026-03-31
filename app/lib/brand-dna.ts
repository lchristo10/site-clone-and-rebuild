import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { BrandDNA } from './types';

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

// ── Fallback DNA for when extraction fails ────────────────────────────────────

const FALLBACK_DNA: BrandDNA = {
  palette: {
    dominant:   '#ffffff',
    supporting: '#1a1a1a',
    accent:     '#2563eb',
    text:       '#111827',
    textMuted:  '#6b7280',
  },
  typePairing: { heading: 'Inter', body: 'Inter' },
  voiceTone:   'professional, clear',
  industry:    'business',
  brandName:   'Brand',
};

// ── Gemini schema ─────────────────────────────────────────────────────────────

const BRAND_DNA_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    palette: {
      type: SchemaType.OBJECT,
      properties: {
        dominant:   { type: SchemaType.STRING },
        supporting: { type: SchemaType.STRING },
        accent:     { type: SchemaType.STRING },
        text:       { type: SchemaType.STRING },
        textMuted:  { type: SchemaType.STRING },
      },
      required: ['dominant', 'supporting', 'accent', 'text', 'textMuted'],
    },
    typePairing: {
      type: SchemaType.OBJECT,
      properties: {
        heading: { type: SchemaType.STRING },
        body:    { type: SchemaType.STRING },
      },
      required: ['heading', 'body'],
    },
    voiceTone: { type: SchemaType.STRING },
    industry:  { type: SchemaType.STRING },
    brandName: { type: SchemaType.STRING },
  },
  required: ['palette', 'typePairing', 'voiceTone', 'industry', 'brandName'],
};

// ── Main extraction function ──────────────────────────────────────────────────

/**
 * Runs a focused Gemini call to extract locked Brand DNA from the homepage.
 * Executes BEFORE analyzeDesignTokens so that colour decisions are grounded
 * in the actual scraped CSS values rather than re-inferred alongside layout.
 *
 * 60-30-10 rule:
 *   60% dominant  → primary background / large surface areas
 *   30% supporting → nav, cards, secondary sections
 *   10% accent    → CTAs, highlights, interactive elements
 */
export async function extractBrandDna(input: {
  markdown: string;
  html:     string;
  fetchedStylesheets: string[];
  siteUrl:  string;
}): Promise<BrandDNA> {
  const cssSnippet = input.fetchedStylesheets
    .join('\n')
    .slice(0, 8000); // cap to avoid token blowout

  const prompt = `You are a senior brand strategist and design systems engineer.
Extract the Brand DNA from this website's scraped content.
Apply the 60-30-10 colour rule strictly.

## Website URL
${input.siteUrl}

## Page Content (markdown, first 2000 chars)
${input.markdown.slice(0, 2000)}

## Site CSS (real colour values — use these, don't fabricate)
${cssSnippet || '(no stylesheets available — infer from industry/page tone)'}

---

Return ONLY the JSON object matching the schema. Rules:
1. Extract real hex colours from the CSS when available — NEVER invent random hex codes
2. dominant  = the colour covering ~60% of the screen (typically a background)
3. supporting = the colour covering ~30% (nav bar, card backgrounds)
4. accent    = the CTA button / link / highlight colour (~10%)
5. text      = the primary body copy colour
6. textMuted = secondary, lighter text
7. typePairing: prefer fonts found in CSS; fall back to a fitting Google Font
8. brandName: take from the page <title>, nav logo, or h1`;

  try {
    const model = getClient().getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: BRAND_DNA_SCHEMA,
        temperature: 0.1,  // deterministic extraction
      } as Parameters<ReturnType<typeof getClient>['getGenerativeModel']>[0]['generationConfig'],
    });

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const parsed = JSON.parse(raw) as BrandDNA;
    return parsed;
  } catch (err) {
    console.warn('[BrandDNA] Extraction failed, using fallback:', err instanceof Error ? err.message : err);
    try {
      return { ...FALLBACK_DNA, brandName: new URL(input.siteUrl).hostname.replace('www.', '') };
    } catch {
      return FALLBACK_DNA;
    }
  }
}

// ── CSS token generator ───────────────────────────────────────────────────────

/**
 * Converts a BrandDNA into CSS custom property declarations for the :root block.
 *
 * Emits both semantic brand tokens AND functional aliases:
 *   --color-brand-*  → human-readable, editable in downstream tools
 *   --c-*            → functional aliases used throughout the synthesizer stylesheet
 *
 * When BrandDNA is present, the functional aliases point to var(--color-brand-*)
 * so changing a brand token cascades automatically.
 */
export function brandDnaToCssTokens(dna: BrandDNA): string {
  return `
  /* ╔══ Brand DNA — 60-30-10 colour system ══════════════════════════════╗ */
  --color-brand-dominant:   ${dna.palette.dominant};   /* 60% surface   */
  --color-brand-supporting: ${dna.palette.supporting}; /* 30% structure */
  --color-brand-accent:     ${dna.palette.accent};     /* 10% highlight */
  --color-brand-text:       ${dna.palette.text};
  --color-brand-text-muted: ${dna.palette.textMuted};
  --font-brand-heading:     '${dna.typePairing.heading}', system-ui, sans-serif;
  --font-brand-body:        '${dna.typePairing.body}', system-ui, sans-serif;
  /* ╚════════════════════════════════════════════════════════════════════╝ */

  /* Functional aliases → all sourced from Brand DNA */
  --c-primary:   var(--color-brand-supporting);
  --c-accent:    var(--color-brand-accent);
  --c-surface:   var(--color-brand-dominant);
  --c-text:      var(--color-brand-text);
  --c-muted:     var(--color-brand-text-muted);
  --c-border:    color-mix(in srgb, var(--color-brand-supporting) 15%, var(--color-brand-dominant));`.trimStart();
}
