import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId, errorResponse, successResponse } from "@/lib/auth";
import { createVerificationReport, type VerificationReport } from "@/lib/verification/pipeline";

// POST /api/verify — trigger verification pipeline for a task
// Body: { taskId, type?: "coding"|"doc"|"video"|"research"|"data" }
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);

    const body = await req.json() as { taskId?: string; type?: VerificationReport["type"]; opts?: Record<string, unknown> };
    const taskId = body.taskId;
    if (!taskId) return errorResponse("taskId is required", 400);

    const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
    if (!task) return errorResponse("Task not found", 404);

    // Resolve type: explicit > workKind mapping > fallback
    let verifyType: VerificationReport["type"] = body.type as VerificationReport["type"];
    if (!verifyType) {
      if (task.workKind === "coding") verifyType = "coding";
      else if (task.workKind === "doc") verifyType = "doc";
      else if (task.workKind === "video_gen" || task.workKind === "video_analysis" || task.workKind === "media_heavy") verifyType = "video";
      else if (task.workKind === "research") verifyType = "research";
      else if (task.workKind === "data") verifyType = "data";
      else verifyType = "research";
    }

    // Move task to reviewing
    await prisma.task.update({ where: { id: taskId }, data: { status: "reviewing", progress: 85 } });

    const report = await createVerificationReport(taskId, verifyType, body.opts, { userId });

    // Save verification_report.json to task
    await prisma.task.update({
      where: { id: taskId },
      data: {
        verification: JSON.stringify(report),
        status: report.passed ? "completed" : "reviewing",
        progress: report.passed ? 100 : 75,
        completedAt: report.passed ? new Date() : undefined,
        error: report.passed ? undefined : `Verification failed: ${report.checks.filter((c: any)=>!c.passed).map(c=>c.name).join(", ")}`,
      },
    });

    // Also create deliverable entry for verification_report.json itself
    if (report.passed) {
      await prisma.deliverable.create({
        data: {
          taskId,
          kind: "report",
          fileName: "verification_report.json",
          fileUrl: `/work/${taskId}/verification_report.json`,
          mimeType: "application/json",
          editable: false,
        },
      }).catch(() => {});
    }

    return successResponse({ report, taskId, verification_report_json: report });

  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Verification failed", 500);
  }
}

// GET /api/verify?taskId=xxx — fetch existing verification report
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);
    const taskId = req.nextUrl.searchParams.get("taskId");
    if (!taskId) return errorResponse("taskId is required", 400);

    const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
    if (!task) return errorResponse("Task not found", 404);

    const report = task.verification ? safeJson(task.verification) : null;
    if (!report) return successResponse({ report: null, message: "No verification yet — POST to create" });

    return successResponse({ report, taskId });
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : "Failed to fetch verification", 500);
  }
}

function safeJson(v: string) { try { return JSON.parse(v); } catch { return v; } }
