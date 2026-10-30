/**
 * BullMQ queue stub — in-memory for dev, drop-in for BullMQ+Redis in prod
 * Interface mirrors BullMQ Queue/Worker enough for harness to work.
 */

export type JobStatus = "waiting" | "active" | "completed" | "failed" | "delayed" | "paused";

export type ExecutionJob = {
  id: string;
  taskId: string;
  userId: string;
  kind: string; // WorkKind
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  result?: unknown;
  error?: string;
  progress?: number;
};

// In-memory queue
const jobs = new Map<string, ExecutionJob>();
const waitingQueue: string[] = [];
let processor: ((job: ExecutionJob) => Promise<unknown>) | null = null;

export async function addJob(data: { taskId: string; userId: string; kind: string; payload?: Record<string, unknown>; maxAttempts?: number }): Promise<ExecutionJob> {
  const job: ExecutionJob = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    taskId: data.taskId,
    userId: data.userId,
    kind: data.kind,
    payload: data.payload ?? {},
    status: "waiting",
    attempts: 0,
    maxAttempts: data.maxAttempts ?? 3,
    createdAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  waitingQueue.push(job.id);
  // try process async
  setImmediate(() => drain());
  return job;
}

export async function getJob(jobId: string): Promise<ExecutionJob | null> {
  return jobs.get(jobId) ?? null;
}

export async function getJobByTaskId(taskId: string): Promise<ExecutionJob | null> {
  for (const j of jobs.values()) if (j.taskId === taskId) return j;
  return null;
}

export async function listJobs(filter?: { userId?: string; status?: JobStatus }): Promise<ExecutionJob[]> {
  let out = Array.from(jobs.values());
  if (filter?.userId) out = out.filter(j => j.userId === filter.userId);
  if (filter?.status) out = out.filter(j => j.status === filter.status);
  return out.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}

export function setProcessor(fn: (job: ExecutionJob) => Promise<unknown>) {
  processor = fn;
}

async function drain() {
  if (!processor) return;
  while (waitingQueue.length > 0) {
    const jobId = waitingQueue.shift()!;
    const job = jobs.get(jobId);
    if (!job || job.status !== "waiting") continue;
    job.status = "active";
    job.startedAt = new Date().toISOString();
    try {
      const result = await processor(job);
      job.status = "completed";
      job.result = result;
      job.finishedAt = new Date().toISOString();
    } catch (e: unknown) {
      job.attempts += 1;
      const msg = e instanceof Error ? e.message : String(e);
      if (job.attempts >= job.maxAttempts) {
        job.status = "failed";
        job.error = msg;
        job.finishedAt = new Date().toISOString();
      } else {
        job.status = "waiting";
        waitingQueue.push(job.id); // retry
      }
    }
  }
}

// For BullMQ prod, swap this file with real implementation:
// import { Queue, Worker } from 'bullmq';
// export const workQueue = new Queue('woibot-work', { connection: { host: process.env.REDIS_HOST }})

export async function removeJob(jobId: string) {
  jobs.delete(jobId);
  const idx = waitingQueue.indexOf(jobId);
  if (idx !== -1) waitingQueue.splice(idx, 1);
}

export function getQueueStats() {
  const all = Array.from(jobs.values());
  return {
    waiting: all.filter(j => j.status === "waiting").length,
    active: all.filter(j => j.status === "active").length,
    completed: all.filter(j => j.status === "completed").length,
    failed: all.filter(j => j.status === "failed").length,
    total: all.length,
  };
}
