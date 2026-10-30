"use client";
import type { VerificationReport } from "@/lib/work/mock";

export function VerificationReportView({ report }: { report: VerificationReport | null }) {
  if (!report) {
    return (
      <div style={{ border: "1px dashed #d1d5db", borderRadius: 12, padding: 16, background: "#f9fafb" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Verification Report</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>ยังไม่มีรายงาน — จะสร้างเมื่อเข้าสู่ขั้นตอนตรวจสอบ (Definition of Done)</div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>ต้องมี evidence ก่อน mark Completed: coding → tests+preview, docs → file open check, video → ffprobe+thumbs</div>
      </div>
    );
  }
  return (
    <div style={{ border: `1px solid ${report.passed ? "#a7f3d0" : "#fecaca"}`, borderRadius: 12, overflow: "hidden", background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: report.passed ? "#ecfdf5" : "#fef2f2", borderBottom: "1px solid #e5e7eb" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: report.passed ? "#065f46" : "#991b1b" }}>{report.passed ? "✓ PASSED" : "✗ FAILED"} • {report.type.toUpperCase()}</div>
          <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>{report.summary}</div>
        </div>
        <div style={{ fontSize: 11, color: "#6b7280" }}>{new Date(report.createdAt).toLocaleString("th-TH")}</div>
      </div>
      <div style={{ padding: 10 }}>
        {report.checks.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 6px", borderBottom: i === report.checks.length - 1 ? 0 : "1px solid #f3f4f6" }}>
            <span style={{ fontSize: 14, lineHeight: 1, marginTop: 2 }}>{c.passed ? "✅" : "❌"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{c.name}</div>
              {c.detail && <div style={{ fontSize: 11, color: "#6b7280" }}>{c.detail}</div>}
            </div>
            {c.evidenceUrl && <a href={c.evidenceUrl} style={{ fontSize: 11, color: "#1757d7" }}>evidence →</a>}
          </div>
        ))}
      </div>
      <div style={{ padding: 10, background: "#f9fafb", borderTop: "1px solid #e5e7eb", fontSize: 11, color: "#6b7280" }}>
        รายงานนี้แนบกับ deliverables ก่อนส่งกลับ Teammate • ผู้ใช้ตรวจสอบและขอแก้ไขได้
      </div>
    </div>
  );
}
