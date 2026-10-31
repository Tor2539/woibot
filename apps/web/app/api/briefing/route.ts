import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

/**
 * Daily briefing — derived ONLY from what the user actually has: their tasks,
 * routines and connected apps. Nothing is invented; if no app is connected the
 * briefing says so instead of showing fake emails or meetings.
 */
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const [tasks, routines, apps] = await Promise.all([
    prisma.task.findMany({ where: { userId } }),
    prisma.routine.findMany({ where: { userId } }),
    prisma.connectedApp.findMany({ where: { userId } }),
  ]);

  const connected = apps.filter((a: any) => a.status === "connected");
  const needsAction = tasks.filter((t: any) =>
    ["waiting_for_user", "queued", "reviewing", "paused", "in_progress"].includes(t.status),
  );
  const completed = tasks.filter((t: any) => t.status === "completed");
  const failed = tasks.filter((t: any) => t.status === "failed" || t.status === "partially_completed");

  const items = needsAction.slice(0, 5).map((t: any) => {
    // estimate is stored as a JSON string — parse it so the shown cost is the
    // real stored estimate, never a fabricated 0.
    let est: any = null;
    try {
      est = typeof t.estimate === "string" ? JSON.parse(t.estimate) : t.estimate;
    } catch {
      est = null;
    }
    const estCost = Number(est?.cost ?? est?.estimatedCost ?? 0);
    const estMinutes = Number(est?.minutes ?? est?.estimatedMinutes ?? 0);
    return {
      id: t.id,
      type: "task" as const,
      title: `${t.title} — ${String(t.status).replace(/_/g, " ")}`,
      detail:
        t.status === "waiting_for_user"
          ? `รออนุมัติ · ประเมิน $${estCost.toFixed(2)}${estMinutes ? ` (~${estMinutes} นาที)` : ""}`
          : t.status === "reviewing"
            ? "อยู่ระหว่างตรวจสอบผลงาน — เปิดแท็บ Verification เพื่อดูหลักฐาน"
            : `ความคืบหน้า ${t.progress ?? 0}% · ${t.workKind || "work"}`,
      priority: t.status === "waiting_for_user" ? "high" : "medium",
      taskId: t.id,
    };
  });

  const proactive: { id: string; title: string; detail: string; action: string }[] = [];

  if (connected.length === 0) {
    proactive.push({
      id: "p-connect",
      title: "ยังไม่ได้เชื่อมต่ออีเมลหรือปฏิทิน",
      detail: "Teammate จะสรุปอีเมลและเตรียมนัดหมายได้ก็ต่อเมื่อคุณเชื่อมบัญชีในหน้า Apps",
      action: "พาฉันไปเชื่อมต่อ Gmail และ Google Calendar",
    });
  }
  if (failed.length > 0) {
    proactive.push({
      id: "p-failed",
      title: `มี ${failed.length} งานที่ยังไม่ผ่าน`,
      detail: failed.slice(0, 3).map((t: any) => t.title).join(" · "),
      action: "ช่วยตรวจงานที่ไม่ผ่านและเสนอวิธีแก้",
    });
  }
  if (completed.length > 0 && routines.length === 0) {
    proactive.push({
      id: "p-routine",
      title: `คุณมีงานที่เสร็จแล้ว ${completed.length} งาน`,
      detail: "ถ้างานนี้ต้องทำซ้ำ เปลี่ยนเป็น Routine ได้เพื่อให้ Teammate ทำเองทุกครั้ง",
      action: "สร้าง Routine จากงานที่เพิ่งเสร็จ",
    });
  }

  const now = new Date();
  const dateLabel = now.toLocaleDateString("th-TH", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
  });

  return NextResponse.json({
    ok: true,
    date: dateLabel,
    greeting: `Daily Briefing · ${connected.length} connected app${connected.length === 1 ? "" : "s"}`,
    stats: {
      tasks: needsAction.length,
      completed: completed.length,
      routines: routines.filter((r: any) => r.status === "active").length,
      apps: connected.length,
    },
    items,
    proactive,
    generatedAt: now.toISOString(),
  });
}
