import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    date: "Saturday, 31 Oct 2026 · 08:00",
    greeting: "Daily Executive Briefing · Cloud Computer (:99)",
    stats: { emails: 3, meetings: 2, tasks: 4 },
    items: [
      { id: "b1", type: "email", title: "ACME Corp ขอใบเสนอราคา Enterprise CRM", detail: "ร่างอีเมลตอบกลับพร้อมแนบสเปกเตรียมไว้ให้ตรวจแล้ว (Ask-first)", priority: "high" },
      { id: "b2", type: "calendar", title: "10:00 — Sprint & Architecture Review", detail: "เตรียมสไลด์สรุป KPI 10 หน้าไว้ใน Library เรียบร้อย", priority: "high" },
      { id: "b3", type: "task", title: "Work: Q4 Board Strategy Report รออนุมัติงบ", detail: "ประเมิน $1.15 (~10 นาที) — กด Approve เพื่อเริ่มสร้าง DOCX/PPTX", priority: "medium" },
    ],
    proactive: [
      { id: "p1", title: "ตรวจพบใบแจ้งหนี้ AWS & Cloudflare ประจำเดือน", detail: "ยอดตรงกับ PO เดือนก่อน — ต้องการให้จัดเข้าคิวอนุมัติจ่ายเลยไหม?", action: "สร้างคิวอนุมัติใบแจ้งหนี้ AWS และ Cloudflare" },
      { id: "p2", title: "สร้าง Routine สรุปความคืบหน้าทุกวันศุกร์ 16:00", detail: "สัปดาห์นี้คุณสั่งสรุปงานวันศุกร์ 2 ครั้ง — เปลี่ยนเป็น Routine อัตโนมัติได้ทันที", action: "ตั้งค่า Routine สรุปงานทุกวันศุกร์ 16:00" },
    ],
  });
}
