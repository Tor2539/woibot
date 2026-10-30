export type MockMemory = {
  id: string;
  key: string;
  value: string;
  scope: "personal" | "team" | "project";
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MockApp = {
  id: string;
  provider: string;
  label: string;
  icon: string;
  status: "connected" | "expired" | "revoked" | "not_connected";
  scopes: string[];
  account?: string;
};

export type BriefingItem = {
  id: string;
  type: "email" | "calendar" | "task" | "proactive";
  title: string;
  detail: string;
  time?: string;
  priority: "high" | "medium" | "low";
  actionLabel?: string;
};

export const MOCK_MEMORIES: MockMemory[] = [
  { id: "m1", key: "communication_style", value: "ชอบสรุปแบบ bullet สั้นๆ ภาษาไทย ผสมอังกฤษเทคนิค", scope: "personal", canDelete: true, createdAt: "2026-10-20", updatedAt: "2026-10-20" },
  { id: "m2", key: "report_template", value: "รายงานต้องมี Executive Summary + ตาราง + กราฟ + ข้อเสนอแนะ", scope: "personal", canDelete: true, createdAt: "2026-10-18", updatedAt: "2026-10-22" },
  { id: "m3", key: "client_acme", value: "ACME Corp — คุณสมชาย ฝ่ายจัดซื้อ ชอบส่งใบเสนอราคาวันจันทร์", scope: "team", canDelete: true, createdAt: "2026-10-15", updatedAt: "2026-10-15" },
  { id: "m4", key: "no_store_pii", value: "ห้ามบันทึกเลขบัตรประชาชน/เบอร์โทรลง Memory", scope: "personal", canDelete: false, createdAt: "2026-10-10", updatedAt: "2026-10-10" },
  { id: "m5", key: "crm_project", value: "โปรเจกต์ CRM ทีมขาย — ใช้ Next.js + Supabase, deadline 15 พ.ย.", scope: "project", canDelete: true, createdAt: "2026-10-28", updatedAt: "2026-10-28" },
];

export const MOCK_APPS: MockApp[] = [
  { id: "1", provider: "gmail", label: "Gmail", icon: "📧", status: "connected", scopes: ["read", "send"], account: "you@company.com" },
  { id: "2", provider: "calendar", label: "Google Calendar", icon: "📅", status: "connected", scopes: ["read", "write"], account: "you@company.com" },
  { id: "3", provider: "drive", label: "Google Drive", icon: "📁", status: "connected", scopes: ["read"], account: "you@company.com" },
  { id: "4", provider: "slack", label: "Slack", icon: "💬", status: "connected", scopes: ["read", "write"], account: "woibot-workspace" },
  { id: "5", provider: "notion", label: "Notion", icon: "📝", status: "expired", scopes: ["read"], account: "you@company.com" },
  { id: "6", provider: "github", label: "GitHub", icon: "🐙", status: "connected", scopes: ["read", "write"], account: "woibot" },
  { id: "7", provider: "linear", label: "Linear", icon: "📊", status: "not_connected", scopes: [], account: undefined },
  { id: "8", provider: "hubspot", label: "HubSpot", icon: "🧲", status: "not_connected", scopes: [], account: undefined },
];

export const MOCK_BRIEFING: { date: string; greeting: string; items: BriefingItem[]; stats: { emails: number; meetings: number; tasks: number } } = {
  date: "31 ต.ค. 2026 • 08:00",
  greeting: "สวัสดีตอนเช้าครับ ☀️ นี่คือสรุปประจำวันของคุณ",
  stats: { emails: 3, meetings: 2, tasks: 2 },
  items: [
    { id: "b1", type: "email", title: "3 อีเมลสำคัญรอตอบ", detail: "ACME Corp ขอใบเสนอราคา • ทีม dev ส่ง PR #42 • ลูกค้าใหม่นัด demo พรุ่งนี้", time: "07:42", priority: "high", actionLabel: "สรุปอีเมล" },
    { id: "b2", type: "calendar", title: "ประชุม 10:00 — Sprint Review", detail: "ห้อง A • มี 5 คนเข้าร่วม • สไลด์เตรียมแล้ว (ดูไฟล์)", time: "10:00", priority: "high", actionLabel: "เตรียมข้อมูล" },
    { id: "b3", type: "calendar", title: "นัดลูกค้า 14:30 — ACME", detail: "Google Meet • เตรียม proposal 12 หน้า (ครั้งก่อนค้าง)", time: "14:30", priority: "medium", actionLabel: "เปิดไฟล์" },
    { id: "b4", type: "task", title: "งานค้าง 2 ชิ้น", detail: "CRM spec ยังไม่สรุป • รายงานยอดขาย Q3 รอกราฟ", time: "", priority: "medium", actionLabel: "ดู Tasks" },
    { id: "b5", type: "proactive", title: "💡 แนะนำ: สร้าง Routine", detail: "คุณขอสรุปอีเมลทุกเช้า — ให้ตั้งเป็น Routine 08:00 อัตโนมัติไหม?", time: "", priority: "low", actionLabel: "สร้างเลย" },
  ],
};

export const MOCK_PROACTIVE = [
  { id: "p1", title: "อีเมล ACME ยังไม่ตอบ 2 วัน", detail: "ควร follow-up ก่อน 10:00 วันนี้", action: "ร่างอีเมล", severity: "warning" as const },
  { id: "p2", title: "ประชุมชนกัน 14:30 / 14:45", detail: "ACME vs ทีม design — แนะนำเลื่อน design เป็น 16:00", action: "แก้ปฏิทิน", severity: "warning" as const },
  { id: "p3", title: "งาน CRM ใกล้ deadline 15 พ.ย.", detail: "คืบหน้า 40% — แนะนำ Handoff ไป Work เพื่อเร่ง", action: "Handoff → Work", severity: "info" as const },
];
