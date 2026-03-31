import { AeoContent, AeoSection, DesignTokens, EntityMap } from './types';

function cssFromTokens(tokens: DesignTokens): string {
  const { colors, typography, spacing } = tokens;

  // Derive a slightly darker version of primary for hover states
  return `
    /* ─── Design Tokens ─────────────────────────────────────────── */
    :root {
      --c-primary:   ${colors.primary};
      --c-secondary: ${colors.secondary};
      --c-surface:   ${colors.surface};
      --c-text:      ${colors.text};
      --c-accent:    ${colors.accent};
      --c-border:    ${colors.border || 'rgba(0,0,0,0.08)'};

      --f-heading: '${typography.headingFont}', system-ui, -apple-system, sans-serif;
      --f-body:    '${typography.bodyFont}', system-ui, -apple-system, sans-serif;
      --f-size:    ${typography.baseSizePx}px;
      --f-scale:   ${typography.scaleRatio || 1.25};

      --w-container: min(${spacing.containerWidthPx}px, 100%);
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

    p { margin-bottom: 1rem; max-width: 66ch; line-height: 1.75; }
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
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--c-primary) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--c-primary) 20%, transparent);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1rem;
      font-size: 1.25rem;
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
const FEATURE_ICONS: Record<string, string> = {
  default: '◈',
  speed: '⚡',
  security: '🔒',
  data: '📊',
  ai: '🤖',
  cloud: '☁',
  mobile: '📱',
  integration: '🔗',
  analytics: '📈',
  support: '💬',
  team: '👥',
  automation: '⚙',
};

function getIcon(title: string): string {
  const lower = title.toLowerCase();
  for (const [key, icon] of Object.entries(FEATURE_ICONS)) {
    if (lower.includes(key)) return icon;
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
<section class="hero-section" aria-label="Hero">
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
<section class="cta-section" id="contact" aria-labelledby="cta-heading">
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
<section id="faq" aria-labelledby="faq-heading">
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
<section id="${sectionId}" aria-labelledby="${sectionId}-heading">
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
<section id="about" aria-labelledby="about-heading">
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
<section id="testimonials" aria-labelledby="testimonials-heading">
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

export function buildHtml(
  tokens: DesignTokens,
  aeoContent: AeoContent,
  entityMap: EntityMap,
  originalUrl: string
): string {
  const css = cssFromTokens(tokens);
  const fontsHref = googleFontsLink(tokens);

  const jsonLdBlocks = aeoContent.jsonLd.map(schema =>
    `  <script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n  </script>`
  ).join('\n');

  const navLinks = aeoContent.sections
    .filter(s => ['features', 'services', 'about', 'faq', 'testimonials'].includes(s.type))
    .slice(0, 4)
    .map(s => {
      const id = s.type;
      const label = s.heading.split(' ').slice(0, 3).join(' ');
      return `<li><a href="#${id}">${label}</a></li>`;
    })
    .join('');

  const sections = aeoContent.sections
    .map((s, i) => renderSection(s, entityMap, i))
    .join('\n\n');

  const year = new Date().getFullYear();
  const industry = entityMap.industry;
  const entities = entityMap.entities.slice(0, 5);

  // Footer column 2: entity tags as nav links
  const entityLinks = entities
    .map(e => `<li><a href="#">${e}</a></li>`)
    .join('');

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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${fontsHref}" rel="stylesheet">
${jsonLdBlocks}
  <!-- Rebuilt by ALIAS COMPILER — AEO Optimised | Source: ${originalUrl} -->
  <style>
${css}
  </style>
</head>
<body>

  <!-- Navigation -->
  <header>
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
  </header>

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
            <li><a href="#">${industry}</a></li>
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
    // Sticky nav shadow on scroll
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
