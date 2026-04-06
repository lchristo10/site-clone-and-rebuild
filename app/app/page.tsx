'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type SiteObjective = 'sell-products' | 'make-bookings' | 'capture-leads' | 'other';
interface SitePersona {
  layout: 'spacious' | 'dense';
  tone: 'professional' | 'disruptor';
  imagery: 'human-centric' | 'abstract-tech';
  motion: 'static' | 'high-motion';
  architecture: 'linear-story' | 'deep-hub';
}

interface RecentJob {
  jobId: string;
  url: string;
  createdAt: number;
}

// ── Objective config ──────────────────────────────────────────────────────────

const OBJECTIVES: { id: SiteObjective; icon: string; label: string; sub: string }[] = [
  { id: 'sell-products',  icon: '◈', label: 'Sell Products',   sub: 'E-commerce · Shop · Buy Now' },
  { id: 'make-bookings',  icon: '◉', label: 'Make Bookings',   sub: 'Appointments · Schedule · Reserve' },
  { id: 'capture-leads',  icon: '◎', label: 'Capture Leads',   sub: 'Enquiry · Quote · Free Consult' },
  { id: 'other',          icon: '○', label: 'Other',            sub: 'Inform · Publish · Portfolio' },
];

// ── Vibe Forge duel config ────────────────────────────────────────────────────

type PersonaKey = keyof SitePersona;

interface DuelOption<V extends string> {
  value: V;
  label: string;
  sub: string;
  preview: React.ReactNode;
}

interface Duel<K extends PersonaKey> {
  index: number;
  tag: string;
  question: string;
  key: K;
  options: [DuelOption<SitePersona[K]>, DuelOption<SitePersona[K]>];
}

// Preview mini-illustrations (dark ALIAS theme)
const SpacePreview = () => (
  <div className="h-[88px] flex items-center justify-center px-6">
    <div className="w-full flex flex-col items-center gap-3">
      <div className="h-1.5 w-3/5 rounded-full bg-border/50" />
      <div className="h-7 w-2/5 rounded-md bg-alias-green/20 border border-alias-green/30" />
      <div className="h-1 w-2/5 rounded-full bg-border/25" />
    </div>
  </div>
);

const DensePreview = () => (
  <div className="h-[88px] flex flex-col justify-center p-3 gap-1">
    {[100, 90, 100, 85, 100].map((w, i) => (
      <div key={i} className="h-2 rounded bg-foreground/20" style={{ width: `${w}%` }} />
    ))}
  </div>
);

const ProfessionalPreview = () => (
  <div className="h-[88px] flex items-center justify-center">
    <span style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}
      className="text-xl text-foreground/50 tracking-tight">
      Refined.
    </span>
  </div>
);

const DisruptorPreview = () => (
  <div className="h-[88px] flex items-center justify-center rounded-sm"
    style={{ background: 'oklch(0.12 0.01 240)' }}>
    <span className="text-xl font-black tracking-tight font-mono text-alias-green">
      BOLD.
    </span>
  </div>
);

const HumanPreview = () => (
  <div className="h-[88px] flex items-center justify-center">
    <div className="relative w-20 h-12">
      <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-rose-400/30 border border-rose-400/20" />
      <div className="absolute left-5 top-3 w-8 h-8 rounded-full bg-rose-400/50 border border-rose-400/30" />
      <div className="absolute left-9 top-5 w-6 h-6 rounded-full bg-rose-400/25 border border-rose-400/15" />
    </div>
  </div>
);

const AbstractPreview = () => (
  <div className="h-[88px] flex items-center justify-center relative overflow-hidden">
    <div className="absolute w-12 h-12 rounded-lg bg-indigo-500/20 border border-indigo-400/30"
      style={{ transform: 'rotate(18deg) translate(-8px, -4px)' }} />
    <div className="absolute w-7 h-7 rounded-sm bg-alias-green/20 border border-alias-green/30"
      style={{ transform: 'rotate(-10deg) translate(12px, 8px)' }} />
  </div>
);

const StaticPreview = () => (
  <div className="h-[88px] flex items-center justify-center">
    <div className="w-5 h-5 rounded-full bg-foreground/70" />
  </div>
);

const MotionPreview = () => (
  <div className="h-[88px] flex items-center justify-center">
    <div className="w-5 h-5 rounded-full bg-alias-green animate-bounce"
      style={{ animationDuration: '0.7s' }} />
  </div>
);

const LinearPreview = () => (
  <div className="h-[88px] flex flex-col justify-center p-3 gap-1.5">
    <div className="h-2.5 w-4/5 rounded bg-foreground/30" />
    <div className="h-1.5 w-full rounded bg-border/30" />
    <div className="h-1.5 w-11/12 rounded bg-border/25" />
    <div className="h-1.5 w-4/5 rounded bg-border/20" />
    <div className="h-2 w-1/3 rounded bg-alias-green/25 mt-0.5" />
  </div>
);

const HubPreview = () => (
  <div className="h-[88px] grid grid-cols-2 gap-1 p-2">
    <div className="rounded bg-border/20 flex items-center justify-center">
      <div className="h-1 w-3/5 rounded bg-border/40" />
    </div>
    <div className="rounded bg-border/30 flex items-center justify-center">
      <div className="h-1 w-3/5 rounded bg-border/40" />
    </div>
    <div className="rounded bg-border/25 flex items-center justify-center">
      <div className="h-1 w-3/5 rounded bg-border/40" />
    </div>
    <div className="rounded bg-alias-green/10 border border-alias-green/20 flex items-center justify-center">
      <div className="h-1 w-3/5 rounded bg-alias-green/30" />
    </div>
  </div>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DUELS: Duel<any>[] = [
  {
    index: 0,
    tag: 'DUEL 1 — LAYOUT',
    question: 'How should space feel?',
    key: 'layout',
    options: [
      { value: 'spacious', label: 'Spacious & Airy', sub: 'Apple style — room to breathe', preview: <SpacePreview /> },
      { value: 'dense',    label: 'Information Dense', sub: 'Bloomberg style — packed signal', preview: <DensePreview /> },
    ],
  },
  {
    index: 1,
    tag: 'DUEL 2 — TONE',
    question: 'What voice speaks to your audience?',
    key: 'tone',
    options: [
      { value: 'professional', label: 'The Professional', sub: 'Serif, muted, authoritative', preview: <ProfessionalPreview /> },
      { value: 'disruptor',    label: 'The Disruptor',    sub: 'Bold sans, high contrast, electric', preview: <DisruptorPreview /> },
    ],
  },
  {
    index: 2,
    tag: 'DUEL 3 — IMAGERY',
    question: 'What visual language do you speak?',
    key: 'imagery',
    options: [
      { value: 'human-centric', label: 'Human-Centric',   sub: 'Photography, faces, warmth', preview: <HumanPreview /> },
      { value: 'abstract-tech', label: 'Abstract / Tech', sub: '3D renders, vectors, geometry', preview: <AbstractPreview /> },
    ],
  },
  {
    index: 3,
    tag: 'DUEL 4 — INTERACTION',
    question: 'How should the site move?',
    key: 'motion',
    options: [
      { value: 'static',      label: 'Static & Grounded',    sub: 'Deliberate, calm, focused', preview: <StaticPreview /> },
      { value: 'high-motion', label: 'High Motion / Parallax', sub: 'Alive, dynamic, expressive', preview: <MotionPreview /> },
    ],
  },
  {
    index: 4,
    tag: 'DUEL 5 — STRUCTURE',
    question: 'What is the site\'s architecture?',
    key: 'architecture',
    options: [
      { value: 'linear-story', label: 'Linear Story', sub: 'One-pager, scrollable narrative', preview: <LinearPreview /> },
      { value: 'deep-hub',     label: 'Deep Hub',     sub: 'Multi-page, content-rich structure', preview: <HubPreview /> },
    ],
  },
];

// ── Main component ────────────────────────────────────────────────────────────

type ModalStep = 'idle' | 'objective' | 'vibe';

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [fidelityMode, setFidelityMode] = useState<'aeo-first' | 'brand-first'>('aeo-first');

  // Modal step state
  const [step, setStep] = useState<ModalStep>('idle');
  const [selectedObjective, setSelectedObjective] = useState<SiteObjective | null>(null);
  const [currentDuel, setCurrentDuel] = useState(0);
  const [persona, setPersona] = useState<Partial<SitePersona>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem('alias-compiler-jobs');
      if (stored) setRecentJobs(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // ── Step 1: RUN clicked → show objective modal
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setError('');
    setStep('objective');
  };

  // ── Step 2: Objective chosen → transition to vibe forge
  const handleObjectiveSelect = (objective: SiteObjective) => {
    setSelectedObjective(objective);
    setCurrentDuel(0);
    setPersona({});
    setStep('vibe');
  };

  // ── Step 3: Each duel answered → accumulate persona → on last duel, launch
  const handleDuelSelect = async (key: PersonaKey, value: string) => {
    const newPersona = { ...persona, [key]: value } as Partial<SitePersona>;
    setPersona(newPersona);

    if (currentDuel < DUELS.length - 1) {
      setCurrentDuel(currentDuel + 1);
      return;
    }

    // All 5 duels done — fire the job
    setStep('idle');
    setLoading(true);

    try {
      const res = await fetch('/api/clone/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          fidelityMode,
          siteObjective: selectedObjective,
          sitePersona: newPersona,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to start clone job');
        setLoading(false);
        return;
      }

      const job: RecentJob = { jobId: data.jobId, url: data.url, createdAt: Date.now() };
      const updated = [job, ...recentJobs].slice(0, 5);
      localStorage.setItem('alias-compiler-jobs', JSON.stringify(updated));

      router.push(`/clone/${data.jobId}`);
    } catch {
      setError('Network error — please try again');
      setLoading(false);
    }
  };

  const closeModal = () => setStep('idle');

  const duel = DUELS[currentDuel];

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-border/30 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">ALIAS</span>
          <span className="text-muted-foreground/40 mx-1">·</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-alias-green">COMPILER</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50 hidden sm:block">
            Clone · Analyze · Rebuild · Optimize
          </span>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pt-24 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(oklch(0 0 0 / 4%) 1px, transparent 1px),
              linear-gradient(90deg, oklch(0 0 0 / 4%) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full opacity-[0.06] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, oklch(0.52 0.18 145) 0%, transparent 70%)' }}
        />
        <div className="scanlines absolute inset-0 pointer-events-none opacity-20" />

        <div className="relative z-10 w-full max-w-3xl flex flex-col items-center text-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-alias-green/30 bg-alias-green-dim">
            <span className="w-1.5 h-1.5 rounded-full bg-alias-green animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-alias-green">AEO-First Rebuild Engine</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-[clamp(2.5rem,8vw,6rem)] font-bold leading-none tracking-tighter text-foreground">
              ALIAS<br />
              <span className="text-muted-foreground/40">COMPILER</span>
            </h1>
            <p className="text-sm font-mono text-muted-foreground tracking-wider uppercase">
              Clone · Refactor · Optimise for AI
            </p>
          </div>

          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            Enter any public URL. ALIAS extracts the design system, rebuilds the site to optimise for AEO and assigns your branding.
          </p>

          <form onSubmit={handleSubmit} className="w-full max-w-xl mt-2">
            <div className="input-glow flex rounded-lg border border-border/60 bg-card overflow-hidden transition-all">
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="m11studio.com or https://example.com"
                className="flex-1 bg-transparent px-4 py-4 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 outline-none"
                disabled={loading}
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="px-6 py-4 bg-alias-green text-background text-sm font-mono uppercase tracking-[0.2em] font-bold transition-all hover:bg-alias-green/90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex-shrink-0"
              >
                {loading ? <span className="animate-terminal-blink">▶</span> : '▶ RUN'}
              </button>
            </div>

            {error && (
              <p className="mt-2 text-[14px] font-mono text-alias-red text-left px-1">✗ {error}</p>
            )}

            <div className="mt-4 flex flex-col gap-1.5">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">Output Mode</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setFidelityMode('aeo-first')}
                  className={`flex-1 px-3 py-2.5 rounded border text-[10px] font-mono uppercase tracking-[0.15em] transition-all ${
                    fidelityMode === 'aeo-first'
                      ? 'border-alias-green bg-alias-green/10 text-alias-green'
                      : 'border-border/40 text-muted-foreground/50 hover:border-border hover:text-foreground'
                  }`}>
                  <span className="block text-[10px] mb-0.5 opacity-60">◈</span>
                  AEO-First
                  <span className="block text-[10px] mt-0.5 opacity-50 normal-case tracking-normal">Rewrites structure for AI</span>
                </button>
                <button type="button" onClick={() => setFidelityMode('brand-first')}
                  className={`flex-1 px-3 py-2.5 rounded border text-[10px] font-mono uppercase tracking-[0.15em] transition-all ${
                    fidelityMode === 'brand-first'
                      ? 'border-alias-amber bg-alias-amber/10 text-alias-amber'
                      : 'border-border/40 text-muted-foreground/50 hover:border-border hover:text-foreground'
                  }`}>
                  <span className="block text-[10px] mb-0.5 opacity-60">◉</span>
                  Brand-First
                  <span className="block text-[10px] mt-0.5 opacity-50 normal-case tracking-normal">Keeps original layout + fonts</span>
                </button>
              </div>
            </div>

            <p className="mt-2 text-[10px] font-mono text-muted-foreground/40 text-left px-1">
              Powered by Firecrawl + Gemini 2.5 Flash. Any public URL works.
            </p>
          </form>

          {/* Pipeline steps */}
          <div className="flex items-center gap-2 flex-wrap justify-center mt-4">
            {[
              { step: '01', label: 'Extract',    desc: 'Firecrawl scrapes HTML + screenshot' },
              { step: '02', label: 'Analyze',    desc: 'Gemini Vision reads design tokens' },
              { step: '03', label: 'Draft',      desc: 'AEO content outline + Schema.org' },
              { step: '04', label: 'Synthesize', desc: 'Semantic HTML + CSS assembly' },
              { step: '05', label: 'Audit',      desc: 'Simulated AI crawler score' },
            ].map((item, i) => (
              <div key={item.step} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1 px-3 py-2 rounded border border-border/40 bg-card/50 min-w-[80px]">
                  <span className="text-[10px] font-mono text-alias-green/60 tracking-widest">{item.step}</span>
                  <span className="text-[14px] font-mono uppercase tracking-wide text-foreground/80">{item.label}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/50 text-center leading-tight hidden sm:block">{item.desc}</span>
                </div>
                {i < 4 && <span className="text-muted-foreground/20 text-sm hidden sm:block">→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent jobs */}
      {recentJobs.length > 0 && (
        <section className="px-6 pb-12 max-w-3xl mx-auto w-full">
          <div className="border-t border-border/30 pt-8">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">Recent Jobs</p>
              <button onClick={() => { setRecentJobs([]); localStorage.removeItem('alias-compiler-jobs'); }}
                className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40 hover:text-alias-red transition-colors">
                Clear
              </button>
            </div>
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <a key={job.jobId} href={`/clone/${job.jobId}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/30 hover:bg-card hover:border-border/80 transition-all group">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-mono text-alias-green/60">◈</span>
                    <span className="text-[14px] font-mono text-foreground/70 truncate group-hover:text-foreground transition-colors">{job.url}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/40 flex-shrink-0 ml-4">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="py-6 px-6 border-t border-border/20 text-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/40">
          ALIAS COMPILER · AEO Rebuild Engine · {new Date().getFullYear()}
        </p>
      </footer>

      {/* ── Modal overlay (shared backdrop) ─────────────────────────────────── */}
      {step !== 'idle' && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >

          {/* ── STEP 1: Objective Picker ─────────────────────────────────────── */}
          {step === 'objective' && (
            <div className="w-full max-w-lg rounded-xl border border-border/60 bg-background"
              style={{ boxShadow: '0 28px 80px rgba(0,0,0,0.65)' }}>

              <div className="px-5 pt-5 pb-4 border-b border-border/30">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-alias-green animate-pulse" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-alias-green">Step 1 of 2 · Strategy</span>
                </div>
                <p className="text-[15px] font-semibold text-foreground leading-snug">
                  What is the primary objective of this site?
                </p>
                <p className="text-[14px] text-muted-foreground/55 mt-1">
                  Shapes content strategy, CTA structure, Schema.org type, and copy tone.
                </p>
              </div>

              <div className="p-4 grid grid-cols-2 gap-2">
                {OBJECTIVES.map((obj) => (
                  <button
                    key={obj.id}
                    id={`objective-${obj.id}`}
                    onClick={() => handleObjectiveSelect(obj.id)}
                    className="group text-left p-3.5 rounded-lg border border-border/40 bg-card/40 hover:border-alias-green/60 hover:bg-alias-green/5 transition-all active:scale-[0.98]"
                  >
                    <span className="block text-[14px] font-mono text-alias-green/50 mb-1.5 group-hover:text-alias-green transition-colors">{obj.icon}</span>
                    <span className="block text-[14px] font-mono font-semibold uppercase tracking-[0.12em] text-foreground/90 group-hover:text-foreground transition-colors leading-none mb-1">{obj.label}</span>
                    <span className="block text-[10px] font-mono text-muted-foreground/50 normal-case tracking-normal group-hover:text-muted-foreground/70 transition-colors">{obj.sub}</span>
                  </button>
                ))}
              </div>

              <div className="px-4 pb-4">
                <button onClick={closeModal}
                  className="w-full py-2 rounded-lg border border-border/30 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40 hover:text-muted-foreground hover:border-border/60 transition-all">
                  ← Back
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Vibe Forge ───────────────────────────────────────────── */}
          {step === 'vibe' && (
            <div className="w-full max-w-xl rounded-xl border border-border/60 bg-background"
              style={{ boxShadow: '0 28px 80px rgba(0,0,0,0.65)' }}>

              {/* Header */}
              <div className="px-5 pt-5 pb-4 border-b border-border/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-alias-green animate-pulse" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-alias-green">Step 2 of 2 · Vibe Forge</span>
                  </div>
                  {/* Progress dots */}
                  <div className="flex items-center gap-1.5">
                    {DUELS.map((_, i) => (
                      <div key={i} className={`rounded-full transition-all duration-300 ${
                        i < currentDuel
                          ? 'w-2 h-2 bg-alias-green'
                          : i === currentDuel
                          ? 'w-3.5 h-2 bg-alias-green/70'
                          : 'w-2 h-2 bg-border/50'
                      }`} />
                    ))}
                    <span className="text-[10px] font-mono text-muted-foreground/40 ml-1">
                      {currentDuel + 1}/{DUELS.length}
                    </span>
                  </div>
                </div>
                <p className="text-[14px] font-mono uppercase tracking-[0.18em] text-muted-foreground/50">{duel.tag}</p>
                <p className="text-[15px] font-semibold text-foreground mt-0.5">{duel.question}</p>
                <p className="text-[10px] text-muted-foreground/40 font-mono mt-0.5">5 duels. No essays. Just pick.</p>
              </div>

              {/* Duel cards */}
              <div key={currentDuel} className="p-4 flex items-stretch gap-3">
                {duel.options.map((opt, optIdx) => (
                  <>
                    <button
                      key={opt.value}
                      id={`duel-${currentDuel}-${opt.value}`}
                      onClick={() => handleDuelSelect(duel.key, opt.value)}
                      className="group flex-1 rounded-lg border border-border/40 bg-card/40 overflow-hidden hover:border-alias-green/60 hover:bg-alias-green/5 transition-all active:scale-[0.97] text-left"
                    >
                      {/* Visual preview */}
                      <div className="border-b border-border/30 bg-card/60 group-hover:bg-card/80 transition-colors">
                        {opt.preview}
                      </div>
                      {/* Label */}
                      <div className="px-3 py-2.5">
                        <span className="block text-[14px] font-mono font-semibold uppercase tracking-[0.1em] text-foreground/90 group-hover:text-foreground transition-colors leading-none mb-0.5">
                          {opt.label}
                        </span>
                        <span className="block text-[10px] font-mono text-muted-foreground/45 normal-case tracking-normal group-hover:text-muted-foreground/65 transition-colors">
                          {opt.sub}
                        </span>
                      </div>
                    </button>
                    {optIdx === 0 && (
                      <div key="vs" className="flex items-center">
                        <span className="text-[10px] font-mono font-bold text-muted-foreground/30 uppercase tracking-widest">vs</span>
                      </div>
                    )}
                  </>
                ))}
              </div>

              {/* Footer nav */}
              <div className="px-4 pb-4 flex gap-2">
                <button
                  onClick={() => {
                    if (currentDuel === 0) { setStep('objective'); } else { setCurrentDuel(currentDuel - 1); }
                  }}
                  className="flex-1 py-2 rounded-lg border border-border/30 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40 hover:text-muted-foreground hover:border-border/60 transition-all"
                >
                  ← Back
                </button>
                <button onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-border/20 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/25 hover:text-muted-foreground/40 transition-all">
                  Cancel
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </main>
  );
}
