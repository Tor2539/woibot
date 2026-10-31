import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { CollabError, createGroup, deleteGroup, listGroups, shareMemory } from "@/lib/collab";

function fail(e: unknown) {
  const message = e instanceof Error ? e.message : "Team groups request failed";
  const status = e instanceof CollabError ? e.status : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

// GET /api/team/groups — group rooms owned by the caller, with members resolved
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const groups = await listGroups(userId);
    return NextResponse.json({
      ok: true,
      groups,
      count: groups.length,
      sharedMemories: groups.reduce((n, g) => n + g.memories.length, 0),
    });
  } catch (e: unknown) {
    return fail(e);
  }
}

// POST /api/team/groups — create a group room, or share a team memory into one
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
    if (body.action === "share_memory") {
      const memory = await shareMemory(userId, {
        groupId: String(body.groupId || ""),
        fromTeammateId: String(body.fromTeammateId || ""),
        key: String(body.key || ""),
        value: String(body.value || ""),
      });
      const groups = await listGroups(userId);
      const group = groups.find((g) => g.id === memory.groupId) || null;
      return NextResponse.json({ ok: true, memory, group });
    }

    const memberIds = Array.isArray(body.memberIds)
      ? body.memberIds.filter((v: unknown): v is string => typeof v === "string")
      : [];
    const group = await createGroup(userId, {
      name: String(body.name || ""),
      memberIds,
      tone: body.tone ? String(body.tone) : undefined,
    });
    return NextResponse.json({ ok: true, group });
  } catch (e: unknown) {
    return fail(e);
  }
}

// DELETE /api/team/groups?id= — remove a group room and its shared rules
export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });

  try {
    const result = await deleteGroup(userId, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    return fail(e);
  }
}
