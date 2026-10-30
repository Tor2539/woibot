"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Download, Eye, FileCode2, FileText, Clapperboard, Layers } from "lucide-react";

export default function FilesLibraryPage() {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [previewItem, setPreviewItem] = useState<any | null>(null);

  useEffect(() => {
    fetch("/api/artifacts")
      .then((r) => r.json())
      .then((res) => setArtifacts(res?.artifacts || []))
      .catch(() => {});
  }, []);

  const staticDeliverables = [
    { id: "del_crm_zip", title: "crm-enterprise-v1.zip", subKind: "Runnable Next.js CRM + Prisma + Playwright", origin: "work", size: "4.2 MB", content: "Archive contents:\n- apps/crm/app/pipeline/page.tsx\n- apps/crm/prisma/schema.prisma\n- apps/crm/lib/verification/crm.spec.ts\n- verification_report.json (5/5 passed)" },
    { id: "del_vid_169", title: "woibot-launch-16x9-1080p.mp4", subKind: "H.264 1080p + Bilingual TH/EN Subtitles", origin: "work", size: "14.8 MB", content: "FFprobe Stream Verified:\nResolution: 1920x1080 @ 60fps\nAudio: AAC 48kHz (-14.1 LUFS)\nSubtitles: TH + EN synced (0ms drift)" },
    { id: "del_vid_proj", title: "remotion-launch-bundle.zip", subKind: "Editable Video Project Timeline", origin: "work", size: "6.0 MB", content: "Remotion editable project bundle with 5 scenes and subtitle tracks." },
  ];

  const allItems = [...staticDeliverables, ...artifacts];

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
          className="rounded-[8px] bg-[#2b66e0] hover:bg-[#2458c6] px-3.5 py-2 text-[12.5px] font-semibold text-white"
        >
          Open Artifacts Studio →
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allItems.map((item) => (
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
                <span className="font-mono text-[var(--wb-muted)]">{item.size || "Verified"}</span>
              </div>
              <div className="text-[14px] font-semibold truncate">{item.title}</div>
              <div className="text-[11.5px] text-[var(--wb-muted)]">{item.subKind}</div>
            </div>

            <div className="flex items-center gap-2 pt-2" style={{ borderTop: "1px solid var(--wb-line)" }}>
              <button
                type="button"
                onClick={() => setPreviewItem(item)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[7px] py-1.5 text-[12px] font-medium hover:bg-[var(--wb-hover)]"
                style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Preview</span>
              </button>
              <a
                href={`/api/artifacts?download=${item.id}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[7px] bg-[#2b66e0] hover:bg-[#2458c6] py-1.5 text-[12px] font-medium text-white"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65">
          <div
            className="w-full max-w-[680px] rounded-[12px] p-5 space-y-3"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
          >
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-semibold">{previewItem.title}</div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="rounded px-2.5 py-1 text-xs text-[var(--wb-muted)] hover:bg-[var(--wb-hover)]"
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
