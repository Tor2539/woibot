/**
 * Checkpointer — save/restore progress for long-running tasks
 * Allows pause → resume from last checkpoint
 */

export type Checkpoint = {
  taskId: string;
  stepId: string;
  stepIndex: number;
  progress: number;
  state: Record<string, unknown>;
  createdAt: string;
};

const store = new Map<string, Checkpoint[]>(); // taskId → checkpoints

export async function saveCheckpoint(cp: Checkpoint): Promise<Checkpoint> {
  const arr = store.get(cp.taskId) ?? [];
  arr.push(cp);
  // keep last 20
  if (arr.length > 20) arr.shift();
  store.set(cp.taskId, arr);
  return cp;
}

export async function getLatestCheckpoint(taskId: string): Promise<Checkpoint | null> {
  const arr = store.get(taskId);
  if (!arr || arr.length === 0) return null;
  return arr[arr.length - 1];
}

export async function listCheckpoints(taskId: string): Promise<Checkpoint[]> {
  return store.get(taskId) ?? [];
}

export async function restoreCheckpoint(taskId: string, stepIndex?: number): Promise<Checkpoint | null> {
  const arr = store.get(taskId);
  if (!arr || arr.length === 0) return null;
  if (stepIndex !== undefined) {
    return arr.find(c => c.stepIndex === stepIndex) ?? null;
  }
  return arr[arr.length - 1];
}

export async function clearCheckpoints(taskId: string): Promise<void> {
  store.delete(taskId);
}
