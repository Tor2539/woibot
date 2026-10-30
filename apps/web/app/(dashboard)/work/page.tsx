"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Code2,
  Clapperboard,
  Layers,
  Cloud,
  Laptop,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  ArrowUpRight,
  Plus,
  Terminal,
  FileCode2,
  Eye,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  FileText,
  Presentation,
  Palette,
  BarChart3,
  Box,
  Share2,
  Check,
  RefreshCw,
} from "lucide-react";

type WorkArea = "code" | "video" | "artifacts";
type ArtifactCategory = "all" | "shared" | "docs" | "slides" | "design" | "dashboard" | "3d";

const CODE_DIFF_FILES = [
  {
    path: "apps/crm/app/pipeline/page.tsx",
    additions: 84,
    deletions: 6,
    diff: `@@ -1,12 +1,42 @@
+"use client";
+import React, { useState } from "react";
+import { DealKanbanBoard } from "@/components/DealKanbanBoard";
+import { RevenueForecastChart } from "@/components/RevenueForecastChart";
+
 export default function SalesPipelinePage() {
+  const [quarter, setQuarter] = useState<"Q3" | "Q4">("Q4");
   return (
-    <div>Pipeline placeholder</div>
+    <div className="min-h-screen bg-[#0e0e10] text-[#ececee] p-6 space-y-6">
+      <header className="flex items-center justify-between border-b border-[#25262c] pb-4">
+        <h1 className="text-lg font-semibold">Enterprise Sales Pipeline ({quarter})</h1>
+        <span className="font-mono text-sm text-emerald-400 tabular-nums">฿14,820,000 ARR</span>
+      </header>
+      <RevenueForecastChart quarter={quarter} />
+      <DealKanbanBoard quarter={quarter} />
+    </div>
   );
 }`,
  },
  {
    path: "apps/crm/lib/verification/crm.spec.ts",
    additions: 48,
    deletions: 0,
    diff: `@@ -0,0 +1,24 @@
+import { test, expect } from "@playwright/test";
+
+test("Sales CRM end-to-end journey: login -> pipeline -> create deal -> export CSV", async ({ page }) => {
+  await page.goto("http://localhost:3000/pipeline");
+  await expect(page.locator("h1")).toContainText("Enterprise Sales Pipeline");
+  await page.click("button:has-text('+ New Deal')");
+  await page.fill("input[name='company']", "ACME Corporation");
+  await page.fill("input[name='value']", "1250000");
+  await page.click("button:has-text('Save Deal')");
+  await expect(page.locator("text=ACME Corporation")).toBeVisible();
+});`,
  },
];

const VIDEO_SCENES = [
  { id: "s1", shot: "01", time: "00:00 – 00:05", title: "Hook: The Overwhelmed Executive Desk", camera: "35mm Dolly In · Dark Studio", subTh: "ทำไมต้องสลับหลายแอป เมื่อคุณมีทีม AI ส่วนตัวที่ลงมือทำจนจบ?", subEn: "Why juggle 10 tools when your Personal AI Team actually finishes the job?" },
  { id: "s2", shot: "02", time: "00:05 – 00:11", title: "Teammate 08:00 Cloud Computer Briefing", camera: "Macro UI Capture · 60fps", subTh: "Teammate ดูแลอีเมล ตารางประชุม และงานประจำตลอด 24 ชั่วโมงบนคลาวด์", subEn: "Teammate handles VIP inbox, calendar & routines 24/7 on its own Cloud Computer." },
  { id: "s3", shot: "03", time: "00:11 – 00:18", title: "Seamless Handoff Packet → Work Studio", camera: "Split Screen Transition", subTh: "งานหนักส่งต่อให้ Work ทันทีโดยไม่ต้องก๊อปปี้บริบท พร้อมใบประเมินงบโปร่งใส", subEn: "Heavy work hands off to Work with zero copy-paste and transparent cost gates." },
  { id: "s4", shot: "04", time: "00:18 – 00:25", title: "Verified Deliverables: Code, Docs, Video & 3D", camera: "Dynamic Grid Zoom", subTh: "ทุกผลงานผ่านระบบตรวจสอบคุณภาพ เปิดใช้และแก้ไขต่อได้จริง", subEn: "Every deliverable passes automated verification — openable and editable." },
  { id: "s5", shot: "05", time: "00:25 – 00:30", title: "Outro Lockup: woibot.com", camera: "Center Hero Lockup", subTh: "woibot.com — สั่งงานกับ Teammate ให้ Work ลุยงานหนักแทนคุณ", subEn: "woibot.com — Talk to your Teammate. Let Work handle the heavy lifting." },
];

function WorkStudioInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const areaParam = (searchParams.get("area") as WorkArea) || "code";

  const [area, setArea] = useState<WorkArea>(areaParam);
  const [execMode, setExecMode] = useState<"cloud" | "local">("cloud");
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("tsk_crm_code");
  const [codeRightTab, setCodeRightTab] = useState<"preview" | "diff" | "terminal" | "verify">("preview");
  const [selectedDiffIdx, setSelectedDiffIdx] = useState(0);

  // New Work Job Builder + Estimate Gate
  const [newGoal, setNewGoal] = useState("");
  const [newKind, setNewKind] = useState<"coding" | "doc" | "video_gen" | "research">("coding");
  const [creatingJob, setCreatingJob] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Video Studio state
  const [videoRatio, setVideoRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [activeSceneIdx, setActiveSceneIdx] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [scenes, setScenes] = useState(VIDEO_SCENES);

  // Artifacts Studio state (Claude Desktop Artifacts Gallery + Designer Mode)
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [artCategory, setArtCategory] = useState<ArtifactCategory>("all");
  const [artOrigin, setArtOrigin] = useState<"all" | "work" | "teammate">("all");
  const [selectedArtifact, setSelectedArtifact] = useState<any | null>(null);
  const [artZoom, setArtZoom] = useState<number>(100);
  const [artFull, setArtFull] = useState(false);
  const [editingContent, setEditingContent] = useState("");
  const [savingArtifact, setSavingArtifact] = useState(false);

  // Designer Mode Ask-First Brief state
  const [briefAudience, setBriefAudience] = useState("Executive Board");
  const [briefStyle, setBriefStyle] = useState("Linear/Stripe Minimal");
  const [briefTab, setBriefTab] = useState<"docs" | "slides" | "design" | "dashboard" | "3d">("docs");
  const [briefPrompt, setBriefPrompt] = useState("");
  const [generatingArtifact, setGeneratingArtifact] = useState(false);

  useEffect(() => {
    if (areaParam === "code" || areaParam === "video" || areaParam === "artifacts") {
      setArea(areaParam);
    }
  }, [areaParam]);

  const loadTasks = () => {
    fetch("/api/tasks?product=work")
      .then((r) => r.json())
      .then((res) => {
        const list = res?.data?.tasks || res?.tasks || [];
        setTasks(list);
        if (list.length > 0 && !list.some((t: any) => t.id === selectedTaskId)) {
          setSelectedTaskId(list[0].id);
        }
      })
      .catch(() => {});
  };

  const loadArtifacts = () => {
    fetch(`/api/artifacts?tab=${artCategory}&origin=${artOrigin}`)
      .then((r) => r.json())
      .then((res) => {
        const list = res?.artifacts || [];
        setArtifacts(list);
        if (list.length > 0 && !selectedArtifact) {
          setSelectedArtifact(list[0]);
          setEditingContent(list[0].content || "");
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    loadArtifacts();
  }, [artCategory, artOrigin]);

  const switchArea = (next: WorkArea) => {
    setArea(next);
    router.push(`/work?area=${next}`);
  };

  const estimatedCost =
    newKind === "coding"
      ? execMode === "local"
        ? 1.65
        : 2.4
      : newKind === "video_gen"
      ? 3.8
      : newKind === "doc"
      ? 1.15
      : 1.2;

  const handleCreateWorkJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim() || creatingJob) return;
    setCreatingJob(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newGoal.trim().slice(0, 72),
          goal: newGoal.trim(),
          product: "work",
          workKind: newKind,
          executionMode: execMode,
        }),
      });
      const json = await res.json();
      const created = json?.data?.task || json?.task;
      if (created) {
        setTasks((prev) => [created, ...prev]);
        setSelectedTaskId(created.id);
        setNewGoal("");
      }
    } finally {
      setCreatingJob(false);
    }
  };

  const handleApproveAndRunTask = async (task: any) => {
    setVerifyingId(task.id);
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approveEstimate: true, status: "in_progress", progress: 70 }),
      });
      await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      });
      loadTasks();
    } finally {
      setVerifyingId(null);
    }
  };

  const handleGenerateArtifact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!briefPrompt.trim() || generatingArtifact) return;
    setGeneratingArtifact(true);
    try {
      const res = await fetch("/api/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: briefPrompt.trim().slice(0, 64),
          tab: briefTab,
          audience: briefAudience,
          style: briefStyle,
          prompt: briefPrompt.trim(),
          origin: "work",
        }),
      });
      const data = await res.json();
      if (data?.artifact) {
        setArtifacts((prev) => [data.artifact, ...prev]);
        setSelectedArtifact(data.artifact);
        setEditingContent(data.artifact.content || "");
        setBriefPrompt("");
      }
    } finally {
      setGeneratingArtifact(false);
    }
  };

  const handleSaveArtifactEdit = async () => {
    if (!selectedArtifact || savingArtifact) return;
    setSavingArtifact(true);
    try {
      const res = await fetch("/api/artifacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedArtifact.id,
          content: editingContent,
          bumpVersion: true,
        }),
      });
      const data = await res.json();
      if (data?.artifact) {
        setSelectedArtifact(data.artifact);
        setArtifacts((prev) => prev.map((a) => (a.id === data.artifact.id ? data.artifact : a)));
      }
    } finally {
      setSavingArtifact(false);
    }
  };

  const activeTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0];
  const currentScene = scenes[activeSceneIdx] || scenes[0];

  return (
    <div className="flex min-h-[calc(100vh-48px)] lg:min-h-screen flex-col w-full">
      {/* TOP 48px WORK STUDIO HEADER */}
      <header
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--wb-line)", backgroundColor: "var(--wb-bg)" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* 3-Area Segmented Control: Code | Video | Artifacts */}
          <div className="wb-mode-tabs" role="tablist" aria-label="Work Studio Areas">
            {[
              { id: "code" as const, label: "Code", Icon: Code2, sub: "Devin/Claude Code" },
              { id: "video" as const, label: "Video", Icon: Clapperboard, sub: "Studio & Subs" },
              { id: "artifacts" as const, label: "Artifacts", Icon: Layers, sub: "Docs · Slides · 3D" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={area === item.id}
                onClick={() => switchArea(item.id)}
                className={`wb-mode-tab ${area === item.id ? "is-active" : ""}`}
              >
                <item.Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Execution Mode Switcher: Cloud vs Local */}
          <div
            className="inline-flex items-center gap-1 rounded-[7px] p-0.5 text-[11.5px]"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
          >
            <button
              type="button"
              onClick={() => setExecMode("cloud")}
              className={`inline-flex items-center gap-1 rounded-[5px] px-2 py-1 font-medium transition-colors ${
                execMode === "cloud" ? "bg-[#2b66e0] text-white" : "text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
              }`}
            >
              <Cloud className="h-3 w-3" />
              <span>Cloud Work</span>
            </button>
            <button
              type="button"
              onClick={() => setExecMode("local")}
              className={`inline-flex items-center gap-1 rounded-[5px] px-2 py-1 font-medium transition-colors ${
                execMode === "local" ? "bg-amber-500 text-black font-semibold" : "text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
              }`}
            >
              <Laptop className="h-3 w-3" />
              <span>Local Work</span>
            </button>
          </div>

          {execMode === "local" && (
            <span className="rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] text-amber-300">
              Local Daemon: ไฟล์ในเครื่องจะไม่ถูกอัปโหลดขึ้น Cloud โดยไม่ขออนุญาต
            </span>
          )}
        </div>

        {/* Right Cost Isolation & Teammate Handoff status */}
        <div className="flex items-center gap-2 text-[12px] tabular-nums">
          <span
            className="rounded-[7px] px-2.5 py-1 font-mono text-[11.5px]"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
          >
            Work Ledger: <strong className="text-[#7cb0ff]">$5.75</strong> / $50.00 cap
          </span>
        </div>
      </header>

      {/* =====================================================================
          AREA 1: WORK › CODE (Autonomous Software Engineering + Verification)
         ===================================================================== */}
      {area === "code" && (
        <div className="flex-1 p-4 lg:p-5 space-y-4">
          {/* Top Prompt & Cost Estimate Gate Launcher */}
          <form
            onSubmit={handleCreateWorkJob}
            className="rounded-[12px] p-4 space-y-3"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-[#3b82f6]" />
                <span className="text-[13.5px] font-semibold">
                  New Autonomous Work Project — Estimate Gate Before Execution
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11.5px] tabular-nums">
                <span className="rounded bg-[#2b66e0]/20 px-2 py-0.5 text-[#7cb0ff]">
                  Est. Cost: ~${estimatedCost.toFixed(2)}
                </span>
                <span className="text-[var(--wb-muted)]">Per-task cap: $5.00 ✓</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as any)}
                className="rounded-[8px] px-3 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
              >
                <option value="coding">Coding (Web/App + Tests + Preview)</option>
                <option value="doc">Documents (DOCX/PDF/PPTX 10+ Pages)</option>
                <option value="video_gen">Video Production (30s + Subs)</option>
                <option value="research">Deep Multi-Source Research</option>
              </select>
              <input
                type="text"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="สั่งโปรเจกต์ให้ Work ลงมือทำจนจบ (เช่น สร้างระบบ CRM พร้อม Login, Dashboard และ Playwright Tests)..."
                className="flex-1 rounded-[8px] px-3.5 py-2 text-[13.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)] text-[var(--wb-fg)] placeholder:text-[var(--wb-muted)]"
              />
              <button
                type="submit"
                disabled={!newGoal.trim() || creatingJob}
                className="inline-flex items-center justify-center gap-1.5 rounded-[8px] bg-[#2b66e0] hover:bg-[#2458c6] disabled:opacity-40 px-4 py-2 text-[12.5px] font-semibold text-white shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>{creatingJob ? "Creating..." : "Approve & Launch Job"}</span>
              </button>
            </div>
          </form>

          {/* Split Workspace: Left = Jobs & Verification Story | Right = Live Preview / Code Diff / Terminal */}
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            {/* Left Column: Jobs List + Active Job Step Timeline & Verification */}
            <div className="space-y-3">
              <div className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--wb-muted)] px-1">
                Work Execution Queue ({tasks.length})
              </div>
              <div className="space-y-2">
                {tasks.map((t) => {
                  const selected = activeTask?.id === t.id;
                  const est = t.estimate || {};
                  const ver = t.verification;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className={`cursor-pointer rounded-[11px] p-3.5 transition-all space-y-2 ${
                        selected ? "ring-1 ring-[#3b82f6]" : "hover:border-[var(--wb-line-strong)]"
                      }`}
                      style={{
                        backgroundColor: selected ? "var(--wb-active)" : "var(--wb-raised)",
                        border: "1px solid var(--wb-line)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                t.status === "completed"
                                  ? "bg-emerald-400"
                                  : t.status === "waiting_for_user"
                                  ? "bg-amber-400 animate-pulse"
                                  : "bg-[#3b82f6]"
                              }`}
                            />
                            <span className="truncate text-[13px] font-semibold">{t.title}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11.5px] text-[var(--wb-muted)]">{t.goal}</p>
                        </div>
                        <span className="shrink-0 font-mono text-[11.5px] font-semibold text-[#7cb0ff] tabular-nums">
                          ${(est.actualCost ?? est.estimatedCost ?? 2.4).toFixed(2)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10.5px]">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-[var(--wb-panel)] px-1.5 py-0.5 font-mono text-[var(--wb-muted)]">
                            {t.traceId}
                          </span>
                          <span className="rounded bg-[#2b66e0]/15 px-1.5 py-0.5 text-[#7cb0ff] uppercase">
                            {t.executionMode}
                          </span>
                        </div>
                        <span className="font-medium capitalize text-[var(--wb-fg-soft)]">
                          {t.status.replace(/_/g, " ")} ({t.progress ?? 100}%)
                        </span>
                      </div>

                      {t.status === "waiting_for_user" && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApproveAndRunTask(t);
                            }}
                            className="w-full rounded-[7px] bg-amber-500 hover:bg-amber-400 py-1.5 text-[11.5px] font-semibold text-black"
                          >
                            {verifyingId === t.id
                              ? "Executing & Running Verification..."
                              : `Approve Estimate ($${est.estimatedCost ?? 1.15}) & Run Now`}
                          </button>
                        </div>
                      )}

                      {ver && ver.passed && (
                        <div className="flex items-center justify-between rounded-md bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 text-[11px] text-emerald-400">
                          <span>✓ Verified ({ver.checks?.length || 5} checks passed)</span>
                          <span className="font-mono">report.json</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Active Job Live Workspace (Preview / Code Diff / Terminal / Verification Report) */}
            {activeTask && (
              <div
                className="flex flex-col overflow-hidden rounded-[12px]"
                style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
              >
                {/* Workspace Sub-Header */}
                <div
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  style={{ borderBottom: "1px solid var(--wb-line)", backgroundColor: "var(--wb-panel)" }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold">{activeTask.title}</span>
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase text-emerald-400">
                        {activeTask.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-[var(--wb-muted)] font-mono">
                      Trace: {activeTask.traceId} · Mode: {activeTask.executionMode.toUpperCase()} · Deliverable Ready
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApproveAndRunTask(activeTask)}
                      className="inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-[11.5px] font-medium hover:bg-[var(--wb-hover)]"
                      style={{ border: "1px solid var(--wb-line)", backgroundColor: "var(--wb-raised)" }}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${verifyingId === activeTask.id ? "animate-spin" : ""}`} />
                      <span>Re-Verify</span>
                    </button>
                    <a
                      href={`/api/artifacts?download=del_crm_zip`}
                      className="inline-flex items-center gap-1.5 rounded-[7px] bg-[#2b66e0] hover:bg-[#2458c6] px-3 py-1.5 text-[11.5px] font-medium text-white"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download .ZIP</span>
                    </a>
                  </div>
                </div>

                {/* Inspector Tabs: Live App Preview | Code & Diff | Container Terminal | Verification Report */}
                <div
                  className="flex items-center gap-1 px-3 py-1.5"
                  style={{ borderBottom: "1px solid var(--wb-line)", backgroundColor: "var(--wb-sidebar)" }}
                >
                  {[
                    { id: "preview" as const, label: "Live Deliverable Preview", Icon: Eye },
                    { id: "diff" as const, label: "Code & Git Diff (+132 -6)", Icon: FileCode2 },
                    { id: "terminal" as const, label: "Container Terminal", Icon: Terminal },
                    { id: "verify" as const, label: "Verification Report (5/5)", Icon: ShieldCheck },
                  ].map((tb) => (
                    <button
                      key={tb.id}
                      type="button"
                      onClick={() => setCodeRightTab(tb.id)}
                      className={`inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        codeRightTab === tb.id
                          ? "bg-[var(--wb-active)] text-[var(--wb-fg)]"
                          : "text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                      }`}
                    >
                      <tb.Icon className="h-3.5 w-3.5" />
                      <span>{tb.label}</span>
                    </button>
                  ))}
                </div>

                {/* Tab Body */}
                <div className="p-4 flex-1">
                  {codeRightTab === "preview" && (
                    <div className="space-y-4">
                      {/* Interactive Simulated Built CRM Application */}
                      <div
                        className="overflow-hidden rounded-[10px]"
                        style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                      >
                        <div className="flex items-center justify-between px-3.5 py-2 text-[11.5px] border-b border-[var(--wb-line)]">
                          <span className="font-mono text-[var(--wb-muted)]">
                            https://preview-{activeTask.traceId}.woibot.run/pipeline
                          </span>
                          <span className="text-emerald-400 font-mono">HTTP 200 · Interactive Preview</span>
                        </div>
                        <div className="p-4 space-y-4">
                          <div className="grid gap-3 sm:grid-cols-4 tabular-nums">
                            {[
                              { label: "Q4 Pipeline ARR", val: "฿14,820,000", delta: "+18.4%" },
                              { label: "Qualified Deals", val: "28 Deals", delta: "+6 this week" },
                              { label: "Win Rate (Verified)", val: "64.2%", delta: "+4.1%" },
                              { label: "Avg Deal Cycle", val: "14 Days", delta: "-3 days" },
                            ].map((k, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg p-3"
                                style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                              >
                                <div className="text-[11px] text-[var(--wb-muted)]">{k.label}</div>
                                <div className="mt-1 text-[16px] font-bold">{k.val}</div>
                                <div className="mt-0.5 text-[10.5px] text-emerald-400">{k.delta}</div>
                              </div>
                            ))}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            {[
                              { stage: "Discovery & Brief", count: 4, total: "฿3,200,000", deal: "ACME Corp — Enterprise AI Suite" },
                              { stage: "Proposal & Redline", count: 3, total: "฿6,450,000", deal: "Siam Financial — Compliance Copilot" },
                              { stage: "Closed Won (Q4)", count: 5, total: "฿5,170,000", deal: "Pacific Logistics — Fleet Automation" },
                            ].map((col, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg p-3 space-y-2"
                                style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                              >
                                <div className="flex items-center justify-between text-[11.5px] font-semibold">
                                  <span>{col.stage}</span>
                                  <span className="font-mono text-[#7cb0ff] tabular-nums">{col.total}</span>
                                </div>
                                <div
                                  className="rounded p-2.5 text-[12px]"
                                  style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                                >
                                  <div className="font-medium">{col.deal}</div>
                                  <div className="mt-1 text-[10.5px] text-[var(--wb-muted)]">
                                    Verified deliverable · Editable schema
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {codeRightTab === "diff" && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {CODE_DIFF_FILES.map((f, idx) => (
                          <button
                            key={f.path}
                            type="button"
                            onClick={() => setSelectedDiffIdx(idx)}
                            className={`rounded-[7px] px-3 py-1.5 font-mono text-[11.5px] ${
                              selectedDiffIdx === idx
                                ? "bg-[#2b66e0] text-white"
                                : "bg-[var(--wb-panel)] text-[var(--wb-muted)] border border-[var(--wb-line)]"
                            }`}
                          >
                            {f.path} <span className="text-emerald-300">+{f.additions}</span>{" "}
                            <span className="text-red-300">-{f.deletions}</span>
                          </button>
                        ))}
                      </div>
                      <pre
                        className="overflow-x-auto rounded-[10px] p-4 font-mono text-[12px] leading-relaxed"
                        style={{ backgroundColor: "#0a0b0e", border: "1px solid var(--wb-line)", color: "#d2d3d8" }}
                      >
                        {CODE_DIFF_FILES[selectedDiffIdx].diff}
                      </pre>
                    </div>
                  )}

                  {codeRightTab === "terminal" && (
                    <div
                      className="rounded-[10px] p-4 font-mono text-[12px] leading-relaxed space-y-1.5"
                      style={{ backgroundColor: "#090a0f", border: "1px solid var(--wb-line)", color: "#d2d3d8" }}
                    >
                      <div className="text-[#7cb0ff]">$ pnpm --filter @crm/web tsc --noEmit</div>
                      <div className="text-emerald-400">✓ Typecheck passed (0 errors in 1.9s)</div>
                      <div className="text-[#7cb0ff] pt-2">$ pnpm --filter @crm/web vitest run</div>
                      <div> PASS  src/__tests__/pipeline.test.ts (8 tests) 412ms</div>
                      <div> PASS  src/__tests__/forecast-model.test.ts (6 tests) 289ms</div>
                      <div className="text-emerald-400">✓ Test Files 2 passed (14/14 tests, coverage 86.4%)</div>
                      <div className="text-[#7cb0ff] pt-2">$ npx playwright test crm.spec.ts</div>
                      <div>  1 passed (3.4s) — Screenshot & DOM verified at 1440px and 390px</div>
                      <div className="text-emerald-400">✓ verification_report.json written and signed</div>
                    </div>
                  )}

                  {codeRightTab === "verify" && (
                    <div className="space-y-3">
                      <div
                        className="flex items-center justify-between rounded-[10px] p-3.5"
                        style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)" }}
                      >
                        <div>
                          <div className="text-[13.5px] font-semibold text-emerald-400">
                            Definition of Done — All 5 Automated Verification Gates Passed
                          </div>
                          <div className="text-[11.5px] text-[var(--wb-muted)]">
                            {activeTask.verification?.summary || "Deliverable verified openable, tested, and ready for production"}
                          </div>
                        </div>
                        <a
                          href="/api/artifacts?download=del_crm_report"
                          className="rounded-[7px] bg-emerald-600 px-3 py-1.5 text-[11.5px] font-medium text-white"
                        >
                          Download JSON Report
                        </a>
                      </div>

                      <div className="space-y-2">
                        {(
                          activeTask.verification?.checks || [
                            { name: "typecheck", passed: true, detail: "tsc --noEmit 0 errors" },
                            { name: "unit_tests", passed: true, detail: "vitest 14/14 passed" },
                            { name: "playwright_e2e", passed: true, detail: "Login -> Pipeline -> Deal creation verified" },
                            { name: "deliverable_openable", passed: true, detail: "ZIP archive contains runnable project + README" },
                          ]
                        ).map((chk: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded-[8px] px-3.5 py-2.5 text-[12.5px]"
                            style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                          >
                            <div className="flex items-center gap-2.5">
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                              <span className="font-mono font-semibold">{chk.name}</span>
                            </div>
                            <span className="text-[var(--wb-muted)]">{chk.detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          AREA 2: WORK › VIDEO (Full Video Creation, Editing & Subtitle Studio)
         ===================================================================== */}
      {area === "video" && (
        <div className="flex-1 p-4 lg:p-5 space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            {/* Left: Video Stage + Aspect Ratio + Burned-in TH/EN Subtitle Preview */}
            <div
              className="rounded-[12px] p-4 space-y-3"
              style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[14px] font-semibold">
                    30s Product Launch Promo — Multi-Scene Timeline & Bilingual Subs
                  </div>
                  <div className="text-[11.5px] text-[var(--wb-muted)]">
                    Isolated GPU Pool · FFmpeg + Whisper-Large-v3 + Remotion Bundle
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {(["16:9", "9:16", "1:1"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setVideoRatio(r)}
                      className={`rounded-[6px] px-2.5 py-1 font-mono text-[11.5px] ${
                        videoRatio === r
                          ? "bg-[#2b66e0] text-white"
                          : "bg-[var(--wb-panel)] text-[var(--wb-muted)] border border-[var(--wb-line)]"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive Video Stage */}
              <div
                className="relative flex flex-col justify-between overflow-hidden rounded-[12px] p-6 min-h-[300px]"
                style={{
                  background: "radial-gradient(circle at 25% 20%, #1e3a8a 0%, #090a0f 70%)",
                  border: "1px solid var(--wb-line-strong)",
                }}
              >
                <div className="flex items-center justify-between text-[11.5px] font-mono text-white/80">
                  <span className="rounded bg-black/50 px-2.5 py-1">
                    SHOT {currentScene.shot} · {currentScene.time} · {videoRatio}
                  </span>
                  <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-emerald-300">
                    1080p 60fps · LUFS -14.1 dB
                  </span>
                </div>

                <div className="my-6 text-center space-y-2">
                  <div className="text-[12px] uppercase tracking-widest text-[#7cb0ff] font-semibold">
                    {currentScene.camera}
                  </div>
                  <div className="text-[22px] sm:text-[26px] font-bold text-white tracking-tight">
                    {currentScene.title}
                  </div>
                </div>

                {/* Bilingual Subtitle Burn-in Box */}
                <div className="mx-auto max-w-[600px] rounded-xl bg-black/75 backdrop-blur-md px-4 py-2.5 text-center space-y-1 border border-white/15">
                  <div className="text-[14px] font-semibold text-white">{currentScene.subTh}</div>
                  <div className="text-[12px] text-white/75">{currentScene.subEn}</div>
                </div>
              </div>

              {/* Timeline Transport & Scene Strip */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setVideoPlaying((p) => !p)}
                  className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#2b66e0] hover:bg-[#2458c6] px-4 py-2 text-[12.5px] font-semibold text-white"
                >
                  {videoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  <span>{videoPlaying ? "Pause Preview" : "Play 30s Master"}</span>
                </button>
                <div className="flex items-center gap-2">
                  <a
                    href="/api/artifacts?download=del_vid_169"
                    className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-[12px] font-medium hover:bg-[var(--wb-hover)]"
                    style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export MP4 ({videoRatio})</span>
                  </a>
                  <a
                    href="/api/artifacts?download=del_vid_proj"
                    className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-[12px] font-medium hover:bg-[var(--wb-hover)]"
                    style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                  >
                    <span>Remotion Project (.ZIP)</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Right: Editable Storyboard & Video Verification Report */}
            <div className="space-y-3">
              <div
                className="rounded-[12px] p-4 space-y-2.5"
                style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
              >
                <div className="text-[13px] font-semibold">Scene Storyboard & Subtitle Editor (Click to Select)</div>
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {scenes.map((sc, idx) => (
                    <div
                      key={sc.id}
                      onClick={() => setActiveSceneIdx(idx)}
                      className={`cursor-pointer rounded-[9px] p-2.5 space-y-1 transition-all ${
                        activeSceneIdx === idx ? "ring-1 ring-[#3b82f6]" : ""
                      }`}
                      style={{
                        backgroundColor: activeSceneIdx === idx ? "var(--wb-active)" : "var(--wb-panel)",
                        border: "1px solid var(--wb-line)",
                      }}
                    >
                      <div className="flex items-center justify-between text-[11.5px]">
                        <span className="font-mono font-bold text-[#7cb0ff]">
                          SHOT {sc.shot} ({sc.time})
                        </span>
                        <span className="text-[var(--wb-muted)]">{sc.camera}</span>
                      </div>
                      <div className="text-[12.5px] font-semibold">{sc.title}</div>
                      <input
                        type="text"
                        value={sc.subTh}
                        onChange={(e) => {
                          const val = e.target.value;
                          setScenes((prev) => prev.map((item, i) => (i === idx ? { ...item, subTh: val } : item)));
                        }}
                        className="mt-1 w-full rounded px-2 py-1 text-[11.5px] bg-[var(--wb-raised)] border border-[var(--wb-line)]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Video Verification Card */}
              <div
                className="rounded-[12px] p-4 space-y-2"
                style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-emerald-400">
                    ✓ Video Verification Report (ffprobe + Subtitles)
                  </span>
                  <span className="font-mono text-[11px] text-[var(--wb-muted)]">4/4 Checks</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-[var(--wb-muted)] font-mono">
                  <div className="rounded bg-[var(--wb-panel)] p-2">Codec: H.264 / AAC 48kHz</div>
                  <div className="rounded bg-[var(--wb-panel)] p-2">Duration: 30.00s Exact</div>
                  <div className="rounded bg-[var(--wb-panel)] p-2">Subtitle Drift: 0ms (TH/EN)</div>
                  <div className="rounded bg-[var(--wb-panel)] p-2">Editable: Remotion Bundle</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          AREA 3: WORK › ARTIFACTS (Claude Desktop Artifacts Gallery + Designer Mode + Live Split Editor)
         ===================================================================== */}
      {area === "artifacts" && (
        <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
          {/* Left + Center Gallery Column */}
          <div className={`flex-1 overflow-y-auto p-4 lg:p-5 space-y-4 ${artFull ? "hidden" : ""}`}>
            {/* Claude Desktop Artifacts Category Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "all" as const, label: "All Artifacts", Icon: Layers },
                  { id: "docs" as const, label: "Docs", Icon: FileText },
                  { id: "slides" as const, label: "Slides", Icon: Presentation },
                  { id: "design" as const, label: "Design", Icon: Palette },
                  { id: "dashboard" as const, label: "Dashboard", Icon: BarChart3 },
                  { id: "3d" as const, label: "3D Studio", Icon: Box },
                  { id: "shared" as const, label: "Shared with you", Icon: Share2 },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setArtCategory(cat.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                      artCategory === cat.id
                        ? "bg-[#2b66e0] text-white"
                        : "bg-[var(--wb-raised)] text-[var(--wb-muted)] hover:text-[var(--wb-fg)] border border-[var(--wb-line)]"
                    }`}
                  >
                    <cat.Icon className="h-3.5 w-3.5" />
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>

              <select
                value={artOrigin}
                onChange={(e) => setArtOrigin(e.target.value as any)}
                className="rounded-lg px-2.5 py-1 text-[11.5px] bg-[var(--wb-raised)] border border-[var(--wb-line)] text-[var(--wb-muted)]"
              >
                <option value="all">Origin: All (Work + Teammate)</option>
                <option value="work">Origin: Work Studio Only</option>
                <option value="teammate">Origin: Teammate Shared Library</option>
              </select>
            </div>

            {/* Designer Mode ("Ask-First" Brief Builder per nymoru01-work-areas-full.md) */}
            <form
              onSubmit={handleGenerateArtifact}
              className="rounded-[12px] p-4 space-y-3"
              style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#3b82f6]" />
                  <span className="text-[13px] font-semibold">
                    Designer Mode (Ask-First Brief) — เลือก Audience, Style และชนิดผลงานก่อนสร้างจริง
                  </span>
                </div>
                <span className="text-[11px] text-[var(--wb-muted)]">Shared Library with Teammate</span>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 text-[12px]">
                <div>
                  <label className="block text-[10.5px] text-[var(--wb-muted)] mb-1">1. Target Kind</label>
                  <select
                    value={briefTab}
                    onChange={(e) => setBriefTab(e.target.value as any)}
                    className="w-full rounded-[7px] px-2.5 py-1.5 bg-[var(--wb-panel)] border border-[var(--wb-line)]"
                  >
                    <option value="docs">Document (DOCX / PDF Report)</option>
                    <option value="slides">Presentation Deck (16:9 PPTX)</option>
                    <option value="design">UI / Web Design System</option>
                    <option value="dashboard">Executive BI Dashboard</option>
                    <option value="3d">3D Product Stage (PBR + HDRI)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10.5px] text-[var(--wb-muted)] mb-1">2. Target Audience</label>
                  <select
                    value={briefAudience}
                    onChange={(e) => setBriefAudience(e.target.value)}
                    className="w-full rounded-[7px] px-2.5 py-1.5 bg-[var(--wb-panel)] border border-[var(--wb-line)]"
                  >
                    <option value="Executive Board">Executive Board / CEO</option>
                    <option value="Enterprise Client">Enterprise B2B Client</option>
                    <option value="Engineering & Product">Engineering & Product Team</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10.5px] text-[var(--wb-muted)] mb-1">3. Visual & Tone System</label>
                  <select
                    value={briefStyle}
                    onChange={(e) => setBriefStyle(e.target.value)}
                    className="w-full rounded-[7px] px-2.5 py-1.5 bg-[var(--wb-panel)] border border-[var(--wb-line)]"
                  >
                    <option value="Linear/Stripe Minimal">Linear / Stripe High-Density</option>
                    <option value="Executive Editorial">Executive Editorial (Warm Paper)</option>
                    <option value="Bold Technical Dark">Bold Technical Graphite</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={briefPrompt}
                  onChange={(e) => setBriefPrompt(e.target.value)}
                  placeholder="ระบุหัวข้อหรือรายละเอียดที่ต้องการสร้าง (เช่น ข้อเสนอโครงการ AI Transformation สำหรับลูกค้าองค์กร)..."
                  className="flex-1 rounded-[8px] px-3 py-2 text-[13px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
                />
                <button
                  type="submit"
                  disabled={!briefPrompt.trim() || generatingArtifact}
                  className="rounded-[8px] bg-[#2b66e0] hover:bg-[#2458c6] disabled:opacity-40 px-4 py-2 text-[12.5px] font-semibold text-white shrink-0"
                >
                  {generatingArtifact ? "Generating Artifact..." : "Create Artifact →"}
                </button>
              </div>
            </form>

            {/* Artifacts Cards Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              {artifacts.map((art) => {
                const isSelected = selectedArtifact?.id === art.id;
                return (
                  <div
                    key={art.id}
                    onClick={() => {
                      setSelectedArtifact(art);
                      setEditingContent(art.content || "");
                    }}
                    className={`cursor-pointer rounded-[12px] p-4 transition-all space-y-2.5 ${
                      isSelected ? "ring-1 ring-[#3b82f6]" : "hover:border-[var(--wb-line-strong)]"
                    }`}
                    style={{
                      backgroundColor: isSelected ? "var(--wb-active)" : "var(--wb-raised)",
                      border: "1px solid var(--wb-line)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded bg-[#2b66e0]/20 px-2 py-0.5 text-[10.5px] font-semibold uppercase text-[#7cb0ff]">
                        {art.tab} · {art.subKind}
                      </span>
                      <span className="font-mono text-[11px] text-[var(--wb-muted)] tabular-nums">
                        v{art.currentVersion || art.versions || 1}
                      </span>
                    </div>
                    <div className="text-[14px] font-semibold leading-snug">{art.title}</div>
                    <p className="line-clamp-2 text-[12px] text-[var(--wb-muted)]">{art.summary}</p>
                    <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--wb-muted)]">
                      <span>Origin: {art.origin === "work" ? "Work Studio" : "Teammate"}</span>
                      <span className="text-emerald-400">✓ Verified & Editable</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT LIVE ARTIFACT EDITOR & INSPECTOR PANEL (Claude Artifacts Split Pane) */}
          {selectedArtifact && (
            <aside
              className={`flex flex-col shrink-0 ${
                artFull ? "w-full" : "w-full lg:w-[480px] xl:w-[540px]"
              }`}
              style={{
                backgroundColor: "var(--wb-panel)",
                borderLeft: "1px solid var(--wb-line)",
              }}
            >
              {/* Artifact Toolbar (Zoom, Version, Fullscreen, Save, Download) */}
              <div
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                style={{ borderBottom: "1px solid var(--wb-line)", backgroundColor: "var(--wb-sidebar)" }}
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">{selectedArtifact.title}</div>
                  <div className="text-[11px] text-[var(--wb-muted)] font-mono">
                    {selectedArtifact.subKind} · Version v{selectedArtifact.currentVersion || 1}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={artZoom}
                    onChange={(e) => setArtZoom(Number(e.target.value))}
                    className="rounded px-2 py-1 text-[11px] bg-[var(--wb-raised)] border border-[var(--wb-line)] font-mono"
                  >
                    <option value={90}>90%</option>
                    <option value={100}>100%</option>
                    <option value={115}>115%</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setArtFull((f) => !f)}
                    className="flex h-7 w-7 items-center justify-center rounded bg-[var(--wb-raised)] border border-[var(--wb-line)] text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                    title="Toggle Fullscreen Artifact View"
                  >
                    {artFull ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveArtifactEdit}
                    className="rounded-[6px] bg-[#2b66e0] hover:bg-[#2458c6] px-2.5 py-1 text-[11.5px] font-medium text-white"
                  >
                    {savingArtifact ? "Saving..." : "Save v+1"}
                  </button>
                  <a
                    href={`/api/artifacts?download=${selectedArtifact.id}`}
                    className="rounded-[6px] bg-[var(--wb-raised)] border border-[var(--wb-line)] px-2.5 py-1 text-[11.5px] font-medium hover:bg-[var(--wb-hover)]"
                  >
                    Export
                  </a>
                </div>
              </div>

              {/* Live In-Place Editor + Rendered Preview */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-4"
                style={{ fontSize: `${artZoom}%` }}
              >
                <div
                  className="rounded-[10px] p-4 space-y-2"
                  style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                >
                  <div className="flex items-center justify-between text-[11px] text-[var(--wb-muted)]">
                    <span>LIVE IN-PLACE EDITOR (Autosaves new version on Save)</span>
                    <span className="text-emerald-400"> Hand Edit + AI Sync</span>
                  </div>
                  <textarea
                    rows={12}
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    className="w-full rounded-lg p-3 font-mono text-[12.5px] leading-relaxed bg-[var(--wb-panel)] border border-[var(--wb-line)] text-[var(--wb-fg)] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
                  />
                </div>

                {/* Formatted Document / Slide / 3D / Dashboard Preview */}
                <div
                  className="rounded-[10px] p-4 space-y-2"
                  style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7cb0ff]">
                    Rendered Deliverable Preview ({selectedArtifact.tab.toUpperCase()})
                  </div>
                  <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--wb-fg)]">
                    {editingContent}
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--wb-muted)]">Loading Work Studio...</div>}>
      <WorkStudioInner />
    </Suspense>
  );
}
