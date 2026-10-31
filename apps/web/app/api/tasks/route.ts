import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId, errorResponse, successResponse, TASK_STATUSES } from "@/lib/auth";
import { estimateTask, canAffordWork } from "@/lib/billing";
import type { WorkKind } from "@/lib/billing";

// GET /api/tasks — list tasks (unified Tasks board per PRD 7.5)
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");
    const product = searchParams.get("product"); // teammate | work
    const workKind = searchParams.get("workKind");
    const q = searchParams.get("q");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };
    if (status) {
      if (!(TASK_STATUSES as readonly string[]).includes(status)) return errorResponse(`Invalid status: ${status}`, 400);
      where.status = status;
    }
    if (product) where.product = product;
    if (workKind) where.workKind = workKind;
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { goal: { contains: q } },
      ];
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where: where as never,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        include: { deliverables: true },
      }),
      prisma.task.count({ where: where as never }),
    ]);

    // Parse JSON columns for client
    const parsed = tasks.map((t: any) => ({
      ...t,
      handoffPacket: t.handoffPacket ? safeJson(t.handoffPacket) : null,
      verification: t.verification ? safeJson(t.verification) : null,
      estimate: t.estimate ? safeJson(t.estimate) : null,
    }));

    return successResponse({
      tasks: parsed,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to list tasks", 500);
  }
}

// POST /api/tasks — create task (with cost isolation for Work)
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);

    const body = await req.json() as {
      title?: string;
      goal?: string;
      description?: string;
      product?: "teammate" | "work";
      workKind?: WorkKind;
      executionMode?: "cloud" | "local";
      handoffPacket?: Record<string, unknown>;
      pages?: number;
      seconds?: number;
      minutes?: number;
      // for teammate tasks: just goal
    };

    if (!body.goal || !body.goal.trim()) return errorResponse("goal is required", 400);
    const product = body.product || "work";
    const workKind = body.workKind || "coding";
    const executionMode = body.executionMode || "cloud";
    const title = (body.title || body.goal).slice(0, 120);

    // Teammate product: no cost, immediate creation
    if (product === "teammate") {
      const task = await prisma.task.create({
        data: {
          userId,
          title,
          goal: body.goal,
          description: body.description,
          product: "teammate",
          status: "in_progress",
          executionMode,
          traceId: `trace_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
          progress: 10,
        },
      });
      // ledger: teammate usage (small)
      await prisma.usageEvent.create({
        data: { userId, product: "teammate", kind: "chat", taskId: task.id, tokens: 500, cost: 0.01 },
      });
      return successResponse(task, 201);
    }

    // Work product: must estimate + check quota before creation (cost isolation)
    const est = estimateTask(workKind, { pages: body.pages, seconds: body.seconds, minutes: body.minutes });

    const quotaCheck = await canAffordWork(userId, est.cost);
    if (!quotaCheck.ok) {
      return NextResponse.json({ ok: false, error: quotaCheck.reason, estimate: est, quota: quotaCheck.quota }, { status: 402 });
    }

    const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    const task = await prisma.task.create({
      data: {
        userId,
        title,
        goal: body.goal,
        description: body.description,
        product: "work",
        workKind,
        status: "queued",
        executionMode,
        traceId,
        handoffPacket: body.handoffPacket ? JSON.stringify(body.handoffPacket) : null,
        estimate: JSON.stringify({ ...est, approved: false }),
        progress: 0,
      },
    });

    return NextResponse.json({
      ok: true,
      data: task,
      estimate: est,
      quota: quotaCheck.quota,
      message: "Task created — review estimate before starting (cost isolation)",
    }, { status: 201 });

  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to create task", 500);
  }
}

function safeJson(v: string) { try { return JSON.parse(v); } catch { return v; } }
