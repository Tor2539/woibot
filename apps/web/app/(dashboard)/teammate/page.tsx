"use client";

import Link from "next/link";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Send,
  Paperclip,
  Mic,
  MicOff,
  ChevronRight,
  ChevronDown,
  Monitor,
  Brain,
  Repeat2,
  FolderOpen,
  Info,
  Check,
  X,
  ArrowUpRight,
  ShieldAlert,
  Lock,
  Sparkles,
  Terminal,
  Play,
  Pause,
  Plus,
  Trash2,
  Share2,
  SlidersHorizontal,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  PanelRightClose,
  PanelRightOpen,
  Layers,
  Code2,
  Cloud,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ROSTER_BOTS } from "@/components/layout/sidebar";
import {
  useVoiceCommand,
  VOICE_UNSUPPORTED_MESSAGE,
  type VoiceLang,
} from "@/components/voice/useVoiceCommand";

type InspectorTab = "computer" | "memory" | "routines" | "library" | "overview";

interface StepItem {
  tool: string;
  detail: string;
}

interface ChatMsg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  meta?: {
    workedFor?: string;
    provider?: string;
    steps?: StepItem[];
    cardType?: "email-draft" | "handoff-card" | "permission-request" | "secret-request";
    emailDraft?: {
      id: string;
      to: string;
      subject: string;
      body: string;
      sendMode: "ask_first" | "send_without_asking" | "disabled";
      status: "pending" | "sent" | "discarded";
    };
    taskId?: string;
    trace_id?: string;
    workKind?: string;
    executionMode?: "cloud" | "local";
    estimate?: {
      kind: string;
      cost: number;
      minutes: number;
      label: string;
      tools?: string[];
    };
    permissionRequest?: {
      id: string;
      action: string;
      scope: string;
      riskLevel: string;
      status: "pending" | "allowed_once" | "allowed_always" | "denied";
    };
    secretRequest?: {
      id: string;
      keyName: string;
      targetHost: string;
      note: string;
      saved?: boolean;
    };
    attachments?: { fileName: string; fileUrl: string; mimeType: string }[];
  };
}

const SKILLS_CATALOG = [
  { slug: "@daily-briefing", label: "Daily Executive Briefing", prompt: "สรุปอีเมล VIP เช้านี้ ตารางประชุมวันนี้ และงานค้างที่ต้องติดตาม" },
  { slug: "@inbox-triage", label: "VIP Inbox Triage & Draft", prompt: "ช่วยเช็คอีเมลสำคัญและร่างอีเมลตอบกลับลูกค้าให้ตรวจก่อนส่ง" },
  { slug: "@work-crm", label: "Delegate CRM App to Work", prompt: "สร้างระบบเว็บ Sales CRM พร้อม Dashboard ยอดขายและ Automated Tests" },
  { slug: "@work-deck", label: "Create Board Deck in Work", prompt: "สร้างรายงานผู้บริหาร Q4 14 หน้า พร้อมสไลด์นำเสนอบอร์ด 10 หน้า" },
];

function TeammateWorkspaceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const botParam = searchParams.get("bot") || "tm_main";
  const isNewParam = searchParams.get("new") === "1";

  const [activeBotId, setActiveBotId] = useState(botParam);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [effort, setEffort] = useState<"auto" | "fast" | "high">("auto");
  const [forceWork, setForceWork] = useState(false);
  const [workMode, setWorkMode] = useState<"cloud" | "local">("cloud");
  const [showSkillsMenu, setShowSkillsMenu] = useState(false);
  const [voiceLang, setVoiceLang] = useState<VoiceLang>("th-TH");
  const [voiceNotice, setVoiceNotice] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ fileName: string; fileUrl: string; mimeType: string }[]>([]);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [expandedTraces, setExpandedTraces] = useState<Record<string, boolean>>({});
  const [briefingOpen, setBriefingOpen] = useState(true);
  const [briefing, setBriefing] = useState<any>(null);
  const [computer, setComputer] = useState<any>(null);
  const [bots, setBots] = useState<any[]>([]);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [botMenuOpen, setBotMenuOpen] = useState(false);
  const [newBotOpen, setNewBotOpen] = useState(false);
  const [newBotName, setNewBotName] = useState("");
  const [newBotRole, setNewBotRole] = useState("");
  const [botSaving, setBotSaving] = useState(false);
  const [screenImg, setScreenImg] = useState<string>("");
  const [screenTs, setScreenTs] = useState<string>("");
  const [screenTick, setScreenTick] = useState(0);

  // Live screen: browser loads a real PNG of the container display; a ticker rotates
  // the cache-busting param so the image refreshes on its own.
  useEffect(() => {
    const id = setInterval(() => setScreenTick((n) => n + 1), 8000);
    return () => clearInterval(id);
  }, []);

  // Stop any speech synthesis when leaving the page.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);


  // Right Inspector state (Grok Bot Bot-Details + Cursor Panel)
  // SSR renders closed; the real value is set after hydration (layout effect)
  // so server and client markup always match.
  const [inspectorOpen, setInspectorOpen] = useState(false);
  useEffect(() => {
    setInspectorOpen(window.innerWidth >= 1024);
  }, []);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("computer");
  const [computerTakeover, setComputerTakeover] = useState(false);
  const [teachRecording, setTeachRecording] = useState(false);

  // Memories & Routines in Inspector
  const [memories, setMemories] = useState<any[]>([]);
  const [newMemKey, setNewMemKey] = useState("");
  const [newMemVal, setNewMemVal] = useState("");
  const [newMemScope, setNewMemScope] = useState<"personal" | "team">("personal");
  const [routines, setRoutines] = useState<any[]>([]);
  const [secretInputVal, setSecretInputVal] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const roster = bots.length
    ? bots.map((b: any) => ({
        id: b.id,
        name: b.name,
        role: b.role,
        badge: b.isMain ? "MAIN" : undefined,
        dot: "#34d399",
        status: b.isMain
          ? computer?.status === "running"
            ? "On its computer · running"
            : "Idle · Ready"
          : "Idle · Ready",
        isMain: Boolean(b.isMain),
      }))
    : ROSTER_BOTS;
  const currentBot = roster.find((b: any) => b.id === activeBotId) || roster[0];

  useEffect(() => {
    setActiveBotId(botParam);
  }, [botParam]);

  useEffect(() => {
    if (isNewParam) {
      setMessages([]);
      return;
    }
    fetch(`/api/chat?teammateId=${activeBotId}`)
      .then((r) => r.json())
      .then((res) => {
        const list = res?.data?.messages || res?.messages || [];
        setMessages(list);
      })
      .catch(() => {});
  }, [activeBotId, isNewParam]);

  useEffect(() => {
    fetch("/api/memories")
      .then((r) => r.json())
      .then((res) => setMemories(res?.memories || []))
      .catch(() => {});
    fetch("/api/routines")
      .then((r) => r.json())
      .then((res) => setRoutines(res?.data?.routines || res?.routines || []))
      .catch(() => {});
    fetch("/api/briefing")
      .then((r) => r.json())
      .then((res) => setBriefing(res?.ok ? res : null))
      .catch(() => setBriefing(null));
    fetch("/api/computer")
      .then((r) => r.json())
      .then((res) => {
        const c = res?.computer || null;
        if (c) {
          const origin = res?.origin || "https://computer.woibot.com";
          setComputer({ ...c, vncUrl: c.vncPath ? `${origin}${c.vncPath}` : null });
        } else {
          setComputer(null);
        }
      })
      .catch(() => setComputer(null));
    fetch("/api/teammate")
      .then((r) => r.json())
      .then((res) => {
        setBots(res?.teammates || []);
        if (res?.teammate?.computer) setComputer((c: any) => c || res.teammate.computer);
      })
      .catch(() => {});
    fetch("/api/artifacts")
      .then((r) => r.json())
      .then((res) => setArtifacts(res?.artifacts || []))
      .catch(() => {});
    fetch("/api/connected-apps")
      .then((r) => r.json())
      .then((res) => setApps(res?.apps || []))
      .catch(() => {});
  }, []);

  const toggleTrace = (msgId: string) => {
    setExpandedTraces((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleSend = async (overrideText?: string, overrideForceWork?: boolean) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    const tempUserMsg: ChatMsg = {
      id: `local_${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
      meta: { attachments: attachedFiles },
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    if (!overrideText) setInput("");
    setAttachedFiles([]);
    setAttachedImages([]);
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teammateId: activeBotId,
          message: text,
          effort,
          forceWork: overrideForceWork ?? forceWork,
          executionMode: workMode,
          attachments: tempUserMsg.meta?.attachments || [],
          images: attachedImages,
        }),
      });
      const json = await res.json();
      const payload = json?.data || json;
      if (payload?.assistantMessage) {
        setMessages((prev) => [...prev, payload.assistantMessage]);
      } else if (payload?.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: `asst_${Date.now()}`,
            role: "assistant",
            content: payload.reply,
            meta: payload.task
              ? {
                  cardType: "handoff-card",
                  taskId: payload.task.id,
                  trace_id: payload.task.traceId,
                  workKind: payload.task.workKind || "coding",
                  executionMode: workMode,
                  estimate: payload.estimate,
                }
              : { workedFor: "4s" },
          },
        ]);
      }
      // Refresh memories in case a memory rule was added
      fetch("/api/memories")
        .then((r) => r.json())
        .then((d) => setMemories(d?.memories || []))
        .catch(() => {});
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: "รับทราบครับ — บันทึกคำสั่งลงคิว Cloud Computer เรียบร้อย",
        },
      ]);
    } finally {
      setSending(false);
      setForceWork(false);
      setTimeout(() => feedEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemKey.trim() || !newMemVal.trim()) return;
    const res = await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: newMemKey.trim(), value: newMemVal.trim(), scope: newMemScope }),
    });
    const data = await res.json();
    if (data?.memory) {
      setMemories((prev) => [data.memory, ...prev]);
      setNewMemKey("");
      setNewMemVal("");
    }
  };

  const handleDeleteMemory = async (id: string) => {
    await fetch(`/api/memories/${id}`, { method: "DELETE" });
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const handlePromoteMemory = async (mem: any) => {
    const nextScope = mem.scope === "personal" ? "team" : "personal";
    const res = await fetch(`/api/memories/${mem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: nextScope }),
    });
    const data = await res.json();
    if (data?.memory) {
      setMemories((prev) => prev.map((m) => (m.id === mem.id ? data.memory : m)));
    }
  };

  const handleUpdateEmailDraft = (msgId: string, patch: Record<string, any>) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.meta?.emailDraft
          ? { ...m, meta: { ...m.meta, emailDraft: { ...m.meta.emailDraft, ...patch } } }
          : m
      )
    );
  };

  const handleUpdatePermission = (msgId: string, status: "allowed_once" | "allowed_always" | "denied") => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.meta?.permissionRequest
          ? { ...m, meta: { ...m.meta, permissionRequest: { ...m.meta.permissionRequest, status } } }
          : m
      )
    );
  };

  const handleSaveVaultSecret = async (msgId: string, keyName: string, host: string) => {
    if (!secretInputVal.trim()) return;
    await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVaultSecret: true, key: keyName, value: secretInputVal, hostAllowlist: host }),
    });
    setSecretInputVal("");
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.meta?.secretRequest
          ? { ...m, meta: { ...m.meta, secretRequest: { ...m.meta.secretRequest, saved: true } } }
          : m
      )
    );
  };

  // Real browser dictation (Web Speech API). Final transcript is routed through
  // /api/voice/command: computer actions run inside the user's Cloud Computer,
  // everything else falls back to the normal chat path.
  const voice = useVoiceCommand({ lang: voiceLang, onFinal: handleVoiceFinal });

  async function handleVoiceFinal(raw: string) {
    const spoken = raw.trim();
    if (!spoken || voiceBusy) return;

    setVoiceBusy(true);
    setVoiceNotice(`กำลังสั่งงาน: “${spoken}”`);

    try {
      const res = await fetch("/api/voice/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: spoken }),
      });
      const json = await res.json().catch(() => ({} as any));

      if (json?.kind === "action") {
        const result = json.result || {};
        const cmdOk = Boolean(result.ok) && Number(result.code ?? 0) === 0;
        const outRaw = String(json.stdout || result.stdout || result.stderr || "").trim();
        const out = outRaw
          ? outRaw.length > 400
            ? `${outRaw.slice(0, 400)}…`
            : outRaw
          : cmdOk
            ? "คำสั่งทำงานเสร็จแล้ว (ไม่มี output)"
            : String(result.error || "คำสั่งล้มเหลว (ไม่มี output)");

        setMessages((prev) => [
          ...prev,
          {
            id: `voice_u_${Date.now()}`,
            role: "user" as const,
            content: spoken,
            createdAt: new Date().toISOString(),
          },
          {
            id: `voice_a_${Date.now() + 1}`,
            role: "assistant" as const,
            content: `${cmdOk ? "ทำบน Cloud Computer แล้ว" : "คำสั่งไม่สำเร็จ"} · ${json.label || json.intent || "action"}\n${out}`,
            createdAt: new Date().toISOString(),
            meta: {
              workedFor: "<1s",
              steps: [
                { tool: "voice.command", detail: `“${spoken}” → ${json.intent || "action"}` },
                { tool: "computer.exec", detail: String(json.cmd || "").slice(0, 160) },
              ],
            },
          },
        ]);

        setVoiceNotice(cmdOk ? `สั่งงานสำเร็จ · ${json.label || json.intent}` : `คำสั่งคืน exit ${result.code ?? "?"}`);
        // Pull a fresh frame of the container display after the action ran.
        setScreenTick((n) => n + 1);
        setScreenTs(new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }));
      } else if (json?.kind === "chat") {
        setVoiceNotice(`ไม่ได้เป็นคำสั่งคอมพิวเตอร์ — ส่งให้ ${currentBot.name} ตอบ`);
        await handleSend(spoken);
      } else {
        setVoiceNotice(json?.error || "สั่งงานด้วยเสียงไม่สำเร็จ");
      }
    } catch {
      setVoiceNotice("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ — ลองอีกครั้ง");
    } finally {
      setVoiceBusy(false);
      setTimeout(() => feedEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }

  const toggleVoiceInput = () => {
    if (!voice.supported) {
      setVoiceNotice(VOICE_UNSUPPORTED_MESSAGE);
      return;
    }
    if (voice.listening) {
      voice.stop();
      return;
    }
    setVoiceNotice("");
    voice.start();
  };

  const toggleVoiceLang = () => {
    const next: VoiceLang = voiceLang === "th-TH" ? "en-US" : "th-TH";
    setVoiceLang(next);
    voice.setLang(next);
    setVoiceNotice(next === "th-TH" ? "เปลี่ยนภาษาพูดเป็นไทย" : "Switched dictation to English");
  };

  const speakLastAssistant = () => {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth || typeof window.SpeechSynthesisUtterance === "undefined") {
      setVoiceNotice("เบราว์เซอร์นี้ไม่รองรับการอ่านออกเสียง");
      return;
    }
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const last = [...messages].reverse().find((m) => m.role === "assistant" && m.content?.trim());
    if (!last) {
      setVoiceNotice("ยังไม่มีข้อความของผู้ช่วยให้อ่านออกเสียง");
      return;
    }
    const plain = last.content
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[*_`#>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1200);
    if (!plain) {
      setVoiceNotice("ไม่มีข้อความที่อ่านออกเสียงได้");
      return;
    }
    synth.cancel();
    const utterance = new window.SpeechSynthesisUtterance(plain);
    utterance.lang = voiceLang;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    setVoiceNotice("");
    synth.speak(utterance);
  };

  return (
    <div className="flex h-[calc(100vh-48px)] lg:h-screen w-full overflow-hidden">
      {/* CENTER MAIN CHAT COLUMN */}
      <div className="flex min-w-0 flex-1 flex-col h-full">
        {/* Top 48px Bar (Grok Bot + Cursor Agents Header) */}
        <header
          className="flex h-[48px] shrink-0 items-center justify-between gap-2 px-4"
          style={{ borderBottom: "1px solid var(--wb-line)", backgroundColor: "var(--wb-bg)" }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wb-raised)] border border-[var(--wb-line-strong)] text-[11px] font-bold">
              {currentBot.name.slice(0, 2).toUpperCase()}
              <span
                className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-[var(--wb-bg)]"
                style={{ backgroundColor: currentBot.dot }}
              />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setBotMenuOpen((v) => !v)}
                className="flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[13.5px] font-semibold text-[var(--wb-fg)] hover:bg-[var(--wb-hover)]"
                title="สลับ / สร้าง Teammate"
              >
                <span className="max-w-[160px] truncate">{currentBot.name}</span>
                <ChevronDown className="h-3.5 w-3.5 text-[var(--wb-muted)]" />
              </button>
              <span className="hidden sm:inline-block rounded bg-[var(--wb-raised)] border border-[var(--wb-line)] px-1.5 py-0.5 text-[11px] text-[var(--wb-muted)]">
                {currentBot.role}
              </span>
              <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10.5px] font-medium text-emerald-400">
                <Cloud className="h-3 w-3" />
                Cloud Only · {currentBot.status}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setInspectorOpen(true);
                setInspectorTab("computer");
              }}
              className="inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-[var(--wb-hover)]"
              style={{ border: "1px solid var(--wb-line)", backgroundColor: "var(--wb-raised)" }}
              title="View Bot's Cloud Computer (noVNC :99)"
            >
              <Monitor className="h-3.5 w-3.5 text-[#3b82f6]" />
              <span className="hidden sm:inline">Bot Screen (:99)</span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/work?area=code")}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[12px] font-medium text-[var(--wb-muted)] hover:text-[var(--wb-fg)] hover:bg-[var(--wb-hover)]"
              style={{ border: "1px solid var(--wb-line)" }}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Open Work Studio</span>
            </button>

            <button
              type="button"
              onClick={() => setInspectorOpen((o) => !o)}
              className="flex h-7 w-7 items-center justify-center rounded-[7px] hover:bg-[var(--wb-hover)] text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
              style={{ border: "1px solid var(--wb-line)" }}
              title="Toggle Bot Details & Inspector"
            >
              {inspectorOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            </button>
          </div>
        </header>

        {botMenuOpen && (
          <div className="relative">
            <div
              className="absolute left-4 top-1 z-40 w-[300px] rounded-[10px] p-1.5 shadow-2xl"
              style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
            >
              <div className="px-2 py-1 text-[10.5px] uppercase tracking-wide text-[var(--wb-muted)]">
                Teammates ของคุณ ({roster.length})
              </div>
              <div className="max-h-64 overflow-y-auto">
                {roster.map((b: any) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setActiveBotId(b.id);
                      setBotMenuOpen(false);
                      router.replace(`/teammate?bot=${b.id}`);
                    }}
                    className="flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left hover:bg-[var(--wb-hover)]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: b.dot }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium">{b.name}</span>
                      <span className="block truncate text-[10.5px] text-[var(--wb-muted)]">{b.role}</span>
                    </span>
                    {b.badge && (
                      <span className="rounded bg-[var(--wb-panel)] px-1.5 py-0.5 text-[9.5px] text-[var(--wb-muted)]">
                        {b.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setBotMenuOpen(false);
                  setNewBotOpen(true);
                }}
                className="mt-1 flex w-full items-center gap-1.5 rounded-[7px] px-2 py-1.5 text-[12px] font-medium text-[#7cb0ff] hover:bg-[var(--wb-hover)]"
              >
                <Plus className="h-3.5 w-3.5" /> สร้าง Teammate ใหม่
              </button>
            </div>
          </div>
        )}

        {newBotOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div
              className="w-full max-w-[420px] rounded-[12px] p-4 space-y-3"
              style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
            >
              <div>
                <div className="text-[14px] font-semibold">สร้าง Teammate ใหม่</div>
                <div className="text-[11.5px] text-[var(--wb-muted)]">
                  บอกชื่อและหน้าที่ — ไม่ต้องเขียน prompt
                </div>
              </div>
              <input
                value={newBotName}
                onChange={(e) => setNewBotName(e.target.value)}
                placeholder="ชื่อ เช่น Finance Ops"
                className="w-full rounded-[8px] px-3 py-2 text-[13px] outline-none"
                style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)", color: "var(--wb-fg)" }}
              />
              <input
                value={newBotRole}
                onChange={(e) => setNewBotRole(e.target.value)}
                placeholder="หน้าที่ เช่น ตรวจใบแจ้งหนี้และสรุปต้นทุนรายเดือน"
                className="w-full rounded-[8px] px-3 py-2 text-[13px] outline-none"
                style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)", color: "var(--wb-fg)" }}
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setNewBotOpen(false)}
                  className="rounded-[7px] px-3 py-1.5 text-[12px]"
                  style={{ border: "1px solid var(--wb-line)", color: "var(--wb-muted)" }}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={!newBotName.trim() || botSaving}
                  onClick={async () => {
                    if (!newBotName.trim()) return;
                    setBotSaving(true);
                    try {
                      const res = await fetch("/api/teammate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: newBotName.trim(),
                          role: newBotRole.trim() || "Operations Specialist",
                          language: "th",
                        }),
                      }).then((r) => r.json());
                      if (res?.ok) {
                        const list = await fetch("/api/teammate").then((r) => r.json());
                        setBots(list?.teammates || []);
                        if (res.teammate?.id) {
                          setActiveBotId(res.teammate.id);
                          router.replace(`/teammate?bot=${res.teammate.id}`);
                        }
                        setNewBotOpen(false);
                        setNewBotName("");
                        setNewBotRole("");
                      }
                    } finally {
                      setBotSaving(false);
                    }
                  }}
                  className="rounded-[7px] bg-[#2b66e0] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
                >
                  {botSaving ? "กำลังสร้าง…" : "สร้าง"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Chat Transcript */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="mx-auto max-w-[740px] space-y-5">
            {/* Day Stamp */}
            <div className="text-center text-[11.5px] font-medium text-[var(--wb-muted)]">
              Saturday, 31 Oct 2026 · Cloud Computer Persistent Session
            </div>

            {/* Collapsible 08:00 Daily Executive Briefing Card */}
            <div
              className="overflow-hidden rounded-[12px]"
              style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
            >
              <div
                onClick={() => setBriefingOpen((b) => !b)}
                className="flex cursor-pointer items-center justify-between px-4 py-2.5 hover:bg-[var(--wb-hover)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />
                  <span className="text-[12.5px] font-semibold">08:00 Daily Briefing & Proactive Queue</span>
                  <span className="rounded bg-[#2b66e0]/20 px-1.5 py-0 text-[10.5px] font-medium text-[#7cb0ff] tabular-nums">
                    {briefing
                      ? `${briefing.stats.tasks} งานค้าง · ${briefing.stats.completed} เสร็จ · ${briefing.stats.apps} แอปเชื่อมต่อ`
                      : "กำลังโหลดข้อมูลจริง…"}
                  </span>
                </div>
                {briefingOpen ? (
                  <ChevronDown className="h-4 w-4 text-[var(--wb-muted)]" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-[var(--wb-muted)]" />
                )}
              </div>

              {briefingOpen && (
                <div className="px-4 pb-3.5 pt-1 space-y-2.5" style={{ borderTop: "1px solid var(--wb-line)" }}>
                  <div className="grid gap-2 sm:grid-cols-3 pt-1.5">
                    {(briefing?.items || []).slice(0, 3).map((it: any) => {
                      const Icon = it.type === "calendar" ? Calendar : it.type === "email" ? Mail : Clock;
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => it.taskId && router.push(`/work/${it.taskId}`)}
                          className="rounded-lg p-2.5 text-left transition-all hover:brightness-110"
                          style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                        >
                          <div className="flex items-center justify-between text-[11px] text-[var(--wb-muted)]">
                            <span className="uppercase tracking-wide">{it.type}</span>
                            <Icon className="h-3.5 w-3.5 text-[#3b82f6]" />
                          </div>
                          <div className="mt-1 line-clamp-2 text-[12.5px] font-semibold">{it.title}</div>
                          <div className="mt-0.5 line-clamp-2 text-[11px] text-[var(--wb-muted)]">{it.detail}</div>
                        </button>
                      );
                    })}
                    {briefing && (briefing.items || []).length === 0 && (
                      <div
                        className="rounded-lg p-3 text-[12px] text-[var(--wb-muted)] sm:col-span-3"
                        style={{ backgroundColor: "var(--wb-panel)", border: "1px dashed var(--wb-line-strong)" }}
                      >
                        ยังไม่มีงานค้างหรือข้อมูลให้สรุป — สั่งงาน Teammate หรือเชื่อม Connected Apps
                        เพื่อให้สรุปนี้มาจากข้อมูลจริงของคุณ
                      </div>
                    )}
                    {!briefing && (
                      <div className="rounded-lg p-3 text-[12px] text-[var(--wb-muted)] sm:col-span-3"
                        style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}>
                        กำลังโหลดสรุปจากงานของคุณ…
                      </div>
                    )}
                  </div>

                  {/* Quick Proactive Action Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] text-[var(--wb-muted)] mr-1">Proactive:</span>
                    {SKILLS_CATALOG.map((sk) => (
                      <button
                        key={sk.slug}
                        type="button"
                        onClick={() => handleSend(sk.prompt, sk.slug.startsWith("@work"))}
                        className="rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors hover:border-[var(--wb-line-strong)] hover:text-[var(--wb-fg)] text-[var(--wb-fg-soft)]"
                        style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                      >
                        {sk.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Messages List */}
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              const meta = msg.meta || {};
              const traceOpen = !!expandedTraces[msg.id];

              if (isUser) {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div
                      className="max-w-[82%] sm:max-w-[72%] rounded-[20px] px-4 py-2.5 text-[14.5px] leading-[1.6]"
                      style={{
                        backgroundColor: "var(--wb-bubble-user)",
                        color: "var(--wb-bubble-user-fg)",
                      }}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      {meta.attachments && meta.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {meta.attachments.map((att, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded bg-black/25 px-2 py-0.5 text-[11px]"
                            >
                              <Paperclip className="h-3 w-3" />
                              {att.fileName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="space-y-2">
                  {/* Grok Bot / ChatGPT / Claude Desktop Collapsible "Worked for Xs" Trace Row */}
                  {(meta.workedFor || (meta.steps && meta.steps.length > 0)) && (
                    <div className="pl-1">
                      <button
                        type="button"
                        onClick={() => toggleTrace(msg.id)}
                        className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--wb-muted)] hover:text-[var(--wb-fg)] transition-colors"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span>
                          Worked for {meta.workedFor || "5s"}
                          {meta.steps ? ` · ${meta.steps.length} steps` : ""}
                        </span>
                        {traceOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                      {traceOpen && meta.steps && (
                        <div
                          className="mt-1.5 rounded-lg p-2.5 space-y-1.5 font-mono text-[11.5px]"
                          style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                        >
                          {meta.steps.map((st, i) => (
                            <div key={i} className="flex items-start gap-2 text-[var(--wb-muted)]">
                              <span className="text-[#7cb0ff] shrink-0">{st.tool}</span>
                              <span className="text-[var(--wb-fg-soft)]">{st.detail}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assistant Text */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wb-raised)] border border-[var(--wb-line-strong)] text-[10px] font-bold">
                      {currentBot.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="whitespace-pre-wrap text-[14.5px] leading-[1.68] text-[var(--wb-fg)]">
                        {msg.content}
                      </div>

                      {/* CARD 1: Grok Bot Email Draft Card (Ask first / Send without asking) */}
                      {meta.cardType === "email-draft" && meta.emailDraft && (
                        <div
                          className="rounded-[12px] p-4 space-y-3"
                          style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-[#3b82f6]" />
                              <span className="text-[13px] font-semibold">Email Draft · Ready for Review</span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${
                                  meta.emailDraft.status === "sent"
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : "bg-amber-500/15 text-amber-400"
                                }`}
                              >
                                {meta.emailDraft.status === "sent" ? "Sent via Gmail" : "Draft (Ask First)"}
                              </span>
                            </div>
                            <select
                              value={meta.emailDraft.sendMode}
                              onChange={(e) => handleUpdateEmailDraft(msg.id, { sendMode: e.target.value })}
                              className="rounded-md px-2 py-1 text-[11px] bg-[var(--wb-panel)] border border-[var(--wb-line)] text-[var(--wb-muted)]"
                            >
                              <option value="ask_first">Mode: Ask first before send</option>
                              <option value="send_without_asking">Mode: Send without asking (this recipient)</option>
                            </select>
                          </div>

                          <div className="space-y-1.5 text-[12.5px]">
                            <div className="flex items-center gap-2">
                              <span className="w-14 text-[var(--wb-muted)]">To:</span>
                              <input
                                type="text"
                                value={meta.emailDraft.to}
                                onChange={(e) => handleUpdateEmailDraft(msg.id, { to: e.target.value })}
                                className="flex-1 rounded px-2 py-1 bg-[var(--wb-panel)] border border-[var(--wb-line)] text-[var(--wb-fg)]"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-14 text-[var(--wb-muted)]">Subject:</span>
                              <input
                                type="text"
                                value={meta.emailDraft.subject}
                                onChange={(e) => handleUpdateEmailDraft(msg.id, { subject: e.target.value })}
                                className="flex-1 rounded px-2 py-1 bg-[var(--wb-panel)] border border-[var(--wb-line)] text-[var(--wb-fg)]"
                              />
                            </div>
                            <textarea
                              rows={4}
                              value={meta.emailDraft.body}
                              onChange={(e) => handleUpdateEmailDraft(msg.id, { body: e.target.value })}
                              className="mt-1 w-full rounded-lg p-2.5 text-[12.5px] leading-relaxed bg-[var(--wb-panel)] border border-[var(--wb-line)] text-[var(--wb-fg)]"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            {meta.emailDraft.status !== "sent" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateEmailDraft(msg.id, { status: "discarded" })}
                                  className="rounded-[7px] px-3 py-1.5 text-[12px] text-[var(--wb-muted)] hover:bg-[var(--wb-hover)]"
                                  style={{ border: "1px solid var(--wb-line)" }}
                                >
                                  Discard
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateEmailDraft(msg.id, { status: "sent" })}
                                  className="inline-flex items-center gap-1.5 rounded-[7px] bg-[#2b66e0] hover:bg-[#2458c6] px-3.5 py-1.5 text-[12px] font-medium text-white"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Approve & Send Email
                                </button>
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-400">
                                <CheckCircle2 className="h-4 w-4" /> Sent to {meta.emailDraft.to}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* CARD 2: Compact Work Handoff Card (per nymoru01-two-modes-switch: compact in Teammate, full live detail in Work) */}
                      {(meta.cardType === "handoff-card" || meta.taskId) && (
                        <div
                          className="rounded-[12px] p-4 space-y-3"
                          style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-[#2b66e0]/20 px-2 py-0.5 text-[11px] font-semibold uppercase text-[#7cb0ff]">
                                Handoff → Work ({meta.workKind || "coding"})
                              </span>
                              <span className="font-mono text-[11px] text-[var(--wb-muted)]">
                                {meta.trace_id || "trace_active"}
                              </span>
                            </div>
                            <span className="rounded-full bg-[var(--wb-panel)] border border-[var(--wb-line)] px-2.5 py-0.5 text-[11px] font-medium tabular-nums">
                              {meta.executionMode === "local" ? "Local Computer" : "Cloud Sandbox"}
                            </span>
                          </div>

                          {meta.estimate && (
                            <div
                              className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-[12.5px]"
                              style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                            >
                              <div>
                                <div className="font-medium text-[var(--wb-fg)]">{meta.estimate.label}</div>
                                <div className="text-[11px] text-[var(--wb-muted)]">
                                  Isolated Work Ledger (ไม่หักโควต้า Teammate รายเดือน)
                                </div>
                              </div>
                              <div className="text-right font-mono tabular-nums">
                                <div className="text-[13.5px] font-bold text-[#7cb0ff]">
                                  ~${meta.estimate.cost.toFixed(2)}
                                </div>
                                <div className="text-[11px] text-[var(--wb-muted)]">
                                  ~{meta.estimate.minutes} mins
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <span className="text-[11.5px] text-[var(--wb-muted)]">
                              Context, Memory & Verification criteria attached
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => router.push(`/work/${meta.taskId || "tsk_crm_code"}`)}
                                className="inline-flex items-center gap-1.5 rounded-[7px] bg-[#2b66e0] hover:bg-[#2458c6] px-3.5 py-1.5 text-[12px] font-medium text-white"
                              >
                                <span>Open in Work Studio</span>
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* CARD 3: Graduated Approval Card (Grok Bot §2.3) */}
                      {meta.cardType === "permission-request" && meta.permissionRequest && (
                        <div
                          className="rounded-[12px] p-4 space-y-3"
                          style={{ backgroundColor: "var(--wb-raised)", border: "1px solid rgba(245, 158, 11, 0.4)" }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="h-4 w-4 text-amber-400" />
                              <span className="text-[13px] font-semibold">Approval Fence · High-Impact Action</span>
                            </div>
                            <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-amber-400 uppercase">
                              {meta.permissionRequest.status}
                            </span>
                          </div>
                          <p className="text-[12.5px] text-[var(--wb-fg-soft)]">
                            Bot <strong>{meta.permissionRequest.scope}</strong> requests permission for:{" "}
                            <span className="font-mono text-[var(--wb-fg)]">{meta.permissionRequest.action}</span>
                          </p>
                          {meta.permissionRequest.status === "pending" && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleUpdatePermission(msg.id, "allowed_once")}
                                className="rounded-[7px] bg-[#2b66e0] px-3 py-1.5 text-[12px] font-medium text-white"
                              >
                                Allow once
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdatePermission(msg.id, "allowed_always")}
                                className="rounded-[7px] bg-[var(--wb-panel)] border border-[var(--wb-line-strong)] px-3 py-1.5 text-[12px] font-medium text-[var(--wb-fg)]"
                              >
                                Always allow for this Bot
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdatePermission(msg.id, "denied")}
                                className="rounded-[7px] px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10"
                              >
                                Deny
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* CARD 4: Secure Vault Secret Form (Secrets never reach LLM) */}
                      {meta.cardType === "secret-request" && meta.secretRequest && (
                        <div
                          className="rounded-[12px] p-4 space-y-3"
                          style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Lock className="h-4 w-4 text-emerald-400" />
                              <span className="text-[13px] font-semibold">Secure Vault Entry · {meta.secretRequest.keyName}</span>
                            </div>
                            <span className="text-[11px] font-mono text-[var(--wb-muted)]">
                              Host: {meta.secretRequest.targetHost}
                            </span>
                          </div>
                          <p className="text-[11.5px] text-[var(--wb-muted)]">{meta.secretRequest.note}</p>
                          {!meta.secretRequest.saved ? (
                            <div className="flex gap-2">
                              <input
                                type="password"
                                value={secretInputVal}
                                onChange={(e) => setSecretInputVal(e.target.value)}
                                placeholder="Enter secret / password (encrypted directly to Vault)..."
                                className="flex-1 rounded-[7px] px-3 py-1.5 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleSaveVaultSecret(msg.id, meta.secretRequest!.keyName, meta.secretRequest!.targetHost)
                                }
                                className="rounded-[7px] bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-[12px] font-medium text-white"
                              >
                                Save to Vault
                              </button>
                            </div>
                          ) : (
                            <div className="text-[12px] font-medium text-emerald-400">
                              ✓ Stored in Woibot Vault (write-only, hidden from model transcript)
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action Footer Row under Assistant message */}
                      <div className="flex items-center gap-3 pt-0.5 text-[11.5px] text-[var(--wb-muted)]">
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(msg.content)}
                          className="hover:text-[var(--wb-fg)]"
                        >
                          Copy
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => handleSend(`ส่งต่องานนี้ให้ Work ทำต่อ: ${msg.content.slice(0, 90)}`, true)}
                          className="inline-flex items-center gap-1 hover:text-[#7cb0ff]"
                        >
                          Delegate to Work <ArrowUpRight className="h-3 w-3" />
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => {
                            setInspectorOpen(true);
                            setInspectorTab("routines");
                          }}
                          className="hover:text-[var(--wb-fg)]"
                        >
                          Save as Routine
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex items-center gap-2.5 pl-1 text-[12.5px] text-[var(--wb-muted)]">
                <span className="h-2 w-2 rounded-full bg-[#3b82f6] animate-ping" />
                <span>{currentBot.name} is working on Cloud Computer (:99)...</span>
              </div>
            )}

            <div ref={feedEndRef} />
          </div>
        </div>

        {/* Bottom Composer (Claude Desktop + Grok Bot style) */}
        <div className="shrink-0 px-4 pb-4 pt-1">
          <div className="mx-auto max-w-[740px]">
            {/* Skills Popover */}
            {showSkillsMenu && (
              <div
                className="mb-2 rounded-xl p-2 space-y-1 shadow-xl"
                style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
              >
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--wb-muted)]">
                  Reference a Skill or Workflow
                </div>
                {SKILLS_CATALOG.map((sk) => (
                  <button
                    key={sk.slug}
                    type="button"
                    onClick={() => {
                      setInput(sk.prompt);
                      setShowSkillsMenu(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[var(--wb-hover)]"
                  >
                    <span className="font-mono text-[#7cb0ff]">{sk.slug}</span>
                    <span className="text-[var(--wb-muted)] truncate ml-3">{sk.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Voice Command Status / Live Interim Transcript */}
            {(voice.listening || voice.error || voiceNotice) && (
              <div
                className="mb-2 rounded-xl px-3 py-2"
                style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line-strong)" }}
              >
                <div className="flex items-start gap-2 text-[12px] leading-relaxed">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      voice.listening ? "bg-red-500 animate-pulse" : voice.error ? "bg-amber-400" : "bg-[var(--wb-line-strong)]"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    {voice.listening ? (
                      <>
                        <div className="text-[var(--wb-fg)]">{voice.transcript || "กำลังฟัง…"}</div>
                        {voice.interim && <div className="text-[var(--wb-muted)] italic">{voice.interim}</div>}
                        {!voice.transcript && !voice.interim && (
                          <div className="text-[var(--wb-muted)]">
                            พูดได้เลย เช่น “เปิด chrome”, “ถ่ายภาพหน้าจอ”, “จดว่า…” แล้วกดไมค์อีกครั้งเพื่อสั่งงาน
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-[var(--wb-muted)]">{voiceNotice || "พร้อมรับคำสั่งเสียง"}</div>
                    )}
                    {voice.error && <div className="mt-1 text-amber-400">{voice.error}</div>}
                  </div>
                  {voice.listening && (
                    <button
                      type="button"
                      onClick={voice.stop}
                      className="shrink-0 rounded-[6px] bg-[#2b66e0] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#2458c6]"
                    >
                      สั่งงาน
                    </button>
                  )}
                  {!voice.listening && Boolean(voiceNotice) && (
                    <button
                      type="button"
                      onClick={() => setVoiceNotice("")}
                      className="shrink-0 text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                      title="ปิดข้อความ"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div
              className="rounded-[20px] p-3 transition-shadow focus-within:ring-1 focus-within:ring-[#3b82f6]"
              style={{
                backgroundColor: "var(--wb-raised)",
                border: "1px solid var(--wb-line-strong)",
                boxShadow: "0 4px 20px -4px rgba(0, 0, 0, 0.35)",
              }}
            >
              {/* Attached Files Pills */}
              {attachedFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {attachedFiles.map((f, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px]"
                      style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                    >
                      <Paperclip className="h-3 w-3 text-[#3b82f6]" />
                      <span>{f.fileName}</span>
                      <button
                        type="button"
                        onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`สั่งงาน ${currentBot.name} (เช่น สรุปอีเมล, ร่างตอบลูกค้า, หรือสั่งสร้างเว็บ/วิดีโอ/เอกสารเพื่อส่งต่อให้ Work)...`}
                className="w-full resize-none bg-transparent text-[14.5px] leading-relaxed text-[var(--wb-fg)] placeholder:text-[var(--wb-muted)] focus:outline-none"
              />

              {/* Composer Bottom Controls */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pt-1.5" style={{ borderTop: "1px solid var(--wb-line)" }}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      for (const f of files) {
                        const dataUrl: string = await new Promise((resolve) => {
                          const r = new FileReader();
                          r.onload = () => resolve(String(r.result || ""));
                          r.readAsDataURL(f);
                        });
                        if (!dataUrl) continue;
                        if ((f.type || "").startsWith("image/")) {
                          setAttachedImages((prev) => [...prev, dataUrl].slice(-4));
                        }
                        try {
                          const up = await fetch("/api/uploads", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ fileName: f.name, dataUrl }),
                          }).then((r) => r.json());
                          if (up?.ok) {
                            setAttachedFiles((prev) => [
                              ...prev,
                              { fileName: f.name, fileUrl: up.path, mimeType: f.type || "application/octet-stream" },
                            ]);
                          }
                        } catch {}
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[12px] text-[var(--wb-muted)] hover:bg-[var(--wb-hover)] hover:text-[var(--wb-fg)]"
                    style={{ border: "1px solid var(--wb-line)" }}
                    title="Attach files"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Attach</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSkillsMenu((s) => !s)}
                    className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[12px] text-[var(--wb-muted)] hover:bg-[var(--wb-hover)] hover:text-[var(--wb-fg)]"
                    style={{ border: "1px solid var(--wb-line)" }}
                  >
                    <span className="font-mono text-[#7cb0ff]">@</span>
                    <span>Skills</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForceWork((w) => !w)}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-[7px] px-2.5 text-[11.5px] font-medium transition-colors ${
                      forceWork
                        ? "bg-[#2b66e0]/20 border border-[#2b66e0] text-[#7cb0ff]"
                        : "text-[var(--wb-muted)] hover:bg-[var(--wb-hover)] border border-[var(--wb-line)]"
                    }`}
                    title="Delegate directly to Work with HandoffPacket"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>{forceWork ? "Handoff → Work (ON)" : "Auto Handoff"}</span>
                  </button>

                  {forceWork && (
                    <select
                      value={workMode}
                      onChange={(e) => setWorkMode(e.target.value as "cloud" | "local")}
                      className="h-7 rounded-[7px] px-2 text-[11.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)] text-[var(--wb-fg)]"
                    >
                      <option value="cloud">Work: Cloud</option>
                      <option value="local">Work: Local</option>
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Effort Picker (No raw model names per owner rule) */}
                  <select
                    value={effort}
                    onChange={(e) => setEffort(e.target.value as "auto" | "fast" | "high")}
                    className="h-7 rounded-[7px] px-2 text-[11.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)] text-[var(--wb-muted)]"
                    title="Effort level"
                  >
                    <option value="auto">Effort: Auto</option>
                    <option value="fast">Effort: Fast</option>
                    <option value="high">Effort: High</option>
                  </select>

                  {/* Push-to-Talk Voice Command Bar (real Web Speech dictation) */}
                  <button
                    type="button"
                    onClick={toggleVoiceLang}
                    className="flex h-8 items-center justify-center rounded-full bg-[var(--wb-panel)] border border-[var(--wb-line)] px-2 text-[10.5px] font-semibold text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                    title="สลับภาษาที่ใช้พูด (ไทย / อังกฤษ)"
                  >
                    {voiceLang === "th-TH" ? "TH" : "EN"}
                  </button>

                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    disabled={voiceBusy}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                      voice.listening
                        ? "bg-red-500 text-white animate-pulse"
                        : "bg-[var(--wb-panel)] border border-[var(--wb-line)] text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                    }`}
                    title={voice.listening ? "หยุดฟัง แล้วสั่งงานทันที" : "กดเพื่อพูดสั่งงาน (TH/EN)"}
                  >
                    {voice.listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  </button>

                  {/* Read the last assistant message aloud (Thai) */}
                  <button
                    type="button"
                    onClick={speakLastAssistant}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                      speaking
                        ? "bg-[#2b66e0] text-white"
                        : "bg-[var(--wb-panel)] border border-[var(--wb-line)] text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                    }`}
                    title={speaking ? "หยุดอ่าน" : "อ่านข้อความล่าสุดออกเสียง"}
                  >
                    {speaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>

                  {/* Send Button */}
                  <button
                    type="button"
                    disabled={!input.trim() || sending}
                    onClick={() => handleSend()}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2b66e0] hover:bg-[#2458c6] disabled:opacity-40 text-white transition-all"
                    title="Send message"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT INSPECTOR PANEL (Grok Bot Bot-Details + Cursor Inspector: Computer · Memory · Routines · Library · Overview) */}
      {inspectorOpen && (
        <aside
          className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[390px] flex-col lg:static lg:w-[380px] shrink-0"
          style={{
            backgroundColor: "var(--wb-panel)",
            borderLeft: "1px solid var(--wb-line)",
          }}
        >
          {/* Inspector Top Tab Bar (48px) */}
          <div
            className="flex h-[48px] shrink-0 items-center justify-between px-2.5"
            style={{ borderBottom: "1px solid var(--wb-line)" }}
          >
            <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
              {[
                { id: "computer" as const, label: "Computer", Icon: Monitor },
                { id: "memory" as const, label: "Memory", Icon: Brain },
                { id: "routines" as const, label: "Routines", Icon: Repeat2 },
                { id: "library" as const, label: "Library", Icon: FolderOpen },
                { id: "overview" as const, label: "Bot Info", Icon: Info },
              ].map((t) => {
                const active = inspectorTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setInspectorTab(t.id)}
                    title={t.label}
                    className={`inline-flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-[11.5px] font-medium transition-colors ${
                      active
                        ? "bg-[var(--wb-active)] text-[var(--wb-fg)]"
                        : "text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                    }`}
                  >
                    <t.Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden min-[420px]:inline">{t.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setInspectorOpen(false)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--wb-muted)] hover:bg-[var(--wb-hover)]"
              title="Close inspector"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Inspector Tab Content */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            {/* TAB 1: COMPUTER (Live noVNC Cloud Computer + Take Over + Teach by Demo) */}
            {inspectorTab === "computer" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold">Bot&apos;s Cloud Computer (:99)</div>
                    <div className="text-[11px] text-[var(--wb-muted)]">
                      Ubuntu 24.04 · Persistent Volume · Isolated per user
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                      computer?.status === "running"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : computer?.status
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-[var(--wb-hover)] text-[var(--wb-muted)]"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        computer?.status === "running" ? "bg-emerald-400 animate-pulse" : "bg-current"
                      }`}
                    />
                    {computer?.status === "running"
                      ? "Running"
                      : computer?.status === "paused"
                        ? "Paused"
                        : computer?.status
                          ? "ไม่ทำงาน"
                          : "ยังไม่เชื่อมต่อ"}
                  </span>
                </div>

                {/* Simulated Live Desktop / Browser Canvas */}
                {computer?.status === "running" && (
                  <div
                    className="overflow-hidden rounded-[10px]"
                    style={{ border: "1px solid var(--wb-line-strong)" }}
                  >
                    <div className="flex items-center justify-between bg-[#14151c] px-3 py-1.5 text-[11px] text-[#8f929a]">
                      <span className="truncate">
                        หน้าจอจริง · {computer?.name} {screenTs ? `· อัปเดต ${screenTs}` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setScreenTick((n) => n + 1);
                        }}
                        className="text-[10.5px] text-[#7cb0ff] hover:underline"
                      >
                        รีเฟรช
                      </button>
                    </div>
                    <img
                      key={screenTick}
                      src={`/api/computer?action=screen&raw=1&t=${screenTick}`}
                      alt="Cloud Computer screen"
                      className="w-full"
                      style={{ display: "block", backgroundColor: "#000", minHeight: 120 }}
                    />
                    {computer?.vncUrl && (
                      <div className="flex items-center justify-between bg-[#14151c] px-3 py-1.5">
                        <span className="text-[10.5px] text-[#8f929a]">
                          ควบคุมด้วยเมาส์/คีย์บอร์ดได้ในหน้าจอเต็ม
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Link
                            href="/computer"
                            className="rounded-[6px] bg-[var(--wb-hover)] px-2.5 py-1 text-[10.5px] font-medium text-[var(--wb-fg)]"
                          >
                            หน้าควบคุมเต็ม
                          </Link>
                          <a
                            href={computer.vncUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-[6px] bg-[#2b66e0] px-2.5 py-1 text-[10.5px] font-medium text-white"
                          >
                            เปิดเต็มจอ ↗
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div
                  className="overflow-hidden rounded-[10px]"
                  style={{ backgroundColor: "#090a0f", border: "1px solid var(--wb-line-strong)" }}
                >
                  <div className="flex items-center justify-between bg-[#14151c] px-3 py-1.5 text-[11px] text-[#8f929a] border-b border-[#25262c]">
                    <span className="truncate font-mono">{computer?.name || "cloud computer"} · Ubuntu 24.04</span>
                    <span
                      className={`font-mono text-[10px] ${
                        computer?.status === "running" ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {computer?.status || "not started"}
                    </span>
                  </div>
                  <div className="space-y-2.5 p-3 font-mono text-[11.5px] text-[#d2d3d8]">
                    <div className="rounded border border-[#232634] bg-[#12141d] p-2.5">
                      <div className="font-semibold text-[#7cb0ff]">
                        Browser CDP :{computer?.cdpPort || 9222} · noVNC
                      </div>
                      <div className="mt-1 text-[11px] text-[#8f929a]">
                        {computer?.status === "running"
                          ? "นี่คือเครื่องจริงที่แยกของคุณ (1 container ต่อบัญชี) — เปิดหน้าจอเพื่อดูหรือสั่งงานต่อได้"
                          : "ยังไม่มี container ที่รันอยู่ — เปิดหน้า Computer แล้วกด Start"}
                      </div>
                    </div>
                    <div className="rounded border border-[#1e202b] bg-[#0d0e14] p-2.5 text-[11px] text-emerald-400/90">
                      <div>woibot@cloud-vm:~/workspace$ {computer?.status === "running" ? "docker ps --filter name=woibot-u" : "waiting for container"}</div>
                      <div className="text-[#8f929a]">
                        {computer?.status === "running"
                          ? `container ${computer?.name} · port ${computer?.port} · CDP ${computer?.cdpPort}`
                          : "no running container"}
                      </div>
                    </div>
                    <a
                      href="/computer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-[7px] bg-[#2b66e0] px-3 py-1.5 text-[11.5px] font-medium text-white"
                    >
                      <Monitor className="h-3.5 w-3.5" /> เปิดหน้าจอ Cloud Computer
                    </a>
                  </div>
                </div>

                {/* Take Control & Teach-by-Demonstration Controls (Grok Bot §1.7) */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`/api/computer?action=screen&raw=1&t=${screenTick}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-[8px] bg-[#2b66e0] py-2 text-[12px] font-medium text-white hover:bg-[#2458c6]"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    <span>ดูหน้าจอเต็ม</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => router.push("/routines")}
                    className="flex items-center justify-center gap-1.5 rounded-[8px] py-2 text-[12px] font-medium text-[var(--wb-fg)]"
                    style={{ border: "1px solid var(--wb-line)", backgroundColor: "var(--wb-raised)" }}
                  >
                    <Repeat2 className="h-3.5 w-3.5" />
                    <span>สร้าง Routine</span>
                  </button>
                </div>

                {teachRecording && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2.5 text-[11.5px] text-red-300">
                    <strong>Teach-by-Demonstration Active:</strong> ทำขั้นตอนในหน้าจอให้ดู 1 ครั้ง ระบบจะสกัดเป็น Routine อัตโนมัติเมื่อกด Stop
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => router.push("/computer")}
                  className="flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-[12px] hover:bg-[var(--wb-hover)]"
                  style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                >
                  <span>จัดการเครื่อง (สตาร์ท/หยุด/ลบ) →</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-[var(--wb-muted)]" />
                </button>
              </div>
            )}

            {/* TAB 2: MEMORY (2-Tier Personal & Team Memory CRUD) */}
            {inspectorTab === "memory" && (
              <div className="space-y-3">
                <div>
                  <div className="text-[13px] font-semibold">2-Tier Memory (Personal & Team)</div>
                  <div className="text-[11px] text-[var(--wb-muted)]">
                    สิ่งที่ {currentBot.name} จำได้ข้ามบทสนทนา — ดู แก้ไข ลบ หรือแชร์ให้ทีมได้
                  </div>
                </div>

                <form onSubmit={handleAddMemory} className="space-y-2 rounded-[10px] p-3" style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newMemKey}
                      onChange={(e) => setNewMemKey(e.target.value)}
                      placeholder="หัวข้อ (เช่น client_rule)"
                      className="flex-1 rounded-[6px] px-2.5 py-1.5 text-[12px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
                    />
                    <select
                      value={newMemScope}
                      onChange={(e) => setNewMemScope(e.target.value as "personal" | "team")}
                      className="rounded-[6px] px-2 py-1.5 text-[11.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
                    >
                      <option value="personal">Personal</option>
                      <option value="team">Team</option>
                    </select>
                  </div>
                  <textarea
                    rows={2}
                    value={newMemVal}
                    onChange={(e) => setNewMemVal(e.target.value)}
                    placeholder="รายละเอียดที่ให้ AI จำถาวร..."
                    className="w-full rounded-[6px] p-2 text-[12px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-[6px] bg-[#2b66e0] py-1.5 text-[12px] font-medium text-white hover:bg-[#2458c6]"
                  >
                    + Save Memory Rule
                  </button>
                </form>

                <div className="space-y-2">
                  {memories.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-[9px] p-2.5 space-y-1.5"
                      style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11.5px] font-semibold text-[#7cb0ff]">{m.key}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handlePromoteMemory(m)}
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[var(--wb-panel)] border border-[var(--wb-line)] text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                            title="Switch between Personal and Team memory"
                          >
                            {m.scope === "team" ? "Team Shared" : "Personal → Team"}
                          </button>
                          {m.canDelete !== false && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMemory(m.id)}
                              className="p-1 text-[var(--wb-muted)] hover:text-red-400"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[12px] text-[var(--wb-fg-soft)] leading-relaxed">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: ROUTINES (Automations + Spend Guard) */}
            {inspectorTab === "routines" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold">Bot Routines & Triggers</div>
                    <div className="text-[11px] text-[var(--wb-muted)]">
                      Cron, Email Inbox, Slack & GitHub Webhooks
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/routines")}
                    className="text-[11.5px] text-[#7cb0ff] hover:underline"
                  >
                    Manage All →
                  </button>
                </div>

                <div
                  className="rounded-lg p-2.5 text-[11.5px]"
                  style={{ backgroundColor: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.25)" }}
                >
                  <strong className="text-[#7cb0ff]">Spend Guard Active:</strong> ระบบจะพัก Routine อัตโนมัติหากรันต่อเนื่องโดยไม่มีคนเปิดอ่านผลลัพธ์ เพื่อประหยัดโควต้า
                </div>

                <div className="space-y-2">
                  {routines.map((rt) => (
                    <div
                      key={rt.id}
                      className="rounded-[9px] p-3 space-y-1.5"
                      style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold">{rt.title}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            rt.status === "active"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-amber-500/15 text-amber-400"
                          }`}
                        >
                          {rt.status}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-[var(--wb-muted)]">
                        {rt.trigger?.kindLabel || rt.trigger?.expr || "Scheduled"}
                      </div>
                      <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--wb-muted)] tabular-nums">
                        <span>Runs: {rt.runCount || 0}</span>
                        <button
                          type="button"
                          onClick={() => handleSend(`รัน Routine ทันที: ${rt.title}`)}
                          className="inline-flex items-center gap-1 text-[#7cb0ff] hover:underline"
                        >
                          <Play className="h-3 w-3" /> Run now
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: LIBRARY (Files & Deliverables produced) */}
            {inspectorTab === "library" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold">Bot Library & Deliverables</div>
                    <div className="text-[11px] text-[var(--wb-muted)]">
                      ไฟล์และผลงานจริงจาก Workspace ของคุณ
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/work?area=artifacts")}
                    className="text-[11.5px] text-[#7cb0ff] hover:underline"
                  >
                    Open Artifacts →
                  </button>
                </div>

                <div className="space-y-2">
                  {artifacts.length === 0 ? (
                    <div
                      className="rounded-[9px] p-4 text-center text-[11.5px] text-[var(--wb-muted)]"
                      style={{ backgroundColor: "var(--wb-raised)", border: "1px dashed var(--wb-line-strong)" }}
                    >
                      ยังไม่มีไฟล์ใน Library — ผลงานที่ Work สร้างเสร็จจะปรากฏที่นี่พร้อมลิงก์ดาวน์โหลด
                    </div>
                  ) : (
                    artifacts.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-[9px] p-2.5"
                        style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[12.5px] font-medium">{item.title || item.name || item.fileName}</div>
                          <div className="text-[11px] text-[var(--wb-muted)] tabular-nums">
                            {item.kind || item.category || "artifact"}
                            {item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString("th-TH")}` : ""}
                          </div>
                        </div>
                        <a
                          href={item.fileUrl || `/api/artifacts?download=${item.id}`}
                          className="shrink-0 rounded-[6px] border border-[var(--wb-line)] bg-[var(--wb-panel)] px-2.5 py-1 text-[11px] font-medium hover:bg-[var(--wb-hover)]"
                        >
                          Download
                        </a>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: OVERVIEW (Bot Identity, Connected Apps, Vault) */}
            {inspectorTab === "overview" && (
              <div className="space-y-3">
                <div
                  className="rounded-[10px] p-3 space-y-2"
                  style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-semibold">{currentBot.name}</div>
                    <span className="rounded bg-[var(--wb-panel)] px-1.5 py-0.5 text-[9.5px] uppercase text-[var(--wb-muted)]">
                      {currentBot.badge || "teammate"}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-[var(--wb-muted)]">{currentBot.role}</div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11.5px]">
                    <div className="rounded px-2 py-1.5" style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}>
                      <div className="text-[10px] text-[var(--wb-muted)]">Memory</div>
                      <div className="font-semibold tabular-nums">{memories.length} รายการ</div>
                    </div>
                    <div className="rounded px-2 py-1.5" style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}>
                      <div className="text-[10px] text-[var(--wb-muted)]">Routines</div>
                      <div className="font-semibold tabular-nums">{routines.length} งาน</div>
                    </div>
                    <div className="rounded px-2 py-1.5" style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}>
                      <div className="text-[10px] text-[var(--wb-muted)]">Computer</div>
                      <div className="font-semibold">{computer?.status || "unknown"}</div>
                    </div>
                    <div className="rounded px-2 py-1.5" style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}>
                      <div className="text-[10px] text-[var(--wb-muted)]">Apps connected</div>
                      <div className="font-semibold tabular-nums">
                        {apps.filter((a: any) => a.status === "connected").length}/{apps.length}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="rounded-[10px] p-3 space-y-2"
                  style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold">Connected Apps & Vault</span>
                    <button
                      type="button"
                      onClick={() => router.push("/apps")}
                      className="text-[11px] text-[#7cb0ff] hover:underline"
                    >
                      Configure
                    </button>
                  </div>
                  {apps.length === 0 ? (
                    <div className="text-[11.5px] text-[var(--wb-muted)]">ยังไม่มีรายการแอป — ไปที่หน้า Apps เพื่อเชื่อมต่อ</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5 text-[11.5px]">
                      {apps.map((a: any) => (
                        <div
                          key={a.id}
                          className="flex items-center gap-1.5 rounded px-2 py-1"
                          style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                          title={a.status}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              a.status === "connected" ? "bg-emerald-400" : "bg-[var(--wb-muted)]"
                            }`}
                          />
                          <span className="truncate">{a.provider}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {!(currentBot as any).isMain && bots.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`ลบ Teammate "${currentBot.name}"?`)) return;
                      const res = await fetch(`/api/teammate?id=${currentBot.id}`, { method: "DELETE" }).then((r) => r.json());
                      if (res?.ok) {
                        const list = await fetch("/api/teammate").then((r) => r.json());
                        setBots(list?.teammates || []);
                        setActiveBotId("tm_main");
                        router.replace("/teammate");
                      }
                    }}
                    className="w-full rounded-[8px] px-3 py-1.5 text-[11.5px] font-medium text-red-400"
                    style={{ border: "1px solid rgba(239,68,68,0.35)" }}
                  >
                    ลบ Teammate นี้
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

export default function TeammatePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--wb-muted)]">Loading Teammate Workspace...</div>}>
      <TeammateWorkspaceInner />
    </Suspense>
  );
}
