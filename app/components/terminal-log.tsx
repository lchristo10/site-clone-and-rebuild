'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StreamEvent } from '@/lib/types';
import { PhaseStepper } from './phase-stepper';
import { TokenPreview } from './token-preview';
import { AeoScoreGrid } from './aeo-score-ring';
import { DesignTokens, EntityMap, AeoScore } from '@/lib/types';

type Phase = 'extract' | 'analyze' | 'draft' | 'synthesize' | 'audit';
type PhaseStatus = 'pending' | 'running' | 'done' | 'error';

interface LogLine {
  id: number;
  phase: string;
  message: string;
  type: 'log' | 'running' | 'done' | 'error' | 'system';
  timestamp: number;
}

interface TerminalLogProps {
  jobId: string;
  onComplete?: (screenshotUrl?: string) => void;
}

export function TerminalLog({ jobId, onComplete }: TerminalLogProps) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [phases, setPhases] = useState<Partial<Record<Phase, PhaseStatus>>>({});
  const [phaseStartTimes, setPhaseStartTimes] = useState<Partial<Record<Phase, number>>>({});
  const [phaseDurations, setPhaseDurations] = useState<Partial<Record<Phase, number>>>({});
  const [tokens, setTokens] = useState<DesignTokens | null>(null);
  const [entityMap, setEntityMap] = useState<EntityMap | null>(null);
  const [score, setScore] = useState<AeoScore | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [startTime] = useState(() => Date.now());
  const [totalDuration, setTotalDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const isDoneRef = useRef(false);

  const addLine = useCallback((phase: string, message: string, type: LogLine['type']) => {
    setLines(prev => [...prev, { id: counterRef.current++, phase, message, type, timestamp: Date.now() }]);
  }, []);

  // Load source URL from status API
  useEffect(() => {
    fetch(`/api/clone/status/${jobId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.url) setSourceUrl(data.url); })
      .catch(() => {});
  }, [jobId]);

  useEffect(() => {
    // Pre-check: if the job doesn't exist (e.g. server restarted and cleared
    // the in-memory store), show a clear message before opening the SSE.
    fetch(`/api/clone/status/${jobId}`).then(r => {
      if (r.status === 404) {
        setError('Job not found — it may have expired after a server restart. Please start a new job from the homepage.');
        return;
      }

      // Job exists — open the SSE stream
      const es = new EventSource(`/api/clone/stream/${jobId}`);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const event: StreamEvent = JSON.parse(e.data);

          if (event.phase !== 'system') {
            const phase = event.phase as Phase;
            if (event.status === 'running') {
              setPhases(prev => ({ ...prev, [phase]: 'running' }));
              setPhaseStartTimes(prev => ({ ...prev, [phase]: Date.now() }));
            } else if (event.status === 'done' || event.status === 'error') {
              setPhases(prev => ({ ...prev, [phase]: event.status as PhaseStatus }));
              setPhaseStartTimes(prev => {
                const start = prev[phase];
                if (start) {
                  setPhaseDurations(d => ({ ...d, [phase]: Date.now() - start }));
                }
                return prev;
              });
            }
          }

          addLine(event.phase, event.message, event.status as LogLine['type']);

          if (event.phase === 'extract' && event.status === 'done' && event.data) {
            const d = event.data as { screenshotUrl?: string; meta?: { title?: string; description?: string } };
            if (d.screenshotUrl) setScreenshotUrl(d.screenshotUrl);
          }

          if (event.phase === 'analyze' && event.status === 'done' && event.data) {
            const d = event.data as { tokens?: DesignTokens; entityMap?: EntityMap };
            if (d.tokens) setTokens(d.tokens);
            if (d.entityMap) setEntityMap(d.entityMap);
          }

          if (event.phase === 'audit' && event.status === 'done' && event.data) {
            setScore(event.data as AeoScore);
          }

          if (event.phase === 'system' && event.status === 'done') {
            isDoneRef.current = true;
            setIsDone(true);
            setTotalDuration(Date.now() - startTime);
            es.close();
            onComplete?.(screenshotUrl || undefined);
          }

          if (event.phase === 'system' && event.status === 'error') {
            setError(event.message);
            es.close();
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        setTimeout(async () => {
          if (!isDoneRef.current) {
            // Re-check whether the job still exists so we can show an accurate message.
            // EventSource.onerror doesn't expose the HTTP status code, so we probe manually.
            try {
              const r = await fetch(`/api/clone/status/${jobId}`);
              if (r.status === 404) {
                setError('Job not found — it may have expired after a server restart. Please start a new job from the homepage.');
              } else {
                setError('Connection to the pipeline closed unexpectedly. Please try again.');
              }
            } catch {
              setError('Connection to the pipeline closed unexpectedly. Please try again.');
            }
          }
          es.close();
        }, 300);
      };
    }).catch(() => {
      setError('Could not reach the server. Please check your connection and try again.');
    });

    return () => {
      esRef.current?.close();
    };
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines]);

  const lineColor = (type: LogLine['type']) => {
    if (type === 'done') return 'text-alias-green';
    if (type === 'error') return 'text-alias-red';
    if (type === 'running') return 'text-alias-amber';
    if (type === 'system') return 'text-muted-foreground/60';
    return 'text-foreground/80';
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Phase stepper */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-muted-foreground">Pipeline Status</p>
          {isDone && totalDuration && (
            <span className="text-[9px] font-mono text-alias-green">
              ✓ Completed in {formatDuration(totalDuration)}
            </span>
          )}
        </div>
        <PhaseStepper phases={phases} />
      </div>

      {/* Main layout: terminal + right panel */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 min-h-0">
        {/* Terminal */}
        <div className="bg-card border border-border rounded-lg flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 flex-shrink-0">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            </div>
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground ml-2">
              alias.compiler — [{jobId.slice(0, 8)}]
            </span>
            {sourceUrl && (
              <span className="text-[9px] font-mono text-muted-foreground/40 truncate max-w-[200px]" title={sourceUrl}>
                {sourceUrl.replace(/^https?:\/\//, '')}
              </span>
            )}
            {isDone && (
              <span className="ml-auto text-[9px] font-mono text-alias-green uppercase tracking-wider">● complete</span>
            )}
            {!isDone && !error && lines.length > 0 && (
              <span className="ml-auto text-[9px] font-mono text-alias-amber uppercase tracking-wider animate-pulse">● running</span>
            )}
          </div>

          <div ref={logRef} className="flex-1 overflow-y-auto p-4 space-y-0.5 scanlines">
            {lines.map((line, idx) => {
              const prevLine = idx > 0 ? lines[idx - 1] : null;
              const showDivider = prevLine && prevLine.phase !== line.phase && line.type === 'running';
              return (
                <React.Fragment key={line.id}>
                  {showDivider && <div className="h-px bg-border/20 my-2" />}
                  <div
                    className={`terminal-font leading-relaxed animate-fade-in-up ${lineColor(line.type)}`}
                    style={{ animationDuration: '0.2s' }}
                  >
                    <span className="text-muted-foreground/30 mr-2 select-none">›</span>
                    {line.message}
                    {line.type === 'done' && phaseDurations[line.phase as Phase] && (
                      <span className="text-muted-foreground/40 ml-2">({formatDuration(phaseDurations[line.phase as Phase]!)})</span>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
            {!isDone && !error && lines.length > 0 && (
              <div className="text-[11px] terminal-font text-alias-green">
                <span className="text-muted-foreground/30 mr-2 select-none">›</span>
                <span className="animate-terminal-blink">█</span>
              </div>
            )}
            {lines.length === 0 && (
              <div className="text-[11px] terminal-font text-muted-foreground/40">
                <span className="mr-2 select-none">›</span>
                Initializing pipeline...
                <span className="animate-terminal-blink ml-1">█</span>
              </div>
            )}
          </div>

          {error && (
            <div className="px-4 py-3 border-t border-border/50 bg-alias-red/5 flex-shrink-0">
              <p className="text-[11px] font-mono text-alias-red">{error}</p>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Screenshot */}
          {screenshotUrl && (
            <div className="bg-card border border-border rounded-lg overflow-hidden flex-shrink-0">
              <div className="px-3 py-2 border-b border-border/50">
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Original Site</p>
              </div>
              <div className="relative aspect-video overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshotUrl}
                  alt="Original site screenshot"
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute inset-0 scanlines pointer-events-none" />
              </div>
            </div>
          )}

          {/* Token preview */}
          {tokens && entityMap && (
            <div className="bg-card border border-border rounded-lg p-4 flex-shrink-0 overflow-y-auto max-h-[400px]">
              <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">Extracted Tokens</p>
              <TokenPreview tokens={tokens} entityMap={entityMap} />
            </div>
          )}

          {/* AEO Score */}
          {score && (
            <div className="bg-card border border-border rounded-lg p-4 flex-shrink-0">
              <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">AEO Audit Score</p>
              <AeoScoreGrid
                overall={score.overall}
                content_structure={score.content_structure}
                eeat={score.eeat}
                technical={score.technical}
                entity_alignment={score.entity_alignment}
              />
            </div>
          )}
        </div>
      </div>

      {/* Action buttons — shown when done */}
      {isDone && (
        <div className="flex gap-3 flex-shrink-0 animate-fade-in-up">
          <a
            href={`/preview/${jobId}`}
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-alias-green text-alias-green bg-alias-green-dim rounded-lg text-sm font-mono uppercase tracking-wider hover:bg-alias-green/20 transition-colors"
          >
            <span>◈</span> Preview Rebuilt Site
          </a>
          <a
            href={`/api/clone/download/${jobId}`}
            className="flex items-center justify-center gap-2 px-4 py-3 border border-border text-muted-foreground bg-card rounded-lg text-sm font-mono uppercase tracking-wider hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            ↓ Download ZIP
          </a>
        </div>
      )}
    </div>
  );
}
