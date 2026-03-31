'use client';
import { DesignTokens, EntityMap } from '@/lib/types';

interface TokenPreviewProps {
  tokens: DesignTokens;
  entityMap: EntityMap;
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-5 h-5 rounded border border-white/10 flex-shrink-0"
        style={{ background: color }}
        title={color}
      />
      <div className="min-w-0">
        <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground truncate">{label}</p>
        <p className="text-[10px] font-mono text-foreground/70 truncate">{color}</p>
      </div>
    </div>
  );
}

export function TokenPreview({ tokens, entityMap }: TokenPreviewProps) {
  const { colors, typography, spacing, layout } = tokens;

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Business identity */}
      <div>
        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">Entity Map</p>
        <div className="space-y-1">
          <div className="flex items-start gap-2">
            <span className="text-[9px] font-mono text-muted-foreground/60 w-16 flex-shrink-0 uppercase">Brand</span>
            <span className="text-[10px] font-mono text-alias-green truncate">{entityMap.businessName}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[9px] font-mono text-muted-foreground/60 w-16 flex-shrink-0 uppercase">Industry</span>
            <span className="text-[10px] font-mono text-foreground/80 truncate">{entityMap.industry}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[9px] font-mono text-muted-foreground/60 w-16 flex-shrink-0 uppercase">Service</span>
            <span className="text-[10px] font-mono text-foreground/80 truncate">{entityMap.primaryService}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[9px] font-mono text-muted-foreground/60 w-16 flex-shrink-0 uppercase">Audience</span>
            <span className="text-[10px] font-mono text-foreground/80 truncate">{entityMap.targetAudience}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {entityMap.entities.slice(0, 5).map((e) => (
            <span key={e} className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-alias-green/30 text-alias-green bg-alias-green-dim truncate max-w-[120px]">
              {e}
            </span>
          ))}
        </div>
      </div>

      <div className="h-px bg-border/30" />

      {/* Colors */}
      <div>
        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">Color Tokens</p>
        <div className="space-y-1.5">
          <Swatch color={colors.primary} label="Primary" />
          <Swatch color={colors.secondary} label="Secondary" />
          <Swatch color={colors.surface} label="Surface" />
          <Swatch color={colors.accent} label="Accent" />
          <Swatch color={colors.text} label="Text" />
        </div>
      </div>

      <div className="h-px bg-border/30" />

      {/* Typography */}
      <div>
        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">Typography</p>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-[9px] font-mono text-muted-foreground">Heading</span>
            <span className="text-[9px] font-mono text-foreground/80 truncate max-w-[120px]">{typography.headingFont}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] font-mono text-muted-foreground">Body</span>
            <span className="text-[9px] font-mono text-foreground/80 truncate max-w-[120px]">{typography.bodyFont}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] font-mono text-muted-foreground">Base size</span>
            <span className="text-[9px] font-mono text-foreground/80">{typography.baseSizePx}px</span>
          </div>
        </div>
      </div>

      <div className="h-px bg-border/30" />

      {/* Spacing + Layout */}
      <div>
        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">Layout</p>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-[9px] font-mono text-muted-foreground">Nav</span>
            <span className="text-[9px] font-mono text-foreground/80">{layout.navType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] font-mono text-muted-foreground">Hero</span>
            <span className="text-[9px] font-mono text-foreground/80">{layout.heroType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] font-mono text-muted-foreground">Columns</span>
            <span className="text-[9px] font-mono text-foreground/80">{layout.columnCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] font-mono text-muted-foreground">Container</span>
            <span className="text-[9px] font-mono text-foreground/80">{spacing.containerWidthPx}px</span>
          </div>
        </div>
      </div>
    </div>
  );
}
