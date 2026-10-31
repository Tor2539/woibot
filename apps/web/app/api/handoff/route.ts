import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId, errorResponse, successResponse } from "@/lib/auth";
import { estimateTask, canAffordWork } from "@/lib/billing";
import type { WorkKind } from "@/lib/billing";

function cuid() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

function inferWorkKind(goal: string): WorkKind {
  const s = goal.toLowerCase();
  if (/วิดีโอ|video|คลิป|tiktok|reel/.test(s)) return s.includes("วิเคราะห์") ? "video_analysis" : "video_gen";
  if (/เอกสาร|รายงาน|presentation|proposal|pdf|docx/.test(s)) return "doc";
  if (/วิจัย|research|วิเคราะห์.*ตลาด/.test(s)) return "research";
  return "coding";
}

/** Resolve the user's main teammate, mirroring /api/chat fallback logic. */
async function mainTeammate(userId: string) {
  const existing = await prisma.teammate.findFirst({ where: { userId, isMain: true } });
  if (existing) return existing;
  const anyTeammate = await prisma.teammate.findFirst({ where: { userId } });
  if (anyTeammate) return anyTeammate;
  return prisma.teammate.create({
    data: { id: "tm_main", userId, name: "Woibot Main", role: "Chief Personal Teammate", isMain: true, language: "th" },
  });
}

/**
 * Reverse delegation: persist a summary of this handoff on the originating
 * teammate thread so the conversation reflects that Work now owns the task.
 */
async function persistHandoffMessage(
  userId: string,
  teammateId: string,
  task: { id: string; title: string },
  traceId: string,
  workKind: WorkKind,
  est: { cost: number; minutes: number },
) {
  await prisma.chatMessage.create({
    data: {
      teammateId,
      userId,
      role: "assistant",
      content: `ส่งงานต่อให้ Work แล้ว — "${task.title}" (${workKind})\n\n• trace: ${traceId}\n• ประมาณการ: $${est.cost} · ~${est.minutes} นาที\n• ติดตามความคืบหน้าที่แท็บ Work หรือ /tasks/${task.id}`,
      meta: JSON.stringify({
        source: "handoff",
        taskId: task.id,
        trace_id: traceId,
        workKind,
        estimate: est,
      }),
    },
  });
}

// POST /api/handoff — accept a HandoffPacket from Teammate and create a real Work task
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);

    const body = await req.json().catch(() => ({})) as {
      goal?: string;
      message?: string;
      execution_mode?: string;
      executionMode?: string;
      trace_id?: string;
      workKind?: WorkKind;
      chat_history?: unknown[];
      memory_snippet?: string;
      user_prefs?: Record<string, unknown>;
      attachments?: unknown[];
      deliverables?: unknown[];
      constraints?: Record<string, unknown>;
      verification_criteria?: string[];
      teammateId?: string;
    };

    const goal = (body.goal || body.message || "").trim();
    if (!goal) {
      return errorResponse("กรุณาระบุ goal หรือ message ของงานที่จะส่งต่อ", 400);
    }

    const execution_mode = (body.execution_mode || body.executionMode || "cloud") as "cloud" | "local";
    const trace_id = body.trace_id || `trace_${cuid()}`;
    const workKind = (body.workKind || inferWorkKind(goal)) as WorkKind;

    // Build HandoffPacket per spec
    const packet = {
      goal,
      context: {
        chat_history: body.chat_history || [],
        memory_snippet: body.memory_snippet || "",
        user_prefs: body.user_prefs || {},
      },
      attachments: body.attachments || [],
      deliverables: body.deliverables || [],
      constraints: body.constraints || {},
      verification_criteria: body.verification_criteria || ["ไฟล์เปิดได้", "preview ผ่าน"],
      execution_mode,
      trace_id,
    };

    // Estimate + quota check, same cost-isolation path as POST /api/tasks
    const est = estimateTask(workKind);
    const quotaCheck = await canAffordWork(userId, est.cost);
    if (!quotaCheck.ok) {
      return NextResponse.json({ ok: false, error: quotaCheck.reason, estimate: est, quota: quotaCheck.quota }, { status: 402 });
    }

    const task = await prisma.task.create({
      data: {
        userId,
        title: goal.slice(0, 120),
        goal,
        product: "work",
        workKind,
        status: "queued",
        executionMode: execution_mode,
        traceId: trace_id,
        handoffPacket: JSON.stringify(packet),
        estimate: JSON.stringify({ ...est, approved: false }),
        progress: 0,
      },
    });

    // Reverse delegation: real ChatMessage row on the originating teammate thread
    try {
      const teammate = body.teammateId
        ? (await prisma.teammate.findFirst({ where: { id: body.teammateId, userId } })) || (await mainTeammate(userId))
        : await mainTeammate(userId);
      await persistHandoffMessage(userId, teammate.id, task, trace_id, workKind, est);
    } catch {
      // chat history persistence is best-effort; the task itself is already real
    }

    return NextResponse.json({
      ok: true,
      trace_id,
      task,
      packet,
      estimate: est,
      message: `HandoffPacket ถูกส่งแล้ว • trace ${trace_id} • สร้างงาน Work เรียบร้อย`,
      next: `/tasks/${task.id}`,
    }, { status: 201 });
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "สร้างงาน Work ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", 500);
  }
}

export async function GET() {
  return successResponse({ hint: "POST {goal, execution_mode, chat_history, memory_snippet}" });
}
