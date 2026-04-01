'use client';
import { useState, useCallback, useRef, useEffect } from 'react';

interface FeedbackBarProps {
  jobId: string;
  activePage: string;
  activeSections: string[];
  onApplied: () => void;
}

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

// Browser Speech API — declared locally to avoid lib dependency gaps
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string; confidence: number };
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

const SECTION_OPTIONS = ['hero', 'about', 'services', 'features', 'testimonials', 'faq', 'cta', 'footer'];

// ── Mic SVG icon (minimal, consistent with mono design) ──────────────────────
function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'w-3 h-3'}
      aria-hidden="true"
    >
      <rect x="5.5" y="1" width="5" height="8" rx="2.5" />
      <path d="M2.5 7.5A5.5 5.5 0 0 0 8 13a5.5 5.5 0 0 0 5.5-5.5" />
      <line x1="8" y1="13" x2="8" y2="15.5" />
    </svg>
  );
}

// ── Drag handle icon ──────────────────────────────────────────────────────────
function DragIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className ?? 'w-3 h-3'}
      aria-hidden="true"
    >
      {/* 2×3 dot grid */}
      {[3, 6, 9].map(y =>
        [4, 10].map(x => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={1.2} />
        ))
      )}
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FeedbackBar({ jobId, activePage, activeSections, onApplied }: FeedbackBarProps) {
  const [expanded, setExpanded]   = useState(false);
  const [feedback, setFeedback]   = useState('');
  const [section, setSection]     = useState('');
  const [status, setStatus]       = useState<SubmitStatus>('idle');
  const [errorMsg, setErrorMsg]   = useState('');
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  // Position — x/y are top-left corner of the bar
  const [pos, setPos]       = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragOffset          = useRef<{ ox: number; oy: number }>({ ox: 0, oy: 0 });
  const barRef              = useRef<HTMLDivElement>(null);
  const textareaRef         = useRef<HTMLTextAreaElement>(null);
  const recognitionRef      = useRef<ISpeechRecognition | null>(null);

  // Set initial position bottom-center on mount
  useEffect(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    setPos({ x: Math.round(w / 2 - 180), y: Math.round(h - 84) });
  }, []);

  // Check voice support
  useEffect(() => {
    setVoiceSupported(!!(window.SpeechRecognition ?? window.webkitSpeechRecognition));
  }, []);

  // Auto-focus textarea when expanded
  useEffect(() => {
    if (expanded && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [expanded]);

  const sectionOptions = activeSections.length > 0
    ? [...new Set([...activeSections, ...SECTION_OPTIONS])]
    : SECTION_OPTIONS;

  // ── Drag handlers ───────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    // Ignore if inside interactive elements
    const tag = (e.target as HTMLElement).tagName;
    if (['BUTTON', 'TEXTAREA', 'SELECT', 'INPUT'].includes(tag)) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);

    const rect = barRef.current?.getBoundingClientRect();
    dragOffset.current = {
      ox: e.clientX - (rect?.left ?? 0),
      oy: e.clientY - (rect?.top ?? 0),
    };
  }, []);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    e.preventDefault();

    const maxX = window.innerWidth  - (barRef.current?.offsetWidth  ?? 360) - 8;
    const maxY = window.innerHeight - (barRef.current?.offsetHeight ?? 60)  - 8;

    setPos({
      x: Math.max(8, Math.min(maxX, e.clientX - dragOffset.current.ox)),
      y: Math.max(8, Math.min(maxY, e.clientY - dragOffset.current.oy)),
    });
  }, [dragging]);

  const handleDragEnd = useCallback(() => {
    setDragging(false);
  }, []);

  // ── Voice handlers ──────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;

    const rec: ISpeechRecognition = new SR();
    rec.lang = 'en-NZ';
    rec.interimResults = true;
    rec.continuous = false;

    rec.onstart = () => setListening(true);
    rec.onend   = () => { setListening(false); recognitionRef.current = null; };
    rec.onerror = () => { setListening(false); recognitionRef.current = null; };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let final = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final   += e.results[i][0].transcript;
        else                       interim += e.results[i][0].transcript;
      }
      const appended = (final || interim).trim();
      if (appended) setFeedback(prev => (prev ? `${prev.trimEnd()} ${appended}` : appended));
    };

    recognitionRef.current = rec;
    rec.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!feedback.trim()) return;
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch(`/api/clone/refine/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageSlug: activePage,
          sectionType: section || (activeSections[0] ?? 'hero'),
          instruction: feedback.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Failed to apply feedback');
      }

      setStatus('success');
      setFeedback('');
      setSection('');
      onApplied();
      setTimeout(() => { setStatus('idle'); setExpanded(false); }, 2000);

    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [feedback, jobId, activePage, section, activeSections, onApplied]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') setExpanded(false);
  }, [handleSubmit]);

  if (!pos) return null; // wait for mount to position

  return (
    <div
      ref={barRef}
      style={{ left: pos.x, top: pos.y, touchAction: dragging ? 'none' : 'auto' }}
      className="fixed z-40 select-none"
      onPointerMove={handleDragMove}
      onPointerUp={handleDragEnd}
      onPointerCancel={handleDragEnd}
    >
      {/* ── Collapsed pill ─────────────────────────────────────────────────── */}
      {!expanded && (
        <div
          onPointerDown={handleDragStart}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full
            bg-card/95 border border-border/60 shadow-lg backdrop-blur-md
            transition-all duration-200 group
            ${dragging ? 'cursor-grabbing shadow-2xl scale-[1.03]' : 'cursor-grab hover:border-foreground/30 hover:shadow-xl'}`}
        >
          {/* Drag grip */}
          <DragIcon className="w-2.5 h-2.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors flex-shrink-0" />

          {/* Click area to expand */}
          <button
            onPointerDown={e => e.stopPropagation()} // don't start drag on click
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-alias-green animate-pulse" />
            <span>Feedback</span>
            <span className="text-muted-foreground/30 normal-case tracking-normal text-[9px]">
              — click to edit
            </span>
          </button>

          {voiceSupported && (
            <MicIcon className="w-3 h-3 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors flex-shrink-0" />
          )}
        </div>
      )}

      {/* ── Expanded panel ─────────────────────────────────────────────────── */}
      {expanded && (
        <div
          className={`w-[360px] max-w-[92vw] rounded-2xl bg-card/98 border border-border/60 shadow-2xl backdrop-blur-md overflow-hidden ${
            dragging ? '' : 'transition-shadow duration-200'
          }`}
          style={{ boxShadow: dragging ? '0 24px 64px oklch(0 0 0 / 40%)' : undefined }}
        >
          {/* Drag handle / header */}
          <div
            onPointerDown={handleDragStart}
            className={`flex items-center justify-between pl-3 pr-4 pt-3 pb-2 gap-3 ${
              dragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <div className="flex items-center gap-2 flex-shrink-0">
              <DragIcon className="w-2.5 h-2.5 text-muted-foreground/30" />
              <span className="w-1.5 h-1.5 rounded-full bg-alias-green" />
              <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
                Page Feedback
              </span>
            </div>

            <div
              className="flex items-center gap-3"
              onPointerDown={e => e.stopPropagation()} // don't drag when interacting with controls
            >
              <select
                value={section}
                onChange={e => setSection(e.target.value)}
                disabled={status === 'loading'}
                className="text-[9px] font-mono bg-transparent border border-border/40 rounded-md px-2 py-1
                  text-muted-foreground focus:outline-none focus:border-alias-green/40
                  hover:border-border transition-colors cursor-pointer disabled:opacity-50"
              >
                <option value="">All sections</option>
                {sectionOptions.map(s => (
                  <option key={s} value={s} className="capitalize">{s}</option>
                ))}
              </select>
              <button
                onClick={() => setExpanded(false)}
                className="text-[9px] font-mono text-muted-foreground/40 hover:text-foreground transition-colors leading-none"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Input area */}
          <div className="px-4 pb-3">
            <div className={`relative rounded-xl border transition-all duration-200 ${
              listening
                ? 'border-alias-green/60 bg-alias-green/5 shadow-[0_0_0_2px_oklch(0.72_0.2_145_/_12%)]'
                : 'border-border/40 bg-muted/20 focus-within:border-alias-green/40'
            }`}>
              <textarea
                ref={textareaRef}
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  listening
                    ? 'Listening… speak your feedback'
                    : 'Describe a change — e.g. "Make the hero heading more direct" or "Add a testimonial about fast response times"'
                }
                rows={5}
                disabled={status === 'loading'}
                className="w-full bg-transparent px-4 pt-3 pb-2 text-sm font-mono text-foreground
                  resize-none focus:outline-none placeholder:text-muted-foreground/30
                  placeholder:text-xs placeholder:font-sans disabled:opacity-60 leading-relaxed"
              />

              {/* Live recording indicator */}
              {listening && (
                <div className="absolute top-2.5 right-3 flex items-center gap-1.5 pointer-events-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-alias-green animate-ping" />
                  <span className="text-[8px] font-mono text-alias-green uppercase tracking-wider">rec</span>
                </div>
              )}
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between mt-2.5">
              <div className="flex items-center gap-2.5">
                {voiceSupported && (
                  <button
                    onClick={listening ? stopListening : startListening}
                    disabled={status === 'loading'}
                    title={listening ? 'Stop recording' : 'Voice input'}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[9px] font-mono
                      uppercase tracking-wider transition-all disabled:opacity-40 ${
                      listening
                        ? 'border-alias-green bg-alias-green/10 text-alias-green'
                        : 'border-border/40 text-muted-foreground/60 hover:border-border hover:text-foreground'
                    }`}
                  >
                    <MicIcon className={`w-3 h-3 ${listening ? 'animate-pulse' : ''}`} />
                    <span>{listening ? 'Stop' : 'Voice'}</span>
                  </button>
                )}

                {feedback.length > 0 && (
                  <span className="text-[9px] font-mono text-muted-foreground/30">
                    {feedback.length} chars
                  </span>
                )}

                <span className="text-[8px] font-mono text-muted-foreground/20 hidden sm:block">
                  ⌘↵ to apply
                </span>
              </div>

              <div className="flex items-center gap-2">
                {status === 'error' && (
                  <span className="text-[9px] font-mono text-alias-red max-w-[200px] truncate" title={errorMsg}>
                    ✗ {errorMsg}
                  </span>
                )}
                {status === 'success' && (
                  <span className="text-[9px] font-mono text-alias-green">✓ Applied</span>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!feedback.trim() || status === 'loading'}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg border text-[9px] font-mono
                    uppercase tracking-wider transition-all ${
                    status === 'loading'
                      ? 'border-alias-green/30 text-alias-green/50 bg-alias-green/5 cursor-wait'
                      : status === 'success'
                      ? 'border-alias-green bg-alias-green/10 text-alias-green'
                      : 'border-alias-green text-alias-green bg-alias-green/5 hover:bg-alias-green/15 disabled:opacity-30 disabled:cursor-not-allowed'
                  }`}
                >
                  {status === 'loading' ? (
                    <><span className="inline-block animate-spin">⟳</span> Applying…</>
                  ) : status === 'success' ? '✓ Done' : '✦ Apply'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
