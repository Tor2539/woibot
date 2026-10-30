import { execInComputer } from "@/lib/computer";

export type ExecOutcome = {
  available: boolean;
  code: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  error?: string;
};

/**
 * Run a bash script inside the user's own isolated Cloud Computer.
 * The script is base64-encoded so nested quoting can never break the
 * transport (docker exec -> sh -lc).
 */
export async function runScript(userId: string, script: string): Promise<ExecOutcome> {
  const started = Date.now();
  if (!userId) {
    return { available: false, code: -1, stdout: "", stderr: "", durationMs: 0, error: "no_user" };
  }
  const b64 = Buffer.from(script, "utf8").toString("base64");
  const res: any = await execInComputer(userId, `echo ${b64} | base64 -d | bash`);
  if (!res || res.ok === false || res.error) {
    return {
      available: false,
      code: -1,
      stdout: String(res?.stdout || ""),
      stderr: String(res?.stderr || ""),
      durationMs: Date.now() - started,
      error: String(res?.error || "computer_unavailable"),
    };
  }
  return {
    available: true,
    code: typeof res.code === "number" ? res.code : 0,
    stdout: String(res.stdout || ""),
    stderr: String(res.stderr || ""),
    durationMs: Date.now() - started,
  };
}

/** Extract the last `__RESULT__{json}` line emitted by a check script. */
export function parseResult<T = any>(stdout: string): T | null {
  const line = stdout
    .split("\n")
    .reverse()
    .find((l) => l.trim().startsWith("__RESULT__"));
  if (!line) return null;
  try {
    return JSON.parse(line.trim().slice("__RESULT__".length)) as T;
  } catch {
    return null;
  }
}
