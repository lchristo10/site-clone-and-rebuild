'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AeoScoreGrid } from '@/components/aeo-score-ring';

type Props = { params: Promise<{ jobId: string }> };

interface PageSummary {
  slug: string;
  title: string;
  url: string;
  status: 'pending' | 'running' | 'done' | 'error';
  /** Section types available on this page, for the refine panel */
  sectionTypes?: string[];
}

interface AeoScore {
  overall: number;
  content_structure: number;
  eeat: number;
  technical: number;
  entity_alignment: number;
  aiSummary: string;
  recommendations: string[];
  canSummarizeIn2Sentences: boolean;
  missingPageSuggestions?: string[];
}

export default function PreviewPage({ params }: Props) {
  const { jobId } = use(params);
  const [view, setView] = useState<'rebuilt' | 'score'>('rebuilt');
  const [score, setScore] = useState<AeoScore | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [previewReady, setPreviewReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [activePage, setActivePage] = useState('home');

  // ── Refine panel state ────────────────────────────────────────────────────
  const [refineOpen, setRefineOpen]           = useState(false);
  const [refineSection, setRefineSection]     = useState('');
  const [refineInstruction, setRefineInstruction] = useState('');
  const [refineStatus, setRefineStatus]       = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [refineError, setRefineError]         = useState('');
  // Used to force iframe remount after a successful refinement
  const [previewKey, setPreviewKey]           = useState(0);

  // iframe src changes with selected page
  const previewSrc = `/api/clone/preview/${jobId}?page=${activePage}`;

  // Sections available on the currently active page
  const activeSections = pages.find(p => p.slug === activePage)?.sectionTypes ?? [];

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  useEffect(() => {
    const loadJobData = async () => {
      try {
        const statusRes = await fetch(`/api/clone/status/${jobId}`);
        if (statusRes.ok) {
          const data = await statusRes.json();
          if (data.url) setOriginalUrl(data.url);
          if (data.pages?.length > 0) {
            // Map pages and extract section types if available
            const mapped = data.pages.map((p: PageSummary & { aeoContent?: { sections: { type: string }[] } }) => ({
              ...p,
              sectionTypes: p.aeoContent?.sections.map((s: { type: string }) => s.type) ?? [],
            }));
            setPages(mapped);
          }
          if (data.phases?.audit?.score) {
            const s = data.phases.audit.score;
            setScore(s);
            setRecommendations(s.recommendations || []);
            setAiSummary(s.aiSummary || '');
          }
        }

        const previewRes = await fetch(`/api/clone/preview/${jobId}`, { method: 'HEAD' });
        if (previewRes.ok) setPreviewReady(true);
      } catch { /* ignore */ }

      try {
        const stored = localStorage.getItem('alias-compiler-jobs');
        if (stored) {
          const jobs = JSON.parse(stored);
          const job = jobs.find((j: { jobId: string; url: string }) => j.jobId === jobId);
          if (job && !originalUrl) setOriginalUrl(job.url);
        }
      } catch { /* ignore */ }
    };

    loadJobData();
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refine submit handler ────────────────────────────────────────────────
  const handleRefine = useCallback(async () => {
    if (!refineSection || !refineInstruction.trim()) return;
    setRefineStatus('loading');
    setRefineError('');
    try {
      const res = await fetch(`/api/clone/refine/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageSlug:    activePage,
          sectionType: refineSection,
          instruction: refineInstruction,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Refinement failed');
      }
      setRefineStatus('success');
      setRefineInstruction('');
      // Force iframe remount to show updated page
      setPreviewKey(k => k + 1);
      setTimeout(() => setRefineStatus('idle'), 3000);
    } catch (err) {
      setRefineStatus('error');
      setRefineError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [jobId, activePage, refineSection, refineInstruction]);

  const donePagesCount = pages.filter(p => p.status === 'done').length;

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Top Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/90 backdrop-blur-md gap-3">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
          <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-muted-foreground">ALIAS</span>
          <span className="text-muted-foreground/30 mx-1">·</span>
          <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-alias-green">COMPILER</span>
        </Link>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-md p-1">
          <button
            onClick={() => setView('rebuilt')}
            className={`px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider rounded transition-all ${
              view === 'rebuilt'
                ? 'bg-alias-green text-background font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            ◈ Rebuilt Preview
          </button>
          <button
            onClick={() => setView('score')}
            className={`px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider rounded transition-all ${
              view === 'score'
                ? 'bg-alias-green text-background font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            ◉ AEO Report
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {previewReady && (
            <a
              href={previewSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-[9px] font-mono uppercase tracking-wider border border-border text-muted-foreground rounded hover:text-foreground hover:border-foreground/30 transition-all"
            >
              ↗ Full View
            </a>
          )}
          <button
            onClick={copyLink}
            className="px-3 py-2 text-[9px] font-mono uppercase tracking-wider border border-border text-muted-foreground rounded hover:text-foreground hover:border-foreground/30 transition-all"
          >
            {copied ? '✓ Copied' : '⧉ Share'}
          </button>
          <a
            href={`/api/clone/download/${jobId}`}
            className="px-3 py-2 text-[9px] font-mono uppercase tracking-wider border border-border text-muted-foreground rounded hover:text-foreground hover:border-foreground/30 transition-all"
          >
            ↓ ZIP
          </a>
          <Link
            href={`/clone/${jobId}`}
            className="px-3 py-2 text-[9px] font-mono uppercase tracking-wider border border-border text-muted-foreground rounded hover:text-foreground hover:border-foreground/30 transition-all"
          >
            ← Pipeline
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 pt-[49px] flex flex-col">
        {view === 'rebuilt' ? (
          <div className="flex-1 flex flex-col">
            {previewReady ? (
              <>
                {/* Status bar + page switcher */}
                <div className="px-4 py-2 border-b border-border/30 bg-card/50 flex items-center gap-4 flex-shrink-0 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-alias-green" />
                    <span className="text-[9px] font-mono text-alias-green uppercase tracking-wider">AEO-Optimised</span>
                  </div>

                  {/* Page switcher tabs — only shown when multiple pages exist */}
                  {pages.length > 1 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {pages.map(p => (
                        <button
                          key={p.slug}
                          onClick={() => setActivePage(p.slug)}
                          disabled={p.status !== 'done'}
                          title={p.status !== 'done' ? `${p.title}: ${p.status}` : p.title}
                          className={`px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider rounded transition-all border ${
                            activePage === p.slug
                              ? 'bg-alias-green text-background border-alias-green font-bold'
                              : p.status === 'done'
                              ? 'text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
                              : p.status === 'running'
                              ? 'text-alias-amber border-alias-amber/30 opacity-60 cursor-wait'
                              : p.status === 'error'
                              ? 'text-alias-red border-alias-red/30 opacity-60 cursor-not-allowed'
                              : 'text-muted-foreground/30 border-border/20 opacity-40 cursor-not-allowed'
                          }`}
                        >
                          {p.status === 'running' ? '⟳ ' : p.status === 'error' ? '✗ ' : ''}
                          {p.title}
                        </button>
                      ))}
                      <span className="text-[9px] font-mono text-muted-foreground/40 ml-1">
                        {donePagesCount}/{pages.length} pages
                      </span>
                    </div>
                  )}

                  {originalUrl && (
                    <span className="text-[9px] font-mono text-muted-foreground/50 truncate ml-auto">
                      rebuilt from: {originalUrl}
                    </span>
                  )}
                </div>

                <iframe
                  key={`${previewSrc}-${previewKey}`} // remount on page change OR after refinement
                  src={previewSrc}
                  className="flex-1 w-full border-0"
                  title="Rebuilt AEO-optimised site preview"
                  sandbox="allow-same-origin allow-popups"
                />

                {/* ── Refine Panel ─────────────────────────────────────── */}
                <div className={`border-t border-border/30 bg-card/80 backdrop-blur-sm transition-all duration-300 ${
                  refineOpen ? 'max-h-72' : 'max-h-10'
                } overflow-hidden flex-shrink-0`}>

                  {/* Panel header / toggle */}
                  <button
                    onClick={() => setRefineOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-foreground/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-alias-green text-[10px]">✦</span>
                      <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-foreground/70">Refine Section</span>
                      {activeSections.length === 0 && (
                        <span className="text-[9px] font-mono text-muted-foreground/40">(no schema available)</span>
                      )}
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground/50">
                      {refineOpen ? '▼' : '▲'}
                    </span>
                  </button>

                  {/* Panel body */}
                  <div className="px-4 pb-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {/* Section selector */}
                      <div className="flex-shrink-0">
                        <p className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-1.5">Section</p>
                        <select
                          value={refineSection}
                          onChange={e => setRefineSection(e.target.value)}
                          className="bg-background border border-border rounded px-2 py-1.5 text-[10px] font-mono text-foreground min-w-[120px] focus:outline-none focus:border-alias-green/50"
                        >
                          <option value="">Select...</option>
                          {(activeSections.length > 0
                            ? activeSections
                            : ['hero', 'features', 'services', 'about', 'cta', 'faq', 'testimonials']
                          ).map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>

                      {/* Instruction input */}
                      <div className="flex-1">
                        <p className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-1.5">Instruction</p>
                        <textarea
                          value={refineInstruction}
                          onChange={e => setRefineInstruction(e.target.value)}
                          placeholder='e.g. "Make the hero darker with a full-bleed background"'
                          rows={2}
                          className="w-full bg-background border border-border rounded px-3 py-2 text-xs font-mono text-foreground resize-none focus:outline-none focus:border-alias-green/50 placeholder:text-muted-foreground/30"
                        />
                      </div>

                      {/* Submit */}
                      <div className="flex-shrink-0 pt-5">
                        <button
                          onClick={handleRefine}
                          disabled={!refineSection || !refineInstruction.trim() || refineStatus === 'loading'}
                          className={`px-4 py-2 text-[9px] font-mono uppercase tracking-wider rounded border transition-all ${
                            refineStatus === 'loading'
                              ? 'border-alias-green/30 text-alias-green/50 cursor-wait'
                              : refineStatus === 'success'
                              ? 'border-alias-green bg-alias-green/10 text-alias-green'
                              : 'border-alias-green text-alias-green hover:bg-alias-green/10 disabled:opacity-30 disabled:cursor-not-allowed'
                          }`}
                        >
                          {refineStatus === 'loading' ? '⟳ Refining...' :
                           refineStatus === 'success' ? '✓ Applied' :
                           '✦ Refine'}
                        </button>
                      </div>
                    </div>

                    {/* Status messages */}
                    {refineStatus === 'error' && (
                      <p className="text-[9px] font-mono text-alias-red">
                        ✗ {refineError}
                      </p>
                    )}
                    {refineStatus === 'success' && (
                      <p className="text-[9px] font-mono text-alias-green">
                        ✓ Section refined — preview updated
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="text-4xl font-mono text-alias-green animate-terminal-blink">▶</div>
                  <p className="text-sm font-mono text-muted-foreground">Loading preview...</p>
                  <p className="text-[10px] font-mono text-muted-foreground/40">
                    If this takes too long, the pipeline may still be running.{' '}
                    <Link href={`/clone/${jobId}`} className="text-alias-green underline">Check pipeline →</Link>
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          // AEO Report view
          <div className="flex-1 overflow-y-auto px-6 pb-12">
            <div className="max-w-4xl mx-auto py-8 space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-alias-green" />
                <h1 className="text-sm font-mono uppercase tracking-[0.2em] text-foreground">AEO Audit Report</h1>
              </div>

              {score ? (
                <>
                  {/* Score overview */}
                  <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
                    <div className="bg-card border border-border rounded-lg p-6">
                      <AeoScoreGrid
                        overall={score.overall}
                        content_structure={score.content_structure}
                        eeat={score.eeat}
                        technical={score.technical}
                        entity_alignment={score.entity_alignment}
                      />
                    </div>

                    <div className="space-y-4">
                      {/* AI Summary */}
                      <div className="bg-card border border-alias-green/30 rounded-lg p-4">
                        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">AI Summary Test</p>
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`text-[10px] font-mono ${score.canSummarizeIn2Sentences ? 'text-alias-green' : 'text-alias-red'}`}>
                            {score.canSummarizeIn2Sentences ? '✓ AI can summarize this site in 2 sentences' : '✗ AI struggles to summarize — needs clearer structure'}
                          </span>
                        </div>
                        {aiSummary && (
                          <blockquote className="border-l-2 border-alias-green/40 pl-3 text-sm text-foreground/80 italic leading-relaxed">
                            &ldquo;{aiSummary}&rdquo;
                          </blockquote>
                        )}
                      </div>

                      {/* Category breakdown */}
                      <div className="space-y-2">
                        {[
                          { key: 'content_structure', label: 'Content Structure', score: score.content_structure, weight: '30%', tip: 'Inverted pyramid, answer capsules, list formatting, question-driven headings' },
                          { key: 'eeat', label: 'E-E-A-T', score: score.eeat, weight: '30%', tip: 'Authorship, original data, external citations, trust signals' },
                          { key: 'technical', label: 'Technical AEO', score: score.technical, weight: '20%', tip: 'Schema.org JSON-LD, semantic HTML5, heading hierarchy, raw HTML accessibility' },
                          { key: 'entity_alignment', label: 'Entity Alignment', score: score.entity_alignment, weight: '20%', tip: 'Entity salience in H1/early body, topic clustering, consistent terminology' },
                        ].map(cat => (
                          <div key={cat.key} className="bg-card border border-border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="text-xs font-mono text-foreground/80">{cat.label}</p>
                                <p className="text-[9px] font-mono text-muted-foreground/50">Weight: {cat.weight}</p>
                              </div>
                              <span className={`text-xl font-mono font-bold ${cat.score >= 70 ? 'text-alias-green' : cat.score >= 40 ? 'text-alias-amber' : 'text-alias-red'}`}>
                                {cat.score}
                              </span>
                            </div>
                            <div className="w-full h-1 bg-border/30 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-1000"
                                style={{
                                  width: `${cat.score}%`,
                                  background: cat.score >= 70 ? 'oklch(0.72 0.2 145)' : cat.score >= 40 ? 'oklch(0.78 0.18 75)' : 'oklch(0.62 0.22 25)',
                                }}
                              />
                            </div>
                            <p className="text-[9px] font-mono text-muted-foreground/40 mt-2">{cat.tip}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Pages coverage */}
                  {pages.length > 0 && (
                    <div className="bg-card border border-border rounded-lg p-6">
                      <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">
                        Pages Crawled &amp; Rebuilt
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {pages.map(p => (
                          <span
                            key={p.slug}
                            className={`px-2.5 py-1 text-[9px] font-mono rounded border ${
                              p.status === 'done'
                                ? 'border-alias-green/40 text-alias-green bg-alias-green/5'
                                : p.status === 'error'
                                ? 'border-alias-red/40 text-alias-red bg-alias-red/5'
                                : 'border-border text-muted-foreground'
                            }`}
                          >
                            {p.status === 'done' ? '✓' : p.status === 'error' ? '✗' : '○'} {p.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing page suggestions */}
                  {score.missingPageSuggestions && score.missingPageSuggestions.length > 0 && (
                    <div className="bg-card border border-alias-amber/30 rounded-lg p-6">
                      <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-alias-amber mb-4">
                        ⚠ Recommended Missing Pages (for AEO Completeness)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {score.missingPageSuggestions.map((page, i) => (
                          <span key={i} className="px-2.5 py-1 text-[9px] font-mono rounded border border-alias-amber/30 text-alias-amber bg-alias-amber/5">
                            + {page}
                          </span>
                        ))}
                      </div>
                      <p className="text-[9px] font-mono text-muted-foreground/50 mt-3">
                        Adding these pages would improve AI discoverability and answer coverage for this business type.
                      </p>
                    </div>
                  )}

                  {/* Recommendations */}
                  {recommendations.length > 0 && (
                    <div className="bg-card border border-border rounded-lg p-6">
                      <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">
                        Top Improvement Recommendations
                      </p>
                      <ol className="space-y-3">
                        {recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="text-[9px] font-mono text-alias-green bg-alias-green-dim px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                            <p className="text-sm text-foreground/80 leading-relaxed">{rec}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-card border border-border rounded-lg p-8 text-center space-y-4">
                  <p className="text-sm font-mono text-muted-foreground">AEO score not available yet.</p>
                  <Link href={`/clone/${jobId}`} className="text-alias-green text-sm font-mono underline">
                    ← Back to pipeline to run the audit
                  </Link>
                </div>
              )}

              {/* Action row */}
              <div className="flex gap-3">
                <button
                  onClick={() => setView('rebuilt')}
                  className="flex-1 py-3 border border-alias-green text-alias-green bg-alias-green-dim rounded-lg text-xs font-mono uppercase tracking-wider hover:bg-alias-green/20 transition-colors"
                >
                  ◈ View Rebuilt Site
                </button>
                <a
                  href={`/api/clone/download/${jobId}`}
                  className="px-6 py-3 border border-border text-muted-foreground bg-card rounded-lg text-xs font-mono uppercase tracking-wider hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  ↓ Download ZIP
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
