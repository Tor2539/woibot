"use client";
import React, { useState } from "react";
import { MockMemory } from "@/lib/teammate/mock";

type Props = {
  memories: MockMemory[];
  onAdd: (m: { key: string; value: string; scope: string }) => void;
  onUpdate: (id: string, patch: Partial<MockMemory>) => void;
  onDelete: (id: string) => void;
};

const scopeColor: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  personal: { bg: "#f0fdf4", border: "#bbf7d0", dot: "#22c55e", label: "Personal" },
  team: { bg: "#eff6ff", border: "#bfdbfe", dot: "#3b82f6", label: "Team" },
  project: { bg: "#fef3c7", border: "#fde68a", dot: "#f59e0b", label: "Project" },
};

export function MemoryPanel({ memories, onAdd, onUpdate, onDelete }: Props) {
  const [filter, setFilter] = useState<"all" | "personal" | "team" | "project">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [newScope, setNewScope] = useState("personal");
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const filtered = filter === "all" ? memories : memories.filter((m) => m.scope === filter);

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>\uD83E\uDDE0 Memory & Context</div>
        <span style={{ fontSize: 11, background: "#f3f4f6", padding: "3px 8px", borderRadius: 999 }}>{memories.length} memories</span>
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>\u0e08\u0e33\u0e1a\u0e23\u0e34\u0e1a\u0e17\u0e23\u0e30\u0e22\u0e30\u0e22\u0e32\u0e27 \u2022 \u0e14\u0e39/\u0e41\u0e01\u0e49/\u0e25\u0e1a\u0e44\u0e14\u0e49 \u2022 \u0e41\u0e22\u0e01 personal/team/project \u2022 \u0e2b\u0e49\u0e32\u0e21\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01 PII \u0e44\u0e14\u0e49</div>

      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {(["all", "personal", "team", "project"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: "1px solid " + (filter === s ? "#0d0d0d" : "#e5e7eb"),
              background: filter === s ? "#0d0d0d" : "#fff",
              color: filter === s ? "#fff" : "#6b7280",
              textTransform: "capitalize",
            }}
          >
            {s} {s !== "all" && `(${memories.filter((m) => m.scope === s).length})`}
          </button>
        ))}
        <button onClick={() => setShowAdd(!showAdd)} style={{ marginLeft: "auto", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 999, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>+ Add</button>
      </div>

      {showAdd && (
        <div style={{ marginTop: 10, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>\u0e40\u0e1e\u0e34\u0e48\u0e21 Memory \u0e43\u0e2b\u0e21\u0e48</div>
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="key \u0e40\u0e0a\u0e48\u0e19 client_style" style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", fontSize: 12, marginBottom: 6 }} />
          <textarea value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder="value" rows={2} style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", fontSize: 12, marginBottom: 6 }} />
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select value={newScope} onChange={(e) => setNewScope(e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 8px", fontSize: 12 }}>
              <option value="personal">personal</option><option value="team">team</option><option value="project">project</option>
            </select>
            <button onClick={() => { if (newKey && newVal) { onAdd({ key: newKey, value: newVal, scope: newScope }); setNewKey(""); setNewVal(""); setShowAdd(false); } }} style={{ background: "#0d0d0d", color: "#fff", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>Save</button>
            <button onClick={() => setShowAdd(false)} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
        {filtered.map((m) => {
          const c = scopeColor[m.scope] || scopeColor.personal;
          return (
            <div key={m.id} style={{ background: c.bg, border: "1px solid " + c.border, borderRadius: 12, padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: c.dot, display: "inline-block" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{m.key}</span>
                <span style={{ fontSize: 10, background: "#fff", border: "1px solid " + c.border, padding: "1px 6px", borderRadius: 999 }}>{c.label}</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "#9ca3af" }}>{m.updatedAt}</span>
              </div>
              {editing === m.id ? (
                <div style={{ marginTop: 6 }}>
                  <textarea value={editVal} onChange={(e) => setEditVal(e.target.value)} rows={2} style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 8px", fontSize: 12 }} />
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <button onClick={() => { onUpdate(m.id, { value: editVal }); setEditing(null); }} style={{ background: "#0d0d0d", color: "#fff", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditing(null)} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#374151", marginTop: 6, lineHeight: 1.4 }}>{m.value}</div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button onClick={() => { setEditing(m.id); setEditVal(m.value); }} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>Edit</button>
                <button onClick={() => onDelete(m.id)} disabled={!m.canDelete} style={{ background: m.canDelete ? "#fff" : "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, padding: "3px 8px", fontSize: 11, cursor: m.canDelete ? "pointer" : "not-allowed", opacity: m.canDelete ? 1 : 0.5 }} title={m.canDelete ? "" : "\u0e2b\u0e49\u0e32\u0e21\u0e25\u0e1a (policy)"}>Delete</button>
                <select value={m.scope} onChange={(e) => onUpdate(m.id, { scope: e.target.value as any })} style={{ marginLeft: "auto", fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 8, padding: "2px 6px" }}>
                  <option value="personal">personal</option><option value="team">team</option><option value="project">project</option>
                </select>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, padding: 12 }}>No memories in this scope</div>}
      </div>
    </div>
  );
}
