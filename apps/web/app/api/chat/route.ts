import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId, errorResponse, successResponse } from "@/lib/auth";
import { routeIntent, createTaskFromHandoff } from "@/lib/harness";
import { recordUsage } from "@/lib/billing";

// POST /api/chat — Teammate chat (with intent router → auto handoff to Work)
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);

    const body = await req.json() as {
      teammateId?: string;
      message: string;
      attachments?: { fileUrl: string; fileName: string; mimeType: string }[];
      executionMode?: "cloud" | "local";
    };

    if (!body.message?.trim()) return errorResponse("message is required", 400);

    // Find or create teammate
    let teammateId = body.teammateId;
    if (!teammateId) {
      let teammate = await prisma.teammate.findFirst({ where: { userId, isMain: true } });
      if (!teammate) {
        teammate = await prisma.teammate.create({
          data: { userId, name: "Woibot", role: "Personal Assistant", persona: JSON.stringify({ tone: "friendly" }), isMain: true, language: "th" },
        });
      }
      teammateId = teammate.id;
    } else {
      const exists = await prisma.teammate.findFirst({ where: { id: teammateId, userId } });
      if (!exists) return errorResponse("Teammate not found", 404);
    }

    // Save user message
    const userMsg = await prisma.chatMessage.create({
      data: {
        teammateId: teammateId!,
        userId,
        role: "user",
        content: body.message,
        meta: body.attachments ? JSON.stringify({ attachments: body.attachments }) : undefined,
      },
    });

    // Check memory for context (last 5 memories)
    const memories = await prisma.memory.findMany({ where: { userId }, take: 5 });
    const memorySnippet = memories.map((m: any) => `${m.key}: ${m.value}`).join("\n");

    // Intent router
    const routed = routeIntent(body.message);

    // If Work: create handoff Task + return estimate (cost isolation gate)
    if (routed.product === "work") {
      const workKind = routed.workKind || "coding";
      const packet = {
        goal: body.message,
        context: {
          chat_history: [{ role: "user", content: body.message }],
          memory_snippet: memorySnippet.slice(0, 1000),
          user_prefs: {},
        },
        attachments: body.attachments || [],
        deliverables: [`Result for: ${body.message.slice(0, 80)}`],
        constraints: {},
        verification_criteria: ["Deliverable matches goal", "Files openable"],
        execution_mode: body.executionMode || "cloud",
        trace_id: `trace_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      };

      const { task, estimate } = await createTaskFromHandoff(userId, packet as never, workKind);

      // Log handoff message
      await prisma.chatMessage.create({
        data: {
          teammateId: teammateId!,
          userId,
          role: "assistant",
          content: `รับทราบครับ — ส่งงานให้ Work (${workKind}) แล้ว\n\n**ประเมิน:** ${estimate.minutes} นาที ≈ $${estimate.cost} | ${estimate.label}\n\n[ดูความคืบหน้า → Tasks](${task.id}) — กดยืนยันเพื่อให้ Work เริ่มทำงาน`,
          meta: JSON.stringify({ handoff: true, taskId: task.id, estimate, trace_id: packet.trace_id }),
        },
      });

      // Teammate cost: small chat token
      await recordUsage(userId, { product: "teammate", kind: "chat", tokens: Math.ceil(body.message.length / 4), cost: 0.005 }).catch(() => {});

      return successResponse({
        message: userMsg,
        routed,
        task,
        estimate,
        reply: `ส่งให้ Work (${workKind}) — ประเมิน ${estimate.minutes} นาที ~$${estimate.cost}. กรุณายืนยันเพื่อเริ่ม.`,
      });
    }

    // Teammate direct answer (stub LLM — in prod call OpenAI/Anthropic)
    const replyText = generateTeammateReply(body.message, memorySnippet);

    const assistantMsg = await prisma.chatMessage.create({
      data: {
        teammateId: teammateId!,
        userId,
        role: "assistant",
        content: replyText,
        meta: JSON.stringify({ routed, tokens: Math.ceil(replyText.length / 4) }),
      },
    });

    // Record teammate usage (isolated ledger)
    await recordUsage(userId, {
      product: "teammate",
      kind: "chat",
      tokens: Math.ceil((body.message.length + replyText.length) / 4),
      cost: 0.008,
      meta: { teammateId },
    }).catch(() => {});

    // Simple memory write: if user tells us their name/preference, save
    if (/ชื่อ.*คือ|ฉันชื่อ|เรียกฉันว่า|my name is/i.test(body.message)) {
      await prisma.memory.upsert({
        where: { userId_key_scope: { userId, key: "user_intro", scope: "personal" } },
        update: { value: body.message.slice(0, 500), updatedAt: new Date() },
        create: { userId, key: "user_intro", value: body.message.slice(0, 500), scope: "personal", source: "inferred" },
      }).catch(() => {});
    }

    return successResponse({ message: userMsg, reply: assistantMsg, routed });
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Chat failed", 500);
  }
}

// GET /api/chat — list messages for teammate
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);
    const teammateId = req.nextUrl.searchParams.get("teammateId");
    const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get("limit") || "50", 10));

    if (!teammateId) return errorResponse("teammateId is required", 400);

    const teammate = await prisma.teammate.findFirst({ where: { id: teammateId, userId } });
    if (!teammate) return errorResponse("Teammate not found", 404);

    const messages = await prisma.chatMessage.findMany({
      where: { teammateId },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return successResponse({ teammate, messages });
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to fetch chat", 500);
  }
}

function generateTeammateReply(input: string, _memory: string): string {
  const s = input.toLowerCase();
  if (/สวัสดี|hello|hi\b/.test(s)) return `สวัสดีครับ! ผม Woibot — ผู้ช่วยส่วนตัวของคุณ มีอะไรให้ช่วยวันนี้ครับ?`;
  if (/อีเมล|email|สรุป.*เมล/.test(s)) return `ผมสรุปอีเมลสำคัญให้ได้ครับ เชื่อม Gmail ใน Apps แล้วผมจะสรุปทุกเช้า 08:00 ให้อัตโนมัติ (Routine) — ต้องการตั้งเลยไหมครับ?`;
  if (/ปฏิทิน|calendar|นัด|ประชุม/.test(s)) return `ดูปฏิทินให้ได้ครับ เชื่อม Google Calendar แล้วบอกผมว่า "แสดงนัดวันนี้" หรือให้ผมเตรียมข้อมูลก่อนประชุมได้เลย.`;
  if (/ช่วย.*ทำ|สร้าง.*/.test(s)) return `รับทราบครับ — ถ้าเป็นงานสร้างผลงาน (เว็บ/เอกสาร/วิดีโอ/วิจัย) ผมจะส่งให้ Work ประเมินก่อนเริ่ม งานเบาๆ ผมทำได้เลย บอกได้เลยครับว่าต้องการอะไร`;
  return `เข้าใจครับ: "${input.slice(0, 120)}"\n\nผมช่วยได้ — บอกเพิ่มได้เลย ถ้าเป็นงานหนัก (สร้างเว็บ/เอกสาร/วิดีโอ) ผมจะประเมินเวลาและค่าใช้จ่ายให้ก่อนเริ่มครับ.`;
}
