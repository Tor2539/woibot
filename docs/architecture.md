# woibot — System Architecture & Cost Isolation Design
**Version:** 1.0 (derived from woibot PRD Phase 1)
**Date:** 2026-10-31
**Principle:** Teammate = Cloud Computer as base service (subscription, always-on) / Work = high-cost execution (metered, isolated)

---

## 1) เป้าหมายสถาปัตยกรรมตามหลักคิดที่ให้มา

1. **Teammate ต้องเป็น AI ที่กลับมาหาทุกวัน** → Memory + Connected Apps + Daily Routines + Follow-up ต้องเหนือกว่าความฉลาดในการตอบ
2. **Work ต้องวัดที่ผลงาน** → Coding/Documents/Video ต้องมีระบบตรวจสอบเฉพาะประเภท ส่งมอบไฟล์ที่เปิดใช้/แก้ไขต่อได้จริง
3. **เชื่อมต่อสองผลิตภัณฑ์แทบไม่มีรอยต่อ** → Handoff Teammate ↔ Work ต้องไม่ให้ผู้ใช้คัดลอกบริบทเอง
4. **แยกสิทธิ์/ต้นทุนตั้งแต่ระดับ Product Requirement** → งานหนัก (โดยเฉพาะวิดีโอ) ต้องไม่กระทบความคุ้มค่าของ Teammate

## 2) โครงสร้างผลิตภัณฑ์ (IA)

```
woibot.com
├── Teammate (Chat + Voice + Memory + Cloud Computer)
├── Work (Project Workspace: Coding / Docs / Video / Research / Data)
├── Tasks (Unified — ทุกงานจาก Teammate+Work รวมศูนย์เดียว)
├── Files (Deliverables + Cloud Drive)
├── Computer (Live view + Take Over)
├── Routines (Cron + Event triggers)
├── Apps (OAuth connections)
├── Team (Multi-Teammate groups)
└── Settings & Usage (Billing แยก Teammate / Work ชัดเจน)
```

## 3) Tech Stack — เน้น Open Source ประหยัดตั้งแต่แรก

| Layer | เลือกใช้ | เหตุผล/ต้นทุน |
|-------|----------|---------------|
| **Frontend** | Next.js 15 + Tailwind + shadcn/ui | SSR/ISR, ไทย/อังกฤษ i18n ในตัว |
| **API** | tRPC + Next.js Route Handlers | type-safe, ไม่ต้องแยก service ตั้งแต่ Phase 1 |
| **DB (OLTP)** | Postgres (Supabase/Neon self-host) + Prisma | RLS, Realtime, ถูกกว่า managed แพงๆ |
| **Queue/Jobs** | BullMQ + Redis | รองรับ Cloud Computer background jobs |
| **Cloud Computer** | Docker per-user container + noVNC + Playwright | isolate จริง, persistent volume/user |
| **Browser Use** | Browserless / Playwright + CDP | ใช้เว็บจริงแม้ไม่มี integration |
| **File Storage** | S3-compatible (Cloudflare R2 / MinIO) | ค่า egress ถูก, แยก bucket: teammate / work |
| **Search/RAG** | pgvector (in Postgres) | ไม่ต้องจ่าย Pinecone แยก |
| **Video Gen** | ComfyUI (self-host) + Fal/Replicate fallback | งานหนักคิดต้นทุนแยก, ใช้ open-source ก่อน |
| **Video Edit** | FFmpeg + Remotion | ไม่ต้อง license NLE |
| **Docs Gen** | LibreOffice headless + python-docx/pptx + Puppeteer PDF | แก้ไขต่อได้, ไม่ผูก vendor |
| **Code Exec** | Sandboxed Docker + Daytona/CodeSandbox OSS | รัน/เทส/verify จริง |
| **Observability** | OpenTelemetry + Grafana Loki | วัด Cost per Accepted Task |

## 4) แยกต้นทุน Teammate / Work ตั้งแต่ PRD

### Teammate Subscription (รายเดือน, เข้าถึงง่าย)
- รวม: 1 Main Teammate, Cloud Computer (1 vCPU / 2GB persistent), Memory, Basic Connected Apps (Gmail/Calendar/Drive), Routines (≤20), Monthly Token Allowance
- ไม่รวมงาน Work หนัก — ถ้าสั่งงานหนัก Teammate จะเสนอ Handoff พร้อมใบประเมินราคา

### Work Usage (จ่ายตามงาน, โปร่งใสก่อนเริ่ม)
- แยกมิเตอร์ 6 ประเภท: `coding | research | doc | video_analysis | video_gen | media_heavy`
- ก่อนเริ่ม Work ทุกครั้ง: แสดง `estimated_cost + estimated_time + required_tools` ให้ผู้ใช้อนุมัติ
- วงเงิน: `work_budget_per_task` + `monthly_work_cap` ตั้งได้, เกินแล้ว pause รออนุมัติ
- Video โดยเฉพาะ: ใช้ GPU pool แยก, ไม่แชร์ resource กับ Teammate → งานหนักไม่ทำให้ Teammate ช้า/แพง

### Billing Tables (Postgres)
```sql
-- แยก ledger ชัดเจน
subscriptions (user_id, plan, period, teammate_allowance)
work_quotas (user_id, monthly_cap, per_task_cap, alert_threshold)
usage_events (id, user_id, product enum('teammate','work'), kind, tokens, gpu_seconds, storage_mb, cost)
work_estimates (task_id, estimated_cost, actual_cost, variance)
```

## 5) แกนกลางที่ต้องดีมากตั้งแต่วันแรก: สั่งงาน → ลงมือทำ → ตรวจสอบ → ส่งมอบ → ทำงานต่อ

```
[User Intent] → Intent Router → Teammate or Work
                                │
           ┌────────────────────┼────────────────────┐
           │Teammate            │Work                │Verification (per-type)
           │- chat              │- planner            │- coding: tests+lint+preview
           │- memory write      │- executor           │- docs: open+layout check
           │- routines          │- checker            │- video: ffprobe+thumb+subs
           └─────────┬──────────┴──────────┬──────────┘
                     │  Handoff Packet     │
                     └──────► Tasks ◄──────┘
                              │
                      Deliverables → Files + Teammate summary
                              │
                      Follow-up / Revise → loop
```

### Verification แยกประเภท (ต้องมีตั้งแต่วันแรก)
- **Coding:** `pnpm test` + `tsc --noEmit` + Playwright smoke + preview URL + coverage summary
- **Documents:** เปิดไฟล์จริง (LibreOffice/PDF), ตรวจหน้า/ฟอนต์/สารบัญ/กราฟครบ, แสดง preview ก่อนส่ง
- **Video:** `ffprobe` ตรวจ duration/resolution/codec, thumbnail strip, ตรวจ subtitle sync, ส่ง project file (ถ้ารองรับ)

ทุกงานต้องมี `verification_report.json` แนบก่อน mark Completed

## 6) Seamless Handoff — Packet Spec

```ts
type HandoffPacket = {
  goal: string;
  context: { chat_history: Msg[], memory_snippet: string, user_prefs: Prefs };
  attachments: FileRef[];  // จาก Teammate files (+สิทธิ์)
  deliverables: string[];   // เช่น ["CRM webapp + login", "PDF report 12 pages"]
  constraints: { deadline?: string; budget?: number; must_not_leak?: string[] };
  verification_criteria: string[]; // เกณฑ์ Done
  execution_mode: "cloud" | "local";
  trace_id: string; // เชื่อม Teammate ↔ Work ↔ Tasks
}
```
- Teammate ไม่ถามซ้ำถ้ามีคำตอบแล้ว
- Work ส่งกลับ Teammate thread เดิมเสมอ (reverse delegation: notify / ask-for-info / create-routine)

## 7) Cloud Computer — per-user isolation

- 1 user = 1 Docker container (systemd-supervised) + 1 volume (`/home/woibot`)
- Browser: Chromium persistent profile + CDP endpoint
- Take Over: noVNC + collaborative cursor
- Background: BullMQ worker ใน container เดียวกัน, อยู่ได้แม้ user ปิด browser
- Quota: CPU/RAM/Disk/Net per user (cgroup), เกิน → throttle + แจ้ง

## 8) Phase 1 MVP Checklist (6–8 สัปดาห์)

- [ ] Auth + Teammate chat (memory + connected apps Gmail/Calendar stubs)
- [ ] Cloud Computer MVP (Docker + Browser + Files)
- [ ] Tasks unified board (Queued→Completed 10 states)
- [ ] Work Project Workspace (Cloud mode) — Coding + Docs + Research
- [ ] Verification pipeline (coding/docs) + deliverable download
- [ ] Handoff Teammate→Work→Teammate (packet + trace)
- [ ] Billing split (subscription + work meter + estimate screen)
- [ ] Routines v1 (cron daily briefing)
- [ ] Landing + Pricing (woibot.com)

## 9) Open Source ที่ใช้จบงานได้ (ไม่ต้องสร้างใหม่)

- Editor: Monaco / TipTap
- Whiteboard: tldraw
- Diagrams: Mermaid
- PDF: pdfjs, marker-pdf (extract)
- Spreadsheet: LuckySheet / Univer
- Auth: Auth.js (NextAuth)
- Billing: Stripe + custom meter (แยก Teammate/Work)

---
**Success metric หลัก:** Verified Completed Tasks / Active User / เดือน — ไม่ใช่จำนวนข้อความ
