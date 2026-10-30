import { NextRequest, NextResponse } from "next/server";

const APPS = [
  { id: "1", provider: "gmail", label: "Gmail", icon: "\uD83D\uDCE7", status: "connected", scopes: ["read", "send"], account: "you@company.com" },
  { id: "2", provider: "calendar", label: "Google Calendar", icon: "\uD83D\uDCC5", status: "connected", scopes: ["read", "write"], account: "you@company.com" },
  { id: "3", provider: "drive", label: "Google Drive", icon: "\uD83D\uDCC1", status: "connected", scopes: ["read"], account: "you@company.com" },
  { id: "4", provider: "slack", label: "Slack", icon: "\uD83D\uDCAC", status: "connected", scopes: ["read", "write"], account: "woibot-workspace" },
  { id: "5", provider: "notion", label: "Notion", icon: "\uD83D\uDCDD", status: "expired", scopes: ["read"], account: "you@company.com" },
  { id: "6", provider: "github", label: "GitHub", icon: "\uD83D\uDC19", status: "connected", scopes: ["read", "write"], account: "woibot" },
  { id: "7", provider: "linear", label: "Linear", icon: "\uD83D\uDCCA", status: "not_connected", scopes: [], account: null },
];

export async function GET() {
  return NextResponse.json({ apps: APPS });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // Toggle logic mock
  return NextResponse.json({ ok: true, id: body.id, toggled: true });
}
