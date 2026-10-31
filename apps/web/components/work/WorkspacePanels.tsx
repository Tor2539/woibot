"use client";
import { useState } from "react";

export type Step = { id: string; title: string; titleTh: string; status: "done" | "active" | "pending" | "error"; log?: string };

export function StepsPanel({
  steps, onPause, onResume, status,
}: {
  steps: Step[];
  status: string;
  onPause?: () => void;
  onResume?: () => void;
}) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>Steps • ขั้นตอน</div>
        <div style={{ display: "flex", gap: 6 }}>
          {status === "in_progress" && <button onClick={onPause} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}>⏸ Pause</button>}
          {status === "paused" && <button onClick={onResume} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, border: "1px solid #0f172a", background: "#0f172a", color: "#fff", cursor: "pointer" }}>▶ Resume</button>}
        </div>
      </div>
      <div style={{ marginTop: 12, position: "relative", paddingLeft: 18 }}>
        <div style={{ position: "absolute", left: 7, top: 6, bottom: 6, width: 2, background: "#e5e7eb", borderRadius: 999 }} />
        {steps.map(s => (
          <div key={s.id} style={{ display: "flex", gap: 10, padding: "8px 0", position: "relative" }}>
            <div style={{
              width: 14, height: 14, borderRadius: 999, flexShrink: 0, marginTop: 2, border: "2px solid",
              background: s.status === "done" ? "#059669" : s.status === "active" ? "#7c3aed" : s.status === "error" ? "#dc2626" : "#fff",
              borderColor: s.status === "done" ? "#059669" : s.status === "active" ? "#7c3aed" : s.status === "error" ? "#dc2626" : "#d1d5db",
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.status === "active" ? "#7c3aed" : s.status === "done" ? "#065f46" : "#111827" }}>
                {s.title} <span style={{ fontWeight: 500, color: "#6b7280" }}>• {s.titleTh}</span>
                {s.status === "active" && <span style={{ marginLeft: 6, fontSize: 10, background: "#ede9fe", color: "#6d28d9", padding: "1px 6px", borderRadius: 999 }}>active</span>}
                {s.status === "done" && <span style={{ marginLeft: 6, fontSize: 10 }}>✓</span>}
              </div>
              {s.log && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 6, padding: "4px 8px" }}>{s.log}</div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>Pause/Resume • บันทึกความคืบหน้าเสมอ รองรับงานหลายชั่วโมง</div>
    </div>
  );
}

export function FileTree({ files }: { files: { path: string; lang?: string; size?: string; status?: string }[] }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#fff" }}>
      <div style={{ fontSize: 12, fontWeight: 800 }}>Files • ไฟล์</div>
      <div style={{ marginTop: 8 }}>
        {files.map(f => (
          <div key={f.path} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f3f4f6", fontSize: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 11, background: "#f3f4f6", borderRadius: 4, padding: "1px 6px", flexShrink: 0 }}>{f.lang ?? "file"}</span>
              <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{f.path}</span>
              {f.status && <span style={{ fontSize: 10, flexShrink: 0, padding: "1px 6px", borderRadius: 999, background: f.status === "new" ? "#dcfce7" : f.status === "modified" ? "#fef3c7" : "#f3f4f6", color: f.status === "new" ? "#065f46" : f.status === "modified" ? "#92400e" : "#6b7280" }}>{f.status}</span>}
            </div>
            <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0 }}>{f.size}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PreviewPane({ kind, previewHtml }: { kind: string; previewHtml?: string }) {
  if (kind === "coding") {
    return (
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Preview • ตัวอย่าง</div>
          <span style={{ fontSize: 10, background: "#dcfce7", color: "#065f46", padding: "2px 8px", borderRadius: 999 }}>live preview</span>
        </div>
        <div style={{ height: 260, background: "#fff", overflow: "hidden" }}>
          {/* Simulated preview */}
          <div style={{ height: "100%", padding: 12, background: "linear-gradient(135deg,#f8fafc,#eef2ff)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: "#ef4444" }} /><div style={{ width: 8, height: 8, borderRadius: 999, background: "#f59e0b" }} /><div style={{ width: 8, height: 8, borderRadius: 999, background: "#22c55e" }} />
              <span style={{ fontSize: 11, color: "#64748b", marginLeft: 8 }}>localhost:3000/dashboard</span>
            </div>
            <div style={{ flex: 1, display: "flex", gap: 10, marginTop: 10 }}>
              <div style={{ width: 120, background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", padding: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700 }}>CRM</div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>Dashboard</div>
                <div style={{ fontSize: 10, color: "#64748b" }}>Customers</div>
                <div style={{ fontSize: 10, color: "#64748b" }}>Reports</div>
              </div>
              <div style={{ flex: 1, background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>Dashboard</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 8 }}>
                  <div style={{ background: "#f1f5f9", borderRadius: 6, padding: 8, textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 800 }}>248</div><div style={{ fontSize: 9, color: "#64748b" }}>Customers</div></div>
                  <div style={{ background: "#f1f5f9", borderRadius: 6, padding: 8, textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 800 }}>฿1.2M</div><div style={{ fontSize: 9, color: "#64748b" }}>Sales</div></div>
                  <div style={{ background: "#f1f5f9", borderRadius: 6, padding: 8, textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 800 }}>12</div><div style={{ fontSize: 9, color: "#64748b" }}>Deals</div></div>
                </div>
                <div style={{ marginTop: 10, height: 44, background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#94a3b8" }}>Customer table preview</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (kind === "video_gen" || kind === "video_analysis") {
    return (
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Video Preview • ตรวจสอบวิดีโอ</div>
          <span style={{ fontSize: 10, background: "#0f172a", color: "#fff", padding: "2px 8px", borderRadius: 999 }}>30s • 1080p</span>
        </div>
        <div style={{ aspectRatio: "16/9", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "#fff" }}>
          <div style={{ fontSize: 32 }}>▶</div>
          <div style={{ fontSize: 11, marginTop: 8, opacity: 0.8 }}>MP4 preview — 30.0s, h264/aac, TH+EN subs</div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <span style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", padding: "3px 8px", borderRadius: 999 }}>16:9</span>
            <span style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", padding: "3px 8px", borderRadius: 999 }}>9:16</span>
            <span style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", padding: "3px 8px", borderRadius: 999 }}>1:1</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 4, padding: 8, background: "#f9fafb" }}>
          {Array.from({ length: 8 }).map((_, i) => <div key={i} style={{ aspectRatio: "16/9", background: `hsl(${260 + i * 6} 70% ${55 + i}% )`, borderRadius: 4 }} />)}
        </div>
      </div>
    );
  }
  // doc / research / data
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
      <div style={{ padding: "8px 12px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontSize: 12, fontWeight: 700 }}>Document Preview • ตัวอย่างเอกสาร</div>
      <div style={{ padding: 16, background: "#e5e7eb", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Executive Summary</div>
          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>Proposal • 12 pages • Sarabun + Inter • TOC linked</div>
          <div style={{ height: 1, background: "#e5e7eb", margin: "10px 0" }} />
          <div style={{ fontSize: 10, color: "#374151", lineHeight: 1.6 }}>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua…</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            <div style={{ height: 48, background: "#f1f5f9", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#94a3b8" }}>Chart 1</div>
            <div style={{ height: 48, background: "#f1f5f9", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#94a3b8" }}>Table</div>
          </div>
          <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 8, textAlign: "center" }}>Page 1 of 12 • Editable DOCX preserved</div>
        </div>
      </div>
    </div>
  );
}

export function FeedbackPanel({ onSend }: { onSend: (msg: string) => void }) {
  const [text, setText] = useState("");
  const presets = ["ขอแก้สี header เป็นน้ำเงินเข้ม", "เพิ่มคอลัมน์ สถานะ ในตาราง", "แปล subtitle เป็นอังกฤษด้วย", "ย่อเหลือ 10 หน้า เน้นสรุปผู้บริหาร"];
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" }}>
      <div style={{ fontSize: 12, fontWeight: 800 }}>Feedback • ให้ข้อเสนอแนะระหว่างทำงาน</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {presets.map(p => <button key={p} onClick={() => setText(p)} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer" }}>{p}</button>)}
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="พิมพ์สิ่งที่อยากให้แก้… เช่น ขอแก้เฉพาะส่วน header, ไม่ต้องทำใหม่ทั้งหมด" rows={3} style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12 }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        <button onClick={() => { if (!text.trim()) return; onSend(text); setText(""); }} style={{ flex: 1, minWidth: 200, padding: "10px 12px", minHeight: 40, borderRadius: 8, border: 0, background: "#0f172a", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>ส่ง Feedback → Work จะแก้ไขเฉพาะส่วน</button>
        <button onClick={() => setText("")} style={{ padding: "10px 12px", minHeight: 40, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 12 }}>ล้าง</button>
      </div>
      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>ข้อสำคัญ: Work ไม่ควรถามซ้ำสิ่งที่ Teammate รู้แล้ว — feedback จะผูกกับเวอร์ชันปัจจุบัน</div>
    </div>
  );
}

export function VersionDiff({ versions, current }: { versions: { id: string; label: string; date: string }[]; current: string }) {
  const [a, setA] = useState(versions[0]?.id ?? "");
  const [b, setB] = useState(current);
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" }}>
      <div style={{ fontSize: 12, fontWeight: 800 }}>Version Diff • เปรียบเทียบเวอร์ชัน</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <select value={a} onChange={e => setA(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12 }}><option value="">เลือกเวอร์ชัน A</option>{versions.map(v => <option key={v.id} value={v.id}>{v.label} • {v.date}</option>)}</select>
        <span style={{ alignSelf: "center", fontSize: 12 }}>→</span>
        <select value={b} onChange={e => setB(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 12 }}><option value="">เลือกเวอร์ชัน B</option>{versions.map(v => <option key={v.id} value={v.id}>{v.label} • {v.date}</option>)}</select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#991b1b" }}>− Removed / Before</div>
          <pre style={{ fontSize: 11, margin: "6px 0 0", whiteSpace: "pre-wrap", color: "#7f1d1d" }}>&lt;Header color="#3b82f6" /&gt;{"\n"}// table: 3 cols</pre>
        </div>
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#065f46" }}>+ Added / After</div>
          <pre style={{ fontSize: 11, margin: "6px 0 0", whiteSpace: "pre-wrap", color: "#065f46" }}>&lt;Header color="#0f172a" /&gt;{"\n"}// table: 4 cols + status</pre>
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>แสดง change summary และ redline ก่อนอนุมัติ</div>
    </div>
  );
}


