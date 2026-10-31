"use client";

import React, { useState, useEffect } from "react";
import { Repeat2, Play, Pause, Plus, ShieldCheck, Clock } from "lucide-react";

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [triggerExpr, setTriggerExpr] = useState("0 8 * * 1-5");
  const [triggerType, setTriggerType] = useState("cron");
  const [template, setTemplate] = useState("");

  const loadRoutines = () => {
    fetch("/api/routines")
      .then((r) => r.json())
      .then((res) => setRoutines(res?.data?.routines || res?.routines || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadRoutines();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await fetch("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        trigger: { type: triggerType, expr: triggerExpr, kindLabel: `${triggerType.toUpperCase()}: ${triggerExpr}` },
        action: { template: template || title, spendGuard: true },
      }),
    });
    setTitle("");
    setTemplate("");
    loadRoutines();
  };

  const handleToggle = async (rt: any) => {
    const next = rt.status === "active" ? "paused" : "active";
    await fetch(`/api/routines/${rt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    loadRoutines();
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold">Routines & Event Automations (Spend Guard Protected)</h1>
          <p className="text-[12.5px] text-[var(--wb-muted)]">
            ตั้งเวลางานประจำ (Cron), ดักจับอีเมลขาเข้า, หรือรับ Webhook จาก Slack / GitHub / Linear
          </p>
        </div>
      </div>

      {/* Create Routine Form */}
      <form
        onSubmit={handleCreate}
        className="rounded-[12px] p-4 space-y-3"
        style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
      >
        <div className="text-[13.5px] font-semibold">+ Create Automated Routine</div>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ชื่อ Routine (เช่น สรุปยอดขายทุกเช้าวันจันทร์)..."
            className="min-h-[40px] sm:min-h-0 rounded-[8px] px-3 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
          />
          <select
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value)}
            className="min-h-[40px] sm:min-h-0 rounded-[8px] px-3 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
          >
            <option value="cron">Schedule (Cron / Timezone)</option>
            <option value="email_inbox">When Email Arrives at Bot Inbox</option>
            <option value="github_event">GitHub PR Opened / CI Failed</option>
            <option value="slack_mention">Slack @mention or Keyword</option>
          </select>
          <input
            type="text"
            value={triggerExpr}
            onChange={(e) => setTriggerExpr(e.target.value)}
            placeholder="0 8 * * 1-5 หรือ invoices@woibot.com"
            className="min-h-[40px] sm:min-h-0 rounded-[8px] px-3 py-2 font-mono text-[12px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="ขั้นตอนที่ให้ Teammate หรือ Work ดำเนินการอัตโนมัติ..."
            className="min-h-[40px] sm:min-h-0 flex-1 rounded-[8px] px-3 py-2 text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
          />
          <button
            type="submit"
            className="min-h-[40px] sm:min-h-0 rounded-[8px] bg-[#2b66e0] hover:bg-[#2458c6] px-4 py-2 text-[12.5px] font-semibold text-white shrink-0"
          >
            Save Routine
          </button>
        </div>
      </form>

      {/* Routines List */}
      <div className="grid gap-3 md:grid-cols-2">
        {routines.map((rt) => (
          <div
            key={rt.id}
            className="rounded-[12px] p-4 space-y-2.5"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[14px] font-semibold">{rt.title}</div>
                <div className="font-mono text-[11.5px] text-[#7cb0ff]">
                  {rt.trigger?.kindLabel || rt.trigger?.expr || "Scheduled"}
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase ${
                  rt.status === "active"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-amber-500/15 text-amber-400"
                }`}
              >
                {rt.status}
              </span>
            </div>

            <p className="text-[12px] text-[var(--wb-muted)]">
              {rt.action?.template || "Automated workflow on Cloud Computer"}
            </p>

            <div className="flex items-center justify-between pt-2 text-[11.5px] text-[var(--wb-muted)] tabular-nums" style={{ borderTop: "1px solid var(--wb-line)" }}>
              <span>
                Runs: <strong>{rt.runCount || 0}</strong> · Failures: {rt.failCount || 0}
              </span>
              <button
                type="button"
                onClick={() => handleToggle(rt)}
                className="rounded-[6px] bg-[var(--wb-panel)] border border-[var(--wb-line)] px-3 py-1 text-[11.5px] font-medium text-[var(--wb-fg)] hover:bg-[var(--wb-hover)]"
              >
                {rt.status === "active" ? "Pause Routine" : "Resume Routine"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
