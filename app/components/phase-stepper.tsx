'use client';

type Phase = 'extract' | 'analyze' | 'draft' | 'synthesize' | 'audit';
type PhaseStatus = 'pending' | 'running' | 'done' | 'error';

const PHASES: { id: Phase; label: string; shortLabel: string }[] = [
  { id: 'extract', label: 'Extract', shortLabel: 'EXT' },
  { id: 'analyze', label: 'Analyze', shortLabel: 'ANL' },
  { id: 'draft', label: 'Draft', shortLabel: 'DFT' },
  { id: 'synthesize', label: 'Synthesize', shortLabel: 'SYN' },
  { id: 'audit', label: 'Audit', shortLabel: 'AUD' },
];

interface PhaseStepperProps {
  phases: Partial<Record<Phase, PhaseStatus>>;
}

export function PhaseStepper({ phases }: PhaseStepperProps) {
  return (
    <div className="flex items-center gap-0 w-full">
      {PHASES.map((phase, i) => {
        const status = phases[phase.id] || 'pending';
        const isLast = i === PHASES.length - 1;

        const statusColor =
          status === 'done' ? 'text-alias-green border-alias-green' :
          status === 'running' ? 'text-alias-amber border-alias-amber' :
          status === 'error' ? 'text-alias-red border-alias-red' :
          'text-muted-foreground border-border';

        const bgColor =
          status === 'done' ? 'bg-alias-green-dim' :
          'bg-transparent';

        const icon =
          status === 'done' ? '✓' :
          status === 'running' ? '◆' :
          status === 'error' ? '✗' :
          '○';

        return (
          <div key={phase.id} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div className={`w-8 h-8 rounded border flex items-center justify-center text-sm font-mono font-bold transition-all duration-500 ${statusColor} ${bgColor} ${status === 'running' ? 'animate-pulse-glow' : ''}`}>
                {status === 'running' ? (
                  <span className="animate-terminal-blink">{icon}</span>
                ) : icon}
              </div>
              <span className={`text-[10px] font-mono uppercase tracking-widest hidden sm:block transition-colors duration-300 ${
                status === 'pending' ? 'text-muted-foreground/40' : statusColor.split(' ')[0]
              }`}>
                {phase.shortLabel}
              </span>
              <span className={`text-[10px] font-mono uppercase tracking-wide block sm:hidden transition-colors duration-300 ${
                status === 'pending' ? 'text-muted-foreground/40' : statusColor.split(' ')[0]
              }`}>
                {phase.shortLabel}
              </span>
            </div>
            {!isLast && (
              <div className={`h-px flex-1 mx-1 transition-colors duration-700 ${
                status === 'done' ? 'bg-alias-green/40' :
                status === 'running' ? 'bg-alias-amber/30' :
                'bg-border/30'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
