"use client";

import React, { useState, useEffect } from "react";

const PAGE_SIZE = 50;

export default function SettingsBillingPage() {
  const [usage, setUsage] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterProduct, setFilterProduct] = useState<"all" | "teammate" | "work">("all");
  const [page, setPage] = useState(1);

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

  const filteredEvents =
    filterProduct === "all" ? events : events.filter((ev: any) => ev.product === filterProduct);
  const total = filteredEvents.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageEvents = filteredEvents.slice(start, start + PAGE_SIZE);

  const changeFilter = (p: "all" | "teammate" | "work") => {
    setFilterProduct(p);
    setPage(1);
  };
  const countBy = (p: "all" | "teammate" | "work") =>
    p === "all" ? events.length : events.filter((ev: any) => ev.product === p).length;

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[14px] font-semibold">Isolated Usage Ledger (Teammate vs Work Events)</div>
          <div className="flex items-center gap-1.5">
            {(["all", "teammate", "work"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => changeFilter(p)}
                className={`rounded-[7px] px-3 py-1.5 text-[12px] font-medium capitalize ${
                  filterProduct === p
                    ? "bg-[var(--wb-active)] text-[var(--wb-fg)] border border-[var(--wb-line-strong)]"
                    : "text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                }`}
              >
                {p} ({countBy(p)})
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="rounded-[10px] px-4 py-6 text-center text-[12px] text-[var(--wb-muted)]" style={{ backgroundColor: "var(--wb-panel)", border: "1px dashed var(--wb-line-strong)" }}>
            กำลังโหลดรายการใช้งาน...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-[10px] px-4 py-6 text-center space-y-1" style={{ backgroundColor: "var(--wb-panel)", border: "1px dashed var(--wb-line-strong)" }}>
            <div className="text-[13px] font-semibold">
              {events.length === 0 ? "ยังไม่มีรายการใช้งานในรอบที่เลือก" : `ไม่พบรายการใช้งานของ ${filterProduct}`}
            </div>
            <div className="text-[11.5px] text-[var(--wb-muted)]">
              {events.length === 0
                ? "เมื่อ Teammate หรือ Work ทำงาน ทุกเหตุการณ์จะถูกบันทึกลง Ledger แยกตามผลิตภัณฑ์"
                : "ลองเลือกดู Ledger อื่นทางด้านบน"}
            </div>
          </div>
        ) : (
        <>
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
              {pageEvents.map((ev: any) => (
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
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="text-[11.5px] text-[var(--wb-muted)] tabular-nums">
            {total === 0
              ? "แสดง 0–0 จาก 0"
              : `แสดง ${start + 1}–${Math.min(start + PAGE_SIZE, total)} จาก ${total}`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((v) => Math.max(1, v - 1))}
              disabled={safePage <= 1}
              className={`rounded-[7px] px-3 py-1.5 text-[12px] font-medium ${
                safePage <= 1
                  ? "text-[var(--wb-muted)] opacity-50 cursor-not-allowed border border-[var(--wb-line)]"
                  : "bg-[var(--wb-raised)] text-[var(--wb-fg)] hover:bg-[var(--wb-hover)] border border-[var(--wb-line)]"
              }`}
            >
              Prev
            </button>
            <span className="text-[11.5px] text-[var(--wb-muted)] tabular-nums">
              หน้า {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
              disabled={safePage >= totalPages}
              className={`rounded-[7px] px-3 py-1.5 text-[12px] font-medium ${
                safePage >= totalPages
                  ? "text-[var(--wb-muted)] opacity-50 cursor-not-allowed border border-[var(--wb-line)]"
                  : "bg-[var(--wb-raised)] text-[var(--wb-fg)] hover:bg-[var(--wb-hover)] border border-[var(--wb-line)]"
              }`}
            >
              Next
            </button>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}