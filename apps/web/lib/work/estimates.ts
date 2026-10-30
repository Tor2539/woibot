import type { WorkKind, ExecutionMode } from "./templates";

export type WorkEstimate = {
  kind: WorkKind;
  cost: number; // USD
  minutes: number;
  label: string;
  tools: string[];
  executionMode: ExecutionMode;
  approved: boolean;
  breakdown: { item: string; cost: number }[];
};

export const WORK_ESTIMATES: Record<WorkKind, { cost: number; minutes: number; label: string; tools: string[]; breakdown: { item: string; cost: number }[] }> = {
  coding: {
    cost: 2.4, minutes: 18, label: "Coding — build + tests + preview",
    tools: ["Cloud container", "Next.js runtime", "Vitest + Playwright"],
    breakdown: [{ item: "LLM (code gen + review)", cost: 1.6 }, { item: "Cloud exec (build/test)", cost: 0.5 }, { item: "Storage + preview", cost: 0.3 }],
  },
  doc: {
    cost: 0.8, minutes: 10, label: "Document — 12 pages + charts",
    tools: ["Doc engine", "Chart render", "PDF export"],
    breakdown: [{ item: "LLM (writing/layout)", cost: 0.55 }, { item: "Render + fonts", cost: 0.15 }, { item: "Storage", cost: 0.1 }],
  },
  research: {
    cost: 1.2, minutes: 12, label: "Research — multi-source + report",
    tools: ["Web search", "RAG", "Report builder"],
    breakdown: [{ item: "Search + crawl", cost: 0.4 }, { item: "LLM synthesis", cost: 0.6 }, { item: "Report export", cost: 0.2 }],
  },
  video_analysis: {
    cost: 3.0, minutes: 15, label: "Video Analysis — 60 min → 5 clips",
    tools: ["FFmpeg", "Whisper", "Scene detect"],
    breakdown: [{ item: "Transcribe (Whisper)", cost: 1.0 }, { item: "LLM highlight select", cost: 0.8 }, { item: "FFmpeg cut/encode", cost: 1.2 }],
  },
  video_gen: {
    cost: 8.5, minutes: 25, label: "Video Gen — 30s × 3 (GPU)",
    tools: ["GPU pool", "ComfyUI / Fal", "Voiceover"],
    breakdown: [{ item: "GPU (3×30s gen)", cost: 6.0 }, { item: "Voiceover + music", cost: 1.0 }, { item: "Edit + encode", cost: 1.5 }],
  },
  media_heavy: {
    cost: 5.0, minutes: 20, label: "Media Heavy — batch processing",
    tools: ["Cloud batch", "FFmpeg", "Storage"],
    breakdown: [{ item: "Compute", cost: 3.5 }, { item: "Storage egress", cost: 1.0 }, { item: "Orchestration", cost: 0.5 }],
  },
  data: {
    cost: 1.5, minutes: 14, label: "Data & BI — clean + model + dashboard",
    tools: ["Python sandbox", "Chart engine", "Excel export"],
    breakdown: [{ item: "LLM + Python exec", cost: 0.9 }, { item: "Chart render", cost: 0.3 }, { item: "XLSX export", cost: 0.3 }],
  },
};

export function estimateTask(
  kind: WorkKind,
  executionMode: ExecutionMode,
  opts?: { pages?: number; seconds?: number; minutesOfVideo?: number }
): WorkEstimate {
  const base = WORK_ESTIMATES[kind];
  let cost = base.cost;
  if (opts?.pages && opts.pages > 10) cost += (opts.pages - 10) * 0.08;
  if (opts?.seconds && opts.seconds > 30) cost += (opts.seconds - 30) * 0.05;
  if (opts?.minutesOfVideo && opts.minutesOfVideo > 60) cost += (opts.minutesOfVideo - 60) * 0.03;
  // Local saves cloud exec cost ~30%
  if (executionMode === "local") cost = cost * 0.7;
  cost = Math.round(cost * 100) / 100;
  return {
    kind,
    cost,
    minutes: base.minutes,
    label: base.label,
    tools: base.tools,
    executionMode,
    approved: false,
    breakdown: executionMode === "local"
      ? base.breakdown.map(b => ({ ...b, cost: Math.round(b.cost * 0.7 * 100) / 100 }))
      : base.breakdown,
  };
}

// Quota gate — mirrors lib/harness/canAffordWork but client-friendly
export function checkQuotaGate(
  estimatedCost: number,
  quota: { perTaskCap: number; monthlyCap: number; monthlyUsed: number } | null
): { ok: boolean; reason?: string } {
  if (!quota) return { ok: true };
  if (estimatedCost > quota.perTaskCap) return { ok: false, reason: `เกินวงเงินต่อครั้ง (cap $${quota.perTaskCap.toFixed(2)} — งานนี้ $${estimatedCost.toFixed(2)})` };
  if (quota.monthlyUsed + estimatedCost > quota.monthlyCap) return { ok: false, reason: `เกินวงเงินรายเดือน (cap $${quota.monthlyCap.toFixed(2)}, ใช้แล้ว $${quota.monthlyUsed.toFixed(2)})` };
  return { ok: true };
}

export function formatCost(n: number) { return `$${n.toFixed(2)}`; }
export function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60); const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
