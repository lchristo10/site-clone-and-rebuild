export type PhaseStatus = 'pending' | 'running' | 'done' | 'error';

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
  };
  spacing: {
    containerWidthPx: number;
    sectionPaddingPx: number;
    columnGapPx: number;
  };
  layout: {
    navType: 'fixed' | 'sticky' | 'static';
    heroType: 'full-viewport' | 'split' | 'minimal';
    columnCount: number;
  };
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
}

export interface PhaseResult {
  status: PhaseStatus;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  data?: unknown;
}

export interface JobState {
  jobId: string;
  url: string;
  status: 'queued' | 'running' | 'done' | 'error';
  createdAt: number;
  phases: {
    extract: PhaseResult & { screenshotUrl?: string; markdown?: string; html?: string; meta?: { title?: string; description?: string } };
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
