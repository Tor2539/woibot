/**
 * Planner — presents the real execution stages per work kind.
 *
 * Each stage below maps to work the agent actually performs in the user's
 * container (see lib/harness/agent.ts). No shell commands are stored here:
 * the agent owns execution so a template can never claim work it did not do.
 */
import type { WorkKind } from "./index";

export type PlanStep = {
  id: string;
  title: string;
  titleTh: string;
  kind: "agent" | "verify";
  stage: string;
  estimatedMinutes: number;
};

export type ExecutionPlan = {
  taskId?: string;
  goal: string;
  workKind: WorkKind;
  steps: PlanStep[];
  totalMinutes: number;
};

const STAGES: Record<WorkKind, { th: string; en: string; min: number }[]> = {
  doc: [
    { th: "ร่างเนื้อหาด้วย AI", en: "Draft content", min: 3 },
    { th: "จัดหน้าและแปลงเป็น DOCX/PDF", en: "Layout → DOCX/PDF", min: 2 },
    { th: "ตรวจไฟล์จริง (เปิดได้/จำนวนหน้า/คำ)", en: "Verify files", min: 1 },
  ],
  research: [
    { th: "ค้นแหล่งข้อมูลจริงบนเว็บ", en: "Collect real sources", min: 3 },
    { th: "ดึงเนื้อหาและสังเคราะห์เป็นรายงาน", en: "Fetch + synthesise", min: 3 },
    { th: "ตรวจรายงาน (แหล่งอ้างอิง/โครงสร้าง)", en: "Verify report", min: 1 },
  ],
  data: [
    { th: "อ่านไฟล์ข้อมูลด้วย pandas", en: "Load dataset", min: 1 },
    { th: "สรุปสถิติ + เขียนรายงาน/ไฟล์ผลลัพธ์", en: "Analyse + export", min: 2 },
    { th: "ตรวจผลลัพธ์ (แถว/คอลัมน์/ค่าว่าง)", en: "Verify dataset", min: 1 },
  ],
  video_analysis: [
    { th: "ตรวจวิดีโอด้วย ffprobe", en: "Probe video", min: 1 },
    { th: "ตรวจจับฉากและตัดไฮไลต์", en: "Scene detect + cut", min: 4 },
    { th: "เขียนรายงานและตรวจไฟล์คลิป", en: "Report + verify", min: 1 },
  ],
  coding: [
    { th: "ให้ AI เขียนแอปที่รันได้", en: "Generate app", min: 4 },
    { th: "เรนเดอร์ด้วย Chromium เพื่อพิสูจน์", en: "Render proof", min: 2 },
    { th: "ตรวจ HTML/สกรีนช็อต", en: "Verify output", min: 1 },
  ],
  image: [
    { th: "อ่านข้อความในภาพ (OCR)", en: "OCR the image", min: 1 },
    { th: "ให้โมเดลอ่านภาพและสรุป", en: "Vision description", min: 2 },
    { th: "สร้างรายงาน PDF และตรวจไฟล์", en: "Report + verify", min: 1 },
  ],
  video_gen: [{ th: "ยังไม่เปิดใช้งาน (ไม่มีโมเดลสร้างวิดีโอจริง)", en: "Unsupported", min: 0 }],
  media_heavy: [{ th: "ยังไม่เปิดใช้งาน (ประมวลผลหนัก)", en: "Unsupported", min: 0 }],
};

export async function planTask(goal: string, workKind: WorkKind): Promise<ExecutionPlan> {
  const stages = STAGES[workKind] ?? STAGES.research;
  const steps: PlanStep[] = stages.map((s, i) => ({
    id: `${workKind}_${i + 1}`,
    title: s.en,
    titleTh: s.th,
    kind: i === stages.length - 1 ? "verify" : "agent",
    stage: s.en,
    estimatedMinutes: s.min,
  }));
  return {
    goal,
    workKind,
    steps,
    totalMinutes: steps.reduce((sum, s) => sum + s.estimatedMinutes, 0),
  };
}
