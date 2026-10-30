import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./db";

// Centralized error response
export function errorResponse(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export function successResponse(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json({ ok: true, data }, { status, headers });
}

// Auth helper: expects x-user-id header or cookies, fallback to dev user
// In production: replace with NextAuth getServerSession
export async function getUserId(req: NextRequest): Promise<string | null> {
  // 1) header (for API testing)
  const headerId = req.headers.get("x-user-id");
  if (headerId) return headerId;

  // 2) query param ?userId=
  const urlId = req.nextUrl.searchParams.get("userId");
  if (urlId) return urlId;

  // 3) fallback dev user: ensure exists
  const devEmail = process.env.DEV_USER_EMAIL || "dev@woibot.com";
  try {
    let user = await prisma.user.findUnique({ where: { email: devEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: devEmail,
          name: "Dev User",
          // ensure quota
        },
      });
      // also create default quota & subscription
      await prisma.workQuota.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, monthlyCap: 50, perTaskCap: 5 },
      });
      await prisma.subscription.create({
        data: {
          userId: user.id,
          plan: "starter",
          status: "active",
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          allowance: JSON.stringify({ tokens: 2_000_000, cloudHours: 100, routines: 20 }),
        },
      });
    }
    return user.id;
  } catch {
    return null;
  }
}

export async function requireUser(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) throw new Error("Unauthorized: missing user");
  return userId;
}

// Validate JSON body safely
export async function parseJson<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

// 10 allowed statuses
export const TASK_STATUSES = [
  "queued",
  "planning",
  "in_progress",
  "waiting_for_user",
  "paused",
  "reviewing",
  "completed",
  "partially_completed",
  "failed",
  "cancelled",
] as const;

export type TaskStatus = typeof TASK_STATUSES[number];

// Allowed status transitions (simplified)
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  queued: ["planning", "cancelled"],
  planning: ["in_progress", "waiting_for_user", "failed", "cancelled"],
  in_progress: ["waiting_for_user", "paused", "reviewing", "failed", "completed", "partially_completed"],
  waiting_for_user: ["in_progress", "paused", "cancelled"],
  paused: ["in_progress", "queued", "cancelled"],
  reviewing: ["completed", "partially_completed", "failed", "in_progress"],
  completed: [],
  partially_completed: [],
  failed: ["queued"],
  cancelled: ["queued"],
};

export function canTransition(from: string, to: string) {
  if (from === to) return true;
  const allowed = STATUS_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

// Helpers to safely parse JSON columns (Stored as String JSON)
export function safeJsonParse<T>(v: string | null | undefined, fallback: T): T {
  if (!v) return fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
}
