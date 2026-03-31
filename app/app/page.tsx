'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface RecentJob {
  jobId: string;
  url: string;
  createdAt: number;
}

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('alias-compiler-jobs');
      if (stored) setRecentJobs(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/clone/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to start clone job');
        setLoading(false);
        return;
      }

      // Persist to localStorage
      const job: RecentJob = { jobId: data.jobId, url: data.url, createdAt: Date.now() };
      const updated = [job, ...recentJobs].slice(0, 5);
      localStorage.setItem('alias-compiler-jobs', JSON.stringify(updated));

      router.push(`/clone/${data.jobId}`);
    } catch {
      setError('Network error — please try again');
      setLoading(false);
    }
  };

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
          <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50 hidden sm:block">
            Clone · Analyze · Rebuild · Optimize
          </span>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pt-24 pb-16 relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-100 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(oklch(0 0 0 / 4%) 1px, transparent 1px),
              linear-gradient(90deg, oklch(0 0 0 / 4%) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Subtle green glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full opacity-[0.06] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, oklch(0.52 0.18 145) 0%, transparent 70%)' }}
        />
        <div className="scanlines absolute inset-0 pointer-events-none opacity-20" />

        <div className="relative z-10 w-full max-w-3xl flex flex-col items-center text-center gap-6">
          {/* Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-alias-green/30 bg-alias-green-dim">
            <span className="w-1.5 h-1.5 rounded-full bg-alias-green animate-pulse" />
            <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-alias-green">AEO-First Rebuild Engine</span>
          </div>

          {/* Headline */}
          <div className="space-y-2">
            <h1 className="text-[clamp(2.5rem,8vw,6rem)] font-bold leading-none tracking-tighter text-foreground">
              ALIAS<br />
              <span className="text-muted-foreground/40">COMPILER</span>
            </h1>
            <p className="text-sm font-mono text-muted-foreground tracking-wider uppercase">
              Clone · Refactor · Optimise for AI
            </p>
          </div>

          {/* Sub-copy */}
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            Enter any public URL. ALIAS extracts the design system, rebuilds the site
            with semantic HTML5, Schema.org structured data, and AEO-optimised copy —
            then audits it with a simulated AI crawler.
          </p>

          {/* Input form */}
          <form onSubmit={handleSubmit} className="w-full max-w-xl mt-2">
            <div className="input-glow flex rounded-lg border border-border/60 bg-card overflow-hidden transition-all">
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 bg-transparent px-4 py-4 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 outline-none"
                disabled={loading}
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="px-6 py-4 bg-alias-green text-background text-xs font-mono uppercase tracking-[0.2em] font-bold transition-all hover:bg-alias-green/90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex-shrink-0"
              >
                {loading ? (
                  <span className="animate-terminal-blink">▶</span>
                ) : (
                  '▶ RUN'
                )}
              </button>
            </div>

            {error && (
              <p className="mt-2 text-[11px] font-mono text-alias-red text-left px-1">✗ {error}</p>
            )}
            <p className="mt-2 text-[10px] font-mono text-muted-foreground/40 text-left px-1">
              Powered by Firecrawl + Gemini 2.0 Flash. Any public URL works.
            </p>
          </form>

          {/* Pipeline steps */}
          <div className="flex items-center gap-2 flex-wrap justify-center mt-4">
            {[
              { step: '01', label: 'Extract', desc: 'Firecrawl scrapes HTML + screenshot' },
              { step: '02', label: 'Analyze', desc: 'Gemini Vision reads design tokens' },
              { step: '03', label: 'Draft', desc: 'AEO content outline + Schema.org' },
              { step: '04', label: 'Synthesize', desc: 'Semantic HTML + CSS assembly' },
              { step: '05', label: 'Audit', desc: 'Simulated AI crawler score' },
            ].map((item, i) => (
              <div key={item.step} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1 px-3 py-2 rounded border border-border/40 bg-card/50 min-w-[80px]">
                  <span className="text-[8px] font-mono text-alias-green/60 tracking-widest">{item.step}</span>
                  <span className="text-[11px] font-mono uppercase tracking-wide text-foreground/80">{item.label}</span>
                  <span className="text-[8px] font-mono text-muted-foreground/50 text-center leading-tight hidden sm:block">{item.desc}</span>
                </div>
                {i < 4 && <span className="text-muted-foreground/20 text-xs hidden sm:block">→</span>}
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
              <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-muted-foreground">Recent Jobs</p>
              <button
                onClick={() => {
                  setRecentJobs([]);
                  localStorage.removeItem('alias-compiler-jobs');
                }}
                className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40 hover:text-alias-red transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <a
                  key={job.jobId}
                  href={`/clone/${job.jobId}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/30 hover:bg-card hover:border-border/80 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[9px] font-mono text-alias-green/60">◈</span>
                    <span className="text-[11px] font-mono text-foreground/70 truncate group-hover:text-foreground transition-colors">
                      {job.url}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground/40 flex-shrink-0 ml-4">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-border/20 text-center">
        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/40">
          ALIAS COMPILER · AEO Rebuild Engine · {new Date().getFullYear()}
        </p>
      </footer>
    </main>
  );
}
