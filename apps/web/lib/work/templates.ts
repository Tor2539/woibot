export type WorkKind = "coding" | "research" | "doc" | "video_analysis" | "video_gen" | "media_heavy" | "data";
export type ExecutionMode = "cloud" | "local";

export const WORK_KINDS: { id: WorkKind; label: string; labelTh: string; icon: string; color: string }[] = [
  { id: "coding", label: "Coding", labelTh: "โค้ด", icon: "▣", color: "#1757d7" },
  { id: "doc", label: "Document", labelTh: "เอกสาร", icon: "◧", color: "#0f766e" },
  { id: "video_gen", label: "Video Gen", labelTh: "สร้างวิดีโอ", icon: "▶", color: "#be123c" },
  { id: "video_analysis", label: "Video Edit", labelTh: "ตัดต่อวิดีโอ", icon: "✂", color: "#7c3aed" },
  { id: "research", label: "Research", labelTh: "วิจัย", icon: "◎", color: "#ca8a04" },
  { id: "data", label: "Data & BI", labelTh: "วิเคราะห์ข้อมูล", icon: "▤", color: "#059669" },
  { id: "media_heavy", label: "Media Heavy", labelTh: "ประมวลผลหนัก", icon: "⬢", color: "#4f46e5" },
];

export type WorkTemplate = {
  kind: WorkKind;
  title: string;
  titleTh: string;
  description: string;
  prompts: string[];
  deliverables: string[];
  tools: string[];
  steps: { id: string; title: string; titleTh: string }[];
};

export const WORK_TEMPLATES: Record<WorkKind, WorkTemplate> = {
  coding: {
    kind: "coding",
    title: "Advanced Software Development",
    titleTh: "พัฒนาซอฟต์แวร์",
    description: "Build web apps, APIs, fix bugs, add features — with tests and verification.",
    prompts: [
      "สร้างระบบ CRM สำหรับทีมขาย: Login, Dashboard, Customer Management, รายงานยอดขาย",
      "เพิ่มระบบชำระเงิน Stripe เข้า Next.js app ที่มีอยู่",
      "แก้ bug: ตาราง orders โหลดช้าเมื่อมี 10k rows",
    ],
    deliverables: ["Next.js app (ZIP)", "README + .env.example", "Tests + coverage", "Preview URL"],
    tools: ["Next.js 15", "Prisma + Postgres", "Vitest", "Playwright", "Docker sandbox"],
    steps: [
      { id: "plan", title: "Planning", titleTh: "วางแผน" },
      { id: "scaffold", title: "Scaffolding", titleTh: "สร้างโครง" },
      { id: "build", title: "Building", titleTh: "พัฒนา" },
      { id: "test", title: "Testing", titleTh: "ทดสอบ" },
      { id: "verify", title: "Verification", titleTh: "ตรวจสอบ" },
      { id: "deliver", title: "Delivery", titleTh: "ส่งมอบ" },
    ],
  },
  doc: {
    kind: "doc",
    title: "Advanced Documents",
    titleTh: "เอกสารมืออาชีพ",
    description: "Proposals, reports, presentations, spreadsheets — print-ready and editable.",
    prompts: [
      "ทำ Proposal บริษัท 15 หน้า: วิเคราะห์ตลาด + แผนการเงิน + timeline",
      "สร้าง Presentation สรุปยอดขาย Q4 พร้อมกราฟและข้อเสนอแนะ",
      "รวม 3 ไฟล์สรุปสัญญา เป็นรายงานความเสี่ยงพร้อม redline",
    ],
    deliverables: ["DOCX (editable)", "PDF (print)", "PPTX (if deck)", "Preview before download"],
    tools: ["python-docx", "Puppeteer PDF", "LibreOffice headless", "Chart engine"],
    steps: [
      { id: "ingest", title: "Ingest files", titleTh: "อ่านไฟล์" },
      { id: "outline", title: "Outline", titleTh: "วางโครง" },
      { id: "draft", title: "Drafting", titleTh: "ร่างเนื้อหา" },
      { id: "design", title: "Layout & Charts", titleTh: "จัดหน้า/กราฟ" },
      { id: "verify", title: "File verification", titleTh: "ตรวจสอบไฟล์" },
      { id: "deliver", title: "Delivery", titleTh: "ส่งมอบ" },
    ],
  },
  video_gen: {
    kind: "video_gen",
    title: "Video Creation",
    titleTh: "สร้างวิดีโอ",
    description: "Concept → script → storyboard → generation → edit → export (multi-aspect).",
    prompts: [
      "ทำคลิปโฆษณา 30 วินาที 3 แบบ จากภาพสินค้า + รายละเอียด",
      "สร้างวิดีโออธิบาย product จาก script + voiceover ไทย",
      "ทำ storyboard + shot list สำหรับโฆษณา 60 วินาที",
    ],
    deliverables: ["MP4 1080p", "9:16 + 1:1 variants", "SRT TH+EN", "Remotion bundle (editable)"],
    tools: ["ComfyUI / Fal fallback", "FFmpeg", "Remotion", "Whisper", "ElevenLabs"],
    steps: [
      { id: "concept", title: "Concept & Script", titleTh: "แนวคิด/บท" },
      { id: "storyboard", title: "Storyboard", titleTh: "สตอรี่บอร์ด" },
      { id: "generate", title: "Generation", titleTh: "สร้างภาพ/วิดีโอ" },
      { id: "edit", title: "Editing", titleTh: "ตัดต่อ" },
      { id: "subtitle", title: "Subtitles", titleTh: "คำบรรยาย" },
      { id: "export", title: "Export & Verify", titleTh: "ส่งออก/ตรวจสอบ" },
    ],
  },
  video_analysis: {
    kind: "video_analysis",
    title: "Video Analysis & Editing",
    titleTh: "วิเคราะห์ & ตัดต่อวิดีโอ",
    description: "Long video → highlights, clips, subtitles, chaptering.",
    prompts: [
      "นำวิดีโอสัมภาษณ์ 60 นาที มาทำคลิป TikTok 5 คลิป พร้อม subtitle ไทย/อังกฤษ",
      "ตัด highlight reel + transcript + timestamp summary",
      "แปลงวิดีโอยาวเป็น short clips พร้อม hook detection",
    ],
    deliverables: ["5× short clips", "Transcript + summaries", "Thumbnail strip", "Project file"],
    tools: ["FFmpeg", "Whisper", "Scene detect", "Remotion"],
    steps: [
      { id: "ingest", title: "Ingest & Transcribe", titleTh: "นำเข้า/ถอดเสียง" },
      { id: "analyze", title: "Scene analysis", titleTh: "วิเคราะห์ฉาก" },
      { id: "select", title: "Highlight selection", titleTh: "เลือกช่วงเด่น" },
      { id: "edit", title: "Cut & Merge", titleTh: "ตัด/รวม" },
      { id: "subtitle", title: "Subtitles", titleTh: "ซับไตเติล" },
      { id: "verify", title: "Verify exports", titleTh: "ตรวจสอบ" },
    ],
  },
  research: {
    kind: "research",
    title: "Research & Analysis",
    titleTh: "วิจัยเชิงลึก",
    description: "Multi-source research, fact cross-check, report with citations.",
    prompts: [
      "วิเคราะห์คู่แข่ง 5 ราย ในตลาด CRM ไทย พร้อมตารางเปรียบเทียบ",
      "วิจัยกฎ PDPA ไทย vs GDPR สำหรับ SaaS — สรุป compliance checklist",
      "เปรียบเทียบเครื่องมือ video generation: ราคา/คุณภาพ/ลิขสิทธิ์",
    ],
    deliverables: ["Research report (PDF/DOCX)", "Comparison tables", "Sources + citations", "Executive summary"],
    tools: ["Web search", "pgvector RAG", "Fact cross-check", "Report builder"],
    steps: [
      { id: "brief", title: "Brief & Scope", titleTh: "กำหนดขอบเขต" },
      { id: "collect", title: "Collect sources", titleTh: "รวบรวมแหล่งข้อมูล" },
      { id: "verify", title: "Cross-verify", titleTh: "ตรวจสอบข้อเท็จจริง" },
      { id: "synthesize", title: "Synthesis", titleTh: "สังเคราะห์" },
      { id: "report", title: "Report", titleTh: "จัดทำรายงาน" },
    ],
  },
  data: {
    kind: "data",
    title: "Data Analysis & BI",
    titleTh: "วิเคราะห์ข้อมูลธุรกิจ",
    description: "Excel/CSV → clean → model → forecast → dashboard + exec report.",
    prompts: [
      "วิเคราะห์ไฟล์ยอดขาย CSV: เทรนด์ + forecast 6 เดือน + dashboard",
      "รวมข้อมูล 3 แหล่ง (Shopify + Sheets + DB) ทำ KPI dashboard",
      "สร้าง financial model + scenario analysis สำหรับแผน 2026",
    ],
    deliverables: ["XLSX (with formulas)", "Dashboard (PNG/interactive)", "Forecast report", "Assumptions doc"],
    tools: ["Python (pandas)", "Chart engine", "Forecast model", "Excel export"],
    steps: [
      { id: "ingest", title: "Ingest & Clean", titleTh: "นำเข้า/ทำความสะอาด" },
      { id: "analyze", title: "Analysis", titleTh: "วิเคราะห์" },
      { id: "model", title: "Modeling", titleTh: "สร้างโมเดล" },
      { id: "viz", title: "Visualization", titleTh: "ทำกราฟ/แดชบอร์ด" },
      { id: "report", title: "Executive report", titleTh: "รายงานผู้บริหาร" },
    ],
  },
  media_heavy: {
    kind: "media_heavy",
    title: "Media Heavy Processing",
    titleTh: "ประมวลผลมีเดียหนัก",
    description: "Batch image/video processing, format conversion, upscaling.",
    prompts: [
      "แปลงวิดีโอ 50 ไฟล์เป็น 1080p + สร้าง thumbnail อัตโนมัติ",
      "Batch resize + watermark ภาพ 1,000 รูป สำหรับ marketplace",
    ],
    deliverables: ["Converted files", "Manifest + checksums", "Thumbnails"],
    tools: ["FFmpeg", "ImageMagick", "Cloud batch"],
    steps: [
      { id: "ingest", title: "Ingest", titleTh: "นำเข้า" },
      { id: "process", title: "Processing", titleTh: "ประมวลผล" },
      { id: "verify", title: "Verification", titleTh: "ตรวจสอบ" },
    ],
  },
};

export const TASK_STATUSES = [
  { id: "queued", label: "Queued", labelTh: "รอคิว", color: "#6b7280" },
  { id: "planning", label: "Planning", labelTh: "วางแผน", color: "#2563eb" },
  { id: "in_progress", label: "In Progress", labelTh: "กำลังทำ", color: "#7c3aed" },
  { id: "waiting_for_user", label: "Waiting", labelTh: "รอผู้ใช้", color: "#d97706" },
  { id: "paused", label: "Paused", labelTh: "พักงาน", color: "#6b7280" },
  { id: "reviewing", label: "Reviewing", labelTh: "ตรวจสอบ", color: "#0891b2" },
  { id: "completed", label: "Completed", labelTh: "เสร็จสิ้น", color: "#059669" },
  { id: "partially_completed", label: "Partial", labelTh: "เสร็จบางส่วน", color: "#ca8a04" },
  { id: "failed", label: "Failed", labelTh: "ล้มเหลว", color: "#dc2626" },
  { id: "cancelled", label: "Cancelled", labelTh: "ยกเลิก", color: "#9ca3af" },
] as const;

export type TaskStatusId = typeof TASK_STATUSES[number]["id"];
