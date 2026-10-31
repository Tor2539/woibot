"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Code2,
  Clapperboard,
  Layers,
  Cloud,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Download,
  Plus,
  Terminal,
  FileCode2,
  Eye,
  ShieldCheck,
  XCircle,
  Sparkles,
  Maximize2,
  Minimize2,
  FileText,
  Presentation,
  Palette,
  BarChart3,
  Box,
  Share2,
  RefreshCw,
} from "lucide-react";

type WorkArea = "code" | "video" | "artifacts";
type ArtifactCategory = "all" | "shared" | "docs" | "slides" | "design" | "dashboard" | "3d";

function WorkStudioInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const areaParam = (searchParams.get("area") as WorkArea) || "code";

  const [area, setArea] = useState<WorkArea>(areaParam);
  const [execMode, setExecMode] = useState<"cloud" | "local">("cloud");
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [codeRightTab, setCodeRightTab] = useState<"preview" | "terminal" | "verify">("preview");

  // Live Work Ledger (real spend/caps from /api/usage — cost isolation)
  const [usage, setUsage] = useState<any | null>(null);

  // New Work Job Builder + Estimate Gate
  const [newGoal, setNewGoal] = useState("");
  const [newKind, setNewKind] = useState<"coding" | "doc" | "data" | "research" | "image" | "video_analysis">("coding");
  const [creatingJob, setCreatingJob] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [runNotice, setRunNotice] = useState<string>("");

  // Video Work state (real video_analysis / video_gen tasks — no fake storyboard)
  const [videoKind, setVideoKind] = useState<"video_analysis" | "video_gen">("video_analysis");
  const [videoGoal, setVideoGoal] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoError, setVideoError] = useState("");

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

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((res) => setUsage(res?.data || res))
      .catch(() => {});
  }, []);

  const switchArea = (next: WorkArea) => {
    setArea(next);
    router.push(`/work?area=${next}`);
  };

  // Rough client-side preview only — the server quotes the real estimate on create.
  const estimatedCost =
    newKind === "coding" ? 2.4
    : newKind === "doc" ? 0.8
    : newKind === "data" ? 1.5
    : newKind === "image" ? 0.5
    : newKind === "video_analysis" ? 3.0
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
      const created = json?.data?.id ? json.data : json?.data?.task || json?.task;
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
        body: JSON.stringify({ approveEstimate: true, status: "queued" }),
      });
      const runRes = await fetch(`/api/tasks/${task.id}/run`, { method: "POST" }).then((r) => r.json());
      if (!runRes?.ok) {
        setRunNotice(String(runRes?.error || "รันไม่สำเร็จ"));
      } else {
        setRunNotice("เสร็จแล้ว — ดูผลได้ที่แท็บ Verification");
      }
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
  const videoTasks = tasks.filter((t) => t.workKind === "video_analysis" || t.workKind === "video_gen");

  const fmtUsd = (v: unknown) => (typeof v === "number" ? `$${v.toFixed(2)}` : "—");
  const workUsed = usage?.work?.quota?.monthlyUsed;
  const workMonthlyCap = usage?.guardrails?.monthlyCap;
  const workPerTaskCap = usage?.guardrails?.perTaskCap;

  const handleCreateVideoJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoGoal.trim() || videoBusy) return;
    setVideoBusy(true);
    setVideoError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: videoGoal.trim().slice(0, 72),
          goal: videoGoal.trim(),
          product: "work",
          workKind: videoKind,
          executionMode: execMode,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        setVideoError(String(json?.error || `สร้างงานไม่สำเร็จ (${res.status})`));
        return;
      }
      const created = json?.data?.id ? json.data : json?.task;
      if (created) {
        setTasks((prev) => [created, ...prev]);
        setVideoGoal("");
      }
    } catch {
      setVideoError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ลองใหม่อีกครั้ง");
    } finally {
      setVideoBusy(false);
    }
  };

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

          {/* Execution Mode Switcher: Cloud vs Local — compact segmented control tucked next to area tabs */}
          <div
            className="inline-flex items-center gap-0.5 rounded-[6px] p-[2px] text-[11px]"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
            role="radiogroup"
            aria-label="Execution Mode: Cloud vs Local"
          >
            <button
              type="button"
              onClick={() => setExecMode("cloud")}
              aria-pressed={execMode === "cloud"}
              className={`inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 font-medium transition-colors ${
                execMode === "cloud" ? "bg-[#2b66e0] text-white" : "text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
              }`}
            >
              <Cloud className="h-2.5 w-2.5" />
              <span>Cloud</span>
            </button>
            <button
              type="button"
              onClick={() => setExecMode("local")}
              aria-pressed={execMode === "local"}
              className={`inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 font-medium transition-colors ${
                execMode === "local" ? "bg-amber-500 text-black font-semibold" : "text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
              }`}
            >
              <Laptop className="h-2.5 w-2.5" />
              <span>Local</span>
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
            Work Ledger: <strong className="text-[#7cb0ff]">{usage ? fmtUsd(workUsed) : "…"}</strong> / {usage ? fmtUsd(workMonthlyCap) : "…"} cap
          </span>
        </div>
      </header>

      {/* =====================================================================
          AREA 1: WORK › CODE (Autonomous Software Engineering + Verification)
         ===================================================================== */}
      {area === "code" && (
        <div className="flex-1 p-4 lg:p-5 space-y-4">
          {runNotice && (
            <div
              className="flex items-center justify-between rounded-[8px] px-3 py-2 text-[12px]"
              style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
            >
              <span>{runNotice}</span>
              <button type="button" onClick={() => setRunNotice("")} className="text-[11px] text-[var(--wb-muted)] hover:text-[var(--wb-fg)]">
                ปิด
              </button>
            </div>
          )}
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
                <span className="text-[var(--wb-muted)]">Per-task cap: {usage ? fmtUsd(workPerTaskCap) : "…"}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as any)}
                className="min-h-[40px] sm:min-h-0 rounded-[8px] px-3 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
              >
                <option value="coding">Coding — สร้างเว็บ/แอป + screenshot หลักฐาน</option>
                <option value="doc">Documents — DOCX + PDF (จัดหน้าให้จริง)</option>
                <option value="data">Data — Excel (xlsx) / CSV / วิเคราะห์ด้วย pandas</option>
                <option value="image">Image — อ่านภาพ (OCR + vision) ออกรายงาน</option>
                <option value="video_analysis">Video — ตรวจ/ตัดไฮไลต์ด้วย ffmpeg</option>
                <option value="research">Research — ค้นเว็บจริง (Parallel) + อ้างอิงแหล่งข้อมูล</option>
              </select>
              <input
                type="text"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="สั่งโปรเจกต์ให้ Work ลงมือทำจนจบ (เช่น สร้างระบบ CRM พร้อม Login, Dashboard และ Playwright Tests)..."
                className="min-h-[40px] sm:min-h-0 flex-1 rounded-[8px] px-3.5 py-2 text-[13.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)] text-[var(--wb-fg)] placeholder:text-[var(--wb-muted)]"
              />
              <button
                type="submit"
                disabled={!newGoal.trim() || creatingJob}
                className="min-h-[40px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 rounded-[8px] bg-[#2b66e0] hover:bg-[#2458c6] disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-[12.5px] font-semibold text-white shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>
                  {creatingJob
                    ? "Creating..."
                    : !newGoal.trim()
                    ? "กรอกรายละเอียดก่อน"
                    : "Approve & Launch Job"}
                </span>
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
                        <span className="shrink-0 font-mono text-[11.5px] font-semibold text-[#7cb0ff] tabular-nums" title="Estimate (จากระบบ)">
                          {t.estimate?.cost != null ? `$${Number(t.estimate.cost).toFixed(2)}` : "—"}
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
                          {t.status.replace(/_/g, " ")} ({t.progress ?? 0}%)
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
                            className="min-h-[40px] sm:min-h-0 w-full rounded-[7px] bg-amber-500 hover:bg-amber-400 py-1.5 text-[11.5px] font-semibold text-black"
                          >
                            {verifyingId === t.id
                              ? "Executing & Running Verification..."
                              : t.estimate?.cost != null
                              ? `Approve Estimate ($${Number(t.estimate.cost).toFixed(2)}) & Run Now`
                              : "Approve Estimate & Run Now"}
                          </button>
                        </div>
                      )}

                      {ver && ver.passed && (
                        <div className="flex items-center justify-between rounded-md bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 text-[11px] text-emerald-400">
                          <span>
                            ✓ Verified{Array.isArray(ver.checks) && ver.checks.length > 0 ? ` (${ver.checks.length} checks passed)` : ""}
                          </span>
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
                      Trace: {activeTask.traceId} · Mode: {activeTask.executionMode.toUpperCase()} · Deliverables: {(((activeTask as any).deliverables as any[]) || []).length}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApproveAndRunTask(activeTask)}
                      className="min-h-[40px] sm:min-h-0 inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-[11.5px] font-medium hover:bg-[var(--wb-hover)]"
                      style={{ border: "1px solid var(--wb-line)", backgroundColor: "var(--wb-raised)" }}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${verifyingId === activeTask.id ? "animate-spin" : ""}`} />
                      <span>Re-Verify</span>
                    </button>
                  </div>
                </div>

                {/* Inspector Tabs: Live App Preview | Code & Diff | Container Terminal | Verification Report */}
                <div
                  className="flex flex-wrap items-center gap-1 px-3 py-1.5"
                  style={{ borderBottom: "1px solid var(--wb-line)", backgroundColor: "var(--wb-sidebar)" }}
                >
                  {[
                    { id: "preview" as const, label: `Deliverables (${(((activeTask as any).deliverables as any[]) || []).length})`, Icon: Eye },
                    { id: "terminal" as const, label: "Container", Icon: Terminal },
                    {
                      id: "verify" as const,
                      label: activeTask.verification
                        ? `Verification (${activeTask.verification.checks.filter((c: any) => c.passed).length}/${activeTask.verification.checks.length})`
                        : "Verification",
                      Icon: ShieldCheck,
                    },
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
                    <div className="space-y-3">
                      {((((activeTask as any).deliverables as any[]) || []).length === 0) ? (
                        <div
                          className="rounded-[10px] p-6 text-center space-y-1.5"
                          style={{ backgroundColor: "var(--wb-panel)", border: "1px dashed var(--wb-line-strong)" }}
                        >
                          <div className="text-[13px] font-semibold">ยังไม่มีไฟล์ส่งมอบ</div>
                          <div className="text-[11.5px] text-[var(--wb-muted)]">
                            เมื่อ Work รันงานเสร็จ ไฟล์จริงจะปรากฏที่นี่พร้อมลิงก์ดาวน์โหลด —
                            หน้านี้ไม่แสดงตัวอย่างที่สร้างขึ้นเอง
                          </div>
                        </div>
                      ) : (
                        (((activeTask as any).deliverables as any[]) || []).map((d: any) => (
                          <a
                            key={d.id || d.fileName}
                            href={d.fileUrl || "#"}
                            className="flex items-center justify-between gap-3 rounded-[9px] px-3.5 py-2.5 transition-colors hover:brightness-110"
                            style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <FileCode2 className="h-4 w-4 shrink-0 text-[#7cb0ff]" />
                              <div className="min-w-0">
                                <div className="truncate text-[12.5px] font-medium">{d.fileName || "deliverable"}</div>
                                <div className="text-[10.5px] text-[var(--wb-muted)]">
                                  {d.kind || "file"} · {d.mimeType || "application/octet-stream"}
                                </div>
                              </div>
                            </div>
                            <Download className="h-3.5 w-3.5 shrink-0 text-[var(--wb-muted)]" />
                          </a>
                        ))
                      )}

                      {activeTask.verification && (
                        <div
                          className="flex items-center justify-between rounded-[9px] px-3.5 py-2.5"
                          style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.28)" }}
                        >
                          <div className="flex items-center gap-2.5">
                            <ShieldCheck className="h-4 w-4 text-emerald-400" />
                            <div>
                              <div className="text-[12.5px] font-medium">verification_report.json</div>
                              <div className="text-[10.5px] text-[var(--wb-muted)]">
                                mode: {activeTask.verification.mode || "live"} · {activeTask.verification.checks.length} checks
                              </div>
                            </div>
                          </div>
                          <a
                            href={`/api/tasks/${activeTask.id}`}
                            className="rounded-[6px] px-2.5 py-1 text-[11px] font-medium text-emerald-300"
                            style={{ border: "1px solid rgba(16,185,129,0.4)" }}
                          >
                            ดูรายงาน
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {codeRightTab === "terminal" && (
                    <div
                      className="rounded-[10px] p-5 space-y-2 text-center"
                      style={{ backgroundColor: "#090a0f", border: "1px solid var(--wb-line)" }}
                    >
                      <div className="text-[13px] font-semibold text-[var(--wb-fg)]">Container terminal</div>
                      <div className="text-[11.5px] text-[var(--wb-muted)]">
                        ทุกคำสั่งรันใน Cloud Computer ของคุณจริง เปิดหน้า Computer เพื่อใช้ terminal แบบเต็ม
                        หรือกด Verify เพื่อดูผลคำสั่งที่ระบบรันให้
                      </div>
                      <a
                        href="/computer"
                        className="inline-flex items-center gap-1.5 rounded-[7px] bg-[#2b66e0] px-3 py-1.5 text-[11.5px] font-medium text-white"
                      >
                        <Terminal className="h-3.5 w-3.5" /> เปิด Cloud Computer
                      </a>
                    </div>
                  )}

                  {codeRightTab === "verify" && (
                    <div className="space-y-3">
                      {!activeTask.verification ? (
                        <div
                          className="rounded-[10px] p-6 text-center space-y-1.5"
                          style={{ backgroundColor: "var(--wb-panel)", border: "1px dashed var(--wb-line-strong)" }}
                        >
                          <div className="text-[13px] font-semibold">ยังไม่ได้ตรวจสอบงานนี้</div>
                          <div className="text-[11.5px] text-[var(--wb-muted)]">
                            กด Re-Verify ระบบจะรันเครื่องมือจริงใน Cloud Computer ของคุณ
                            (ffprobe / LibreOffice / pandas / tsc) แล้วบันทึกผลเป็น verification_report.json
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            className="flex items-center justify-between gap-3 rounded-[10px] p-3.5"
                            style={{
                              backgroundColor: activeTask.verification.passed ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                              border: `1px solid ${activeTask.verification.passed ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                            }}
                          >
                            <div className="min-w-0">
                              <div className={`text-[13px] font-semibold ${activeTask.verification.passed ? "text-emerald-400" : "text-red-400"}`}>
                                {activeTask.verification.passed ? "ผ่านการตรวจสอบ" : "ไม่ผ่านการตรวจสอบ"} · mode {activeTask.verification.mode || "live"}
                              </div>
                              <div className="text-[11.5px] text-[var(--wb-muted)]">{activeTask.verification.summary}</div>
                            </div>
                            <a
                              href={`/api/tasks/${activeTask.id}`}
                              className="shrink-0 rounded-[7px] bg-emerald-600 px-3 py-1.5 text-[11.5px] font-medium text-white"
                            >
                              Download JSON
                            </a>
                          </div>

                          <div className="space-y-2">
                            {activeTask.verification.checks.map((chk: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-3 rounded-[8px] px-3.5 py-2.5 text-[12.5px]"
                                style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  {chk.passed ? (
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                                  ) : (
                                    <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                                  )}
                                  <span className="font-mono font-semibold">{chk.name}</span>
                                  {chk.severity && (
                                    <span className="rounded px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-[var(--wb-muted)]" style={{ border: "1px solid var(--wb-line)" }}>
                                      {chk.severity}
                                    </span>
                                  )}
                                </div>
                                <span className="truncate text-right text-[11.5px] text-[var(--wb-muted)]">{chk.detail}</span>
                              </div>
                            ))}
                          </div>

                          {activeTask.verification.limitations?.length ? (
                            <div className="rounded-[8px] px-3.5 py-2.5 text-[11.5px] text-[var(--wb-muted)]" style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}>
                              <span className="font-semibold text-[var(--wb-fg)]">ข้อจำกัด: </span>
                              {activeTask.verification.limitations.join(" · ")}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          AREA 2: WORK › VIDEO (real video_analysis / video_gen tasks on Cloud Computer)
         ===================================================================== */}
      {area === "video" && (
        <div className="flex-1 p-4 lg:p-5 space-y-4">
          {/* Create Video Work Job */}
          <form
            onSubmit={handleCreateVideoJob}
            className="rounded-[12px] p-4 space-y-3"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clapperboard className="h-4 w-4 text-[#3b82f6]" />
                <span className="text-[13.5px] font-semibold">
                  สร้างงานวิดีโอใหม่ — ประมวลผลจริงด้วย FFmpeg/ffprobe บน Cloud Computer
                </span>
              </div>
              <span className="rounded bg-[#2b66e0]/20 px-2 py-0.5 font-mono text-[11.5px] tabular-nums text-[#7cb0ff]">
                {videoKind === "video_analysis" ? "Est. ~$3.00" : "Est. ~$1.20"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={videoKind}
                onChange={(e) => setVideoKind(e.target.value as "video_analysis" | "video_gen")}
                className="min-h-[40px] sm:min-h-0 rounded-[8px] px-3 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
              >
                <option value="video_analysis">Video Analysis — ตรวจวิดีโอ/ตัดไฮไลต์ + รายงาน (ffmpeg + scene detect)</option>
                <option value="video_gen">Video Compose — ประกอบคลิป/ title cards + เสียง เป็น MP4</option>
              </select>
              <input
                type="text"
                value={videoGoal}
                onChange={(e) => setVideoGoal(e.target.value)}
                placeholder="อธิบายงานวิดีโอ เช่น วิเคราะห์คลิป meeting-recording.mp4 แล้วตัดไฮไลต์ 5 ช่วงสำคัญ..."
                className="min-h-[40px] sm:min-h-0 flex-1 rounded-[8px] px-3.5 py-2 text-[13px] bg-[var(--wb-panel)] border border-[var(--wb-line)] text-[var(--wb-fg)] placeholder:text-[var(--wb-muted)]"
              />
              <button
                type="submit"
                disabled={!videoGoal.trim() || videoBusy}
                className="min-h-[40px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 rounded-[8px] bg-[#2b66e0] hover:bg-[#2458c6] disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-[12.5px] font-semibold text-white shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>
                  {videoBusy
                    ? "Creating..."
                    : !videoGoal.trim()
                    ? "กรอกรายละเอียดก่อน"
                    : "สร้างงานวิดีโอ"}
                </span>
              </button>
            </div>

            {videoError && (
              <div
                className="flex items-start gap-2 rounded-[8px] px-3 py-2 text-[12px] text-[var(--wb-danger)]"
                style={{ backgroundColor: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)" }}
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 break-words">{videoError}</span>
              </div>
            )}

            <p className="text-[11px] text-[var(--wb-muted)]">
              ทุกงานผ่าน Estimate Gate ก่อนรัน — เมื่อเสร็จจะส่งมอบไฟล์จริง (MP4 / รายงาน) พร้อม verification_report.json ที่ตรวจด้วย ffprobe ในเครื่องของคุณ
            </p>
          </form>

          {/* Real Video Task Queue */}
          <div className="space-y-2">
            <div className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--wb-muted)] px-1">
              Video Work Queue ({videoTasks.length})
            </div>
            {videoTasks.length === 0 ? (
              <div
                className="rounded-[12px] px-4 py-8 text-center space-y-1.5"
                style={{ backgroundColor: "var(--wb-raised)", border: "1px dashed var(--wb-line-strong)" }}
              >
                <div className="text-[13px] font-semibold">ยังไม่มีงานวิดีโอในคิวของคุณ</div>
                <div className="text-[11.5px] text-[var(--wb-muted)]">
                  สร้างงานจากฟอร์มด้านบน — หน้านี้แสดงเฉพาะงานจริงและไฟล์จริงที่ระบบสร้าง ไม่มี storyboard ตัวอย่างปลอม
                </div>
              </div>
            ) : (
              videoTasks.map((t) => {
                const dels = ((t as any).deliverables as any[]) || [];
                const ver = t.verification;
                return (
                  <div
                    key={t.id}
                    className="rounded-[12px] p-4 space-y-2.5"
                    style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              t.status === "completed"
                                ? "bg-emerald-400"
                                : t.status === "waiting_for_user"
                                ? "bg-amber-400 animate-pulse"
                                : t.status === "failed" || t.status === "cancelled"
                                ? "bg-red-400"
                                : "bg-[#3b82f6]"
                            }`}
                          />
                          <span className="text-[13px] font-semibold break-words">{t.title}</span>
                          <span className="rounded bg-[#2b66e0]/15 px-1.5 py-0.5 text-[10px] uppercase text-[#7cb0ff]">
                            {t.workKind}
                          </span>
                        </div>
                        <p className="mt-1 text-[11.5px] text-[var(--wb-muted)] line-clamp-2">{t.goal}</p>
                      </div>
                      <div className="shrink-0 text-right space-y-1">
                        <div className="font-mono text-[11.5px] tabular-nums text-[#7cb0ff]">
                          {t.estimate?.cost != null ? `$${Number(t.estimate.cost).toFixed(2)}` : "—"}
                        </div>
                        <div className="text-[10.5px] capitalize text-[var(--wb-fg-soft)]">
                          {t.status.replace(/_/g, " ")} ({t.progress ?? 0}%)
                        </div>
                      </div>
                    </div>

                    <div className="font-mono text-[10.5px] text-[var(--wb-muted)] break-all">{t.traceId}</div>

                    {dels.length > 0 ? (
                      <div className="space-y-1.5">
                        {dels.map((d: any) => (
                          <a
                            key={d.id || d.fileName}
                            href={d.fileUrl || "#"}
                            className="flex items-center justify-between gap-3 rounded-[9px] px-3 py-2 transition-colors hover:brightness-110"
                            style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <FileCode2 className="h-3.5 w-3.5 shrink-0 text-[#7cb0ff]" />
                              <span className="truncate text-[12px] font-medium">{d.fileName || "deliverable"}</span>
                            </div>
                            <Download className="h-3.5 w-3.5 shrink-0 text-[var(--wb-muted)]" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[9px] px-3 py-2 text-[11.5px] text-[var(--wb-muted)]" style={{ backgroundColor: "var(--wb-panel)", border: "1px dashed var(--wb-line)" }}>
                        ยังไม่มีไฟล์ส่งมอบ — ไฟล์จริงจะปรากฏที่นี่เมื่องานรันเสร็จและผ่านการตรวจ
                      </div>
                    )}

                    {ver && (
                      <div
                        className="flex items-center gap-2 rounded-md px-2.5 py-1 text-[11px]"
                        style={{
                          backgroundColor: ver.passed ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                          border: `1px solid ${ver.passed ? "rgba(16,185,129,0.28)" : "rgba(239,68,68,0.28)"}`,
                          color: ver.passed ? "#34d399" : "#f87171",
                        }}
                      >
                        {ver.passed ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                        <span className="min-w-0 break-words">
                          {ver.passed ? "ผ่านการตรวจ" : "ไม่ผ่านการตรวจ"}
                          {Array.isArray(ver.checks) && ver.checks.length > 0 ? ` · ${ver.checks.length} checks` : ""}
                          {ver.mode ? ` · mode ${ver.mode}` : ""}
                        </span>
                      </div>
                    )}

                    {t.status === "waiting_for_user" && (
                      <button
                        type="button"
                        onClick={() => handleApproveAndRunTask(t)}
                        disabled={verifyingId === t.id}
                        className="min-h-[40px] sm:min-h-0 w-full rounded-[7px] bg-amber-500 hover:bg-amber-400 py-1.5 text-[11.5px] font-semibold text-black disabled:opacity-50"
                      >
                        {verifyingId === t.id
                          ? "Executing & Running Verification..."
                          : t.estimate?.cost != null
                          ? `Approve Estimate ($${Number(t.estimate.cost).toFixed(2)}) & Run Now`
                          : "Approve Estimate & Run Now"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
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
                  className="min-h-[40px] sm:min-h-0 flex-1 rounded-[8px] px-3 py-2 text-[13px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
                />
                <button
                  type="submit"
                  disabled={!briefPrompt.trim() || generatingArtifact}
                  className="min-h-[40px] sm:min-h-0 rounded-[8px] bg-[#2b66e0] hover:bg-[#2458c6] disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-[12.5px] font-semibold text-white shrink-0"
                >
                  {generatingArtifact
                    ? "Generating Artifact..."
                    : !briefPrompt.trim()
                    ? "กรอกรายละเอียดก่อน"
                    : "Create Artifact →"}
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

                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={artZoom}
                    onChange={(e) => setArtZoom(Number(e.target.value))}
                    className="min-h-[40px] sm:min-h-0 rounded px-2 py-1 text-[11px] bg-[var(--wb-raised)] border border-[var(--wb-line)] font-mono"
                  >
                    <option value={90}>90%</option>
                    <option value={100}>100%</option>
                    <option value={115}>115%</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setArtFull((f) => !f)}
                    className="flex h-10 w-10 sm:h-7 sm:w-7 items-center justify-center rounded bg-[var(--wb-raised)] border border-[var(--wb-line)] text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                    title="Toggle Fullscreen Artifact View"
                  >
                    {artFull ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveArtifactEdit}
                    className="min-h-[40px] sm:min-h-0 rounded-[6px] bg-[#2b66e0] hover:bg-[#2458c6] px-2.5 py-1 text-[11.5px] font-medium text-white"
                  >
                    {savingArtifact ? "Saving..." : "Save v+1"}
                  </button>
                  <a
                    href={`/api/artifacts?download=${selectedArtifact.id}`}
                    className="min-h-[40px] sm:min-h-0 inline-flex items-center rounded-[6px] bg-[var(--wb-raised)] border border-[var(--wb-line)] px-2.5 py-1 text-[11.5px] font-medium hover:bg-[var(--wb-hover)]"
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
