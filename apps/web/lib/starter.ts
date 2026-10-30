import { prisma } from "./db";

/**
 * Every account starts with a real, working workspace:
 * a main teammate, specialist bots, routines, connected-app placeholders and
 * the two product ledgers. No shared demo data across accounts.
 */
export async function ensureStarterWorkspace(userId: string, displayName?: string) {
  const existing = await prisma.teammate.count({ where: { userId } });
  if (existing > 0) return;

  const bots = [
    { id: `tm_main_${userId.slice(-6)}`, name: "Woibot Main", role: "Chief Personal Teammate", isMain: true, avatar: "WM",
      persona: { tone: "Direct, concise, decision-first", statusText: "On its computer · :99", statusKind: "on_its_computer",
        skills: ["daily-briefing", "inbox-triage", "meeting-prep", "work-handoff"] } },
    { id: `tm_exec_${userId.slice(-6)}`, name: "Exec Chief", role: "Executive & Calendar", isMain: false, avatar: "EC",
      persona: { tone: "Structured briefing and board prep", statusText: "Idle · Ready", statusKind: "idle",
        skills: ["calendar-guard", "board-deck-brief", "travel-ops"] } },
    { id: `tm_inbox_${userId.slice(-6)}`, name: "Inbox Triage", role: "Email & Slack Operator", isMain: false, avatar: "IT",
      persona: { tone: "Draft-first, zero noise", statusText: "Idle · Ready", statusKind: "idle",
        skills: ["gmail-triage", "slack-digest", "vip-followup"] } },
    { id: `tm_ops_${userId.slice(-6)}`, name: "Ops & Finance", role: "Invoice & KPI Auditor", isMain: false, avatar: "OF",
      persona: { tone: "Tabular numbers, strict verification", statusText: "Idle · Ready", statusKind: "idle",
        skills: ["invoice-chaser", "expense-audit", "kpi-watch"] } },
  ];

  for (const bot of bots) {
    await prisma.teammate.create({
      data: {
        id: bot.id,
        userId,
        name: bot.name,
        role: bot.role,
        isMain: bot.isMain,
        avatar: bot.avatar,
        language: "th",
        persona: JSON.stringify(bot.persona),
      },
    });
  }

  await prisma.chatMessage.create({
    data: {
      teammateId: bots[0].id,
      userId,
      role: "assistant",
      content: `ยินดีต้อนรับครับ${displayName ? ` คุณ${displayName}` : ""} — ผมคือ Woibot Main ผู้ช่วยส่วนตัวของคุณ\n\nCloud Computer ของคุณพร้อมใช้งานแล้ว (:99) ผมเชื่อมต่อ Gmail, Google Calendar, Slack, Notion และ GitHub ให้คุณได้จากหน้า Connected Apps และตั้งงานประจำอัตโนมัติได้จากหน้า Routines\n\nลองสั่งงานได้เลย เช่น:\n- "สรุปอีเมลสำคัญเช้านี้และร่างตอบลูกค้า"\n- "สร้างระบบ CRM พร้อม Dashboard และเทสต์" (จะส่งต่อให้ Work อัตโนมัติ)\n- "ทุกเช้า 08:00 สรุปตารางประชุมให้หน่อย"`,
      meta: JSON.stringify({
        workedFor: "2s",
        steps: [{ tool: "workspace.provision", detail: "Created Cloud Computer, 2-tier memory and starter routines" }],
      }),
    },
  });

  await prisma.memory.create({
    data: { userId, key: "communication_style", value: "สรุปสั้น ตรงประเด็น ตัดสินใจนำ ใช้ตัวเลข tabular-nums", scope: "personal", source: "system", canDelete: true },
  });
  await prisma.memory.create({
    data: { userId, key: "privacy_guardrail", value: "ห้ามบันทึก API Key หรือรหัสผ่านลง Memory — เก็บใน Vault เท่านั้น", scope: "personal", source: "system", canDelete: false },
  });

  await prisma.workQuota.create({ data: { userId, monthlyCap: 50, perTaskCap: 5, monthlyUsed: 0 } });
  await prisma.subscription.create({
    data: {
      userId,
      plan: "starter",
      status: "active",
      periodStart: new Date().toISOString(),
      periodEnd: new Date(Date.now() + 30 * 86400_000).toISOString(),
      allowance: JSON.stringify({ tokens: 2_000_000, cloudHours: 100, routines: 20 }),
    },
  });

  const apps = [
    { provider: "gmail", status: "not_connected", scopes: ["read", "draft"], account: null },
    { provider: "calendar", status: "not_connected", scopes: ["read"], account: null },
    { provider: "slack", status: "not_connected", scopes: ["channels:read"], account: null },
    { provider: "github", status: "not_connected", scopes: ["repo:read"], account: null },
    { provider: "notion", status: "not_connected", scopes: ["pages:read"], account: null },
    { provider: "drive", status: "not_connected", scopes: ["drive.readonly"], account: null },
  ];
  for (const app of apps) {
    await prisma.connectedApp.create({
      data: { userId, provider: app.provider, status: app.status, scopes: JSON.stringify(app.scopes), account: app.account },
    });
  }

  await prisma.routine.create({
    data: {
      userId,
      title: "08:00 Daily Executive Briefing",
      trigger: JSON.stringify({ type: "cron", expr: "0 8 * * 1-5", timezone: "Asia/Bangkok", kindLabel: "Weekdays at 08:00" }),
      action: JSON.stringify({ botId: bots[0].id, template: "สรุปอีเมล VIP ตารางประชุมวันนี้ และงานค้างที่ต้องติดตาม", spendGuard: true }),
      status: "active",
      nextRun: new Date(Date.now() + 3600_000).toISOString(),
    },
  });
}
