'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type Props = { params: Promise<{ jobId: string }> };

interface PageSummary { slug: string; title: string; status: string; }
interface CodeFile { name: string; language: 'tsx' | 'ts' | 'css'; content: string; }

// ── Lightweight syntax highlighter ────────────────────────────────────────────

function highlight(code: string, lang: string): string {
  // Escape HTML entities
  let out = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (lang === 'css') {
    out = out
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>')
      .replace(/(@[\w-]+)/g, '<span class="hl-keyword">$1</span>')
      .replace(/(--[\w-]+)/g, '<span class="hl-var">$1</span>')
      .replace(/(#[0-9a-fA-F]{3,8})\b/g, '<span class="hl-string">$1</span>')
      .replace(/([a-z-]+)(\s*:)(?!:)/g, '<span class="hl-attr">$1</span>$2');
    return out;
  }

  // TSX / TS
  out = out
    // Comments first
    .replace(/(\/\/[^\n]*)/g, '<span class="hl-comment">$1</span>')
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>')
    // Strings & template literals
    .replace(/(`[^`]*`)/g, '<span class="hl-string">$1</span>')
    .replace(/('[^']*')/g, '<span class="hl-string">$1</span>')
    .replace(/("[^"]*")/g, '<span class="hl-string">$1</span>')
    // JSX tags
    .replace(/(&lt;\/?)([\w.]+)/g, '<span class="hl-tag">$1$2</span>')
    // Keywords
    .replace(/\b(import|export|from|default|const|let|var|function|return|type|interface|extends|implements|async|await|if|else|for|of|in|new|class|null|undefined|true|false)\b/g,
      '<span class="hl-keyword">$1</span>')
    // Numbers
    .replace(/\b(\d+)\b/g, '<span class="hl-number">$1</span>')
    // Attributes (prop=)
    .replace(/\b([\w]+)(=\{|=&quot;)/g, '<span class="hl-attr">$1</span>$2');

  return out;
}

const FILE_ICONS: Record<string, string> = {
  tsx: '⚛',
  ts:  'TS',
  css: '🎨',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CodeViewPage({ params }: Props) {
  const { jobId } = use(params);
  const [pages, setPages]         = useState<PageSummary[]>([]);
  const [activePage, setActivePage] = useState('home');
  const [files, setFiles]         = useState<CodeFile[]>([]);
  const [activeFile, setActiveFile] = useState<string>('');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [copied, setCopied]       = useState(false);

  // Load page list
  useEffect(() => {
    fetch(`/api/clone/status/${jobId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.pages?.length > 0) {
          setPages(data.pages.filter((p: PageSummary) => p.status === 'done'));
        }
      })
      .catch(() => {});
  }, [jobId]);

  // Load files when active page changes
  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/clone/code/${jobId}?page=${activePage}`)
      .then(r => r.ok ? r.json() : r.json().then((e: { error?: string }) => Promise.reject(e.error ?? 'Failed')))
      .then((data: { files: CodeFile[] }) => {
        setFiles(data.files);
        setActiveFile(data.files[0]?.name ?? '');
        setLoading(false);
      })
      .catch((err: string) => {
        setError(typeof err === 'string' ? err : 'Could not load source files');
        setLoading(false);
      });
  }, [jobId, activePage]);

  const activeFileData = files.find(f => f.name === activeFile);

  const copyCode = useCallback(() => {
    if (!activeFileData) return;
    navigator.clipboard.writeText(activeFileData.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [activeFileData]);

  const lineCount = activeFileData?.content.split('\n').length ?? 0;

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/90 backdrop-blur-md gap-3">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">ALIAS</span>
          <span className="text-muted-foreground/30 mx-1">·</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-alias-green">COMPILER</span>
        </Link>

        {/* Page switcher */}
        {pages.length > 1 && (
          <div className="flex items-center gap-1 flex-wrap">
            {pages.map(p => (
              <button
                key={p.slug}
                onClick={() => setActivePage(p.slug)}
                className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded border transition-all ${
                  activePage === p.slug
                    ? 'bg-alias-green text-background border-alias-green font-bold'
                    : 'text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
                }`}
              >
                {p.title}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-mono text-muted-foreground/40 hidden sm:block">
            {lineCount.toLocaleString()} lines
          </span>
          <button
            onClick={copyCode}
            disabled={!activeFileData}
            className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground rounded hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-30"
          >
            {copied ? '✓ Copied' : '⧉ Copy'}
          </button>
          <a
            href={`/preview/${jobId}`}
            className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground rounded hover:text-foreground hover:border-foreground/30 transition-all"
          >
            ◈ Preview
          </a>
          <a
            href={`/api/clone/download/${jobId}`}
            className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground rounded hover:text-foreground hover:border-foreground/30 transition-all"
          >
            ↓ ZIP
          </a>
          <Link
            href={`/clone/${jobId}`}
            className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border border-border text-muted-foreground rounded hover:text-foreground hover:border-foreground/30 transition-all"
          >
            ← Pipeline
          </Link>
        </div>
      </nav>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 pt-[49px] flex overflow-hidden" style={{ height: 'calc(100vh - 49px)' }}>

        {/* File tree sidebar */}
        <aside className="w-52 flex-shrink-0 border-r border-border/30 bg-card/50 flex flex-col overflow-y-auto">
          <div className="px-3 py-2 border-b border-border/20">
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground/50">Files</p>
          </div>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[10px] font-mono text-muted-foreground/40 animate-pulse">Loading...</span>
            </div>
          ) : error ? (
            <div className="p-3">
              <p className="text-[10px] font-mono text-alias-red">{error}</p>
              <p className="text-[10px] font-mono text-muted-foreground/40 mt-2">
                Run the pipeline first to generate code.
              </p>
            </div>
          ) : (
            <ul className="py-1">
              {files.map(f => {
                const parts = f.name.split('/');
                const filename = parts[parts.length - 1];
                const dir = parts.slice(0, -1).join('/');
                return (
                  <li key={f.name}>
                    {dir && (
                      <div className="px-3 pt-3 pb-0.5">
                        <p className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-widest truncate">{dir}/</p>
                      </div>
                    )}
                    <button
                      onClick={() => setActiveFile(f.name)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-2 transition-colors ${
                        activeFile === f.name
                          ? 'bg-alias-green/10 text-alias-green border-r-2 border-alias-green'
                          : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
                      }`}
                    >
                      <span className="text-[10px] font-mono opacity-60 flex-shrink-0">
                        {FILE_ICONS[f.language] ?? f.language}
                      </span>
                      <span className="text-[10px] font-mono truncate">{filename}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Editor pane */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Tab bar */}
          {activeFileData && (
            <div className="border-b border-border/30 bg-card/30 flex items-center px-0 flex-shrink-0">
              <div className="flex items-center gap-2 px-4 py-2 border-r border-border/20 bg-background/50">
                <span className="text-[10px] font-mono text-muted-foreground/50">
                  {FILE_ICONS[activeFileData.language]}
                </span>
                <span className="text-[10px] font-mono text-foreground/70">{activeFileData.name}</span>
              </div>
              <span className="ml-auto pr-4 text-[10px] font-mono text-muted-foreground/30">
                {activeFileData.language.toUpperCase()} · {lineCount.toLocaleString()} lines · utf-8
              </span>
            </div>
          )}

          {/* Code */}
          {!loading && !error && activeFileData ? (
            <div className="flex-1 overflow-auto bg-background">
              <style>{`
                pre { tab-size: 2; }
                .hl-keyword { color: oklch(0.68 0.18 290); }
                .hl-string  { color: oklch(0.78 0.14 55);  }
                .hl-comment { color: oklch(0.52 0.04 240); font-style: italic; }
                .hl-tag     { color: oklch(0.72 0.18 145); }
                .hl-attr    { color: oklch(0.72 0.16 220); }
                .hl-number  { color: oklch(0.75 0.12 35);  }
                .hl-var     { color: oklch(0.68 0.14 180); }
              `}</style>
              <div className="flex min-h-full">
                {/* Line numbers */}
                <div
                  className="select-none flex-shrink-0 text-right pr-4 pl-4 py-5 border-r border-border/15 bg-card/20"
                  aria-hidden="true"
                >
                  {activeFileData.content.split('\n').map((_, i) => (
                    <div key={i} className="text-[14px] font-mono text-muted-foreground/20 leading-5 h-5">
                      {i + 1}
                    </div>
                  ))}
                </div>
                {/* Code content */}
                <pre
                  className="flex-1 px-6 py-5 text-[14px] font-mono leading-5 overflow-x-auto text-foreground/80 whitespace-pre m-0"
                  dangerouslySetInnerHTML={{
                    __html: highlight(activeFileData.content, activeFileData.language),
                  }}
                />
              </div>
            </div>
          ) : !loading && !error ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm font-mono text-muted-foreground/40">Select a file</p>
            </div>
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="text-xl font-mono text-alias-green animate-terminal-blink">▶</div>
                <p className="text-[10px] font-mono text-muted-foreground">Generating TypeScript + Tailwind files...</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
