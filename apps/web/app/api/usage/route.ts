import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId, errorResponse, successResponse } from "@/lib/auth";
import { getUsageSummary, PLANS, WORK_RATES } from "@/lib/billing";

// GET /api/usage — billing summary with ledger separation (PRD 12 / docs/billing.md)
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);

    const days = Math.min(90, Math.max(1, parseInt(req.nextUrl.searchParams.get("days") || "30", 10)));
    const limit = Math.min(200, parseInt(req.nextUrl.searchParams.get("limit") || "100", 10));

    const [summary, user] = await Promise.all([
      getUsageSummary(userId, { days, limit }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } }),
    ]);

    // Plan details
    const planId = summary.subscription?.plan || "starter";
    const planDetail = PLANS[planId as keyof typeof PLANS] || PLANS.starter;

    // Compute teammate allowance usage %
    const teammateTokensUsed = summary.totals.teammateTokens;
    const teammateAllowance = planDetail.tokens;
    const teammatePct = teammateAllowance ? Math.round((teammateTokensUsed / teammateAllowance) * 100) : 0;

    // Work quota pct
    const workPct = summary.quota ? Math.round((summary.quota.monthlyUsed / summary.quota.monthlyCap) * 100) : 0;

    return successResponse({
      user,
      period: summary.period,
      // Critical: cost isolation — two ledgers separate
      ledgers: summary.ledgers,
      totals: summary.totals,
      byKind: summary.byKind,
      // Teammate side (subscription)
      teammate: {
        plan: planId,
        planDetail,
        status: summary.subscription?.status || "active",
        periodStart: summary.subscription?.periodStart,
        periodEnd: summary.subscription?.periodEnd,
        allowance: teammateAllowance,
        usedTokens: teammateTokensUsed,
        usedPct: teammatePct,
        isOverAllowance: teammatePct >= 100,
      },
      // Work side (metered)
      work: {
        quota: summary.quota,
        usedPct: workPct,
        isNearCap: summary.quota?.isNearCap || false,
        rates: WORK_RATES,
      },
      // Raw events for UI table
      events: summary.events.map((e: any) => ({
        id: e.id,
        product: e.product,
        kind: e.kind,
        taskId: e.taskId,
        cost: e.cost,
        tokens: e.tokens,
        gpuSeconds: e.gpuSeconds,
        createdAt: e.createdAt,
      })),
      // Guardrails per docs/billing.md
      guardrails: {
        perTaskCap: summary.quota?.perTaskCap ?? 5,
        monthlyCap: summary.quota?.monthlyCap ?? 50,
        alertThreshold: summary.quota?.alertThreshold ?? 0.8,
      },
    });
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to fetch usage", 500);
  }
}

// POST /api/usage — manually record usage (for internal harness/billing)
// Body: { product, kind, taskId, cost, tokens, gpuSeconds, storageMb }
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);

    const body = await req.json() as {
      product?: "teammate" | "work";
      kind?: string;
      taskId?: string;
      cost?: number;
      tokens?: number;
      gpuSeconds?: number;
      storageMb?: number;
      meta?: Record<string, unknown>;
    };

    if (!body.product) return errorResponse("product is required (teammate|work)", 400);
    if (body.cost === undefined || body.cost < 0) return errorResponse("cost (USD) is required and must be >=0", 400);

    // Enforce cost isolation: Work cost goes to Work ledger only
    const event = await prisma.usageEvent.create({
      data: {
        userId,
        product: body.product,
        kind: body.kind,
        taskId: body.taskId,
        cost: body.cost,
        tokens: body.tokens ?? 0,
        gpuSeconds: body.gpuSeconds ?? 0,
        storageMb: body.storageMb ?? 0,
        meta: body.meta ? JSON.stringify(body.meta) : undefined,
      },
    });

    if (body.product === "work") {
      await prisma.workQuota.updateMany({
        where: { userId },
        data: { monthlyUsed: { increment: body.cost } },
      });
    }

    return successResponse(event, 201);
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to record usage", 500);
  }
}
