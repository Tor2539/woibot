import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, ensureSchema } from "./db";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export function errorResponse(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export function successResponse(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json({ ok: true, data }, { status, headers });
}

async function tokenFrom(req?: NextRequest): Promise<string | undefined> {
  if (req) {
    const fromReq = req.cookies?.get(SESSION_COOKIE)?.value;
    if (fromReq) return fromReq;
  }
  try {
    const store = await cookies();
    return store.get(SESSION_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

/**
 * Resolve the caller's user id.
 *
 * Production: a valid signed session cookie is the ONLY source of identity.
 * Local development may opt into the seeded demo account with ALLOW_DEV_USER=1.
 */
export async function getUserId(req?: NextRequest): Promise<string | null> {
  const token = await tokenFrom(req);
  const session = await verifySessionToken(token);
  if (session?.userId) return session.userId;

  if (process.env.ALLOW_DEV_USER === "1" && process.env.NODE_ENV !== "production") {
    const devEmail = process.env.DEV_USER_EMAIL || "dev@woibot.com";
    try {
      await ensureSchema();
      let user = await prisma.user.findUnique({ where: { email: devEmail } });
      if (!user) {
        user = await prisma.user.create({ data: { id: "usr_woibot_default", email: devEmail, name: "Dev Workspace" } });
      }
      return user.id;
    } catch {
      return null;
    }
  }
  return null;
}

export async function requireUser(req: NextRequest): Promise<string> {
  const userId = await getUserId(req);
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function parseJson<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

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

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  queued: ["planning", "in_progress", "waiting_for_user", "completed", "cancelled"],
  planning: ["in_progress", "waiting_for_user", "reviewing", "completed", "failed", "cancelled"],
  in_progress: ["waiting_for_user", "paused", "reviewing", "failed", "completed", "partially_completed"],
  waiting_for_user: ["in_progress", "paused", "reviewing", "completed", "cancelled"],
  paused: ["in_progress", "queued", "cancelled"],
  reviewing: ["completed", "partially_completed", "failed", "in_progress"],
  completed: ["in_progress", "reviewing"],
  partially_completed: ["in_progress", "completed"],
  failed: ["queued", "in_progress"],
  cancelled: ["queued"],
};

export function canTransition(from: string, to: string) {
  if (from === to) return true;
  const allowed = STATUS_TRANSITIONS[from];
  if (!allowed) return true;
  return allowed.includes(to);
}

export function safeJsonParse<T>(v: string | null | undefined, fallback: T): T {
  if (!v) return fallback;
  if (typeof v === "object") return v as unknown as T;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}
