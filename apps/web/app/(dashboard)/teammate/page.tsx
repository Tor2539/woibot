"use client";
import React, { useState, useEffect } from "react";
import { ChatThread } from "@/components/teammate/ChatThread";
import { ChatInput } from "@/components/teammate/ChatInput";
import { MemoryPanel } from "@/components/teammate/MemoryPanel";
import { ConnectedAppsList } from "@/components/teammate/ConnectedAppsList";
import { DailyBriefingCard, ProactiveCard } from "@/components/teammate/DailyBriefingCard";
import { TeammateHeader } from "@/components/teammate/TeammateHeader";
import { HandoffPreview } from "@/components/teammate/HandoffPreview";
import { MOCK_MEMORIES, MOCK_APPS, MockMemory, MockApp } from "@/lib/teammate/mock";
import { ChatMsg } from "@/components/teammate/MessageBubble";

export default function TeammatePage() {
  const [messages, setMessages] = useState<ChatMsg[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      content: "\u0e2a\u0e27\u0e31\u0e2a\u0e14\u0e35\u0e04\u0e23\u0e31\u0e1a! \u0e1c\u0e21\u0e04\u0e37\u0e2d Teammate \u2014 \u0e09\u0e21\u0e14\u0e39\u0e41\u0e25\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49\u0e43\u0e2b\u0e49\u0e41\u0e25\u0e49\u0e27\u0e04\u0e23\u0e31\u0e1a \u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e2a\u0e23\u0e38\u0e1b\u0e2d\u0e35\u0e40\u0e21\u0e25 \u0e1b\u0e0f\u0e34\u0e17\u0e34\u0e19 \u0e2b\u0e23\u0e37\u0e2d\u0e16\u0e49\u0e32\u0e21\u0e35\u0e07\u0e32\u0e19\u0e2b\u0e19\u0e31\u0e01 (\u0e40\u0e0a\u0e48\u0e19 \u0e2a\u0e23\u0e49\u0e32\u0e07\u0e40\u0e27\u0e47\u0e1a/\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19/\u0e27\u0e34\u0e14\u0e35\u0e42\u0e2d) \u0e1c\u0e21\u0e08\u0e30\u0e2a\u0e48\u0e07\u0e15\u0e48\u0e2d\u0e44\u0e1b Work \u0e1e\u0e23\u0e49\u0e2d\u0e21 estimate \u0e43\u0e2b\u0e49\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34 \u0e44\u0e21\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e23\u0e2d\u0e01\u0e0b\u0e49\u0e33",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [memories, setMemories] = useState<MockMemory[]>(MOCK_MEMORIES);
  const [apps, setApps] = useState<MockApp[]>(MOCK_APPS);
  const [showRight, setShowRight] = useState(true);

  // Handoff state
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [pendingGoal, setPendingGoal] = useState("");
  const [pendingEstimate, setPendingEstimate] = useState<any>(null);
  const [lastUserText, setLastUserText] = useState("");

  const handleSend = async (text: string, files?: File[]) => {
    if (!text && (!files || files.length === 0)) return;
    const userMsg: ChatMsg = {
      id: "u-" + Date.now(),
      role: "user",
      content: text + (files && files.length > 0 ? `\n\n\uD83D\uDCCE \u0e44\u0e1f\u0e25\u0e4c\u0e41\u0e19\u0e1a: ${files.map(f => f.name).join(", ")}` : ""),
      createdAt: new Date().toISOString(),
      meta: files && files.length > 0 ? { attachments: files.map(f => ({ fileName: f.name, fileUrl: "#", mimeType: f.type || "application/octet-stream" })) } : undefined,
    };
    setMessages((m) => [...m, userMsg]);
    setLastUserText(text);
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          attachments: files?.map(f => ({ fileName: f.name, mimeType: f.type })) || [],
        }),
      });
      const raw = await res.json();
      const data = (raw && raw.data) ? raw.data : raw;
      const intent = (data as any).routed || (data as any).intent;
      const estimate = (data as any).estimate || (data as any).handoffEstimate;
      const replyContent: string | null = (()=>{ const d:any=data; if(typeof d.reply==="string") return d.reply; if(d.reply?.content) return d.reply.content; if(d.message?.content) return d.message.content; return null; })();
      setIsTyping(false);

      if ((intent?.product === "work" || (data as any).task) && estimate) {
        setPendingGoal(text);
        setPendingEstimate({ ...estimate, kind: (intent as any)?.workKind || (estimate as any).kind });
        setHandoffOpen(true);
        // Also show intent card in chat
        const assistantMsg: ChatMsg = {
          id: "a-" + Date.now(),
          role: "assistant",
          content: replyContent || `\u0e15\u0e23\u0e27\u0e08\u0e1e\u0e1a\u0e07\u0e32\u0e19\u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17 ${intent?.workKind || estimate.kind} \u2014 \u0e19\u0e35\u0e48\u0e04\u0e37\u0e2d\u0e07\u0e32\u0e19\u0e2b\u0e19\u0e31\u0e01\u0e17\u0e35\u0e48\u0e04\u0e27\u0e23\u0e43\u0e2b\u0e49 Work \u0e17\u0e33 (Cloud/Local) \u0e1b\u0e23\u0e30\u0e40\u0e21\u0e34\u0e19 ${estimate.minutes} \u0e19\u0e32\u0e17\u0e35 \u2022 $${estimate.cost.toFixed(2)} \u2014 \u0e01\u0e14 Handoff \u0e14\u0e49\u0e32\u0e19\u0e25\u0e48\u0e32\u0e07\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e2a\u0e48\u0e07\u0e15\u0e48\u0e2d \u0e1e\u0e23\u0e49\u0e2d\u0e21 ledger \u0e41\u0e22\u0e01`,
          createdAt: new Date().toISOString(),
          meta: { intent },
        };
        setMessages((m) => [...m, assistantMsg]);
      } else {
        const assistantMsg: ChatMsg = {
          id: "a-" + Date.now(),
          role: "assistant",
          content: replyContent || "\u0e23\u0e31\u0e1a\u0e17\u0e23\u0e32\u0e1a\u0e04\u0e23\u0e31\u0e1a \u2014 \u0e14\u0e33\u0e40\u0e19\u0e34\u0e19\u0e01\u0e32\u0e23\u0e43\u0e2b\u0e49\u0e41\u0e25\u0e49\u0e27 (Teammate Cloud Only)",
          createdAt: new Date().toISOString(),
          meta: intent ? { intent } : undefined,
        };
        setMessages((m) => [...m, assistantMsg]);
      }
    } catch (e) {
      setIsTyping(false);
      const fallback: ChatMsg = {
        id: "a-" + Date.now(),
        role: "assistant",
        content: "\u0e02\u0e2d\u0e42\u0e17\u0e29\u0e04\u0e23\u0e31\u0e1a \u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e15\u0e48\u0e2d API \u0e44\u0e21\u0e48\u0e44\u0e14\u0e49 \u2014 \u0e19\u0e35\u0e48\u0e04\u0e37\u0e2d\u0e42\u0e2b\u0e21\u0e14 demo mock",
        createdAt: new Date().toISOString(),
      };
      setMessages((m) => [...m, fallback]);
    }
  };

  const handleHandoff = async () => {
    if (!lastUserText) {
      // manual handoff without text: prompt
      const goal = prompt("\u0e43\u0e2a\u0e48 goal \u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e2a\u0e48\u0e07\u0e44\u0e1b Work:");
      if (!goal) return;
      setLastUserText(goal);
      setPendingGoal(goal);
      // get estimate via chat route mock
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: goal }) });
      const raw = await res.json();
      const data = (raw && raw.data) ? raw.data : raw;
      const intent = (data as any).routed || (data as any).intent;
      const estimate = (data as any).estimate || (data as any).handoffEstimate;
      const replyContent: string | null = (()=>{ const d:any=data; if(typeof d.reply==="string") return d.reply; if(d.reply?.content) return d.reply.content; if(d.message?.content) return d.message.content; return null; })();
      if (data.handoffEstimate) {
        setPendingEstimate({ ...data.handoffEstimate, kind: data.intent?.workKind || "coding" });
        setHandoffOpen(true);
      } else {
        alert("\u0e44\u0e21\u0e48\u0e1e\u0e1a intent Work \u2014 \u0e25\u0e2d\u0e07\u0e1e\u0e34\u0e21\u0e1e\u0e4c \u0e40\u0e0a\u0e48\u0e19 \u2018\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e40\u0e27\u0e47\u0e1a CRM\u2019");
      }
      return;
    }
    // If we have pending, just open modal
    if (pendingEstimate) setHandoffOpen(true);
    else {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: lastUserText }) });
      const raw = await res.json();
      const data = (raw && raw.data) ? raw.data : raw;
      const intent = (data as any).routed || (data as any).intent;
      const estimate = (data as any).estimate || (data as any).handoffEstimate;
      const replyContent: string | null = (()=>{ const d:any=data; if(typeof d.reply==="string") return d.reply; if(d.reply?.content) return d.reply.content; if(d.message?.content) return d.message.content; return null; })();
      if (data.handoffEstimate) {
        setPendingGoal(lastUserText);
        setPendingEstimate({ ...data.handoffEstimate, kind: data.intent?.workKind || "coding" });
        setHandoffOpen(true);
      }
    }
  };

  const confirmHandoff = async (mode: "cloud" | "local") => {
    setHandoffOpen(false);
    const body = {
      goal: pendingGoal,
      execution_mode: mode,
      chat_history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
      memory_snippet: memories.slice(0,2).map(m => `${m.key}: ${m.value}`).join(" | "),
      attachments: [],
      deliverables: pendingEstimate ? [pendingEstimate.label] : [],
      constraints: { must_not_leak: ["PII", "secrets"] },
      verification_criteria: ["\u0e2a\u0e48\u0e07\u0e44\u0e1f\u0e25\u0e4c\u0e17\u0e35\u0e48\u0e40\u0e1b\u0e34\u0e14\u0e44\u0e14\u0e49", "preview \u0e1c\u0e48\u0e32\u0e19"],
    };

    const res = await fetch("/api/handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = await res.json();
      const data = (raw && raw.data) ? raw.data : raw;
      const intent = (data as any).routed || (data as any).intent;
      const estimate = (data as any).estimate || (data as any).handoffEstimate;
      const replyContent: string | null = (()=>{ const d:any=data; if(typeof d.reply==="string") return d.reply; if(d.reply?.content) return d.reply.content; if(d.message?.content) return d.message.content; return null; })();

    const handoffMsg: ChatMsg = {
      id: "h-" + Date.now(),
      role: "handoff",
      content: `\u0e2a\u0e48\u0e07\u0e07\u0e32\u0e19 "${pendingGoal.slice(0,60)}" \u0e44\u0e1b Work \u0e41\u0e25\u0e49\u0e27 \u2022 ${mode} \u2022 $${pendingEstimate?.cost?.toFixed(2)} \u2022 trace ${data.trace_id?.slice(0,8)}`,
      createdAt: new Date().toISOString(),
      meta: { handoffPacket: data.packet || body },
    };
    setMessages((m) => [...m, handoffMsg]);

    // system follow-up
    setTimeout(() => {
      setMessages((m) => [...m, {
        id: "s-" + Date.now(),
        role: "system",
        content: `Task \u0e16\u0e39\u0e01\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e41\u0e25\u0e49\u0e27 \u2022 \u0e14\u0e39\u0e04\u0e27\u0e32\u0e21\u0e04\u0e37\u0e1a\u0e2b\u0e19\u0e49\u0e32\u0e17\u0e35\u0e48 Tasks \u2022 \u0e40\u0e21\u0e37\u0e48\u0e2d\u0e40\u0e2a\u0e23\u0e47\u0e08 \u0e1c\u0e21\u0e08\u0e30\u0e2a\u0e23\u0e38\u0e1b\u0e01\u0e25\u0e31\u0e1a\u0e21\u0e32\u0e43\u0e19\u0e41\u0e0a\u0e17\u0e19\u0e35\u0e49`,
        createdAt: new Date().toISOString(),
      }]);
    }, 600);
  };

  // Memory handlers
  const addMemory = (m: { key: string; value: string; scope: string }) => {
    const nm: MockMemory = { id: "m" + Date.now(), key: m.key, value: m.value, scope: m.scope as any, canDelete: true, createdAt: new Date().toISOString().slice(0,10), updatedAt: new Date().toISOString().slice(0,10) };
    setMemories((prev) => [nm, ...prev]);
    fetch("/api/memories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nm) }).catch(()=>{});
  };
  const updateMemory = (id: string, patch: Partial<MockMemory>) => {
    setMemories((prev) => prev.map(m => m.id===id ? { ...m, ...patch, updatedAt: new Date().toISOString().slice(0,10) } : m));
    fetch(`/api/memories/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(()=>{});
  };
  const deleteMemory = (id: string) => {
    setMemories((prev) => prev.filter(m => m.id!==id));
    fetch(`/api/memories/${id}`, { method: "DELETE" }).catch(()=>{});
  };

  const toggleApp = (id: string) => {
    setApps((prev) => prev.map(a => a.id===id ? { ...a, status: a.status==="connected" ? "revoked" as const : "connected" as const } : a));
    fetch("/api/connected-apps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(()=>{});
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <TeammateHeader onNewChat={() => setMessages([])} />

      {/* Mobile toggle */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, background: "#0d0d0d", color: "#fff", padding: "4px 10px", borderRadius: 999, fontWeight: 700 }}>Cloud Only</span>
        <span style={{ fontSize: 11, color: "#6b7280" }}>Teammate \u0e17\u0e33\u0e07\u0e32\u0e19\u0e1a\u0e19 Cloud \u0e15\u0e25\u0e2d\u0e14 24\u0e0a\u0e21 \u0e15\u0e48\u0e2d\u0e44\u0e14\u0e49\u0e41\u0e21\u0e49\u0e1b\u0e34\u0e14\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07 \u2022 Work \u0e41\u0e22\u0e01 ledger/id/\u0e04\u0e48\u0e32\u0e43\u0e0a\u0e49\u0e08\u0e48\u0e32\u0e22</span>
        <button onClick={() => setShowRight(!showRight)} style={{ marginLeft: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 999, padding: "6px 12px", fontSize: 12, cursor: "pointer", display: "none" as any }}>{showRight ? "Hide panels" : "Show panels"}</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: showRight ? "1.55fr 0.9fr" : "1fr", gap: 12, alignItems: "start" }}>
        {/* Chat Column */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", height: "min(72vh, 760px)", minHeight: 480 }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8, background: "#fcfcfb" }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Chat</span>
            <span style={{ fontSize: 11, color: "#6b7280" }}>\u0e2a\u0e19\u0e17\u0e19\u0e32 \u2022 \u0e40\u0e2a\u0e35\u0e22\u0e07 \u2022 \u0e44\u0e1f\u0e25\u0e4c \u2022 Handoff \u0e44\u0e1b Work \u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34</span>
            <span style={{ marginLeft: "auto", fontSize: 11, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", padding: "3px 8px", borderRadius: 999 }}>\u routeIntent \u2192 auto Handoff</span>
          </div>
          <ChatThread messages={messages} isTyping={isTyping} />
          <ChatInput onSend={handleSend} onHandoff={handleHandoff} disabled={isTyping} />
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <DailyBriefingCard onAction={(id) => handleSend(`\u0e02\u0e2d\u0e14\u0e39\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14 ${id} \u0e08\u0e32\u0e01 Daily Briefing`)} />
          <ProactiveCard />
          <MemoryPanel memories={memories} onAdd={addMemory} onUpdate={updateMemory} onDelete={deleteMemory} />
          <ConnectedAppsList apps={apps} onToggle={toggleApp} />

          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>\uD83D\uDCBB Cloud Computer</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Teammate \u0e43\u0e0a\u0e49 Cloud \u0e40\u0e17\u0e48\u0e32\u0e19\u0e31\u0e49\u0e19 \u2022 \u0e22\u0e31\u0e07\u0e17\u0e33\u0e07\u0e32\u0e19\u0e15\u0e48\u0e2d\u0e44\u0e14\u0e49\u0e41\u0e21\u0e49\u0e1b\u0e34\u0e14\u0e41\u0e2d\u0e1b</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <a href="/computer" style={{ flex: 1, background: "#0d0d0d", color: "#fff", textAlign: "center", textDecoration: "none", borderRadius: 999, padding: "8px 12px", fontSize: 12, fontWeight: 600 }}>\uD83D\uDD75 Open Browser</a>
              <a href="/files" style={{ flex: 1, background: "#fff", border: "1px solid #e5e7eb", textAlign: "center", textDecoration: "none", borderRadius: 999, padding: "8px 12px", fontSize: 12, color: "#0d0d0d" }}>\uD83D\uDCC1 Files</a>
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>\u0e14\u0e39\u0e2b\u0e19\u0e49\u0e32\u0e08\u0e2d \u2022 Take Over \u2022 pause/resume \u2022 \u0e44\u0e14\u0e49\u0e17\u0e35\u0e48 /computer</div>
          </div>
        </div>
      </div>

      <HandoffPreview open={handoffOpen} onClose={() => setHandoffOpen(false)} estimate={pendingEstimate} goal={pendingGoal} onConfirm={confirmHandoff} />
    </div>
  );
}
