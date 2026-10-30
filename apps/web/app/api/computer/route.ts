import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { ensureComputer, computerStatus, computerAction, execInComputer, computerLogs, computerPublicOrigin } from "@/lib/computer";
import { audit } from "@/lib/pg";

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const action = req.nextUrl.searchParams.get("action");
  if (action === "ensure") {
    const out = await ensureComputer(userId);
    await audit({ tenantId: userId, actor: userId, action: "computer.ensure", meta: { status: out.status } });
    return NextResponse.json({ ok: out.status !== "error", computer: out, origin: computerPublicOrigin() });
  }

  const out = await computerStatus(userId);
  return NextResponse.json({ ok: true, computer: out, origin: computerPublicOrigin() });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "pause" || action === "resume" || action === "destroy") {
    const out = await computerAction(userId, action);
    await audit({ tenantId: userId, actor: userId, action: `computer.${action}` });
    return NextResponse.json({ ok: Boolean(out.ok), detail: out });
  }

  if (action === "logs") {
    const out = await computerLogs(userId);
    return NextResponse.json({ ok: Boolean(out.ok), result: out });
  }

  if (action === "exec") {
    const out = await execInComputer(userId, String(body.cmd || ""));
    await audit({ tenantId: userId, actor: userId, action: "computer.exec", meta: { cmd: String(body.cmd || "").slice(0, 200) } });
    return NextResponse.json({ ok: Boolean(out.ok), result: out });
  }

  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}
