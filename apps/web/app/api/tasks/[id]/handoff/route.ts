import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId, errorResponse, successResponse } from "@/lib/auth";
import { estimateTask, canAffordWork } from "@/lib/billing";
import type { WorkKind } from "@/lib/billing";
import type { HandoffPacket } from "@/lib/harness";

type Params = { params: Promise<{ id: string }> };

// POST /api/tasks/[id]/handoff — Teammate ↔ Work handoff with packet preservation
// Body: { target: "work"|"teammate", goal?: string, workKind?: WorkKind, executionMode?: "cloud"|"local", deliverables?: string[], verification_criteria?: string[] }
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);
    const { id } = await params;

    const sourceTask = await prisma.task.findFirst({ where: { id, userId } });
    if (!sourceTask) return errorResponse("Source task not found", 404);

    const body = await req.json() as {
      target?: "work" | "teammate";
      goal?: string;
      workKind?: WorkKind;
      executionMode?: "cloud" | "local";
      deliverables?: string[];
      verification_criteria?: string[];
      constraints?: { budget?: number; deadline?: string; must_not_leak?: string[] };
      handoffPacket?: Partial<HandoffPacket>;
    };

    const target = body.target || "work";
    const goal = body.goal || sourceTask.goal;
    if (!goal) return errorResponse("goal is required for handoff", 400);

    // Build HandoffPacket preserving context per PRD 7.2
    const traceId = sourceTask.traceId || `trace_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

    // Fetch recent chat history for context (last 10 messages across user's teammates)
    const teammates = await prisma.teammate.findMany({ where: { userId }, select: { id: true, isMain: true } });
    const teammateIds = teammates.map((t: any) => t.id);
    const recentMessages = teammateIds.length ? await prisma.chatMessage.findMany({
      where: { teammateId: { in: teammateIds } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }) : [];

    const memories = await prisma.memory.findMany({ where: { userId, scope: "personal" }, take: 5 });
    const memorySnippet = memories.map((m: any) => `${m.key}: ${m.value}`).join("\n").slice(0, 2000);

    const packet: HandoffPacket = {
      goal,
      context: {
        chat_history: recentMessages.reverse().map((m: any) => ({ role: m.role, content: m.content.slice(0, 500) })),
        memory_snippet: memorySnippet,
        user_prefs: {}, // could load from user settings
      },
      attachments: [], // files from source task if any
      deliverables: body.deliverables || ["Deliverable per goal"],
      constraints: body.constraints || {},
      verification_criteria: body.verification_criteria || ["Deliverable matches goal", "Files openable", "Verification report present"],
      execution_mode: body.executionMode || (sourceTask.executionMode as "cloud" | "local") || "cloud",
      trace_id: traceId,
    };

    // Merge any provided handoffPacket overrides
    if (body.handoffPacket) Object.assign(packet, body.handoffPacket);

    if (target === "work") {
      const kind = body.workKind || (sourceTask.workKind as WorkKind) || "coding";
      const est = estimateTask(kind);
      const quotaCheck = await canAffordWork(userId, est.cost);
      if (!quotaCheck.ok) {
        return errorResponse(quotaCheck.reason!, 402, { estimate: est, quota: quotaCheck.quota });
      }

      const newTask = await prisma.task.create({
        data: {
          userId,
          title: goal.slice(0, 120),
          goal,
          product: "work",
          workKind: kind,
          status: "queued",
          executionMode: packet.execution_mode,
          // Same trace id as the packet so usage events, deliverables and the
          // handoff card all chain under one trace (PRD 7.2 continuity).
          traceId,
          handoffPacket: JSON.stringify(packet),
          estimate: JSON.stringify({ ...est, approved: false }),
          progress: 0,
        },
      });

      // Mark source as handed off (optional: create handoff chat message)
      const mainTeammate = teammates.find((t: any) => t.isMain)?.id || teammates[0]?.id;
      if (mainTeammate) {
        await prisma.chatMessage.create({
          data: {
            teammateId: mainTeammate,
            role: "handoff",
            content: `Handoff → Work: "${goal}" (estimate ${est.cost} USD, ${est.minutes} min)`,
            meta: JSON.stringify({ traceId, sourceTaskId: id, newTaskId: newTask.id, packet }),
          },
        }).catch(() => {});
      }

      return successResponse({ task: newTask, estimate: est, packet, traceId }, 201);
    }

    // target === teammate (reverse delegation: Work → Teammate)
    await prisma.task.update({
      where: { id },
      data: { handoffPacket: JSON.stringify({ ...packet, reverse: true }) },
    });

    const mainTeammate = teammates.find((t: any) => t.isMain)?.id || teammates[0]?.id;
    if (mainTeammate) {
      await prisma.chatMessage.create({
        data: {
          teammateId: mainTeammate,
          role: "handoff",
          content: `Work completed: "${goal}" — files ready for review. ${packet.deliverables.join(", ")}`,
          meta: JSON.stringify({ traceId, taskId: id, packet, type: "reverse" }),
        },
      }).catch(() => {});
    }

    return successResponse({ packet, traceId, message: "Reverse handoff to Teammate recorded" });
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Handoff failed", 500);
  }
}

// GET /api/tasks/[id]/handoff — get handoff packet
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);
    const { id } = await params;

    const task = await prisma.task.findFirst({ where: { id, userId } });
    if (!task) return errorResponse("Task not found", 404);

    const packet = task.handoffPacket ? safeJson(task.handoffPacket) : null;
    return successResponse({ traceId: task.traceId, packet, taskId: id });
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to fetch handoff", 500);
  }
}

function safeJson(v: string) { try { return JSON.parse(v); } catch { return v; } }
