"use client";
import React from "react";
import { MOCK_BRIEFING, MOCK_PROACTIVE } from "@/lib/teammate/mock";

export function DailyBriefingCard({ onAction }: { onAction?: (id: string) => void }) {
  const b = MOCK_BRIEFING;
  return (
    <div style={{ background: "linear-gradient(135deg, #0d0d0d 0%, #1f2937 100%)", color: "#fff", borderRadius: 16, padding: 16, border: "1px solid #1f2937" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: "#fff", color: "#0d0d0d", borderRadius: 999, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>08:00</span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Daily Briefing</span>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>{b.date}</span>
        </div>
        <span style={{ fontSize: 11, background: "rgba(255,255,255,0.12)", padding: "3px 8px", borderRadius: 999 }}>Cloud \u2022 Auto</span>
      </div>
      <div style={{ fontSize: 12, color: "#d1d5db", marginTop: 6 }}>{b.greeting}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
        <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: 10, textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 800 }}>{b.stats.emails}</div><div style={{ fontSize: 10, color: "#9ca3af" }}>\u0e2d\u0e35\u0e40\u0e21\u0e25\u0e2a\u0e33\u0e04\u0e31\u0e0d</div></div>
        <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: 10, textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 800 }}>{b.stats.meetings}</div><div style={{ fontSize: 10, color: "#9ca3af" }}>\u0e1b\u0e23\u0e30\u0e0a\u0e38\u0e21</div></div>
        <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: 10, textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 800 }}>{b.stats.tasks}</div><div style={{ fontSize: 10, color: "#9ca3af" }}>\u0e07\u0e32\u0e19\u0e04\u0e49\u0e32\u0e07</div></div>
      </div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {b.items.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: it.type==="email" ? "#fef3c7" : it.type==="calendar" ? "#dbeafe" : it.type==="task" ? "#fce7f3" : "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
              {it.type==="email" ? "\uD83D\uDCE7" : it.type==="calendar" ? "\uD83D\uDCC5" : it.type==="task" ? "\u2705" : "\uD83D\uDCA1"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>{it.title} {it.priority==="high" && <span style={{ background: "#ef4444", color: "#fff", fontSize: 9, padding: "1px 5px", borderRadius: 999 }}>HIGH</span>}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.detail}</div>
            </div>
            {it.time && <span style={{ fontSize: 11, color: "#9ca3af" }}>{it.time}</span>}
            {it.actionLabel && <button onClick={() => onAction?.(it.id)} style={{ background: "#fff", color: "#0d0d0d", border: "none", borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{it.actionLabel}</button>}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button style={{ flex: 1, background: "#fff", color: "#0d0d0d", border: "none", borderRadius: 999, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>\uD83D\uDCC4 \u0e2a\u0e23\u0e38\u0e1b\u0e09\u0e1a\u0e31\u0e1a\u0e40\u0e15\u0e47\u0e21</button>
        <button style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 999, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>\u23F0 \u0e15\u0e31\u0e49\u0e07 Routine</button>
      </div>
      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 8, textAlign: "center" }}>\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38: \u0e16\u0e49\u0e32\u0e2a\u0e31\u0e48\u0e07\u0e07\u0e32\u0e19\u0e2b\u0e19\u0e31\u0e01 Teammate \u0e08\u0e30\u0e40\u0e2a\u0e19\u0e2d Handoff \u0e44\u0e1b Work \u0e1e\u0e23\u0e49\u0e2d\u0e21 estimate \u0e01\u0e48\u0e2d\u0e19\u0e40\u0e23\u0e34\u0e48\u0e21</div>
    </div>
  );
}

export function ProactiveCard() {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, background: "#f59e0b", borderRadius: 999, display: "inline-block", animation: "pulse 1.5s infinite" }} />
        <div style={{ fontWeight: 700, fontSize: 13 }}>Proactive \u2022 \u0e41\u0e08\u0e49\u0e07\u0e40\u0e15\u0e37\u0e2d\u0e19\u0e40\u0e2d\u0e07\u0e20\u0e32\u0e22\u0e43\u0e15\u0e49 consent</div>
        <span style={{ marginLeft: "auto", fontSize: 11, background: "#fef3c7", border: "1px solid #fde68a", padding: "2px 8px", borderRadius: 999 }}>3 suggestions</span>
      </div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {MOCK_PROACTIVE.map((p) => (
          <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", background: p.severity==="warning" ? "#fffbeb" : "#eff6ff", border: "1px solid " + (p.severity==="warning" ? "#fde68a" : "#bfdbfe"), borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{p.title}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{p.detail}</div>
            </div>
            <button style={{ background: p.severity==="warning" ? "#f59e0b" : "#1757d7", color: "#fff", border: "none", borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{p.action}</button>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>\u0e04\u0e27\u0e32\u0e21\u0e16\u0e35\u0e48\u0e01\u0e32\u0e23\u0e41\u0e08\u0e49\u0e07\u0e40\u0e15\u0e37\u0e2d\u0e19 \u0e41\u0e25\u0e30\u0e02\u0e2d\u0e1a\u0e40\u0e02\u0e15\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32\u0e44\u0e14\u0e49\u0e17\u0e35\u0e48 Settings \u2192 Notifications</div>
      <style>{`@keyframes pulse{0%{opacity:1}50%{opacity:.4}100%{opacity:1}}`}</style>
    </div>
  );
}
