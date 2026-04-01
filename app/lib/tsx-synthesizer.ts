/**
 * TSX Synthesizer
 *
 * Converts AeoContent + BrandDNA + EntityMap into production-ready
 * TypeScript + Tailwind CSS source files:
 *
 *   - tailwind.config.ts  (brand colour palette + font families)
 *   - src/app/globals.css  (base styles, font imports, brand CSS vars)
 *   - src/app/[slug]/page.tsx  (full page React component with Tailwind classes)
 */

import { AeoContent, AeoSection, BrandDNA, EntityMap } from './types';

export interface CodeFile {
  name: string;
  language: 'tsx' | 'ts' | 'css';
  content: string;
}

// ── tailwind.config.ts ────────────────────────────────────────────────────────

export function buildTailwindConfig(dna: BrandDNA): CodeFile {
  const content = `import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          // 60-30-10 colour palette extracted from ${dna.brandName}
          dominant:   '${dna.palette.dominant}',   // 60% — primary surface
          supporting: '${dna.palette.supporting}', // 30% — nav, structure
          accent:     '${dna.palette.accent}',     // 10% — CTAs, highlights
          text:       '${dna.palette.text}',
          muted:      '${dna.palette.textMuted}',
        },
      },
      fontFamily: {
        heading: ['"${dna.typePairing.heading}"', 'system-ui', 'sans-serif'],
        body:    ['"${dna.typePairing.body}"',    'system-ui', 'sans-serif'],
      },
      maxWidth: {
        container: '1280px',
      },
    },
  },
  plugins: [],
};

export default config;
`;
  return { name: 'tailwind.config.ts', language: 'ts', content };
}

// ── globals.css ───────────────────────────────────────────────────────────────

export function buildGlobalsCss(dna: BrandDNA): CodeFile {
  const headingFont = dna.typePairing.heading.replace(/"/g, '');
  const bodyFont    = dna.typePairing.body.replace(/"/g, '');
  const fontsQuery  = [...new Set([headingFont, bodyFont])]
    .map(f => f.replace(/ /g, '+'))
    .join('&family=');

  const content = `@tailwind base;
@tailwind components;
@tailwind utilities;

/* Brand DNA: ${dna.brandName} — ${dna.industry} — ${dna.voiceTone} */
@import url('https://fonts.googleapis.com/css2?family=${fontsQuery}:wght@300;400;500;600;700;800&display=swap');

/* ── Semantic brand tokens (60-30-10) ─────────────── */
:root {
  --color-brand-dominant:   ${dna.palette.dominant};
  --color-brand-supporting: ${dna.palette.supporting};
  --color-brand-accent:     ${dna.palette.accent};
  --color-brand-text:       ${dna.palette.text};
  --color-brand-muted:      ${dna.palette.textMuted};
  --font-heading:           '${headingFont}', system-ui, sans-serif;
  --font-body:              '${bodyFont}', system-ui, sans-serif;
}

/* ── Base ─────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }

html {
  scroll-behavior: smooth;
  -webkit-text-size-adjust: 100%;
}

body {
  font-family: var(--font-body);
  background-color: var(--color-brand-dominant);
  color: var(--color-brand-text);
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  line-height: 1.2;
  font-weight: 700;
}

/* ── Utilities ────────────────────────────────────── */
.container {
  width: 100%;
  max-width: 1280px;
  margin-inline: auto;
  padding-inline: 1.5rem;
}

@media (min-width: 1024px) {
  .container { padding-inline: 2rem; }
}
`;
  return { name: 'src/app/globals.css', language: 'css', content };
}

// ── Section renderers → TSX ───────────────────────────────────────────────────

function renderHeroTsx(s: AeoSection, em: EntityMap): string {
  const items = s.isList && s.listItems?.length
    ? `\n          <ul className="flex flex-col gap-2 mb-10">
${s.listItems.slice(0, 4).map(i => `            <li className="flex items-center gap-2 text-brand-muted"><span className="text-brand-accent">✓</span> ${i}</li>`).join('\n')}
          </ul>` : '';

  return `      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="min-h-screen bg-brand-dominant flex items-center py-24">
        <div className="container">
          <div className="max-w-2xl">
            <div className="inline-flex items-center px-3 py-1 rounded-full border border-brand-accent/30 text-brand-accent text-sm font-medium mb-8">
              ${em.industry}
            </div>
            <h1 className="font-heading text-5xl lg:text-7xl font-bold text-brand-supporting leading-tight mb-6">
              ${s.heading}
            </h1>
            ${s.body ? `<p className="text-brand-muted text-lg leading-relaxed mb-10">\n              ${s.body}\n            </p>` : ''}${items}
            <div className="flex flex-wrap gap-4">
              <a
                href="#contact"
                className="px-6 py-3 bg-brand-accent text-brand-dominant font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Get Started →
              </a>
              <a
                href="#services"
                className="px-6 py-3 border border-brand-supporting/20 text-brand-supporting rounded-lg hover:border-brand-supporting/50 transition-colors"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>`;
}

function renderFeaturesTsx(s: AeoSection): string {
  const sectionId = s.type === 'services' ? 'services' : 'features';
  const cards = (s.listItems ?? []).map(item => {
    const colonIdx = item.indexOf(':');
    const title    = colonIdx !== -1 ? item.slice(0, colonIdx).trim() : item;
    const desc     = colonIdx !== -1 ? item.slice(colonIdx + 1).trim() : '';
    return `            <div className="bg-brand-dominant/50 border border-brand-supporting/10 rounded-2xl p-6 hover:border-brand-accent/30 transition-colors group">
              <h3 className="font-heading text-brand-supporting font-semibold text-lg mb-2 group-hover:text-brand-accent transition-colors">
                ${title}
              </h3>
              ${desc ? `<p className="text-brand-muted text-sm leading-relaxed">${desc}</p>` : ''}
            </div>`;
  }).join('\n');

  return `      {/* ── ${s.type === 'services' ? 'Services' : 'Features'} ──────────────────────────────────────────── */}
      <section id="${sectionId}" className="py-24 bg-brand-supporting/5">
        <div className="container">
          <span className="text-brand-accent text-sm font-semibold uppercase tracking-widest mb-4 block">
            ${s.type === 'services' ? 'Our Services' : 'Features'}
          </span>
          <${s.headingLevel} className="font-heading text-4xl lg:text-5xl font-bold text-brand-supporting max-w-xl mb-6">
            ${s.heading}
          </${s.headingLevel}>
          ${s.body ? `<p className="text-brand-muted text-lg max-w-2xl mb-12">${s.body}</p>` : ''}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
${cards}
          </div>
        </div>
      </section>`;
}

function renderAboutTsx(s: AeoSection): string {
  const list = s.isList && s.listItems?.length
    ? `\n          <ul className="flex flex-col gap-3 mb-8">
${s.listItems.map(i => `            <li className="flex items-start gap-3 text-brand-muted"><span className="text-brand-accent mt-0.5">✓</span> ${i}</li>`).join('\n')}
          </ul>` : '';

  return `      {/* ── About ─────────────────────────────────────────────── */}
      <section id="about" className="py-24 bg-brand-dominant">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-brand-accent text-sm font-semibold uppercase tracking-widest mb-4 block">About Us</span>
              <${s.headingLevel} className="font-heading text-4xl lg:text-5xl font-bold text-brand-supporting mb-6">
                ${s.heading}
              </${s.headingLevel}>
              ${s.body ? `<p className="text-brand-muted text-lg leading-relaxed mb-6">${s.body}</p>` : ''}${list}
            </div>
            <div className="grid grid-cols-2 gap-6">
              {[
                { number: '10+', label: 'Years Experience' },
                { number: '500+', label: 'Clients Served' },
                { number: '98%', label: 'Satisfaction Rate' },
                { number: '24/7', label: 'Support' },
              ].map((stat) => (
                <div key={stat.label} className="bg-brand-supporting/5 border border-brand-supporting/10 rounded-2xl p-6 text-center">
                  <p className="font-heading text-3xl font-bold text-brand-accent mb-1">{stat.number}</p>
                  <p className="text-brand-muted text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>`;
}

function renderCtaTsx(s: AeoSection, em: EntityMap): string {
  return `      {/* ── CTA ──────────────────────────────────────────────── */}
      <section id="contact" className="py-24 bg-brand-supporting">
        <div className="container">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div>
              <span className="text-brand-accent text-sm font-semibold uppercase tracking-widest mb-4 block opacity-70">Get Started</span>
              <${s.headingLevel} className="font-heading text-4xl lg:text-5xl font-bold text-brand-dominant mb-4">
                ${s.heading}
              </${s.headingLevel}>
              ${s.body ? `<p className="text-brand-dominant/70 text-lg max-w-xl">${s.body}</p>` : ''}
            </div>
            <div className="flex flex-wrap gap-4 flex-shrink-0">
              <a
                href="mailto:hello@${em.businessName.toLowerCase().replace(/\s+/g, '')}.com"
                className="px-6 py-3 bg-brand-accent text-brand-dominant font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Contact Us →
              </a>
              <a
                href="#services"
                className="px-6 py-3 border border-brand-dominant/20 text-brand-dominant rounded-lg hover:border-brand-dominant/50 transition-colors"
              >
                View Services
              </a>
            </div>
          </div>
        </div>
      </section>`;
}

function renderFaqTsx(s: AeoSection): string {
  const items = (s.listItems ?? []).map((item, i) => {
    const qi = item.indexOf('?');
    const q  = qi !== -1 ? item.slice(0, qi + 1).trim() : `Question ${i + 1}`;
    const a  = qi !== -1 ? item.slice(qi + 1).trim() : item;
    return `            <details className="border border-brand-supporting/10 rounded-xl overflow-hidden group">
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer font-heading font-semibold text-brand-supporting hover:text-brand-accent transition-colors list-none">
                ${q}
                <span className="text-brand-accent group-open:rotate-45 transition-transform">+</span>
              </summary>
              <div className="px-6 pb-5 text-brand-muted leading-relaxed">
                ${a}
              </div>
            </details>`;
  }).join('\n');

  return `      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section id="faq" className="py-24 bg-brand-supporting/5">
        <div className="container">
          <span className="text-brand-accent text-sm font-semibold uppercase tracking-widest mb-4 block">FAQ</span>
          <${s.headingLevel} className="font-heading text-4xl lg:text-5xl font-bold text-brand-supporting mb-12">
            ${s.heading}
          </${s.headingLevel}>
          <div className="flex flex-col gap-3 max-w-3xl">
${items}
          </div>
        </div>
      </section>`;
}

function renderTestimonialsTsx(s: AeoSection): string {
  const cards = (s.listItems ?? []).map(item => {
    const dashIdx = item.lastIndexOf('—');
    const quote   = dashIdx !== -1 ? item.slice(0, dashIdx).trim() : item;
    const author  = dashIdx !== -1 ? item.slice(dashIdx + 1).trim() : 'Happy Client';
    return `            <div className="bg-brand-dominant border border-brand-supporting/10 rounded-2xl p-6">
              <p className="text-brand-muted italic leading-relaxed mb-4">"{quote}"</p>
              <p className="text-brand-supporting font-semibold text-sm">— ${author}</p>
            </div>`.replace('{quote}', quote);
  }).join('\n');

  return `      {/* ── Testimonials ──────────────────────────────────────── */}
      <section id="testimonials" className="py-24 bg-brand-dominant">
        <div className="container">
          <span className="text-brand-accent text-sm font-semibold uppercase tracking-widest mb-4 block">Testimonials</span>
          <${s.headingLevel} className="font-heading text-4xl lg:text-5xl font-bold text-brand-supporting mb-12">
            ${s.heading}
          </${s.headingLevel}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
${cards}
          </div>
        </div>
      </section>`;
}

function renderGenericTsx(s: AeoSection): string {
  const list = s.isList && s.listItems?.length
    ? `\n          <ul className="flex flex-col gap-2 mt-6">
${s.listItems.map(i => `            <li className="flex items-start gap-2 text-brand-muted"><span className="text-brand-accent">•</span> ${i}</li>`).join('\n')}
          </ul>` : '';

  return `      {/* ── ${s.heading} ─────────────────────────────────────── */}
      <section className="py-24 bg-brand-dominant">
        <div className="container max-w-3xl">
          <${s.headingLevel} className="font-heading text-4xl font-bold text-brand-supporting mb-6">
            ${s.heading}
          </${s.headingLevel}>
          ${s.body ? `<p className="text-brand-muted text-lg leading-relaxed">${s.body}</p>` : ''}${list}
        </div>
      </section>`;
}

function renderSectionTsx(s: AeoSection, em: EntityMap): string {
  switch (s.type) {
    case 'hero':         return renderHeroTsx(s, em);
    case 'features':
    case 'services':     return renderFeaturesTsx(s);
    case 'about':        return renderAboutTsx(s);
    case 'cta':          return renderCtaTsx(s, em);
    case 'faq':          return renderFaqTsx(s);
    case 'testimonials': return renderTestimonialsTsx(s);
    default:             return renderGenericTsx(s);
  }
}

// ── page.tsx ──────────────────────────────────────────────────────────────────

export function buildPageTsx(
  aeoContent: AeoContent,
  entityMap: EntityMap,
  dna: BrandDNA,
  slug: string,
): CodeFile {
  const sections = aeoContent.sections
    .map(s => renderSectionTsx(s, entityMap))
    .join('\n\n');

  const year = new Date().getFullYear();
  const navItems = aeoContent.sections
    .filter(s => ['features', 'services', 'about', 'faq', 'testimonials'].includes(s.type))
    .slice(0, 5)
    .map(s => `{ label: '${s.heading.split(' ').slice(0, 3).join(' ')}', href: '#${s.type}' }`)
    .join(',\n    ');

  const content = `import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '${aeoContent.title}',
  description: '${aeoContent.metaDescription}',
};

${aeoContent.jsonLd.length > 0 ? `// Structured data for AEO
const jsonLd = ${JSON.stringify(aeoContent.jsonLd[0], null, 2)};` : ''}

const NAV_ITEMS = [
  ${navItems || "{ label: 'Home', href: '#' }"}
];

export default function ${slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Page() {
  return (
    <>
      {${aeoContent.jsonLd.length > 0 ? `/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/*` : `/*`} ── Navigation ──────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-brand-supporting/10 bg-brand-dominant/90 backdrop-blur-md">
        <nav className="container flex items-center justify-between py-4">
          <a href="/" className="font-heading text-xl font-bold text-brand-supporting hover:text-brand-accent transition-colors">
            ${entityMap.businessName}
          </a>
          <ul className="hidden md:flex items-center gap-8">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="text-brand-muted text-sm hover:text-brand-supporting transition-colors"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="#contact"
            className="px-4 py-2 bg-brand-accent text-brand-dominant text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Get Started
          </a>
        </nav>
      </header>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="pt-16">
${sections}
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-brand-supporting py-16">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div>
              <p className="font-heading text-xl font-bold text-brand-dominant mb-3">
                ${entityMap.businessName}
              </p>
              <p className="text-brand-dominant/60 text-sm leading-relaxed">
                ${entityMap.primaryService} — serving ${entityMap.targetAudience}.
              </p>
            </div>
            <div>
              <p className="text-brand-dominant/40 text-xs uppercase tracking-widest font-semibold mb-4">Services</p>
              <ul className="flex flex-col gap-2">
                {${JSON.stringify(entityMap.entities.slice(0, 5))}.map((e: string) => (
                  <li key={e}>
                    <a href="#" className="text-brand-dominant/70 text-sm hover:text-brand-dominant transition-colors">{e}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-brand-dominant/40 text-xs uppercase tracking-widest font-semibold mb-4">Industry</p>
              <ul className="flex flex-col gap-2 text-brand-dominant/70 text-sm">
                <li>${entityMap.industry}</li>
                <li>${entityMap.primaryService}</li>
                <li><a href="#contact" className="hover:text-brand-dominant transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-brand-dominant/10 pt-8 flex items-center justify-between">
            <p className="text-brand-dominant/40 text-xs">
              © ${year} ${entityMap.businessName}. All rights reserved.
            </p>
            <p className="text-brand-dominant/20 text-[10px] font-mono">
              Built with ALIAS COMPILER
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
`;

  const filePath = slug === 'home'
    ? 'src/app/page.tsx'
    : `src/app/${slug}/page.tsx`;

  return { name: filePath, language: 'tsx', content };
}

// ── layout.tsx ────────────────────────────────────────────────────────────────

export function buildLayoutTsx(dna: BrandDNA, businessName: string): CodeFile {
  const headingFont = dna.typePairing.heading.replace(/"/g, '');
  const bodyFont    = dna.typePairing.body.replace(/"/g, '');

  const content = `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: '${businessName}', template: '%s | ${businessName}' },
  description: '${businessName} — ${dna.industry}',
};

// Load brand fonts
const FONT_URL = 'https://fonts.googleapis.com/css2?family=${headingFont.replace(/ /g,'+')}:wght@700;800&family=${bodyFont.replace(/ /g,'+')}:wght@400;500;600&display=swap';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={FONT_URL} rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
`;
  return { name: 'src/app/layout.tsx', language: 'tsx', content };
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildTsxFiles(
  aeoContent: AeoContent,
  entityMap: EntityMap,
  dna: BrandDNA,
  slug: string,
): CodeFile[] {
  return [
    buildPageTsx(aeoContent, entityMap, dna, slug),
    buildLayoutTsx(dna, entityMap.businessName),
    buildGlobalsCss(dna),
    buildTailwindConfig(dna),
  ];
}
