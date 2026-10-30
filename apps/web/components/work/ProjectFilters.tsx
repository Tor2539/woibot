"use client";
import type { WorkProject } from "@/lib/work/mock";
import { WORK_KINDS, TASK_STATUSES } from "@/lib/work/templates";
import type { WorkKind, TaskStatusId } from "@/lib/work/templates";

export function ProjectFilters({
  filterKind, setFilterKind, filterStatus, setFilterStatus, search, setSearch,
}: {
  filterKind: WorkKind | "all";
  setFilterKind: (v: WorkKind | "all") => void;
  filterStatus: TaskStatusId | "all";
  setFilterStatus: (v: TaskStatusId | "all") => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาโปรเจกต์… Search projects" style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #d1d5db", fontSize: 13, minWidth: 220 }} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <FilterPill label="All kinds" active={filterKind === "all"} onClick={() => setFilterKind("all")} />
        {WORK_KINDS.map(k => (
          <FilterPill key={k.id} label={k.label} active={filterKind === k.id} onClick={() => setFilterKind(k.id)} color={k.color} />
        ))}
      </div>
      <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as TaskStatusId | "all")} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12 }}>
        <option value="all">All statuses</option>
        {TASK_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label} • {s.labelTh}</option>)}
      </select>
    </div>
  );
}

function FilterPill({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 12, padding: "6px 10px", borderRadius: 999, cursor: "pointer",
      border: active ? `1px solid ${color ?? "#0f172a"}` : "1px solid #e5e7eb",
      background: active ? (color ?? "#0f172a") : "#fff",
      color: active ? "#fff" : "#374151", fontWeight: active ? 700 : 500,
    }}>{label}</button>
  );
}

export function ProjectCard({ p, onOpen }: { p: WorkProject; onOpen: () => void }) {
  const kindMeta = WORK_KINDS.find(k => k.id === p.kind);
  const statusMeta = TASK_STATUSES.find(s => s.id === p.status);
  return (
    <div onClick={onOpen} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 14, background: "#fff", cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: kindMeta?.color, border: `1px solid ${kindMeta?.color}22`, background: `${kindMeta?.color}0d`, padding: "2px 8px", borderRadius: 999 }}>
          {kindMeta?.icon} {kindMeta?.label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: statusMeta?.color ?? "#6b7280", padding: "2px 8px", borderRadius: 999 }}>{statusMeta?.label}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, marginTop: 8, lineHeight: 1.3 }}>{p.title}</div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.goal}</div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, border: "1px solid #e5e7eb", borderRadius: 999, padding: "2px 7px", background: p.executionMode === "cloud" ? "#0f172a" : "#ecfdf5", color: p.executionMode === "cloud" ? "#fff" : "#065f46" }}>
          {p.executionMode === "cloud" ? "☁ Cloud" : "💻 Local"}
        </span>
        <span style={{ fontSize: 10, border: "1px solid #e5e7eb", borderRadius: 999, padding: "2px 7px" }}>${p.estimate.cost.toFixed(2)} • {p.estimate.minutes} min</span>
        <span style={{ fontSize: 10, color: "#6b7280" }}>{new Date(p.updatedAt).toLocaleDateString("th-TH")}</span>
      </div>
      <div style={{ height: 4, background: "#e5e7eb", borderRadius: 999, marginTop: 10, overflow: "hidden" }}>
        <div style={{ width: `${p.progress}%`, height: "100%", background: statusMeta?.color ?? "#0f172a", transition: "width 0.3s" }} />
      </div>
      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{p.progress}% • trace {p.traceId.slice(0, 8)}</div>
    </div>
  );
}
