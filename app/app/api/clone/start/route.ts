import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/lib/job-store';
import { FidelityMode } from '@/lib/types';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { url, fidelityMode } = await req.json();
    const mode: FidelityMode = fidelityMode === 'brand-first' ? 'brand-first' : 'aeo-first';

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
    createJob(jobId, normalizedUrl, mode);

    return NextResponse.json({ jobId, url: normalizedUrl, fidelityMode: mode });
  } catch (err) {
    console.error('[start] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
