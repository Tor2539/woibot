/**
 * woibot Harness Manager — Cloud Computer + Execution Engine
 * - Docker per-user container abstraction (prod: Docker/RunC, dev: mock)
 * - BullMQ queue stub (prod: Redis, dev: memory)
 * - Planner / Runner / Checkpointer interfaces
 */

import { prisma } from "../db";
import { createVerificationReport, type VerificationReport } from "../verification/pipeline";

// Re-export sub-modules
export * from "./container";
export * from "./queue";
export * from "./planner";
export * from "./runner";
export * from "./checkpointer";

// Core types (PRD 7.x / 9.x)

export type WorkKind = "coding" | "research" | "doc" | "video_analysis" | "video_gen" | "media_heavy" | "data";
export type TaskStatus = "queued" | "planning" | "in_progress" | "waiting_for_user" | "paused" | "reviewing" | "completed" | "partially_completed" | "failed" | "cancelled";
export type ExecutionMode = "cloud" | "local";

export type HandoffPacket = {
  goal: string;
  context: {
    chat_history: { role: string; content: string }[];
    memory_snippet: string;
    user_prefs: Record<string, unknown>;
  };
  attachments: { fileUrl: string; fileName: string; mimeType: string }[];
  deliverables: string[];
  constraints: { deadline?: string; budget?: number; must_not_leak?: string[] };
  verification_criteria: string[];
  execution_mode: ExecutionMode;
  trace_id: string;
};

export const WORK_ESTIMATES: Record<WorkKind, { cost: number; minutes: number; label: string; tools: string[] }> = {
  coding:         { cost: 2.4, minutes: 18, label: "Coding Work — build + tests + preview", tools: ["Next.js", "Prisma", "Vitest"] },
  research:       { cost: 1.2, minutes: 12, label: "Deep Research — multi-source + report", tools: ["Web Search", "pgvector"] },
  doc:            { cost: 0.8, minutes: 10, label: "Document — 12 pages + charts", tools: ["python-docx", "Puppeteer"] },
  video_analysis: { cost: 3.0, minutes: 15, label: "Video Analysis — 60min → 5 clips", tools: ["FFmpeg", "Whisper"] },
  video_gen:      { cost: 8.5, minutes: 25, label: "Video Generation — 30s × 3 (GPU)", tools: ["ComfyUI", "FFmpeg"] },
  media_heavy:    { cost: 5.0, minutes: 20, label: "Media Processing — heavy", tools: ["FFmpeg"] },
  data:           { cost: 1.5, minutes: 14, label: "Data Analysis — dashboard", tools: ["Pandas", "Charts"] },
};

export function estimateTask(kind: WorkKind, opts?: { pages?: number; seconds?: number; minutes?: number }) {
  const base = WORK_ESTIMATES[kind] ?? WORK_ESTIMATES.coding;
  let cost = base.cost;
  let minutes = base.minutes;
  if (opts?.pages && opts.pages > 10) cost += (opts.pages - 10) * 0.08;
  if (opts?.seconds && opts.seconds > 30) cost += (opts.seconds - 30) * 0.05;
  if (opts?.minutes && opts.minutes > 10) cost += (opts.minutes - 10) * 0.12;
  return { kind, cost: Math.round(cost * 100) / 100, minutes, label: base.label, tools: base.tools };
}

export async function canAffordWork(userId: string, estimatedCost: number) {
  const quota = await prisma.workQuota.findUnique({ where: { userId } });
  if (!quota) return { ok: true, reason: "no quota" as const };
  if (estimatedCost > quota.perTaskCap) return { ok: false, reason: `เกินวงเงินต่อครั้ง (cap ${quota.perTaskCap})` as const };
  if (quota.monthlyUsed + estimatedCost > quota.monthlyCap) return { ok: false, reason: `เกินวงเงินรายเดือน (cap ${quota.monthlyCap}, ใช้แล้ว ${quota.monthlyUsed})` as const };
  return { ok: true, quota };
}

// Intent router per PRD 7.1
export function routeIntent(input: string): { product: "teammate" | "work"; workKind?: WorkKind; confidence: number; reason: string } {
  const s = input.toLowerCase();
  // work triggers — Thai + English
  if (/(สร้างเว็บ|สร้างแอป|สร้างระบบ|build|create.*app|ทำคลิป|วิดีโอ|video|generate|รายงาน.*หน้า|presentation|วิเคราะห์.*ข้อมูล|research|เอกสาร.*หน้า|ทำสไลด์|ทำกราฟ|dashboard|compare|สัญญา|contract)/.test(s)) {
    let kind: WorkKind = "coding";
    if (/วิดีโอ|video|คลิป|tiktok|reel|shorts/.test(s)) kind = s.includes("วิเคราะห์") || s.includes("ตัด") || s.includes("analysis") || s.includes("edit") ? "video_analysis" : "video_gen";
    else if (/เอกสาร|รายงาน|presentation|proposal|pdf|docx|pptx|สไลด์|คู่มือ/.test(s)) kind = "doc";
    else if (/วิจัย|research|วิเคราะห์.*ตลาด|competitor|compare|ตลาด/.test(s)) kind = "research";
    else if (/ยอดขาย|ข้อมูล|excel|csv|dashboard|kpi|forecast|กราฟ/.test(s)) kind = "data";
    return { product: "work", workKind: kind, confidence: 0.92, reason: "ตรวจพบคำสั่งสร้างผลงาน (deliverable) ต้องใช้ Work" };
  }
  return { product: "teammate", confidence: 0.88, reason: "งานประจำวัน/ถามตอบ — Teammate ทำได้โดยตรง" };
}

export async function createTaskFromHandoff(userId: string, packet: HandoffPacket, workKind: WorkKind) {
  const est = estimateTask(workKind);
  const task = await prisma.task.create({
    data: {
      userId,
      title: packet.goal.slice(0, 120),
      goal: packet.goal,
      product: "work",
      workKind,
      status: "queued",
      executionMode: packet.execution_mode,
      handoffPacket: JSON.stringify(packet),
      estimate: JSON.stringify({ ...est, approved: false }),
      progress: 0,
    },
  });
  return { task, estimate: est };
}

export async function advanceTask(taskId: string, status: TaskStatus, progress?: number, extra?: Record<string, unknown>) {
  return prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      ...(progress !== undefined ? { progress } : {}),
      ...(extra || {}),
    },
  });
}

// Legacy helper keep compat
export async function getContainerForUser(userId: string) {
  const { getOrCreateContainer } = await import("./container");
  return getOrCreateContainer(userId);
}

// High-level execute: plan → run → verify
export async function executeTask(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error(`Task not found: ${taskId}`);

  // 1) planning
  await prisma.task.update({ where: { id: taskId }, data: { status: "planning", progress: 5 } });
  const { planTask } = await import("./planner");
  const plan = await planTask(task.goal, (task.workKind as WorkKind) || "coding");

  // 2) in_progress
  await prisma.task.update({ where: { id: taskId }, data: { status: "in_progress", progress: 15 } });

  const { runPlan } = await import("./runner");
  const result = await runPlan(taskId, plan, task.userId);

  // 3) reviewing + verification
  await prisma.task.update({ where: { id: taskId }, data: { status: "reviewing", progress: 85 } });
  const verification = await createVerificationReport(taskId, mapKindToVerifyType(task.workKind), undefined, { userId: (task as any).userId });
  await prisma.task.update({
    where: { id: taskId },
    data: { verification: JSON.stringify(verification), progress: verification.passed ? 100 : 75 },
  });

  // 4) final status
  const finalStatus: TaskStatus = verification.passed ? "completed" : "partially_completed";
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: finalStatus,
      progress: verification.passed ? 100 : 75,
      completedAt: verification.passed ? new Date() : undefined,
    },
  });

  return { plan, result, verification, task: updated };
}

function mapKindToVerifyType(kind?: string | null): VerificationReport["type"] {
  if (kind === "coding") return "coding";
  if (kind === "doc") return "doc";
  if (kind === "video_gen" || kind === "video_analysis" || kind === "media_heavy") return "video";
  if (kind === "research") return "research";
  if (kind === "data") return "data";
  return "research";
}
