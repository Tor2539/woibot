"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  AlertCircle,
  ArrowUpRight,
  Plus,
  Filter,
  RefreshCw,
} from "lucide-react";

const TEN_STATUSES = [
  "queued",
  "planning",
  "in_progress",
  "waiting_for_user",
  "paused",
  "reviewing",
  "completed",
  "partially_completed",
  "failed",
  "cancelled",
] as const;

export default function UnifiedTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [filterProduct, setFilterProduct] = useState<"all" | "teammate" | "work">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadTasks = () => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((res) => {
        const list = res?.data?.tasks || res?.tasks || [];
        setTasks(list);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleTransition = async (taskId: string, nextStatus: string, approveEstimate?: boolean) => {
    setBusyId(taskId);
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          ...(approveEstimate ? { approveEstimate: true, progress: 75 } : {}),
        }),
      });
      loadTasks();
    } finally {
      setBusyId(null);
    }
  };

  const filtered = tasks.filter((t) => {
    if (filterProduct !== "all" && t.product !== filterProduct) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold">Unified Task Center — Teammate & Work (10 States)</h1>
          <p className="text-[12.5px] text-[var(--wb-muted)]">
            ติดตามงานทั้งหมดจากที่เดียว เชื่อมโยงด้วย <span className="font-mono text-[#7cb0ff]">trace_id</span> และ Handoff Packet
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/work?area=code")}
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#2b66e0] hover:bg-[#2458c6] px-3.5 py-2 text-[12.5px] font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            <span>New Work Project</span>
          </button>
        </div>
      </div>

      {/* 10 Statuses Counter Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilterStatus("all")}
          className={`shrink-0 rounded-full px-3 py-1 text-[11.5px] font-medium ${
            filterStatus === "all"
              ? "bg-[#2b66e0] text-white"
              : "bg-[var(--wb-raised)] text-[var(--wb-muted)] border border-[var(--wb-line)]"
          }`}
        >
          All ({tasks.length})
        </button>
        {TEN_STATUSES.map((st) => {
          const count = tasks.filter((t) => t.status === st).length;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11.5px] font-medium capitalize tabular-nums ${
                filterStatus === st
                  ? "bg-[#2b66e0] text-white"
                  : "bg-[var(--wb-raised)] text-[var(--wb-muted)] hover:text-[var(--wb-fg)] border border-[var(--wb-line)]"
              }`}
            >
              {st.replace(/_/g, " ")} ({count})
            </button>
          );
        })}
      </div>

      {/* Product Filter Bar */}
      <div className="flex items-center gap-2">
        {(["all", "teammate", "work"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setFilterProduct(p)}
            className={`rounded-[7px] px-3 py-1.5 text-[12px] font-medium capitalize ${
              filterProduct === p
                ? "bg-[var(--wb-active)] text-[var(--wb-fg)] border border-[var(--wb-line-strong)]"
                : "text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
            }`}
          >
            {p === "all" ? "All Products" : p}
          </button>
        ))}
      </div>

      {/* Responsive Table (Desktop) + Stacked Cards (Mobile <768px) */}
      <div
        className="overflow-hidden rounded-[12px]"
        style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
      >
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className="text-[11px] uppercase tracking-wider text-[var(--wb-muted)]"
                style={{ borderBottom: "1px solid var(--wb-line)", backgroundColor: "var(--wb-panel)" }}
              >
                <th className="py-2.5 px-4">Task & Goal</th>
                <th className="py-2.5 px-3">Product / Mode</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Trace ID</th>
                <th className="py-2.5 px-3 text-right">Estimate / Cost</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--wb-line)] text-[12.5px]">
              {filtered.map((t) => {
                const est = t.estimate || {};
                return (
                  <tr key={t.id} className="hover:bg-[var(--wb-hover)] transition-colors">
                    <td className="py-3 px-4 max-w-[360px]">
                      <div className="font-semibold text-[var(--wb-fg)] truncate">{t.title}</div>
                      <div className="text-[11.5px] text-[var(--wb-muted)] truncate">{t.goal}</div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`rounded px-2 py-0.5 text-[10.5px] font-semibold uppercase ${
                          t.product === "work"
                            ? "bg-[#2b66e0]/20 text-[#7cb0ff]"
                            : "bg-emerald-500/15 text-emerald-400"
                        }`}
                      >
                        {t.product} {t.workKind ? `· ${t.workKind}` : ""}
                      </span>
                      <span className="ml-1.5 text-[11px] text-[var(--wb-muted)] uppercase">
                        ({t.executionMode})
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${
                          t.status === "completed"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : t.status === "waiting_for_user"
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-[var(--wb-panel)] text-[var(--wb-fg-soft)]"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {t.status.replace(/_/g, " ")} ({t.progress ?? 100}%)
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11.5px] text-[var(--wb-muted)] whitespace-nowrap">
                      {t.traceId}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      {t.product === "work" ? `$${(est.actualCost ?? est.estimatedCost ?? 2.4).toFixed(2)}` : "Included"}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                      {t.status === "waiting_for_user" && (
                        <button
                          type="button"
                          disabled={busyId === t.id}
                          onClick={() => handleTransition(t.id, "completed", true)}
                          className="rounded-[6px] bg-amber-500 hover:bg-amber-400 px-2.5 py-1 text-[11px] font-semibold text-black"
                        >
                          Approve & Run
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedTask(t)}
                        className="rounded-[6px] bg-[var(--wb-panel)] border border-[var(--wb-line)] px-2.5 py-1 text-[11px] hover:bg-[var(--wb-active)]"
                      >
                        Packet
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(t.product === "work" ? `/work/${t.id}` : "/teammate")}
                        className="inline-flex items-center gap-1 rounded-[6px] bg-[#2b66e0] px-2.5 py-1 text-[11px] font-medium text-white"
                      >
                        <span>Open</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Key/Value Cards (<768px) */}
        <div className="md:hidden divide-y divide-[var(--wb-line)]">
          {filtered.map((t) => {
            const est = t.estimate || {};
            return (
              <div key={t.id} className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-[13px]">{t.title}</div>
                  <span className="font-mono text-[11.5px] text-[#7cb0ff] tabular-nums">
                    {t.product === "work" ? `$${(est.actualCost ?? est.estimatedCost ?? 2.4).toFixed(2)}` : "Included"}
                  </span>
                </div>
                <div className="text-[11.5px] text-[var(--wb-muted)]">{t.goal}</div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono text-[var(--wb-muted)]">{t.traceId}</span>
                  <span className="capitalize text-emerald-400">{t.status.replace(/_/g, " ")}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  {t.status === "waiting_for_user" && (
                    <button
                      type="button"
                      onClick={() => handleTransition(t.id, "completed", true)}
                      className="flex-1 rounded-[6px] bg-amber-500 py-1.5 text-[11.5px] font-semibold text-black"
                    >
                      Approve
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push(t.product === "work" ? `/work/${t.id}` : "/teammate")}
                    className="flex-1 rounded-[6px] bg-[#2b66e0] py-1.5 text-[11.5px] font-medium text-white"
                  >
                    Open Workspace →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Handoff Packet Drawer Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65">
          <div
            className="w-full max-w-[620px] rounded-[12px] p-4 space-y-3"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
          >
            <div className="flex items-center justify-between">
              <div className="text-[14px] font-semibold">
                HandoffPacket & Verification Spec · {selectedTask.traceId}
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="rounded px-2 py-1 text-xs text-[var(--wb-muted)] hover:bg-[var(--wb-hover)]"
              >
                Close
              </button>
            </div>
            <pre
              className="max-h-[380px] overflow-auto rounded-lg p-3 font-mono text-[11.5px]"
              style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
            >
              {JSON.stringify(
                {
                  traceId: selectedTask.traceId,
                  product: selectedTask.product,
                  executionMode: selectedTask.executionMode,
                  handoffPacket: selectedTask.handoffPacket,
                  estimate: selectedTask.estimate,
                  verification: selectedTask.verification,
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
