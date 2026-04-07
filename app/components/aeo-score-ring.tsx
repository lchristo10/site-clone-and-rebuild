'use client';
import { useEffect, useState } from 'react';

interface ScoreRingProps {
  score: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  tooltip?: string;
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

export function AeoScoreRing({ score, label, size = 'md', tooltip }: ScoreRingProps) {
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
    sm: { viewBox: 100, r: 36, stroke: 7, fontSize: 22, labelSize: 9, cx: 50, cy: 50 },
    md: { viewBox: 130, r: 50, stroke: 9, fontSize: 32, labelSize: 11, cx: 65, cy: 65 },
    lg: { viewBox: 200, r: 80, stroke: 12, fontSize: 52, labelSize: 13, cx: 100, cy: 100 },
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

      {/* Label — with optional tooltip */}
      {tooltip ? (
        <div className="relative group flex flex-col items-center">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center cursor-help border-b border-dashed border-muted-foreground/30 leading-tight pb-px">
            {label}
          </p>
          {/* Tooltip bubble */}
          <div
            className="
              pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2
              w-52 px-3 py-2 rounded-lg
              bg-card border border-border
              shadow-lg shadow-black/20
              opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100
              transition-all duration-150 ease-out
              z-50
            "
          >
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0
              border-l-[5px] border-l-transparent
              border-r-[5px] border-r-transparent
              border-t-[5px] border-t-border" />
            <p className="text-[10px] font-mono text-foreground/80 leading-relaxed text-center">
              {tooltip}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
          {label}
        </p>
      )}

      {size === 'lg' && (
        <p className="text-sm font-mono tracking-wide mt-0.5" style={{ color }}>{getLabel(score)}</p>
      )}
    </div>
  );
}

// ── Tooltip copy for each AEO dimension ──────────────────────────────────────

const AEO_TOOLTIPS: Record<string, string> = {
  'Content Structure':
    'How well your page is structured for AI to extract answers — clear headings, bullet lists, a direct opening summary, and multiple distinct sections.',
  'E-E-A-T':
    'Experience, Expertise, Authoritativeness & Trustworthiness. Named authors, credentials, real stats, customer reviews, and trust signals like certifications.',
  'Technical':
    'The technical foundations AI crawlers rely on — structured data (JSON-LD schema), semantic HTML landmarks, a single H1, a meta description, and readable static content.',
  'Entity Align':
    'How clearly the page signals what this business is and who it serves — brand name in the headline, primary service described early, specific terminology, and local/audience targeting.',
};

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
          <AeoScoreRing score={content_structure} label="Content Structure" size="sm" tooltip={AEO_TOOLTIPS['Content Structure']} />
          <AeoScoreRing score={eeat}              label="E-E-A-T"           size="sm" tooltip={AEO_TOOLTIPS['E-E-A-T']} />
          <AeoScoreRing score={technical}         label="Technical"         size="sm" tooltip={AEO_TOOLTIPS['Technical']} />
          <AeoScoreRing score={entity_alignment}  label="Entity Align"      size="sm" tooltip={AEO_TOOLTIPS['Entity Align']} />
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
      <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-4">
        <AeoScoreRing score={content_structure} label="Content Structure" size="md" tooltip={AEO_TOOLTIPS['Content Structure']} />
        <AeoScoreRing score={eeat}              label="E-E-A-T"           size="md" tooltip={AEO_TOOLTIPS['E-E-A-T']} />
        <AeoScoreRing score={technical}         label="Technical"         size="md" tooltip={AEO_TOOLTIPS['Technical']} />
        <AeoScoreRing score={entity_alignment}  label="Entity Align"      size="md" tooltip={AEO_TOOLTIPS['Entity Align']} />
      </div>
    </div>
  );
}
