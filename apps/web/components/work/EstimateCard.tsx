"use client";
import { estimateTask, checkQuotaGate, formatCost, formatDuration } from "@/lib/work/estimates";
import type { WorkKind, ExecutionMode } from "@/lib/work/templates";

export function EstimateCard({
  kind, executionMode, quota, onApprove, approving, blocked,
}: {
  kind: WorkKind;
  executionMode: ExecutionMode;
  quota?: { perTaskCap: number; monthlyCap: number; monthlyUsed: number } | null;
  onApprove?: () => void;
  approving?: boolean;
  blocked?: boolean;
}) {
  const est = estimateTask(kind, executionMode);
  const gate = checkQuotaGate(est.cost, quota ?? null);
  const canProceed = gate.ok && !blocked;

  return (
    <div style={{ border: `1px solid ${canProceed ? "#c7d2fe" : gate.ok ? "#e5e7eb" : "#fecaca"}`, borderRadius: 14, padding: 16, background: canProceed ? "#eef2ff" : gate.ok ? "#fff" : "#fef2f2" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: "#4f46e5" }}>ESTIMATE • ประเมินก่อนเริ่ม</div>
        <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: executionMode === "cloud" ? "#0f172a" : "#065f46", color: "#fff" }}>
          {executionMode === "cloud" ? "☁ Cloud" : "💻 Local"} • {formatDuration(est.minutes)}
        </span>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
        <div><div style={{ fontSize: 11, color: "#6b7280" }}>ESTIMATED COST</div><div style={{ fontSize: 22, fontWeight: 800 }}>{formatCost(est.cost)} <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>USD</span></div></div>
        <div><div style={{ fontSize: 11, color: "#6b7280" }}>TIME</div><div style={{ fontSize: 16, fontWeight: 700 }}>{formatDuration(est.minutes)}</div></div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>REQUIRED TOOLS</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {est.tools.map(t => <span key={t} style={{ fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 999, padding: "2px 8px", background: "#fff" }}>{t}</span>)}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        {est.breakdown.map(b => (
          <div key={b.item} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#374151", padding: "3px 0", borderBottom: "1px dashed #e5e7eb" }}>
            <span>{b.item}</span><span>{formatCost(b.cost)}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, paddingTop: 6 }}>
          <span>Total estimate</span><span>{formatCost(est.cost)}</span>
        </div>
      </div>

      {quota && (
        <div style={{ marginTop: 10, fontSize: 11, color: "#6b7280", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
          โควตา: ใช้แล้ว {formatCost(quota.monthlyUsed)} / {formatCost(quota.monthlyCap)} • ต่อครั้งสูงสุด {formatCost(quota.perTaskCap)}
          <div style={{ height: 6, background: "#e5e7eb", borderRadius: 999, marginTop: 6, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, (quota.monthlyUsed / quota.monthlyCap) * 100)}%`, height: "100%", background: quota.monthlyUsed / quota.monthlyCap > 0.8 ? "#dc2626" : "#4f46e5" }} />
          </div>
        </div>
      )}

      {!gate.ok && <div style={{ marginTop: 10, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: 8, fontSize: 12, color: "#991b1b" }}>⛔ {gate.reason}</div>}

      {onApprove && (
        <button
          onClick={onApprove}
          disabled={!canProceed || approving}
          style={{
            marginTop: 12, width: "100%", padding: "10px 14px", borderRadius: 10, border: 0,
            background: canProceed ? "#0f172a" : "#9ca3af", color: "#fff", fontWeight: 700, cursor: canProceed ? "pointer" : "not-allowed",
            opacity: approving ? 0.7 : 1,
          }}
        >
          {approving ? "กำลังเริ่มงาน…" : canProceed ? "✓ อนุมัติและเริ่มงาน — Approve & Start" : "ไม่สามารถเริ่มได้ — ต้องแก้วงเงิน/โหมด"}
        </button>
      )}
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6, textAlign: "center" }}>
        หลักการ: แสดง cost + time + tools ก่อนเริ่มเสมอ • เคารพ perTaskCap / monthlyCap
      </div>
    </div>
  );
}
