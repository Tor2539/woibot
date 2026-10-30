"use client";
import React, { useRef, useEffect } from "react";
import { MessageBubble, ChatMsg } from "./MessageBubble";

export function ChatThread({ messages, isTyping }: { messages: ChatMsg[]; isTyping?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" }); }, [messages, isTyping]);

  return (
    <div ref={ref} style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", background: "#fcfcfb", scrollBehavior: "smooth" }}>
      {messages.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#6b7280" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>\uD83D\uDCAC</div>
          <div style={{ fontWeight: 700, color: "#0d0d0d" }}>\u0e2a\u0e27\u0e31\u0e2a\u0e14\u0e35! \u0e1c\u0e21\u0e04\u0e37\u0e2d Teammate \u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13</div>
          <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>\u0e16\u0e32\u0e21\u0e2d\u0e30\u0e44\u0e23\u0e01\u0e47\u0e44\u0e14\u0e49 \u2014 \u0e2a\u0e23\u0e38\u0e1b\u0e2d\u0e35\u0e40\u0e21\u0e25 \u0e1b\u0e0f\u0e34\u0e17\u0e34\u0e19 \u0e40\u0e15\u0e23\u0e35\u0e22\u0e21\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23 \u0e2b\u0e23\u0e37\u0e2d\u0e2a\u0e31\u0e48\u0e07\u0e07\u0e32\u0e19\u0e2b\u0e19\u0e31\u0e01 \u0e1c\u0e21\u0e08\u0e30 Handoff \u0e44\u0e1b Work \u0e43\u0e2b\u0e49\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34<br/><span style={{ fontSize: 11, background: "#0d0d0d", color: "#fff", padding: "2px 8px", borderRadius: 999 }}>Cloud Only \u2022 24h \u2022 Memory \u0e08\u0e33\u0e04\u0e38\u0e13\u0e44\u0e14\u0e49</span></div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
            {["\u0e2a\u0e23\u0e38\u0e1b\u0e2d\u0e35\u0e40\u0e21\u0e25\u0e40\u0e0a\u0e49\u0e32\u0e19\u0e35\u0e49", "\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19 12 \u0e2b\u0e19\u0e49\u0e32 Q3", "\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e40\u0e27\u0e47\u0e1a CRM \u0e43\u0e2b\u0e49\u0e2b\u0e19\u0e48\u0e2d\u0e22", "\u0e2a\u0e23\u0e38\u0e1b\u0e1b\u0e23\u0e30\u0e0a\u0e38\u0e21\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e27\u0e32\u0e19"].map(t => (
              <span key={t} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 999, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>{t}</span>
            ))}
          </div>
        </div>
      )}
      {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
      {isTyping && (
        <div style={{ display: "flex", gap: 8, margin: "10px 0", alignItems: "center" }}>
          <div style={{ width: 28, height: 28, borderRadius: 999, background: "#0d0d0d", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>W</div>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "18px 18px 18px 4px", padding: "10px 14px", fontSize: 13, color: "#6b7280", display: "flex", gap: 4 }}>
            <span style={{ animation: "bounce 1s infinite" }}>\u25CF</span><span style={{ animation: "bounce 1s infinite 0.2s" }}>\u25CF</span><span style={{ animation: "bounce 1s infinite 0.4s" }}>\u25CF</span>
          </div>
        </div>
      )}
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-4px);opacity:1}}`}</style>
    </div>
  );
}
