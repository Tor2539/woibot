import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    teammate: {
      id: "tm_main",
      name: "Nim Teammate",
      role: "Personal Assistant",
      persona: "\u0e15\u0e2d\u0e1a\u0e2a\u0e31\u0e49\u0e19 \u0e15\u0e23\u0e07\u0e1b\u0e23\u0e30\u0e40\u0e14\u0e47\u0e19 \u0e20\u0e32\u0e29\u0e32\u0e44\u0e17\u0e22\u0e2b\u0e25\u0e31\u0e01",
      language: "th",
      isMain: true,
      isCloudOnly: true,
      computer: { status: "running", cpu: "1 vCPU", ram: "2GB", uptime: "2h 14m", cdpUrl: "ws://localhost:9222" },
    },
    capabilities: ["chat", "voice", "files", "memory", "connected_apps", "routines", "proactive", "handoff_to_work"],
    product: "teammate",
    note: "Teammate is Cloud Only \u2014 \u0e44\u0e21\u0e48\u0e21\u0e35 Local mode \u0e41\u0e15\u0e48 Work \u0e40\u0e25\u0e37\u0e2d\u0e01 Cloud/Local \u0e44\u0e14\u0e49",
  });
}
