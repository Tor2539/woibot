import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId, safeJsonParse } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  const teammates = await prisma.teammate.findMany({ where: { userId } });
  const main = teammates.find((t: any) => t.isMain) || teammates[0];

  return NextResponse.json({
    ok: true,
    teammate: {
      id: main?.id || "tm_main",
      name: main?.name || "Woibot Main",
      role: main?.role || "Chief Personal Teammate",
      persona: safeJsonParse(main?.persona, { tone: "Direct, concise, decision-first" }),
      language: main?.language || "th",
      isMain: true,
      isCloudOnly: true,
      computer: {
        status: "running",
        os: "Ubuntu 24.04 LTS · XFCE + Chromium CDP",
        cpu: "2 vCPU",
        ram: "4 GB",
        disk: "14.2 / 50 GB",
        uptime: "14h 28m",
        display: ":99",
        cdpUrl: "ws://localhost:9222",
      },
    },
    teammates: teammates.map((t: any) => ({
      ...t,
      persona: safeJsonParse(t.persona, {}),
    })),
    capabilities: ["chat", "voice_ptt", "files", "memory_2tier", "connected_apps", "routines_spend_guard", "graduated_approvals", "vault_autofill", "handoff_to_work"],
    product: "teammate",
  });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  const body = await req.json();
  const created = await prisma.teammate.create({
    data: {
      userId,
      name: body.name || "Custom Specialist Bot",
      role: body.role || "Operations Specialist",
      persona: JSON.stringify({
        tone: body.tone || "Concise & structured",
        statusText: "Idle · Ready",
        statusKind: "idle",
        skills: body.skills || ["custom-workflow"],
      }),
      language: body.language || "th",
      avatar: (body.name || "CB").slice(0, 2).toUpperCase(),
      isMain: false,
    },
  });
  return NextResponse.json({ ok: true, teammate: created });
}
