import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, ensureSchema, pgEnabled } from "@/lib/db";
import { setSessionCookie } from "@/lib/session";
import { ensureStarterWorkspace } from "@/lib/starter";
import { audit } from "@/lib/pg";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const name = String(body?.name || "").trim() || email.split("@")[0];

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
  }

  if (pgEnabled()) {
    await ensureSchema();
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ ok: false, error: "อีเมลนี้มีบัญชีอยู่แล้ว" }, { status: 409 });
  }

  const userId = `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({ data: { id: userId, email, name, passwordHash } });
  await ensureStarterWorkspace(userId, name);
  await audit({ tenantId: userId, actor: email, action: "user.signup" });

  await setSessionCookie(userId, email);
  return NextResponse.json({ ok: true, user: { id: userId, email, name } });
}
