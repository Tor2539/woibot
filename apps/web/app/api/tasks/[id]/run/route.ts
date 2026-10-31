import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { executeTask } from "@/lib/harness";

/**
 * POST /api/tasks/[id]/run — actually execute the task in the user's Cloud Computer.
 * Long-running (30-120s); Cloud Run timeout is 300s.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findFirst({ where: { id: id, userId } });
  if (!task) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });

  const status = String((task as any).status);
  if (!["queued", "failed", "partially_completed", "paused", "waiting_for_user"].includes(status)) {
    return NextResponse.json({ ok: false, error: `งานนี้อยู่สถานะ ${status} — รันซ้ำไม่ได้` }, { status: 409 });
  }

  try {
    const out = await executeTask(id);
    const fresh = await prisma.task.findUnique({ where: { id: id } });
    return NextResponse.json({
      ok: Boolean((out as any).ok),
      task: fresh,
      verification: (out as any).verification || null,
      notes: (out as any).notes || (out as any).result?.notes || [],
      error: (out as any).error || null,
    });
  } catch (e) {
    await prisma.task.update({
      where: { id: id },
      data: { status: "failed", error: e instanceof Error ? e.message : "run failed" },
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "run failed" }, { status: 500 });
  }
}
