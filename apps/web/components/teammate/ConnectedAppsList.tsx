"use client";
import React from "react";
import { MockApp } from "@/lib/teammate/mock";

export function ConnectedAppsList({ apps, onToggle }: { apps: MockApp[]; onToggle: (id: string) => void }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>\uD83D\uDD0C Connected Apps</div>
        <span style={{ fontSize: 11, background: "#f3f4f6", padding: "3px 8px", borderRadius: 999 }}>{apps.filter(a=>a.status==="connected").length}/{apps.length} connected</span>
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23\u0e08\u0e23\u0e34\u0e07 \u2022 \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2a\u0e34\u0e17\u0e18\u0e34\u0e4c\u0e15\u0e32\u0e21\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23 \u2022 \u0e22\u0e01\u0e40\u0e25\u0e34\u0e01\u0e44\u0e14\u0e49 \u2022 \u0e02\u0e2d\u0e2a\u0e34\u0e17\u0e18\u0e34\u0e4c\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e08\u0e33\u0e40\u0e1b\u0e47\u0e19</div>

      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {apps.map((app) => (
          <div key={app.id} style={{ display: "flex", alignItems: "center", gap: 10, background: app.status==="connected" ? "#f9fafb" : "#fff", border: "1px solid " + (app.status==="connected" ? "#e5e7eb" : app.status==="expired" ? "#fde68a" : "#f3f4f6"), borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: app.status==="connected" ? "#fff" : "#f9fafb", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{app.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{app.label}</span>
                <span style={{
                  fontSize: 10, padding: "2px 6px", borderRadius: 999, fontWeight: 700,
                  background: app.status==="connected" ? "#dcfce7" : app.status==="expired" ? "#fef3c7" : app.status==="revoked" ? "#fee2e2" : "#f3f4f6",
                  color: app.status==="connected" ? "#15803d" : app.status==="expired" ? "#92400e" : app.status==="revoked" ? "#991b1b" : "#6b7280",
                  border: "1px solid " + (app.status==="connected" ? "#bbf7d0" : app.status==="expired" ? "#fde68a" : "#e5e7eb")
                }}>{app.status}</span>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {app.account || "not connected"} {app.scopes.length>0 && `\u2022 ${app.scopes.join(", ")}`}
              </div>
            </div>
            <button onClick={() => onToggle(app.id)} style={{
              padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer",
              background: app.status==="connected" ? "#fff" : "#0d0d0d",
              color: app.status==="connected" ? "#dc2626" : "#fff",
              border: "1px solid " + (app.status==="connected" ? "#fecaca" : "#0d0d0d")
            }}>
              {app.status==="connected" ? "Disconnect" : app.status==="expired" ? "Reconnect" : "Connect"}
            </button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, background: "#f9fafb", border: "1px dashed #e5e7eb", borderRadius: 10, padding: 8, fontSize: 11, color: "#6b7280", lineHeight: 1.4 }}>
        \uD83D\uDD12 Teammate \u0e02\u0e2d\u0e2a\u0e34\u0e17\u0e18\u0e34\u0e4c\u0e40\u0e17\u0e48\u0e32\u0e17\u0e35\u0e48\u0e08\u0e33\u0e40\u0e1b\u0e47\u0e19 \u2022 Gmail read \u2192 \u0e2a\u0e23\u0e38\u0e1b\u0e2d\u0e35\u0e40\u0e21\u0e25 \u2022 Drive read \u2192 \u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c\u0e44\u0e1f\u0e25\u0e4c \u2022 \u0e16\u0e49\u0e32\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23 send \u0e08\u0e30\u0e02\u0e2d\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15\u0e01\u0e48\u0e2d\u0e19
      </div>
    </div>
  );
}
