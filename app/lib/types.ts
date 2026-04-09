export type PhaseStatus = 'pending' | 'running' | 'done' | 'error';
export type FidelityMode = 'aeo-first' | 'brand-first';
export type SiteObjective = 'sell-products' | 'make-bookings' | 'capture-leads' | 'other';
export type AeoImportance = 'critical' | 'important' | 'optional';

/**
 * 5-dimension persona captured from the Vibe Forge duels.
 * Each field drives both copy strategy (Gemini prompts) and design token adjustments.
 */
export interface SitePersona {
  /** Duel 1 — Layout density */
  layout: 'spacious' | 'dense';
  /** Duel 2 — Voice / tone */
  tone: 'professional' | 'disruptor';
  /** Duel 3 — Visual language */
  imagery: 'human-centric' | 'abstract-tech';
  /** Duel 4 — Motion & interaction */
  motion: 'static' | 'high-motion';
  /** Duel 5 — Information architecture */
  architecture: 'linear-story' | 'deep-hub';
}

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
  /** @deprecated use businessCategory + businessType instead */
  industry: string;
  /** Broad category: "service" | "product" | "ecommerce" | "saas" | "marketplace" | "non-profit" */
  businessCategory: string;
  /** Specific type within category: "hair salon" | "yoga studio" | "accounting firm" etc. */
  businessType: string;
  /** Two-sentence value proposition distinguishing this business from others of the same type */
  valueProposition: string;
  primaryService: string;
  entities: string[];
  targetAudience: string;
}

/**
 * Real E-E-A-T signals extracted from the original site's scraped markdown.
 * Populated by extractRealSiteContent() after the strategy phase.
 * Injected into generateAeoContent() so Gemini uses actual site content
 * instead of fabricating plausible-sounding but inaccurate details.
 */
export interface RealSiteContent {
  /** Direct client quotes or paraphrased reviews with attribution */
  testimonials: string[];
  /** Named team members with role and credentials e.g. "Jessica — Senior Stylist, 10 years experience" */
  staffMembers: string[];
  /** Specific quantitative claims e.g. "Over 500 clients", "15 years in business" */
  stats: string[];
  /** Certifications, awards, industry memberships, guarantees */
  trustSignals: string[];
  /** Named services with details/pricing if available */
  services: string[];
  /** Geographic targets or audience specifics e.g. "Newmarket, Auckland" */
  locations: string[];
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

/**
 * Flat binary checklist returned by Gemini (temperature 0.2).
 * Scores are computed deterministically in TypeScript from these fields.
 */
export interface AeoChecklist {
  // Content Structure
  cs_hasH1: boolean;
  cs_hasQuestionDrivenHeadings: boolean;
  cs_hasListsOrTables: boolean;
  cs_hasAnswerCapsule: boolean;
  cs_hasMultipleSections: boolean;
  // E-E-A-T
  ee_hasAboutOrAuthorship: boolean;
  ee_hasNamedPeopleOrCredentials: boolean;
  ee_hasTestimonialsOrReviews: boolean;
  ee_hasSpecificStats: boolean;
  ee_hasCertificationsOrTrust: boolean;
  // Technical
  tc_hasJsonLd: boolean;
  tc_hasSemanticHtml: boolean;
  tc_hasSingleH1: boolean;
  tc_hasMetaDescription: boolean;
  tc_isReadableWithoutJs: boolean;
  // Entity Alignment
  ea_businessNameInH1OrFirstPara: boolean;
  ea_primaryServiceNamed: boolean;
  ea_usesSpecificTerminology: boolean;
  ea_hasInternalLinks: boolean;
  ea_hasGeographicOrAudienceTargeting: boolean;
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
  missingPageSuggestions: string[];
  /** Binary checklist used to compute the scores — present on all new audits. */
  checklist?: AeoChecklist;
}

// ── AEO Site Structure (Tactical Grid) ───────────────────────────────────────

/**
 * One cell in the tactical grid — a planned section for a specific page.
 */
export interface PlannedSection {
  /** Section type, aligned with AeoSection['type'] */
  type: 'hero' | 'features' | 'services' | 'about' | 'testimonials' | 'faq' | 'cta' | 'generic';
  /** 2-4 word cell label shown in the grid, e.g. "Trust signals" */
  label: string;
  /** Why this section exists from an AEO perspective (1-2 sentences) */
  rationale: string;
  /** How critical this section is for AEO performance */
  importance: AeoImportance;
}

/**
 * One column in the tactical grid — a planned page.
 */
export interface PlannedPage {
  slug: string;
  title: string;
  /** What this page is designed to answer from an AEO perspective */
  intent: string;
  sections: PlannedSection[];
}

/**
 * The full AEO site structure plan, generated before synthesis.
 * Drives section ordering and content focus for every page.
 */
export interface SitePlan {
  generatedAt: number;
  pages: PlannedPage[];
}

// ── AI Strategist ─────────────────────────────────────────────────────────────

export type RecommendationPriority = 'high' | 'medium' | 'low';
export type RecommendationStatus = 'pending' | 'accepted' | 'rejected' | 'applied';

export interface StrategistRecommendation {
  id: string;
  priority: RecommendationPriority;
  /** Which section type this recommendation targets (or 'global') */
  sectionType: string;
  title: string;
  rationale: string;
  /** The specific improvement Gemini should make when patching */
  suggestedAction: string;
  status: RecommendationStatus;
  userComment?: string;
  /**
   * Deterministic AEO overall-score point gain (0-100) if this recommendation
   * is applied — computed from the checklist weights, not estimated by AI.
   * 0 means the targeted signal is already passing.
   */
  expectedScoreGain?: number;
}

export interface StrategistReport {
  generatedAt: number;
  beforeScore: AeoScore;   // score of original scraped site
  afterScore: AeoScore;    // score of rebuilt site at time of analysis
  recommendations: StrategistRecommendation[];
  /** One-paragraph executive summary from the AI Strategist */
  executiveSummary: string;
}

// ── AEO Strategy (Step 5) ─────────────────────────────────────────────────────

/**
 * Structured strategy derived from the AEO assessment of the original site.
 * Bridges the gap between the raw score and the site structure plan.
 */
export interface AeoStrategy {
  /** The 1-2 lowest-scoring categories that will drive structural priorities */
  focusAreas: string[];
  /**
   * Section types the site structure MUST include, keyed by importance.
   * e.g. { faq: 'critical', testimonials: 'important', about: 'critical' }
   */
  sectionPriorities: Record<string, 'critical' | 'important' | 'optional'>;
  /** Specific copy and content guidance derived from the checklist gaps */
  contentGuidance: string[];
  /** One-paragraph rationale explaining the strategy for this specific business type */
  rationale: string;
}

export interface PhaseResult {
  status: PhaseStatus;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  data?: unknown;
}

// ── Multi-page support ────────────────────────────────────────────────────────

export interface BuiltPage {
  slug: string;
  title: string;
  url: string;
  html: string;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
  aeoContent?: AeoContent;
}

export interface JobState {
  jobId: string;
  url: string;
  status: 'queued' | 'running' | 'done' | 'error';
  createdAt: number;
  fidelityMode: FidelityMode;
  siteObjective: SiteObjective;
  sitePersona?: SitePersona;
  brandDna?: BrandDNA;
  pages: Record<string, BuiltPage>;
  /** AEO site structure plan — generated before synthesis begins */
  sitePlan?: SitePlan;
  /** AEO score of the original scraped site (before rebuild) */
  originalScore?: AeoScore;
  /** AEO strategy derived from the original site's score — drives site structure */
  aeoStrategy?: AeoStrategy;
  /** AI Strategist report — generated on demand after build */
  strategistReport?: StrategistReport;
  /** Whether the brand theme has been committed to all page HTML (via apply-brand) */
  brandThemeApplied?: boolean;
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
  phase: 'extract' | 'analyze' | 'strategy' | 'plan' | 'draft' | 'synthesize' | 'audit' | 'system';
  status: PhaseStatus | 'log';
  message: string;
  data?: unknown;
}
