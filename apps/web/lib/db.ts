import fs from "fs";
import path from "path";
import { createPgClient, pgEnabled, ensureSchema, audit } from "./pg";

export interface StoreRecord {
  id: string;
  [key: string]: any;
}

export interface WoibotRuntimeData {
  user: StoreRecord[];
  teammate: StoreRecord[];
  chatMessage: StoreRecord[];
  memory: StoreRecord[];
  task: StoreRecord[];
  deliverable: StoreRecord[];
  file: StoreRecord[];
  subscription: StoreRecord[];
  workQuota: StoreRecord[];
  usageEvent: StoreRecord[];
  connectedApp: StoreRecord[];
  routine: StoreRecord[];
  artifact: StoreRecord[];
  vaultSecret: StoreRecord[];
}

const DEFAULT_USER_ID = "usr_woibot_default";

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function createInitialSeed(): WoibotRuntimeData {
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400_000).toISOString();
  const twoHoursAgo = new Date(Date.now() - 7200_000).toISOString();
  const thirtyMinAgo = new Date(Date.now() - 1800_000).toISOString();

  return {
    user: [
      {
        id: DEFAULT_USER_ID,
        email: process.env.DEV_USER_EMAIL || "dev@woibot.com",
        name: "Takin (CEO Workspace)",
        image: null,
        mode: "teammate",
        createdAt: yesterday,
      },
    ],
    teammate: [
      {
        id: "tm_main",
        userId: DEFAULT_USER_ID,
        name: "Woibot Main",
        role: "Chief Personal Teammate",
        persona: JSON.stringify({
          tone: "Direct, concise, decision-first (TH/EN)",
          statusText: "On its computer · :99",
          statusKind: "on_its_computer",
          skills: ["daily-briefing", "inbox-triage", "meeting-prep", "work-handoff"],
        }),
        language: "th",
        avatar: "WM",
        isMain: true,
        createdAt: yesterday,
      },
      {
        id: "tm_exec",
        userId: DEFAULT_USER_ID,
        name: "Exec Chief",
        role: "Executive & Calendar",
        persona: JSON.stringify({
          tone: "Structured briefing & board prep",
          statusText: "Checking calendar",
          statusKind: "working",
          skills: ["calendar-guard", "board-deck-brief", "travel-ops"],
        }),
        language: "th",
        avatar: "EC",
        isMain: false,
        createdAt: yesterday,
      },
      {
        id: "tm_inbox",
        userId: DEFAULT_USER_ID,
        name: "Inbox Triage",
        role: "Email & Slack Operator",
        persona: JSON.stringify({
          tone: "Draft-first, zero noise",
          statusText: "Drafting 2 replies",
          statusKind: "drafting_file",
          skills: ["gmail-triage", "slack-digest", "vip-followup"],
        }),
        language: "th",
        avatar: "IT",
        isMain: false,
        createdAt: yesterday,
      },
      {
        id: "tm_ops",
        userId: DEFAULT_USER_ID,
        name: "Ops & Finance",
        role: "Invoice & KPI Auditor",
        persona: JSON.stringify({
          tone: "Tabular numbers, strict verification",
          statusText: "Idle · Ready",
          statusKind: "idle",
          skills: ["invoice-chaser", "expense-audit", "kpi-watch"],
        }),
        language: "th",
        avatar: "OF",
        isMain: false,
        createdAt: yesterday,
      },
      {
        id: "tm_research",
        userId: DEFAULT_USER_ID,
        name: "Research Scout",
        role: "Market & Competitor Recon",
        persona: JSON.stringify({
          tone: "Sourced citations, fact vs assumption",
          statusText: "Browsing web",
          statusKind: "browsing_web",
          skills: ["competitor-monitor", "regulatory-scan", "deep-synthesis"],
        }),
        language: "th",
        avatar: "RS",
        isMain: false,
        createdAt: yesterday,
      },
      {
        id: "tm_room_standup",
        userId: DEFAULT_USER_ID,
        name: "Executive Standup Room",
        role: "Group Room · 3 Bots",
        persona: JSON.stringify({
          isGroup: true,
          members: ["Woibot Main", "Exec Chief", "Ops & Finance"],
          statusText: "3 bots active",
          statusKind: "messaging",
        }),
        language: "th",
        avatar: "GR",
        isMain: false,
        createdAt: yesterday,
      },
    ],
    chatMessage: [
      {
        id: "msg_seed_1",
        teammateId: "tm_main",
        userId: DEFAULT_USER_ID,
        role: "user",
        content: "ช่วยเช็คอีเมลสำคัญเช้านี้ สรุปตารางประชุม แล้วถ้ามีงานสร้างระบบ CRM ที่ลูกค้าขอไว้ ส่งต่อให้ Work ทำต่อได้เลย",
        meta: JSON.stringify({ timestamp: "08:00" }),
        createdAt: twoHoursAgo,
      },
      {
        id: "msg_seed_2",
        teammateId: "tm_main",
        userId: DEFAULT_USER_ID,
        role: "assistant",
        content: "สรุป Briefing เช้านี้เรียบร้อยครับ — ตรวจพบ 3 อีเมลสำคัญ (ACME Corp ขอใบเสนอราคา + 2 ใบแจ้งหนี้รอตรวจ), เตรียมเอกสารประชุม 10:00 น. ให้แล้ว และร่างอีเมลตอบกลับคุณสมชายไว้ให้ตรวจด้านล่างครับ",
        meta: JSON.stringify({
          workedFor: "14s",
          steps: [
            { tool: "gmail.search", detail: "Queried is:unread label:VIP (3 threads found)" },
            { tool: "calendar.listEvents", detail: "Loaded 2 meetings for today (10:00 Sprint Review, 14:00 Partner Sync)" },
            { tool: "memory.recall", detail: "Matched preference: report_template + client_acme" },
            { tool: "draft.create", detail: "Prepared reply draft to somchai@acmecorp.co.th (Ask-first mode)" },
          ],
          cardType: "email-draft",
          emailDraft: {
            id: "draft_acme_01",
            to: "somchai@acmecorp.co.th",
            subject: "Re: ขอใบเสนอราคา Enterprise AI Workspace & CRM Q4",
            body: "เรียน คุณสมชาย,\n\nขอบคุณสำหรับรายละเอียดความต้องการครับ ทางทีมได้จัดเตรียมโครงสร้าง Enterprise CRM พร้อม Dashboard ยอดขายและใบเสนอราคาให้เรียบร้อยแล้ว โดยจะส่งมอบลิงก์ Preview พร้อมเอกสาร PDF ภายในวันนี้ก่อน 15:00 น. ครับ\n\nขอแสดงความนับถือ,\nTakin",
            sendMode: "ask_first",
            status: "pending",
          },
        }),
        createdAt: twoHoursAgo,
      },
      {
        id: "msg_seed_3",
        teammateId: "tm_main",
        userId: DEFAULT_USER_ID,
        role: "assistant",
        content: "สำหรับงานสร้างระบบ **Sales CRM Web App + Executive Dashboard** ผมแยกบริบทและสร้าง Handoff Packet ส่งต่อให้ **woibot Work (Code)** เรียบร้อยแล้ว เพื่อไม่ให้กระทบโควต้า Teammate ครับ",
        meta: JSON.stringify({
          handoff: true,
          cardType: "handoff-card",
          taskId: "tsk_crm_code",
          trace_id: "trace_crm_9821a",
          workKind: "coding",
          executionMode: "cloud",
          estimate: {
            kind: "coding",
            cost: 2.4,
            minutes: 18,
            label: "Coding Work — Next.js CRM + Prisma + Playwright Verification",
            tools: ["Node 22", "Next.js", "Prisma", "Playwright", "Cloud Sandbox :9222"],
          },
        }),
        createdAt: thirtyMinAgo,
      },
    ],
    memory: [
      {
        id: "mem_1",
        userId: DEFAULT_USER_ID,
        key: "communication_style",
        value: "สรุปสั้น ตรงประเด็น ตัดสินใจนำ (decision-first) ใช้ตัวเลข tabular-nums ไม่ใช้คำฟุ่มเฟือย",
        scope: "personal",
        source: "explicit",
        canDelete: true,
        createdAt: yesterday,
        updatedAt: yesterday,
      },
      {
        id: "mem_2",
        userId: DEFAULT_USER_ID,
        key: "report_format",
        value: "เอกสารและสไลด์ต้องมี Executive Summary หน้าแรก + ตารางเปรียบเทียบ + แหล่งอ้างอิงตรวจสอบได้",
        scope: "personal",
        source: "explicit",
        canDelete: true,
        createdAt: yesterday,
        updatedAt: yesterday,
      },
      {
        id: "mem_3",
        userId: DEFAULT_USER_ID,
        key: "client_acme_ SLA",
        value: "ACME Corp (คุณสมชาย ฝ่ายจัดซื้อ) ต้องส่งใบเสนอราคาทุกวันจันทร์ก่อน 15:00 น. ห้ามส่งอัตโนมัติโดยไม่อนุมัติ",
        scope: "team",
        source: "inferred",
        canDelete: true,
        createdAt: yesterday,
        updatedAt: yesterday,
      },
      {
        id: "mem_4",
        userId: DEFAULT_USER_ID,
        key: "privacy_guardrail",
        value: "ห้ามบันทึก API Key, รหัสผ่าน, หรือเลขบัตรลงใน Memory ให้เก็บใน Vault เท่านั้น",
        scope: "personal",
        source: "system",
        canDelete: false,
        createdAt: yesterday,
        updatedAt: yesterday,
      },
    ],
    task: [
      {
        id: "tsk_crm_code",
        userId: DEFAULT_USER_ID,
        title: "Enterprise Sales CRM + Executive Revenue Dashboard",
        goal: "สร้างระบบ CRM สำหรับทีมขาย มี Login, Pipeline Kanban, Customer Table, และกราฟคาดการณ์ยอดขาย พร้อมรัน Automated Tests",
        product: "work",
        workKind: "coding",
        origin: "teammate",
        status: "completed",
        executionMode: "cloud",
        traceId: "trace_crm_9821a",
        progress: 100,
        handoffPacket: JSON.stringify({
          goal: "สร้างระบบ CRM สำหรับทีมขาย มี Login, Pipeline Kanban, Customer Table, และกราฟคาดการณ์ยอดขาย",
          context: {
            chat_history: [{ role: "user", content: "ช่วยสร้างระบบ CRM สำหรับทีมขาย" }],
            memory_snippet: "Decision-first UI, tabular-nums, dark/light responsive",
            user_prefs: { language: "th", framework: "nextjs" },
          },
          attachments: [{ fileName: "acme-requirements.pdf", fileUrl: "/files/acme-requirements.pdf", mimeType: "application/pdf" }],
          deliverables: ["Runnable Next.js CRM App (.zip)", "Playwright E2E Verification Report", "Live Preview Endpoint"],
          constraints: { budget: 5.0, deadline: "วันนี้ 15:00" },
          verification_criteria: ["tsc --noEmit 0 errors", "vitest 14/14 passed", "Playwright login->pipeline smoke test passed"],
          execution_mode: "cloud",
          trace_id: "trace_crm_9821a",
        }),
        estimate: JSON.stringify({
          kind: "coding",
          estimatedCost: 2.4,
          actualCost: 2.15,
          estimatedMinutes: 18,
          approved: true,
          approvedAt: twoHoursAgo,
          tools: ["Node 22", "TypeScript", "Vitest", "Playwright", "Docker Container"],
        }),
        verification: JSON.stringify({
          taskId: "tsk_crm_code",
          type: "coding",
          passed: true,
          summary: "Coding verified — 5/5 automated gates passed (0 TS errors, 14/14 unit tests, Playwright E2E green)",
          createdAt: thirtyMinAgo,
          checks: [
            { name: "typecheck", passed: true, detail: "tsc --noEmit completed in 2.1s (0 errors)" },
            { name: "unit_tests", passed: true, detail: "vitest run: 14/14 passed (86.4% coverage)" },
            { name: "production_build", passed: true, detail: "next build: 9 routes compiled cleanly" },
            { name: "playwright_smoke", passed: true, detail: "Chromium headless: /login → /pipeline → deal create verified (1440px & 390px)", evidenceUrl: "/work/tsk_crm_code" },
            { name: "deliverable_bundle", passed: true, detail: "crm-enterprise-v1.zip (4.2 MB) verified openable with README & schema" },
          ],
        }),
        createdAt: twoHoursAgo,
        updatedAt: thirtyMinAgo,
      },
      {
        id: "tsk_video_promo",
        userId: DEFAULT_USER_ID,
        title: "Product Launch Promo — 30s Multi-Scene Video (3 Variants + TH/EN Subs)",
        goal: "ตัดต่อและสร้างวิดีโอเปิดตัวผลิตภัณฑ์ 30 วินาที 3 สไตล์ พร้อม Voiceover และ Subtitle ไทย/อังกฤษ (16:9, 9:16, 1:1)",
        product: "work",
        workKind: "video_gen",
        origin: "work",
        status: "reviewing",
        executionMode: "cloud",
        traceId: "trace_vid_4410b",
        progress: 88,
        handoffPacket: JSON.stringify({
          goal: "ทำคลิปโฆษณาเปิดตัว 30 วินาที 3 แบบ พร้อมซับไทย/อังกฤษ",
          context: { chat_history: [], memory_snippet: "Brand palette #0e0e10 + #2b66e0", user_prefs: {} },
          attachments: [{ fileName: "product-keynote.mp4", fileUrl: "/files/product-keynote.mp4", mimeType: "video/mp4" }],
          deliverables: ["3x MP4 Renders (16:9, 9:16, 1:1)", "SRT Bilingual Subtitles", "Remotion Editable Project Bundle"],
          constraints: { budget: 5.0 },
          verification_criteria: ["ffprobe 1080p 60fps h264/aac", "Audio LUFS -14dB normalized", "Subtitle sync drift < 20ms"],
          execution_mode: "cloud",
          trace_id: "trace_vid_4410b",
        }),
        estimate: JSON.stringify({
          kind: "video_gen",
          estimatedCost: 3.8,
          actualCost: 3.6,
          estimatedMinutes: 20,
          approved: true,
          approvedAt: twoHoursAgo,
          tools: ["FFmpeg", "Whisper-Large-v3", "Remotion", "Isolated GPU Pool"],
        }),
        verification: JSON.stringify({
          taskId: "tsk_video_promo",
          type: "video",
          passed: true,
          summary: "Video verified — 30.0s 1920×1080 & 1080×1920 H.264/AAC, TH+EN subs synced",
          createdAt: now,
          checks: [
            { name: "ffprobe_stream", passed: true, detail: "duration=30.00s, codec=h264/aac, 1920x1080 @ 60fps, bitrate=8.4Mbps" },
            { name: "audio_loudness", passed: true, detail: "Integrated loudness -14.1 LUFS, true peak -1.2 dBTP" },
            { name: "subtitle_sync", passed: true, detail: "TH + EN .srt tracks aligned (0ms drift across 6 scenes)" },
            { name: "editable_project", passed: true, detail: "remotion-launch-project.zip included for timeline re-edits" },
          ],
        }),
        createdAt: twoHoursAgo,
        updatedAt: now,
      },
      {
        id: "tsk_doc_q4",
        userId: DEFAULT_USER_ID,
        title: "Q4 Board Strategy Report & Financial Model (14 Pages + PPTX Deck)",
        goal: "วิเคราะห์ตัวเลขยอดขาย Q3-Q4 สร้างรายงานผู้บริหาร 14 หน้า (DOCX/PDF) พร้อมสไลด์นำเสนอ 10 หน้า (PPTX)",
        product: "work",
        workKind: "doc",
        origin: "teammate",
        status: "waiting_for_user",
        executionMode: "cloud",
        traceId: "trace_doc_7732c",
        progress: 35,
        handoffPacket: JSON.stringify({
          goal: "สร้างรายงานผู้บริหาร Q4 พร้อม Financial Forecast และสไลด์นำเสนอบอร์ด",
          context: { chat_history: [], memory_snippet: "Executive Summary + Tables + Sourced citations", user_prefs: {} },
          attachments: [{ fileName: "q3-actuals.xlsx", fileUrl: "/files/q3-actuals.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }],
          deliverables: ["Q4_Board_Report.docx", "Q4_Board_Report.pdf", "Q4_Executive_Deck.pptx"],
          constraints: { budget: 5.0 },
          verification_criteria: ["LibreOffice page & font layout check", "Table sum reconciliation", "Editable styles preserved"],
          execution_mode: "cloud",
          trace_id: "trace_doc_7732c",
        }),
        estimate: JSON.stringify({
          kind: "doc",
          estimatedCost: 1.15,
          estimatedMinutes: 10,
          approved: false,
          tools: ["LibreOffice Headless", "python-docx", "python-pptx", "Chart SVG Renderer"],
        }),
        verification: null,
        createdAt: thirtyMinAgo,
        updatedAt: now,
      },
      {
        id: "tsk_local_repo",
        userId: DEFAULT_USER_ID,
        title: "Local Repository Security & Dependency Audit (Local Daemon)",
        goal: "ตรวจสอบช่องโหว่และอัปเกรดแพ็กเกจใน Local Repository บนเครื่องโดยไม่ส่งซอร์สโค้ดขึ้นคลาวด์",
        product: "work",
        workKind: "coding",
        origin: "work",
        status: "in_progress",
        executionMode: "local",
        traceId: "trace_loc_1190d",
        progress: 65,
        handoffPacket: JSON.stringify({
          goal: "Audit local repo dependencies & patch CVEs locally",
          context: { chat_history: [], memory_snippet: "", user_prefs: {} },
          attachments: [],
          deliverables: ["security-audit-report.json", "Local git patch diff"],
          constraints: { must_not_leak: ["src/**", ".env*"] },
          verification_criteria: ["pnpm audit 0 high/critical", "All local tests green"],
          execution_mode: "local",
          trace_id: "trace_loc_1190d",
        }),
        estimate: JSON.stringify({
          kind: "coding",
          estimatedCost: 0.65,
          estimatedMinutes: 6,
          approved: true,
          approvedAt: thirtyMinAgo,
          tools: ["woibot-local daemon", "Local Git", "pnpm audit"],
        }),
        verification: null,
        createdAt: thirtyMinAgo,
        updatedAt: now,
      },
      {
        id: "tsk_tm_briefing",
        userId: DEFAULT_USER_ID,
        title: "Morning VIP Email Triage & Calendar Prep (08:00 Routine)",
        goal: "สรุปอีเมลสำคัญ 3 ฉบับ + เตรียมวาระประชุม Sprint Review 10:00",
        product: "teammate",
        workKind: null,
        origin: "teammate",
        status: "completed",
        executionMode: "cloud",
        traceId: "trace_tm_0800a",
        progress: 100,
        handoffPacket: null,
        estimate: null,
        verification: JSON.stringify({
          taskId: "tsk_tm_briefing",
          type: "research",
          passed: true,
          summary: "Teammate routine completed — 3 VIP emails summarized, 1 draft ready for approval",
          createdAt: twoHoursAgo,
          checks: [{ name: "connected_apps_sync", passed: true, detail: "Gmail + Google Calendar synced" }],
        }),
        createdAt: twoHoursAgo,
        updatedAt: twoHoursAgo,
      },
    ],
    deliverable: [
      {
        id: "del_crm_zip",
        taskId: "tsk_crm_code",
        kind: "code",
        fileName: "crm-enterprise-v1.zip",
        fileUrl: "/api/artifacts?download=del_crm_zip",
        mimeType: "application/zip",
        size: 4404019,
        editable: true,
        createdAt: thirtyMinAgo,
      },
      {
        id: "del_crm_report",
        taskId: "tsk_crm_code",
        kind: "doc",
        fileName: "verification_report.json",
        fileUrl: "/api/artifacts?download=del_crm_report",
        mimeType: "application/json",
        size: 3840,
        editable: false,
        createdAt: thirtyMinAgo,
      },
      {
        id: "del_vid_169",
        taskId: "tsk_video_promo",
        kind: "video",
        fileName: "woibot-launch-16x9-1080p.mp4",
        fileUrl: "/api/artifacts?download=del_vid_169",
        mimeType: "video/mp4",
        size: 14890200,
        editable: false,
        createdAt: now,
      },
      {
        id: "del_vid_916",
        taskId: "tsk_video_promo",
        kind: "video",
        fileName: "woibot-launch-9x16-tiktok.mp4",
        fileUrl: "/api/artifacts?download=del_vid_916",
        mimeType: "video/mp4",
        size: 12100400,
        editable: false,
        createdAt: now,
      },
      {
        id: "del_vid_proj",
        taskId: "tsk_video_promo",
        kind: "code",
        fileName: "remotion-launch-bundle.zip",
        fileUrl: "/api/artifacts?download=del_vid_proj",
        mimeType: "application/zip",
        size: 6291456,
        editable: true,
        createdAt: now,
      },
    ],
    file: [
      {
        id: "fil_1",
        userId: DEFAULT_USER_ID,
        name: "crm-enterprise-v1.zip",
        path: "/Deliverables/Code/crm-enterprise-v1.zip",
        mimeType: "application/zip",
        size: 4404019,
        taskId: "tsk_crm_code",
        createdAt: thirtyMinAgo,
      },
      {
        id: "fil_2",
        userId: DEFAULT_USER_ID,
        name: "Q4_Board_Strategy_Report.docx",
        path: "/Deliverables/Docs/Q4_Board_Strategy_Report.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 1845200,
        taskId: "tsk_doc_q4",
        createdAt: thirtyMinAgo,
      },
      {
        id: "fil_3",
        userId: DEFAULT_USER_ID,
        name: "Q4_Executive_Deck.pptx",
        path: "/Deliverables/Slides/Q4_Executive_Deck.pptx",
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        size: 3920100,
        taskId: "tsk_doc_q4",
        createdAt: thirtyMinAgo,
      },
      {
        id: "fil_4",
        userId: DEFAULT_USER_ID,
        name: "woibot-launch-16x9-1080p.mp4",
        path: "/Deliverables/Video/woibot-launch-16x9-1080p.mp4",
        mimeType: "video/mp4",
        size: 14890200,
        taskId: "tsk_video_promo",
        createdAt: now,
      },
      {
        id: "fil_5",
        userId: DEFAULT_USER_ID,
        name: "ACME_Master_Service_Agreement_Redline.pdf",
        path: "/CloudDrive/Legal/ACME_Master_Service_Agreement_Redline.pdf",
        mimeType: "application/pdf",
        size: 982400,
        taskId: null,
        createdAt: yesterday,
      },
      {
        id: "fil_6",
        userId: DEFAULT_USER_ID,
        name: "Revenue_Cohort_Model_2026.xlsx",
        path: "/CloudDrive/Finance/Revenue_Cohort_Model_2026.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 742100,
        taskId: null,
        createdAt: yesterday,
      },
    ],
    artifact: [
      {
        id: "art_doc_1",
        userId: DEFAULT_USER_ID,
        title: "Q4 Executive Strategy & Unit Economics Report",
        tab: "docs",
        subKind: "DOCX / PDF · 14 Pages",
        origin: "work",
        versions: 3,
        currentVersion: 3,
        status: "verified",
        accentColor: "#2b66e0",
        updatedAt: thirtyMinAgo,
        summary: "รายงานวิเคราะห์โครงสร้างรายได้และ Unit Economics แยก Teammate Subscription กับ Work Meter พร้อมตารางคาดการณ์ 12 เดือน",
        content: "# Q4 Executive Strategy & Unit Economics\n\n## 1. Executive Summary\nการแยกบัญชีต้นทุนระหว่าง **Teammate (Subscription)** และ **Work (Metered Execution)** ทำให้ Gross Margin ของแพลตฟอร์มเพิ่มขึ้นเป็น **74.8%** โดยไม่กระทบประสบการณ์ใช้งานรายวันของลูกค้า\n\n## 2. Financial Highlights (Tabular KPI)\n- **Active Teammate Retention (D30):** 84.2%\n- **Verified Completed Tasks / User:** 18.6 งาน/เดือน\n- **Handoff Success Rate (Teammate → Work):** 96.4%\n- **Average Cost per Accepted Task:** $0.82\n\n## 3. Risk & Compliance Notes\nทุกงานในหมวด Coding, Documents และ Video ต้องมี `verification_report.json` แนบก่อนเปลี่ยนสถานะเป็น Completed",
      },
      {
        id: "art_slides_1",
        userId: DEFAULT_USER_ID,
        title: "Board Deck: AI Personal Teammate & Workforce Architecture",
        tab: "slides",
        subKind: "PPTX · 10 Slides (16:9)",
        origin: "work",
        versions: 2,
        currentVersion: 2,
        status: "verified",
        accentColor: "#3b82f6",
        updatedAt: twoHoursAgo,
        summary: "สไลด์นำเสนอบอร์ดบริหาร 10 หน้า: โครงสร้างผลิตภัณฑ์คู่ Teammate + Work, ระบบแยกต้นทุน และผลการทดสอบ E2E",
        content: "Slide 1: woibot — Talk to your Teammate. Let Work handle the heavy lifting.\nSlide 2: Why Two Connected Products (Daily Retention vs Verifiable Heavy Execution)\nSlide 3: Seamless Handoff Packet Architecture (Zero Copy-Paste)\nSlide 4: Cost Isolation & GPU Pool Separation\nSlide 5: Verification Pipeline per Deliverable Type",
      },
      {
        id: "art_design_1",
        userId: DEFAULT_USER_ID,
        title: "Enterprise CRM Design System & Interactive Prototype",
        tab: "design",
        subKind: "UI System · Desktop + 390px Mobile",
        origin: "work",
        versions: 4,
        currentVersion: 4,
        status: "verified",
        accentColor: "#10b981",
        updatedAt: now,
        summary: "ระบบออกแบบ UI ความหนาแน่นสูง (Linear/Stripe density) รองรับทั้ง Dark/Light และตรวจสอบการแสดงผลที่ 1440px / 390px",
        content: "Design Tokens: #0e0e10 canvas, #121316 sidebar, #18191c surface, #2b66e0 primary CTA, Inter + Noto Sans Thai, tabular-nums",
      },
      {
        id: "art_dash_1",
        userId: DEFAULT_USER_ID,
        title: "Live Cohort & Work Cost-per-Task Telemetry Dashboard",
        tab: "dashboard",
        subKind: "Interactive BI · SQL + SVG Charts",
        origin: "teammate",
        versions: 2,
        currentVersion: 2,
        status: "verified",
        accentColor: "#8b5cf6",
        updatedAt: yesterday,
        summary: "แดชบอร์ดติดตาม Verified Completed Tasks, First-Pass Acceptance Rate และต้นทุนแยกตามหมวดงานแบบเรียลไทม์",
        content: "KPIs: Verified Tasks = 1,420 | First-Pass Acceptance = 91.8% | Avg Time to Deliverable = 11m 20s",
      },
      {
        id: "art_3d_1",
        userId: DEFAULT_USER_ID,
        title: "Hardware Security Key & Smart Hub — PBR 3D Product Stage",
        tab: "3d",
        subKind: "GLB / PBR Mesh · 4K Studio Lighting",
        origin: "work",
        versions: 2,
        currentVersion: 2,
        status: "verified",
        accentColor: "#f59e0b",
        updatedAt: yesterday,
        summary: "โมเดล 3D พร้อมพื้นผิว PBR, จัดแสง HDRI Studio และเงาสะท้อน สำหรับใช้ในหน้าเปิดตัวผลิตภัณฑ์และวิดีโอโฆษณา",
        content: "Mesh: 48,200 tris | Albedo + Roughness + Metallic + Normal 2048x2048 | Interactive Orbit Camera",
      },
    ],
    subscription: [
      {
        id: "sub_main",
        userId: DEFAULT_USER_ID,
        plan: "pro",
        status: "active",
        periodStart: yesterday,
        periodEnd: new Date(Date.now() + 29 * 86400_000).toISOString(),
        allowance: JSON.stringify({ tokens: 10_000_000, cloudHours: 720, routines: 100 }),
        createdAt: yesterday,
      },
    ],
    workQuota: [
      {
        id: "wq_main",
        userId: DEFAULT_USER_ID,
        monthlyCap: 50.0,
        perTaskCap: 5.0,
        monthlyUsed: 5.75,
        alertThreshold: 0.8,
        updatedAt: now,
      },
    ],
    usageEvent: [
      {
        id: "ue_1",
        userId: DEFAULT_USER_ID,
        product: "teammate",
        kind: "chat",
        taskId: "tsk_tm_briefing",
        tokens: 18400,
        gpuSeconds: 0,
        storageMb: 2.4,
        cost: 0.0,
        meta: JSON.stringify({ note: "Included in Teammate Pro Subscription" }),
        createdAt: twoHoursAgo,
      },
      {
        id: "ue_2",
        userId: DEFAULT_USER_ID,
        product: "work",
        kind: "coding",
        taskId: "tsk_crm_code",
        tokens: 64200,
        gpuSeconds: 0,
        storageMb: 18.5,
        cost: 2.15,
        meta: JSON.stringify({ title: "Enterprise Sales CRM + Playwright E2E" }),
        createdAt: thirtyMinAgo,
      },
      {
        id: "ue_3",
        userId: DEFAULT_USER_ID,
        product: "work",
        kind: "video_gen",
        taskId: "tsk_video_promo",
        tokens: 12800,
        gpuSeconds: 145,
        storageMb: 42.0,
        cost: 3.6,
        meta: JSON.stringify({ title: "30s Launch Video (3 Aspect Ratios + Subs)" }),
        createdAt: now,
      },
    ],
    connectedApp: [
      {
        id: "app_gmail",
        userId: DEFAULT_USER_ID,
        provider: "gmail",
        status: "connected",
        scopes: JSON.stringify(["read", "draft", "send_with_approval"]),
        account: "takin@woxacorp.com",
        createdAt: yesterday,
      },
      {
        id: "app_calendar",
        userId: DEFAULT_USER_ID,
        provider: "calendar",
        status: "connected",
        scopes: JSON.stringify(["read", "write"]),
        account: "takin@woxacorp.com",
        createdAt: yesterday,
      },
      {
        id: "app_slack",
        userId: DEFAULT_USER_ID,
        provider: "slack",
        status: "connected",
        scopes: JSON.stringify(["channels:read", "chat:write", "mentions:listen"]),
        account: "woibot-hq.slack.com",
        createdAt: yesterday,
      },
      {
        id: "app_github",
        userId: DEFAULT_USER_ID,
        provider: "github",
        status: "connected",
        scopes: JSON.stringify(["repo", "pull_requests", "actions:read"]),
        account: "github.com/Tor2539",
        createdAt: yesterday,
      },
      {
        id: "app_drive",
        userId: DEFAULT_USER_ID,
        provider: "drive",
        status: "connected",
        scopes: JSON.stringify(["drive.readonly", "drive.file"]),
        account: "takin@woxacorp.com",
        createdAt: yesterday,
      },
      {
        id: "app_notion",
        userId: DEFAULT_USER_ID,
        provider: "notion",
        status: "connected",
        scopes: JSON.stringify(["pages:read", "databases:write"]),
        account: "Woibot Product Wiki",
        createdAt: yesterday,
      },
      {
        id: "app_linear",
        userId: DEFAULT_USER_ID,
        provider: "linear",
        status: "connected",
        scopes: JSON.stringify(["issues:read", "issues:write", "cycles:read"]),
        account: "WOIBOT-ENG",
        createdAt: yesterday,
      },
      {
        id: "app_1password",
        userId: DEFAULT_USER_ID,
        provider: "onepassword",
        status: "connected",
        scopes: JSON.stringify(["vault:woibot-service-account (autofill-only)"]),
        account: "1Password Service Vault",
        createdAt: yesterday,
      },
    ],
    routine: [
      {
        id: "rt_morning_brief",
        userId: DEFAULT_USER_ID,
        title: "08:00 Daily Executive Briefing & VIP Inbox Triage",
        trigger: JSON.stringify({ type: "cron", expr: "0 8 * * 1-5", timezone: "Asia/Bangkok", kindLabel: "Weekdays at 08:00" }),
        action: JSON.stringify({ botId: "tm_main", template: "ตรวจ Gmail (VIP), สรุปตารางประชุมวันนี้ และแจ้งเตือนงานที่ค้างเกิน 24 ชม.", spendGuard: true }),
        status: "active",
        lastRun: twoHoursAgo,
        nextRun: new Date(Date.now() + 18 * 3600_000).toISOString(),
        runCount: 42,
        failCount: 0,
        lastResult: JSON.stringify({ ok: true, summary: "3 VIP emails triaged, 2 meetings prepped, $0.008" }),
        createdAt: yesterday,
      },
      {
        id: "rt_invoice_watch",
        userId: DEFAULT_USER_ID,
        title: "Incoming Invoice Extractor & Approval Queue",
        trigger: JSON.stringify({ type: "email_inbox", expr: "invoices@woibot.com", kindLabel: "When email arrives at invoices@woibot.com" }),
        action: JSON.stringify({ botId: "tm_ops", template: "สกัดยอดเงิน วันครบกำหนด และตรวจกับ PO ก่อนส่งขออนุมัติ", spendGuard: true }),
        status: "active",
        lastRun: yesterday,
        nextRun: new Date(Date.now() + 3600_000).toISOString(),
        runCount: 19,
        failCount: 0,
        lastResult: JSON.stringify({ ok: true, summary: "Verified AWS & Cloudflare invoices, queued for approval" }),
        createdAt: yesterday,
      },
      {
        id: "rt_github_pr",
        userId: DEFAULT_USER_ID,
        title: "GitHub PR Review & Verification Gate",
        trigger: JSON.stringify({ type: "github_event", expr: "pull_request.opened | synchronize", kindLabel: "On GitHub PR opened/pushed" }),
        action: JSON.stringify({ botId: "tm_research", template: "ส่งให้ Work รัน tsc + tests + security diff review", spendGuard: true }),
        status: "active",
        lastRun: thirtyMinAgo,
        nextRun: new Date(Date.now() + 7200_000).toISOString(),
        runCount: 27,
        failCount: 1,
        lastResult: JSON.stringify({ ok: true, summary: "PR #14 verified: all 23 routes compiled" }),
        createdAt: yesterday,
      },
      {
        id: "rt_competitor_weekly",
        userId: DEFAULT_USER_ID,
        title: "Friday Competitor & Market Pricing Digest",
        trigger: JSON.stringify({ type: "cron", expr: "0 16 * * 5", timezone: "Asia/Bangkok", kindLabel: "Every Friday at 16:00" }),
        action: JSON.stringify({ botId: "tm_research", template: "ตรวจสอบการเปลี่ยนราคาและฟีเจอร์ของคู่แข่ง สรุปเป็นตารางส่งเข้าห้อง Standup", spendGuard: true }),
        status: "paused",
        lastRun: yesterday,
        nextRun: null,
        runCount: 8,
        failCount: 0,
        lastResult: JSON.stringify({ ok: true, summary: "Paused by Spend Guard while away — click Resume to re-enable" }),
        createdAt: yesterday,
      },
    ],
    vaultSecret: [
      {
        id: "sec_1",
        userId: DEFAULT_USER_ID,
        name: "PROD_SUPABASE_SERVICE_KEY",
        hostAllowlist: "*.supabase.co",
        scope: "work_container_only",
        maskedValue: "eyJhbGciOiJIUzI1NiIs•••••••9x2Q",
        updatedAt: yesterday,
      },
      {
        id: "sec_2",
        userId: DEFAULT_USER_ID,
        name: "ACME_VENDOR_PORTAL_LOGIN",
        hostAllowlist: "portal.acmecorp.co.th",
        scope: "browser_autofill_only",
        maskedValue: "takin@woxacorp.com / ••••••••••",
        updatedAt: yesterday,
      },
    ],
  };
}

const g = globalThis as unknown as { __woibotRuntimeData?: WoibotRuntimeData };

function getStorePath(): string {
  const tmpDir = process.env.TMPDIR || "/tmp";
  return path.join(tmpDir, "woibot-runtime-v2.json");
}

export function getRuntimeData(): WoibotRuntimeData {
  if (g.__woibotRuntimeData) return g.__woibotRuntimeData;
  const p = getStorePath();
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf8");
      const parsed = JSON.parse(raw) as WoibotRuntimeData;
      if (parsed && Array.isArray(parsed.user) && parsed.user.length > 0) {
        g.__woibotRuntimeData = parsed;
        return parsed;
      }
    }
  } catch {
    // fallback to in-memory seed
  }
  const seeded = createInitialSeed();
  g.__woibotRuntimeData = seeded;
  saveRuntimeData(seeded);
  return seeded;
}

export function saveRuntimeData(data?: WoibotRuntimeData) {
  const target = data || g.__woibotRuntimeData;
  if (!target) return;
  try {
    fs.writeFileSync(getStorePath(), JSON.stringify(target), "utf8");
  } catch {
    // ignore read-only fs errors; globalThis keeps state in memory
  }
}

function matchesWhere(item: Record<string, any>, where?: Record<string, any>): boolean {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined) continue;
    if (k === "OR" && Array.isArray(v)) {
      if (!v.some((sub) => matchesWhere(item, sub))) return false;
      continue;
    }
    if (k === "AND" && Array.isArray(v)) {
      if (!v.every((sub) => matchesWhere(item, sub))) return false;
      continue;
    }
    // compound unique key like userId_key_scope
    if (k === "userId_key_scope" && v && typeof v === "object") {
      if (item.userId !== v.userId || item.key !== v.key || item.scope !== v.scope) return false;
      continue;
    }
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      if ("contains" in v) {
        const hay = String(item[k] ?? "").toLowerCase();
        const needle = String(v.contains ?? "").toLowerCase();
        if (!hay.includes(needle)) return false;
        continue;
      }
      if ("gte" in v) {
        const itemTime = new Date(item[k]).getTime();
        const targetTime = v.gte instanceof Date ? v.gte.getTime() : new Date(v.gte).getTime();
        if (itemTime < targetTime) return false;
        continue;
      }
      if ("in" in v && Array.isArray(v.in)) {
        if (!v.in.includes(item[k])) return false;
        continue;
      }
    }
    if (item[k] !== v) return false;
  }
  return true;
}

function applyInclude(table: keyof WoibotRuntimeData, item: Record<string, any>, include?: Record<string, any>, store?: WoibotRuntimeData) {
  if (!include || !store) return { ...item };
  const clone: Record<string, any> = { ...item };
  if (table === "task") {
    if (include.deliverables) {
      clone.deliverables = store.deliverable.filter((d) => d.taskId === item.id);
    }
    if (include.files) {
      clone.files = store.file.filter((f) => f.taskId === item.id);
    }
  }
  if (table === "teammate" && include.messages) {
    clone.messages = store.chatMessage.filter((m) => m.teammateId === item.id);
  }
  return clone;
}

function applyMutationData(existing: StoreRecord, data: Record<string, any>): StoreRecord {
  const updated: StoreRecord = { ...existing };
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === "object" && "increment" in v) {
      updated[k] = Number(updated[k] ?? 0) + Number(v.increment ?? 0);
    } else if (v instanceof Date) {
      updated[k] = v.toISOString();
    } else {
      updated[k] = v;
    }
  }
  updated.updatedAt = new Date().toISOString();
  return updated;
}

function createCollectionDelegate(table: keyof WoibotRuntimeData, prefix: string) {
  return {
    async findUnique(args?: { where?: Record<string, any>; include?: Record<string, any>; select?: Record<string, any> }) {
      const store = getRuntimeData();
      const found = store[table].find((row) => matchesWhere(row, args?.where));
      if (!found) return null;
      return applyInclude(table, found, args?.include, store);
    },
    async findFirst(args?: { where?: Record<string, any>; orderBy?: Record<string, any>; include?: Record<string, any> }) {
      const rows = await this.findMany(args);
      return rows[0] ?? null;
    },
    async findMany(args?: { where?: Record<string, any>; orderBy?: Record<string, any>; take?: number; skip?: number; include?: Record<string, any>; select?: Record<string, any> }) {
      const store = getRuntimeData();
      let list = store[table].filter((row) => matchesWhere(row, args?.where));
      if (args?.orderBy) {
        const [field, dir] = Object.entries(args.orderBy)[0] || [];
        if (field) {
          list = [...list].sort((a, b) => {
            const av = a[field] ?? "";
            const bv = b[field] ?? "";
            if (av < bv) return dir === "desc" ? 1 : -1;
            if (av > bv) return dir === "desc" ? -1 : 1;
            return 0;
          });
        }
      }
      if (typeof args?.skip === "number" && args.skip > 0) {
        list = list.slice(args.skip);
      }
      if (typeof args?.take === "number" && args.take > 0) {
        list = list.slice(0, args.take);
      }
      return list.map((row) => applyInclude(table, row, args?.include, store));
    },
    async count(args?: { where?: Record<string, any> }) {
      const store = getRuntimeData();
      return store[table].filter((row) => matchesWhere(row, args?.where)).length;
    },
    async create(args: { data: Record<string, any>; include?: Record<string, any> }) {
      const store = getRuntimeData();
      const now = new Date().toISOString();
      const rawData = { ...args.data };
      for (const [k, v] of Object.entries(rawData)) {
        if (v instanceof Date) rawData[k] = v.toISOString();
      }
      const record: StoreRecord = {
        id: rawData.id || uid(prefix),
        createdAt: rawData.createdAt || now,
        updatedAt: rawData.updatedAt || now,
        ...rawData,
      };
      store[table].unshift(record);
      saveRuntimeData(store);
      return applyInclude(table, record, args.include, store);
    },
    async update(args: { where: Record<string, any>; data: Record<string, any>; include?: Record<string, any> }) {
      const store = getRuntimeData();
      const idx = store[table].findIndex((row) => matchesWhere(row, args.where));
      if (idx === -1) throw new Error(`${String(table)} record not found`);
      store[table][idx] = applyMutationData(store[table][idx], args.data);
      saveRuntimeData(store);
      return applyInclude(table, store[table][idx], args.include, store);
    },
    async updateMany(args: { where?: Record<string, any>; data: Record<string, any> }) {
      const store = getRuntimeData();
      let count = 0;
      store[table] = store[table].map((row) => {
        if (matchesWhere(row, args.where)) {
          count++;
          return applyMutationData(row, args.data);
        }
        return row;
      });
      saveRuntimeData(store);
      return { count };
    },
    async upsert(args: { where: Record<string, any>; update: Record<string, any>; create: Record<string, any> }) {
      const store = getRuntimeData();
      const idx = store[table].findIndex((row) => matchesWhere(row, args.where));
      if (idx !== -1) {
        store[table][idx] = applyMutationData(store[table][idx], args.update);
        saveRuntimeData(store);
        return store[table][idx];
      }
      return this.create({ data: args.create });
    },
    async delete(args: { where: Record<string, any> }) {
      const store = getRuntimeData();
      const idx = store[table].findIndex((row) => matchesWhere(row, args.where));
      if (idx === -1) return null;
      const [removed] = store[table].splice(idx, 1);
      saveRuntimeData(store);
      return removed;
    },
  };
}

/**
 * Durable store selection:
 *  - Postgres (DATABASE_URL / PGHOST) -> real, shared, survives restarts
 *  - otherwise -> JSON file store (local dev only)
 */
const pgClient = pgEnabled() ? createPgClient() : null;

export const prisma: any = pgClient
  ? pgClient
  : {
      user: createCollectionDelegate("user", "usr"),
      teammate: createCollectionDelegate("teammate", "tm"),
      chatMessage: createCollectionDelegate("chatMessage", "msg"),
      memory: createCollectionDelegate("memory", "mem"),
      task: createCollectionDelegate("task", "tsk"),
      deliverable: createCollectionDelegate("deliverable", "del"),
      file: createCollectionDelegate("file", "fil"),
      subscription: createCollectionDelegate("subscription", "sub"),
      workQuota: createCollectionDelegate("workQuota", "wq"),
      usageEvent: createCollectionDelegate("usageEvent", "ue"),
      connectedApp: createCollectionDelegate("connectedApp", "app"),
      routine: createCollectionDelegate("routine", "rt"),
      artifact: createCollectionDelegate("artifact", "art"),
      vaultSecret: createCollectionDelegate("vaultSecret", "sec"),
    };

export { pgEnabled, ensureSchema, audit };
