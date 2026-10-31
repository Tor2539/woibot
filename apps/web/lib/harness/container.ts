/**
 * Container abstraction — talks to the real per-user Cloud Computer manager.
 * There is no mock path: if the manager is unreachable the call fails loudly,
 * because silently pretending a command ran is worse than an error.
 */
import { execInComputer, ensureComputer, computerStatus } from "../computer";

export type ContainerStatus = "running" | "stopped" | "creating" | "error" | "paused";

export type ExecResult = { exitCode: number; stdout: string; stderr: string };

export const WORK_DIR = "/home/woibot/workspace";

export async function execInContainer(userId: string, cmd: string, timeoutMs = 150000): Promise<ExecResult> {
  const out: any = await execInComputer(userId, cmd, timeoutMs);
  const payload = out?.result ?? out;
  // A non-zero exit code is a command result, not a transport failure.
  if (payload && typeof payload.code === "number") {
    return {
      exitCode: payload.code,
      stdout: String(payload.stdout || ""),
      stderr: String(payload.stderr || ""),
    };
  }
  return {
    exitCode: 1,
    stdout: String(payload?.stdout || ""),
    stderr: String(out?.error || payload?.error || "computer_unavailable"),
  };
}

/** Run a bash script safely (base64 → bash) so quoting can never break it. */
export async function runScript(userId: string, script: string): Promise<ExecResult> {
  const b64 = Buffer.from(script, "utf8").toString("base64");
  return execInContainer(userId, `echo ${b64} | base64 -d | bash`);
}

/** Write a file inside the user's workspace without shell-escaping problems. */
export async function writeWorkspaceFile(userId: string, relativePath: string, content: string): Promise<ExecResult> {
  const safe = relativePath.replace(/[^A-Za-z0-9._\-\/]/g, "_");
  const b64 = Buffer.from(content, "utf8").toString("base64");
  return execInContainer(
    userId,
    `mkdir -p "${WORK_DIR}/$(dirname '${safe}')" && echo ${b64} | base64 -d > "${WORK_DIR}/${safe}" && wc -c < "${WORK_DIR}/${safe}"`,
  );
}

export async function getOrCreateContainer(userId: string) {
  const status = await ensureComputer(userId);
  return status;
}

export async function containerHealth(userId: string) {
  return computerStatus(userId);
}


/** Write raw bytes (uploads) into the workspace. */
export async function writeWorkspaceBytes(userId: string, relativePath: string, bytes: Uint8Array): Promise<ExecResult> {
  const safe = relativePath.replace(/[^A-Za-z0-9._\-\/]/g, "_");
  const b64 = Buffer.from(bytes).toString("base64");
  return execInContainer(
    userId,
    `mkdir -p "${WORK_DIR}/$(dirname '${safe}')" && echo ${b64} | base64 -d > "${WORK_DIR}/${safe}" && stat -c %s "${WORK_DIR}/${safe}"`,
  );
}
