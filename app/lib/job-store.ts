import { BuiltPage, FidelityMode, JobState, SiteObjective, SitePersona } from './types';

const TTL_MS = 1000 * 60 * 60; // 1 hour

// Attach the store to `global` so it survives Next.js HMR module reloads.
// Without this, Turbopack can recompile individual route handlers with fresh
// module instances, each getting their own empty Map — so start/status/stream
// routes end up with different stores and can't find each other's jobs.
declare global {
  // eslint-disable-next-line no-var
  var __aliasJobStore: Map<string, JobState> | undefined;
}
if (!global.__aliasJobStore) {
  global.__aliasJobStore = new Map<string, JobState>();
}
const store = global.__aliasJobStore;

function cleanup() {
  const now = Date.now();
  for (const [id, job] of store.entries()) {
    if (now - job.createdAt > TTL_MS) store.delete(id);
  }
}

export function createJob(
  jobId: string,
  url: string,
  fidelityMode: FidelityMode = 'aeo-first',
  siteObjective: SiteObjective = 'other',
  sitePersona?: SitePersona
): JobState {
  cleanup();
  const job: JobState = {
    jobId,
    url,
    status: 'queued',
    createdAt: Date.now(),
    fidelityMode,
    siteObjective,
    sitePersona,
    pages: {},
    phases: {
      extract: { status: 'pending' },
      analyze: { status: 'pending' },
      draft: { status: 'pending' },
      synthesize: { status: 'pending' },
      audit: { status: 'pending' },
    },
  };
  store.set(jobId, job);
  return job;
}

export function getJob(jobId: string): JobState | undefined {
  return store.get(jobId);
}

export function updateJob(jobId: string, updates: Partial<JobState>): void {
  const job = store.get(jobId);
  if (!job) return;
  store.set(jobId, { ...job, ...updates });
}

export function updatePhase<K extends keyof JobState['phases']>(
  jobId: string,
  phase: K,
  updates: Partial<JobState['phases'][K]>
): void {
  const job = store.get(jobId);
  if (!job) return;
  job.phases[phase] = { ...job.phases[phase], ...updates } as JobState['phases'][K];
  store.set(jobId, job);
}

/** Create or update a built page within a job. */
export function upsertPage(jobId: string, page: Partial<BuiltPage> & { slug: string }): void {
  const job = store.get(jobId);
  if (!job) return;
  job.pages[page.slug] = { ...job.pages[page.slug], ...page } as BuiltPage;
  store.set(jobId, job);
}

export function getPage(jobId: string, slug: string): BuiltPage | undefined {
  return store.get(jobId)?.pages[slug];
}
