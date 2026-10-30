/**
 * Verification pipeline entry point.
 *
 * There are no fabricated passes here. Every report is produced by running
 * open-source tooling inside the user's own Cloud Computer (see live.ts).
 * When the computer is unreachable the report is explicitly "unavailable" and
 * the task cannot reach the Completed state.
 */
import { runLiveVerification } from "./live";
import type { Check, VerificationReport, VerificationMode } from "./types";

export type { Check, VerificationReport, VerificationMode };

export type VerificationContext = {
  userId?: string;
  /** Extra requirements, e.g. { expectedDuration: 30 } or { minPages: 8 } */
  opts?: Record<string, unknown>;
};

export async function createVerificationReport(
  taskId: string,
  type: VerificationReport["type"],
  opts?: Record<string, unknown>,
  ctx?: VerificationContext,
): Promise<VerificationReport> {
  const userId = ctx?.userId || (opts?.userId as string | undefined);
  const requirements = { ...(ctx?.opts || {}), ...(opts || {}) };

  if (!userId) {
    return {
      taskId,
      type,
      mode: "unavailable",
      passed: false,
      checks: [
        {
          name: "user_context",
          passed: false,
          detail: "Verification needs a signed-in user so the checks can run in that user's Cloud Computer.",
          severity: "critical",
        },
      ],
      summary: "Verification not run — missing user context.",
      createdAt: new Date().toISOString(),
    };
  }

  try {
    return await runLiveVerification(userId, taskId, type, requirements);
  } catch (e) {
    return {
      taskId,
      type,
      mode: "unavailable",
      passed: false,
      checks: [
        {
          name: "verification_error",
          passed: false,
          detail: e instanceof Error ? e.message : "unknown verification error",
          severity: "critical",
        },
      ],
      summary: "Verification crashed — treated as failure, never as success.",
      createdAt: new Date().toISOString(),
    };
  }
}

export function reportToJson(report: VerificationReport): string {
  return JSON.stringify(report, null, 2);
}

export function isPassed(report: VerificationReport): boolean {
  return report.passed && report.mode === "live";
}
