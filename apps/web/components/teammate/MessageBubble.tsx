"use client";
import React from "react";

export type ChatMsg = {
  id: string;
  role: "user" | "assistant" | "system" | "handoff";
  content: string;
  createdAt: string;
  meta?: {
    attachments?: { fileName: string; fileUrl: string; mimeType: string }[];
    handoffPacket?: any;
    intent?: { product: string; workKind?: string; confidence: number; reason: string };
  };
};

export function MessageBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  const isHandoff = msg.role === "handoff";
  const isSystem = msg.role === "system";

  if (isHandoff) {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}>
        <div style={{ maxWidth: 560, width: "100%", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 16, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "#1e40af" }}>
            <span style={{ background: "#1757d7", color: "#fff", borderRadius: 999, padding: "3px 8px", fontSize: 10 }}>HANDOFF \u2192 WORK</span>
            <span>\u0e2a\u0e48\u0e07\u0e15\u0e48\u0e2d\u0e43\u0e2b\u0e49 Work \u0e41\u0e25\u0e49\u0e27</span>
          </div>
          <div style={{ fontSize: 13, color: "#1e3a8a", marginTop: 8, lineHeight: 1.5 }}>{msg.content}</div>
          {msg.meta?.handoffPacket && (
            <div style={{ marginTop: 10, background: "#fff", border: "1px solid #dbeafe", borderRadius: 10, padding: 10, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: "#1e40af" }}>Handoff Packet \u2022 trace {msg.meta.handoffPacket.trace_id?.slice(0,8)}</div>
              <div style={{ color: "#6b7280", marginTop: 4, wordBreak: "break-all" }}>goal: {msg.meta.handoffPacket.goal?.slice(0,80)}</div>
              <div style={{ color: "#6b7280" }}>mode: {msg.meta.handoffPacket.execution_mode} \u2022 deliverables: {msg.meta.handoffPacket.deliverables?.join(", ") || "\u2014"}</div>
              <a href="/tasks" style={{ display: "inline-block", marginTop: 8, background: "#0d0d0d", color: "#fff", padding: "6px 12px", borderRadius: 999, fontSize: 12, textDecoration: "none" }}>\u0e14\u0e39 Task \u2192</a>
            </div>
          )}
          <div style={{ fontSize: 11, color: "#93c5fd", marginTop: 8 }}>{new Date(msg.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} \u2022 Cloud \u2192 Work (separate ledger)</div>
        </div>
      </div>
    );
  }

  if (isSystem) {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
        <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 999, padding: "6px 12px", fontSize: 12, color: "#92400e" }}>{msg.content}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", margin: "10px 0", gap: 8 }}>
      {!isUser && <div style={{ width: 28, height: 28, borderRadius: 999, background: "#0d0d0d", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>W</div>}
      <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
        <div style={{
          background: isUser ? "#0d0d0d" : "#fff",
          color: isUser ? "#fff" : "#0d0d0d",
          border: isUser ? "none" : "1px solid #e5e7eb",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          padding: "10px 14px",
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          boxShadow: isUser ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
        }}>
          {msg.content}
          {msg.meta?.attachments && msg.meta.attachments.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {msg.meta.attachments.map((a, i) => (
                <span key={i} style={{ background: isUser ? "rgba(255,255,255,0.15)" : "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "4px 8px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  \uD83D\uDCCE {a.fileName}
                </span>
              ))}
            </div>
          )}
          {msg.meta?.intent && msg.meta.intent.product === "work" && (
            <div style={{ marginTop: 10, background: "#f9fafb", border: "1px dashed #d1d5db", borderRadius: 10, padding: 8, color: "#374151" }}>
              <div style={{ fontSize: 11, fontWeight: 700 }}>\uD83E\uDDED Intent: Work ({msg.meta.intent.workKind}) \u2022 {Math.round(msg.meta.intent.confidence * 100)}%</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{msg.meta.intent.reason}</div>
            </div>
          )}
        </div>
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4, padding: "0 4px" }}>
          {new Date(msg.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} \u2022 {isUser ? "You \u2022 Cloud" : "Teammate \u2022 Cloud Only"}
        </div>
      </div>
    </div>
  );
}
