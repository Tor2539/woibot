import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./db";

export function errorResponse(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export function successResponse(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json({ ok: true, data }, { status, headers });
}

export async function getUserId(req?: NextRequest): Promise<string> {
  if (req) {
    const headerId = req.headers.get("x-user-id");
    if (headerId) return headerId;
    const urlId = req.nextUrl?.searchParams?.get("userId");
    if (urlId) return urlId;
  }
  const devEmail = process.env.DEV_USER_EMAIL || "dev@woibot.com";
  try {
    let user = await prisma.user.findUnique({ where: { email: devEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: { id: "usr_woibot_default", email: devEmail, name: "Takin (CEO Workspace)" },
      });
    }
    return user.id || "usr_woibot_default";
  } catch {
    return "usr_woibot_default";
  }
}

export async function requireUser(req: NextRequest) {
  return getUserId(req);
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
