import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId, errorResponse, successResponse } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/routines/[id] — single routine
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);
    const { id } = await params;
    const routine = await prisma.routine.findFirst({ where: { id, userId } });
    if (!routine) return errorResponse("Routine not found", 404);
    return successResponse({
      ...routine,
      trigger: safeJson(routine.trigger),
      action: safeJson(routine.action),
      lastResult: routine.lastResult ? safeJson(routine.lastResult) : null,
    });
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to fetch routine", 500);
  }
}

// PATCH /api/routines/[id] — update status/trigger/action
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);
    const { id } = await params;
    const routine = await prisma.routine.findFirst({ where: { id, userId } });
    if (!routine) return errorResponse("Routine not found", 404);

    const body = await req.json() as {
      title?: string;
      description?: string;
      status?: "active" | "paused" | "failed" | "disabled";
      trigger?: Record<string, unknown>;
      action?: Record<string, unknown>;
    };

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.status !== undefined) {
      const allowed = ["active", "paused", "failed", "disabled"];
      if (!allowed.includes(body.status)) return errorResponse(`Invalid status: ${body.status}`, 400);
      data.status = body.status;
    }
    if (body.trigger !== undefined) data.trigger = JSON.stringify(body.trigger);
    if (body.action !== undefined) data.action = JSON.stringify(body.action);

    const updated = await prisma.routine.update({ where: { id }, data });
    return successResponse({
      ...updated,
      trigger: safeJson(updated.trigger),
      action: safeJson(updated.action),
    });
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to update routine", 500);
  }
}

// DELETE /api/routines/[id] — disable routine
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);
    const { id } = await params;
    const routine = await prisma.routine.findFirst({ where: { id, userId } });
    if (!routine) return errorResponse("Routine not found", 404);

    const updated = await prisma.routine.update({ where: { id }, data: { status: "disabled" } });
    return successResponse(updated);
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to delete routine", 500);
  }
}

function safeJson(v: string) { try { return JSON.parse(v); } catch { return v; } }
