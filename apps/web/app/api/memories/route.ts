import { NextRequest, NextResponse } from "next/server";

let MEM = [
  { id: "m1", key: "communication_style", value: "\u0e0a\u0e2d\u0e1a\u0e2a\u0e23\u0e38\u0e1b\u0e41\u0e1a\u0e1a bullet \u0e2a\u0e31\u0e49\u0e19\u0e46 \u0e20\u0e32\u0e29\u0e32\u0e44\u0e17\u0e22 \u0e1c\u0e2a\u0e21\u0e2d\u0e31\u0e07\u0e01\u0e24\u0e29\u0e40\u0e17\u0e04\u0e19\u0e34\u0e04", scope: "personal", canDelete: true, createdAt: "2026-10-20", updatedAt: "2026-10-20" },
  { id: "m2", key: "report_template", value: "\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e15\u0e49\u0e2d\u0e07\u0e21\u0e35 Executive Summary + \u0e15\u0e32\u0e23\u0e32\u0e07 + \u0e01\u0e23\u0e32\u0e1f", scope: "personal", canDelete: true, createdAt: "2026-10-18", updatedAt: "2026-10-22" },
  { id: "m3", key: "client_acme", value: "ACME Corp \u2014 \u0e04\u0e38\u0e13\u0e2a\u0e21\u0e0a\u0e32\u0e22 \u0e1d\u0e48\u0e32\u0e22\u0e08\u0e31\u0e14\u0e0b\u0e37\u0e49\u0e2d \u0e0a\u0e2d\u0e1a\u0e2a\u0e48\u0e07\u0e43\u0e1a\u0e40\u0e2a\u0e19\u0e2d\u0e23\u0e32\u0e04\u0e32\u0e27\u0e31\u0e19\u0e08\u0e31\u0e19\u0e17\u0e23\u0e4c", scope: "team", canDelete: true, createdAt: "2026-10-15", updatedAt: "2026-10-15" },
  { id: "m4", key: "no_store_pii", value: "\u0e2b\u0e49\u0e32\u0e21\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e40\u0e25\u0e02\u0e1a\u0e31\u0e15\u0e23\u0e1b\u0e23\u0e30\u0e0a\u0e32\u0e0a\u0e19/\u0e40\u0e1a\u0e2d\u0e23\u0e4c\u0e42\u0e17\u0e23\u0e25\u0e07 Memory", scope: "personal", canDelete: false, createdAt: "2026-10-10", updatedAt: "2026-10-10" },
];

export async function GET() {
  return NextResponse.json({ memories: MEM });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const nm = {
    id: body.id || `m${Date.now()}`,
    key: body.key || "new_key",
    value: body.value || "",
    scope: body.scope || "personal",
    canDelete: body.canDelete ?? true,
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  MEM.unshift(nm as any);
  return NextResponse.json({ ok: true, memory: nm });
}
