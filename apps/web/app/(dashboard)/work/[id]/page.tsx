"use client";
import { useState, useMemo, use } from "react";
import { mockProjects, mockSteps, mockFileTree, mockVerification } from "@/lib/work/mock";
import type { WorkProject } from "@/lib/work/mock";
import { WORK_KINDS, TASK_STATUSES, WORK_TEMPLATES } from "@/lib/work/templates";
import { EstimateCard } from "@/components/work/EstimateCard";
import { VerificationReportView } from "@/components/work/VerificationReport";
import { DeliverableCards, mockDeliverablesFor } from "@/components/work/DeliverableCards";
import { StepsPanel, FileTree, PreviewPane, FeedbackPanel, VersionDiff } from "@/components/work/WorkspacePanels";
import type { ExecutionMode } from "@/lib/work/templates";

export default function WorkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const all = useMemo(() => mockProjects(), []);
  const found = all.find(p => p.id === id);
  const [project, setProject] = useState<WorkProject>(found ?? {
    id, title: "CRM สำหรับทีมขาย — Login + Dashboard + Reports", goal: "สร้างระบบ CRM สำหรับทีมขายของฉัน มี Login, Dashboard, Customer Management และรายงานยอดขาย ทำให้ใช้งานได้จริง",
    kind: "coding", status: "in_progress", executionMode: "cloud", progress: 62, traceId: "tr_demo123",
    estimate: { kind: "coding", cost: 2.4, minutes: 18, label: "Coding — build + tests + preview", tools: ["Cloud container", "Next.js runtime", "Vitest"], executionMode: "cloud", approved: true, breakdown: [{ item: "LLM", cost: 1.6 }, { item: "Exec", cost: 0.5 }] },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });

  const [activeTab, setActiveTab] = useState<"overview" | "files" | "preview" | "versions" | "verification">("overview");
  const [approved, setApproved] = useState(project.estimate.approved);
  const [executing, setExecuting] = useState(project.status === "in_progress");
  const [feedbackLog, setFeedbackLog] = useState<string[]>([]);
  const tpl = WORK_TEMPLATES[project.kind];

  const kindMeta = WORK_KINDS.find(k => k.id === project.kind);
  const statusMeta = TASK_STATUSES.find(s => s.id === project.status);

  const steps = mockSteps(project.kind);
  const files = mockFileTree(project.kind);
  const report = project.status === "completed" || project.status === "reviewing" || project.status === "in_progress" ? mockVerification(project.kind, project.id) : null;
  const deliverables = project.status === "completed" || project.status === "reviewing" ? mockDeliverablesFor(project.kind, project.id) : [];

  function handleApprove() {
    const quota = { perTaskCap: 10, monthlyCap: 50, monthlyUsed: 12.4 };
    if (project.estimate.cost > quota.perTaskCap) { alert(`เกิน perTaskCap $${quota.perTaskCap}`); return; }
    setApproved(true);
    setProject(p => ({ ...p, status: "in_progress", progress: 12, estimate: { ...p.estimate, approved: true } }));
    setExecuting(true);
    let prog = 12;
    const iv = setInterval(() => {
      prog += Math.floor(Math.random() * 10) + 4;
      if (prog >= 92) { prog = 92; clearInterval(iv); }
      setProject(prev => ({ ...prev, progress: prog }));
    }, 900);
  }

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 1280, margin: "0 auto", padding: "16px 14px 32px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <a href="/work" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none", border: "1px solid #e5e7eb", padding: "6px 10px", borderRadius: 999, background: "#fff" }}>← Work</a>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>trace {project.traceId}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, padding: "4px 10px", borderRadius: 999, background: statusMeta?.color ?? "#6b7280", color: "#fff", fontWeight: 700 }}>{statusMeta?.label} • {project.progress}%</span>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 360px" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: kindMeta?.color, border: `1px solid ${kindMeta?.color}33`, padding: "2px 8px", borderRadius: 999, background: `${kindMeta?.color}0d` }}>{kindMeta?.icon} {kindMeta?.label}</span>
            <span style={{ fontSize: 11, color: "#6b7280" }}>{tpl.titleTh}</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: project.executionMode === "cloud" ? "#0f172a" : "#065f46", color: "#fff" }}>{project.executionMode === "cloud" ? "☁ Cloud" : "💻 Local"}</span>
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 900, margin: "8px 0 6px", lineHeight: 1.3 }}>{project.title}</h1>
          <p style={{ fontSize: 12, color: "#374151", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, margin: 0 }}>{project.goal}</p>

          <div style={{ height: 6, background: "#e5e7eb", borderRadius: 999, marginTop: 12, overflow: "hidden" }}>
            <div style={{ width: `${project.progress}%`, height: "100%", background: "#4f46e5", transition: "width 0.6s" }} />
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            {(["overview", "files", "preview", "versions", "verification"] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                fontSize: 12, padding: "7px 12px", borderRadius: 999, cursor: "pointer", fontWeight: activeTab === t ? 800 : 500,
                border: activeTab === t ? "1px solid #0f172a" : "1px solid #e5e7eb",
                background: activeTab === t ? "#0f172a" : "#fff", color: activeTab === t ? "#fff" : "#374151",
              }}>
                {t === "overview" ? "Overview" : t === "files" ? "Files" : t === "preview" ? "Preview" : t === "versions" ? "Versions" : "Verification"}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(["cloud", "local"] as ExecutionMode[]).map(m => (
              <button key={m} onClick={() => setProject(p => ({ ...p, executionMode: m }))} style={{
                padding: 10, borderRadius: 10, textAlign: "left", cursor: "pointer",
                border: project.executionMode === m ? "2px solid #0f172a" : "1px solid #e5e7eb",
                background: project.executionMode === m ? "#f8fafc" : "#fff",
              }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>{m === "cloud" ? "☁ Cloud" : "💻 Local"}</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>{m === "cloud" ? "ทำงานต่อเมื่อออฟไลน์" : "ใช้ไฟล์ในเครื่อง • หยุดเมื่อปิดเครื่อง"}</div>
              </button>
            ))}
          </div>
          {project.executionMode === "local" && (
            <div style={{ marginTop: 8, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 8, fontSize: 11, color: "#92400e" }}>
              ⚠ Local Work จะพักงานเมื่อคอมพิวเตอร์ปิด/ไม่พร้อม และจะไม่ย้ายข้อมูลไป Cloud โดยไม่ได้รับอนุญาต • ดูสถานะที่ <a href="/computer" style={{ color: "#92400e" }}>Computer</a>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            {!approved ? (
              <EstimateCard
                kind={project.kind}
                executionMode={project.executionMode}
                quota={{ perTaskCap: 10, monthlyCap: 50, monthlyUsed: 12.4 }}
                onApprove={handleApprove}
                blocked={project.status === "completed"}
              />
            ) : (
              <div style={{ border: "1px solid #a7f3d0", borderRadius: 12, padding: 12, background: "#ecfdf5" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#065f46" }}>✓ Approved • อนุมัติแล้ว</div>
                <div style={{ fontSize: 11, color: "#065f46", marginTop: 4 }}>
                  Cost {project.estimate.cost.toFixed(2)} USD • {project.estimate.minutes} min • {project.executionMode} • Tools: {project.estimate.tools.join(", ")}
                  {project.estimate.actualCost ? ` • ใช้จริง $${project.estimate.actualCost.toFixed(2)}` : ""}
                </div>
                {executing && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>กำลังทำงาน… ความคืบหน้า {project.progress}% — หยุด/พักได้</div>}
              </div>
            )}
          </div>

          {activeTab === "overview" && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              <StepsPanel steps={steps} status={project.status} onPause={() => setProject(p => ({ ...p, status: "paused" }))} onResume={() => setProject(p => ({ ...p, status: "in_progress" }))} />
            </div>
          )}
          {activeTab === "files" && <div style={{ marginTop: 12 }}><FileTree files={files} /></div>}
          {activeTab === "preview" && <div style={{ marginTop: 12 }}><PreviewPane kind={project.kind} /></div>}
          {activeTab === "versions" && <div style={{ marginTop: 12 }}><VersionDiff versions={[{ id: "v1", label: "v1 — initial", date: "31 Oct 11:20" }, { id: "v2", label: "v2 — feedback applied", date: "31 Oct 13:05" }]} current="v2" /></div>}
          {activeTab === "verification" && <div style={{ marginTop: 12 }}><VerificationReportView report={report} /></div>}
        </div>

        <div style={{ flex: "1 1 380px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PreviewPane kind={project.kind} />
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#fff" }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>Deliverables • ผลงานส่งมอบ</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>ไฟล์ที่เปิดใช้/แก้ไขต่อได้จริง — พร้อม verification report</div>
            <div style={{ marginTop: 10 }}><DeliverableCards items={deliverables} taskId={project.id} /></div>
            {deliverables.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={{ fontSize: 11, padding: "7px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer" }}>ส่งกลับ Teammate →</button>
                <button style={{ fontSize: 11, padding: "7px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>ดาวน์โหลดทั้งหมด (ZIP)</button>
              </div>
            )}
          </div>
          {report && <VerificationReportView report={report} />}
          <FeedbackPanel onSend={(msg) => { setFeedbackLog(log => [...log, msg]); setProject(p => ({ ...p, status: "in_progress", progress: Math.max(40, p.progress - 6) })); }} />
          {feedbackLog.length > 0 && (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#fff" }}>
              <div style={{ fontSize: 11, fontWeight: 700 }}>Feedback history</div>
              {feedbackLog.map((f, i) => <div key={i} style={{ fontSize: 11, color: "#374151", background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: "6px 8px", marginTop: 6 }}>“{f}” — Work จะแก้ไขเฉพาะส่วนและสร้างเวอร์ชันใหม่</div>)}
            </div>
          )}
          <FileTree files={files} />
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#f9fafb" }}>
            <div style={{ fontSize: 11, fontWeight: 700 }}>Definition of Done — งานเสร็จเมื่อ</div>
            <ul style={{ fontSize: 11, color: "#374151", margin: "6px 0 0", paddingLeft: 16 }}>
              <li>ผลลัพธ์ตรงเป้าหมายที่ตกลง</li>
              <li>Deliverables ครบ + เปิดไฟล์ได้</li>
              <li>ผ่าน verification ตามประเภทงาน</li>
              <li>มีหลักฐาน/ข้อจำกัดแจ้งชัดเจน</li>
              <li>ผู้ใช้ตรวจและขอแก้ไขได้</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
