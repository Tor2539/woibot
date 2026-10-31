import { prisma } from "../db";

export type Product = "teammate" | "work";
export type WorkKind = "coding" | "research" | "doc" | "video_analysis" | "video_gen" | "media_heavy" | "data" | "image";

// Subscription plans (Teammate) — monthly recurring
export const PLANS = {
  free:    { name: "Free",    price: 0,   priceLabel: "฿0",   cpu: 0.5, ram: "1GB", tokens: 200_000, routines: 3,  teammates: 1, storageGb: 2 },
  starter: { name: "Starter", price: 399, priceLabel: "฿399", cpu: 1,   ram: "2GB", tokens: 2_000_000, routines: 20, teammates: 3, storageGb: 10 },
  pro:     { name: "Pro",     price: 999, priceLabel: "฿999", cpu: 2,   ram: "4GB", tokens: 10_000_000, routines: 100, teammates: 10, storageGb: 50 },
  enterprise: { name: "Enterprise", price: 4990, priceLabel: "฿4,990", cpu: 4, ram: "8GB", tokens: 50_000_000, routines: 500, teammates: 50, storageGb: 200 },
} as const;

export type PlanId = keyof typeof PLANS;

// Work meter rates — USD, isolated from Teammate subscription
export const WORK_RATES: Record<WorkKind, { unit: string; rate: number; label: string; labelTh: string }> = {
  coding:         { unit: "1K tokens", rate: 0.02,  label: "Coding",         labelTh: "โค้ด" },
  research:       { unit: "search",    rate: 0.015, label: "Research",       labelTh: "วิจัย" },
  doc:            { unit: "doc",       rate: 0.50,  label: "Document",       labelTh: "เอกสาร" },
  video_analysis: { unit: "min",       rate: 0.20,  label: "Video Analysis", labelTh: "วิเคราะห์วิดีโอ" },
  video_gen:      { unit: "sec",       rate: 0.30,  label: "Video Gen",      labelTh: "สร้างวิดีโอ" },
  media_heavy:    { unit: "vCPU-h",    rate: 0.05,  label: "Cloud Exec",     labelTh: "ประมวลผลบนคลาวด์" },
  data:           { unit: "analysis",  rate: 0.10,  label: "Data/BI",        labelTh: "วิเคราะห์ข้อมูล" },
  image: { unit: "task", rate: 0.5, label: "Image understanding", labelTh: "อ่านภาพ" },
};

export function calculateWorkCost(kind: WorkKind, quantity: number): number {
  const r = WORK_RATES[kind];
  if (!r) throw new Error(`Unknown WorkKind: ${kind}`);
  return Math.round(quantity * r.rate * 100) / 100;
}

// Work estimates shown before starting Work (Estimate Card)
export const WORK_ESTIMATES: Record<WorkKind, { cost: number; minutes: number; label: string; tools: string[] }> = {
  coding:         { cost: 2.40, minutes: 18, label: "Coding Work — build + tests + preview", tools: ["Next.js", "Prisma", "Vitest", "Playwright"] },
  research:       { cost: 1.20, minutes: 12, label: "Deep Research — multi-source + report", tools: ["Web Search", "pgvector", "Report Builder"] },
  doc:            { cost: 0.80, minutes: 10, label: "Document — 12 pages + charts", tools: ["python-docx", "Puppeteer", "Charts"] },
  video_analysis: { cost: 3.00, minutes: 15, label: "Video Analysis — 60min → 5 clips", tools: ["FFmpeg", "Whisper", "Scene Detect"] },
  video_gen:      { cost: 1.20, minutes: 8,  label: "Video Compose — title cards + audio → MP4 (ffmpeg)", tools: ["ImageMagick", "FFmpeg", "ffprobe"] },
  media_heavy:    { cost: 5.00, minutes: 20, label: "Media Processing — heavy", tools: ["FFmpeg", "ImageMagick"] },
  data:           { cost: 1.50, minutes: 14, label: "Data Analysis — Excel/CSV → dashboard", tools: ["Pandas", "Charts", "Excel"] },
  image:          { cost: 0.50, minutes: 6,  label: "Image — OCR + vision report / poster", tools: ["Tesseract", "Vision", "ImageMagick"] },
};

export function estimateTask(kind: WorkKind, opts?: { pages?: number; seconds?: number; minutes?: number }): { kind: WorkKind; cost: number; minutes: number; label: string; tools: string[] } {
  const base = WORK_ESTIMATES[kind] ?? WORK_ESTIMATES.coding;
  let cost = base.cost;
  let minutes = base.minutes;
  if (opts?.pages && opts.pages > 10) cost += (opts.pages - 10) * 0.08;
  if (opts?.seconds && opts.seconds > 30) cost += (opts.seconds - 30) * 0.05;
  if (opts?.minutes && opts.minutes > 10) cost += (opts.minutes - 10) * 0.12;
  return { kind, cost: Math.round(cost * 100) / 100, minutes, label: base.label, tools: base.tools };
}

// --- Quota checks (cost isolation) ---

export async function canAffordWork(userId: string, estimatedCost: number): Promise<{ ok: boolean; reason?: string; quota?: { monthlyCap: number; monthlyUsed: number; perTaskCap: number } }> {
  const quota = await prisma.workQuota.findUnique({ where: { userId } });
  if (!quota) return { ok: true, quota: { monthlyCap: 50, monthlyUsed: 0, perTaskCap: 5 } };
  if (estimatedCost > quota.perTaskCap) {
    return { ok: false, reason: `เกินวงเงินต่อครั้ง (cap $${quota.perTaskCap.toFixed(2)}, ประเมิน $${estimatedCost.toFixed(2)}) — ปรับวงเงินหรือลดขอบเขตงาน`, quota: { monthlyCap: quota.monthlyCap, monthlyUsed: quota.monthlyUsed, perTaskCap: quota.perTaskCap } };
  }
  if (quota.monthlyUsed + estimatedCost > quota.monthlyCap) {
    return { ok: false, reason: `เกินวงเงินรายเดือน (cap $${quota.monthlyCap.toFixed(2)}, ใช้แล้ว $${quota.monthlyUsed.toFixed(2)}, ประเมิน $${estimatedCost.toFixed(2)})`, quota: { monthlyCap: quota.monthlyCap, monthlyUsed: quota.monthlyUsed, perTaskCap: quota.perTaskCap } };
  }
  return { ok: true, quota: { monthlyCap: quota.monthlyCap, monthlyUsed: quota.monthlyUsed, perTaskCap: quota.perTaskCap } };
}

// --- Usage recording with ledger separation ---

export async function recordUsage(userId: string, data: {
  product: Product;
  kind?: WorkKind | string;
  taskId?: string;
  routineId?: string;
  tokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  gpuSeconds?: number;
  buildMinutes?: number;
  storageMb?: number;
  cost: number;
  meta?: Record<string, unknown>;
}) {
  if (data.cost < 0) throw new Error("cost must be >= 0");
  if (data.tokens !== undefined && data.tokens < 0) throw new Error("tokens must be >= 0");

  const event = await prisma.usageEvent.create({
    data: {
      userId,
      product: data.product,
      kind: data.kind,
      taskId: data.taskId,
      routineId: data.routineId,
      tokens: data.tokens ?? 0,
      inputTokens: data.inputTokens ?? 0,
      outputTokens: data.outputTokens ?? 0,
      gpuSeconds: data.gpuSeconds ?? 0,
      buildMinutes: data.buildMinutes ?? 0,
      storageMb: data.storageMb ?? 0,
      cost: data.cost,
      meta: data.meta ? JSON.stringify(data.meta) : undefined,
    },
  });

  // Only Work increments WorkQuota (cost isolation: Teammate never touches Work ledger)
  if (data.product === "work") {
    await prisma.workQuota.updateMany({
      where: { userId },
      data: { monthlyUsed: { increment: data.cost } },
    });
  }

  return event;
}

// --- Summary with ledger separation ---

export async function getUsageSummary(userId: string, opts?: { days?: number; limit?: number }) {
  const days = opts?.days ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const limit = opts?.limit ?? 100;

  const [events, quota, subscription] = await Promise.all([
    prisma.usageEvent.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.workQuota.findUnique({ where: { userId } }),
    prisma.subscription.findFirst({ where: { userId }, orderBy: { periodStart: "desc" } }),
  ]);

  const teammateEvents = events.filter((e: any) => e.product === "teammate");
  const workEvents = events.filter((e: any) => e.product === "work");

  const teammateCost = teammateEvents.reduce((s: number, e: any) => s + e.cost, 0);
  const workCost = workEvents.reduce((s: number, e: any) => s + e.cost, 0);

  const teammateTokens = teammateEvents.reduce((s: number, e: any) => s + e.tokens, 0);
  const workTokens = workEvents.reduce((s: number, e: any) => s + e.tokens, 0);

  // Group by kind
  const byKind: Record<string, { count: number; cost: number }> = {};
  for (const e of events) {
    const k = e.kind || e.product;
    if (!byKind[k]) byKind[k] = { count: 0, cost: 0 };
    byKind[k].count += 1;
    byKind[k].cost += e.cost;
  }

  const plan = subscription ? (PLANS[subscription.plan as PlanId] || PLANS.starter) : PLANS.starter;
  const quotaInfo = quota ? {
    monthlyCap: quota.monthlyCap,
    perTaskCap: quota.perTaskCap,
    monthlyUsed: quota.monthlyUsed,
    remaining: Math.max(0, quota.monthlyCap - quota.monthlyUsed),
    alertThreshold: quota.alertThreshold,
    isNearCap: quota.monthlyUsed / quota.monthlyCap >= quota.alertThreshold,
    periodStart: quota.periodStart,
  } : null;

  return {
    period: { days, since, till: new Date() },
    totals: {
      all: Math.round((teammateCost + workCost) * 100) / 100,
      teammate: Math.round(teammateCost * 100) / 100,
      work: Math.round(workCost * 100) / 100,
      teammateTokens,
      workTokens,
    },
    ledgers: {
      teammate: { events: teammateEvents, cost: teammateCost, tokens: teammateTokens },
      work: { events: workEvents, cost: workCost, tokens: workTokens },
    },
    byKind,
    quota: quotaInfo,
    subscription: subscription ? {
      plan: subscription.plan,
      planDetail: plan,
      status: subscription.status,
      periodStart: subscription.periodStart,
      periodEnd: subscription.periodEnd,
      allowance: subscription.allowance ? safeJsonParse(subscription.allowance, {}) : {},
    } : null,
    events,
  };
}

function safeJsonParse(v: string, fallback: unknown) {
  try { return JSON.parse(v); } catch { return fallback; }
}

// --- Billing helpers for API ---

export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

export function getPlanAllowance(planId: PlanId) {
  return PLANS[planId] ?? PLANS.starter;
}
