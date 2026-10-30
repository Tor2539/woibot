import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId, errorResponse, successResponse } from "@/lib/auth";

// GET /api/routines — list routines for user
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);

    const status = req.nextUrl.searchParams.get("status");
    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;

    const routines = await prisma.routine.findMany({
      where: where as never,
      orderBy: { nextRun: "asc" },
    });

    const parsed = routines.map((r: any) => ({
      ...r,
      trigger: safeJson(r.trigger),
      action: safeJson(r.action),
      lastResult: r.lastResult ? safeJson(r.lastResult) : null,
    }));

    return successResponse({ routines: parsed, total: parsed.length });
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to list routines", 500);
  }
}

// POST /api/routines — create routine (promote task to routine per PRD 4.6)
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);

    const body = await req.json() as {
      title?: string;
      description?: string;
      trigger?: { type: "cron" | "event" | "manual"; expr: string; event?: string };
      action?: Record<string, unknown>;
      teammateId?: string;
      taskId?: string; // optional: create from existing task
    };

    if (!body.title?.trim()) return errorResponse("title is required", 400);
    if (!body.trigger?.expr && body.trigger?.type !== "manual") return errorResponse("trigger.expr is required (cron: 0 8 * * * or event name)", 400);

    // Enforce plan limits: Starter 20, Pro 100
    const count = await prisma.routine.count({ where: { userId, status: "active" } });
    const sub = await prisma.subscription.findFirst({ where: { userId }, orderBy: { periodStart: "desc" } });
    const limit = sub?.plan === "pro" ? 100 : sub?.plan === "starter" ? 20 : 3;
    if (count >= limit) return errorResponse(`Routine limit reached (${limit}) for plan ${sub?.plan || "free"}`, 403);

    // Compute nextRun from cron (simple: daily 08:00)
    let nextRun: Date | null = null;
    if (body.trigger?.type === "cron") {
      nextRun = computeNextCron(body.trigger.expr);
    } else if (body.trigger?.type === "event") {
      nextRun = null; // event-triggered, no schedule
    }

    const routine = await prisma.routine.create({
      data: {
        userId,
        teammateId: body.teammateId,
        title: body.title,
        description: body.description,
        trigger: JSON.stringify(body.trigger || { type: "cron", expr: "0 8 * * *" }),
        action: JSON.stringify(body.action || { template: body.title, sourceTaskId: body.taskId }),
        status: "active",
        nextRun,
        runCount: 0,
        failCount: 0,
      },
    });

    return successResponse(routine, 201);
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to create routine", 500);
  }
}

function safeJson(v: string) { try { return JSON.parse(v); } catch { return v; } }

function computeNextCron(expr: string): Date | null {
  // minimal cron: "0 8 * * *" -> tomorrow 08:00 if past 08:00 today
  // for demo, just add 24h
  try {
    const now = new Date();
    // naive: next run = tomorrow 08:00 Bangkok (UTC+7)
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(1, 0, 0, 0); // 01:00 UTC = 08:00 Bangkok
    return next;
  } catch {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
}
