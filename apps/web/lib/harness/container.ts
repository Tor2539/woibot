/**
 * Docker per-user container abstraction
 * Prod: Dockerode via /var/run/docker.sock, image woibot/computer:base
 * Dev: in-memory mock with same interface
 */

export type ContainerStatus = "running" | "stopped" | "creating" | "error" | "paused";

export type ContainerInfo = {
  userId: string;
  containerId: string;
  name: string;
  status: ContainerStatus;
  image: string;
  cdpUrl: string;  // ws://localhost:9222
  vncUrl: string;  // http://localhost:6080/vnc.html
  workDir: string; // /home/woibot/workspace
  resources: { cpu: string; ram: string; disk: string; plan: string };
  uptime: string;
  createdAt: string;
  lastHealthCheck?: string;
};

// In-memory registry for dev
const registry = new Map<string, ContainerInfo>();

function cpuForPlan(plan: string) {
  if (plan === "pro") return "2 vCPU";
  if (plan === "starter") return "1 vCPU";
  return "0.5 vCPU";
}
function ramForPlan(plan: string) {
  if (plan === "pro") return "4GB";
  if (plan === "starter") return "2GB";
  return "1GB";
}

export async function getOrCreateContainer(userId: string, plan: string = "starter"): Promise<ContainerInfo> {
  const existing = registry.get(userId);
  if (existing && existing.status === "running") return existing;

  // In prod: docker.createContainer(...), start, wait health
  const info: ContainerInfo = {
    userId,
    containerId: `woibot-${userId.slice(0, 8)}-${Date.now().toString(36)}`,
    name: `woibot-${userId.slice(0, 8)}`,
    status: "running",
    image: "woibot/computer:base",
    cdpUrl: `ws://localhost:9222/${userId.slice(0,8)}`,
    vncUrl: `http://localhost:6080/vnc.html?user=${userId.slice(0,8)}`,
    workDir: `/home/woibot/workspace/${userId.slice(0,8)}`,
    resources: { cpu: cpuForPlan(plan), ram: ramForPlan(plan), disk: "10GB", plan },
    uptime: "0m",
    createdAt: new Date().toISOString(),
    lastHealthCheck: new Date().toISOString(),
  };
  registry.set(userId, info);
  return info;
}

export async function getContainerStatus(userId: string): Promise<ContainerInfo | null> {
  return registry.get(userId) ?? null;
}

export async function destroyContainer(userId: string): Promise<{ ok: boolean; containerId?: string }> {
  const c = registry.get(userId);
  if (!c) return { ok: false };
  // prod: docker.getContainer(c.containerId).stop() + remove()
  registry.delete(userId);
  return { ok: true, containerId: c.containerId };
}

export async function execInContainer(userId: string, command: string, opts?: { workDir?: string; timeoutMs?: number }): Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number }> {
  const c = await getOrCreateContainer(userId);
  // In prod: docker.exec + demux; here mock deterministic responses
  const start = Date.now();
  const cmd = command.trim();

  // Mock common commands for demo/verification
  if (cmd.includes("pnpm test") || cmd.includes("vitest")) {
    return { stdout: "✓ 14/14 tests passed (2.4s) coverage 82%", stderr: "", exitCode: 0, durationMs: Date.now() - start };
  }
  if (cmd.includes("tsc --noEmit")) {
    return { stdout: "tsc --noEmit: 0 errors", stderr: "", exitCode: 0, durationMs: 1200 };
  }
  if (cmd.includes("pnpm build") || cmd.includes("next build")) {
    return { stdout: "✓ build passed — 42 pages, 0 errors", stderr: "", exitCode: 0, durationMs: 3400 };
  }
  if (cmd.includes("ffprobe")) {
    return { stdout: JSON.stringify({ duration: 30.0, width: 1920, height: 1080, codec: "h264", audio: "aac" }), stderr: "", exitCode: 0, durationMs: 300 };
  }
  if (cmd.includes("libreoffice") || cmd.includes("soffice")) {
    return { stdout: "LibreOffice: opened document, 12 pages, fonts OK", stderr: "", exitCode: 0, durationMs: 800 };
  }
  // generic
  return { stdout: `[container ${c.containerId}] $ ${command}\n→ ok (mock)`, stderr: "", exitCode: 0, durationMs: 150 };
}

export async function listContainers(): Promise<ContainerInfo[]> {
  return Array.from(registry.values());
}

export async function pauseContainer(userId: string): Promise<ContainerInfo | null> {
  const c = registry.get(userId);
  if (!c) return null;
  c.status = "paused";
  return c;
}

export async function resumeContainer(userId: string): Promise<ContainerInfo | null> {
  const c = registry.get(userId);
  if (!c) return null;
  c.status = "running";
  return c;
}

// TakeOver: returns noVNC URL with one-time token (mock)
export function getTakeOverUrl(userId: string): string {
  const c = registry.get(userId);
  const base = c?.vncUrl ?? `http://localhost:6080/vnc.html?user=${userId.slice(0,8)}`;
  const token = Buffer.from(`${userId}:${Date.now()}`).toString("base64url").slice(0, 16);
  return `${base}&token=${token}`;
}
