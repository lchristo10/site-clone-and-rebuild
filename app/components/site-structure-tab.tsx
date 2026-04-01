'use client';
import { useState, useCallback } from 'react';
import { PlannedPage, PlannedSection, SitePlan, AeoImportance } from '@/lib/types';

// ── Importance colour tokens ──────────────────────────────────────────────────

const IMPORTANCE: Record<AeoImportance, { bg: string; border: string; dot: string; label: string }> = {
  critical: {
    bg:     'bg-alias-green/8',
    border: 'border-alias-green/30',
    dot:    'bg-alias-green',
    label:  'Critical AEO',
  },
  important: {
    bg:     'bg-alias-amber/8',
    border: 'border-alias-amber/25',
    dot:    'bg-alias-amber',
    label:  'Important',
  },
  optional: {
    bg:     'bg-muted/20',
    border: 'border-border/30',
    dot:    'bg-muted-foreground/30',
    label:  'Optional',
  },
};

const SECTION_TYPES = ['hero', 'features', 'services', 'about', 'testimonials', 'faq', 'cta', 'generic'] as const;

// ── Status messages ───────────────────────────────────────────────────────────

type CellStatus = 'idle' | 'rebuilding' | 'done' | 'error';

// ── Cell editor ───────────────────────────────────────────────────────────────

interface CellEditorProps {
  section: PlannedSection;
  pageSlug: string;
  onSave: (updated: PlannedSection) => void;
  onDelete: () => void;
  onClose: () => void;
  status: CellStatus;
  error?: string;
}

function CellEditor({ section, onSave, onDelete, onClose, status, error }: CellEditorProps) {
  const [label, setLabel]           = useState(section.label);
  const [type, setType]             = useState(section.type);
  const [importance, setImportance] = useState<AeoImportance>(section.importance);
  const [rationale, setRationale]   = useState(section.rationale);

  return (
    <div className="absolute z-30 top-full left-0 mt-1 w-72 rounded-xl border border-border/60 bg-card shadow-2xl backdrop-blur-md p-4 space-y-3">
      {/* Label */}
      <div>
        <p className="text-[8px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50 mb-1">Label (2-4 words)</p>
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          maxLength={40}
          className="w-full bg-background border border-border/40 rounded px-2 py-1.5 text-[11px] font-mono text-foreground focus:outline-none focus:border-alias-green/40"
        />
      </div>

      {/* Section type */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[8px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50 mb-1">Type</p>
          <select
            value={type}
            onChange={e => setType(e.target.value as PlannedSection['type'])}
            className="w-full bg-background border border-border/40 rounded px-2 py-1.5 text-[11px] font-mono text-foreground focus:outline-none focus:border-alias-green/40"
          >
            {SECTION_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-[8px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50 mb-1">AEO Importance</p>
          <select
            value={importance}
            onChange={e => setImportance(e.target.value as AeoImportance)}
            className="w-full bg-background border border-border/40 rounded px-2 py-1.5 text-[11px] font-mono text-foreground focus:outline-none focus:border-alias-green/40"
          >
            <option value="critical">Critical</option>
            <option value="important">Important</option>
            <option value="optional">Optional</option>
          </select>
        </div>
      </div>

      {/* Rationale */}
      <div>
        <p className="text-[8px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50 mb-1">AEO Rationale</p>
        <textarea
          value={rationale}
          onChange={e => setRationale(e.target.value)}
          rows={2}
          className="w-full bg-background border border-border/40 rounded px-2 py-1.5 text-[10px] font-mono text-foreground resize-none focus:outline-none focus:border-alias-green/40"
        />
      </div>

      {/* Status */}
      {status === 'rebuilding' && (
        <p className="text-[9px] font-mono text-alias-amber animate-pulse">⟳ Rebuilding page…</p>
      )}
      {status === 'done' && (
        <p className="text-[9px] font-mono text-alias-green">✓ Page rebuilt &amp; preview updated</p>
      )}
      {status === 'error' && (
        <p className="text-[9px] font-mono text-alias-red">✗ {error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ type, label, rationale, importance })}
          disabled={status === 'rebuilding' || !label.trim()}
          className="flex-1 py-1.5 text-[9px] font-mono uppercase tracking-wider rounded border border-alias-green text-alias-green bg-alias-green/5 hover:bg-alias-green/15 disabled:opacity-40 transition-colors"
        >
          {status === 'rebuilding' ? '⟳ Rebuilding…' : '◈ Save & Rebuild'}
        </button>
        <button
          onClick={onDelete}
          disabled={status === 'rebuilding'}
          title="Remove this section (will rebuild page)"
          className="px-2.5 py-1.5 text-[9px] font-mono rounded border border-alias-red/30 text-alias-red/60 hover:text-alias-red hover:border-alias-red/60 disabled:opacity-40 transition-colors"
        >
          ✕
        </button>
        <button
          onClick={onClose}
          className="px-2.5 py-1.5 text-[9px] font-mono rounded border border-border/40 text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}

// ── Grid cell ─────────────────────────────────────────────────────────────────

interface GridCellProps {
  section: PlannedSection;
  pageSlug: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onUpdate: (updated: PlannedSection) => Promise<void>;
  onDelete: () => Promise<void>;
}

function GridCell({ section, pageSlug, isOpen, onOpen, onClose, onUpdate, onDelete }: GridCellProps) {
  const [status, setStatus] = useState<CellStatus>('idle');
  const [error, setError]   = useState('');
  const imp = IMPORTANCE[section.importance];

  const handleSave = async (updated: PlannedSection) => {
    setStatus('rebuilding');
    setError('');
    try {
      await onUpdate(updated);
      setStatus('done');
      setTimeout(() => { setStatus('idle'); onClose(); }, 1800);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleDelete = async () => {
    setStatus('rebuilding');
    try {
      await onDelete();
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={isOpen ? onClose : onOpen}
        className={`w-full text-left rounded-lg border p-2 transition-all duration-150 group ${imp.bg} ${imp.border}
          ${isOpen ? 'ring-1 ring-alias-green/40' : 'hover:brightness-110'}
          ${status === 'rebuilding' ? 'opacity-60 animate-pulse' : ''}
          ${status === 'done' ? 'ring-1 ring-alias-green' : ''}`}
      >
        <div className="flex items-start gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${imp.dot}`} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono font-semibold text-foreground/85 leading-snug truncate">
              {section.label}
            </p>
            <p className="text-[8px] font-mono text-muted-foreground/50 capitalize mt-0.5">{section.type}</p>
          </div>
        </div>
      </button>

      {isOpen && (
        <CellEditor
          section={section}
          pageSlug={pageSlug}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={onClose}
          status={status}
          error={error}
        />
      )}
    </div>
  );
}

// ── Page column header ────────────────────────────────────────────────────────

interface PageHeaderProps {
  page: PlannedPage;
  canDelete: boolean;
  onDelete: () => Promise<void>;
}

function PageHeader({ page, canDelete, onDelete }: PageHeaderProps) {
  const [deleting, setDeleting]   = useState(false);
  const [confirm, setConfirm]     = useState(false);
  const criticalCount = page.sections.filter(s => s.importance === 'critical').length;

  const handleDelete = async () => {
    if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3000); return; }
    setDeleting(true);
    await onDelete();
  };

  return (
    <div className="pb-2 border-b border-border/30 mb-2">
      <div className="flex items-start justify-between gap-1">
        <div>
          <p className="text-[11px] font-mono font-semibold text-foreground/90 capitalize">{page.title}</p>
          <p className="text-[8px] font-mono text-muted-foreground/50 mt-0.5">
            {criticalCount} critical · {page.sections.length} total
          </p>
        </div>
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            title={confirm ? 'Click again to confirm' : 'Delete this page'}
            className={`text-[8px] font-mono px-1.5 py-0.5 rounded border transition-colors flex-shrink-0 ${
              confirm
                ? 'border-alias-red/60 text-alias-red bg-alias-red/10'
                : 'border-border/30 text-muted-foreground/30 hover:text-alias-red hover:border-alias-red/30'
            } ${deleting ? 'opacity-50' : ''}`}
          >
            {deleting ? '…' : confirm ? 'Confirm' : '✕'}
          </button>
        )}
      </div>
      {page.intent && (
        <p className="text-[8px] font-mono text-muted-foreground/40 mt-1 leading-snug line-clamp-2">{page.intent}</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface SiteStructureTabProps {
  jobId: string;
  sitePlan: SitePlan;
  onPlanChange: (plan: SitePlan) => void;
  onPageRebuilt: (slug: string) => void;
}

export function SiteStructureTab({ jobId, sitePlan, onPlanChange, onPageRebuilt }: SiteStructureTabProps) {
  // openCell: `${pageSlug}::${sectionIndex}`
  const [openCell, setOpenCell] = useState<string | null>(null);

  const closeCell = useCallback(() => setOpenCell(null), []);

  // ── Delete page ─────────────────────────────────────────────────────────────
  const handleDeletePage = useCallback(async (slug: string) => {
    const res = await fetch(`/api/clone/plan/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-page', slug }),
    });
    if (!res.ok) {
      const err = await res.json() as { error?: string };
      throw new Error(err.error ?? 'Delete failed');
    }
    const data = await res.json() as { sitePlan: SitePlan };
    onPlanChange(data.sitePlan);
    // The page is gone — parent will remove it from the preview nav too
    onPageRebuilt(slug);
  }, [jobId, onPlanChange, onPageRebuilt]);

  // ── Update section ─────────────────────────────────────────────────────────
  const handleUpdateSection = useCallback(async (
    pageSlug: string,
    sectionIndex: number,
    updated: PlannedSection,
  ) => {
    const page = sitePlan.pages.find(p => p.slug === pageSlug);
    if (!page) return;

    const updatedPage: PlannedPage = {
      ...page,
      sections: page.sections.map((s, i) => i === sectionIndex ? updated : s),
    };

    const res = await fetch(`/api/clone/plan/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-page', page: updatedPage }),
    });

    if (!res.ok) {
      const err = await res.json() as { error?: string };
      throw new Error(err.error ?? 'Update failed');
    }
    const data = await res.json() as { sitePlan: SitePlan };
    onPlanChange(data.sitePlan);
    onPageRebuilt(pageSlug);
  }, [jobId, sitePlan, onPlanChange, onPageRebuilt]);

  // ── Delete section ─────────────────────────────────────────────────────────
  const handleDeleteSection = useCallback(async (pageSlug: string, sectionIndex: number) => {
    const page = sitePlan.pages.find(p => p.slug === pageSlug);
    if (!page) return;

    const updatedPage: PlannedPage = {
      ...page,
      sections: page.sections.filter((_, i) => i !== sectionIndex),
    };

    const res = await fetch(`/api/clone/plan/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-page', page: updatedPage }),
    });

    if (!res.ok) {
      const err = await res.json() as { error?: string };
      throw new Error(err.error ?? 'Delete section failed');
    }
    const data = await res.json() as { sitePlan: SitePlan };
    onPlanChange(data.sitePlan);
    onPageRebuilt(pageSlug);
  }, [jobId, sitePlan, onPlanChange, onPageRebuilt]);

  const maxSections = Math.max(...sitePlan.pages.map(p => p.sections.length), 0);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-full">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground">AEO Site Structure</span>
              <span className="text-[8px] font-mono px-2 py-0.5 rounded border border-alias-green/30 text-alias-green bg-alias-green/5 uppercase tracking-wider">
                Tactical Grid
              </span>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground/40 mt-1">
              Click any cell to edit. Changes rebuild only that page — all others stay untouched.
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {(Object.entries(IMPORTANCE) as [AeoImportance, typeof IMPORTANCE[AeoImportance]][]).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${val.dot}`} />
                <span className="text-[8px] font-mono text-muted-foreground/50">{val.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Grid — explicit row placement keeps cells aligned across all columns */}
        <div
          className="grid gap-x-4 min-w-0"
          style={{
            gridTemplateColumns: `repeat(${sitePlan.pages.length}, minmax(180px, 1fr))`,
            gridTemplateRows: `auto${Array.from({ length: maxSections }).map(() => ' auto').join('')}`,
          }}
        >
          {/* Row 1: all page headers in the same row track */}
          {sitePlan.pages.map((page, colIdx) => (
            <div
              key={`hdr-${page.slug}`}
              style={{ gridColumn: colIdx + 1, gridRow: 1 }}
              className="pb-2 border-b border-border/30 mb-2"
            >
              <PageHeader
                page={page}
                canDelete={page.slug !== 'home'}
                onDelete={() => handleDeletePage(page.slug)}
              />
            </div>
          ))}

          {/* Rows 2..N+1: section cells — same rowIdx = same vertical track */}
          {sitePlan.pages.map((page, colIdx) =>
            Array.from({ length: maxSections }).map((_, rowIdx) => {
              const section = page.sections[rowIdx];
              const cellKey = section ? `${page.slug}::${rowIdx}` : null;
              return (
                <div
                  key={`${page.slug}-row-${rowIdx}`}
                  style={{ gridColumn: colIdx + 1, gridRow: rowIdx + 2 }}
                  className="mb-1.5"
                >
                  {section ? (
                    <GridCell
                      section={section}
                      pageSlug={page.slug}
                      isOpen={openCell === cellKey}
                      onOpen={() => setOpenCell(cellKey!)}
                      onClose={closeCell}
                      onUpdate={updated => handleUpdateSection(page.slug, rowIdx, updated)}
                      onDelete={() => handleDeleteSection(page.slug, rowIdx)}
                    />
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/20 p-2 min-h-[46px]" />
                  )}
                </div>
              );
            })
          )}
        </div>


        {/* Footer note */}
        <p className="text-[8px] font-mono text-muted-foreground/25 mt-6 text-center">
          Generated at {new Date(sitePlan.generatedAt).toLocaleString()} ·
          {' '}{sitePlan.pages.reduce((t, p) => t + p.sections.filter(s => s.importance === 'critical').length, 0)} critical AEO sections across {sitePlan.pages.length} page{sitePlan.pages.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
