import type { WorkKind, ExecutionMode } from "./templates";
import type { WorkEstimate } from "./estimates";
import { TASK_STATUSES } from "./templates";

export type WorkProject = {
  id: string;
  title: string;
  goal: string;
  kind: WorkKind;
  status: typeof TASK_STATUSES[number]["id"];
  executionMode: ExecutionMode;
  progress: number;
  estimate: WorkEstimate & { actualCost?: number };
  createdAt: string;
  updatedAt: string;
  traceId: string;
};

export type ProjectFile = { path: string; lang?: string; size?: string; status?: "new" | "modified" | "unchanged" };
export type ProjectStep = { id: string; title: string; titleTh: string; status: "done" | "active" | "pending" | "error"; log?: string };

function uid() { return Math.random().toString(36).slice(2, 8); }

export function mockProjects(): WorkProject[] {
  const now = new Date();
  const ago = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString();
  return [
    {
      id: "w_" + uid(), title: "CRM สำหรับทีมขาย — Login + Dashboard + Reports", goal: "สร้างระบบ CRM สำหรับทีมขายของฉัน มี Login, Dashboard, Customer Management และรายงานยอดขาย ทำให้ใช้งานได้จริง", kind: "coding", status: "in_progress", executionMode: "cloud", progress: 62, traceId: "tr_" + uid(),
      estimate: { kind: "coding", cost: 2.4, minutes: 18, label: "Coding — build + tests + preview", tools: ["Cloud container", "Next.js runtime", "Vitest"], executionMode: "cloud", approved: true, breakdown: [{ item: "LLM", cost: 1.6 }, { item: "Exec", cost: 0.5 }, { item: "Storage", cost: 0.3 }], actualCost: 1.1 },
      createdAt: ago(5), updatedAt: ago(0.2),
    },
    {
      id: "w_" + uid(), title: "Proposal 15 หน้า — วิเคราะห์ตลาด Q1", goal: "ทำ Proposal บริษัท 15 หน้า: วิเคราะห์ตลาด + แผนการเงิน", kind: "doc", status: "reviewing", executionMode: "cloud", progress: 90, traceId: "tr_" + uid(),
      estimate: { kind: "doc", cost: 1.04, minutes: 10, label: "Document — 12 pages + charts", tools: ["Doc engine", "Charts"], executionMode: "cloud", approved: true, breakdown: [{ item: "LLM", cost: 0.55 }, { item: "Render", cost: 0.15 }], actualCost: 0.9 },
      createdAt: ago(20), updatedAt: ago(1),
    },
    {
      id: "w_" + uid(), title: "คลิปโฆษณา 30 วินาที ×3 จากภาพสินค้า", goal: "ทำคลิปโฆษณาสินค้า 30 วินาที 3 แบบ จากภาพและรายละเอียดสินค้าที่ฉันให้", kind: "video_gen", status: "queued", executionMode: "cloud", progress: 0, traceId: "tr_" + uid(),
      estimate: { kind: "video_gen", cost: 8.5, minutes: 25, label: "Video Gen — 30s × 3 (GPU)", tools: ["GPU pool", "ComfyUI"], executionMode: "cloud", approved: false, breakdown: [{ item: "GPU", cost: 6.0 }, { item: "Voiceover", cost: 1.0 }] },
      createdAt: ago(2), updatedAt: ago(2),
    },
    {
      id: "w_" + uid(), title: "สัมภาษณ์ 60 นาที → 5 คลิป TikTok + subs", goal: "นำวิดีโอสัมภาษณ์ความยาว 60 นาทีนี้มาทำคลิป TikTok 5 คลิป พร้อม Subtitle ไทย/อังกฤษ", kind: "video_analysis", status: "completed", executionMode: "local", progress: 100, traceId: "tr_" + uid(),
      estimate: { kind: "video_analysis", cost: 2.1, minutes: 15, label: "Video Analysis — 60 min → 5 clips", tools: ["FFmpeg", "Whisper"], executionMode: "local", approved: true, breakdown: [{ item: "Whisper", cost: 1.0 }], actualCost: 2.05 },
      createdAt: ago(48), updatedAt: ago(3),
    },
    {
      id: "w_" + uid(), title: "วิเคราะห์คู่แข่ง CRM 5 ราย — ตารางเปรียบเทียบ", goal: "วิเคราะห์คู่แข่ง 5 ราย ในตลาด CRM ไทย พร้อมตารางเปรียบเทียบและข้อเสนอแนะ", kind: "research", status: "completed", executionMode: "cloud", progress: 100, traceId: "tr_" + uid(),
      estimate: { kind: "research", cost: 1.2, minutes: 12, label: "Research — multi-source", tools: ["Web search", "RAG"], executionMode: "cloud", approved: true, breakdown: [{ item: "Search", cost: 0.4 }], actualCost: 1.18 },
      createdAt: ago(72), updatedAt: ago(10),
    },
    {
      id: "w_" + uid(), title: "ยอดขาย CSV → forecast + dashboard", goal: "วิเคราะห์ไฟล์ยอดขาย CSV: เทรนด์ + forecast 6 เดือน + dashboard", kind: "data", status: "paused", executionMode: "local", progress: 35, traceId: "tr_" + uid(),
      estimate: { kind: "data", cost: 1.05, minutes: 14, label: "Data & BI", tools: ["Python sandbox"], executionMode: "local", approved: true, breakdown: [{ item: "LLM+Python", cost: 0.9 }], actualCost: 0.4 },
      createdAt: ago(10), updatedAt: ago(6),
    },
  ];
}

export function mockSteps(kind: WorkKind): ProjectStep[] {
  const map: Record<string, ProjectStep[]> = {
    coding: [
      { id: "plan", title: "Planning", titleTh: "วางแผน", status: "done", log: "Requirements → architecture + routes + schema decided" },
      { id: "scaffold", title: "Scaffolding", titleTh: "สร้างโครง", status: "done", log: "Next.js 15 + Prisma + auth + layout" },
      { id: "build", title: "Building", titleTh: "พัฒนา", status: "active", log: "Implementing Dashboard + Customer CRUD (3/5 modules)" },
      { id: "test", title: "Testing", titleTh: "ทดสอบ", status: "pending" },
      { id: "verify", title: "Verification", titleTh: "ตรวจสอบ", status: "pending" },
      { id: "deliver", title: "Delivery", titleTh: "ส่งมอบ", status: "pending" },
    ],
    doc: [
      { id: "ingest", title: "Ingest files", titleTh: "อ่านไฟล์", status: "done", log: "3 sources ingested, 12 pages outlined" },
      { id: "draft", title: "Drafting", titleTh: "ร่างเนื้อหา", status: "done" },
      { id: "design", title: "Layout & Charts", titleTh: "จัดหน้า/กราฟ", status: "active", log: "Charts 2/3 rendered, TOC linked" },
      { id: "verify", title: "File verification", titleTh: "ตรวจสอบไฟล์", status: "pending" },
    ],
    video_gen: [
      { id: "concept", title: "Concept & Script", titleTh: "แนวคิด/บท", status: "done" },
      { id: "storyboard", title: "Storyboard", titleTh: "สตอรี่บอร์ด", status: "active", log: "Scene 2/3 approved" },
      { id: "generate", title: "Generation", titleTh: "สร้างภาพ/วิดีโอ", status: "pending" },
      { id: "edit", title: "Editing", titleTh: "ตัดต่อ", status: "pending" },
    ],
    default: [
      { id: "brief", title: "Brief", titleTh: "กำหนดขอบเขต", status: "done" },
      { id: "collect", title: "Collect", titleTh: "รวบรวม", status: "active" },
      { id: "verify", title: "Verification", titleTh: "ตรวจสอบ", status: "pending" },
    ],
  };
  // @ts-ignore
  return map[kind] || map.default;
}

export function mockFileTree(kind: WorkKind): ProjectFile[] {
  if (kind === "coding") return [
    { path: "app/(dashboard)/page.tsx", lang: "tsx", size: "2.4 KB", status: "modified" },
    { path: "app/api/customers/route.ts", lang: "ts", size: "1.1 KB", status: "new" },
    { path: "prisma/schema.prisma", lang: "prisma", size: "0.9 KB", status: "modified" },
    { path: "components/CustomerTable.tsx", lang: "tsx", size: "3.2 KB", status: "new" },
    { path: "lib/auth.ts", lang: "ts", size: "0.8 KB", status: "unchanged" },
    { path: "README.md", lang: "md", size: "1.5 KB", status: "new" },
  ];
  if (kind === "doc") return [
    { path: "proposal.docx", lang: "docx", size: "4.2 MB", status: "new" },
    { path: "proposal.pdf", lang: "pdf", size: "3.8 MB", status: "new" },
    { path: "charts/sales-trend.png", lang: "png", size: "210 KB", status: "new" },
    { path: "charts/forecast.png", lang: "png", size: "180 KB", status: "new" },
  ];
  if (kind === "video_gen" || kind === "video_analysis") return [
    { path: "exports/ad-30s-v1.mp4", lang: "mp4", size: "12.4 MB", status: "new" },
    { path: "exports/ad-30s-v2.mp4", lang: "mp4", size: "11.9 MB", status: "new" },
    { path: "exports/captions.th.srt", lang: "srt", size: "4 KB", status: "new" },
    { path: "project.remotion.json", lang: "json", size: "8 KB", status: "new" },
  ];
  return [
    { path: "report.pdf", lang: "pdf", size: "2.1 MB", status: "new" },
    { path: "appendix.xlsx", lang: "xlsx", size: "340 KB", status: "new" },
  ];
}

export type VerificationCheck = { name: string; passed: boolean; evidenceUrl?: string; detail?: string };
export type VerificationReport = { taskId: string; type: string; passed: boolean; checks: VerificationCheck[]; summary: string; createdAt: string };

export function mockVerification(kind: WorkKind, taskId: string): VerificationReport {
  if (kind === "coding") return {
    taskId, type: "coding", passed: true, summary: "Coding verified — 5 checks passed",
    createdAt: new Date().toISOString(),
    checks: [
      { name: "typecheck", passed: true, detail: "tsc --noEmit passed (0 errors)" },
      { name: "tests", passed: true, detail: "vitest 14/14 passed, coverage 82%" },
      { name: "build", passed: true, detail: "pnpm build passed" },
      { name: "preview_smoke", passed: true, detail: "Playwright: login → dashboard → create OK", evidenceUrl: `/work/${taskId}/preview` },
      { name: "deliverable_openable", passed: true, detail: "ZIP contains runnable app + README + .env.example" },
    ],
  };
  if (kind === "doc") return {
    taskId, type: "doc", passed: true, summary: "Document verified — ready to send",
    createdAt: new Date().toISOString(),
    checks: [
      { name: "file_openable", passed: true, detail: "DOCX opens in LibreOffice, 12 pages" },
      { name: "page_count", passed: true, detail: "12 pages (expected 10-15)" },
      { name: "fonts_embedded", passed: true, detail: "Sarabun + Inter embedded" },
      { name: "toc", passed: true, detail: "Table of contents linked" },
      { name: "charts", passed: true, detail: "3 charts + 2 tables verified" },
      { name: "editable", passed: true, detail: "Template styles preserved, editable" },
    ],
  };
  if (kind === "video_gen" || kind === "video_analysis") return {
    taskId, type: "video", passed: true, summary: "Video verified — 3 variants exported",
    createdAt: new Date().toISOString(),
    checks: [
      { name: "ffprobe", passed: true, detail: "30.0s, 1920×1080, h264/aac, 12.4 MB" },
      { name: "thumbnail_strip", passed: true, detail: "8 thumbnails generated", evidenceUrl: `/work/${taskId}/thumbs` },
      { name: "subtitle_sync", passed: true, detail: "TH+EN subs, 0 drift, 98% accuracy" },
      { name: "aspect_ratios", passed: true, detail: "16:9 + 9:16 + 1:1 exported" },
      { name: "project_file", passed: true, detail: "Remotion bundle included (editable)" },
    ],
  };
  return {
    taskId, type: kind, passed: true, summary: `${kind} verified`,
    createdAt: new Date().toISOString(),
    checks: [{ name: "completeness", passed: true, detail: "All deliverables present" }],
  };
}
