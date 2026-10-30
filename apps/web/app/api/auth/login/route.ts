import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, ensureSchema } from "@/lib/db";
import { setSessionCookie } from "@/lib/session";
import { ensureStarterWorkspace } from "@/lib/starter";
import { audit } from "@/lib/pg";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "กรอกอีเมลและรหัสผ่าน" }, { status: 400 });
  }

  await ensureSchema();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) {
    return NextResponse.json({ ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    await audit({ tenantId: user.id, actor: email, action: "user.login_failed" });
    return NextResponse.json({ ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  await ensureStarterWorkspace(user.id, user.name);
  await audit({ tenantId: user.id, actor: email, action: "user.login" });
  await setSessionCookie(user.id, email);
  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
}
