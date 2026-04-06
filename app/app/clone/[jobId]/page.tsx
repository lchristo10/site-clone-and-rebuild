import { Metadata } from 'next';
import Link from 'next/link';
import { TerminalLog } from '@/components/terminal-log';

type Props = { params: Promise<{ jobId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { jobId } = await params;
  return {
    title: `ALIAS COMPILER — Pipeline [${jobId.slice(0, 8)}]`,
  };
}

export default async function ClonePage({ params }: Props) {
  const { jobId } = await params;

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-border/30 bg-background/80 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">ALIAS</span>
          <span className="text-muted-foreground/40 mx-1">·</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-alias-green">COMPILER</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/40 hidden sm:block">
            Pipeline
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/60 bg-card border border-border px-2 py-1 rounded">
            {jobId.slice(0, 8)}
          </span>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 pt-20 pb-6 px-6 flex flex-col">
        <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-alias-green animate-pulse" />
            <h1 className="text-sm font-mono uppercase tracking-[0.2em] text-foreground">
              AEO Pipeline Running
            </h1>
          </div>

          {/* Terminal */}
          <div className="flex-1 min-h-0" style={{ minHeight: 'calc(100vh - 160px)' }}>
            <TerminalLog jobId={jobId} />
          </div>
        </div>
      </div>
    </main>
  );
}
