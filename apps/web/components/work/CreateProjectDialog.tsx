"use client";
import { useState } from "react";
import { WORK_TEMPLATES, WORK_KINDS } from "@/lib/work/templates";
import type { WorkKind, ExecutionMode } from "@/lib/work/templates";
import { EstimateCard } from "./EstimateCard";
import { estimateTask, formatCost } from "@/lib/work/estimates";

export function CreateProjectDialog({
  open, onClose, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { title: string; goal: string; kind: WorkKind; executionMode: ExecutionMode; cost: number }) => void;
}) {
  const [kind, setKind] = useState<WorkKind>("coding");
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("cloud");
  const [goal, setGoal] = useState("");
  const [title, setTitle] = useState("");
  const tpl = WORK_TEMPLATES[kind];
  const est = estimateTask(kind, executionMode);
  const [localWarning, setLocalWarning] = useState(false);

  if (!open) return null;

  const quota = { perTaskCap: 10, monthlyCap: 50, monthlyUsed: 12.4 }; // demo quota

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 760, background: "#fff", borderRadius: 16, overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>New Work Project • สร้างโปรเจกต์ใหม่</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>เลือกประเภทงาน → เลือก Cloud/Local → ตรวจ estimate ก่อนเริ่ม (Principle: cost + time + tools)</div>
          </div>
          <button onClick={onClose} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: 16, overflow: "auto", flex: 1 }}>
          {/* Kind picker */}
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>1) เลือกประเภทงาน — WorkKind</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8 }}>
            {WORK_KINDS.map(k => (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                style={{
                  textAlign: "left", padding: 10, borderRadius: 10, border: kind === k.id ? `2px solid ${k.color}` : "1px solid #e5e7eb",
                  background: kind === k.id ? "#f9fafb" : "#fff", cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: k.color }}>{k.icon} {k.label} <span style={{ color: "#6b7280", fontWeight: 600 }}>• {k.labelTh}</span></div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{WORK_TEMPLATES[k.id].description.slice(0, 64)}…</div>
              </button>
            ))}
          </div>

          {/* Template quick prompts */}
          <div style={{ marginTop: 12, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>Template: {tpl.title} • {tpl.titleTh}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Deliverables: {tpl.deliverables.join(" • ")} • Tools: {tpl.tools.join(", ")}</div>
            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 8 }}>ลองคลิกตัวอย่างคำสั่ง:</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {tpl.prompts.map(p => (
                <button key={p} onClick={() => { setGoal(p); setTitle(p.slice(0, 60)); }} style={{ textAlign: "left", fontSize: 11, padding: 8, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}>
                  “{p}”
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>2) เป้าหมายโปรเจกต์ — Goal</div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ชื่อโปรเจกต์ (auto from goal)" style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }} />
            <textarea value={goal} onChange={e => setGoal(e.target.value)} placeholder="อธิบายสิ่งที่ต้องการให้ Work ทำ… เช่น สร้างระบบ CRM สำหรับทีมขาย มี Login, Dashboard, Customer Management…" rows={4} style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }} />
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>แนบไฟล์/แหล่งข้อมูลได้หลังสร้างโปรเจกต์ ในหน้า workspace</div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>3) เลือกสถานที่ทำงาน — Cloud vs Local</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <button onClick={() => { setExecutionMode("cloud"); setLocalWarning(false); }} style={{ padding: 12, borderRadius: 10, border: executionMode === "cloud" ? "2px solid #0f172a" : "1px solid #e5e7eb", background: executionMode === "cloud" ? "#f8fafc" : "#fff", textAlign: "left", cursor: "pointer" }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>☁ Cloud Work</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>ไม่ต้องเปิดเครื่องค้าง • ทำต่อเมื่อออฟไลน์ • เข้าถึงจากหลายอุปกรณ์</div>
                <div style={{ fontSize: 11, color: "#059669", marginTop: 6 }}>✓ เหมาะกับงานหนัก/ต่อเนื่อง</div>
              </button>
              <button onClick={() => { setExecutionMode("local"); setLocalWarning(true); }} style={{ padding: 12, borderRadius: 10, border: executionMode === "local" ? "2px solid #065f46" : "1px solid #e5e7eb", background: executionMode === "local" ? "#ecfdf5" : "#fff", textAlign: "left", cursor: "pointer" }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>💻 Local Work</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>ใช้ไฟล์ในเครื่อง • เครื่องมือที่ติดตั้งอยู่ • ข้อมูลไม่ออกจากเครื่อง</div>
                <div style={{ fontSize: 11, color: "#d97706", marginTop: 6 }}>⚠ จะหยุดเมื่อปิดเครื่อง (ไม่ย้ายไป Cloud เอง)</div>
              </button>
            </div>
            {localWarning && executionMode === "local" && (
              <div style={{ marginTop: 8, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 8, fontSize: 11, color: "#92400e" }}>
                ข้อจำกัดที่ต้องแจ้งชัด: Local Work จะพักงานเมื่อคอมพิวเตอร์ปิด/ไม่พร้อม และจะไม่ย้ายข้อมูลไป Cloud โดยไม่ได้รับอนุญาต — ดูสถานะได้ที่ Computer
              </div>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>4) ตรวจสอบก่อนเริ่ม — Cost Gate (ต้องอนุมัติก่อน execute)</div>
            <div style={{ marginTop: 8 }}>
              <EstimateCard kind={kind} executionMode={executionMode} quota={quota} />
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
              Local ประหยัด ~30% (ไม่มีค่า Cloud exec) • ถ้าเกิน perTaskCap/monthlyCap ปุ่มอนุมัติจะล็อก ต้องปรับวงเงินที่ Settings
            </div>
          </div>
        </div>

        <div style={{ padding: 14, borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, justifyContent: "flex-end", background: "#f9fafb" }}>
          <button onClick={onClose} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>ยกเลิก</button>
          <button
            onClick={() => {
              if (!goal.trim()) { alert("กรุณาใส่เป้าหมายโปรเจกต์"); return; }
              onCreate({ title: title || goal.slice(0, 60), goal, kind, executionMode, cost: est.cost });
            }}
            style={{ padding: "9px 16px", borderRadius: 8, border: 0, background: "#0f172a", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            สร้างโปรเจกต์ • {formatCost(est.cost)} / {est.minutes} min — ต้องอนุมัติอีกครั้งใน workspace ก่อนรัน
          </button>
        </div>
      </div>
    </div>
  );
}
