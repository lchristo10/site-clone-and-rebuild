export type PhaseStatus = 'pending' | 'running' | 'done' | 'error';
export type FidelityMode = 'aeo-first' | 'brand-first';

export interface DesignTokens {
  colors: {
    primary: string;
    secondary: string;
    surface: string;
    text: string;
    accent: string;
    border?: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    baseSizePx: number;
    scaleRatio: number;
    detectedFontLinks?: string[];
  };
  spacing: {
    containerWidthPx: number;
    sectionPaddingPx: number;
    columnGapPx: number;
  };
  layout: {
    navType: 'fixed' | 'sticky' | 'static';
    navStyle: 'horizontal' | 'stacked-display' | 'sidebar' | 'minimal';
    heroType: 'full-viewport' | 'split' | 'minimal';
    columnCount: number;
  };
}

/**
 * Brand DNA — extracted once from the homepage as a pre-pass.
 * Provides a locked 60-30-10 colour strategy and type pairing
 * that is shared across every page synthesized in a job.
 */
export interface BrandDNA {
  /** 60-30-10 palette — all hex values extracted from the real site */
  palette: {
    dominant:   string;  // 60% — primary background / surface colour
    supporting: string;  // 30% — nav bar, cards, secondary sections
    accent:     string;  // 10% — CTAs, highlights, links, hover states
    text:       string;  // Primary body copy colour
    textMuted:  string;  // Secondary text, captions, placeholders
  };
  typePairing: {
    heading: string;  // Font family name for headings (Google Font or system)
    body:    string;  // Font family name for body copy
  };
  voiceTone: string;   // ≤ 5 descriptors, e.g. "luxurious, understated, expert"
  industry:  string;   // e.g. "hair salon", "law firm", "e-commerce"
  brandName: string;   // Extracted from nav/logo text
}

export interface EntityMap {
  businessName: string;
  industry: string;
  primaryService: string;
  entities: string[];
  targetAudience: string;
}

export interface AeoContent {
  title: string;
  metaDescription: string;
  h1: string;
  sections: AeoSection[];
  jsonLd: object[];
  internalLinkSuggestions: string[];
}

export interface AeoSection {
  type: 'hero' | 'features' | 'services' | 'about' | 'testimonials' | 'faq' | 'cta' | 'generic';
  heading: string;
  headingLevel: 'h2' | 'h3' | 'h4';
  body: string;
  isList: boolean;
  listItems?: string[];
}

export interface AeoScore {
  overall: number;
  content_structure: number;
  eeat: number;
  technical: number;
  entity_alignment: number;
  aiSummary: string;
  recommendations: string[];
  canSummarizeIn2Sentences: boolean;
  missingPageSuggestions: string[]; // Pages the site should have for AEO completeness
}

export interface PhaseResult {
  status: PhaseStatus;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  data?: unknown;
}

// ── Multi-page support ────────────────────────────────────────────────────────

/** A single discovered nav page and its rebuilt HTML output. */
export interface BuiltPage {
  slug: string;       // e.g. 'home', 'studio', 'services'
  title: string;      // Display label from the nav link
  url: string;        // Original URL of this page
  html: string;       // Rebuilt/synthesised HTML
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
  /** Section schema stored per-page so the refine endpoint can patch individual sections */
  aeoContent?: AeoContent;
}

export interface JobState {
  jobId: string;
  url: string;
  status: 'queued' | 'running' | 'done' | 'error';
  createdAt: number;
  fidelityMode: FidelityMode;
  /** Locked brand identity extracted from the homepage — shared across all pages */
  brandDna?: BrandDNA;
  /** All discovered and rebuilt pages. Key = slug. */
  pages: Record<string, BuiltPage>;
  phases: {
    extract: PhaseResult & {
      screenshotUrl?: string;
      markdown?: string;
      html?: string;
      detectedFontLinks?: string[];
      fetchedStylesheets?: string[];
      meta?: { title?: string; description?: string };
    };
    analyze: PhaseResult & { tokens?: DesignTokens; entityMap?: EntityMap };
    draft: PhaseResult & { aeoContent?: AeoContent };
    synthesize: PhaseResult & { builtHtml?: string };
    audit: PhaseResult & { score?: AeoScore };
  };
}

export interface StreamEvent {
  phase: 'extract' | 'analyze' | 'draft' | 'synthesize' | 'audit' | 'system';
  status: PhaseStatus | 'log';
  message: string;
  data?: unknown;
}
