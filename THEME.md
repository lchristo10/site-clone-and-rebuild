# ALIAS Compiler — UI Theme Reference

> This documents the specific design system applied to the **ALIAS Compiler** (`site-clone-and-rebuild`) application. It is a derivative of the broader ALIAS brand system, tuned for a light-mode terminal-tool aesthetic — precise, minimal, and technically credible.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.1 (Turbopack) |
| Styling | Tailwind CSS v4 (`@theme inline`) |
| Fonts | Geist Sans (body) · Geist Mono (all terminal/code UI) |
| Colour space | `oklch` throughout — perceptually uniform, gamut-aware |

---

## Colour Tokens

All tokens are defined in `app/globals.css` as CSS custom properties and mapped to Tailwind via `@theme inline`.

### Semantic Palette (`:root`)

| Token | `oklch` Value | Role |
|---|---|---|
| `--background` | `oklch(0.99 0 0)` | Page background — near-white |
| `--foreground` | `oklch(0.12 0 0)` | Primary text — near-black |
| `--primary` | `oklch(0.18 0 0)` | High-emphasis elements, buttons |
| `--primary-foreground` | `oklch(0.99 0 0)` | Text on `--primary` |
| `--secondary` | `oklch(0.95 0 0)` | Secondary surfaces |
| `--secondary-foreground` | `oklch(0.18 0 0)` | Text on secondary |
| `--muted` | `oklch(0.94 0 0)` | Muted surfaces, chip backgrounds |
| `--muted-foreground` | `oklch(0.45 0 0)` | De-emphasised text |
| `--accent` | `oklch(0.93 0 0)` | Accent surface (hover states) |
| `--accent-foreground` | `oklch(0.18 0 0)` | Text on accent |
| `--border` | `oklch(0 0 0 / 10%)` | Borders, dividers |
| `--input` | `oklch(0 0 0 / 7%)` | Input field backgrounds |
| `--ring` | `oklch(0.50 0.18 145 / 50%)` | Focus ring (green-tinted) |
| `--card` | `oklch(0.975 0 0)` | Card surfaces |
| `--card-foreground` | `oklch(0.12 0 0)` | Text on cards |

### Status / Brand Accent Palette

These are the signature colours that give the UI its terminal-tool character.

| Token | `oklch` Value | Hex approx. | Usage |
|---|---|---|---|
| `--alias-green` | `oklch(0.48 0.18 145)` | `#1a7a3c` | Pipeline running, confirms, CTAs, live indicators |
| `--alias-green-dim` | `oklch(0.48 0.18 145 / 10%)` | — | Green tint fill on cards / selected states |
| `--alias-amber` | `oklch(0.55 0.18 75)` | `#8a6a00` | In-progress / warning states |
| `--alias-red` | `oklch(0.48 0.22 25)` | `#9b2c2c` | Error states, delete actions |

### Tailwind Mapping

Tokens are exposed as Tailwind colour utilities via `@theme inline`:

```css
@theme inline {
  --color-background:    var(--background);
  --color-foreground:    var(--foreground);
  --color-card:          var(--card);
  --color-border:        var(--border);
  --color-muted:         var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-alias-green:   var(--alias-green);
  --color-alias-green-dim: var(--alias-green-dim);
  --color-alias-amber:   var(--alias-amber);
  --color-alias-red:     var(--alias-red);
}
```

**Usage in components:**
```html
<span class="text-alias-green">         <!-- green text -->
<div class="bg-alias-green-dim">        <!-- green tint fill -->
<div class="border border-border/40">   <!-- semi-opaque border -->
<p class="text-muted-foreground">       <!-- grey label text -->
```

---

## Typography

### Typefaces

| Role | Font | Fallback stack |
|---|---|---|
| **Body / UI** | Geist Sans | `ui-sans-serif, system-ui, sans-serif` |
| **Code / terminal / labels** | Geist Mono | `ui-monospace, 'Courier New', monospace` |

Geist is loaded via `next/font/local` in `layout.tsx` and exposed as CSS variables `--font-geist-sans` and `--font-geist-mono`.

### Type Scale Conventions

The app doesn't use a strict modular scale — instead, it uses Tailwind's default scale with a deliberate bias toward **very small mono labels** alongside **larger weight-driven headings**.

| Context | Size | Class |
|---|---|---|
| Micro labels (nav, eyebrows) | ~9–10px | `text-[9px]` / `text-[10px]` |
| Terminal log lines | min(10px, 0.6875rem) | `.terminal-font` |
| Body copy | 14px | `text-sm` |
| Section headings | 15px+ | `text-[15px]` / `text-sm font-semibold` |
| Hero display | `clamp(2.5rem, 8vw, 6rem)` | Inline style |

**Tracking conventions:**
- Micro uppercase mono labels: `tracking-[0.2em]` to `tracking-[0.3em]`
- Body text: default tracking
- Buttons: `tracking-[0.15em]` to `tracking-[0.2em]`

---

## Border Radius

| Token | Value | Maps To |
|---|---|---|
| `--radius` | `0.625rem` (10px) | Base |
| `--radius-sm` | `calc(var(--radius) - 4px)` = 6px | Small chips, tags |
| `--radius-md` | `calc(var(--radius) - 2px)` = 8px | Cards, inputs |
| `--radius-lg` | `var(--radius)` = 10px | Panels, modals |
| `--radius-xl` | `calc(var(--radius) + 4px)` = 14px | Large cards |
| `--radius-2xl` | `calc(var(--radius) + 8px)` = 18px | Sheets |

---

## Spacing

Spatial rhythm is handled by Tailwind defaults. Key conventions:

| Usage | Value |
|---|---|
| Section padding (modal) | `p-4` / `p-5` |
| Card inner padding | `p-3` / `p-4` |
| Inline gap between icon + text | `gap-2` |
| Stack gap between rows | `gap-1` / `gap-1.5` |
| Modal outer shadow | `0 28px 80px rgba(0,0,0,0.65)` |

---

## Animation System

All animations are defined as `@keyframes` in `globals.css` with named utility classes.

| Class | Keyframe | Duration | Use |
|---|---|---|---|
| `.animate-terminal-blink` | `terminal-blink` | `1s step-end infinite` | Blinking cursor `█`, live indicator |
| `.animate-fade-in-up` | `fade-in-up` | `0.4s ease-out both` | Modal appearance, card entrance |
| `.animate-slide-in-right` | `slide-in-right` | `0.3s ease-out both` | Panel slide-ins |
| `.animate-pulse-glow` | `pulse-glow` | `2s ease-in-out infinite` | Phase stepper "running" state |
| `.animate-count-up` | `count-up` | `0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both` | Score number reveals |
| `animate-pulse` (Tailwind) | Tailwind built-in | — | Status dots, save indicator |

### Keyframe definitions

```css
@keyframes terminal-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

@keyframes fade-in-up {
  0%   { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes slide-in-right {
  0%   { opacity: 0; transform: translateX(16px); }
  100% { opacity: 1; transform: translateX(0); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 8px  oklch(0.48 0.18 145 / 20%); }
  50%      { box-shadow: 0 0 24px oklch(0.48 0.18 145 / 40%); }
}

@keyframes count-up {
  from { opacity: 0; transform: scale(0.9); }
  to   { opacity: 1; transform: scale(1);   }
}
```

---

## Special Effects

### Scanlines

Applied to the terminal log and original screenshot panel. Subtly reinforces the CRT/terminal aesthetic without being distracting.

```css
.scanlines {
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    oklch(0 0 0 / 1.5%) 2px,
    oklch(0 0 0 / 1.5%) 4px
  );
  pointer-events: none;
}
```

### Input Glow

Applied to the main URL input field on focus. Green-tinted ambient glow.

```css
.input-glow:focus-within {
  box-shadow:
    0 0 0 1px  oklch(0.48 0.18 145 / 30%),
    0 0 16px   oklch(0.48 0.18 145 / 8%);
}
```

### Dot Grid Background

The hero section background grid:

```css
background-image:
  linear-gradient(oklch(0 0 0 / 4%) 1px, transparent 1px),
  linear-gradient(90deg, oklch(0 0 0 / 4%) 1px, transparent 1px);
background-size: 40px 40px;
```

### Radial Green Gradient Glow

Centred atmospheric glow behind the hero text:

```css
background: radial-gradient(
  ellipse,
  oklch(0.52 0.18 145) 0%,
  transparent 70%
);
opacity: 0.06;
width: 700px; height: 500px;
```

---

## Component Patterns

### Nav Bar

```
position: fixed · top-0 · z-50
background: bg-background/80 backdrop-blur-md
border-bottom: border-border/30
padding: px-6 py-4
```

Logo: `ALIAS` (muted) + `·` separator + `COMPILER` (alias-green) in `font-mono uppercase tracking-[0.3em] text-[10px]`

### Cards / Panels

```
bg-card · border border-border · rounded-lg
Inner padding: p-4
```

Always use `border-border/40` for lighter dividers and `border-border/60` for modal outlines.

### Modal Overlay

```css
background: rgba(0, 0, 0, 0.78);
backdrop-filter: blur(8px);
```

Modal panel: `bg-background · border border-border/60 · rounded-xl`
Shadow: `0 28px 80px rgba(0,0,0,0.65)`

### Buttons — Primary CTA

```
bg-alias-green · text-background
font-mono uppercase tracking-[0.2em] text-xs font-bold
hover:bg-alias-green/90 · active:scale-95
disabled:opacity-40
```

### Buttons — Outline / Secondary

```
border border-border/40 · text-muted-foreground/40
hover:text-muted-foreground · hover:border-border/60
font-mono uppercase tracking-[0.15em] text-[10px]
```

### Mono Label (Eyebrow)

Used above section headings, modal step indicators, panel titles:

```
text-[9px] font-mono uppercase tracking-[0.2em]–[0.3em] text-muted-foreground
```

Often paired with a pulse dot:
```html
<span class="w-1.5 h-1.5 rounded-full bg-alias-green animate-pulse" />
<span class="text-[9px] font-mono uppercase tracking-[0.25em] text-alias-green">
  Label
</span>
```

### Status Indicator Badge

```
px-3 py-1.5 · rounded-full
border border-alias-green/30 · bg-alias-green-dim
text-[9px] font-mono uppercase tracking-[0.25em] text-alias-green
```

### Terminal Log Window

Chrome bar:
```
bg-card · border-b border-border/50
Three circle dots: w-2.5 h-2.5 rounded-full (red/yellow/green at /60 opacity)
Title: text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground
```

Log lines: `.terminal-font` with `›` prefix in `text-muted-foreground/30`

Colour coding:
| Status | Colour class |
|---|---|
| `done` | `text-alias-green` |
| `running` | `text-alias-amber` |
| `error` | `text-alias-red` |
| `system` | `text-muted-foreground/60` |
| `log` | `text-foreground/80` |

### Phase Stepper Nodes

```
w-8 h-8 · rounded · border
pending:  text-muted-foreground · border-border
running:  text-alias-amber · border-alias-amber · animate-pulse-glow (blink icon)
done:     text-alias-green · border-alias-green · bg-alias-green-dim
error:    text-alias-red · border-alias-red
```

Connector lines between nodes: `h-px flex-1 mx-1` — colour transitions from `bg-border/30` → `bg-alias-green/40` as phases complete.

---

## Key Design Principles

1. **Monochromatic base, chromatic signal** — The entire UI is achromatic (`oklch(L 0 0)`) except for the four status colours. This makes `alias-green` a strong, scannable signal.

2. **Mono-first type hierarchy** — Label text is almost always `font-mono uppercase tracking-widest` regardless of font size. Prose is the exception, not the rule.

3. **Opacity as hierarchy** — Rather than separate colour tokens for every shade, the app uses `text-muted-foreground/40`, `text-muted-foreground/60` etc. to create depth without adding new values.

4. **No left-only borders on containers** — All card/container outlines use uniform `border: 1px solid` all around. Thick accent stripes on one edge are not used.

5. **Very small type, very wide tracking** — 9px labels with `tracking-[0.25em]` is the signature detail of the UI — it reads as precise and tooling-grade without being illegible.

6. **Glass nav** — The sticky nav always uses `bg-background/80 backdrop-blur-md` to feel lightweight while still providing contrast.

---

## File Locations

| File | Purpose |
|---|---|
| `app/app/globals.css` | All CSS tokens, keyframes, utility classes |
| `app/app/layout.tsx` | Font loading (Geist), base `<html>` setup |
| `app/components/terminal-log.tsx` | Terminal UI, phase stepper integration |
| `app/components/phase-stepper.tsx` | Pipeline progress nodes |
| `app/components/token-preview.tsx` | Design token panel (editable colour swatches) |
| `app/components/aeo-score-ring.tsx` | AEO audit score ring chart |
| `app/app/page.tsx` | Home — hero, URL input, objective picker, Vibe Forge |
