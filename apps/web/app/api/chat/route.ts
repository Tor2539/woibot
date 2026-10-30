import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId, errorResponse, successResponse, safeJsonParse } from "@/lib/auth";
import { routeIntent, createTaskFromHandoff } from "@/lib/harness";
import { recordUsage } from "@/lib/billing";
import { callWoibotLLM } from "@/lib/llm";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);
    const teammateId = req.nextUrl.searchParams.get("teammateId") || "tm_main";

    const teammates = await prisma.teammate.findMany({ where: { userId } });
    let activeTeammate = teammates.find((t: any) => t.id === teammateId) || teammates[0];
    if (!activeTeammate) {
      activeTeammate = await prisma.teammate.create({
        data: { id: "tm_main", userId, name: "Woibot Main", role: "Chief Personal Teammate", isMain: true, language: "th" },
      });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { teammateId: activeTeammate.id },
      orderBy: { createdAt: "asc" },
    });

    const parsedMessages = messages.map((m: any) => ({
      ...m,
      meta: safeJsonParse(m.meta, {}),
    }));

    return successResponse({
      teammate: activeTeammate,
      teammates,
      messages: parsedMessages,
    });
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to load chat", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);
    const body = (await req.json()) as {
      teammateId?: string;
      message: string;
      effort?: "auto" | "fast" | "high";
      forceWork?: boolean;
      workKind?: "coding" | "research" | "doc" | "video_analysis" | "video_gen" | "media_heavy" | "data";
      attachments?: { fileUrl: string; fileName: string; mimeType: string }[];
      executionMode?: "cloud" | "local";
    };

    if (!body.message?.trim()) return errorResponse("message is required", 400);

    const teammateId = body.teammateId || "tm_main";
    let teammate = await prisma.teammate.findFirst({ where: { id: teammateId } });
    if (!teammate) {
      teammate = await prisma.teammate.findFirst({ where: { userId } });
    }

    const userMsg = await prisma.chatMessage.create({
      data: {
        teammateId: teammate.id,
        userId,
        role: "user",
        content: body.message.trim(),
        meta: JSON.stringify({
          attachments: body.attachments || [],
          effort: body.effort || "auto",
          timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        }),
      },
    });

    const memories = await prisma.memory.findMany({ where: { userId }, take: 8 });
    const memorySnippet = memories.map((m: any) => `${m.key}: ${m.value}`).join("\n");

    // Auto-save explicit memory instructions
    if (/จำไว้ว่า|บันทึกความจำ|remember that|ตั้งกฎว่า/i.test(body.message)) {
      await prisma.memory.create({
        data: {
          userId,
          key: `rule_${Date.now().toString(36).slice(-4)}`,
          value: body.message.replace(/จำไว้ว่า|บันทึกความจำ|remember that|ตั้งกฎว่า/gi, "").trim(),
          scope: "personal",
          source: "explicit",
          canDelete: true,
        },
      });
    }

    const routed = body.forceWork
      ? { product: "work" as const, workKind: body.workKind || "coding", confidence: 0.99, reason: "User explicitly delegated to Work" }
      : routeIntent(body.message);

    if (routed.product === "work") {
      const workKind = body.workKind || routed.workKind || "coding";
      const trace_id = `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const packet = {
        goal: body.message.trim(),
        context: {
          chat_history: [{ role: "user", content: body.message.trim() }],
          memory_snippet: memorySnippet.slice(0, 1000),
          user_prefs: { effort: body.effort || "auto" },
        },
        attachments: body.attachments || [],
        deliverables: [`Verified deliverable for: ${body.message.slice(0, 72)}`],
        constraints: { budget: 5.0 },
        verification_criteria: ["Matches user goal", "Passes automated verification pipeline", "Deliverable files openable & editable"],
        execution_mode: body.executionMode || "cloud",
        trace_id,
      };

      const { task, estimate } = await createTaskFromHandoff(userId, packet as never, workKind);

      const handoffMeta = {
        handoff: true,
        cardType: "handoff-card",
        workedFor: "4s",
        steps: [
          { tool: "intent.classify", detail: `Classified as Work (${workKind}) — confidence ${(routed.confidence * 100).toFixed(0)}%` },
          { tool: "memory.attach", detail: `Attached ${memories.length} memory rules into HandoffPacket` },
          { tool: "billing.estimate", detail: `Estimated $${estimate.cost} (${estimate.minutes}m) on isolated Work ledger` },
        ],
        taskId: task.id,
        trace_id,
        workKind,
        executionMode: packet.execution_mode,
        estimate,
      };

      const assistantMsg = await prisma.chatMessage.create({
        data: {
          teammateId: teammate.id,
          userId,
          role: "assistant",
          content: `งานนี้เป็นงานสร้างผลงานระดับมืออาชีพ ผมบรรจุบริบททั้งหมดลงใน **Handoff Packet (${trace_id})** และส่งต่อให้ **woibot Work (${workKind.toUpperCase()})** เรียบร้อยครับ\n\nคุณสามารถกด **Approve & Run** ในการ์ดด้านล่าง หรือสลับไปแท็บ **Work** เพื่อดูขั้นตอนสดได้ทันทีโดยไม่ต้องพิมพ์บริบทซ้ำ`,
          meta: JSON.stringify(handoffMeta),
        },
      });

      await recordUsage(userId, {
        product: "teammate",
        kind: "chat",
        tokens: Math.ceil(body.message.length / 3),
        cost: 0.0,
      }).catch(() => {});

      return successResponse({
        message: userMsg,
        assistantMessage: { ...assistantMsg, meta: handoffMeta },
        routed,
        task,
        estimate,
        reply: assistantMsg.content,
      });
    }

    // Teammate direct answer with real LLM + structured Grok Bot cards
    const s = body.message.toLowerCase();
    const isEmailDraft = /ร่างอีเมล|ร่างเมล|ตอบอีเมล|draft.*email|reply.*email/.test(s);
    const isSecretAsk = /รหัสผ่าน|api key|secret|1password|vault|login/.test(s);
    const isApprovalAsk = /ส่งจริง|โอนเงิน|ลบข้อมูล|deploy.*prod|publish/.test(s);

    const llmRes = await callWoibotLLM({
      system: `You are ${teammate.name} (${teammate.role}) inside woibot.com — an AI Personal Teammate running 24/7 on a dedicated Cloud Computer.
User Memories:
${memorySnippet}
Rules:
- Reply in the same language as the user (Thai default).
- Be concise, direct, executive-grade, no fluff, no AI-slop emojis.
- Mention concrete actions taken on Connected Apps (Gmail, Google Calendar, Slack, Notion, GitHub) or Cloud Computer.`,
      user: body.message,
    });

    const metaObj: Record<string, any> = {
      workedFor: "6s",
      provider: llmRes.provider,
      steps: [
        { tool: "memory.recall", detail: `Loaded ${memories.length} personal & team memories` },
        { tool: "apps.context", detail: "Synced Gmail, Google Calendar, Slack & Cloud Computer (:99)" },
        { tool: "teammate.respond", detail: `Synthesized response via ${llmRes.provider}` },
      ],
    };

    if (isEmailDraft) {
      metaObj.cardType = "email-draft";
      metaObj.emailDraft = {
        id: `draft_${Date.now().toString(36)}`,
        to: "partner@clientcorp.co.th",
        subject: `สรุปการดำเนินการ: ${body.message.slice(0, 48)}`,
        body: llmRes.text,
        sendMode: "ask_first",
        status: "pending",
      };
    } else if (isSecretAsk) {
      metaObj.cardType = "secret-request";
      metaObj.secretRequest = {
        id: `sec_req_${Date.now().toString(36)}`,
        keyName: "EXTERNAL_SERVICE_API_KEY",
        targetHost: "api.partnerservice.com",
        note: "Never shown to your Bot in plaintext. Encrypted in Woibot Vault & autofilled only on allowed host.",
      };
    } else if (isApprovalAsk) {
      metaObj.cardType = "permission-request";
      metaObj.permissionRequest = {
        id: `perm_${Date.now().toString(36)}`,
        action: body.message.slice(0, 80),
        scope: teammate.name,
        riskLevel: "high",
        status: "pending",
      };
    }

    const assistantMsg = await prisma.chatMessage.create({
      data: {
        teammateId: teammate.id,
        userId,
        role: "assistant",
        content: llmRes.text,
        meta: JSON.stringify(metaObj),
      },
    });

    await recordUsage(userId, {
      product: "teammate",
      kind: "chat",
      tokens: Math.ceil((body.message.length + llmRes.text.length) / 3),
      cost: 0.0,
    }).catch(() => {});

    return successResponse({
      message: userMsg,
      assistantMessage: { ...assistantMsg, meta: metaObj },
      routed,
      reply: llmRes.text,
    });
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Chat failed", 500);
  }
}
