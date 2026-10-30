import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId, errorResponse, successResponse, canTransition, TASK_STATUSES } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/tasks/[id] — single task with deliverables
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);
    const { id } = await params;

    const task = await prisma.task.findFirst({
      where: { id, userId },
      include: { deliverables: true, files: true },
    });
    if (!task) return errorResponse("Task not found", 404);

    return successResponse({
      ...task,
      handoffPacket: task.handoffPacket ? safeJson(task.handoffPacket) : null,
      verification: task.verification ? safeJson(task.verification) : null,
      estimate: task.estimate ? safeJson(task.estimate) : null,
    });
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to fetch task", 500);
  }
}

// PATCH /api/tasks/[id] — update task (status transitions, progress, approve estimate)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);
    const { id } = await params;

    const task = await prisma.task.findFirst({ where: { id, userId } });
    if (!task) return errorResponse("Task not found", 404);

    const body = await req.json() as {
      status?: string;
      progress?: number;
      title?: string;
      goal?: string;
      description?: string;
      executionMode?: "cloud" | "local";
      approveEstimate?: boolean;
      error?: string;
    };

    const data: Record<string, unknown> = {};

    if (body.status !== undefined) {
      if (!(TASK_STATUSES as readonly string[]).includes(body.status)) return errorResponse(`Invalid status: ${body.status}`, 400);
      if (!canTransition(task.status, body.status)) {
        return errorResponse(`Cannot transition from ${task.status} to ${body.status}`, 409, { from: task.status, to: body.status });
      }
      data.status = body.status;
      if (body.status === "completed" || body.status === "partially_completed") data.completedAt = new Date();
      if (body.status === "cancelled") data.progress = task.progress;
    }

    if (body.progress !== undefined) {
      const p = Math.max(0, Math.min(100, Math.round(body.progress)));
      data.progress = p;
    }
    if (body.title !== undefined) data.title = body.title.slice(0, 200);
    if (body.goal !== undefined) data.goal = body.goal;
    if (body.description !== undefined) data.description = body.description;
    if (body.executionMode !== undefined) data.executionMode = body.executionMode;
    if (body.error !== undefined) data.error = body.error;

    // Approve estimate — flips estimate.approved = true (cost isolation gate)
    if (body.approveEstimate) {
      const est = task.estimate ? safeJson(task.estimate) : null;
      if (est) {
        est.approved = true;
        est.approvedAt = new Date().toISOString();
        data.estimate = JSON.stringify(est);
        // auto-move to planning if was queued
        if (task.status === "queued") data.status = "planning";
      }
    }

    const updated = await prisma.task.update({
      where: { id },
      data,
      include: { deliverables: true },
    });

    return successResponse({
      ...updated,
      estimate: updated.estimate ? safeJson(updated.estimate) : null,
      verification: updated.verification ? safeJson(updated.verification) : null,
    });
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to update task", 500);
  }
}

// DELETE /api/tasks/[id] — soft cancel (moves to cancelled)
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);
    const { id } = await params;

    const task = await prisma.task.findFirst({ where: { id, userId } });
    if (!task) return errorResponse("Task not found", 404);

    if (task.status === "completed") return errorResponse("Cannot delete completed task — archive instead", 400);

    const updated = await prisma.task.update({
      where: { id },
      data: { status: "cancelled", archivedAt: new Date() },
    });
    return successResponse(updated);
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to delete task", 500);
  }
}

function safeJson(v: string) { try { return JSON.parse(v); } catch { return v; } }
