'use client';
import { useState, useEffect, useRef } from 'react';

interface AeoPowerMeterProps {
  /** Current rebuilt site AEO score (0-100). Undefined while not yet analysed. */
  score?: number;
  /** Original site score for delta display */
  originalScore?: number;
  /** Sum of expectedScoreGain across all pending recommendations */
  pendingGain?: number;
  /** When true, show a pulsing loading state (re-audit in progress) */
  isLoading?: boolean;
  /** When the strategist drawer is open, meter shifts left to avoid overlap */
  drawerOpen?: boolean;
}

// Returns a color that supports proper oklch alpha — e.g. c(1) = full opacity, c(0.2) = 20%
function scoreColorFn(score: number): (alpha: number) => string {
  const [L, C, H] =
    score >= 70 ? [0.72, 0.2, 145] :  // alias-green
    score >= 40 ? [0.78, 0.18, 75]  :  // alias-amber
                  [0.62, 0.22, 25];     // alias-red
  return (alpha: number) => `oklch(${L} ${C} ${H} / ${Math.round(alpha * 100)}%)`;
}


export function AeoPowerMeter({
  score,
  originalScore,
  pendingGain = 0,
  isLoading = false,
  drawerOpen = false,
}: AeoPowerMeterProps) {
  const [displayScore, setDisplayScore] = useState(score ?? 0);
  const [flashing, setFlashing] = useState(false);
  const prevScoreRef = useRef(score ?? 0);

  // Animate score changes; flash red if score drops
  useEffect(() => {
    if (score === undefined) return;
    if (score < prevScoreRef.current) {
      setFlashing(true);
      const t = setTimeout(() => setFlashing(false), 1200);
      return () => clearTimeout(t);
    }
    prevScoreRef.current = score;
    setDisplayScore(score);
  }, [score]);

  // Smooth count-up animation
  useEffect(() => {
    if (score === undefined) return;
    const target = score;
    const start = displayScore;
    if (start === target) return;

    const steps = 20;
    const diff = target - start;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      setDisplayScore(Math.round(start + (diff * step) / steps));
      if (step >= steps) clearInterval(interval);
    }, 25);

    return () => clearInterval(interval);
  }, [score]); // eslint-disable-line react-hooks/exhaustive-deps

  const baseScore = flashing ? 0 : displayScore;  // force red palette while flashing
  const c = scoreColorFn(baseScore);
  const fillPct = Math.min(displayScore, 100);
  const ghostPct = Math.min(displayScore + pendingGain, 100);
  const delta = originalScore !== undefined ? displayScore - originalScore : null;

  return (
    <div
      className="fixed z-40 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2.5 transition-[right] duration-300 ease-in-out hidden lg:flex"
      style={{ right: drawerOpen ? '435px' : '20px' }}
      title="AEO Power Meter — current rebuilt site score"
    >
      {/* Vertical label */}
      <div
        className="text-[11px] font-mono tracking-[0.2em] uppercase text-muted-foreground/50"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        AEO Power
      </div>

      {/* Track */}
      <div className="relative w-3 h-48 rounded-full overflow-hidden border border-border/30" style={{ background: 'oklch(0.9 0 0)' }}>

        {/* Ghost fill — potential gain from pending recs */}
        {pendingGain > 0 && !isLoading && (
          <div
            className="absolute bottom-0 left-0 right-0 transition-all duration-700"
            style={{
              height: `${ghostPct}%`,
              background: c(0.15),
              borderTop: `1px dashed ${c(0.4)}`,
            }}
          />
        )}

        {/* Solid fill — current score */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-700"
          style={{
            height: isLoading ? '100%' : `${fillPct}%`,
            background: isLoading
              ? 'oklch(0.72 0.2 145 / 15%)'
              : `linear-gradient(to top, ${c(1)}, ${c(0.7)})`,
            animation: isLoading ? 'power-meter-pulse 1.5s ease-in-out infinite' : undefined,
          }}
        />

        {/* Tick marks at 25 / 50 / 75 */}
        {[25, 50, 75].map(tick => (
          <div
            key={tick}
            className="absolute left-0 right-0 h-px pointer-events-none"
            style={{ bottom: `${tick}%`, background: 'oklch(1 0 0 / 50%)' }}
          />
        ))}
      </div>

      {/* Icon — SVG zap that matches fill colour */}
      <div className="transition-colors duration-300">
        {isLoading ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="oklch(0.72 0.2 145 / 40%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
          </svg>
        ) : flashing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="oklch(0.62 0.22 25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" /><path d="M12 17h.01" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill={c(1)} stroke="none">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        )}
      </div>

      {/* Score number */}
      <div
        className="text-[15px] font-mono font-bold tabular-nums transition-colors duration-300 leading-none"
        style={{ color: isLoading ? 'oklch(0.72 0.2 145 / 40%)' : c(1) }}
      >
        {isLoading ? '…' : displayScore}
      </div>

      {/* Delta from original */}
      {delta !== null && !isLoading && (
        <div
          className="text-[9px] font-mono font-bold leading-none"
          style={{ color: delta >= 0 ? 'oklch(0.72 0.2 145)' : 'oklch(0.62 0.22 25)' }}
        >
          {delta >= 0 ? '+' : ''}{delta}
        </div>
      )}



      {/* Pending gain indicator */}
      {pendingGain > 0 && !isLoading && (
        <div
          className="text-[8px] font-mono leading-none text-center"
          style={{ color: c(0.6) }}
          title={`+${pendingGain} pts possible from pending recommendations`}
        >
          +{pendingGain}
          <br />
          <span className="opacity-60">pts</span>
        </div>
      )}
    </div>
  );
}
