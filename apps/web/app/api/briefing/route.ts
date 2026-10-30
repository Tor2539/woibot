import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    date: "31 \u0e15.\u0e04. 2026 \u2022 08:00",
    greeting: "\u0e2a\u0e27\u0e31\u0e2a\u0e14\u0e35\u0e15\u0e2d\u0e19\u0e40\u0e0a\u0e49\u0e32\u0e04\u0e23\u0e31\u0e1a \u2614\uFE0F \u0e19\u0e35\u0e48\u0e04\u0e37\u0e2d\u0e2a\u0e23\u0e38\u0e1b\u0e1b\u0e23\u0e30\u0e08\u0e33\u0e27\u0e31\u0e19\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13",
    stats: { emails: 3, meetings: 2, tasks: 2 },
    items: [
      { id: "b1", type: "email", title: "3 \u0e2d\u0e35\u0e40\u0e21\u0e25\u0e2a\u0e33\u0e04\u0e31\u0e0d\u0e23\u0e2d\u0e15\u0e2d\u0e1a", detail: "ACME Corp \u0e02\u0e2d\u0e43\u0e1a\u0e40\u0e2a\u0e19\u0e2d\u0e23\u0e32\u0e04\u0e32", priority: "high" },
      { id: "b2", type: "calendar", title: "\u0e1b\u0e23\u0e30\u0e0a\u0e38\u0e21 10:00 \u2014 Sprint Review", detail: "\u0e2b\u0e49\u0e2d\u0e07 A", priority: "high" },
    ],
    proactive: [
      { id: "p1", title: "\u0e2d\u0e35\u0e40\u0e21\u0e25 ACME \u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e15\u0e2d\u0e1a 2 \u0e27\u0e31\u0e19", detail: "\u0e04\u0e27\u0e23 follow-up \u0e01\u0e48\u0e2d\u0e19 10:00", action: "\u0e23\u0e48\u0e32\u0e07\u0e2d\u0e35\u0e40\u0e21\u0e25" },
    ],
    source: "Teammate Cloud \u2022 Connected: Gmail, Calendar, Slack",
  });
}
