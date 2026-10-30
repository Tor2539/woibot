"use client";
import React, { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  estimate: { cost: number; minutes: number; label: string; kind: string } | null;
  goal: string;
  onConfirm: (mode: "cloud" | "local") => void;
};

export function HandoffPreview({ open, onClose, estimate, goal, onConfirm }: Props) {
  const [mode, setMode] = useState<"cloud" | "local">("cloud");
  if (!open || !estimate) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, maxWidth: 520, width: "100%", border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe", padding: "14px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: "#1757d7", color: "#fff", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>HANDOFF \u2192 WORK</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#1e40af" }}>Estimate \u0e01\u0e48\u0e2d\u0e19\u0e40\u0e23\u0e34\u0e48\u0e21</span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "#fff", border: "1px solid #bfdbfe", borderRadius: 999, width: 28, height: 28, cursor: "pointer" }}>\u2715</button>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0d0d0d" }}>{estimate.label}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 1.5 }}>{goal.slice(0,120)}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, textAlign: "center" }}><div style={{ fontSize: 11, color: "#6b7280" }}>\u0e40\u0e27\u0e25\u0e32</div><div style={{ fontWeight: 800 }}>{estimate.minutes} \u0e19\u0e32\u0e17\u0e35</div></div>
            <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 10, padding: 10, textAlign: "center" }}><div style={{ fontSize: 11, color: "#92400e" }}>\u0e04\u0e48\u0e32\u0e43\u0e0a\u0e49\u0e08\u0e48\u0e32\u0e22</div><div style={{ fontWeight: 800 }}>~${estimate.cost.toFixed(2)}</div></div>
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 10, textAlign: "center" }}><div style={{ fontSize: 11, color: "#1e40af" }}>type</div><div style={{ fontWeight: 800, fontSize: 12 }}>{estimate.kind}</div></div>
          </div>

          <div style={{ marginTop: 12, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Execution mode</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={() => setMode("cloud")} style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid " + (mode==="cloud" ? "#1757d7" : "#e5e7eb"), background: mode==="cloud" ? "#eff6ff" : "#fff", cursor: "pointer" }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>\u2601\uFE0F Cloud</div><div style={{ fontSize: 10, color: "#6b7280" }}>\u0e15\u0e48\u0e2d\u0e40\u0e19\u0e37\u0e48\u0e2d\u0e07 \u0e44\u0e21\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e40\u0e1b\u0e34\u0e14\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07</div>
              </button>
              <button onClick={() => setMode("local")} style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid " + (mode==="local" ? "#0d0d0d" : "#e5e7eb"), background: mode==="local" ? "#f3f4f6" : "#fff", cursor: "pointer" }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>\uD83D\uDCBB Local</div><div style={{ fontSize: 10, color: "#6b7280" }}>\u0e44\u0e1f\u0e25\u0e4c\u0e2d\u0e22\u0e39\u0e48\u0e43\u0e19\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07</div>
              </button>
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>Teammate \u0e40\u0e2d\u0e07\u0e40\u0e1b\u0e47\u0e19 Cloud Only \u2022 Work \u0e40\u0e25\u0e37\u0e2d\u0e01 Cloud/Local \u0e44\u0e14\u0e49</div>
          </div>

          <div style={{ marginTop: 10, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 8, fontSize: 11, color: "#92400e" }}>
            \uD83D\uDCB0 Per-task cap $5 \u2022 Monthly cap $50 \u2022 \u0e40\u0e01\u0e34\u0e19\u0e07\u0e1a pause \u0e23\u0e2d\u0e2d\u0e19\u0e38\u0e21\u0e31\u0e15\u0e34 \u2022 Video GPU pool \u0e41\u0e22\u0e01 \u0e44\u0e21\u0e48\u0e01\u0e23\u0e30\u0e17\u0e1a Teammate
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => onConfirm(mode)} style={{ flex: 1, background: "#0d0d0d", color: "#fff", border: "none", borderRadius: 999, padding: "10px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>\u2705 \u0e40\u0e23\u0e34\u0e48\u0e21\u0e40\u0e25\u0e22</button>
            <button onClick={onClose} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 999, padding: "10px 14px", fontSize: 13, cursor: "pointer" }}>\u0e1b\u0e23\u0e31\u0e1a\u0e07\u0e1a</button>
          </div>
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8, textAlign: "center" }}>HandoffPacket \u0e08\u0e30\u0e2a\u0e48\u0e07 goal + chat_history + memory + files + constraints + trace_id \u0e44\u0e1b Work</div>
        </div>
      </div>
    </div>
  );
}
