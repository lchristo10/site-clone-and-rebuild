'use client';
import { useEffect, useState } from 'react';

interface ScoreRingProps {
  score: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

function getColor(score: number): string {
  if (score >= 70) return 'oklch(0.72 0.2 145)';
  if (score >= 40) return 'oklch(0.78 0.18 75)';
  return 'oklch(0.62 0.22 25)';
}

function getLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Poor';
  return 'Critical';
}

export function AeoScoreRing({ score, label, size = 'md' }: ScoreRingProps) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      let current = 0;
      const step = Math.ceil(score / 30);
      const interval = setInterval(() => {
        current = Math.min(current + step, score);
        setDisplayed(current);
        if (current >= score) clearInterval(interval);
      }, 30);
      return () => clearInterval(interval);
    }, 300);
    return () => clearTimeout(timer);
  }, [score]);

  const configs = {
    sm: { viewBox: 80, r: 28, stroke: 6, fontSize: 18, labelSize: 8, cx: 40, cy: 40 },
    md: { viewBox: 120, r: 44, stroke: 8, fontSize: 28, labelSize: 10, cx: 60, cy: 60 },
    lg: { viewBox: 160, r: 60, stroke: 10, fontSize: 40, labelSize: 12, cx: 80, cy: 80 },
  };

  const c = configs[size];
  const circumference = 2 * Math.PI * c.r;
  const offset = circumference - (displayed / 100) * circumference;
  const color = getColor(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={c.viewBox} height={c.viewBox} viewBox={`0 0 ${c.viewBox} ${c.viewBox}`}>
        {/* Track */}
        <circle
          cx={c.cx} cy={c.cy} r={c.r}
          fill="none"
          stroke="oklch(1 0 0 / 6%)"
          strokeWidth={c.stroke}
        />
        {/* Progress */}
        <circle
          cx={c.cx} cy={c.cy} r={c.r}
          fill="none"
          stroke={color}
          strokeWidth={c.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${c.cx} ${c.cy})`}
          style={{
            transition: 'stroke-dashoffset 0.05s linear, stroke 0.5s ease',
            filter: `drop-shadow(0 0 6px ${color}60)`,
          }}
        />
        {/* Score number */}
        <text
          x={c.cx} y={c.cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize={c.fontSize}
          fontWeight="700"
          fontFamily="var(--font-geist-mono), monospace"
          className="animate-count-up"
        >
          {displayed}
        </text>
      </svg>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">{label}</p>
      {size === 'lg' && (
        <p className="text-xs font-mono tracking-wide mt-0.5" style={{ color }}>{getLabel(score)}</p>
      )}
    </div>
  );
}

interface AeoScoreGridProps {
  overall: number;
  content_structure: number;
  eeat: number;
  technical: number;
  entity_alignment: number;
  /** 'horizontal' = pipeline compact row (default), 'vertical' = report page stacked */
  layout?: 'horizontal' | 'vertical';
}

export function AeoScoreGrid({ overall, content_structure, eeat, technical, entity_alignment, layout = 'horizontal' }: AeoScoreGridProps) {
  if (layout === 'vertical') {
    return (
      <div className="flex flex-col items-center gap-6">
        {/* Overall ring — centred, larger */}
        <AeoScoreRing score={overall} label="Overall AEO Score" size="lg" />

        {/* Divider */}
        <div className="w-full h-px bg-border/30" />

        {/* Sub-scores — 2×2 grid */}
        <div className="w-full grid grid-cols-2 gap-4">
          <AeoScoreRing score={content_structure} label="Content Structure" size="sm" />
          <AeoScoreRing score={eeat} label="E-E-A-T" size="sm" />
          <AeoScoreRing score={technical} label="Technical" size="sm" />
          <AeoScoreRing score={entity_alignment} label="Entity Align" size="sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {/* Overall — left */}
      <div className="flex-shrink-0">
        <AeoScoreRing score={overall} label="Overall AEO Score" size="lg" />
      </div>

      {/* Divider */}
      <div className="w-px self-stretch bg-border/30 flex-shrink-0" />

      {/* Sub-scores — 2×2 right */}
      <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-3">
        <AeoScoreRing score={content_structure} label="Content Structure" size="sm" />
        <AeoScoreRing score={eeat} label="E-E-A-T" size="sm" />
        <AeoScoreRing score={technical} label="Technical" size="sm" />
        <AeoScoreRing score={entity_alignment} label="Entity Align" size="sm" />
      </div>
    </div>
  );
}


