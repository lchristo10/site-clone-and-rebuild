# Alias theme

Shared reference for how `sites/alias_business` looks: `app/layout.tsx`, `app/globals.css`, and landing pages.

## Brand voice (copy)

- **Clear and direct.** Say what the product does; avoid filler and theatrics.
- **No command-center fiction.** Do not use “command channel,” “mission control,” “operative,” “classified,” or similar framing.
- **UI labels** can stay minimal and uppercase where the design calls for it; **marketing and product copy** stay plain and readable.

---

## Fonts & typography

**Only two fonts: Geist Sans and Geist Mono.** Loaded via Next.js `next/font/google`.

| Role | Font         | Usage                 |
|------|--------------|------------------------|
| Sans | **Geist Sans** | Body, headings, UI, labels |
| Mono | **Geist Mono** | Code, meta, countdown labels |

**Layout (layout.tsx):**

- `Geist({ variable: "--font-geist-sans", subsets: ["latin"] })`
- `Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })`
- Body: `className={geistSans.variable} ${geistMono.variable} antialiased`

**CSS (globals.css):**

```css
body {
  font-family: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: var(--font-geist-mono), ui-monospace, monospace;
}
```

**Conventions used on main page:**

- Page/site title (e.g. “ALIAS”): `font-medium text-lg tracking-tight text-foreground uppercase`
- Nav links: `text-sm font-medium tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors`
- Primary CTA (e.g. “Try ALIAS”): `text-sm font-medium tracking-[0.08em] uppercase text-foreground border border-border rounded-md px-4 py-2 hover:bg-foreground/5 transition-colors`
- Hero headline (muted part): `text-muted-foreground` with `text-[clamp(1.75rem,6vw,5rem)]`
- Hero headline (emphasis): `text-foreground text-[clamp(1.5rem,9vw,10rem)] leading-tight`
- Hero subtext: `text-white text-sm leading-relaxed`
- Meta / countdown label: `text-xs font-mono tracking-[0.2em] sm:tracking-[0.3em] uppercase text-muted-foreground`
- Countdown numbers: `text-4xl sm:text-5xl lg:text-7xl font-medium tabular-nums text-foreground tracking-tight`
- Small mono labels: `text-xs font-mono tracking-[0.15em] uppercase text-muted-foreground`

---

## Color system (globals.css)

The app uses **CSS variables in oklch** and Tailwind v4 `@theme inline` to map them. **Dark mode is applied via class `.dark`** on a container (e.g. `<main className="dark ...">`).

### Light theme (`:root`)

| Token        | Value (oklch) | Use |
|-------------|----------------|-----|
| `--radius`  | `0.625rem`     | Base radius; radius-sm/md/lg/xl/2xl/3xl/4xl are derived |
| `--background` | `oklch(1 0 0)` | Page, main surface |
| `--foreground` | `oklch(0.145 0 0)` | Primary text, headings, primary buttons |
| `--card` / `--card-foreground` | Same as background/foreground | Cards |
| `--popover` / `--popover-foreground` | Same | Popovers |
| `--primary` | `oklch(0.205 0 0)` | Primary actions |
| `--primary-foreground` | `oklch(0.985 0 0)` | On primary |
| `--secondary` | `oklch(0.97 0 0)` | Secondary surfaces |
| `--secondary-foreground` | `oklch(0.205 0 0)` | On secondary |
| `--muted` | `oklch(0.97 0 0)` | Muted panels |
| `--muted-foreground` | `oklch(0.556 0 0)` | Secondary text, placeholders |
| `--accent` / `--accent-foreground` | `oklch(0.97 0 0)` / `oklch(0.205 0 0)` | Accent surfaces |
| `--destructive` | `oklch(0.577 0.245 27.325)` | Destructive actions |
| `--border` | `oklch(0.922 0 0)` | Borders, dividers |
| `--input` | `oklch(0.922 0 0)` | Input borders |
| `--ring` | `oklch(0.708 0 0)` | Focus rings |
| `--chart-1` … `--chart-5` | Various oklch | Charts |
| `--sidebar-*` | Defined | Sidebar theming |

### Dark theme (`.dark`)

| Token        | Value (oklch) | Use |
|-------------|----------------|-----|
| `--background` | `oklch(0.145 0 0)` | Page, main surface |
| `--foreground` | `oklch(0.985 0 0)` | Primary text |
| `--card` | `oklch(0.205 0 0)` | Cards |
| `--card-foreground` | `oklch(0.985 0 0)` | On card |
| `--popover` / `--popover-foreground` | Dark variants | Popovers |
| `--primary` | `oklch(0.922 0 0)` | Primary |
| `--primary-foreground` | `oklch(0.205 0 0)` | On primary |
| `--secondary` | `oklch(0.269 0 0)` | Secondary |
| `--muted` | `oklch(0.269 0 0)` | Muted |
| `--muted-foreground` | `oklch(0.708 0 0)` | Muted text |
| `--border` | `oklch(1 0 0 / 10%)` | Borders |
| `--input` | `oklch(1 0 0 / 15%)` | Input borders |
| `--ring` | `oklch(0.556 0 0)` | Focus ring |
| `--sidebar-primary` | `oklch(0.488 0.243 264.376)` | Purple accent in sidebar |

**Dark variant (Tailwind):** `@custom-variant dark (&:is(.dark *));` so `dark:` utilities apply inside any `.dark` ancestor.

---

## Tailwind theme mapping (globals.css)

`@theme inline { ... }` wires CSS variables to Tailwind v4:

- **Colors:** `--color-background: var(--background);` (and same for foreground, primary, secondary, muted, accent, destructive, border, input, ring, card, popover, sidebar-*, chart-1..5).
- **Fonts:** `--font-sans: var(--font-geist-sans);` and `--font-mono: var(--font-geist-mono);`
- **Radius:** `--radius-sm` through `--radius-4xl` derived from `--radius` (e.g. `--radius-lg: var(--radius)`).

Use semantic classes: `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`, etc.

---

## Base styles (globals.css)

- **Body:** `@apply bg-background text-foreground` (in `@layer base`).
- **Borders/outlines:** `*:not(.tenant-site-wrapper):not(.tenant-site-wrapper *):not(.animated-characters-login):not(.animated-characters-login *)` gets `@apply border-border outline-ring/50` so default borders/outlines use theme; tenant and animated character trees are excluded.
- **Animated character container:** `.animated-characters-login` (and children) have borders, outlines, and box-shadows reset, plus `contain: layout paint; isolation: isolate; transform: translateZ(0);` to avoid ghost lines.

---

## Main page structure (page.tsx)

- **Root:** `<main className="dark min-h-screen bg-background text-foreground selection:bg-green-500/10">` — dark theme and green selection highlight.
- **Wrapper:** `relative min-h-screen flex flex-col overflow-hidden` with full-height background (e.g. neural shader).
- **Nav:** `fixed top-0 left-0 right-0 z-50 p-5 sm:p-6 lg:px-12 flex justify-between items-center bg-transparent`.
- **Content:** `relative z-10 flex flex-col flex-1` containing hero and countdown (or other sections).

---

## Landing hero (landing_hero.tsx)

- **Section:** `relative min-h-[100dvh] flex flex-col items-start justify-center px-5 py-24 sm:px-6 lg:px-12 overflow-hidden w-full max-w-full`.
- **Content:** `relative z-10 w-full max-w-3xl flex flex-col items-start text-left`.
- **Headline:** Two lines — first `text-muted-foreground`, second `text-foreground`; responsive clamp for font size.
- **Subtext:** `max-w-md text-white text-sm leading-relaxed`.
- **CTA:** JoinWaitlist (form with input + button).

---

## Countdown (countdown_april2.tsx)

- **Section:** `relative z-10 w-full min-h-[100dvh] flex flex-col items-center justify-center px-5 sm:px-6 lg:px-12`.
- **Label:** `text-xs font-mono tracking-[0.2em] sm:tracking-[0.3em] uppercase text-muted-foreground mb-10 text-center`.
- **Blocks:** `flex flex-wrap items-center justify-center gap-12 sm:gap-16 lg:gap-20`.
- **Number:** `text-4xl sm:text-5xl lg:text-7xl font-medium tabular-nums text-foreground tracking-tight`.
- **Unit label:** `mt-3 text-xs font-mono tracking-[0.15em] uppercase text-muted-foreground`.

---

## Form controls (from join_waitlist.tsx)

- **Input (overlay style):** `bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30` for use on dark/hero backgrounds.
- **Button (ghost outline):** `text-sm font-medium tracking-[0.1em] sm:tracking-[0.15em] uppercase text-white hover:text-white/80 transition-colors py-2 px-4 border border-white/30 rounded-md hover:bg-white/5 disabled:opacity-50`.
- **Error:** `text-sm text-red-300 mt-2`.

Standard form inputs elsewhere should use theme tokens: `border-border`, `bg-background`, `text-foreground`, `focus-visible:ring-ring`, etc., and radius from the theme (`rounded-md` or `rounded-lg` via `--radius-*`).

---

## Edges & radii

- **Base radius:** `--radius: 0.625rem`; component radii are derived (`--radius-sm` … `--radius-4xl`).
- **UI on main page:** `rounded-md` for nav CTA and waitlist button; no heavy borders — use `border-border` or transparent/opacity borders (e.g. `border-white/20`, `border-white/30`) on dark overlays.

---

## Summary

- **Voice:** Direct product language; no command-center or mission-control narrative.
- **Fonts:** Geist Sans + Geist Mono via layout and globals.
- **Colors:** oklch CSS variables; Tailwind via `@theme inline`.
- **Dark mode:** `.dark` on a wrapper; main page uses `dark` on `<main>`.
- **Layout:** Dark full-height page, fixed nav, hero + countdown; semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`).

Keep in sync with `sites/alias_business/app/layout.tsx`, `app/globals.css`, and landing routes when the theme changes.
