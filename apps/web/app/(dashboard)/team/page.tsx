"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users2,
  Plus,
  ArrowUpRight,
  Send,
  Trash2,
  Loader2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Check,
} from "lucide-react";

type Bot = {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  isMain?: boolean;
  isGroup?: boolean;
  persona?: { isGroup?: boolean; statusText?: string; tone?: string; skills?: string[] };
};

type SharedMemory = {
  id: string;
  key: string;
  value: string;
  fromTeammateId: string | null;
  fromName: string | null;
  updatedAt: string | null;
};

type Group = {
  id: string;
  name: string;
  role: string;
  avatar: string;
  members: Bot[];
  memories: SharedMemory[];
};

type ShareDraft = { key: string; value: string; fromId: string };

function initials(name: string) {
  return (name || "??").trim().slice(0, 2).toUpperCase();
}

export default function TeamBotsPage() {
  const router = useRouter();

  const [bots, setBots] = useState<Bot[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create-group form
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Delegation
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [delegateGroupId, setDelegateGroupId] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [delegateError, setDelegateError] = useState("");
  const [reply, setReply] = useState<any | null>(null);

  // Per-group shared-rule composer
  const [shareDrafts, setShareDrafts] = useState<Record<string, ShareDraft>>({});
  const [shareBusy, setShareBusy] = useState<string | null>(null);
  const [shareError, setShareError] = useState<Record<string, string>>({});

  // New teammate (kept from the original page, now backed by the same API)
  const [botName, setBotName] = useState("");
  const [botRole, setBotRole] = useState("");
  const [botTone, setBotTone] = useState("");
  const [botBusy, setBotBusy] = useState(false);
  const [botError, setBotError] = useState("");

  const loadBots = useCallback(async () => {
    const res = await fetch("/api/teammate", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || json?.ok === false) throw new Error(json?.error || `โหลดรายชื่อบอทไม่สำเร็จ (${res.status})`);
    const roster: Bot[] = Array.isArray(json?.teammates) ? json.teammates : [];
    const individual = roster.filter((t) => !t.persona?.isGroup && !t.isGroup);
    setBots(individual);
    return individual;
  }, []);

  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/team/groups", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || json?.ok === false) throw new Error(json?.error || `โหลดกลุ่มไม่สำเร็จ (${res.status})`);
    setGroups(Array.isArray(json?.groups) ? json.groups : []);
  }, []);

  const reload = useCallback(async () => {
    setError("");
    try {
      const [individual] = await Promise.all([loadBots(), loadGroups()]);
      setFromId((prev) => prev || individual.find((b) => b.isMain)?.id || individual[0]?.id || "");
      setToId((prev) => {
        if (prev) return prev;
        const first = individual.find((b) => b.isMain)?.id || individual[0]?.id || "";
        return individual.find((b) => b.id !== first)?.id || "";
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [loadBots, loadGroups]);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!groupName.trim()) {
      setCreateError("ใส่ชื่อกลุ่มก่อนครับ");
      return;
    }
    if (selectedIds.length === 0) {
      setCreateError("เลือกบอทอย่างน้อย 1 ตัวเข้ากลุ่ม");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/team/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim(), memberIds: selectedIds }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "สร้างกลุ่มไม่สำเร็จ");
      setGroupName("");
      setSelectedIds([]);
      await loadGroups();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "สร้างกลุ่มไม่สำเร็จ");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      const res = await fetch(`/api/team/groups?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "ลบกลุ่มไม่สำเร็จ");
      await loadGroups();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ลบกลุ่มไม่สำเร็จ");
    }
  };

  const handleDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    setDelegateError("");
    if (!fromId || !toId) {
      setDelegateError("เลือกบอทต้นทางและปลายทางก่อนครับ");
      return;
    }
    if (fromId === toId) {
      setDelegateError("ต้องส่งระหว่างบอทคนละตัว");
      return;
    }
    if (!message.trim()) {
      setDelegateError("พิมพ์งานที่ต้องการส่งต่อก่อนครับ");
      return;
    }
    setSending(true);
    setReply(null);
    try {
      const res = await fetch("/api/team/delegate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromId,
          toId,
          message: message.trim(),
          ...(delegateGroupId ? { groupId: delegateGroupId } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "ส่งงานไม่สำเร็จ");
      setReply(json);
      setMessage("");
    } catch (err: unknown) {
      setDelegateError(err instanceof Error ? err.message : "ส่งงานไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBotError("");
    if (!botName.trim()) {
      setBotError("ใส่ชื่อบอทก่อนครับ");
      return;
    }
    setBotBusy(true);
    try {
      const res = await fetch("/api/teammate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: botName.trim(),
          role: botRole.trim() || undefined,
          tone: botTone.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "สร้างบอทไม่สำเร็จ");
      setBotName("");
      setBotRole("");
      setBotTone("");
      await reload();
    } catch (err: unknown) {
      setBotError(err instanceof Error ? err.message : "สร้างบอทไม่สำเร็จ");
    } finally {
      setBotBusy(false);
    }
  };

  const draftFor = (group: Group): ShareDraft =>
    shareDrafts[group.id] || { key: "", value: "", fromId: group.members[0]?.id || "" };

  const updateDraft = (group: Group, patch: Partial<ShareDraft>) => {
    setShareDrafts((prev) => ({ ...prev, [group.id]: { ...draftFor(group), ...patch } }));
  };

  const handleShareMemory = async (group: Group) => {
    const draft = draftFor(group);
    setShareError((prev) => ({ ...prev, [group.id]: "" }));
    if (!draft.key.trim() || !draft.value.trim()) {
      setShareError((prev) => ({ ...prev, [group.id]: "ต้องมีทั้ง key และค่า" }));
      return;
    }
    setShareBusy(group.id);
    try {
      const res = await fetch("/api/team/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "share_memory",
          groupId: group.id,
          fromTeammateId: draft.fromId || group.members[0]?.id || "",
          key: draft.key.trim(),
          value: draft.value.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "แชร์ความจำไม่สำเร็จ");
      setShareDrafts((prev) => ({ ...prev, [group.id]: { key: "", value: "", fromId: draft.fromId } }));
      await loadGroups();
    } catch (err: unknown) {
      setShareError((prev) => ({ ...prev, [group.id]: err instanceof Error ? err.message : "แชร์ความจำไม่สำเร็จ" }));
    } finally {
      setShareBusy(null);
    }
  };

  const fromBot = bots.find((b) => b.id === fromId) || null;
  const toBot = bots.find((b) => b.id === toId) || null;

  return (
    <div className="min-h-screen w-full p-4 lg:p-6 space-y-5" style={{ backgroundColor: "var(--wb-bg)" }}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[17px] lg:text-[19px] font-bold leading-tight">Team Bots · Groups · Cross-Bot Delegation</h1>
          <p className="mt-1 text-[12px] lg:text-[12.5px] text-[var(--wb-muted)] leading-relaxed">
            จัดกลุ่มบอทตามบทบาท ส่งงานข้ามบอท และแชร์กฎความจำระดับทีม โดยยังแยกขอบเขตความรับผิดชอบของแต่ละตัว
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-[6px] px-2 py-1 text-[11px] text-[var(--wb-muted)]"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
          >
            {bots.length} bots
          </span>
          <span
            className="rounded-[6px] px-2 py-1 text-[11px] text-[var(--wb-muted)]"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
          >
            {groups.length} groups
          </span>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[11px] text-[var(--wb-fg-soft)] hover:bg-[var(--wb-hover)]"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div
          className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12px] text-[var(--wb-danger)]"
          style={{ backgroundColor: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)" }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Create group */}
        <form
          onSubmit={handleCreateGroup}
          className="min-w-0 rounded-[12px] p-4 space-y-3"
          style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
        >
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-[#7cb0ff]" />
            <div className="text-[13px] font-semibold">สร้างกลุ่มบอท (Group Room)</div>
          </div>

          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="ชื่อกลุ่ม เช่น Growth War Room, Finance Close"
            maxLength={80}
            className="w-full min-w-0 rounded-[8px] px-3 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)] outline-none focus:border-[#2b66e0]"
          />

          <div className="space-y-1.5">
            <div className="text-[11px] text-[var(--wb-muted)]">เลือกบอทเข้ากลุ่ม ({selectedIds.length} เลือกแล้ว)</div>
            {bots.length === 0 ? (
              <div className="text-[11.5px] text-[var(--wb-faint)]">ยังไม่มีบอทในบัญชีนี้</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {bots.map((bot) => {
                  const active = selectedIds.includes(bot.id);
                  return (
                    <button
                      key={bot.id}
                      type="button"
                      onClick={() => toggleMember(bot.id)}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] transition-colors"
                      style={{
                        backgroundColor: active ? "rgba(43,102,224,0.18)" : "var(--wb-panel)",
                        border: `1px solid ${active ? "#2b66e0" : "var(--wb-line)"}`,
                        color: active ? "#a9c8ff" : "var(--wb-fg-soft)",
                      }}
                      title={bot.role}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#2b66e0]/25 text-[8.5px] font-bold text-[#a9c8ff]">
                        {bot.avatar || initials(bot.name)}
                      </span>
                      <span className="truncate">{bot.name}</span>
                      {active && <Check className="h-3 w-3 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {createError && <div className="text-[11.5px] text-[var(--wb-danger)] break-words">{createError}</div>}

          <button
            type="submit"
            disabled={creating || !bots.length}
            className="inline-flex min-h-[40px] sm:min-h-0 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#2b66e0] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#2458c6] disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {creating ? "กำลังสร้างกลุ่ม..." : "Create Group"}
          </button>
        </form>

        {/* Delegate */}
        <form
          onSubmit={handleDelegate}
          className="min-w-0 rounded-[12px] p-4 space-y-3"
          style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
        >
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-[#7cb0ff]" />
            <div className="text-[13px] font-semibold">ส่งงานระหว่างบอท (Delegation)</div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="min-w-0 space-y-1">
              <span className="text-[11px] text-[var(--wb-muted)]">จากบอท</span>
              <select
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="w-full min-w-0 rounded-[8px] px-2.5 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
              >
                {bots.length === 0 && <option value="">— ไม่มีบอท —</option>}
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <div className="truncate text-[10.5px] text-[var(--wb-faint)]">{fromBot?.role || "—"}</div>
            </label>

            <label className="min-w-0 space-y-1">
              <span className="text-[11px] text-[var(--wb-muted)]">ถึงบอท</span>
              <select
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="w-full min-w-0 rounded-[8px] px-2.5 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
              >
                {bots.length === 0 && <option value="">— ไม่มีบอท —</option>}
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <div className="truncate text-[10.5px] text-[var(--wb-faint)]">{toBot?.role || "—"}</div>
            </label>
          </div>

          <label className="block min-w-0 space-y-1">
            <span className="text-[11px] text-[var(--wb-muted)]">ขอบเขตความจำ (เลือกกลุ่ม = ใช้กฎของกลุ่มนั้น)</span>
            <select
              value={delegateGroupId}
              onChange={(e) => setDelegateGroupId(e.target.value)}
              className="w-full min-w-0 rounded-[8px] px-2.5 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
            >
              <option value="">ทั้งทีม (Team memory ทั้งหมด)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · {g.members.length} bots
                </option>
              ))}
            </select>
          </label>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="งานที่ต้องการส่งต่อ เช่น สรุปอีเมล VIP แล้วส่งร่างให้ Exec Chief ตรวจวาระประชุม"
            className="w-full min-w-0 resize-y rounded-[8px] px-3 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)] outline-none focus:border-[#2b66e0]"
          />

          {delegateError && <div className="text-[11.5px] text-[var(--wb-danger)] break-words">{delegateError}</div>}

          <button
            type="submit"
            disabled={sending || bots.length < 2}
            className="inline-flex min-h-[40px] sm:min-h-0 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#2b66e0] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#2458c6] disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
            {sending ? "กำลังส่งต่อ..." : "Send to Teammate"}
          </button>

          {bots.length < 2 && (
            <div className="text-[11px] text-[var(--wb-faint)]">ต้องมีอย่างน้อย 2 บอทเพื่อส่งงานข้ามบอท</div>
          )}

          {reply && (
            <div
              className="min-w-0 space-y-2 rounded-[10px] p-3"
              style={{ backgroundColor: "var(--wb-panel)", border: "1px solid rgba(43,102,224,0.45)" }}
            >
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--wb-muted)]">
                <span className="rounded bg-[#2b66e0]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#a9c8ff]">
                  {reply.from?.name} → {reply.to?.name}
                </span>
                {reply.provider && <span className="text-[var(--wb-faint)]">via {reply.provider}</span>}
                {reply.memoriesUsed?.length ? (
                  <span className="text-[var(--wb-faint)]">· ใช้ {reply.memoriesUsed.length} กฎทีม</span>
                ) : null}
              </div>
              <div className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-[var(--wb-fg-soft)]">
                {reply.reply}
              </div>
              {reply.to?.id && (
                <button
                  type="button"
                  onClick={() => router.push(`/teammate?bot=${reply.to.id}`)}
                  className="inline-flex items-center gap-1 text-[11px] text-[#7cb0ff] hover:underline"
                >
                  เปิดเธรดของ {reply.to.name}
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Groups */}
      <div className="min-w-0 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#7cb0ff]" />
          <div className="text-[13.5px] font-semibold">Group Rooms & Shared Memory</div>
        </div>

        {groups.length === 0 ? (
          <div
            className="rounded-[12px] px-4 py-6 text-center text-[12px] text-[var(--wb-muted)]"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px dashed var(--wb-line-strong)" }}
          >
            ยังไม่มีกลุ่ม — เลือกบอทด้านบนแล้วกด Create Group เพื่อเริ่มแชร์บริบทระหว่างบอท
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((group) => {
              const draft = draftFor(group);
              return (
                <div
                  key={group.id}
                  className="min-w-0 rounded-[12px] p-4 space-y-3"
                  style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#2b66e0]/20 border border-[#2b66e0]/40 text-[11px] font-bold text-[#a9c8ff]">
                        {group.avatar || initials(group.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-semibold">{group.name}</div>
                        <div className="truncate text-[11px] text-[var(--wb-muted)]">{group.role}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(group.id)}
                      title="ลบกลุ่มนี้"
                      aria-label="ลบกลุ่มนี้"
                      className="flex min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 shrink-0 items-center justify-center rounded-[6px] p-1.5 text-[var(--wb-faint)] hover:bg-[var(--wb-hover)] hover:text-[var(--wb-danger)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Members */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex shrink-0 -space-x-1.5">
                      {group.members.map((m) => (
                        <span
                          key={m.id}
                          title={`${m.name} · ${m.role}`}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--wb-raised)] bg-[#1b2432] text-[8.5px] font-bold text-[#a9c8ff]"
                        >
                          {m.avatar || initials(m.name)}
                        </span>
                      ))}
                    </div>
                    <div className="min-w-0 flex-1 truncate text-[11px] text-[var(--wb-muted)]">
                      {group.members.map((m) => m.name).join(" · ") || "ยังไม่มีสมาชิก"}
                    </div>
                  </div>

                  {/* Shared rules */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-[var(--wb-muted)]">Shared team memory ({group.memories.length})</div>
                    {group.memories.length === 0 ? (
                      <div className="text-[11px] text-[var(--wb-faint)]">ยังไม่มีกฎที่แชร์ในกลุ่มนี้</div>
                    ) : (
                      <ul className="min-w-0 space-y-1.5">
                        {group.memories.map((mem) => (
                          <li
                            key={mem.id}
                            className="min-w-0 rounded-[7px] px-2 py-1.5"
                            style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                          >
                            <div className="flex flex-wrap items-baseline gap-1.5">
                              <span className="text-[11px] font-semibold text-[#a9c8ff] break-words">{mem.key}</span>
                              {mem.fromName && <span className="text-[10px] text-[var(--wb-faint)]">จาก {mem.fromName}</span>}
                            </div>
                            <div className="text-[11.5px] text-[var(--wb-fg-soft)] break-words">{mem.value}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Share composer */}
                  <div className="space-y-1.5 pt-2" style={{ borderTop: "1px solid var(--wb-line)" }}>
                    <div className="flex flex-col gap-1.5 sm:flex-row">
                      <input
                        type="text"
                        value={draft.key}
                        onChange={(e) => updateDraft(group, { key: e.target.value })}
                        placeholder="key"
                        maxLength={64}
                        className="w-full min-w-0 rounded-[7px] px-2 py-1.5 text-[11.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)] sm:w-[38%]"
                      />
                      <input
                        type="text"
                        value={draft.value}
                        onChange={(e) => updateDraft(group, { value: e.target.value })}
                        placeholder="ค่ากฎที่ทุกบอทในกลุ่มต้องใช้"
                        maxLength={4000}
                        className="w-full min-w-0 flex-1 rounded-[7px] px-2 py-1.5 text-[11.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {group.members.length > 1 && (
                        <select
                          value={draft.fromId}
                          onChange={(e) => updateDraft(group, { fromId: e.target.value })}
                          className="min-w-0 flex-1 rounded-[7px] px-2 py-1.5 text-[11px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
                        >
                          {group.members.map((m) => (
                            <option key={m.id} value={m.id}>
                              ผู้แชร์: {m.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() => handleShareMemory(group)}
                        disabled={shareBusy === group.id}
                        className="inline-flex shrink-0 items-center gap-1 rounded-[7px] bg-[#2b66e0] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#2458c6] disabled:opacity-50"
                      >
                        {shareBusy === group.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Share rule
                      </button>
                    </div>
                    {shareError[group.id] && (
                      <div className="text-[10.5px] text-[var(--wb-danger)] break-words">{shareError[group.id]}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Roster */}
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13.5px] font-semibold">Teammate Roster</div>
          <div className="text-[11px] text-[var(--wb-muted)]">{bots.length} active</div>
        </div>

        <details
          className="rounded-[12px] p-3"
          style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
        >
          <summary className="cursor-pointer text-[12px] font-medium text-[var(--wb-fg-soft)]">
            + สร้าง AI Teammate ใหม่
          </summary>
          <form onSubmit={handleCreateBot} className="mt-2.5 flex flex-col gap-2 lg:flex-row">
            <input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="ชื่อบอท"
              className="w-full min-w-0 rounded-[8px] px-3 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)] lg:flex-1"
            />
            <input
              type="text"
              value={botRole}
              onChange={(e) => setBotRole(e.target.value)}
              placeholder="บทบาทและขอบเขตงาน"
              className="w-full min-w-0 rounded-[8px] px-3 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)] lg:flex-1"
            />
            <input
              type="text"
              value={botTone}
              onChange={(e) => setBotTone(e.target.value)}
              placeholder="สไตล์การสื่อสาร"
              className="w-full min-w-0 rounded-[8px] px-3 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)] lg:flex-1"
            />
            <button
              type="submit"
              disabled={botBusy}
              className="inline-flex min-h-[40px] sm:min-h-0 shrink-0 items-center justify-center gap-1.5 rounded-[8px] bg-[#2b66e0] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#2458c6] disabled:opacity-50"
            >
              {botBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </button>
          </form>
          {botError && <div className="mt-1.5 text-[11px] text-[var(--wb-danger)] break-words">{botError}</div>}
        </details>

        {loading ? (
          <div
            className="rounded-[12px] px-4 py-6 text-center text-[12px] text-[var(--wb-muted)]"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
          >
            กำลังโหลดรายชื่อบอท...
          </div>
        ) : bots.length === 0 ? (
          <div
            className="rounded-[12px] px-4 py-6 text-center text-[12px] text-[var(--wb-muted)]"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px dashed var(--wb-line-strong)" }}
          >
            ยังไม่มีบอทในบัญชีนี้ — สร้างบอทตัวแรกจากฟอร์มด้านบน
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bots.map((bot) => (
              <div
                key={bot.id}
                className="flex min-w-0 flex-col justify-between rounded-[12px] p-4 space-y-3"
                style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2b66e0]/20 border border-[#2b66e0]/40 text-[11px] font-bold text-[#7cb0ff]">
                        {bot.avatar || initials(bot.name)}
                      </div>
                      <span className="truncate text-[14px] font-semibold">{bot.name}</span>
                    </div>
                    {bot.isMain && (
                      <span className="shrink-0 rounded bg-[#2b66e0] px-2 py-0.5 text-[10px] font-semibold text-white">MAIN</span>
                    )}
                  </div>
                  <div className="truncate text-[12px] font-medium text-[#7cb0ff]">{bot.role}</div>
                  <p className="text-[11.5px] text-[var(--wb-muted)] break-words">
                    {bot.persona?.tone || "Dedicated Cloud Computer + Scoped Memory"}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2" style={{ borderTop: "1px solid var(--wb-line)" }}>
                  {bot.persona?.statusText ? (
                    <span className="min-w-0 truncate text-[11px] text-emerald-400">● {bot.persona.statusText}</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => router.push(`/teammate?bot=${bot.id}`)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-[7px] bg-[#2b66e0] hover:bg-[#2458c6] px-3 py-1.5 text-[11.5px] font-medium text-white"
                  >
                    <span>Open Chat</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
