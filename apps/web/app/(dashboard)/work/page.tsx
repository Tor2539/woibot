"use client";
import { useState, useMemo } from "react";
import { mockProjects } from "@/lib/work/mock";
import type { WorkProject } from "@/lib/work/mock";
import type { WorkKind, TaskStatusId } from "@/lib/work/templates";
import { ProjectFilters, ProjectCard } from "@/components/work/ProjectFilters";
import { CreateProjectDialog } from "@/components/work/CreateProjectDialog";
import type { ExecutionMode } from "@/lib/work/templates";
import { WORK_KINDS, TASK_STATUSES } from "@/lib/work/templates";

export default function WorkListPage() {
  const [projects, setProjects] = useState<WorkProject[]>(() => mockProjects());
  const [filterKind, setFilterKind] = useState<WorkKind | "all">("all");
  const [filterStatus, setFilterStatus] = useState<TaskStatusId | "all">("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState("");

  const filtered = useMemo(() => {
    return projects.filter(p => {
      if (filterKind !== "all" && p.kind !== filterKind) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (search && !`${p.title} ${p.goal}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [projects, filterKind, filterStatus, search]);

  function handleCreate(data: { title: string; goal: string; kind: WorkKind; executionMode: ExecutionMode; cost: number }) {
    const id = "w_" + Math.random().toString(36).slice(2, 8);
    const now = new Date().toISOString();
    const tplKind = data.kind;
    // lazy import estimate to avoid circular — inline
    const kindCosts: Record<string, { cost: number; minutes: number; label: string }> = {
      coding: { cost: 2.4, minutes: 18, label: "Coding — build + tests + preview" },
      doc: { cost: 0.8, minutes: 10, label: "Document — 12 pages + charts" },
      video_gen: { cost: 8.5, minutes: 25, label: "Video Gen — 30s × 3 (GPU)" },
      video_analysis: { cost: 3.0, minutes: 15, label: "Video Analysis — 60 min → 5 clips" },
      research: { cost: 1.2, minutes: 12, label: "Research — multi-source + report" },
      data: { cost: 1.5, minutes: 14, label: "Data & BI — clean + model + dashboard" },
      media_heavy: { cost: 5.0, minutes: 20, label: "Media Heavy — batch" },
    };
    const b = kindCosts[tplKind] ?? kindCosts.coding;
    const newProj: WorkProject = {
      id, title: data.title, goal: data.goal, kind: data.kind,
      status: "queued", executionMode: data.executionMode, progress: 0,
      traceId: "tr_" + Math.random().toString(36).slice(2, 8),
      estimate: { kind: data.kind, cost: b.cost * (data.executionMode === "local" ? 0.7 : 1), minutes: b.minutes, label: b.label, tools: ["queued"], executionMode: data.executionMode, approved: false, breakdown: [{ item: "estimate", cost: b.cost }] },
      createdAt: now, updatedAt: now,
    };
    newProj.estimate.cost = Math.round(newProj.estimate.cost * 100) / 100;
    setProjects(prev => [newProj, ...prev]);
    setShowCreate(false);
    setToast(`สร้างโปรเจกต์แล้ว • ${data.title} — ไปที่ workspace เพื่ออนุมัติ cost gate ก่อนเริ่ม`);
    setTimeout(() => setToast(""), 4000);
  }

  const stats = {
    total: projects.length,
    inProgress: projects.filter(p => p.status === "in_progress").length,
    completed: projects.filter(p => p.status === "completed").length,
  };

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 1180, margin: "0 auto", padding: "20px 16px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#6b7280" }}>WOIBOT WORK</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: "4px 0 6px" }}>Work — Project Workspace</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: 0, maxWidth: 580 }}>
            พื้นที่ทำงานสำหรับงานหนักที่ต้องส่ง Deliverables จริง — Coding / Docs / Video / Research / Data • เลือก Cloud หรือ Local • estimate ก่อนเริ่มทุกครั้ง
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 11, color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 999, padding: "6px 10px", background: "#fff" }}>
            {stats.total} projects • {stats.inProgress} active • {stats.completed} completed
          </div>
          <button onClick={() => setShowCreate(true)} style={{ padding: "10px 16px", borderRadius: 999, border: 0, background: "#0f172a", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>＋ New Project</button>
        </div>
      </div>

      {/* WorkKind quick legend */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
        {WORK_KINDS.map(k => (
          <span key={k.id} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 999, border: `1px solid ${k.color}33`, color: k.color, background: `${k.color}0d` }}>{k.icon} {k.label}</span>
        ))}
        <span style={{ fontSize: 10, color: "#9ca3af", alignSelf: "center", marginLeft: 6 }}>Filter by WorkKind: coding / doc / video / research / data</span>
      </div>

      {/* Filters */}
      <div style={{ marginTop: 14, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
        <ProjectFilters
          filterKind={filterKind} setFilterKind={setFilterKind}
          filterStatus={filterStatus} setFilterStatus={setFilterStatus}
          search={search} setSearch={setSearch}
        />
      </div>

      {/* Cost gate banner */}
      <div style={{ marginTop: 12, background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#3730a3" }}>Principle • หลักการ:</span>
        <span style={{ fontSize: 11, color: "#4338ca" }}>ก่อนเริ่มงานหนัก แสดง estimated_cost + estimated_time + required_tools ให้ผู้ใช้อ นุมัติ • เคารพ perTaskCap / monthlyCap • Cloud vs Local ชัดเจน</span>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12, marginTop: 14 }}>
        {filtered.map(p => (
          <ProjectCard key={p.id} p={p} onOpen={() => { window.location.href = `/work/${p.id}`; }} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
          <div style={{ fontSize: 14 }}>ไม่พบโปรเจกต์ที่ตรงกับตัวกรอง</div>
          <button onClick={() => { setFilterKind("all"); setFilterStatus("all"); setSearch(""); }} style={{ marginTop: 10, fontSize: 12, padding: "7px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>ล้างตัวกรอง</button>
        </div>
      )}

      {/* Templates showcase — WorkKind-specific */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>Templates ตาม WorkKind</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10, marginTop: 8 }}>
          {(["coding", "doc", "video_gen"] as const).map(k => {
            const t = WORK_KINDS.find(x => x.id === k)!;
            const tpl = { coding: ["CRM + Dashboard", "Add Stripe checkout", "Fix slow orders table"], doc: ["Proposal 15 หน้า", "Q4 Sales Deck", "Contract Redline"], video_gen: ["30s Ad ×3", "Product Explainer", "Storyboard + Shotlist"] }[k];
            return (
              <div key={k} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: t.color }}>{t.icon} {t.label} • {t.labelTh}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>{tpl.join(" • ")}</div>
                <button onClick={() => setShowCreate(true)} style={{ marginTop: 10, fontSize: 11, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer" }}>ใช้เทมเพลตนี้ →</button>
              </div>
            );
          })}
        </div>
      </div>

      {toast && <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "#0f172a", color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", zIndex: 60 }}>{toast}</div>}

      <CreateProjectDialog open={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
    </div>
  );
}
