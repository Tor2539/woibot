import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId, safeJsonParse } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.connectedApp.findMany({ where: { userId } });
  const secrets = await prisma.vaultSecret.findMany({ where: { userId } });
  const apps = rows.map((r: any) => ({
    ...r,
    scopes: safeJsonParse(r.scopes, ["read"]),
  }));
  return NextResponse.json({ ok: true, apps, secrets });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { id, provider, action, scopes, account } = body;

  if (id) {
    const existing = await prisma.connectedApp.findFirst({ where: { id } });
    if (existing) {
      const nextStatus =
        action === "disconnect" || action === "revoke"
          ? "not_connected"
          : action === "connect" || action === "reconnect"
          ? "connected"
          : existing.status === "connected"
          ? "not_connected"
          : "connected";
      const updated = await prisma.connectedApp.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(scopes ? { scopes: JSON.stringify(scopes) } : {}),
          ...(account ? { account } : {}),
        },
      });
      return NextResponse.json({ ok: true, app: { ...updated, scopes: safeJsonParse(updated.scopes, []) } });
    }
  }

  if (provider) {
    const existing = await prisma.connectedApp.findFirst({ where: { userId, provider } });
    if (existing) {
      const nextStatus = existing.status === "connected" ? "not_connected" : "connected";
      const updated = await prisma.connectedApp.update({
        where: { id: existing.id },
        data: { status: nextStatus },
      });
      return NextResponse.json({ ok: true, app: { ...updated, scopes: safeJsonParse(updated.scopes, []) } });
    }
    const created = await prisma.connectedApp.create({
      data: {
        userId,
        provider,
        status: "connected",
        scopes: JSON.stringify(scopes || ["read", "write"]),
        account: account || "takin@woxacorp.com",
      },
    });
    return NextResponse.json({ ok: true, app: { ...created, scopes: safeJsonParse(created.scopes, []) } });
  }

  return NextResponse.json({ ok: false, error: "id or provider required" }, { status: 400 });
}
