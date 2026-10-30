"use client";
import React from "react";

export function TeammateHeader({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#0d0d0d,#374151)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16 }}>W</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>Nim Teammate</span>
          <span style={{ background: "#0d0d0d", color: "#fff", fontSize: 10, padding: "2px 7px", borderRadius: 999, fontWeight: 700 }}>MAIN</span>
          <span style={{ background: "#1757d7", color: "#fff", fontSize: 10, padding: "2px 7px", borderRadius: 999, fontWeight: 700 }}>CLOUD ONLY</span>
          <span style={{ width: 8, height: 8, background: "#22c55e", borderRadius: 999, display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>Online 24h</span>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Personal Assistant \u2022 \u0e1e\u0e39\u0e14\u0e44\u0e17\u0e22/\u0e2d\u0e31\u0e07\u0e01\u0e24\u0e29 \u2022 \u0e08\u0e33\u0e04\u0e38\u0e13\u0e44\u0e14\u0e49 \u2022 \u0e40\u0e02\u0e49\u0e32\u0e43\u0e08\u0e1a\u0e23\u0e34\u0e1a\u0e17\u0e40\u0e1b\u0e47\u0e19</div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <span style={{ fontSize: 10, background: "#f3f4f6", border: "1px solid #e5e7eb", padding: "2px 7px", borderRadius: 999 }}>\u0e15\u0e2d\u0e1a\u0e2a\u0e31\u0e49\u0e19 \u0e15\u0e23\u0e07\u0e1b\u0e23\u0e30\u0e40\u0e14\u0e47\u0e19</span>
          <span style={{ fontSize: 10, background: "#f3f4f6", border: "1px solid #e5e7eb", padding: "2px 7px", borderRadius: 999 }}>\u0e20\u0e32\u0e29\u0e32\u0e44\u0e17\u0e22\u0e2b\u0e25\u0e31\u0e01</span>
          <span style={{ fontSize: 10, background: "#f3f4f6", border: "1px solid #e5e7eb", padding: "2px 7px", borderRadius: 999 }}>Cloud Computer \u2713</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
        <button onClick={onNewChat} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 999, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>+ New chat</button>
        <span style={{ fontSize: 10, color: "#9ca3af" }}>Teammate \u0e44\u0e21\u0e48\u0e43\u0e0a\u0e49 Local</span>
      </div>
    </div>
  );
}
