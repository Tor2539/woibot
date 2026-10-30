import { NextRequest, NextResponse } from "next/server";
import { estimateTask } from "@/lib/harness";

function cuid() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const goal: string = body.goal || body.message || "Untitled task";
  const execution_mode = (body.execution_mode || body.executionMode || "cloud") as "cloud" | "local";
  const trace_id = body.trace_id || `trace_${cuid()}`;

  // Build HandoffPacket per spec
  const packet = {
    goal,
    context: {
      chat_history: body.chat_history || [],
      memory_snippet: body.memory_snippet || "",
      user_prefs: body.user_prefs || {},
    },
    attachments: body.attachments || [],
    deliverables: body.deliverables || (body.goal ? [body.goal.slice(0,80)] : []),
    constraints: body.constraints || {},
    verification_criteria: body.verification_criteria || ["\u0e44\u0e1f\u0e25\u0e4c\u0e40\u0e1b\u0e34\u0e14\u0e44\u0e14\u0e49", "preview \u0e1c\u0e48\u0e32\u0e19"],
    execution_mode,
    trace_id,
  };

  // Estimate for display (infer kind from goal)
  const s = goal.toLowerCase();
  let kind: any = "coding";
  if (/\u0e27\u0e34\u0e14\u0e35\u0e42\u0e2d|video|\u0e04\u0e25\u0e34\u0e1b|tiktok|reel/.test(s)) kind = s.includes("\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c") ? "video_analysis" : "video_gen";
  else if (/\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23|\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19|presentation|proposal|pdf|docx/.test(s)) kind = "doc";
  else if (/\u0e27\u0e34\u0e08\u0e31\u0e22|research|\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c.*\u0e15\u0e25\u0e32\u0e14/.test(s)) kind = "research";
  const est = estimateTask(kind);

  // In real app: prisma.task.create({ data: { title: goal.slice(0,80), goal, product: "work", workKind: kind, status: "queued", executionMode: execution_mode, handoffPacket: JSON.stringify(packet), traceId: trace_id }})
  // Here we mock task creation
  const task = {
    id: `task_${cuid()}`,
    title: goal.slice(0, 80),
    goal,
    product: "work",
    workKind: kind,
    status: "queued",
    executionMode: execution_mode,
    traceId: trace_id,
    handoffPacket: packet,
    estimate: est,
    createdAt: new Date().toISOString(),
  };

  // Reverse delegation hook: Work will notify Teammate thread when done (mock)
  return NextResponse.json({
    ok: true,
    trace_id,
    task,
    packet,
    estimate: est,
    message: `HandoffPacket \u0e16\u0e39\u0e01\u0e2a\u0e48\u0e07\u0e41\u0e25\u0e49\u0e27 \u2022 trace ${trace_id} \u2022 Work \u0e08\u0e30\u0e2a\u0e48\u0e07\u0e01\u0e25\u0e31\u0e1a\u0e21\u0e32\u0e17\u0e35\u0e48 Teammate thread \u0e40\u0e14\u0e34\u0e21`,
    next: `/tasks/${task.id}`,
  });
}

export async function GET() {
  return NextResponse.json({ hint: "POST {goal, execution_mode, chat_history, memory_snippet}" });
}
