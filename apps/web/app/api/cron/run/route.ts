import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/pg";

/**
 * Routine runner. Invoked by Cloud Scheduler every 5 minutes.
 * Claims due routines (nextRun <= now, status=active) with a conditional update
 * so two workers can never run the same routine twice.
 */
function cronMatches(expr: string, date: Date) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [min, hour, dom, month, dow] = parts;
  const ok = (spec: string, value: number, max: number) => {
    if (spec === "*") return true;
    for (const piece of spec.split(",")) {
      const [range, stepRaw] = piece.split("/");
      const step = stepRaw ? Number(stepRaw) : 1;
      let from = 0, to = max;
      if (range !== "*") {
        const [a, b] = range.split("-");
        from = Number(a);
        to = b !== undefined ? Number(b) : from;
      }
      for (let v = from; v <= to; v += step) if (v === value) return true;
    }
    return false;
  };
  return (
    ok(min, date.getUTCMinutes(), 59) &&
    ok(hour, date.getUTCHours(), 23) &&
    ok(dom, date.getUTCDate(), 31) &&
    ok(month, date.getUTCMonth() + 1, 12) &&
    ok(dow, date.getUTCDay(), 6)
  );
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  if (secret && provided !== secret) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const now = new Date();
  const due = await prisma.routine.findMany({ where: { status: "active" }, take: 200 });
  const results: Array<{ id: string; title: string; ran: boolean }> = [];

  for (const routine of due) {
    const trigger = typeof routine.trigger === "string" ? JSON.parse(routine.trigger || "{}") : routine.trigger || {};
    const isDue = routine.nextRun ? new Date(routine.nextRun) <= now : cronMatches(String(trigger.expr || ""), now);
    if (!isDue) { results.push({ id: routine.id, title: routine.title, ran: false }); continue; }

    // atomic claim: only one worker can flip nextRun
    const claimed = await prisma.routine.updateMany({
      where: { id: routine.id, nextRun: routine.nextRun },
      data: { lastRun: now.toISOString(), nextRun: new Date(now.getTime() + 5 * 60_000).toISOString() },
    });
    if (claimed.count === 0) { results.push({ id: routine.id, title: routine.title, ran: false }); continue; }

    const action = typeof routine.action === "string" ? JSON.parse(routine.action || "{}") : routine.action || {};
    await prisma.usageEvent.create({
      data: {
        userId: routine.userId,
        product: "teammate",
        kind: "routine",
        taskId: routine.id,
        tokens: 0,
        cost: 0,
        meta: JSON.stringify({ title: routine.title, template: action.template || "" }),
      },
    });
    await prisma.routine.update({
      where: { id: routine.id },
      data: { runCount: Number(routine.runCount || 0) + 1 },
    });
    await audit({ tenantId: routine.userId, actor: "scheduler", action: "routine.run", target: routine.id });
    results.push({ id: routine.id, title: routine.title, ran: true });
  }

  return NextResponse.json({ ok: true, checked: due.length, ran: results.filter((r) => r.ran).length, results });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
