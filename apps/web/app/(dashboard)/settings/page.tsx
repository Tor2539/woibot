"use client";

import React, { useState, useEffect } from "react";

export default function SettingsBillingPage() {
  const [usage, setUsage] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((res) => {
        const d = res?.data || res;
        setUsage(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = (v: unknown) => (typeof v === "number" ? `$${v.toFixed(2)}` : "—");
  const guardrails = usage?.guardrails;
  const monthlyUsed = usage?.work?.quota?.monthlyUsed;
  const monthlyCap = guardrails?.monthlyCap;
  const perTaskCap = guardrails?.perTaskCap;
  const events = usage?.events || [];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-[18px] font-bold">Settings, Cost Isolation & Usage Governance</h1>
        <p className="text-[12.5px] text-[var(--wb-muted)]">
          แยกสิทธิ์และการคิดต้นทุนระหว่าง <strong>Teammate (Subscription)</strong> และ <strong>Work (Metered Execution)</strong> เพื่อไม่ให้งานหนักกระทบความคุ้มค่าของบริการรายวัน
        </p>
      </div>

      {/* Two-Ledger Cost Isolation Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <div
          className="rounded-[12px] p-5 space-y-3"
          style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="rounded bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
              LEDGER A · TEAMMATE SUBSCRIPTION
            </span>
            <span className="font-mono text-[14px] font-bold tabular-nums">฿999 / month (Pro)</span>
          </div>
          <div className="text-[15px] font-semibold">Always-On Personal Teammate & Cloud Computer</div>
          <ul className="space-y-1.5 text-[12px] text-[var(--wb-muted)]">
            <li>• Dedicated Cloud Computer (2 vCPU / 4 GB RAM · Persistent 24/7)</li>
            <li>• 10,000,000 Monthly Chat & Routine Allowance Tokens</li>
            <li>• 2-Tier Personal & Team Memory + 100 Active Routines</li>
            <li>• งานหนักจาก Work จะไม่ถูกนำมาหักจากโควต้า Teammate เด็ดขาด</li>
          </ul>
          {usage?.teammate && (
            <div className="rounded-[9px] px-3 py-2 text-[11.5px] text-[var(--wb-muted)] tabular-nums" style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}>
              สิทธิ์การใช้: {(usage.teammate.usedTokens || 0).toLocaleString()} / {(usage.teammate.allowance || 0).toLocaleString()} tokens ({usage.teammate.usedPct || 0}%)
            </div>
          )}
        </div>

        <div
          className="rounded-[12px] p-5 space-y-3"
          style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="rounded bg-[#2b66e0]/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#7cb0ff]">
              LEDGER B · WORK METERED EXECUTION
            </span>
            <span className="font-mono text-[14px] font-bold text-[#7cb0ff] tabular-nums">
              {fmt(monthlyUsed)} / {fmt(monthlyCap)} cap
            </span>
          </div>
          <div className="text-[15px] font-semibold">Pay-Per-Deliverable with Pre-Execution Estimate Gate</div>
          <div className="grid gap-2.5 sm:grid-cols-3 pt-1 text-[12px]">
            <div className="rounded-[8px] px-3 py-2.5" style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}>
              <div className="text-[10.5px] text-[var(--wb-muted)] mb-0.5">Per-Task Cap (USD)</div>
              <div className="font-mono text-[13px] font-semibold tabular-nums">{loading ? "…" : fmt(perTaskCap)}</div>
            </div>
            <div className="rounded-[8px] px-3 py-2.5" style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}>
              <div className="text-[10.5px] text-[var(--wb-muted)] mb-0.5">Monthly Work Cap (USD)</div>
              <div className="font-mono text-[13px] font-semibold tabular-nums">{loading ? "…" : fmt(monthlyCap)}</div>
            </div>
            <div className="rounded-[8px] px-3 py-2.5" style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}>
              <div className="text-[10.5px] text-[var(--wb-muted)] mb-0.5">ใช้ไปแล้วเดือนนี้</div>
              <div className="font-mono text-[13px] font-semibold tabular-nums">{loading ? "…" : fmt(monthlyUsed)}</div>
            </div>
          </div>
          <p className="text-[11.5px] text-[var(--wb-muted)]">
            วงเงิน Guardrails ค่าเริ่มต้นมาจากระบบ (per-task / monthly) — การเปลี่ยนวงเงินจากหน้าเว็บยังไม่เปิดใช้งาน จึงไม่มีปุ่มบันทึกหลอก ณ ที่นี้
          </p>
        </div>
      </div>

      {/* Meter Rates & Recent Ledger Table */}
      <div
        className="rounded-[12px] p-5 space-y-3"
        style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
      >
        <div className="text-[14px] font-semibold">Isolated Usage Ledger (Teammate vs Work Events)</div>
        {loading ? (
          <div className="rounded-[10px] px-4 py-6 text-center text-[12px] text-[var(--wb-muted)]" style={{ backgroundColor: "var(--wb-panel)", border: "1px dashed var(--wb-line-strong)" }}>
            กำลังโหลดรายการใช้งาน...
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-[10px] px-4 py-6 text-center space-y-1" style={{ backgroundColor: "var(--wb-panel)", border: "1px dashed var(--wb-line-strong)" }}>
            <div className="text-[13px] font-semibold">ยังไม่มีรายการใช้งานในรอบที่เลือก</div>
            <div className="text-[11.5px] text-[var(--wb-muted)]">เมื่อ Teammate หรือ Work ทำงาน ทุกเหตุการณ์จะถูกบันทึกลง Ledger แยกตามผลิตภัณฑ์</div>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left border-collapse text-[12.5px] tabular-nums">
            <thead>
              <tr
                className="text-[11px] uppercase tracking-wider text-[var(--wb-muted)]"
                style={{ borderBottom: "1px solid var(--wb-line)", backgroundColor: "var(--wb-panel)" }}
              >
                <th className="py-2 px-3">Ledger Product</th>
                <th className="py-2 px-3">Work Kind / Event</th>
                <th className="py-2 px-3 text-right">Tokens</th>
                <th className="py-2 px-3 text-right">GPU Seconds</th>
                <th className="py-2 px-3 text-right">Metered Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--wb-line)]">
              {events.map((ev: any) => (
                <tr key={ev.id}>
                  <td className="py-2.5 px-3">
                    <span
                      className={`rounded px-2 py-0.5 text-[10.5px] font-semibold uppercase ${
                        ev.product === "work" ? "bg-[#2b66e0]/20 text-[#7cb0ff]" : "bg-emerald-500/15 text-emerald-400"
                      }`}
                    >
                      {ev.product}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono">{ev.kind || "chat"}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{(ev.tokens || 0).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{ev.gpuSeconds || 0}s</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">
                    {ev.product === "teammate" ? "$0.00 (Included)" : `$${Number(ev.cost || 0).toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}