import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/lib/job-store';
import { FidelityMode, SiteObjective, SitePersona } from '@/lib/types';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { url, fidelityMode, siteObjective, sitePersona } = await req.json();
    const mode: FidelityMode = fidelityMode === 'brand-first' ? 'brand-first' : 'aeo-first';
    const objective: SiteObjective =
      ['sell-products', 'make-bookings', 'capture-leads', 'other'].includes(siteObjective)
        ? siteObjective
        : 'other';

    // Validate persona shape if provided
    const VALID_LAYOUTS   = ['spacious', 'dense'];
    const VALID_TONES     = ['professional', 'disruptor'];
    const VALID_IMAGERY   = ['human-centric', 'abstract-tech'];
    const VALID_MOTION    = ['static', 'high-motion'];
    const VALID_ARCH      = ['linear-story', 'deep-hub'];
    const persona: SitePersona | undefined =
      sitePersona &&
      VALID_LAYOUTS.includes(sitePersona.layout) &&
      VALID_TONES.includes(sitePersona.tone) &&
      VALID_IMAGERY.includes(sitePersona.imagery) &&
      VALID_MOTION.includes(sitePersona.motion) &&
      VALID_ARCH.includes(sitePersona.architecture)
        ? (sitePersona as SitePersona)
        : undefined;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const jobId = randomUUID();
    createJob(jobId, normalizedUrl, mode, objective, persona);

    return NextResponse.json({ jobId, url: normalizedUrl, fidelityMode: mode, siteObjective: objective, sitePersona: persona });
  } catch (err) {
    console.error('[start] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
