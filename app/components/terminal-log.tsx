'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StreamEvent } from '@/lib/types';
import { TokenPreview } from './token-preview';
import type { EditableColor } from './token-preview';
import { AeoScoreGrid } from './aeo-score-ring';
import { DesignTokens, EntityMap, AeoScore } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'extract' | 'analyze' | 'plan' | 'draft' | 'synthesize' | 'audit';
type MilestoneStatus = 'pending' | 'running' | 'done' | 'error';

interface Milestone {
  id: Phase;
  label: string;
  icon: string;
  status: MilestoneStatus;
  activeText: string;   // updates in-place while running
  completedText: string; // locked when done
  startedAt?: number;
  completedAt?: number;
}

interface Toast {
  id: number;
  icon: string;
  text: string;
  phase: string;
  exiting: boolean;
}

interface TerminalLogProps {
  jobId: string;
  onComplete?: (screenshotUrl?: string) => void;
}

// ── Milestone config ──────────────────────────────────────────────────────────

const MILESTONE_CONFIG: Record<Phase, { label: string; icon: string }> = {
  extract:    { label: 'Mining Site Architecture',    icon: '⬡' },
  analyze:    { label: 'Distilling Brand Identity',   icon: '◈' },
  plan:       { label: 'Blueprinting Site Structure', icon: '◫' },
  draft:      { label: 'Generating Content Strategy', icon: '◎' },
  synthesize: { label: 'Assembling Pages',            icon: '▣' },
  audit:      { label: 'Running AEO Audit',           icon: '◉' },
};


function makeMilestones(): Milestone[] {
  return (Object.keys(MILESTONE_CONFIG) as Phase[]).map(id => ({
    id,
    ...MILESTONE_CONFIG[id],
    status: 'pending',
    activeText: '',
    completedText: '',
  }));
}

// ── Message → milestone + active text classifier ──────────────────────────────

/** Map raw SSE event message text to a clean, user-facing active status string */
function classifyMessage(phase: string, message: string): string | null {
  const m = message.toLowerCase();
  // Extract
  if (m.includes('scraping') || m.includes('firecrawl'))    return 'Scraping target URL…';
  if (m.includes('screenshot'))                              return 'Capturing screenshot…';
  if (m.includes('font link'))                              return 'Detecting fonts…';
  if (m.includes('stylesheet'))                             return 'Reading stylesheets…';
  if (m.includes('pages discovered') || m.includes('firecrawl links')) return 'Mapping site structure…';
  // Plan
  if (m.includes('blueprint') || m.includes('site structure') || m.includes('site plan')) return 'Planning AEO site structure…';
  if (m.includes('sections') && m.includes('critical'))  return 'Optimising section priorities…';
  // Analyze
  if (m.includes('brand dna') || m.includes('60-30-10'))    return 'Distilling colour palette…';
  if (m.includes('gemini vision') || m.includes('screenshot to gemini')) return 'Reading visual design…';
  if (m.includes('h1') || m.includes('heading') || m.includes('hierarchy')) return 'Mapping semantic structure…';
  if (m.includes('entity') || m.includes('business name'))  return 'Building entity graph…';
  if (m.includes('font resolution') || m.includes('google font')) return 'Resolving typography…';
  if (m.includes('token') || m.includes('spacing') || m.includes('layout')) return 'Extracting design tokens…';
  // Draft
  if (m.includes('generating content') || m.includes('aeo content')) return 'Writing AEO content…';
  if (m.includes('schema') || m.includes('json-ld'))        return 'Generating structured data…';
  if (m.includes('processing homepage'))                    return 'Drafting homepage…';
  if (m.includes('page') && m.includes('/'))                return 'Drafting sub-pages…';
  // Synthesize
  if (m.includes('option a') || m.includes('layout css'))   return 'Generating layout from screenshot…';
  if (m.includes('building') || m.includes('html'))         return 'Assembling HTML…';
  if (m.includes('stylesheet') || m.includes('css'))        return 'Compiling CSS design system…';
  if (m.includes('sub-page') || m.includes('processing'))   return 'Building additional pages…';
  // Audit
  if (m.includes('crawler') || m.includes('crawl'))         return 'Running AI crawler simulation…';
  if (m.includes('score') || m.includes('audit'))           return 'Scoring AEO readiness…';

  return null; // don't update active text
}

/** Map a done/data event to a toast notification */
function extractToasts(phase: string, status: string, message: string, data?: unknown): Array<{ icon: string; text: string }> {
  const results: Array<{ icon: string; text: string }> = [];
  const m = message;

  // Extract phase completions
  if (phase === 'extract') {
    const titleMatch = m.match(/page title:\s*"([^"]+)"/i);
    if (titleMatch) results.push({ icon: '◈', text: `Site identified: ${titleMatch[1]}` });

    const fontMatch = m.match(/(\d+)\s*font/i);
    if (fontMatch) results.push({ icon: '◎', text: `${fontMatch[1]} font reference${+fontMatch[1] !== 1 ? 's' : ''} detected` });

    if (status === 'done' && data && typeof data === 'object') {
      const d = data as { screenshotUrl?: string; meta?: { title?: string } };
      if (d.screenshotUrl) results.push({ icon: '▣', text: 'Screenshot captured' });
    }
  }

  // Analyze phase completions
  if (phase === 'analyze') {
    const brandMatch = m.match(/Brand DNA.*?"([^"]+)"\s*\|\s*([^\|]+)\|/i);
    if (brandMatch) results.push({ icon: '◈', text: `Brand: ${brandMatch[1].trim()} · ${brandMatch[2].trim()}` });

    const paletteMatch = m.match(/Palette 60%:\s*(#\S+)/i);
    if (paletteMatch) results.push({ icon: '◉', text: `Dominant colour locked: ${paletteMatch[1]}` });

    const typeMatch = m.match(/Type:\s*([^\/]+)\s*\//i);
    if (typeMatch) results.push({ icon: '◎', text: `Typeface: ${typeMatch[1].trim()}` });

    if (status === 'done' && data && typeof data === 'object') {
      const d = data as { tokens?: DesignTokens; entityMap?: EntityMap };
      if (d.entityMap) results.push({ icon: '⬡', text: `${d.entityMap.entities?.length ?? 0} semantic entities indexed` });
    }
  }

  // Draft completions
  if (phase === 'draft') {
    const sectionMatch = m.match(/(\d+)\s*sections?/i);
    if (sectionMatch) results.push({ icon: '◎', text: `${sectionMatch[1]} content sections generated` });

    const pageMatch = m.match(/Page\s+(\d+)\/(\d+):\s*(.+)\s*\(/i);
    if (pageMatch) results.push({ icon: '▣', text: `Page built: ${pageMatch[3].trim()}` });
  }

  // Synthesize completions
  if (phase === 'synthesize' && status === 'done') {
    results.push({ icon: '▣', text: 'HTML output assembled' });
  }

  // System: page counts
  const pagesMatch = m.match(/(\d+)\s*page[s]?\s*(discovered|processed|total)/i);
  if (pagesMatch) results.push({ icon: '⬡', text: `${pagesMatch[1]} page${+pagesMatch[1] !== 1 ? 's' : ''} in site map` });

  // Audit score — data is now { score, originalScore }
  if (phase === 'audit' && status === 'done' && data && typeof data === 'object') {
    const d = data as { score?: AeoScore; overall?: number };
    const s = d.score ?? (d.overall !== undefined ? d as AeoScore : null);
    if (s?.overall !== undefined) results.push({ icon: '◉', text: `AEO Score: ${s.overall}/100` });
  }

  return results;
}

// ── Duration formatter ────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Milestone Row ─────────────────────────────────────────────────────────────

function MilestoneRow({ milestone, isActive }: { milestone: Milestone; isActive: boolean }) {
  const { status, label, icon, activeText, completedText, startedAt, completedAt } = milestone;

  const duration = completedAt && startedAt ? fmtDuration(completedAt - startedAt) : null;

  return (
    <div className={`flex items-start gap-3 py-3 transition-all duration-500 ${
      status === 'pending' ? 'opacity-30' : 'opacity-100'
    }`}>
      {/* Status icon */}
      <div className={`w-7 h-7 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-500 ${
        status === 'done'    ? 'bg-alias-green-dim border-alias-green/40 text-alias-green' :
        status === 'running' ? 'border-alias-green/50 text-alias-green' :
        status === 'error'   ? 'border-alias-red/40 text-alias-red' :
        'border-border/30 text-muted-foreground/30'
      }`}>
        {status === 'done'    && <span className="text-[12px]">✓</span>}
        {status === 'running' && <span className="text-[12px] animate-terminal-blink font-mono">◆</span>}
        {status === 'error'   && <span className="text-[12px]">✗</span>}
        {status === 'pending' && <span className="text-[12px] font-mono text-muted-foreground/20">{icon}</span>}
      </div>

      {/* Label + sub-text */}
      <div className="flex-1 min-w-0">
        <p className={`text-[16px] font-mono font-semibold uppercase tracking-[0.1em] leading-none transition-colors duration-300 ${
          status === 'done'    ? 'text-foreground/80' :
          status === 'running' ? 'text-foreground' :
          status === 'error'   ? 'text-alias-red' :
          'text-muted-foreground/30'
        }`}>
          {label}
        </p>

        {/* Active status line — updates in place */}
        {status === 'running' && activeText && (
          <p className="text-[12px] font-mono text-alias-green/70 mt-1.5 leading-none animate-fade-in-up">
            {activeText}
          </p>
        )}

        {/* Completed summary */}
        {status === 'done' && completedText && (
          <p className="text-[12px] font-mono text-muted-foreground/40 mt-1.5 leading-none">
            {completedText}
          </p>
        )}
      </div>

      {/* Duration badge */}
      {status === 'done' && duration && (
        <span className="text-[12px] font-mono text-muted-foreground/30 flex-shrink-0 mt-1">{duration}</span>
      )}

      {/* Pulse while active */}
      {status === 'running' && (
        <div className="flex-shrink-0 mt-2">
          <div className="w-2 h-2 rounded-full bg-alias-green animate-pulse" />
        </div>
      )}
    </div>
  );
}

// ── Toast component ───────────────────────────────────────────────────────────

function ToastItem({ toast }: { toast: Toast }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border border-alias-green/20 bg-alias-green/5 transition-all duration-400 ${
      toast.exiting ? 'opacity-0 translate-x-4 scale-95' : 'opacity-100 translate-x-0 scale-100'
    }`}
      style={{ transitionProperty: 'opacity, transform' }}>
      <span className="text-alias-green/60 text-[12px] flex-shrink-0">{toast.icon}</span>
      <p className="text-[12px] font-mono text-foreground/70 leading-tight">{toast.text}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TerminalLog({ jobId, onComplete }: TerminalLogProps) {
  const [milestones, setMilestones] = useState<Milestone[]>(makeMilestones);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tokens, setTokens] = useState<DesignTokens | null>(null);
  const [entityMap, setEntityMap] = useState<EntityMap | null>(null);
  const [score, setScore] = useState<AeoScore | null>(null);
  const [originalScore, setOriginalScore] = useState<AeoScore | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colorsSaveStatus, setColorsSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const startTime = useRef(Date.now());
  const esRef = useRef<EventSource | null>(null);
  const isDoneRef = useRef(false);
  const toastCounter = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const updateMilestone = useCallback((phase: Phase, updates: Partial<Milestone>) => {
    setMilestones(prev => prev.map(m => m.id === phase ? { ...m, ...updates } : m));
  }, []);

  const pushToast = useCallback((icon: string, text: string, phase: string) => {
    const id = toastCounter.current++;
    setToasts(prev => [...prev.slice(-4), { id, icon, text, phase, exiting: false }]);
    // Begin exit animation after 3.5s, remove after 4s
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 400);
    }, 3500);
  }, []);

  // ── Hydrate from server if job already done ──────────────────────────────────

  useEffect(() => {
    fetch(`/api/clone/status/${jobId}`)
      .then(r => {
        if (r.status === 404) {
          setError('Job not found — it may have expired after a server restart.');
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        if (data.url) setSourceUrl(data.url);

        // ── Already done: reconstruct milestone state from status data ─────────
        if (data.status === 'done' || data.status === 'error') {
          const phaseKeys: Phase[] = ['extract', 'analyze', 'draft', 'synthesize', 'audit'];
          setMilestones(prev => prev.map(m => {
            const ph = data.phases?.[m.id];
            if (!ph) return m;
            return {
              ...m,
              status: ph.status === 'done' ? 'done' : ph.status === 'error' ? 'error' : 'pending',
              completedText: ph.status === 'done' ? completedSummary(m.id, data) : '',
              startedAt: ph.startedAt,
              completedAt: ph.completedAt,
            };
          }));

          if (data.phases?.extract?.screenshotUrl) setScreenshotUrl(data.phases.extract.screenshotUrl);
          if (data.phases?.analyze?.tokens)    setTokens(data.phases.analyze.tokens);
          if (data.phases?.analyze?.entityMap) setEntityMap(data.phases.analyze.entityMap);
          if (data.phases?.audit?.score)       setScore(data.phases.audit.score);
          // Hydrate original (pre-rebuild) score from top-level status field
          if (data.originalScore)              setOriginalScore(data.originalScore as AeoScore);

          setIsDone(data.status === 'done');
          isDoneRef.current = data.status === 'done';
          return;
        }

        // ── Still running: open live SSE ───────────────────────────────────────
        if (data.status === 'running' || data.status === 'queued') {
          openStream();
        }
      })
      .catch(() => setError('Could not reach the server.'));

    return () => { esRef.current?.close(); };
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  function openStream() {
    const es = new EventSource(`/api/clone/stream/${jobId}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event: StreamEvent = JSON.parse(e.data);
        const phase = event.phase as Phase;

        // ── Update milestone status ──────────────────────────────────────────
        if (event.phase !== 'system') {
          if (event.status === 'running') {
            updateMilestone(phase, {
              status: 'running',
              activeText: classifyMessage(event.phase, event.message) ?? 'Processing…',
              startedAt: Date.now(),
            });
          } else if (event.status === 'done') {
            setMilestones(prev => prev.map(m => {
              if (m.id !== phase) return m;
              const now = Date.now();
              return {
                ...m,
                status: 'done',
                activeText: '',
                completedAt: now,
                completedText: completedSummaryFromEvent(phase, event),
              };
            }));
          } else if (event.status === 'error') {
            updateMilestone(phase, { status: 'error', activeText: event.message });
          } else if (event.status === 'log') {
            // Refine the active text in-place on sub-task logs
            const refined = classifyMessage(event.phase, event.message);
            if (refined) {
              updateMilestone(phase, { activeText: refined });
            }
          }
        }

        // ── Extract rich data ────────────────────────────────────────────────
        if (event.phase === 'extract' && event.status === 'done' && event.data) {
          const d = event.data as { screenshotUrl?: string };
          if (d.screenshotUrl) setScreenshotUrl(d.screenshotUrl);
        }
        if (event.phase === 'analyze' && event.status === 'done' && event.data) {
          const d = event.data as { tokens?: DesignTokens; entityMap?: EntityMap };
          if (d.tokens)    setTokens(d.tokens);
          if (d.entityMap) setEntityMap(d.entityMap);
        }
        if (event.phase === 'audit' && event.status === 'done' && event.data) {
          // data is { score, originalScore } — handle both old and new shape
          const d = event.data as { score?: AeoScore; originalScore?: AeoScore; overall?: number };
          const s = d.score ?? (d.overall !== undefined ? d as AeoScore : null);
          if (s) setScore(s);
          if (d.originalScore) setOriginalScore(d.originalScore);
        }

        // ── Generate toasts ──────────────────────────────────────────────────
        const newToasts = extractToasts(event.phase, event.status, event.message, event.data);
        newToasts.forEach(t => pushToast(t.icon, t.text, event.phase));

        // ── Pipeline done ────────────────────────────────────────────────────
        if (event.phase === 'system' && event.status === 'done') {
          isDoneRef.current = true;
          setIsDone(true);
          es.close();
          onComplete?.(screenshotUrl || undefined);
        }
        if (event.phase === 'system' && event.status === 'error') {
          setError(event.message);
          es.close();
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      setTimeout(async () => {
        if (!isDoneRef.current) {
          try {
            const r = await fetch(`/api/clone/status/${jobId}`);
            setError(r.status === 404
              ? 'Job not found — it may have expired after a server restart.'
              : 'Pipeline connection closed unexpectedly.');
          } catch {
            setError('Could not reach the server.');
          }
        }
        es.close();
      }, 300);
    };
  }

  // ── Color edit save handler ──────────────────────────────────────────────────

  const handleColorsChange = (editedColors: EditableColor[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setColorsSaveStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      try {
        const colorMap: Record<string, string> = {};
        for (const c of editedColors) colorMap[c.key] = c.hex;
        const res = await fetch(`/api/clone/patch-tokens/${jobId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ colors: colorMap }),
        });
        setColorsSaveStatus(res.ok ? 'saved' : 'error');
        setTimeout(() => setColorsSaveStatus('idle'), 2000);
      } catch {
        setColorsSaveStatus('error');
        setTimeout(() => setColorsSaveStatus('idle'), 2000);
      }
    }, 600);
  };


  // ─────────────────────────────────────────────────────────────────────────────

  const activeCount = milestones.filter(m => m.status === 'done').length;
  const totalDuration = isDone && startTime.current
    ? fmtDuration(Date.now() - startTime.current) : null;

  return (
    <div className="h-full flex flex-col gap-4">

      {/* ── Main panel ──────────────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 min-h-0">

        {/* Left: milestone engine panel */}
        <div className="bg-card border border-border rounded-lg flex flex-col min-h-0 overflow-hidden">

          {/* Chrome bar */}
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/50 flex-shrink-0">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
            </div>
            <div className="flex-1 flex items-center justify-between ml-3">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                  ALIAS
                </span>
                {sourceUrl ? (
                  <>
                    <span className="text-muted-foreground/30 font-mono text-[12px]">for</span>
                    <span className="text-[12px] font-mono text-foreground/70 truncate max-w-[280px]">
                      {sourceUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                    </span>
                  </>
                ) : (
                  <span className="text-[12px] font-mono text-muted-foreground/40 uppercase tracking-[0.2em]">compiler</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isDone && (
                  <span className="text-[12px] font-mono text-alias-green uppercase tracking-wider">
                    ● complete {totalDuration && `· ${totalDuration}`}
                  </span>
                )}
                {!isDone && !error && activeCount > 0 && (
                  <span className="text-[12px] font-mono text-alias-amber uppercase tracking-wider animate-pulse">
                    ● running
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Milestone list — compact when done+score, scrollable otherwise */}
          <div className={`px-6 py-5 ${isDone && score ? 'flex-shrink-0 border-b border-border/30' : 'flex-1 overflow-y-auto'}`}>

            {/* Progress bar — hide when complete */}
            {!isDone && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
                    Pipeline Progress
                  </p>
                  <p className="text-[12px] font-mono text-muted-foreground/40">
                    {activeCount}/{milestones.length}
                  </p>
                </div>
                <div className="h-0.5 bg-border/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-alias-green/60 transition-all duration-700 ease-out"
                    style={{ width: `${(activeCount / milestones.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Milestones */}
            <div className="space-y-0 divide-y divide-border/20">
              {milestones.map(milestone => (
                <MilestoneRow
                  key={milestone.id}
                  milestone={milestone}
                  isActive={milestone.status === 'running'}
                />
              ))}
            </div>

            {/* Error state */}
            {error && (
              <div className="mt-5 px-4 py-3 rounded-lg border border-alias-red/30 bg-alias-red/5">
                <p className="text-[12px] font-mono text-alias-red">{error}</p>
              </div>
            )}

            {/* Toast stack — during running, below milestones */}
            {toasts.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-[12px] font-mono uppercase tracking-[0.2em] text-muted-foreground/30 mb-2">
                  Discoveries
                </p>
                {toasts.map(t => <ToastItem key={t.id} toast={t} />)}
              </div>
            )}
          </div>

          {/* AEO Score — docked to bottom of left panel when done */}
          {isDone && (originalScore || score) && (
            <div className="flex-1 p-5 overflow-y-auto min-h-0 animate-fade-in-up">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[12px] font-mono uppercase tracking-[0.2em] text-muted-foreground">AEO Audit Score</p>
                {originalScore && (
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40 bg-border/20 px-2 py-0.5 rounded">
                    Original Site Baseline
                  </span>
                )}
              </div>
              <AeoScoreGrid
                overall={(originalScore ?? score!).overall}
                content_structure={(originalScore ?? score!).content_structure}
                eeat={(originalScore ?? score!).eeat}
                technical={(originalScore ?? score!).technical}
                entity_alignment={(originalScore ?? score!).entity_alignment}
              />
              {originalScore && score && (
                <div className="mt-4 pt-4 border-t border-border/30">
                  <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40 mb-2">Rebuilt Site Score</p>
                  <div className="flex items-center gap-3">
                    <span className="text-[28px] font-mono font-bold text-alias-green">{score.overall}</span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-mono text-alias-green/70">/ 100</span>
                      {score.overall > originalScore.overall && (
                        <span className="text-[11px] font-mono text-alias-green">
                          ↑ +{score.overall - originalScore.overall} pts
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: data panel */}
        <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">

          {/* Screenshot */}
          {screenshotUrl && (
            <div className="bg-card border border-border rounded-lg overflow-hidden flex-shrink-0">
              <div className="px-4 py-3 border-b border-border/50">
                <p className="text-[12px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Original Site</p>
              </div>
              <div className="relative overflow-hidden" style={{ aspectRatio: '16/10' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={screenshotUrl} alt="Original site screenshot"
                  className="w-full h-full object-cover object-left-top" />
                <div className="absolute inset-0 scanlines pointer-events-none" />
              </div>
            </div>
          )}

          {/* Token preview */}
          {tokens && entityMap && (
            <div className="bg-card border border-border rounded-lg p-5 flex-shrink-0 overflow-y-auto max-h-[600px]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[12px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Extracted Tokens</p>
                {colorsSaveStatus !== 'idle' && (
                  <span className={`text-[12px] font-mono transition-colors ${
                    colorsSaveStatus === 'saving' ? 'text-alias-amber animate-pulse' :
                    colorsSaveStatus === 'saved'  ? 'text-alias-green' :
                    'text-alias-red'
                  }`}>
                    {colorsSaveStatus === 'saving' ? '● saving…' : colorsSaveStatus === 'saved' ? '✓ saved' : '✗ error'}
                  </span>
                )}
              </div>
              <TokenPreview tokens={tokens} entityMap={entityMap} onColorsChange={handleColorsChange} />
            </div>
          )}

          {/* AEO Score — right column only during running (before done) */}
          {!isDone && (originalScore || score) && (
            <div className="bg-card border border-border rounded-lg p-5 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[12px] font-mono uppercase tracking-[0.2em] text-muted-foreground">AEO Audit Score</p>
                {originalScore && (
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40 bg-border/20 px-2 py-0.5 rounded">
                    Original Baseline
                  </span>
                )}
              </div>
              <AeoScoreGrid
                overall={(originalScore ?? score!).overall}
                content_structure={(originalScore ?? score!).content_structure}
                eeat={(originalScore ?? score!).eeat}
                technical={(originalScore ?? score!).technical}
                entity_alignment={(originalScore ?? score!).entity_alignment}
              />
            </div>
          )}
        </div>
      </div>


      {/* Action buttons — shown when done */}
      {isDone && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 flex-shrink-0 animate-fade-in-up">
          {/* Left col: Preview — same width as pipeline panel */}
          <a href={`/preview/${jobId}`}
            className="flex items-center justify-center gap-2 py-3.5 border border-alias-green text-alias-green bg-alias-green-dim rounded-lg text-[14px] font-mono uppercase tracking-wider hover:bg-alias-green/20 transition-colors">
            <span>◈</span> Preview Rebuilt Site
          </a>
          {/* Right col: View Code + Download ZIP — same total width as right data panel */}
          <div className="flex gap-3">
            <a href={`/code/${jobId}`}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 border border-border text-muted-foreground bg-card rounded-lg text-[14px] font-mono uppercase tracking-wider hover:text-foreground hover:border-foreground/30 transition-colors">
              {'</>'} View Code
            </a>
            <a href={`/api/clone/download/${jobId}`}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 border border-border text-muted-foreground bg-card rounded-lg text-[14px] font-mono uppercase tracking-wider hover:text-foreground hover:border-foreground/30 transition-colors">
              ↓ Download ZIP
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Completed text generators ─────────────────────────────────────────────────

type StatusData = {
  phases?: {
    extract?:    Record<string, unknown>;
    analyze?:    Record<string, unknown>;
    audit?:      Record<string, unknown>;
    [key: string]: Record<string, unknown> | undefined;
  };
  pages?: unknown[];
  [key: string]: unknown;
};

function completedSummary(phase: Phase, data: StatusData): string {
  switch (phase) {
    case 'extract': {
      const pageCount = data.pages?.length ?? 1;
      return `${pageCount} page${pageCount !== 1 ? 's' : ''} discovered`;
    }
    case 'analyze': {
      const em = data.phases?.analyze?.entityMap as EntityMap | undefined;
      return em?.businessName ? `${em.businessName} · ${em.industry}` : 'Brand identity locked';
    }
    case 'draft':      return 'Content & Schema.org generated';
    case 'synthesize': return 'Semantic HTML assembled';
    case 'audit': {
      const s = data.phases?.audit?.score as AeoScore | undefined;
      return s ? `AEO Score: ${s.overall}/100` : 'Audit complete';
    }
    default: return 'Complete';
  }
}


function completedSummaryFromEvent(phase: Phase, event: StreamEvent): string {
  if (phase === 'extract') return 'Site architecture mapped';
  if (phase === 'analyze') return 'Brand identity distilled';
  if (phase === 'draft')   return 'Content strategy generated';
  if (phase === 'synthesize') return 'Pages assembled';
  if (phase === 'audit' && event.data) {
    const d = event.data as AeoScore;
    return d.overall !== undefined ? `AEO Score: ${d.overall}/100` : 'Audit complete';
  }
  return 'Complete';
}
