'use client';
import { useState, useCallback } from 'react';
import { StrategistReport, StrategistRecommendation, AeoScore } from '@/lib/types';

// ── Score delta badge ─────────────────────────────────────────────────────────

function ScoreDelta({ before, after, label }: { before: number; after: number; label: string }) {
  const delta = after - before;
  const color = delta >= 10 ? 'text-alias-green' : delta >= 0 ? 'text-alias-amber' : 'text-alias-red';
  const sign = delta >= 0 ? '+' : '';
  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">{label}</p>
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-mono text-muted-foreground/40">{before}</span>
        <span className="text-[10px] text-muted-foreground/25">→</span>
        <span className="text-[14px] font-mono font-semibold text-foreground">{after}</span>
        <span className={`text-[10px] font-mono font-bold ${color}`}>({sign}{delta})</span>
      </div>
    </div>
  );
}

function BeforeAfterBar({ before, after }: { before: AeoScore; after: AeoScore }) {
  return (
    <div className="grid grid-cols-5 gap-2 py-3 px-4 bg-muted/30 rounded-lg border border-border/40">
      <ScoreDelta before={before.overall} after={after.overall} label="Overall" />
      <ScoreDelta before={before.content_structure} after={after.content_structure} label="Content" />
      <ScoreDelta before={before.eeat} after={after.eeat} label="E-E-A-T" />
      <ScoreDelta before={before.technical} after={after.technical} label="Technical" />
      <ScoreDelta before={before.entity_alignment} after={after.entity_alignment} label="Entity" />
    </div>
  );
}

// ── Recommendation card ───────────────────────────────────────────────────────

interface RecCardProps {
  rec: StrategistRecommendation;
  jobId: string;
  pageSlug: string;
  onUpdate: (id: string, status: string, comment?: string) => void;
  onApply: (rec: StrategistRecommendation, comment: string) => void;
  applying: boolean;
  applyResult: 'idle' | 'success' | 'error';
  applyError?: string;
}

function RecCard({ rec, onUpdate, onApply, applying, applyResult, applyError }: RecCardProps) {
  const [comment, setComment] = useState('');
  const [expanded, setExpanded] = useState(false);

  const priorityColor = rec.priority === 'high'
    ? 'text-alias-red border-alias-red/30 bg-alias-red/5'
    : rec.priority === 'medium'
    ? 'text-alias-amber border-alias-amber/30 bg-alias-amber/5'
    : 'text-muted-foreground border-border/40 bg-muted/20';

  const isSettled = rec.status === 'rejected';
  const isApplied = rec.status === 'applied';

  return (
    <div className={`rounded-lg border transition-all duration-300 ${
      isSettled ? 'opacity-40 border-border/30' :
      isApplied ? 'border-alias-green/40 bg-alias-green/5' :
      applying  ? 'border-alias-amber/40 bg-alias-amber/5 animate-pulse' :
      'border-border/50 bg-card'
    }`}>
      {/* Header */}
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
        onClick={() => !applying && setExpanded(e => !e)}
        disabled={applying}
      >
        <span className={`text-[10px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 ${priorityColor}`}>
          {rec.priority}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-[14px] font-mono font-semibold leading-snug ${
            isApplied ? 'text-alias-green line-through opacity-60' :
            applying  ? 'text-alias-amber' :
            isSettled ? 'text-muted-foreground' : 'text-foreground'
          }`}>
            {rec.title}
          </p>
          <p className="text-[10px] font-mono text-muted-foreground/50 mt-0.5 capitalize">{rec.sectionType} section</p>
        </div>
        {/* Expected score gain badge */}
        {rec.expectedScoreGain !== undefined && rec.expectedScoreGain > 0 && !isApplied && !isSettled && (
          <span
            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 ${
              rec.expectedScoreGain >= 4
                ? 'text-alias-green border-alias-green/30 bg-alias-green/5'
                : 'text-alias-amber border-alias-amber/30 bg-alias-amber/5'
            }`}
            title={`Applying this adds ~${rec.expectedScoreGain} AEO points`}
          >
            +{rec.expectedScoreGain} pts
          </span>
        )}
        <span className="text-[10px] flex-shrink-0 mt-0.5">
          {applying   ? <span className="animate-spin inline-block">⟳</span> :
           isApplied  ? '✓' :
           isSettled  ? '✗' :
           expanded   ? '▴' : '▾'}
        </span>
      </button>

      {/* Applying state — inline progress */}
      {applying && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded border border-alias-amber/20 bg-alias-amber/5">
            <span className="w-1.5 h-1.5 rounded-full bg-alias-amber animate-pulse flex-shrink-0" />
            <p className="text-[10px] font-mono text-alias-amber/80">
              Refining <span className="font-semibold capitalize">{rec.sectionType}</span> section — this takes ~10s…
            </p>
          </div>
        </div>
      )}

      {/* Apply result feedback */}
      {!applying && applyResult === 'success' && isApplied && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded border border-alias-green/30 bg-alias-green/5">
            <span className="text-alias-green text-[10px]">✓</span>
            <p className="text-[10px] font-mono text-alias-green/80">
              Applied — preview has been updated
            </p>
          </div>
        </div>
      )}

      {!applying && applyResult === 'error' && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded border border-alias-red/30 bg-alias-red/5">
            <span className="text-alias-red text-[10px]">✗</span>
            <p className="text-[10px] font-mono text-alias-red/80">
              {applyError ?? 'Apply failed — section type may not exist on this page'}
            </p>
          </div>
        </div>
      )}

      {/* Expanded body */}
      {expanded && !applying && !isApplied && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[10px] font-mono text-foreground/70 leading-relaxed">{rec.rationale}</p>

          {/* Expected AEO score impact */}
          {rec.expectedScoreGain !== undefined && (
            <div className="flex items-center gap-3 px-3 py-2 rounded border border-border/30 bg-muted/10">
              <div className="flex-shrink-0">
                <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40 mb-1">
                  Expected AEO impact
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-[20px] font-mono font-bold tabular-nums leading-none ${
                    rec.expectedScoreGain >= 4 ? 'text-alias-green' :
                    rec.expectedScoreGain >= 1 ? 'text-alias-amber' :
                    'text-muted-foreground/40'
                  }`}>
                    {rec.expectedScoreGain > 0 ? `+${rec.expectedScoreGain}` : '—'}
                  </span>
                  {rec.expectedScoreGain > 0 && (
                    <span className="text-[9px] font-mono text-muted-foreground/40">pts</span>
                  )}
                </div>
              </div>
              {/* Mini bar */}
              {rec.expectedScoreGain > 0 && (
                <div className="flex-1 h-1.5 bg-border/20 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min((rec.expectedScoreGain / 10) * 100, 100)}%`,
                      background: rec.expectedScoreGain >= 4
                        ? 'oklch(0.72 0.2 145)'
                        : 'oklch(0.78 0.18 75)',
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="px-3 py-2 rounded border border-border/30 bg-muted/20">
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50 mb-1">Suggested action</p>
            <p className="text-[10px] font-mono text-foreground/60 leading-relaxed">{rec.suggestedAction}</p>
          </div>

          {!isSettled && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40 mb-1">
                Additional direction (optional)
              </p>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="e.g. focus on bookings, use a warmer tone…"
                rows={2}
                className="w-full text-[10px] font-mono bg-input border border-border/40 rounded px-2.5 py-2 text-foreground resize-none placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-alias-green/30"
              />
            </div>
          )}

          {!isSettled && (
            <div className="flex gap-2">
              <button
                onClick={() => { onApply(rec, comment); setExpanded(false); }}
                className="flex-1 py-1.5 text-[10px] font-mono uppercase tracking-[0.15em] rounded border border-alias-green text-alias-green bg-alias-green/5 hover:bg-alias-green/15 transition-colors"
              >
                ◈ Apply to site
              </button>
              <button
                onClick={() => onUpdate(rec.id, 'rejected')}
                className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.15em] rounded border border-border/40 text-muted-foreground/50 hover:text-alias-red hover:border-alias-red/30 transition-colors"
              >
                ✗ Dismiss
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface StrategistPanelProps {
  jobId: string;
  /** The currently active page slug — used to target refine calls correctly */
  pageSlug?: string;
  report: StrategistReport | null;
  isLoading: boolean;
  onTrigger: () => void;
  onReportUpdate: (report: StrategistReport) => void;
  /** Called after a successful Apply so the parent can refresh the preview */
  onApplied?: () => void;
}

export function StrategistPanel({
  jobId,
  pageSlug = 'home',
  report,
  isLoading,
  onTrigger,
  onReportUpdate,
  onApplied,
}: StrategistPanelProps) {
  // Per-recommendation apply state: id → 'idle'|'loading'|'success'|'error'
  const [applyStates, setApplyStates] = useState<Record<string, { status: 'idle'|'loading'|'success'|'error'; error?: string }>>({});

  const handleUpdate = useCallback(async (id: string, status: string, comment?: string) => {
    const res = await fetch(`/api/clone/analyse/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: [{ id, status, userComment: comment }] }),
    });
    if (res.ok) {
      const data = await res.json() as { report: StrategistReport };
      onReportUpdate(data.report);
    }
  }, [jobId, onReportUpdate]);

  const handleApply = useCallback(async (rec: StrategistRecommendation, comment: string) => {
    setApplyStates(prev => ({ ...prev, [rec.id]: { status: 'loading' } }));

    try {
      // 1. Mark as accepted
      await handleUpdate(rec.id, 'accepted', comment || undefined);

      // 2. Call refine with the active page slug, not a hardcoded 'home'
      const res = await fetch(`/api/clone/refine/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageSlug,
          sectionType: rec.sectionType,
          recommendationId: rec.id,
          userComment: comment || undefined,
          instruction: rec.suggestedAction,
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Refine failed');
      }

      // 3. Mark as applied
      await handleUpdate(rec.id, 'applied');

      setApplyStates(prev => ({ ...prev, [rec.id]: { status: 'success' } }));

      // 4. Notify parent to refresh iframe
      onApplied?.();

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setApplyStates(prev => ({ ...prev, [rec.id]: { status: 'error', error: message } }));
    }
  }, [handleUpdate, jobId, pageSlug, onApplied]);

  const pendingCount = report?.recommendations.filter(r => r.status === 'pending' || r.status === 'accepted').length ?? 0;
  const appliedCount = report?.recommendations.filter(r => r.status === 'applied').length ?? 0;

  return (
    <div className="bg-card border border-border rounded-lg flex flex-col overflow-hidden h-full">
      {/* Chrome bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            ai.strategist
          </span>
          {report && (
            <span className="text-[10px] font-mono text-muted-foreground/40">
              — {appliedCount}/{report.recommendations.length} applied
            </span>
          )}
        </div>
        <button
          onClick={onTrigger}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-alias-green/40 text-alias-green bg-alias-green/5 hover:bg-alias-green/15 disabled:opacity-40 transition-colors text-[10px] font-mono uppercase tracking-[0.15em]"
        >
          {isLoading
            ? <><span className="animate-terminal-blink">◆</span> Analysing…</>
            : <><span>◉</span> {report ? 'Re-Analyse' : 'Analyse Site'}</>
          }
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!report && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <span className="text-2xl opacity-20">◉</span>
            <p className="text-[10px] font-mono text-muted-foreground/40 leading-relaxed max-w-[260px]">
              Run the AI Strategist to get a prioritised set of E-E-A-T improvements grounded in your rebuilt site&apos;s current content.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-alias-green animate-pulse" />
            <p className="text-[10px] font-mono text-alias-green/60 uppercase tracking-[0.2em]">Re-scoring rebuilt site…</p>
            <p className="text-[10px] font-mono text-muted-foreground/30">takes ~10–15s</p>
          </div>
        )}

        {report && !isLoading && (
          <>
            {/* Before/After scores */}
            <BeforeAfterBar before={report.beforeScore} after={report.afterScore} />

            {/* Executive summary */}
            <div className="px-3 py-2.5 rounded-lg border border-border/30 bg-muted/20">
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40 mb-1.5">Strategist Assessment</p>
              <p className="text-[10px] font-mono text-foreground/70 leading-relaxed">{report.executiveSummary}</p>
            </div>

            {/* Recommendations */}
            {pendingCount > 0 && (
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40">
                {pendingCount} recommendation{pendingCount !== 1 ? 's' : ''} pending
              </p>
            )}
            <div className="space-y-2">
              {report.recommendations.map(rec => {
                const state = applyStates[rec.id] ?? { status: 'idle' };
                return (
                  <RecCard
                    key={rec.id}
                    rec={rec}
                    jobId={jobId}
                    pageSlug={pageSlug}
                    onUpdate={handleUpdate}
                    onApply={handleApply}
                    applying={state.status === 'loading'}
                    applyResult={state.status === 'loading' ? 'idle' : state.status}
                    applyError={state.error}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
