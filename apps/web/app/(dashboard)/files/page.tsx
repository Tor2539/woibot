"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye } from "lucide-react";

export default function FilesLibraryPage() {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewItem, setPreviewItem] = useState<any | null>(null);

  useEffect(() => {
    fetch("/api/artifacts")
      .then((r) => r.json())
      .then((res) => setArtifacts(res?.artifacts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold">Files, Deliverables & Cloud Drive</h1>
          <p className="text-[12.5px] text-[var(--wb-muted)]">
            ไฟล์ผลงานทั้งหมดที่สร้างโดย Teammate และ Work — เปิดดู แก้ไขต่อ และดาวน์โหลดได้ทันที
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/work?area=artifacts")}
          className="min-h-[40px] sm:min-h-0 rounded-[8px] bg-[#2b66e0] hover:bg-[#2458c6] px-3.5 py-2 text-[12.5px] font-semibold text-white"
        >
          Open Artifacts Studio →
        </button>
      </div>

      {loading ? (
        <div
          className="rounded-[12px] px-4 py-8 text-center text-[12.5px] text-[var(--wb-muted)]"
          style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
        >
          กำลังโหลดไฟล์...
        </div>
      ) : artifacts.length === 0 ? (
        <div
          className="rounded-[12px] px-4 py-8 text-center space-y-1.5"
          style={{ backgroundColor: "var(--wb-raised)", border: "1px dashed var(--wb-line-strong)" }}
        >
          <div className="text-[13px] font-semibold">ยังไม่มีไฟล์ในคลังของคุณ</div>
          <div className="text-[11.5px] text-[var(--wb-muted)]">
            ไฟล์จริงจะปรากฏที่นี่เมื่อ Teammate หรือ Work สร้างและตรวจสอบเสร็จ — หน้านี้ไม่แสดงไฟล์ตัวอย่างที่สร้างขึ้นเอง
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {artifacts.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-[12px] p-4 space-y-3"
              style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="rounded bg-[#2b66e0]/20 px-2 py-0.5 font-semibold uppercase text-[#7cb0ff]">
                    {item.origin === "work" ? "Work Deliverable" : "Teammate File"}
                  </span>
                  <span className="font-mono text-[var(--wb-muted)]">{item.status || "artifact"}</span>
                </div>
                <div className="text-[14px] font-semibold break-words">{item.title}</div>
                <div className="text-[11.5px] text-[var(--wb-muted)] break-words">{item.subKind}</div>
              </div>

              <div className="flex items-center gap-2 pt-2" style={{ borderTop: "1px solid var(--wb-line)" }}>
                <button
                  type="button"
                  onClick={() => setPreviewItem(item)}
                  className="min-h-[40px] sm:min-h-0 flex-1 inline-flex items-center justify-center gap-1.5 rounded-[7px] py-1.5 text-[12px] font-medium hover:bg-[var(--wb-hover)]"
                  style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview</span>
                </button>
                <a
                  href={`/api/artifacts?download=${item.id}`}
                  className="min-h-[40px] sm:min-h-0 flex-1 inline-flex items-center justify-center gap-1.5 rounded-[7px] bg-[#2b66e0] hover:bg-[#2458c6] py-1.5 text-[12px] font-medium text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65">
          <div
            className="max-h-[90vh] w-full max-w-[680px] overflow-y-auto rounded-[12px] p-5 space-y-3"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-[15px] font-semibold break-words">{previewItem.title}</div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="shrink-0 rounded px-2.5 py-1 text-xs text-[var(--wb-muted)] hover:bg-[var(--wb-hover)]"
              >
                Close
              </button>
            </div>
            <pre
              className="max-h-[400px] overflow-auto rounded-lg p-4 font-mono text-[12px] whitespace-pre-wrap"
              style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
            >
              {previewItem.content || previewItem.summary}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}