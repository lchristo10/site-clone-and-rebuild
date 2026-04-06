'use client';
import { useState, useRef } from 'react';
import { DesignTokens, EntityMap } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EditableColor {
  key: string;   // unique id
  label: string; // display name
  hex: string;   // #rrggbb
  readonly?: boolean; // true for the 5 core tokens
}

interface TokenPreviewProps {
  tokens: DesignTokens;
  entityMap: EntityMap;
  onColorsChange?: (colors: EditableColor[]) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidHex(v: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
}

function normalizeHex(v: string): string {
  const t = v.trim();
  if (!t.startsWith('#')) return '#' + t;
  return t;
}

// Luminance-based readable text on swatch
function swatchTextColor(hex: string): string {
  try {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16) / 255;
    const g = parseInt(c.substring(2, 4), 16) / 255;
    const b = parseInt(c.substring(4, 6), 16) / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.45 ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.85)';
  } catch {
    return 'rgba(255,255,255,0.85)';
  }
}

// ── Swatch row component ──────────────────────────────────────────────────────

interface SwatchRowProps {
  item: EditableColor;
  onDelete: () => void;
  onHexChange: (hex: string) => void;
}

function SwatchRow({ item, onDelete, onHexChange }: SwatchRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.hex);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commitEdit = () => {
    const norm = normalizeHex(draft);
    if (isValidHex(norm)) {
      onHexChange(norm);
      setDraft(norm);
      setError(false);
    } else {
      setError(true);
      setDraft(item.hex); // revert
    }
    setEditing(false);
  };

  return (
    <div className="group flex items-center gap-2 py-0.5">
      {/* Swatch chip — click to edit */}
      <button
        title={editing ? undefined : `Click to edit ${item.hex}`}
        onClick={() => { setEditing(true); setDraft(item.hex); setTimeout(() => inputRef.current?.select(), 30); }}
        className="w-6 h-6 rounded border border-white/10 flex-shrink-0 transition-all group-hover:scale-110 group-hover:shadow-md relative overflow-hidden"
        style={{ background: item.hex }}
      >
        {/* tiny pencil overlay on hover */}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
          style={{ color: swatchTextColor(item.hex) }}>
          ✎
        </span>
      </button>

      {/* Label + hex */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground leading-none mb-0.5">{item.label}</p>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => { setDraft(e.target.value); setError(false); }}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditing(false); setDraft(item.hex); } }}
            className={`text-[10px] font-mono bg-transparent border-b outline-none w-full transition-colors ${
              error ? 'border-alias-red text-alias-red' : 'border-alias-green text-alias-green'
            }`}
            maxLength={7}
            autoFocus
          />
        ) : (
          <p className="text-[10px] font-mono text-foreground/70">{item.hex}</p>
        )}
      </div>

      {/* Native color picker (hidden, synced) */}
      <label title="Pick colour" className="cursor-pointer opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity flex-shrink-0">
        <input
          type="color"
          value={item.hex.length === 7 ? item.hex : '#000000'}
          onChange={e => { onHexChange(e.target.value); setDraft(e.target.value); }}
          className="w-0 h-0 opacity-0 absolute"
        />
        <span className="text-[10px] text-muted-foreground/60">◉</span>
      </label>

      {/* Delete */}
      <button
        title="Remove token"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-alias-red transition-opacity flex-shrink-0 text-[14px] font-mono leading-none"
      >
        ✕
      </button>
    </div>
  );
}

// ── Add new swatch row ────────────────────────────────────────────────────────

interface AddSwatchRowProps {
  onAdd: (hex: string, label: string) => void;
}

function AddSwatchRow({ onAdd }: AddSwatchRowProps) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState('#');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const hexRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const norm = normalizeHex(hex);
    if (!isValidHex(norm)) { setError('Invalid hex'); return; }
    onAdd(norm, label.trim() || 'Custom');
    setHex('#');
    setLabel('');
    setError('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => hexRef.current?.focus(), 30); }}
        className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40 hover:text-alias-green transition-colors mt-1 w-full py-0.5"
      >
        <span className="text-alias-green/40 text-sm">+</span> Add Color Token
      </button>
    );
  }

  return (
    <div className="mt-1 flex flex-col gap-1.5 p-2 rounded-lg border border-alias-green/20 bg-alias-green/5">
      <div className="flex items-center gap-2">
        {/* Live preview swatch */}
        <div
          className="w-5 h-5 rounded border border-white/10 flex-shrink-0 transition-colors"
          style={{ background: isValidHex(normalizeHex(hex)) ? normalizeHex(hex) : '#333' }}
        />
        {/* Inputs */}
        <input
          ref={hexRef}
          value={hex}
          onChange={e => { setHex(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setOpen(false); }}
          placeholder="#rrggbb"
          maxLength={7}
          className="flex-1 bg-transparent text-[10px] font-mono text-foreground/80 placeholder:text-muted-foreground/30 outline-none border-b border-border/40 focus:border-alias-green/60 transition-colors"
        />
        {/* Browser color picker */}
        <label className="cursor-pointer text-muted-foreground/40 hover:text-alias-green transition-colors text-[10px]" title="Pick colour">
          <input type="color" value={isValidHex(normalizeHex(hex)) ? normalizeHex(hex) : '#000000'}
            onChange={e => setHex(e.target.value)} className="w-0 h-0 opacity-0 absolute" />
          ◉
        </label>
      </div>

      <input
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setOpen(false); }}
        placeholder="Label (e.g. Warm Accent)"
        className="bg-transparent text-[10px] font-mono text-foreground/80 placeholder:text-muted-foreground/30 outline-none border-b border-border/40 focus:border-alias-green/60 transition-colors w-full"
      />

      {error && <p className="text-[10px] font-mono text-alias-red">{error}</p>}

      <div className="flex gap-2 mt-0.5">
        <button onClick={commit}
          className="flex-1 text-[10px] font-mono uppercase tracking-wider text-alias-green border border-alias-green/40 rounded py-1 hover:bg-alias-green/10 transition-colors">
          + Add
        </button>
        <button onClick={() => setOpen(false)}
          className="px-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/40 border border-border/30 rounded py-1 hover:border-border/60 hover:text-muted-foreground transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main TokenPreview ─────────────────────────────────────────────────────────

export function TokenPreview({ tokens, entityMap, onColorsChange }: TokenPreviewProps) {
  const { colors, typography, spacing, layout } = tokens;

  // Initialise editable color list from the 5 core tokens
  const [colorList, setColorList] = useState<EditableColor[]>(() => [
    { key: 'primary',   label: 'Primary',   hex: colors.primary,   readonly: true },
    { key: 'secondary', label: 'Secondary', hex: colors.secondary, readonly: true },
    { key: 'surface',   label: 'Surface',   hex: colors.surface,   readonly: true },
    { key: 'accent',    label: 'Accent',    hex: colors.accent,    readonly: true },
    { key: 'text',      label: 'Text',      hex: colors.text,      readonly: true },
  ]);

  const applyChange = (updated: EditableColor[]) => {
    setColorList(updated);
    onColorsChange?.(updated);
  };

  const handleHexChange = (key: string, hex: string) => {
    applyChange(colorList.map(c => c.key === key ? { ...c, hex } : c));
  };

  const handleDelete = (key: string) => {
    applyChange(colorList.filter(c => c.key !== key));
  };

  const handleAdd = (hex: string, label: string) => {
    const key = `custom-${Date.now()}`;
    applyChange([...colorList, { key, label, hex }]);
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Business identity */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">Entity Map</p>
        <div className="space-y-1">
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono text-muted-foreground/60 w-16 flex-shrink-0 uppercase">Brand</span>
            <span className="text-[10px] font-mono text-alias-green truncate">{entityMap.businessName}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono text-muted-foreground/60 w-16 flex-shrink-0 uppercase">Industry</span>
            <span className="text-[10px] font-mono text-foreground/80 truncate">{entityMap.industry}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono text-muted-foreground/60 w-16 flex-shrink-0 uppercase">Service</span>
            <span className="text-[10px] font-mono text-foreground/80 truncate">{entityMap.primaryService}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono text-muted-foreground/60 w-16 flex-shrink-0 uppercase">Audience</span>
            <span className="text-[10px] font-mono text-foreground/80 truncate">{entityMap.targetAudience}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {entityMap.entities.slice(0, 5).map((e) => (
            <span key={e} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-alias-green/30 text-alias-green bg-alias-green-dim truncate max-w-[120px]">
              {e}
            </span>
          ))}
        </div>
      </div>

      <div className="h-px bg-border/30" />

      {/* Color Tokens — editable */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Color Tokens</p>
          <span className="text-[10px] font-mono text-muted-foreground/30 normal-case tracking-normal">hover to edit</span>
        </div>

        {/* Swatch palette strip */}
        <div className="flex gap-1 mb-3">
          {colorList.map(c => (
            <div
              key={c.key}
              className="h-4 rounded transition-all"
              style={{ background: c.hex, flex: 1 }}
              title={`${c.label}: ${c.hex}`}
            />
          ))}
        </div>

        {/* Editable rows */}
        <div className="space-y-1">
          {colorList.map(item => (
            <SwatchRow
              key={item.key}
              item={item}
              onHexChange={hex => handleHexChange(item.key, hex)}
              onDelete={() => handleDelete(item.key)}
            />
          ))}
        </div>

        <AddSwatchRow onAdd={handleAdd} />
      </div>

      <div className="h-px bg-border/30" />

      {/* Typography */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">Typography</p>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-[10px] font-mono text-muted-foreground">Heading</span>
            <span className="text-[10px] font-mono text-foreground/80 truncate max-w-[120px]">{typography.headingFont}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] font-mono text-muted-foreground">Body</span>
            <span className="text-[10px] font-mono text-foreground/80 truncate max-w-[120px]">{typography.bodyFont}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] font-mono text-muted-foreground">Base size</span>
            <span className="text-[10px] font-mono text-foreground/80">{typography.baseSizePx}px</span>
          </div>
        </div>
      </div>

      <div className="h-px bg-border/30" />

      {/* Spacing + Layout */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">Layout</p>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-[10px] font-mono text-muted-foreground">Nav</span>
            <span className="text-[10px] font-mono text-foreground/80">{layout.navType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] font-mono text-muted-foreground">Hero</span>
            <span className="text-[10px] font-mono text-foreground/80">{layout.heroType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] font-mono text-muted-foreground">Columns</span>
            <span className="text-[10px] font-mono text-foreground/80">{layout.columnCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] font-mono text-muted-foreground">Container</span>
            <span className="text-[10px] font-mono text-foreground/80">{spacing.containerWidthPx}px</span>
          </div>
        </div>
      </div>
    </div>
  );
}
