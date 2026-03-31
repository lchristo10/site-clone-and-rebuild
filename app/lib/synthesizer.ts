import { AeoContent, AeoSection, BrandDNA, DesignTokens, EntityMap } from './types';
import { brandDnaToCssTokens } from './brand-dna';

function cssFromTokens(tokens: DesignTokens, brandDna?: BrandDNA): string {
  const { typography, spacing } = tokens;

  // When Brand DNA is available, its semantic tokens override the raw hex values.
  // The functional --c-* aliases inside brandDnaToCssTokens reference var(--color-brand-*)
  // so everything cascades from one source of truth.
  const colorBlock = brandDna
    ? brandDnaToCssTokens(brandDna)
    : `
  --c-primary:   ${tokens.colors.primary};
  --c-secondary: ${tokens.colors.secondary};
  --c-surface:   ${tokens.colors.surface};
  --c-text:      ${tokens.colors.text};
  --c-accent:    ${tokens.colors.accent};
  --c-border:    ${tokens.colors.border || 'rgba(0,0,0,0.08)'};
  --c-muted:     color-mix(in srgb, ${tokens.colors.text} 60%, ${tokens.colors.surface});`.trimStart();

  return `
    /* ─── Design Tokens ─────────────────────────────────────────── */
    :root {
      ${colorBlock}

      --f-heading: '${brandDna?.typePairing.heading ?? typography.headingFont}', system-ui, -apple-system, sans-serif;
      --f-body:    '${brandDna?.typePairing.body    ?? typography.bodyFont}', system-ui, -apple-system, sans-serif;
      --f-size:    ${typography.baseSizePx}px;
      --f-scale:   ${typography.scaleRatio || 1.25};

      --w-container: min(max(${spacing.containerWidthPx}px, 70vw), 96vw);
      --s-section:   clamp(${Math.round(spacing.sectionPaddingPx * 0.6)}px, 8vw, ${spacing.sectionPaddingPx}px);
      --s-gap:       ${spacing.columnGapPx}px;

      --radius-sm:  6px;
      --radius-md:  10px;
      --radius-lg:  16px;
      --radius-pill: 999px;

      --shadow-sm:  0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04);
      --shadow-md:  0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04);
      --shadow-lg:  0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06);

      --transition: 200ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* ─── Reset ─────────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: var(--f-size); scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
    img, video, svg { display: block; max-width: 100%; }

    /* ─── Base ──────────────────────────────────────────────────── */
    body {
      font-family: var(--f-body);
      background-color: var(--c-surface);
      color: var(--c-text);
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: var(--f-heading);
      line-height: 1.2;
      font-weight: 700;
      color: var(--c-text);
      letter-spacing: -0.02em;
    }
    h1 { font-size: clamp(2.2rem, 5vw, 3.75rem); margin-bottom: 1.25rem; }
    h2 { font-size: clamp(1.6rem, 3.5vw, 2.5rem); margin-bottom: 1rem; }
    h3 { font-size: clamp(1.15rem, 2vw, 1.5rem); margin-bottom: 0.6rem; }
    h4 { font-size: 1.1rem; margin-bottom: 0.5rem; }

    p { margin-bottom: 1rem; max-width: 80ch; line-height: 1.75; }
    p:last-child { margin-bottom: 0; }
    a { color: var(--c-primary); text-decoration: underline; text-decoration-skip-ink: auto; transition: opacity var(--transition); }
    a:hover { opacity: 0.75; }

    ul, ol { padding-left: 1.5rem; margin-bottom: 1rem; }
    li { margin-bottom: 0.5rem; line-height: 1.6; }
    strong { font-weight: 600; }
    blockquote { border-left: 3px solid var(--c-primary); padding: 0.75rem 1.25rem; margin: 1.5rem 0; opacity: 0.85; font-style: italic; }

    /* ─── Layout ────────────────────────────────────────────────── */
    .container {
      max-width: var(--w-container);
      margin-inline: auto;
      padding-inline: clamp(1rem, 4vw, 2.5rem);
    }

    /* ─── Navigation ────────────────────────────────────────────── */
    .site-nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--c-surface);
      border-bottom: 1px solid var(--c-border);
      padding: 0;
      transition: box-shadow var(--transition), background var(--transition);
    }
    .site-nav.scrolled {
      box-shadow: var(--shadow-sm);
    }
    .site-nav__inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-block: 1rem;
    }
    .site-nav__brand {
      font-family: var(--f-heading);
      font-weight: 800;
      font-size: 1.2rem;
      color: var(--c-primary);
      text-decoration: none;
      letter-spacing: -0.03em;
      transition: opacity var(--transition);
    }
    .site-nav__brand:hover { opacity: 0.8; }
    .site-nav__links {
      display: flex;
      align-items: center;
      gap: 2rem;
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .site-nav__links a {
      text-decoration: none;
      color: var(--c-text);
      font-size: 0.9rem;
      font-weight: 500;
      opacity: 0.7;
      transition: opacity var(--transition);
    }
    .site-nav__links a:hover { opacity: 1; }
    .site-nav__cta {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--c-primary);
      color: var(--c-surface) !important;
      text-decoration: none !important;
      padding: 0.55rem 1.25rem;
      border-radius: var(--radius-pill);
      font-size: 0.875rem;
      font-weight: 600;
      transition: opacity var(--transition), transform var(--transition), box-shadow var(--transition);
    }
    .site-nav__cta:hover {
      opacity: 1 !important;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px color-mix(in srgb, var(--c-primary) 35%, transparent);
    }

    /* ─── Hero ──────────────────────────────────────────────────── */
    .hero-section {
      position: relative;
      padding-block: calc(var(--s-section) * 2) calc(var(--s-section) * 1.5);
      overflow: hidden;
    }
    .hero-section::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg,
        color-mix(in srgb, var(--c-primary) 12%, transparent) 0%,
        color-mix(in srgb, var(--c-accent) 8%, transparent) 50%,
        transparent 100%
      );
      pointer-events: none;
    }
    .hero-section__inner {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 2rem;
      max-width: 52rem;
    }
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: color-mix(in srgb, var(--c-primary) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--c-primary) 25%, transparent);
      color: var(--c-primary);
      padding: 0.35rem 0.9rem;
      border-radius: var(--radius-pill);
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      width: fit-content;
    }
    .hero-badge::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }
    .hero-section h1 {
      font-size: clamp(2.5rem, 6vw, 4.5rem);
      line-height: 1.07;
      letter-spacing: -0.03em;
    }
    .hero-section h1 em {
      font-style: normal;
      color: var(--c-primary);
    }
    .hero-section .hero-sub {
      font-size: clamp(1rem, 1.8vw, 1.2rem);
      opacity: 0.75;
      max-width: 52ch;
      line-height: 1.65;
    }
    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
      margin-top: 0.5rem;
    }

    /* ─── Answer Capsule ────────────────────────────────────────── */
    .answer-capsule {
      background: color-mix(in srgb, var(--c-primary) 6%, var(--c-surface));
      border: 1px solid color-mix(in srgb, var(--c-primary) 18%, transparent);
      border-left: 4px solid var(--c-primary);
      border-radius: var(--radius-md);
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
      font-size: 1.05rem;
      line-height: 1.65;
      max-width: 66ch;
    }
    .answer-capsule p { margin: 0; max-width: none; }

    /* ─── Sections ──────────────────────────────────────────────── */
    section {
      padding-block: var(--s-section);
    }
    section + section {
      border-top: 1px solid var(--c-border);
    }
    .section-eyebrow {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--c-primary);
      margin-bottom: 0.6rem;
    }

    /* ─── Features / Services Grid ──────────────────────────────── */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
      gap: var(--s-gap);
      margin-top: 2rem;
    }
    .feature-card {
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: var(--radius-lg);
      padding: 1.75rem;
      transition: transform var(--transition), box-shadow var(--transition);
    }
    .feature-card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-md);
    }
    .feature-card__icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--c-primary) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--c-primary) 18%, transparent);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.25rem;
      color: var(--c-primary);
      flex-shrink: 0;
    }
    .feature-card__icon svg {
      display: block;
    }
    .feature-card h3 {
      color: var(--c-text);
      margin-bottom: 0.5rem;
    }
    .feature-card p {
      font-size: 0.925rem;
      opacity: 0.75;
      margin: 0;
    }

    /* ─── CTA Section ───────────────────────────────────────────── */
    .cta-section {
      background: var(--c-primary);
      color: var(--c-surface);
      position: relative;
      overflow: hidden;
    }
    .cta-section::before {
      content: '';
      position: absolute;
      top: -60%;
      right: -20%;
      width: 50%;
      aspect-ratio: 1;
      border-radius: 50%;
      background: rgba(255,255,255,0.06);
      pointer-events: none;
    }
    .cta-section::after {
      content: '';
      position: absolute;
      bottom: -40%;
      left: -10%;
      width: 40%;
      aspect-ratio: 1;
      border-radius: 50%;
      background: rgba(255,255,255,0.04);
      pointer-events: none;
    }
    .cta-section h2 {
      color: var(--c-surface);
      margin-bottom: 1rem;
    }
    .cta-section p {
      color: rgba(255,255,255,0.8);
    }
    .cta-section__inner {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 2rem;
    }

    /* ─── FAQ ───────────────────────────────────────────────────── */
    .faq-list {
      display: grid;
      gap: 0;
      margin-top: 2rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--c-border);
      overflow: hidden;
    }
    .faq-item {
      border-bottom: 1px solid var(--c-border);
      background: var(--c-surface);
    }
    .faq-item:last-child { border-bottom: none; }
    .faq-item details { padding: 0; }
    .faq-item summary {
      padding: 1.1rem 1.5rem;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.975rem;
      list-style: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      color: var(--c-primary);
      transition: background var(--transition);
    }
    .faq-item summary::-webkit-details-marker { display: none; }
    .faq-item summary::after {
      content: '+';
      font-size: 1.25rem;
      line-height: 1;
      flex-shrink: 0;
      transition: transform var(--transition);
    }
    .faq-item details[open] summary::after { transform: rotate(45deg); }
    .faq-item summary:hover {
      background: color-mix(in srgb, var(--c-primary) 5%, var(--c-surface));
    }
    .faq-item details[open] summary {
      background: color-mix(in srgb, var(--c-primary) 5%, var(--c-surface));
      border-bottom: 1px solid var(--c-border);
    }
    .faq-answer {
      padding: 1rem 1.5rem;
      font-size: 0.95rem;
      opacity: 0.8;
      line-height: 1.7;
    }
    .faq-answer p { margin: 0; max-width: none; }

    /* ─── About / Generic Sections ──────────────────────────────── */
    .about-section__inner {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      align-items: center;
    }
    @media (max-width: 720px) {
      .about-section__inner { grid-template-columns: 1fr; gap: 2rem; }
    }
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 1.5rem;
      margin-top: 1.5rem;
    }
    .stat-item {
      text-align: center;
      padding: 1.25rem 1rem;
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--c-primary) 6%, var(--c-surface));
      border: 1px solid color-mix(in srgb, var(--c-primary) 15%, transparent);
    }
    .stat-item__number {
      display: block;
      font-family: var(--f-heading);
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--c-primary);
      line-height: 1;
    }
    .stat-item__label {
      display: block;
      font-size: 0.78rem;
      opacity: 0.6;
      margin-top: 0.35rem;
      font-weight: 500;
    }

    /* ─── Testimonials ──────────────────────────────────────────── */
    .testimonials-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
      gap: var(--s-gap);
      margin-top: 2rem;
    }
    .testimonial-card {
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: var(--radius-lg);
      padding: 1.75rem;
      position: relative;
    }
    .testimonial-card::before {
      content: '"';
      position: absolute;
      top: 1rem;
      right: 1.5rem;
      font-size: 4rem;
      line-height: 1;
      color: var(--c-primary);
      opacity: 0.15;
      font-family: Georgia, serif;
    }
    .testimonial-card p {
      font-size: 0.95rem;
      font-style: italic;
      opacity: 0.8;
      margin-bottom: 1rem;
      max-width: none;
    }
    .testimonial-card__author {
      font-weight: 600;
      font-size: 0.875rem;
      color: var(--c-primary);
    }

    /* ─── Buttons ───────────────────────────────────────────────── */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.75rem;
      border-radius: var(--radius-pill);
      font-weight: 600;
      font-size: 0.925rem;
      text-decoration: none !important;
      transition: all var(--transition);
      cursor: pointer;
      border: none;
    }
    .btn-primary {
      background: var(--c-primary);
      color: var(--c-surface) !important;
      box-shadow: 0 2px 8px color-mix(in srgb, var(--c-primary) 30%, transparent);
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px color-mix(in srgb, var(--c-primary) 40%, transparent);
      opacity: 1 !important;
    }
    .btn-outline {
      background: transparent;
      color: var(--c-primary) !important;
      border: 2px solid var(--c-primary);
    }
    .btn-outline:hover {
      background: color-mix(in srgb, var(--c-primary) 8%, transparent);
      transform: translateY(-1px);
      opacity: 1 !important;
    }
    .btn-ghost {
      background: rgba(255,255,255,0.15);
      color: var(--c-surface) !important;
      border: 1px solid rgba(255,255,255,0.3);
      backdrop-filter: blur(4px);
    }
    .btn-ghost:hover {
      background: rgba(255,255,255,0.25);
      opacity: 1 !important;
    }

    /* ─── Checklist ─────────────────────────────────────────────── */
    .checklist {
      list-style: none;
      padding: 0;
      display: grid;
      gap: 0.6rem;
    }
    .checklist li {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      font-size: 0.95rem;
      margin-bottom: 0;
    }
    .checklist li::before {
      content: '✓';
      color: var(--c-primary);
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 0.05em;
    }

    /* ─── Footer ────────────────────────────────────────────────── */
    .site-footer {
      background: color-mix(in srgb, var(--c-text) 95%, var(--c-surface));
      color: color-mix(in srgb, var(--c-surface) 85%, transparent);
      padding-block: 3rem 2rem;
    }
    .site-footer__inner {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 3rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      margin-bottom: 2rem;
    }
    @media (max-width: 720px) {
      .site-footer__inner { grid-template-columns: 1fr; gap: 2rem; }
    }
    .site-footer__brand {
      font-family: var(--f-heading);
      font-size: 1.2rem;
      font-weight: 800;
      color: #fff;
      text-decoration: none;
      display: block;
      margin-bottom: 0.75rem;
      letter-spacing: -0.02em;
    }
    .site-footer__tagline {
      font-size: 0.875rem;
      opacity: 0.5;
      max-width: 30ch;
      line-height: 1.6;
      margin: 0;
    }
    .site-footer__col-title {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.4);
      margin-bottom: 1rem;
    }
    .site-footer__links {
      list-style: none;
      padding: 0;
      display: grid;
      gap: 0.5rem;
    }
    .site-footer__links a {
      text-decoration: none;
      color: rgba(255,255,255,0.6);
      font-size: 0.875rem;
      transition: color var(--transition);
    }
    .site-footer__links a:hover { color: #fff; opacity: 1; }
    .site-footer__bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .site-footer__copy {
      font-size: 0.8rem;
      opacity: 0.35;
      margin: 0;
      max-width: none;
    }
    .alias-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.3);
      text-decoration: none;
    }
    .alias-badge:hover { color: rgba(255,255,255,0.6); opacity: 1; }
    .alias-badge__dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }

    /* ─── Responsive ────────────────────────────────────────────── */
    @media (max-width: 640px) {
      .features-grid { grid-template-columns: 1fr; }
      .site-nav__links { display: none; }
      .about-section__inner { grid-template-columns: 1fr; }
      .site-footer__inner { grid-template-columns: 1fr; }
    }

    /* ─── Scroll animation ──────────────────────────────────────── */
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fade-in { animation: fadeInUp 0.5s ease both; }
    .fade-in-1 { animation-delay: 0.05s; }
    .fade-in-2 { animation-delay: 0.1s; }
    .fade-in-3 { animation-delay: 0.175s; }
    .fade-in-4 { animation-delay: 0.25s; }
  `.trim();
}

function googleFontsLink(tokens: DesignTokens): string {
  const fonts = [tokens.typography.headingFont, tokens.typography.bodyFont]
    .filter((f, i, a) => a.indexOf(f) === i && f.trim().length > 0)
    .map(f => encodeURIComponent(f) + ':ital,wght@0,400;0,500;0,600;0,700;0,800;1,400')
    .join('&family=');
  return `https://fonts.googleapis.com/css2?family=${fonts}&display=swap`;
}

// Feature icons based on common categories
// ── SVG icon helpers ─────────────────────────────────────────────────────────
// Each value is a self-contained inline SVG (24×24 viewport, currentColor stroke).
// Keys are lowercase keywords matched against the card title.

function svg(path: string, extra = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${path}</svg>`;
}

const FEATURE_ICONS: Record<string, string> = {

  // ─────────────────────────────────────────────────────────────────────────
  // BEAUTY / HAIR   (compound keywords first — they are longer so they match
  // before generic fallbacks like 'hair', 'cut', 'style', 'color')
  // ─────────────────────────────────────────────────────────────────────────

  // Scissors — "haircuts", "precision cuts", "gents cut"
  'haircut':      svg('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>'),
  'precision cut':svg('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>'),

  // Palette — "hair coloring", "hair colouring", "balayage", "highlights", "toning"
  'hair color':   svg('<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>'),
  'hair colour':  svg('<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>'),
  'coloring':     svg('<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>'),
  'colouring':    svg('<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>'),
  'highlights':   svg('<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>'),
  'balayage':     svg('<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>'),

  // Wand/sparkles — "hair styling", "blowouts", "updos", "styling"
  'hair styling': svg('<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>'),
  'styling':      svg('<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>'),
  'blowout':      svg('<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>'),
  'updo':         svg('<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>'),

  // Droplet — "conditioning", "hair treatments", "deep condition", "repair", "scalp", "keratin"
  'conditioning': svg('<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'),
  'treatment':    svg('<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'),
  'keratin':      svg('<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'),
  'scalp':        svg('<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'),
  'repair':       svg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),

  // User — "consultation", "personalized", "personal"
  'consultation': svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  'consult':      svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  'personal':     svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),

  // Star — "bridal", "special occasion", "wedding", "event"
  'bridal':       svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  'occasion':     svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  'wedding':      svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),

  // Generic beauty fallbacks
  'hair':         svg('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>'),
  'cut':          svg('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>'),
  'color':        svg('<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>'),
  'colour':       svg('<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>'),
  'style':        svg('<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72z"/><path d="m14 7 3 3"/>'),
  'salon':        svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  'beauty':       svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  'makeup':       svg('<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>'),
  'nail':         svg('<rect x="8" y="2" width="8" height="14" rx="4"/><path d="M8 14h8"/><path d="M10 20h4"/><path d="M12 16v4"/>'),
  'spa':          svg('<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'),
  'lash':         svg('<path d="M2 12c2-4 5-6 10-6s8 2 10 6"/><path d="M12 6v4"/><path d="M7 7l2 3"/><path d="M17 7l-2 3"/>'),
  'brow':         svg('<path d="M2 12c2-4 5-6 10-6s8 2 10 6"/><path d="M8 14l4-4 4 4"/>'),
  'wax':          svg('<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'),
  'facial':       svg('<circle cx="12" cy="10" r="6"/><path d="M12 16v6"/><path d="M9 20h6"/><circle cx="10" cy="9" r="1" fill="currentColor"/><circle cx="14" cy="9" r="1" fill="currentColor"/>'),
  'skin':         svg('<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'),
  'massage':      svg('<path d="M4 19V7a4 4 0 0 1 8 0v12"/><path d="M12 7a4 4 0 0 1 8 0v5"/><path d="M4 15h8"/>'),

  // ─────────────────────────────────────────────────────────────────────────
  // BUSINESS / PROFESSIONAL
  // ─────────────────────────────────────────────────────────────────────────
  'strategy':     svg('<path d="M2 20h20"/><path d="M6 20V10l6-8 6 8v10"/><path d="M9 20v-5h6v5"/>'),
  'plan':         svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>'),
  'report':       svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
  'manage':       svg('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>'),
  'brand':        svg('<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'),
  'market':       svg('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
  'social':       svg('<path d="M17 2H7a5 5 0 0 0-5 5v10a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5V7a5 5 0 0 0-5-5z"/><circle cx="12" cy="12" r="3"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>'),
  'seo':          svg('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/>'),
  'content':      svg('<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>'),
  'email':        svg('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'),
  'advertis':     svg('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
  'sales':        svg('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
  'growth':       svg('<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'),
  'training':     svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
  'workshop':     svg('<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>'),
  'coach':        svg('<circle cx="12" cy="8" r="4"/><path d="M4 20v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/>'),
  'team':         svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),

  // ─────────────────────────────────────────────────────────────────────────
  // TECHNOLOGY
  // ─────────────────────────────────────────────────────────────────────────
  'ai':           svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>'),
  'automat':      svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>'),
  'data':         svg('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>'),
  'analyt':       svg('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
  'cloud':        svg('<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>'),
  'security':     svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  'speed':        svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
  'integrat':     svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  'mobile':       svg('<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>'),
  'web':          svg('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
  'api':          svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  'develop':      svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  'support':      svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  'server':       svg('<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>'),

  // ─────────────────────────────────────────────────────────────────────────
  // FINANCE / LEGAL
  // ─────────────────────────────────────────────────────────────────────────
  'finance':      svg('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
  'account':      svg('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
  'tax':          svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>'),
  'invest':       svg('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
  'legal':        svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  'law':          svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  'contract':     svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
  'insurance':    svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>'),

  // ─────────────────────────────────────────────────────────────────────────
  // HEALTH / WELLNESS
  // ─────────────────────────────────────────────────────────────────────────
  'health':       svg('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'),
  'fitness':      svg('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'),
  'nutrit':       svg('<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'),
  'wellbeing':    svg('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'),
  'mental':       svg('<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>'),
  'yoga':         svg('<circle cx="12" cy="5" r="2"/><path d="M12 7v7"/><path d="M7 12l5 2 5-2"/><path d="M9 18l3-2 3 2"/>'),
  'physio':       svg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),

  // ─────────────────────────────────────────────────────────────────────────
  // PROPERTY / CONSTRUCTION
  // ─────────────────────────────────────────────────────────────────────────
  'property':     svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
  'real estate':  svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
  'design':       svg('<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>'),
  'interior':     svg('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
  'build':        svg('<polygon points="1 22 23 22 12 2"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="12" y1="18" x2="12.01" y2="18"/>'),
  'renovate':     svg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
  'landscape':    svg('<path d="M3 15c.5-2 2-3.5 3.5-4.5C8 9.5 10 9 12 9c2 0 4 .5 5.5 1.5C19 11.5 20.5 13 21 15"/><path d="M2 20h20"/><path d="M12 9V3"/><path d="M8 6l4-3 4 3"/>'),

  // ─────────────────────────────────────────────────────────────────────────
  // FOOD / HOSPITALITY
  // ─────────────────────────────────────────────────────────────────────────
  'food':         svg('<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>'),
  'cater':        svg('<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>'),
  'restaurant':   svg('<line x1="9" y1="3" x2="9" y2="21"/><path d="M4 3v6a5 5 0 0 0 10 0V3"/><path d="M20 3v18"/>'),
  'hospitality':  svg('<path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/>'),
  'event':        svg('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),

  // ─────────────────────────────────────────────────────────────────────────
  // GENERAL FALLBACKS
  // ─────────────────────────────────────────────────────────────────────────
  'deliver':      svg('<path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="1"/><circle cx="12" cy="21" r="1" fill="currentColor"/><circle cx="20" cy="21" r="1" fill="currentColor"/>'),
  'photo':        svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
  'video':        svg('<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>'),
  'award':        svg('<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>'),
  'certif':       svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>'),
  'premium':      svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  'package':      svg('<path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.78 0l-8-4A2 2 0 0 1 2 16.77V7.24a2 2 0 0 1 1.11-1.8l8-4a2 2 0 0 1 1.78.01z"/><polyline points="2.32 6.16 12 11 21.68 6.16"/><line x1="12" y1="22.76" x2="12" y2="11"/>'),
  'ship':         svg('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>'),
  'custom':       svg('<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41"/><path d="M4.93 4.93l1.41 1.41"/><path d="M19.07 19.07l-1.41-1.41"/><path d="M4.93 19.07l1.41-1.41"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M2 12h2"/><path d="M20 12h2"/>'),
  'default':      svg('<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'),
};

function getIcon(title: string): string {
  const lower = title.toLowerCase();
  // Longest-match first — compound keywords (haircut, coloring, styling…)
  // beat generic fallbacks (hair, color, style…) automatically.
  const sortedKeys = Object.keys(FEATURE_ICONS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (key !== 'default' && lower.includes(key)) return FEATURE_ICONS[key];
  }
  return FEATURE_ICONS.default;
}


function renderSection(section: AeoSection, entityMap: EntityMap, index: number): string {
  const isHero    = section.type === 'hero';
  const isCta     = section.type === 'cta';
  const isFaq     = section.type === 'faq';
  const isFeatures = section.type === 'features' || section.type === 'services';
  const isAbout   = section.type === 'about';
  const isTestimonials = section.type === 'testimonials';
  const isFirst   = index === 0;
  const delay     = Math.min(index, 4);

  // ── Hero ──────────────────────────────────────────────────────────────────
  if (isHero) {
    const words = section.heading.split(' ');
    const mid = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(' ');
    const line2 = words.slice(mid).join(' ');
    const bodyHtml = section.body
      ? `<p class="hero-sub fade-in fade-in-2">${section.body}</p>`
      : '';
    return `
<section class="hero-section" aria-label="Hero" data-section="hero">
  <div class="container">
    <div class="hero-section__inner">
      <div class="hero-badge fade-in fade-in-1">${entityMap.industry}</div>
      <h1 class="fade-in fade-in-2">${line1}${line2 ? ` <em>${line2}</em>` : ''}</h1>
      ${bodyHtml}
      ${section.isList && section.listItems?.length
        ? `<ul class="checklist fade-in fade-in-3">${section.listItems.slice(0, 4).map(i => `<li>${i}</li>`).join('')}</ul>`
        : ''}
      <div class="hero-actions fade-in fade-in-4">
        <a href="#contact" class="btn btn-primary">Get Started →</a>
        <a href="#services" class="btn btn-outline">Learn More</a>
      </div>
    </div>
  </div>
</section>`.trim();
  }

  // ── CTA ───────────────────────────────────────────────────────────────────
  if (isCta) {
    const bodyP = section.body
      ? `<p>${section.body}</p>`
      : '';
    return `
<section class="cta-section" id="contact" aria-labelledby="cta-heading" data-section="cta">
  <div class="container">
    <div class="cta-section__inner">
      <div>
        <span class="section-eyebrow" style="color:rgba(255,255,255,0.6)">Get Started</span>
        <${section.headingLevel} id="cta-heading">${section.heading}</${section.headingLevel}>
        ${bodyP}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:center">
        <a href="mailto:hello@${entityMap.businessName.toLowerCase().replace(/\s+/g, '')}.com" class="btn btn-ghost">Contact Us →</a>
        <a href="#services" class="btn" style="background:rgba(255,255,255,0.15);color:inherit;border:1px solid rgba(255,255,255,0.25)">View Services</a>
      </div>
    </div>
  </div>
</section>`.trim();
  }

  // ── FAQ ───────────────────────────────────────────────────────────────────
  if (isFaq && section.isList && section.listItems?.length) {
    const items = section.listItems.map((item, i) => {
      const qi = item.indexOf('?');
      const q = qi !== -1 ? item.slice(0, qi + 1).trim() : `Question ${i + 1}`;
      const a = qi !== -1 ? item.slice(qi + 1).trim() : item;
      return `
<div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
  <details>
    <summary itemprop="name">${q}</summary>
    <div class="faq-answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">${a}</p>
    </div>
  </details>
</div>`.trim();
    }).join('\n');

    return `
<section id="faq" aria-labelledby="faq-heading" data-section="faq">
  <div class="container">
    <span class="section-eyebrow">FAQ</span>
    <${section.headingLevel} id="faq-heading">${section.heading}</${section.headingLevel}>
    ${section.body ? `<p>${section.body}</p>` : ''}
    <div class="faq-list" itemscope itemtype="https://schema.org/FAQPage">
      ${items}
    </div>
  </div>
</section>`.trim();
  }

  // ── Features / Services ───────────────────────────────────────────────────
  if (isFeatures && section.isList && section.listItems?.length) {
    const cardList = section.listItems.map(item => {
      const colonIdx = item.indexOf(':');
      const title = colonIdx !== -1 ? item.slice(0, colonIdx).trim() : item;
      const desc  = colonIdx !== -1 ? item.slice(colonIdx + 1).trim() : '';
      const icon  = getIcon(title);
      return `
<article class="feature-card">
  <div class="feature-card__icon">${icon}</div>
  <h3>${title}</h3>
  ${desc ? `<p>${desc}</p>` : ''}
</article>`.trim();
    }).join('\n');

    const sectionId = section.type === 'services' ? 'services' : 'features';
    return `
<section id="${sectionId}" aria-labelledby="${sectionId}-heading" data-section="${sectionId}">
  <div class="container">
    <span class="section-eyebrow">${section.type === 'services' ? 'Our Services' : 'Features'}</span>
    <${section.headingLevel} id="${sectionId}-heading" style="max-width:28ch">${section.heading}</${section.headingLevel}>
    ${section.body ? `<div class="answer-capsule"><p>${section.body}</p></div>` : ''}
    <div class="features-grid">
      ${cardList}
    </div>
  </div>
</section>`.trim();
  }

  // ── About ─────────────────────────────────────────────────────────────────
  if (isAbout) {
    const listHtml = section.isList && section.listItems?.length
      ? `<ul class="checklist">${section.listItems.map(i => `<li>${i}</li>`).join('')}</ul>`
      : '';
    return `
<section id="about" aria-labelledby="about-heading" data-section="about">
  <div class="container">
    <div class="about-section__inner">
      <div>
        <span class="section-eyebrow">About Us</span>
        <${section.headingLevel} id="about-heading">${section.heading}</${section.headingLevel}>
        ${section.body ? `<div class="answer-capsule"><p>${section.body}</p></div>` : ''}
        ${listHtml}
      </div>
      <div class="stats-row">
        <div class="stat-item"><span class="stat-item__number">10+</span><span class="stat-item__label">Years Experience</span></div>
        <div class="stat-item"><span class="stat-item__number">500+</span><span class="stat-item__label">Clients Served</span></div>
        <div class="stat-item"><span class="stat-item__number">98%</span><span class="stat-item__label">Satisfaction Rate</span></div>
        <div class="stat-item"><span class="stat-item__number">24/7</span><span class="stat-item__label">Support</span></div>
      </div>
    </div>
  </div>
</section>`.trim();
  }

  // ── Testimonials ──────────────────────────────────────────────────────────
  if (isTestimonials && section.isList && section.listItems?.length) {
    const cards = section.listItems.map(item => {
      const dashIdx = item.lastIndexOf('—');
      const quote  = dashIdx !== -1 ? item.slice(0, dashIdx).trim() : item;
      const author = dashIdx !== -1 ? item.slice(dashIdx + 1).trim() : 'Happy Client';
      return `
<div class="testimonial-card" itemscope itemtype="https://schema.org/Review">
  <p itemprop="reviewBody">${quote}</p>
  <span class="testimonial-card__author" itemprop="author">${author}</span>
</div>`.trim();
    }).join('\n');

    return `
<section id="testimonials" aria-labelledby="testimonials-heading" data-section="testimonials">
  <div class="container">
    <span class="section-eyebrow">Testimonials</span>
    <${section.headingLevel} id="testimonials-heading">${section.heading}</${section.headingLevel}>
    <div class="testimonials-grid">${cards}</div>
  </div>
</section>`.trim();
  }

  // ── Generic ───────────────────────────────────────────────────────────────
  const listHtml = section.isList && section.listItems?.length
    ? `<ul class="checklist">${section.listItems.map(i => `<li>${i}</li>`).join('')}</ul>`
    : '';
  const bodyHtml = section.body
    ? (isFirst
        ? `<div class="answer-capsule"><p>${section.body}</p></div>`
        : `<p>${section.body}</p>`)
    : '';

  return `
<section id="${section.type}-${delay}" aria-labelledby="${section.type}-${delay}-heading" class="fade-in fade-in-${delay}">
  <div class="container">
    <${section.headingLevel} id="${section.type}-${delay}-heading">${section.heading}</${section.headingLevel}>
    ${bodyHtml}
    ${listHtml}
  </div>
</section>`.trim();
}

// ── Option 3: Nav variant CSS ──────────────────────────────────────────────────

function stackedNavCss(): string {
  return `
    /* ─── Stacked Display Nav ───────────────────────────────────── */
    .site-nav {
      position: static;
      background: var(--c-surface);
      border-bottom: 1px solid var(--c-border);
      padding: 1.5rem 0 0;
    }
    .site-nav__inner {
      display: block;
      padding-block: 0;
    }
    .site-nav__top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding-bottom: 1rem;
    }
    .site-nav__brand {
      font-family: var(--f-heading);
      font-weight: 800;
      font-size: 1rem;
      color: var(--c-text);
      text-decoration: none;
      letter-spacing: -0.02em;
    }
    .site-nav__phone {
      font-family: var(--f-body);
      font-size: 0.875rem;
      color: var(--c-text);
      text-decoration: none;
      opacity: 0.7;
    }
    .site-nav__links {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0;
      list-style: none;
      padding: 0;
      margin: 0;
      border-top: 1px solid var(--c-border);
      padding-top: 0.75rem;
      padding-bottom: 1.25rem;
    }
    .site-nav__links li { display: inline; }
    .site-nav__links a {
      font-family: var(--f-heading);
      font-size: clamp(1.75rem, 4.5vw, 3.25rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.1;
      text-decoration: none;
      color: var(--c-text);
      margin-right: 0.6em;
      transition: opacity 150ms;
    }
    .site-nav__links a:hover { opacity: 0.5; }
    .site-nav__cta { display: none; }
  `;
}

function minimalNavCss(): string {
  return `
    /* ─── Minimal Nav ───────────────────────────────────────────── */
    .site-nav {
      position: sticky; top: 0; z-index: 100;
      background: var(--c-surface);
      padding: 0;
    }
    .site-nav__inner {
      display: flex; align-items: center;
      justify-content: space-between;
      padding-block: 1.25rem;
    }
    .site-nav__brand {
      font-family: var(--f-heading);
      font-weight: 800;
      font-size: 1.1rem;
      color: var(--c-text);
      text-decoration: none;
    }
    .site-nav__links { display: none; }
  `;
}

// ── Option 4: Brand-First HTML Skeleton ────────────────────────────────────────

/**
 * Injects AEO content into the original HTML skeleton:
 * - Replaces <title> and <meta name="description">
 * - Injects JSON-LD blocks into <head>
 * - Injects an AEO summary panel just after <body>
 * - Appends ALIAS attribution comment
 */
function buildHtmlFromSkeleton(
  originalHtml: string,
  aeoContent: AeoContent,
  originalUrl: string,
  fetchedStylesheets: string[] = [],
  geminiLayoutCss: string = ""
): string {
  let html = originalHtml;

  // 0. Inject <base href> so relative CSS/image/font paths resolve against
  //    the original domain, not our localhost preview server.
  const origin = (() => {
    try { return new URL(originalUrl).origin + '/'; } catch { return ''; }
  })();
  if (origin && !/<base[\s]/i.test(html)) {
    html = html.replace(/(<head[^>]*>)/i, (m) => m + '\n  <base href="' + origin + '">');
  }

  // 1. Replace <title>
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escHtml(aeoContent.title)}</title>`);

  // 2. Replace or inject <meta name="description">
  const descTag = `<meta name="description" content="${escHtml(aeoContent.metaDescription)}">`;
  if (/<meta\s+name=["']description["']/i.test(html)) {
    html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, descTag);
  } else {
    html = html.replace('</head>', `  ${descTag}\n</head>`);
  }

  // 3a. Option C — inject real fetched stylesheets first (original selectors preserved)
  if (fetchedStylesheets.length > 0) {
    const realCssBlock = fetchedStylesheets
      .map(css => '<style>\n/* ALIAS: real stylesheet (Option C) */\n' + css + '\n</style>')
      .join('\n');
    html = html.replace('</head>', realCssBlock + '\n</head>');
  }

  // 3b. Option A — Gemini screenshot-driven layout CSS as an override layer
  //     Comes after real CSS so it can fill gaps from JS-injected / missing styles.
  if (geminiLayoutCss.trim()) {
    const cleanCss = geminiLayoutCss
      .replace(/^```css\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const geminiBlock =
      '<style id="alias-layout-override">\n/* ALIAS: screenshot-driven layout (Option A) */\n' +
      cleanCss + '\n</style>';
    html = html.replace('</head>', geminiBlock + '\n</head>');
  }

  // 3c. Inject JSON-LD + attribution
  const jsonLdBlocks = aeoContent.jsonLd.map(schema =>
    `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`
  ).join('\n');
  html = html.replace('</head>', `${jsonLdBlocks}\n  <!-- Rebuilt by ALIAS COMPILER — AEO Optimised | Source: ${originalUrl} -->\n</head>`);

  // 4. Inject an AEO answer capsule right after <body>
  const capsule = `
<!-- ALIAS COMPILER: AEO Answer Capsule -->
<div id="alias-aeo-capsule" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;" aria-hidden="true">
  <h1>${escHtml(aeoContent.h1)}</h1>
  <p>${escHtml(aeoContent.sections[0]?.body || aeoContent.metaDescription)}</p>
</div>`;
  html = html.replace(/<body[^>]*>/i, (match) => `${match}\n${capsule}`);

  return html;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Font link injection helper (Option 1) ─────────────────────────────────────

function buildFontTags(detectedFontLinks: string[]): string {
  if (detectedFontLinks.length === 0) return '';
  // Deduplicate and emit <link> tags, adding preconnect for known font CDNs
  const preconnects = new Set<string>();
  const links: string[] = [];

  for (const href of detectedFontLinks) {
    if (href.includes('googleapis.com') || href.includes('gstatic.com')) {
      preconnects.add('https://fonts.googleapis.com');
      preconnects.add('https://fonts.gstatic.com');
    } else if (href.includes('typekit.net')) {
      preconnects.add('https://use.typekit.net');
    } else if (href.includes('bunny.net')) {
      preconnects.add('https://fonts.bunny.net');
    }
    links.push(`  <link rel="stylesheet" href="${href}">`);
  }

  const preConnectTags = [...preconnects].map(origin =>
    `  <link rel="preconnect" href="${origin}" crossorigin>`
  ).join('\n');

  return `${preConnectTags}\n${links.join('\n')}`;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export interface BuildOptions {
  detectedFontLinks?: string[];  // Option 1: inject real font <link> tags
  fidelityMode?: 'aeo-first' | 'brand-first';  // Option 5
  originalHtml?: string;         // Option 4: skeleton source
  fetchedStylesheets?: string[]; // Option C: raw CSS fetched from same-origin stylesheets
  geminiLayoutCss?: string;      // Option A: CSS generated from screenshot by Gemini
  /** Brand DNA — when present, drives semantic CSS tokens (60-30-10 palette) */
  brandDna?: BrandDNA;
}

export function buildHtml(
  tokens: DesignTokens,
  aeoContent: AeoContent,
  entityMap: EntityMap,
  originalUrl: string,
  options: BuildOptions = {}
): string {
  const { detectedFontLinks = [], fidelityMode = 'aeo-first', originalHtml,
          fetchedStylesheets = [], geminiLayoutCss = '', brandDna } = options;

  // ── Option 4: Brand-First — use original HTML as skeleton ──────────────────
  if (fidelityMode === 'brand-first' && originalHtml && originalHtml.length > 500) {
    return buildHtmlFromSkeleton(originalHtml, aeoContent, originalUrl, fetchedStylesheets, geminiLayoutCss);
  }

  // ── AEO-First: generate from design tokens ─────────────────────────────────
  const navStyle = tokens.layout.navStyle || 'horizontal';

  // Option 1: Use real detected font links if available, else fall back to Google Fonts construction
  const fontTags = detectedFontLinks.length > 0
    ? buildFontTags(detectedFontLinks)
    : `  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${googleFontsLink(tokens)}" rel="stylesheet">`;

  // Option 3: Extra CSS for stacked/minimal nav variants
  let navVariantCss = '';
  if (navStyle === 'stacked-display') navVariantCss = stackedNavCss();
  else if (navStyle === 'minimal') navVariantCss = minimalNavCss();

  const css = cssFromTokens(tokens, brandDna) + navVariantCss;

  const jsonLdBlocks = aeoContent.jsonLd.map(schema =>
    `  <script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n  </script>`
  ).join('\n');

  const navLinks = aeoContent.sections
    .filter(s => ['features', 'services', 'about', 'faq', 'testimonials'].includes(s.type))
    .slice(0, 5)
    .map(s => `<li><a href="#${s.type}">${s.heading.split(' ').slice(0, 3).join(' ')}</a></li>`)
    .join('');

  // Option 3: Render nav HTML based on navStyle
  const navHtml = navStyle === 'stacked-display'
    ? `  <header>
    <nav class="site-nav" id="site-nav" role="navigation" aria-label="Main navigation">
      <div class="container">
        <div class="site-nav__inner">
          <div class="site-nav__top">
            <a href="#" class="site-nav__brand">${entityMap.businessName}</a>
          </div>
          <ul class="site-nav__links" role="list">
            ${navLinks}
          </ul>
        </div>
      </div>
    </nav>
  </header>`
    : navStyle === 'minimal'
    ? `  <header>
    <nav class="site-nav" id="site-nav" role="navigation" aria-label="Main navigation">
      <div class="container">
        <div class="site-nav__inner">
          <a href="#" class="site-nav__brand">${entityMap.businessName}</a>
        </div>
      </div>
    </nav>
  </header>`
    : `  <header>
    <nav class="site-nav" id="site-nav" role="navigation" aria-label="Main navigation">
      <div class="container">
        <div class="site-nav__inner">
          <a href="#" class="site-nav__brand" aria-label="${entityMap.businessName} homepage">
            ${entityMap.businessName}
          </a>
          <ul class="site-nav__links" role="list">
            ${navLinks}
          </ul>
          <a href="#contact" class="site-nav__cta">Get Started</a>
        </div>
      </div>
    </nav>
  </header>`;

  const sections = aeoContent.sections
    .map((s, i) => renderSection(s, entityMap, i))
    .join('\n\n');

  const year = new Date().getFullYear();
  const entities = entityMap.entities.slice(0, 5);
  const entityLinks = entities.map(e => `<li><a href="#">${e}</a></li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${aeoContent.title}</title>
  <meta name="description" content="${aeoContent.metaDescription}">
  <meta name="robots" content="index, follow">
  <meta property="og:title" content="${aeoContent.title}">
  <meta property="og:description" content="${aeoContent.metaDescription}">
  <meta property="og:type" content="website">
${fontTags}
${jsonLdBlocks}
  <!-- Rebuilt by ALIAS COMPILER — AEO Optimised | Mode: ${fidelityMode} | Source: ${originalUrl} -->
  <style>
${css}
  </style>
</head>
<body>

${navHtml}

  <!-- Main content -->
  <main id="main-content">
    ${sections}
  </main>

  <!-- Footer -->
  <footer class="site-footer" role="contentinfo">
    <div class="container">
      <div class="site-footer__inner">
        <div>
          <a href="#" class="site-footer__brand">${entityMap.businessName}</a>
          <p class="site-footer__tagline">${entityMap.primaryService} — serving ${entityMap.targetAudience}.</p>
        </div>
        <div>
          <p class="site-footer__col-title">Expertise</p>
          <ul class="site-footer__links" role="list">
            ${entityLinks}
          </ul>
        </div>
        <div>
          <p class="site-footer__col-title">Industry</p>
          <ul class="site-footer__links" role="list">
            <li><a href="#">${entityMap.industry}</a></li>
            <li><a href="#">${entityMap.primaryService}</a></li>
            <li><a href="#">Contact Us</a></li>
          </ul>
        </div>
      </div>
      <div class="site-footer__bottom">
        <p class="site-footer__copy">© ${year} ${entityMap.businessName}. All rights reserved.</p>
        <a href="https://alias.build" class="alias-badge" rel="noopener noreferrer">
          <span class="alias-badge__dot"></span>
          Built with ALIAS COMPILER
        </a>
      </div>
    </div>
  </footer>

  <script>
    var nav = document.getElementById('site-nav');
    if (nav) {
      window.addEventListener('scroll', function() {
        nav.classList.toggle('scrolled', window.scrollY > 10);
      }, { passive: true });
    }
  </script>

</body>
</html>`;
}

