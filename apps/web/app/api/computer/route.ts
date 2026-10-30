import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { ensureComputer, computerStatus, computerAction, execInComputer, computerLogs, computerPublicOrigin } from "@/lib/computer";
import { audit } from "@/lib/pg";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const action = req.nextUrl.searchParams.get("action");
  if (action === "ensure") {
    const out = await ensureComputer(userId);
    await audit({ tenantId: userId, actor: userId, action: "computer.ensure", meta: { status: out.status } });
    return NextResponse.json({ ok: out.status !== "error", computer: out, origin: computerPublicOrigin() });
  }

  if (action === "screen") {
    const shot = await execInComputer(
      userId,
      "export DISPLAY=:99; import -window root -resize 640x -quality 55 jpg:- 2>/dev/null | base64 -w0",
    );
    const b64 = String((shot as any)?.stdout || "").trim();
    if (!b64) {
      return NextResponse.json({ ok: false, error: "screen_unavailable" }, { status: 502 });
    }
    if (req.nextUrl.searchParams.get("raw") === "1") {
      return new NextResponse(Buffer.from(b64, "base64"), {
        headers: { "content-type": "image/jpeg", "cache-control": "no-store" },
      });
    }
    return NextResponse.json({
      ok: true,
      image: `data:image/jpeg;base64,${b64}`,
      ts: new Date().toISOString(),
    });
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
