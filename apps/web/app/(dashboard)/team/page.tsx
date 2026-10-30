"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users2, Plus, MessageSquare, ArrowUpRight, Sparkles } from "lucide-react";

export default function TeamBotsPage() {
  const router = useRouter();
  const [bots, setBots] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Marketing & Growth Assistant");
  const [tone, setTone] = useState("กระชับ สร้างสรรค์ อ้างอิงข้อมูลจริง");

  const loadBots = () => {
    fetch("/api/teammate")
      .then((r) => r.json())
      .then((res) => setBots(res?.teammates || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadBots();
  }, []);

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch("/api/teammate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), role, tone }),
    });
    setName("");
    loadBots();
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div>
        <h1 className="text-[18px] font-bold">AI Teammates Roster & Multi-Bot Group Rooms</h1>
        <p className="text-[12.5px] text-[var(--wb-muted)]">
          สร้าง AI Teammate เฉพาะทางแยกตามบทบาท แต่ละตัวมีความทรงจำของตนเอง และทำงานร่วมกันในห้องสนทนากลุ่มได้
        </p>
      </div>

      {/* Conversational / Quick Bot Creator */}
      <form
        onSubmit={handleCreateBot}
        className="rounded-[12px] p-4 space-y-3"
        style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
      >
        <div className="text-[13.5px] font-semibold">+ Create Specialist AI Teammate</div>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อ Teammate (เช่น Growth Scout, Legal Counsel)..."
            className="rounded-[8px] px-3 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
          />
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="บทบาทและขอบเขตความรับผิดชอบ..."
            className="rounded-[8px] px-3 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="สไตล์การสื่อสาร..."
              className="flex-1 rounded-[8px] px-3 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
            />
            <button
              type="submit"
              className="rounded-[8px] bg-[#2b66e0] hover:bg-[#2458c6] px-4 py-2 text-[12.5px] font-semibold text-white shrink-0"
            >
              Create
            </button>
          </div>
        </div>
      </form>

      {/* Roster Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {bots.map((bot) => (
          <div
            key={bot.id}
            className="flex flex-col justify-between rounded-[12px] p-4 space-y-3"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2b66e0]/20 border border-[#2b66e0]/40 text-[11px] font-bold text-[#7cb0ff]">
                    {(bot.avatar || bot.name || "WB").slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-[14px] font-semibold">{bot.name}</span>
                </div>
                {bot.isMain && (
                  <span className="rounded bg-[#2b66e0] px-2 py-0.5 text-[10px] font-semibold text-white">
                    MAIN
                  </span>
                )}
              </div>
              <div className="text-[12px] font-medium text-[#7cb0ff]">{bot.role}</div>
              <p className="text-[11.5px] text-[var(--wb-muted)]">
                {bot.persona?.tone || "Dedicated Cloud Computer + Scoped Memory"}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--wb-line)" }}>
              <span className="text-[11px] text-emerald-400">
                ● {bot.persona?.statusText || "Ready on Cloud"}
              </span>
              <button
                type="button"
                onClick={() => router.push(`/teammate?bot=${bot.id}`)}
                className="inline-flex items-center gap-1 rounded-[7px] bg-[#2b66e0] hover:bg-[#2458c6] px-3 py-1.5 text-[11.5px] font-medium text-white"
              >
                <span>Open Chat</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
