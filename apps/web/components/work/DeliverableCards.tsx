"use client";

type Deliverable = { id: string; kind: string; fileName: string; mimeType: string; fileUrl: string; editable?: boolean; size?: string };

export function DeliverableCards({ items, taskId }: { items: Deliverable[]; taskId?: string }) {
  if (!items.length) {
    return (
      <div style={{ border: "1px dashed #d1d5db", borderRadius: 12, padding: 16, textAlign: "center", color: "#6b7280" }}>
        <div style={{ fontSize: 13 }}>ยังไม่มี Deliverables</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>ไฟล์จะปรากฏที่นี่เมื่อ Work ตรวจสอบเสร็จ — พร้อม preview + ดาวน์โหลด</div>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
      {items.map(d => (
        <div key={d.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#f3f4f6" }}>{d.kind.toUpperCase()}</span>
            {d.editable && <span style={{ fontSize: 10, color: "#065f46", border: "1px solid #a7f3d0", borderRadius: 999, padding: "1px 6px", background: "#ecfdf5" }}>editable</span>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.fileName}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>{d.mimeType} {d.size ? `• ${d.size}` : ""}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <a href={d.fileUrl} style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: 700, padding: "7px 8px", borderRadius: 8, background: "#0f172a", color: "#fff", textDecoration: "none" }}>Download</a>
            <a href={d.fileUrl} target="_blank" style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "1px solid #e5e7eb", textDecoration: "none", color: "#111827" }}>Preview</a>
          </div>
        </div>
      ))}
    </div>
  );
}

export function mockDeliverablesFor(kind: string, taskId: string) {
  const base: Deliverable[] = [];
  if (kind === "coding") {
    base.push({ id: "d1", kind: "code", fileName: "woibot-crm.zip", mimeType: "application/zip", fileUrl: "#", editable: true, size: "2.4 MB" });
    base.push({ id: "d2", kind: "preview", fileName: "Preview (live)", mimeType: "text/html", fileUrl: `/work/${taskId}/preview`, size: "—" });
  } else if (kind === "doc") {
    base.push({ id: "d1", kind: "doc", fileName: "proposal.docx", mimeType: "docx", fileUrl: "#", editable: true, size: "4.2 MB" });
    base.push({ id: "d2", kind: "doc", fileName: "proposal.pdf", mimeType: "pdf", fileUrl: "#", size: "3.8 MB" });
  } else if (kind === "video_gen" || kind === "video_analysis") {
    base.push({ id: "d1", kind: "video", fileName: "ad-30s-v1.mp4", mimeType: "video/mp4", fileUrl: "#", size: "12.4 MB" });
    base.push({ id: "d2", kind: "video", fileName: "ad-30s-v2.mp4", mimeType: "video/mp4", fileUrl: "#", size: "11.9 MB" });
    base.push({ id: "d3", kind: "file", fileName: "captions.th.srt", mimeType: "text/srt", fileUrl: "#", size: "4 KB" });
  } else {
    base.push({ id: "d1", kind: "doc", fileName: "report.pdf", mimeType: "pdf", fileUrl: "#", size: "2.1 MB" });
  }
  return base;
}
