import { JobState } from './types';

const TTL_MS = 1000 * 60 * 60; // 1 hour

const store = new Map<string, JobState>();

function cleanup() {
  const now = Date.now();
  for (const [id, job] of store.entries()) {
    if (now - job.createdAt > TTL_MS) store.delete(id);
  }
}

export function createJob(jobId: string, url: string): JobState {
  cleanup();
  const job: JobState = {
    jobId,
    url,
    status: 'queued',
    createdAt: Date.now(),
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
