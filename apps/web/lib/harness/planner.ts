/**
 * Planner — breaks task goal into executable steps
 * Uses template steps per WorkKind, can be LLM-driven in prod
 */

import type { WorkKind } from "./index";

export type PlanStep = {
  id: string;
  title: string;
  titleTh: string;
  kind: "shell" | "browser" | "llm" | "file" | "verify";
  command?: string; // for shell/browser
  prompt?: string;  // for llm
  inputs?: string[];
  outputs?: string[];
  estimatedMinutes: number;
};

export type ExecutionPlan = {
  taskId?: string;
  goal: string;
  workKind: WorkKind;
  steps: PlanStep[];
  totalMinutes: number;
};

const TEMPLATES: Record<WorkKind, Omit<PlanStep, "id">[]> = {
  coding: [
    { title: "Planning", titleTh: "วางแผน", kind: "llm", prompt: "Analyze goal and create tech plan", estimatedMinutes: 2 },
    { title: "Scaffolding", titleTh: "สร้างโครง", kind: "shell", command: "pnpm create next-app --ts", estimatedMinutes: 3 },
    { title: "Building", titleTh: "พัฒนา", kind: "shell", command: "pnpm build logic + pages", estimatedMinutes: 8 },
    { title: "Testing", titleTh: "ทดสอบ", kind: "shell", command: "pnpm test", estimatedMinutes: 3 },
    { title: "Verification", titleTh: "ตรวจสอบ", kind: "verify", estimatedMinutes: 2 },
  ],
  doc: [
    { title: "Ingest files", titleTh: "อ่านไฟล์", kind: "file", estimatedMinutes: 1 },
    { title: "Outline", titleTh: "วางโครง", kind: "llm", prompt: "Create document outline", estimatedMinutes: 2 },
    { title: "Drafting", titleTh: "ร่างเนื้อหา", kind: "llm", prompt: "Draft document content", estimatedMinutes: 4 },
    { title: "Layout & Charts", titleTh: "จัดหน้า/กราฟ", kind: "shell", command: "python gen_docx.py", estimatedMinutes: 2 },
    { title: "File verification", titleTh: "ตรวจสอบไฟล์", kind: "verify", estimatedMinutes: 1 },
  ],
  research: [
    { title: "Brief & Scope", titleTh: "กำหนดขอบเขต", kind: "llm", prompt: "Define research scope", estimatedMinutes: 1 },
    { title: "Collect sources", titleTh: "รวบรวมแหล่งข้อมูล", kind: "browser", command: "search + scrape", estimatedMinutes: 5 },
    { title: "Cross-verify", titleTh: "ตรวจสอบข้อเท็จจริง", kind: "llm", prompt: "Cross-verify facts", estimatedMinutes: 2 },
    { title: "Synthesis", titleTh: "สังเคราะห์", kind: "llm", prompt: "Synthesize findings", estimatedMinutes: 2 },
    { title: "Report", titleTh: "จัดทำรายงาน", kind: "file", estimatedMinutes: 2 },
  ],
  video_analysis: [
    { title: "Ingest & Transcribe", titleTh: "นำเข้า/ถอดเสียง", kind: "shell", command: "ffmpeg + whisper", estimatedMinutes: 4 },
    { title: "Scene analysis", titleTh: "วิเคราะห์ฉาก", kind: "shell", command: "scene-detect", estimatedMinutes: 3 },
    { title: "Highlight selection", titleTh: "เลือกช่วงเด่น", kind: "llm", prompt: "Select highlights", estimatedMinutes: 2 },
    { title: "Cut & Merge", titleTh: "ตัด/รวม", kind: "shell", command: "ffmpeg cut", estimatedMinutes: 3 },
    { title: "Subtitles", titleTh: "ซับไตเติล", kind: "shell", command: "whisper srt", estimatedMinutes: 2 },
    { title: "Verify exports", titleTh: "ตรวจสอบ", kind: "verify", estimatedMinutes: 1 },
  ],
  video_gen: [
    { title: "Concept & Script", titleTh: "แนวคิด/บท", kind: "llm", prompt: "Create concept+script", estimatedMinutes: 3 },
    { title: "Storyboard", titleTh: "สตอรี่บอร์ด", kind: "file", estimatedMinutes: 2 },
    { title: "Generation", titleTh: "สร้างภาพ/วิดีโอ", kind: "shell", command: "comfyui generate", estimatedMinutes: 10 },
    { title: "Editing", titleTh: "ตัดต่อ", kind: "shell", command: "ffmpeg edit", estimatedMinutes: 5 },
    { title: "Subtitles", titleTh: "คำบรรยาย", kind: "shell", command: "srt gen", estimatedMinutes: 2 },
    { title: "Export & Verify", titleTh: "ส่งออก/ตรวจสอบ", kind: "verify", estimatedMinutes: 3 },
  ],
  media_heavy: [
    { title: "Ingest", titleTh: "นำเข้า", kind: "file", estimatedMinutes: 1 },
    { title: "Processing", titleTh: "ประมวลผล", kind: "shell", command: "ffmpeg batch", estimatedMinutes: 10 },
    { title: "Verification", titleTh: "ตรวจสอบ", kind: "verify", estimatedMinutes: 2 },
  ],
  data: [
    { title: "Ingest & Clean", titleTh: "นำเข้า/ทำความสะอาด", kind: "shell", command: "pandas clean", estimatedMinutes: 3 },
    { title: "Analysis", titleTh: "วิเคราะห์", kind: "shell", command: "pandas analyze", estimatedMinutes: 4 },
    { title: "Modeling", titleTh: "สร้างโมเดล", kind: "shell", command: "forecast", estimatedMinutes: 3 },
    { title: "Visualization", titleTh: "ทำกราฟ/แดชบอร์ด", kind: "shell", command: "chart gen", estimatedMinutes: 2 },
    { title: "Executive report", titleTh: "รายงานผู้บริหาร", kind: "file", estimatedMinutes: 2 },
  ],
};

export async function planTask(goal: string, workKind: WorkKind): Promise<ExecutionPlan> {
  const tpl = TEMPLATES[workKind] ?? TEMPLATES.coding;
  const steps: PlanStep[] = tpl.map((s, i) => ({
    ...s,
    id: `${workKind}_${i + 1}`,
  }));
  const totalMinutes = steps.reduce((s, x) => s + x.estimatedMinutes, 0);
  return { goal, workKind, steps, totalMinutes };
}

export async function planTaskWithLLM(goal: string, workKind: WorkKind, llmCall?: (prompt: string) => Promise<string>): Promise<ExecutionPlan> {
  // In prod: call LLM to customize plan, fallback to template
  if (llmCall) {
    try {
      const raw = await llmCall(`Plan steps for ${workKind}: ${goal}`);
      // try parse, but fallback
      if (raw) console.log("[planner] llm raw", raw.slice(0, 200));
    } catch {}
  }
  return planTask(goal, workKind);
}
