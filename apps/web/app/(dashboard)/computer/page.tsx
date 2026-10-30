"use client";

import React, { useState } from "react";
import { Monitor, Terminal, Play, Pause, Sparkles, ShieldCheck, RefreshCw, HardDrive, Cpu } from "lucide-react";

export default function CloudComputerPage() {
  const [takeOver, setTakeOver] = useState(false);
  const [teachMode, setTeachMode] = useState(false);
  const [pauseWhenAway, setPauseWhenAway] = useState(false);
  const [cmdInput, setCmdInput] = useState("");
  const [termLogs, setTermLogs] = useState<string[]>([
    "woibot@cloud-vm:~/workspace$ supervisord status",
    "xvfb                             RUNNING   pid 14, uptime 14:28:11",
    "chromium-cdp (:9222)             RUNNING   pid 42, uptime 14:28:09",
    "novnc (:6080 -> :5900)           RUNNING   pid 51, uptime 14:28:09",
    "woibot-agent-loop                RUNNING   pid 88, watching Gmail/Calendar/Tasks",
  ]);

  const handleRunCmd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdInput.trim()) return;
    const cmd = cmdInput.trim();
    setTermLogs((prev) => [
      ...prev,
      `woibot@cloud-vm:~/workspace$ ${cmd}`,
      `[exec ok] Completed '${cmd}' on isolated container woibot-usr_default (exit 0)`,
    ]);
    setCmdInput("");
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-bold">Personal Cloud Computer (noVNC :99)</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Running 24/7
            </span>
          </div>
          <p className="text-[12.5px] text-[var(--wb-muted)]">
            Ubuntu 24.04 LTS · Persistent Volume `/home/woibot` · แยก Container ต่อบัญชีลูกค้าอย่างปลอดภัย
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTakeOver((v) => !v)}
            className={`rounded-[8px] px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
              takeOver ? "bg-amber-500 text-black" : "bg-[#2b66e0] text-white hover:bg-[#2458c6]"
            }`}
          >
            {takeOver ? "Release Control back to Bot" : "Take Over Screen (2FA / Login)"}
          </button>
          <button
            type="button"
            onClick={() => setTeachMode((t) => !t)}
            className={`rounded-[8px] px-3.5 py-2 text-[12.5px] font-medium ${
              teachMode
                ? "bg-red-500/20 border border-red-500 text-red-300"
                : "bg-[var(--wb-raised)] border border-[var(--wb-line)] text-[var(--wb-fg)]"
            }`}
          >
            {teachMode ? "Stop Teach Recording" : "Teach by Demonstration"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        {/* Left: Live Desktop Screen + Interactive Shell */}
        <div
          className="overflow-hidden rounded-[12px]"
          style={{ backgroundColor: "#090a0f", border: "1px solid var(--wb-line-strong)" }}
        >
          <div className="flex items-center justify-between bg-[#13151f] px-4 py-2 text-[11.5px] text-[#8f929a] border-b border-[#25262c]">
            <span className="font-mono">
              DISPLAY=:99 · Chromium CDP :9222 · {takeOver ? "INTERACTIVE TAKEOVER MODE" : "BOT AUTONOMOUS MODE"}
            </span>
            <span className="font-mono text-emerald-400">1920×1080 · 60fps</span>
          </div>

          <div className="p-4 space-y-4">
            {/* Simulated Browser Window inside Cloud VM */}
            <div className="rounded-lg bg-[#12141e] border border-[#252838] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="font-mono text-[#7cb0ff]">
                  https://portal.acmecorp.co.th/procurement/rfq-2026
                </span>
                <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10.5px] text-emerald-400">
                  1Password Vault Autofilled
                </span>
              </div>
              <div className="text-[12.5px] text-[#d2d3d8]">
                Bot กำลังเปิดเว็บพอร์ทัลของลูกค้า, ดาวน์โหลดเอกสาร RFQ, และซิงค์สถานะเข้ากับ Teammate Chat โดยคงสถานะ Login ถาวรในโปรไฟล์ Chromium ของคุณ
              </div>
            </div>

            {/* Interactive Container Terminal */}
            <div className="rounded-lg bg-[#07080c] border border-[#1e202b] p-3.5 font-mono text-[12px] space-y-1.5">
              {termLogs.map((ln, idx) => (
                <div key={idx} className={ln.startsWith("woibot@") ? "text-[#7cb0ff]" : "text-[#a3a7b5]"}>
                  {ln}
                </div>
              ))}
              <form onSubmit={handleRunCmd} className="flex items-center gap-2 pt-2 border-t border-[#1e202b]">
                <span className="text-emerald-400">woibot@cloud-vm:~$</span>
                <input
                  type="text"
                  value={cmdInput}
                  onChange={(e) => setCmdInput(e.target.value)}
                  placeholder="Type command to run inside your Cloud Computer..."
                  className="flex-1 bg-transparent text-white focus:outline-none"
                />
              </form>
            </div>
          </div>
        </div>

        {/* Right: Container Resources, Cookie Import & Snapshot Controls */}
        <div className="space-y-3">
          <div
            className="rounded-[12px] p-4 space-y-3"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
          >
            <div className="text-[13.5px] font-semibold">Container Resources (Pro Plan)</div>
            <div className="space-y-2.5 text-[12px] tabular-nums">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--wb-muted)]">CPU (2 vCPU Dedicated)</span>
                  <span className="font-mono">24%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--wb-panel)]">
                  <div className="h-full w-[24%] rounded-full bg-[#3b82f6]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--wb-muted)]">Memory (4 GB RAM)</span>
                  <span className="font-mono">1.68 / 4.00 GB</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--wb-panel)]">
                  <div className="h-full w-[42%] rounded-full bg-emerald-400" />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--wb-muted)]">Persistent Disk (/home/woibot)</span>
                  <span className="font-mono">14.2 / 50.0 GB</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--wb-panel)]">
                  <div className="h-full w-[28%] rounded-full bg-[#2b66e0]" />
                </div>
              </div>
            </div>
          </div>

          <div
            className="rounded-[12px] p-4 space-y-2.5"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
          >
            <div className="text-[13.5px] font-semibold">Session & Security Controls</div>
            <label className="flex items-center justify-between text-[12px] cursor-pointer py-1">
              <span>Pause screen streaming while away</span>
              <input
                type="checkbox"
                checked={pauseWhenAway}
                onChange={(e) => setPauseWhenAway(e.target.checked)}
              />
            </label>
            <div className="text-[11.5px] text-[var(--wb-muted)]">
              แม้ปิดหน้าจอสตรีมมิ่ง บอทยังทำงานเบื้องหลังต่อได้ตามปกติ และสามารถกู้คืนจาก Snapshot ล่าสุดได้ทุกเมื่อ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
