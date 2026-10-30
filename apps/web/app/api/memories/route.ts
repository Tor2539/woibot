import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  const scope = req.nextUrl.searchParams.get("scope");
  const where: Record<string, any> = { userId };
  if (scope && scope !== "all") where.scope = scope;
  const memories = await prisma.memory.findMany({ where, orderBy: { updatedAt: "desc" } });
  const secrets = await prisma.vaultSecret.findMany({ where: { userId } });
  return NextResponse.json({ ok: true, memories, secrets });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  const body = await req.json();
  if (body.isVaultSecret) {
    const raw = String(body.value || "");
    const masked = raw.length > 6 ? `${raw.slice(0, 3)}••••••••${raw.slice(-2)}` : "••••••••";
    const sec = await prisma.vaultSecret.create({
      data: {
        userId,
        name: body.key || "CUSTOM_SECRET_KEY",
        hostAllowlist: body.hostAllowlist || "*.woibot.com",
        scope: "vault_autofill_only",
        maskedValue: masked,
      },
    });
    return NextResponse.json({ ok: true, secret: sec });
  }
  const created = await prisma.memory.create({
    data: {
      userId,
      key: body.key || "custom_preference",
      value: body.value || "",
      scope: body.scope || "personal",
      source: "explicit",
      canDelete: true,
    },
  });
  return NextResponse.json({ ok: true, memory: created });
}
