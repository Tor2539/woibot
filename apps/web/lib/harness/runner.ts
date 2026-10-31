/**
 * Runner — kept for callers that only need step bookkeeping.
 * Real execution lives in agent.ts: every step runs a command in the user's
 * container and fails loudly instead of returning a synthetic success.
 */
import { runAgentTask } from "./agent";
import type { ExecutionPlan } from "./planner";

export type StepResult = {
  stepId: string;
  title: string;
  status: "success" | "failed" | "skipped";
  files?: string[];
  note?: string;
};

export type RunResult = {
  ok: boolean;
  files: string[];
  results: StepResult[];
  error?: string;
};

export async function runPlan(
  taskId: string,
  plan: ExecutionPlan,
  userId: string,
  ctx: { goal: string; title: string },
): Promise<RunResult> {
  const out = await runAgentTask({
    taskId,
    userId,
    goal: ctx.goal,
    title: ctx.title,
    workKind: plan.workKind,
  });

  const results: StepResult[] = plan.steps.map((s) => ({
    stepId: s.id,
    title: s.title,
    status: out.ok ? "success" : "failed",
    files: s.kind === "verify" ? out.files : undefined,
    note: out.ok ? undefined : out.error,
  }));

  return { ok: out.ok, files: out.files, results, error: out.error };
}
