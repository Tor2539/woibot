import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId, errorResponse, successResponse } from "@/lib/auth";

// GET /api/routines — list routines for user
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);

    const status = req.nextUrl.searchParams.get("status");
    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;

    const routines = await prisma.routine.findMany({
      where: where as never,
      orderBy: { nextRun: "asc" },
    });

    const parsed = routines.map((r: any) => ({
      ...r,
      trigger: safeJson(r.trigger),
      action: safeJson(r.action),
      lastResult: r.lastResult ? safeJson(r.lastResult) : null,
    }));

    return successResponse({ routines: parsed, total: parsed.length });
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to list routines", 500);
  }
}

// POST /api/routines — create routine (promote task to routine per PRD 4.6)
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);

    const body = await req.json() as {
      title?: string;
      description?: string;
      trigger?: { type: "cron" | "event" | "manual"; expr: string; event?: string };
      action?: Record<string, unknown>;
      teammateId?: string;
      taskId?: string; // optional: create from existing task
    };

    if (!body.title?.trim()) return errorResponse("title is required", 400);
    if (!body.trigger?.expr && body.trigger?.type !== "manual") return errorResponse("trigger.expr is required (cron: 0 8 * * * or event name)", 400);

    // Enforce plan limits: Starter 20, Pro 100
    const count = await prisma.routine.count({ where: { userId, status: "active" } });
    const sub = await prisma.subscription.findFirst({ where: { userId }, orderBy: { periodStart: "desc" } });
    const limit = sub?.plan === "pro" ? 100 : sub?.plan === "starter" ? 20 : 3;
    if (count >= limit) return errorResponse(`Routine limit reached (${limit}) for plan ${sub?.plan || "free"}`, 403);

    // Compute nextRun from the 5-field cron expression (same matcher as /api/cron/run)
    let nextRun: Date | null = null;
    if (body.trigger?.type === "cron") {
      try {
        nextRun = computeNextCron(body.trigger.expr);
      } catch (e: unknown) {
        return errorResponse(e instanceof Error ? e.message : "รูปแบบ cron ไม่ถูกต้อง", 400);
      }
    } else if (body.trigger?.type === "event") {
      nextRun = null; // event-triggered, no schedule
    }

    const routine = await prisma.routine.create({
      data: {
        userId,
        teammateId: body.teammateId,
        title: body.title,
        description: body.description,
        trigger: JSON.stringify(body.trigger || { type: "cron", expr: "0 8 * * *" }),
        action: JSON.stringify(body.action || { template: body.title, sourceTaskId: body.taskId }),
        status: "active",
        nextRun,
        runCount: 0,
        failCount: 0,
      },
    });

    return successResponse(routine, 201);
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to create routine", 500);
  }
}

function safeJson(v: string) { try { return JSON.parse(v); } catch { return v; } }

function computeNextCron(expr: string): Date | null {
  try {
    const fields = parseCron(expr);
    const next = nextCronOccurrence(fields, Date.now());
    if (next === null) {
      throw new Error("ไม่พบเวลารันครั้งถัดไปสำหรับตารางเวลานี้ (ตารางเวลาไม่มีวันที่ตรงเงื่อนไข)");
    }
    return new Date(next);
  } catch (e: unknown) {
    throw new Error(
      `รูปแบบ cron ไม่ถูกต้อง: ${expr ?? ""} (${e instanceof Error ? e.message : "parse failed"})`
    );
  }
}

// ---- 5-field cron: minute hour day-of-month month day-of-week (UTC) ----
// Supports: * , - / and numeric lists. Day-of-week: 0=Sunday..6=Saturday (7 → 0).
// Matches the matcher the cron runner uses in app/api/cron/run/route.ts.

type CronField = { values: Set<number>; wildcard: boolean; min: number; max: number };

const CRON_BOUNDS: [number, number][] = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day-of-month
  [1, 12], // month
  [0, 6], // day-of-week (7 normalized to 0)
];

const FIELD_NAMES_TH = ["นาที", "ชั่วโมง", "วันที่ของเดือน", "เดือน", "วันของสัปดาห์"];

function parseCronField(part: string, index: number): CronField {
  const [min, max] = CRON_BOUNDS[index];
  const values = new Set<number>();
  let wildcard = false;
  for (const piece of part.split(",")) {
    const stepMatch = piece.match(/^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/);
    if (!stepMatch) throw new Error(`${FIELD_NAMES_TH[index]}: รูปแบบไม่ถูกต้อง "${piece}"`);
    const [, rangeStr, stepStr] = stepMatch;
    const step = stepStr ? parseInt(stepStr, 10) : 1;
    if (!Number.isInteger(step) || step < 1) throw new Error(`${FIELD_NAMES_TH[index]}: step ไม่ถูกต้อง "${piece}"`);
    let start: number;
    let end: number;
    if (rangeStr === "*") {
      if (stepStr === undefined) wildcard = true;
      start = min;
      end = max;
    } else if (rangeStr.includes("-")) {
      const [a, b] = rangeStr.split("-").map((n) => parseInt(n, 10));
      start = a;
      end = b;
    } else {
      start = parseInt(rangeStr, 10);
      end = stepStr !== undefined ? max : start; // "5/15" = start 5, step 15 to max
    }
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      throw new Error(`${FIELD_NAMES_TH[index]}: ค่าไม่ใช่ตัวเลข "${piece}"`);
    }
    if (index === 4) {
      // day-of-week: 7 = Sunday = 0
      start = start === 7 ? 0 : start;
      end = end === 7 ? 0 : end;
    }
    if (start < min || end > max || start > end) {
      throw new Error(`${FIELD_NAMES_TH[index]}: ค่านอกช่วง ${min}-${max} "${piece}"`);
    }
    for (let v = start; v <= end; v += step) values.add(v);
  }
  if (values.size === 0) throw new Error(`${FIELD_NAMES_TH[index]}: ไม่มีค่าที่ถูกต้อง`);
  return { values, wildcard, min, max };
}

function parseCron(expr: string): CronField[] {
  const parts = (expr ?? "").trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`ต้องเป็น cron 5 ช่อง (นาที ชั่วโมง วันที่ เดือน วันสัปดาห์) แต่ได้ ${parts.length} ช่อง`);
  }
  return parts.map((p, i) => parseCronField(p, i));
}

// Search forward minute-by-minute from `from` for the next matching time (UTC).
// Bounded search: jumps by day when no hour/minute match remains in the day.
function nextCronOccurrence(fields: CronField[], from: number): number | null {
  const [minuteF, hourF, domF, monF, dowF] = fields;
  const date = new Date(from);
  date.setUTCSeconds(0, 0);
  date.setUTCMinutes(date.getUTCMinutes() + 1); // strictly after `from`

  for (let day = 0; day < 5 * 366; day++) {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1; // 1-12
    const dom = date.getUTCDate();
    const dow = date.getUTCDay();
    const domOk = domF.values.has(dom);
    const dowOk = dowF.values.has(dow);
    // Standard cron: if both day fields are restricted, either may match
    const dayOk =
      domF.wildcard && dowF.wildcard
        ? true
        : domF.wildcard
          ? dowOk
          : dowF.wildcard
            ? domOk
            : domOk || dowOk;
    if (monF.values.has(m) && dayOk) {
      // find next matching hour:minute in this day
      for (let h = date.getUTCHours(); h <= 23; h++) {
        if (!hourF.values.has(h)) continue;
        const startMin = h === date.getUTCHours() ? date.getUTCMinutes() : 0;
        for (let mi = startMin; mi <= 59; mi++) {
          if (minuteF.values.has(mi)) {
            const out = new Date(Date.UTC(y, m - 1, dom, h, mi));
            if (out.getTime() > from) return out.getTime();
          }
        }
      }
    }
    // advance to next day 00:00
    date.setUTCDate(date.getUTCDate() + 1);
    date.setUTCHours(0, 0, 0, 0);
  }
  return null;
}
