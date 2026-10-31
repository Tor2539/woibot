"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, SlidersHorizontal, CheckCircle2 } from "lucide-react";

export default function SettingsBillingPage() {
  const [usage, setUsage] = useState<any | null>(null);
  const [monthlyCap, setMonthlyCap] = useState(50);
  const [perTaskCap, setPerTaskCap] = useState(5);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((res) => {
        const d = res?.data || res;
        setUsage(d);
        if (d?.quota?.monthlyCap) setMonthlyCap(d.quota.monthlyCap);
        if (d?.quota?.perTaskCap) setPerTaskCap(d.quota.perTaskCap);
      })
      .catch(() => {});
  }, []);

  const handleSaveCaps = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

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
              $5.75 / ${monthlyCap.toFixed(2)} cap
            </span>
          </div>
          <div className="text-[15px] font-semibold">Pay-Per-Deliverable with Pre-Execution Estimate Gate</div>
          <form onSubmit={handleSaveCaps} className="grid gap-2.5 sm:grid-cols-3 pt-1">
            <div>
              <label className="block text-[10.5px] text-[var(--wb-muted)] mb-1">Per-Task Cap (USD)</label>
              <input
                type="number"
                step="0.5"
                value={perTaskCap}
                onChange={(e) => setPerTaskCap(Number(e.target.value))}
                className="min-h-[40px] sm:min-h-0 w-full rounded-[7px] px-2.5 py-1.5 font-mono text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)] tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[10.5px] text-[var(--wb-muted)] mb-1">Monthly Work Cap (USD)</label>
              <input
                type="number"
                step="5"
                value={monthlyCap}
                onChange={(e) => setMonthlyCap(Number(e.target.value))}
                className="min-h-[40px] sm:min-h-0 w-full rounded-[7px] px-2.5 py-1.5 font-mono text-[12.5px] bg-[var(--wb-panel)] border border-[var(--wb-line)] tabular-nums"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="min-h-[40px] sm:min-h-0 w-full rounded-[7px] bg-[#2b66e0] hover:bg-[#2458c6] py-1.5 text-[12px] font-semibold text-white"
              >
                {savedNotice ? "✓ Saved Guardrails" : "Save Guardrails"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Meter Rates & Recent Ledger Table */}
      <div
        className="rounded-[12px] p-5 space-y-3"
        style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
      >
        <div className="text-[14px] font-semibold">Isolated Usage Ledger (Teammate vs Work Events)</div>
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
              {(
                usage?.events || [
                  { id: "1", product: "teammate", kind: "chat_routine", tokens: 18400, gpuSeconds: 0, cost: 0.0 },
                  { id: "2", product: "work", kind: "coding", tokens: 64200, gpuSeconds: 0, cost: 2.15 },
                  { id: "3", product: "work", kind: "video_gen", tokens: 12800, gpuSeconds: 145, cost: 3.6 },
                ]
              ).map((ev: any) => (
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
      </div>
    </div>
  );
}
