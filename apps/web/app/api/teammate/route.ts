import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId, safeJsonParse } from "@/lib/auth";
import { computerStatus, computerPublicOrigin } from "@/lib/computer";

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const [teammates, computer] = await Promise.all([
    prisma.teammate.findMany({ where: { userId } }),
    computerStatus(userId).catch(() => null),
  ]);
  const main = teammates.find((t: any) => t.isMain) || teammates[0];

  return NextResponse.json({
    ok: true,
    teammate: {
      id: main?.id || "tm_main",
      name: main?.name || "Woibot Main",
      role: main?.role || "Chief Personal Teammate",
      persona: safeJsonParse(main?.persona, { tone: "Direct, concise, decision-first" }),
      language: main?.language || "th",
      isMain: true,
      isCloudOnly: true,
      computer: {
        // Real values only — nothing here is hardcoded spec sheet.
        status: computer?.status || "unknown",
        name: computer?.name || null,
        port: computer?.port || null,
        cdpPort: computer?.cdpPort || null,
        configured: computer?.configured ?? false,
        vncUrl: computer?.vncPath ? `${computerPublicOrigin()}${computer.vncPath}` : null,
        detail: (computer as any)?.detail || null,
      },
    },
    teammates: teammates.map((t: any) => ({
      ...t,
      persona: safeJsonParse(t.persona, {}),
    })),
    capabilities: [
      "chat", "voice_ptt", "files", "memory_2tier", "connected_apps",
      "routines_spend_guard", "graduated_approvals", "vault_autofill", "handoff_to_work",
    ],
    product: "teammate",
  });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });

  const created = await prisma.teammate.create({
    data: {
      userId,
      name,
      role: body.role || "Operations Specialist",
      persona: JSON.stringify({
        tone: body.tone || "Concise & structured",
        statusText: "Idle · Ready",
        statusKind: "idle",
        skills: body.skills || ["custom-workflow"],
      }),
      language: body.language || "th",
      avatar: name.slice(0, 2).toUpperCase(),
      isMain: false,
    },
  });
  return NextResponse.json({ ok: true, teammate: created });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });

  const existing = await prisma.teammate.findFirst({ where: { id: body.id, userId } });
  if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const updated = await prisma.teammate.update({
    where: { id: body.id },
    data: {
      ...(body.name ? { name: String(body.name) } : {}),
      ...(body.role ? { role: String(body.role) } : {}),
      ...(body.language ? { language: String(body.language) } : {}),
    },
  });
  return NextResponse.json({ ok: true, teammate: updated });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });

  const existing = await prisma.teammate.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if ((existing as any).isMain) {
    return NextResponse.json({ ok: false, error: "Main teammate cannot be deleted" }, { status: 400 });
  }

  await prisma.teammate.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: id });
}
