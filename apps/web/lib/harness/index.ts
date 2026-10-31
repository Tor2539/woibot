/**
 * woibot Harness Manager — Cloud Computer + Execution Engine
 * - Docker per-user container abstraction (prod: Docker/RunC, dev: mock)
 * - BullMQ queue stub (prod: Redis, dev: memory)
 * - Planner / Runner / Checkpointer interfaces
 */

import { prisma } from "../db";
import { ensureComputer } from "../computer";
import { recallContext } from "../memory";
import { createVerificationReport, type VerificationReport } from "../verification/pipeline";

// Re-export sub-modules
export * from "./container";
export * from "./queue";
export * from "./planner";
export * from "./runner";
export * from "./checkpointer";

// Core types (PRD 7.x / 9.x)

export type WorkKind = "coding" | "research" | "doc" | "video_analysis" | "video_gen" | "media_heavy" | "data" | "image";
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
  coding:         { cost: 2.4, minutes: 18, label: "Coding Work — Woibot Coder agent + render proof", tools: ["Woibot Coder", "Chromium", "Node 22"] },
  research:       { cost: 1.2, minutes: 12, label: "Deep Research — multi-source + report", tools: ["Web Search", "pgvector"] },
  doc:            { cost: 0.8, minutes: 10, label: "Document — 12 pages + charts", tools: ["python-docx", "Puppeteer"] },
  video_analysis: { cost: 3.0, minutes: 15, label: "Video Analysis — 60min → 5 clips", tools: ["FFmpeg", "Whisper"] },
  video_gen:      { cost: 1.2, minutes: 8,  label: "Video Compose — title cards + audio → MP4 (ffmpeg)", tools: ["ImageMagick", "FFmpeg"] },
  media_heavy:    { cost: 5.0, minutes: 20, label: "Media Processing — heavy", tools: ["FFmpeg"] },
  data:           { cost: 1.5, minutes: 14, label: "Data Analysis — dashboard", tools: ["Pandas", "Charts"] },
  image:          { cost: 0.5, minutes: 6,  label: "Image Understanding — OCR + vision report", tools: ["Tesseract", "Vision"] },
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

  /* Deliverable routing: a real creation request = creation verb + work noun.
     This matches how people actually type ("สร้างเอกสารรายงาน...", "ทำไฟล์ word",
     "เขียนรายงานสรุปยอดขายเป็นเอกสาร PDF") — the old regex only knew a few
     fixed phrases and sent everything else to chat, which made the product
     look broken even though the harness was fine. */
  const CREATE_VERB = /(สร้าง|จัดทำ|ร่าง|ออกแบบ|สั่งทำ|สรุปเป็น|แปลงเป็น|ทำเป็น|ทำไฟล์|ทำ(?!ไม|ได้|งาน|เลย|อยู่)|เขียน|วิจัย|วิเคราะห์|เปรียบเทียบ|ค้นคว้า|สำรวจ|convert|create|make|generate|build|write|draft|produce|prepare|research|analyze)/;
  const QUESTION_ONLY = /(คืออะไร|ดียังไง|มีกี่|อธิบาย|แนะนำ|หน่อยว่า|ใช่ไหม|ยังไง|ไหม|\?|？)/;
  const VIDEO_NOUN = /(วิดีโอ|คลิป|video|tiktok|reel|shorts|ตัดต่อ|vdo)/;
  const DOC_NOUN = /(เอกสาร|ไฟล์|document|file|docx|\.doc\b|word|pdf|excel|xlsx|csv|สไลด์|slide|pptx|แฟ้ม|รายงาน|report|ข้อเสนอ|proposal|สัญญา|contract|จดหมาย|หนังสือ|คู่มือ|แบบฟอร์ม|ใบเสนอราคา|ใบเสร็จ|presentation|บทความ|แผนการ|แผนงาน|memo|ใบปะหน้า)/;
  const DATA_NOUN = /(excel|xlsx|csv|ตารางข้อมูล|กราฟ|kpi|dashboard|forecast|พยากรณ์|ยอดขาย|สถิติ|ชุดข้อมูล|spreadsheet)/;
  const RESEARCH_NOUN = /(วิจัย|research|ตลาด|competitor|คู่แข่ง|compare|เปรียบเทียบ|เทรนด์|trend|ข้อมูลอุตสาหกรรม)/;
  const IMAGE_NOUN = /(โปสเตอร์|โลโก้|logo|banner|โพสต์|ภาพประกอบ|illustration|poster|อินโฟกราฟิก|infographic)/;
  const CODE_NOUN = /(เว็บ|แอป|app|website|เว็บไซต์|ระบบ|โปรแกรม|โค้ด|code|script|เกม|game|หน้าเว็บ|landing|dashboard|cms|api)/;

  const isQuestion = QUESTION_ONLY.test(s) && !/(ทำ|สร้าง|เขียน|จัดทำ|แปลงเป็น|สรุปเป็น)/.test(s.replace(QUESTION_ONLY, ""));
  const hasVerb = CREATE_VERB.test(s);
  const hasNoun = VIDEO_NOUN.test(s) || DOC_NOUN.test(s) || DATA_NOUN.test(s) || RESEARCH_NOUN.test(s) || IMAGE_NOUN.test(s) || CODE_NOUN.test(s);

  // Legacy strong triggers kept for well-known compound phrases.
  const STRONG = /(สร้างเว็บ|สร้างแอป|สร้างระบบ|ทำคลิป|ทำสไลด์|ทำกราฟ|ทำเอกสาร|สร้างเอกสาร|ทำไฟล์|สร้างไฟล์|แอดมิน|ออกแบบเว็บ)/;
  if ((!hasVerb || isQuestion || !hasNoun) && !STRONG.test(s)) {
    return { product: "teammate", confidence: 0.88, reason: "งานประจำวัน/ถามตอบ — Teammate ทำได้โดยตรง" };
  }

  let kind: WorkKind = "coding";
  let reason = "ตรวจพบคำสั่งสร้างผลงาน (deliverable) ต้องใช้ Work";
  if (VIDEO_NOUN.test(s)) {
    kind = /(วิเคราะห์|ตัด|analysis|edit|สรุปคลิป|ไฮไลต์)/.test(s) ? "video_analysis" : "video_gen";
    reason = "ตรวจพบงานวิดีโอ — ใช้ Work video pipeline";
  } else if (/(เอกสาร|docx|\.doc\b|word|pdf|รายงาน|ข้อเสนอ|proposal|สัญญา|จดหมาย|คู่มือ|แบบฟอร์ม|ใบเสนอราคา|ใบเสร็จ|สไลด์|slide|pptx|presentation|บทความ|แผนการ)/.test(s)) {
    kind = "doc";
    reason = "ตรวจพบคำขอเอกสาร/รายงาน — ใช้ Work document pipeline";
  } else if (DATA_NOUN.test(s)) {
    kind = "data";
    reason = "ตรวจพบงานข้อมูล/ตาราง — ใช้ Work data pipeline";
  } else if (RESEARCH_NOUN.test(s)) {
    kind = "research";
    reason = "ตรวจพบงานวิจัย/วิเคราะห์ — ใช้ Work research pipeline";
  } else if (IMAGE_NOUN.test(s)) {
    kind = "image";
    reason = "ตรวจพบงานภาพ/โปสเตอร์ — ใช้ Work image pipeline";
  } else if (CODE_NOUN.test(s)) {
    kind = "coding";
    reason = "ตรวจพบงานสร้างแอป/เว็บ — ใช้ Woibot Coder";
  }

  return { product: "work", workKind: kind, confidence: 0.92, reason };
}

export async function createTaskFromHandoff(userId: string, packet: HandoffPacket, workKind: WorkKind) {
  // ML recall injection: context.memory_snippet now comes from hybrid
  // (recency + BGE-M3 semantic) recall over the user's memories. The field
  // name stays `memory_snippet` so the UI/agent reads the packet unchanged.
  let enriched: HandoffPacket = packet;
  try {
    const goal = String(packet?.goal || "").trim();
    if (goal) {
      const recalled = await recallContext(userId, goal);
      if (recalled) enriched = { ...packet, context: { ...packet.context, memory_snippet: recalled } };
    }
  } catch {
    // recall is best-effort; never block task creation
  }

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
      handoffPacket: JSON.stringify(enriched),
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

// High-level execute: ensure computer → run the real agent → verify → deliver
export async function executeTask(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error(`Task not found: ${taskId}`);
  const userId = (task as any).userId as string;
  if (!userId) throw new Error("Task has no owner");

  const kind = ((task as any).workKind || "research") as WorkKind;

  const progress = async (pct: number, step: string, note?: string) => {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "in_progress", progress: pct, currentStep: note ? `${step}: ${note}` : step },
    }).catch(() => {});
  };

  // 1) the task must have a running Cloud Computer, otherwise nothing runs
  await prisma.task.update({ where: { id: taskId }, data: { status: "planning", progress: 3, startedAt: new Date() } }).catch(() => {});
  const computer = await ensureComputer(userId);
  if (computer.status !== "running") {
    const msg = `Cloud Computer ไม่พร้อม (${computer.status}${computer.detail ? `: ${computer.detail}` : ""})`;
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "failed", progress: 0, error: msg },
    }).catch(() => {});
    return { ok: false, error: msg };
  }

  // 2) run the real agent
  const { runAgentTask } = await import("./agent");
  const result = await runAgentTask({
    taskId,
    userId,
    goal: String((task as any).goal || (task as any).title || ""),
    title: String((task as any).title || "woibot task"),
    workKind: kind,
    onProgress: progress,
  });

  if (!result.ok) {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: result.skipped === "unsupported" ? "failed" : "failed",
        progress: 0,
        error: result.error || "agent failed",
        currentStep: null,
      },
    }).catch(() => {});
    return { ok: false, error: result.error, notes: result.notes };
  }

  // 3) register the files that actually exist
  for (const f of result.files) {
    const name = f.split("/").pop() || f;
    const mime = name.endsWith(".pdf") ? "application/pdf"
      : name.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : name.endsWith(".md") ? "text/markdown"
      : name.endsWith(".csv") ? "text/csv"
      : name.endsWith(".json") ? "application/json"
      : name.endsWith(".mp4") ? "video/mp4"
      : name.endsWith(".png") ? "image/png"
      : name.endsWith(".html") ? "text/html"
      : "application/octet-stream";
    await prisma.deliverable.create({
      data: {
        taskId,
        kind: kind,
        fileName: f,
        fileUrl: `/api/tasks/${taskId}/deliverable?path=${encodeURIComponent(f)}`,
        mimeType: mime,
        editable: !name.endsWith(".pdf") && !name.endsWith(".mp4"),
      },
    }).catch(() => {});
  }

  // 4) verification runs against those real files
  await prisma.task.update({ where: { id: taskId }, data: { status: "reviewing", progress: 88 } }).catch(() => {});
  const verification = await createVerificationReport(taskId, mapKindToVerifyType(kind), undefined, { userId });

  const passed = verification.passed;
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      verification: JSON.stringify(verification),
      status: passed ? "completed" : "partially_completed",
      progress: passed ? 100 : 88,
      completedAt: passed ? new Date() : undefined,
      currentStep: null,
      error: passed ? null : `ตรวจไม่ผ่าน: ${verification.checks.filter((c) => !c.passed && c.severity === "critical").map((c) => c.name).join(", ")}`,
    },
  });

  // 5) meter usage only for work that actually produced files
  try {
    const estimate = (task as any).estimate;
    const cost = typeof estimate?.cost === "number" ? estimate.cost : 0;
    await prisma.usageEvent.create({
      data: {
        userId,
        taskId,
        kind,
        cost,
        minutes: Number(estimate?.minutes || 0),
        status: passed ? "completed" : "partial",
      },
    }).catch(() => {});
  } catch {}

  return { ok: passed, result, verification, task: updated };
}

function mapKindToVerifyType(kind?: string | null): VerificationReport["type"] {
  if (kind === "coding") return "coding";
  if (kind === "doc") return "doc";
  if (kind === "video_gen" || kind === "video_analysis" || kind === "media_heavy") return "video";
  if (kind === "research") return "research";
  if (kind === "data") return "data";
  if (kind === "image") return "doc";
  return "research";
}

export { runAgentTask } from "./agent";
