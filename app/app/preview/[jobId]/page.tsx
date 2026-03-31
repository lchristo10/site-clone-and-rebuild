'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AeoScoreGrid } from '@/components/aeo-score-ring';

type Props = { params: Promise<{ jobId: string }> };

interface AeoScore {
  overall: number;
  content_structure: number;
  eeat: number;
  technical: number;
  entity_alignment: number;
  aiSummary: string;
  recommendations: string[];
  canSummarizeIn2Sentences: boolean;
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

  const previewSrc = `/api/clone/preview/${jobId}`;

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  useEffect(() => {
    const loadJobData = async () => {
      try {
        // Load status (score, url, etc.)
        const statusRes = await fetch(`/api/clone/status/${jobId}`);
        if (statusRes.ok) {
          const data = await statusRes.json();
          if (data.url) setOriginalUrl(data.url);
          if (data.phases?.audit?.score) {
            const s = data.phases.audit.score;
            setScore(s);
            setRecommendations(s.recommendations || []);
            setAiSummary(s.aiSummary || '');
          }
        }

        // Check if preview HTML is ready
        const previewRes = await fetch(`/api/clone/preview/${jobId}`, { method: 'HEAD' });
        if (previewRes.ok) setPreviewReady(true);
      } catch { /* ignore */ }

      // Also check localStorage for URL
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

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
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
              title="Open rebuilt site in full window"
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
                <div className="px-4 py-2 border-b border-border/30 bg-card/50 flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-alias-green" />
                    <span className="text-[9px] font-mono text-alias-green uppercase tracking-wider">AEO-Optimised</span>
                  </div>
                  {originalUrl && (
                    <span className="text-[9px] font-mono text-muted-foreground/50 truncate">
                      rebuilt from: {originalUrl}
                    </span>
                  )}
                </div>
                <iframe
                  src={previewSrc}
                  className="flex-1 w-full border-0"
                  title="Rebuilt AEO-optimised site preview"
                  sandbox="allow-same-origin allow-popups"
                />
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
                        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">
                          AI Summary Test
                        </p>
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
                  <p className="text-sm font-mono text-muted-foreground">
                    AEO score not available yet.
                  </p>
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
