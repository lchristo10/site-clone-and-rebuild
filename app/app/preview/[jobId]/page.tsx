'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AeoScoreGrid } from '@/components/aeo-score-ring';
import { StrategistPanel } from '@/components/strategist-panel';
import { FeedbackBar } from '@/components/feedback-bar';
import { SiteStructureTab } from '@/components/site-structure-tab';
import { StrategistReport, SitePlan } from '@/lib/types';

type Props = { params: Promise<{ jobId: string }> };

interface PageSummary {
  slug: string;
  title: string;
  url: string;
  status: 'pending' | 'running' | 'done' | 'error';
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

// ── No-plan empty state with on-demand generation ─────────────────────────────

function NoPlanState({ jobId, onGenerated }: { jobId: string; onGenerated: (plan: SitePlan) => void }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError]   = useState('');

  const generate = async () => {
    setStatus('loading');
    setError('');
    try {
      const res = await fetch(`/api/clone/plan/generate/${jobId}`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Generation failed');
      }
      const d = await res.json() as { sitePlan: SitePlan };
      onGenerated(d.sitePlan);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-2xl font-mono text-muted-foreground/20">◫</div>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
          No site structure plan
        </p>
        <p className="text-[9px] font-mono text-muted-foreground/30 leading-relaxed">
          This job was built before AEO site planning was introduced.
          Generate a plan now using your existing pages — no rebuild required.
        </p>
        {status === 'error' && (
          <p className="text-[9px] font-mono text-alias-red">✗ {error}</p>
        )}
        <button
          onClick={generate}
          disabled={status === 'loading'}
          className="px-5 py-2.5 text-[9px] font-mono uppercase tracking-[0.2em] rounded-lg border border-alias-green text-alias-green bg-alias-green/5 hover:bg-alias-green/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {status === 'loading'
            ? <><span className="inline-block animate-spin mr-1">⟳</span> Generating blueprint…</>
            : '◫ Generate Site Plan'}
        </button>
      </div>
    </div>
  );
}

export default function PreviewPage({ params }: Props) {
  const { jobId } = use(params);
  const [view, setView] = useState<'rebuilt' | 'score' | 'structure'>('rebuilt');
  const [score, setScore] = useState<AeoScore | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [previewReady, setPreviewReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [activePage, setActivePage] = useState('home');

  // ── Refine panel state ────────────────────────────────────────────────────
  const [refineOpen, setRefineOpen]               = useState(false);
  const [refineSection, setRefineSection]         = useState('');
  const [refineInstruction, setRefineInstruction] = useState('');
  const [refineStatus, setRefineStatus]           = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [refineError, setRefineError]             = useState('');
  const [previewKey, setPreviewKey]               = useState(0);

  // ── AI Strategist drawer state ────────────────────────────────────────────
  const [strategistOpen, setStrategistOpen]       = useState(false);
  const [strategistReport, setStrategistReport]   = useState<StrategistReport | null>(null);
  const [strategistLoading, setStrategistLoading] = useState(false);

  // ── Site structure / tactical grid state ───────────────────────────────────
  const [sitePlan, setSitePlan]                   = useState<SitePlan | null>(null);

  const previewSrc = `/api/clone/preview/${jobId}?page=${activePage}&t=${previewKey}`;

  const activeSections = pages.find(p => p.slug === activePage)?.sectionTypes ?? [];

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);
  // Listen for navigation postMessages sent by cross-page nav links inside the iframe
  useEffect(() => {
    const handleIframeNav = (e: MessageEvent) => {
      if (e.data?.type === 'alias-navigate' && typeof e.data.slug === 'string') {
        setActivePage(e.data.slug);
      }
    };
    window.addEventListener('message', handleIframeNav);
    return () => window.removeEventListener('message', handleIframeNav);
  }, []);

  useEffect(() => {
    const loadJobData = async () => {
      try {
        const statusRes = await fetch(`/api/clone/status/${jobId}`);
        if (statusRes.ok) {
          const data = await statusRes.json();
          if (data.url) setOriginalUrl(data.url);
          if (data.pages?.length > 0) {
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
          if (data.strategistReport) setStrategistReport(data.strategistReport);
          if (data.sitePlan) setSitePlan(data.sitePlan);
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

  // ── Refine handler ────────────────────────────────────────────────────────
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
      setPreviewKey(k => k + 1);
      setTimeout(() => setRefineStatus('idle'), 3000);
    } catch (err) {
      setRefineStatus('error');
      setRefineError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [jobId, activePage, refineSection, refineInstruction]);

  // ── AI Strategist analyse handler ─────────────────────────────────────────
  const handleAnalyse = useCallback(async () => {
    setStrategistLoading(true);
    try {
      const res = await fetch(`/api/clone/analyse/${jobId}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json() as { report: StrategistReport };
        setStrategistReport(data.report);
      }
    } finally {
      setStrategistLoading(false);
    }
  }, [jobId]);

  // When the strategist marks a rec as applied, refresh the iframe
  const handleApplied = useCallback(() => {
    setPreviewKey(k => k + 1);
    // Briefly close the drawer so the user can see the updated preview
    setStrategistOpen(false);
    // Re-open after a short delay so they can continue reviewing
    // (user can also reopen manually via the nav button)
  }, []);

  // When the structure grid rebuilds / deletes a page, keep the preview nav in sync
  const handlePageRebuilt = useCallback(async (rebuiltSlug: string) => {
    setPreviewKey(k => k + 1);
    // If the user deleted the active page, switch back to home
    if (rebuiltSlug === activePage) setActivePage('home');
    // Re-fetch page list so the nav reflects the new state
    try {
      const statusRes = await fetch(`/api/clone/status/${jobId}`);
      if (statusRes.ok) {
        const data = await statusRes.json();
        if (data.pages?.length > 0) {
          const mapped = data.pages.map((p: PageSummary & { aeoContent?: { sections: { type: string }[] } }) => ({
            ...p,
            sectionTypes: p.aeoContent?.sections.map((s: { type: string }) => s.type) ?? [],
          }));
          setPages(mapped);
        }
        if (data.sitePlan) setSitePlan(data.sitePlan);
      }
    } catch { /* ignore */ }
  }, [jobId, activePage]);

  const handleReportUpdate = useCallback((report: StrategistReport) => {
    setStrategistReport(report);
  }, []);

  const donePagesCount = pages.filter(p => p.status === 'done').length;

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* ── Top Nav ── */}
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
            onClick={() => setView('structure')}
            className={`px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider rounded transition-all ${
              view === 'structure'
                ? 'bg-alias-green text-background font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            ◫ Structure
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
          {/* AI Strategist toggle */}
          <button
            onClick={() => setStrategistOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[9px] font-mono uppercase tracking-wider rounded border transition-all ${
              strategistOpen
                ? 'border-alias-green bg-alias-green/10 text-alias-green'
                : strategistReport
                ? 'border-alias-green/40 text-alias-green/70 hover:border-alias-green hover:text-alias-green'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
            }`}
          >
            <span className={strategistLoading ? 'animate-pulse' : ''}>◉</span>
            {strategistLoading ? 'Analysing…' : 'AI Strategist'}
            {strategistReport && !strategistLoading && (
              <span className="w-1.5 h-1.5 rounded-full bg-alias-green ml-0.5" />
            )}
          </button>

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

      {/* ── Content ── */}
      <div className="flex-1 pt-[49px] flex flex-col relative">
        {view === 'rebuilt' ? (
          <div className="flex-1 flex flex-col">
            {previewReady ? (
              <>
                {/* Status bar — navigation is handled by the in-page nav inside the iframe */}
                <div className="px-4 py-1.5 border-b border-border/30 bg-card/50 flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-alias-green" />
                    <span className="text-[9px] font-mono text-alias-green uppercase tracking-wider">AEO-Optimised</span>
                  </div>

                  {pages.length > 1 && (
                    <span className="text-[9px] font-mono text-muted-foreground/40">
                      {donePagesCount}/{pages.length} pages
                    </span>
                  )}

                  {originalUrl && (
                    <span className="text-[9px] font-mono text-muted-foreground/50 truncate ml-auto">
                      rebuilt from: {originalUrl}
                    </span>
                  )}
                </div>

                <iframe
                  key={`${previewSrc}-${previewKey}`}
                  src={previewSrc}
                  className="flex-1 w-full border-0"
                  title="Rebuilt AEO-optimised site preview"
                  sandbox="allow-same-origin allow-scripts allow-popups"
                />

                {/* ── Floating Feedback Bar ─────────────────────────── */}
                <FeedbackBar
                  jobId={jobId}
                  activePage={activePage}
                  activeSections={activeSections}
                  onApplied={() => setPreviewKey(k => k + 1)}
                />

                {/* ── Refine Panel ─────────────────────────────────────── */}
                <div className={`border-t border-border/30 bg-card/80 backdrop-blur-sm transition-all duration-300 ${
                  refineOpen ? 'max-h-72' : 'max-h-10'
                } overflow-hidden flex-shrink-0`}>

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

                  <div className="px-4 pb-4 space-y-3">
                    <div className="flex items-start gap-3">
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

                    {refineStatus === 'error' && (
                      <p className="text-[9px] font-mono text-alias-red">✗ {refineError}</p>
                    )}
                    {refineStatus === 'success' && (
                      <p className="text-[9px] font-mono text-alias-green">✓ Section refined — preview updated</p>
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
        ) : view === 'structure' ? (
          // ── Site Structure / Tactical Grid view ────────────────────────────────
          sitePlan ? (
            <SiteStructureTab
              jobId={jobId}
              sitePlan={sitePlan}
              onPlanChange={setSitePlan}
              onPageRebuilt={handlePageRebuilt}
            />
          ) : (
            <NoPlanState jobId={jobId} onGenerated={setSitePlan} />

          )
        ) : (
          // ── AEO Report view ────────────────────────────────────────────────────
          <div className="flex-1 overflow-y-auto px-6 pb-12">
            <div className="max-w-4xl mx-auto py-8 space-y-6">

              {/* Header */}
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-alias-green" />
                  <h1 className="text-sm font-mono uppercase tracking-[0.2em] text-foreground">AEO Audit Report</h1>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded border border-alias-green/40 text-alias-green bg-alias-green/5 uppercase tracking-wider">
                    Rebuilt Site
                  </span>
                </div>
                {originalUrl && (
                  <p className="text-[10px] font-mono text-muted-foreground/50 ml-5">
                    Source: <span className="text-muted-foreground/70">{originalUrl}</span>
                    {' '}→{' '}
                    <span className="text-alias-green">rebuilt &amp; AEO-optimised</span>
                  </p>
                )}
                <p className="text-[10px] font-mono text-muted-foreground/40 ml-5">
                  Scores reflect the <strong className="text-muted-foreground/60">rebuilt</strong> site, not the original.
                  Original site scores are shown in the AI Strategist panel.
                </p>
              </div>

              {score ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-start">
                    <div className="bg-card border border-border rounded-lg p-6">
                      <AeoScoreGrid
                        overall={score.overall}
                        content_structure={score.content_structure}
                        eeat={score.eeat}
                        technical={score.technical}
                        entity_alignment={score.entity_alignment}
                        layout="vertical"
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="bg-card border border-alias-green/30 rounded-lg p-4">
                        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">AI Summarisability Test</p>
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`text-[10px] font-mono ${score.canSummarizeIn2Sentences ? 'text-alias-green' : 'text-alias-red'}`}>
                            {score.canSummarizeIn2Sentences
                              ? '✓ AI can summarise this site in 2 sentences'
                              : '✗ AI struggles to summarise — structure needs work'}
                          </span>
                        </div>
                        {aiSummary && (
                          <blockquote className="border-l-2 border-alias-green/40 pl-3 text-sm text-foreground/80 italic leading-relaxed">
                            &ldquo;{aiSummary}&rdquo;
                          </blockquote>
                        )}
                      </div>

                      <div className="space-y-2">
                        {[
                          { key: 'content_structure', label: 'Content Structure', score: score.content_structure, weight: '30%', tip: 'Inverted pyramid, answer capsules, list formatting, question-driven headings' },
                          { key: 'eeat',              label: 'E-E-A-T',           score: score.eeat,              weight: '30%', tip: 'Authorship, original data, external citations, trust signals' },
                          { key: 'technical',         label: 'Technical AEO',     score: score.technical,         weight: '20%', tip: 'Schema.org JSON-LD, semantic HTML5, heading hierarchy, raw HTML accessibility' },
                          { key: 'entity_alignment',  label: 'Entity Alignment',  score: score.entity_alignment,  weight: '20%', tip: 'Entity salience in H1/early body, topic clustering, consistent terminology' },
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
                            <div className="w-full h-1 bg-border/30 rounded-full overflow-hidden mb-2">
                              <div
                                className="h-full rounded-full transition-all duration-1000"
                                style={{
                                  width: `${cat.score}%`,
                                  background: cat.score >= 70 ? 'oklch(0.72 0.2 145)' : cat.score >= 40 ? 'oklch(0.78 0.18 75)' : 'oklch(0.62 0.22 25)',
                                }}
                              />
                            </div>
                            <p className="text-[9px] font-mono text-muted-foreground/40">{cat.tip}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {pages.length > 0 && (
                    <div className="bg-card border border-border rounded-lg p-6">
                      <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">Pages Rebuilt</p>
                      <div className="flex flex-wrap gap-2">
                        {pages.map(p => (
                          <span
                            key={p.slug}
                            className={`px-2.5 py-1 text-[9px] font-mono rounded border ${
                              p.status === 'done'  ? 'border-alias-green/40 text-alias-green bg-alias-green/5' :
                              p.status === 'error' ? 'border-alias-red/40 text-alias-red bg-alias-red/5' :
                              'border-border text-muted-foreground'
                            }`}
                          >
                            {p.status === 'done' ? '✓' : p.status === 'error' ? '✗' : '○'} {p.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {score.missingPageSuggestions && score.missingPageSuggestions.length > 0 && (
                    <div className="bg-card border border-alias-amber/40 rounded-lg p-6 space-y-4">
                      <div>
                        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-alias-amber mb-1">
                          ⚠ Missing Pages — AEO Completeness Gap
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground/50">
                          These pages are absent from the rebuilt site. Click <strong className="text-alias-amber/70">&ldquo;Add teaser&rdquo;</strong> to generate
                          a section linking to where that page would live.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {score.missingPageSuggestions.map((page, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded border border-alias-amber/20 bg-alias-amber/5">
                            <div className="flex items-center gap-2">
                              <span className="text-alias-amber/60 text-[10px]">+</span>
                              <span className="text-[10px] font-mono text-foreground/80">{page}</span>
                            </div>
                            <button
                              onClick={() => {
                                setRefineSection('cta');
                                setRefineInstruction(`Add a prominent link and teaser section for a new "${page}" — include a short description of what it covers, why it matters for visitors, and a clear call-to-action button linking to where that page would live.`);
                                setRefineOpen(true);
                                setView('rebuilt');
                              }}
                              className="text-[8px] font-mono uppercase tracking-wider px-2 py-1 rounded border border-alias-amber/30 text-alias-amber hover:bg-alias-amber/10 transition-colors flex-shrink-0"
                            >
                              → Add teaser
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {recommendations.length > 0 && (
                    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                      <div>
                        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1">
                          Top Improvement Recommendations
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground/50">
                          Click <strong className="text-foreground/60">&ldquo;Apply&rdquo;</strong> to open the Refine panel pre-filled with this instruction.
                        </p>
                      </div>
                      <ol className="space-y-3">
                        {recommendations.map((rec, i) => {
                          const lower = rec.toLowerCase();
                          const section =
                            lower.includes('hero') || lower.includes('h1') || lower.includes('headline') ? 'hero' :
                            lower.includes('about') || lower.includes('team') || lower.includes('author') ? 'about' :
                            lower.includes('faq') || lower.includes('question') ? 'faq' :
                            lower.includes('testimonial') || lower.includes('review') || lower.includes('trust') ? 'testimonials' :
                            lower.includes('service') || lower.includes('feature') ? 'services' :
                            lower.includes('cta') || lower.includes('contact') || lower.includes('book') ? 'cta' : 'hero';
                          return (
                            <li key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
                              <span className="text-[9px] font-mono text-alias-green bg-alias-green-dim px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <p className="text-sm text-foreground/80 leading-relaxed flex-1">{rec}</p>
                              <button
                                onClick={() => {
                                  setRefineSection(section);
                                  setRefineInstruction(rec);
                                  setRefineOpen(true);
                                  setView('rebuilt');
                                }}
                                className="text-[8px] font-mono uppercase tracking-wider px-2 py-1 rounded border border-alias-green/30 text-alias-green hover:bg-alias-green/10 transition-colors flex-shrink-0 mt-0.5 whitespace-nowrap"
                              >
                                → Apply
                              </button>
                            </li>
                          );
                        })}
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

              <div className="flex gap-3">
                <button
                  onClick={() => setView('rebuilt')}
                  className="flex-1 py-3 border border-alias-green text-alias-green bg-alias-green-dim rounded-lg text-xs font-mono uppercase tracking-wider hover:bg-alias-green/20 transition-colors"
                >
                  ◈ View Rebuilt Site
                </button>
                <button
                  onClick={() => { setStrategistOpen(true); setView('rebuilt'); }}
                  className="px-6 py-3 border border-alias-green/40 text-alias-green/70 bg-card rounded-lg text-xs font-mono uppercase tracking-wider hover:border-alias-green hover:text-alias-green transition-colors"
                >
                  ◉ AI Strategist
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

        {/* ── AI Strategist Slide-out Drawer ───────────────────────────────────── */}
        {/* Backdrop */}
        {strategistOpen && (
          <div
            className="fixed inset-0 z-40 bg-background/30 backdrop-blur-[2px]"
            onClick={() => setStrategistOpen(false)}
          />
        )}

        {/* Drawer */}
        <div className={`fixed top-[49px] right-0 bottom-0 z-50 w-[420px] max-w-[92vw] flex flex-col
          bg-background border-l border-border/50 shadow-2xl
          transition-transform duration-300 ease-in-out
          ${strategistOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">AI Strategist</span>
              {strategistReport && (
                <span className="text-[8px] font-mono text-muted-foreground/40">
                  — {strategistReport.recommendations.filter(r => r.status === 'applied').length}/{strategistReport.recommendations.length} applied
                </span>
              )}
            </div>
            <button
              onClick={() => setStrategistOpen(false)}
              className="text-[10px] font-mono text-muted-foreground/40 hover:text-foreground transition-colors px-2 py-1"
            >
              ✕ Close
            </button>
          </div>

          {/* Drawer body — StrategistPanel fills remaining height */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <StrategistPanel
              jobId={jobId}
              pageSlug={activePage}
              report={strategistReport}
              isLoading={strategistLoading}
              onTrigger={handleAnalyse}
              onReportUpdate={handleReportUpdate}
              onApplied={handleApplied}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
