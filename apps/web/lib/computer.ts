/**
 * Cloud Computer control plane client.
 * Talks to the computer manager on the private VPC (one isolated gVisor
 * container per user). Falls back to a clearly-labelled local simulation when
 * the manager is not configured, so local development still works.
 */
const MANAGER_URL = process.env.MANAGER_URL || "";
const MANAGER_TOKEN = process.env.MANAGER_TOKEN || "";

export type ComputerStatus = {
  configured: boolean;
  status: "running" | "paused" | "absent" | "error" | "simulated";
  name?: string;
  port?: number;
  cdpPort?: number;
  vncPath?: string;
  detail?: string;
};

/* Per-user exec serialization: each user owns exactly ONE container, and the
   manager is a small Node service on a 2-vCPU VM. Two parallel execs to the
   same container (e.g. two chat-created tasks auto-running at once) produced
   "fetch failed" transport errors in field testing — so container operations
   for the same user now queue behind each other. LLM work is unaffected. */
const execLocks = new Map<string, Promise<unknown>>();

async function withExecLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = execLocks.get(userId) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  execLocks.set(userId, next);
  try {
    return await next;
  } finally {
    if (execLocks.get(userId) === next) execLocks.delete(userId);
  }
}

async function call(path: string, init?: RequestInit, timeoutMs = 20000) {
  if (!MANAGER_URL) return null;
  try {
    const res = await fetch(`${MANAGER_URL}${path}`, {
      ...init,
      headers: {
        "x-woibot-token": MANAGER_TOKEN,
        "content-type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, error: `manager_${res.status}` };
    return await res.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "manager_unreachable" };
  }
}

/** exec + friends: serialized per user, with one transport retry. */
async function callExec(userId: string, path: string, init?: RequestInit, timeoutMs = 20000) {
  return withExecLock(userId, async () => {
    const first = await call(path, init, timeoutMs);
    const transportErr = first && typeof first === "object" && "error" in first &&
      /fetch failed|timeout|terminated|socket|ECONN|aborted/i.test(String((first as any).error));
    if (!transportErr) return first;
    await new Promise((r) => setTimeout(r, 5000));
    return call(path, init, timeoutMs);
  });
}

export async function ensureComputer(userId: string): Promise<ComputerStatus> {
  if (!MANAGER_URL) {
    return { configured: false, status: "simulated", detail: "MANAGER_URL not configured" };
  }
  const out = await call(`/users/${encodeURIComponent(userId)}/ensure`, { method: "POST" }, 150000);
  if (!out?.ok) {
    return { configured: true, status: "error", detail: out?.error || "ensure_failed" };
  }
  return {
    configured: true,
    status: "running",
    name: out.name,
    port: out.port,
    cdpPort: out.cdpPort,
    vncPath: `/users/${encodeURIComponent(userId)}/vnc/vnc.html?autoconnect=1&resize=scale&show_dot=1&path=${encodeURIComponent(
        `/users/${userId}/vnc/websockify`,
      )}&token=${encodeURIComponent(MANAGER_TOKEN)}`,
  };
}

export async function computerStatus(userId: string): Promise<ComputerStatus> {
  if (!MANAGER_URL) {
    return { configured: false, status: "simulated", detail: "MANAGER_URL not configured" };
  }
  const out = await call(`/users/${encodeURIComponent(userId)}/status`);
  if (!out?.ok) return { configured: true, status: "error", detail: out?.error };
  return {
    configured: true,
    status: out.status === "running" ? "running" : out.status === "absent" ? "absent" : "paused",
    name: out.name,
    port: out.port,
    cdpPort: (out.port || 0) + 1000,
    vncPath: `/users/${encodeURIComponent(userId)}/vnc/vnc.html?autoconnect=1&resize=scale&show_dot=1&path=${encodeURIComponent(
        `/users/${userId}/vnc/websockify`,
      )}&token=${encodeURIComponent(MANAGER_TOKEN)}`,
  };
}

export async function computerAction(userId: string, action: "pause" | "resume" | "destroy") {
  const out = await call(`/users/${encodeURIComponent(userId)}/${action}`, { method: "POST" });
  return out ?? { ok: false, error: "manager_not_configured" };
}

export async function execInComputer(userId: string, cmd: string, timeoutMs = 20000) {
  const out = await callExec(
    userId,
    `/users/${encodeURIComponent(userId)}/exec`,
    { method: "POST", body: JSON.stringify({ cmd }) },
    timeoutMs,
  );
  return out ?? { ok: false, error: "manager_not_configured" };
}

export function computerPublicOrigin() {
  return process.env.COMPUTER_PUBLIC_ORIGIN || "https://computer.woibot.com";
}


export async function computerLogs(userId: string) {
  const out = await call(`/users/${encodeURIComponent(userId)}/logs`);
  return out ?? { ok: false, error: "manager_not_configured" };
}


/** Stream a file out of the user's workspace (manager reads it from the bind mount). */
export async function computerFile(userId: string, relPath: string): Promise<Response | null> {
  if (!MANAGER_URL) return null;
  try {
    return await withExecLock(userId, async () =>
      fetch(
        `${MANAGER_URL}/users/${encodeURIComponent(userId)}/file?path=${encodeURIComponent(relPath)}`,
        { headers: { "x-woibot-token": MANAGER_TOKEN }, cache: "no-store", signal: AbortSignal.timeout(30000) },
      ),
    );
  } catch {
    return null;
  }
}
