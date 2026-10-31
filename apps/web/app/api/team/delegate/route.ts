import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { CollabError, delegateBetweenBots } from "@/lib/collab";

// POST /api/team/delegate — one teammate hands a task to another.
// Body: { fromId, toId, message, groupId? } -> { ok, reply, from, to, ... }
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await delegateBetweenBots(userId, {
      fromId: String(body.fromId || ""),
      toId: String(body.toId || ""),
      message: String(body.message || ""),
      groupId: body.groupId ? String(body.groupId) : undefined,
    });

    return NextResponse.json({
      ok: true,
      reply: result.reply,
      provider: result.provider,
      from: result.from,
      to: result.to,
      messageId: result.messageId,
      replyMessageId: result.replyMessageId,
      memoriesUsed: result.memoriesUsed,
      createdAt: result.createdAt,
    });
  } catch (e: unknown) {
    const status = e instanceof CollabError ? e.status : 500;
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Delegation failed" },
      { status },
    );
  }
}
