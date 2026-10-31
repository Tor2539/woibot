"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Monitor,
  Terminal,
  Power,
  Pause,
  Play,
  RefreshCw,
  MousePointerClick,
  Keyboard,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Bot,
} from "lucide-react";

/**
 * Cloud Computer control center — REAL data only.
 * - Status/resources: /api/computer (manager on the private VPC)
 * - Live screen: /api/computer?action=screen&raw=1 (JPEG straight from :99)
 * - Interactive mouse/keyboard: /api/computer POST {action:"input"} → xdotool
 * - Shell: /api/computer POST {action:"exec"}
 * No simulated logs, no fake metrics: every panel renders what the API
 * returned, or an explicit empty/error state.
 */

type ComputerStatus = {
  configured: boolean;
  status: "running" | "paused" | "absent" | "error" | "simulated";
  name?: string;
  port?: number;
  vncPath?: string;
  detail?: string;
};

type Stats = {
  ok: boolean;
  cpuPercent: number | null;
  memUsedMb: number | null;
  memTotalMb: number | null;
  diskUsed: string | null;
  diskTotal: string | null;
  uptime: string | null;
};

type TermLine = { text: string; cls: "cmd" | "out" | "err" };

const KEY_BUTTONS: { label: string; key: string; wide?: boolean }[] = [
  { label: "Enter", key: "Return" },
  { label: "Tab", key: "Tab" },
  { label: "Esc", key: "Escape" },
  { label: "Space", key: "space" },
  { label: "Backspace", key: "BackSpace" },
  { label: "Del", key: "Delete" },
  { label: "↑", key: "Up" },
  { label: "↓", key: "Down" },
  { label: "←", key: "Left" },
  { label: "→", key: "Right" },
  { label: "Ctrl+L", key: "ctrl+l" },
  { label: "Ctrl+T", key: "ctrl+t" },
  { label: "Ctrl+W", key: "ctrl+w" },
  { label: "Ctrl+C", key: "ctrl+c" },
  { label: "Ctrl+V", key: "ctrl+v" },
  { label: "F5", key: "F5" },
];

export default function CloudComputerPage() {
  /* -- server state (all real) ------------------------------------------- */
  const [status, setStatus] = useState<ComputerStatus | null>(null);
  const [origin, setOrigin] = useState<string>("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [geom, setGeom] = useState<{ width: number; height: number } | null>(null);
  const [ensureBusy, setEnsureBusy] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  /* -- screen / control --------------------------------------------------- */
  const [screenTick, setScreenTick] = useState(() => Date.now());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [interactive, setInteractive] = useState(false);
  const [ctrlBusy, setCtrlBusy] = useState<string | null>(null);
  const [ctrlMsg, setCtrlMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  /* -- keyboard input ----------------------------------------------------- */
  const [typeText, setTypeText] = useState("");
  const [pressEnter, setPressEnter] = useState(false);

  /* -- shell -------------------------------------------------------------- */
  const [cmdInput, setCmdInput] = useState("");
  const [execBusy, setExecBusy] = useState(false);
  const [termLogs, setTermLogs] = useState<TermLine[]>([]);

  /* -- computer-use agent ------------------------------------------------- */
  const [useGoal, setUseGoal] = useState("");
  const [useBusy, setUseBusy] = useState(false);
  const [useSteps, setUseSteps] = useState<{ n: number; action: string; target?: string; note: string; ok: boolean; ms: number }[]>([]);
  const [useSummary, setUseSummary] = useState<{ ok: boolean; text: string } | null>(null);

  const runUse = async () => {
    const goal = useGoal.trim();
    if (!goal || useBusy || !running) return;
    setUseBusy(true);
    setUseSteps([]);
    setUseSummary(null);
    try {
      const res = await fetch("/api/computer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "use", goal, maxSteps: 6 }),
      });
      const j = await res.json();
      setUseSteps(Array.isArray(j.steps) ? j.steps : []);
      setUseSummary({ ok: Boolean(j.ok), text: j.ok ? j.summary || "สำเร็จ" : j.error || "ไม่สำเร็จ" });
      setScreenTick(Date.now());
    } catch (e) {
      setUseSummary({ ok: false, text: e instanceof Error ? e.message : "เรียก API ไม่สำเร็จ" });
    } finally {
      setUseBusy(false);
    }
  };

  /* -- noVNC -------------------------------------------------------------- */
  const [showNovnc, setShowNovnc] = useState(false);

  const running = status?.status === "running";
  const termRef = useRef<HTMLDivElement | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/computer", { cache: "no-store" });
      const j = await res.json();
      setOrigin(String(j.origin || ""));
      setStatus(j.computer ?? null);
    } catch {
      setStatus({ configured: false, status: "error", detail: "เรียก API ไม่สำเร็จ" });
    }
  }, []);

  const loadStats = useCallback(async () => {
    if (!running) return;
    try {
      const res = await fetch("/api/computer?action=stats", { cache: "no-store" });
      const j = await res.json();
      setStats(j.ok ? j : null);
    } catch {
      setStats(null);
    }
  }, [running]);

  const loadGeom = useCallback(async () => {
    if (!running) return;
    try {
      const res = await fetch("/api/computer?action=geom", { cache: "no-store" });
      const j = await res.json();
      if (j.ok) setGeom({ width: j.width, height: j.height });
    } catch {
      setGeom(null);
    }
  }, [running]);

  // A container that was just started needs a few seconds before Xvfb answers;
  // retry once so the first boot doesn't litter the console with 502s.
  useEffect(() => {
    if (!running) return;
    const t1 = setTimeout(() => { loadStats(); }, 5000);
    const t2 = setTimeout(() => { loadGeom(); }, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [running, loadStats, loadGeom]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (running) {
      loadStats();
      loadGeom();
    }
  }, [running, loadStats, loadGeom]);

  // Gentle auto-refresh of live resources while the page is open.
  useEffect(() => {
    if (!running || !autoRefresh) return;
    const id = setInterval(() => {
      loadStats();
      setScreenTick(Date.now());
    }, 8000);
    return () => clearInterval(id);
  }, [running, autoRefresh, loadStats]);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [termLogs]);

  /* -- actions ------------------------------------------------------------ */

  const handleEnsure = async () => {
    setEnsureBusy(true);
    setBootError(null);
    try {
      const res = await fetch("/api/computer?action=ensure", { cache: "no-store" });
      const j = await res.json();
      if (!j.ok) setBootError(String(j.computer?.detail || "เปิดคอมพิวเตอร์ไม่สำเร็จ"));
      await loadStatus();
    } catch (e) {
      setBootError(e instanceof Error ? e.message : "เปิดคอมพิวเตอร์ไม่สำเร็จ");
    } finally {
      setEnsureBusy(false);
    }
  };

  const handlePower = async (act: "pause" | "resume") => {
    setCtrlBusy(act);
    try {
      await fetch("/api/computer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: act }),
      });
      await loadStatus();
    } finally {
      setCtrlBusy(null);
    }
  };

  const sendInput = async (
    body: Record<string, unknown>,
    busyLabel: string,
  ): Promise<boolean> => {
    if (!running) return false;
    setCtrlBusy(busyLabel);
    try {
      const res = await fetch("/api/computer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "input", ...body }),
      });
      const j = await res.json();
      if (j.ok) {
        setCtrlMsg({ ok: true, text: `${j.label || "ส่งคำสั่ง"} · สำเร็จ` });
        setScreenTick(Date.now());
        return true;
      }
      setCtrlMsg({ ok: false, text: `${j.label || "ส่งคำสั่ง"} · ล้มเหลว: ${j.error || "unknown"}` });
      return false;
    } catch (e) {
      setCtrlMsg({ ok: false, text: e instanceof Error ? e.message : "ส่งคำสั่งล้มเหลว" });
      return false;
    } finally {
      setCtrlBusy(null);
    }
  };

  const screenPoint = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = imgRef.current;
    if (!img || !geom) return null;
    const rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = Math.round(((e.clientX - rect.left) / rect.width) * geom.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * geom.height);
    return {
      x: Math.max(0, Math.min(geom.width - 1, x)),
      y: Math.max(0, Math.min(geom.height - 1, y)),
    };
  };

  const onScreenClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!interactive) return;
    const p = screenPoint(e);
    if (!p) return;
    setLastPoint(p);
    await sendInput({ kind: "click", x: p.x, y: p.y }, "click");
  };

  const onScreenContext = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!interactive) return;
    e.preventDefault();
    const p = screenPoint(e);
    if (!p) return;
    setLastPoint(p);
    await sendInput({ kind: "click", x: p.x, y: p.y, button: 3 }, "right-click");
  };

  const sendType = async () => {
    if (!typeText) return;
    const ok = await sendInput({ kind: "type", text: typeText }, "type");
    if (ok && pressEnter) await sendInput({ kind: "key", key: "Return" }, "enter");
    if (ok) setTypeText("");
  };

  const runCmd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cmdInput.trim();
    if (!cmd || execBusy) return;
    setCmdInput("");
    setTermLogs((prev) => [...prev, { text: `woibot@cloud-vm:~/workspace$ ${cmd}`, cls: "cmd" }]);
    setExecBusy(true);
    try {
      const res = await fetch("/api/computer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "exec", cmd }),
      });
      const j = await res.json();
      const r = j.result || {};
      const out = String(r.stdout ?? "").trim();
      const err = String(r.stderr ?? "").trim();
      if (out) setTermLogs((prev) => [...prev, ...out.split("\n").map((t: string) => ({ text: t, cls: "out" as const }))]);
      if (err) setTermLogs((prev) => [...prev, ...err.split("\n").map((t: string) => ({ text: t, cls: "err" as const }))]);
      if (!out && !err) {
        setTermLogs((prev) => [
          ...prev,
          j.ok
            ? { text: "(ไม่มี output)", cls: "out" as const }
            : { text: `ล้มเหลว: ${j.error || "exec error"}`, cls: "err" as const },
        ]);
      }
    } catch (err2) {
      setTermLogs((prev) => [
        ...prev,
        { text: `เรียก API ไม่สำเร็จ: ${err2 instanceof Error ? err2.message : "unknown"}`, cls: "err" },
      ]);
    } finally {
      setExecBusy(false);
      setScreenTick(Date.now());
    }
  };

  /* -- derived ------------------------------------------------------------ */
  const statusBadge = () => {
    if (!status) return { text: "กำลังโหลด…", color: "text-[#8f929a]" };
    if (status.status === "running") return { text: "กำลังทำงาน", color: "text-emerald-400" };
    if (status.status === "paused") return { text: "หยุดชั่วคราว", color: "text-amber-400" };
    if (status.status === "absent") return { text: "ยังไม่ถูกสร้าง", color: "text-[#8f929a]" };
    return { text: `ผิดพลาด: ${status.detail || "unknown"}`, color: "text-red-400" };
  };
  const badge = statusBadge();
  const vncUrl = status?.vncPath && origin ? `${origin}${status.vncPath}` : null;
  const centerPoint = lastPoint ?? { x: geom ? Math.round(geom.width / 2) : 960, y: geom ? Math.round(geom.height / 2) : 540 };

  /* -- render ------------------------------------------------------------- */
  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-bold">Cloud Computer (จอ :99 · แยก Container ต่อบัญชี)</h1>
            <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold ${badge.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-emerald-400 animate-pulse" : "bg-current"}`} />
              {badge.text}
            </span>
          </div>
          <p className="text-[12.5px] text-[var(--wb-muted)]">
            {status?.name ? `Container: ${status.name}` : "สถานะ: รอการเรียก API"}
            {" · "}ควบคุมเมาส์/คีย์บอร์ดจริงผ่าน xdotool
            {geom ? ` · ความละเอียดจริง ${geom.width}×${geom.height}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleEnsure}
            disabled={ensureBusy}
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#2b66e0] px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-[#2458c6] disabled:opacity-60"
          >
            {ensureBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
            {running ? "Restart / Ensure" : "เปิดคอมพิวเตอร์"}
          </button>
          <button
            type="button"
            onClick={() => handlePower(running ? "pause" : "resume")}
            disabled={!status || ctrlBusy !== null}
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--wb-raised)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--wb-fg)] border border-[var(--wb-line)] disabled:opacity-60"
          >
            {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {running ? "Pause" : "Resume"}
          </button>
        </div>
      </div>

      {bootError && (
        <div className="flex items-start gap-2 rounded-[10px] border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-[12.5px] text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{bootError}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        {/* left column: screen + control */}
        <div className="space-y-4">
          <div
            className="overflow-hidden rounded-[12px]"
            style={{ backgroundColor: "#090a0f", border: "1px solid var(--wb-line-strong)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#13151f] px-4 py-2 text-[11.5px] text-[#8f929a] border-b border-[#25262c]">
              <span className="font-mono">
                DISPLAY=:99 · {interactive ? "INTERACTIVE (คลิก/พิมพ์จริง)" : "ดูอย่างเดียว"}
              </span>
              <span className="flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                  รีเฟรชอัตโนมัติ
                </label>
                <button
                  type="button"
                  onClick={() => setScreenTick(Date.now())}
                  className="inline-flex items-center gap-1 rounded bg-[#1d2029] px-2 py-1 hover:bg-[#252a36]"
                >
                  <RefreshCw className="h-3 w-3" /> รีเฟรช
                </button>
              </span>
            </div>

            <div className="p-4 space-y-3">
              {running ? (
                <>
                  <img
                    ref={imgRef}
                    key={screenTick}
                    src={`/api/computer?action=screen&raw=1&t=${screenTick}`}
                    alt="หน้าจอ Cloud Computer สด"
                    onClick={onScreenClick}
                    onContextMenu={onScreenContext}
                    className={`w-full rounded-lg border border-[#252838] bg-black ${interactive ? "cursor-crosshair" : "cursor-default"}`}
                    draggable={false}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-[var(--wb-fg)]">
                      <input type="checkbox" checked={interactive} onChange={(e) => setInteractive(e.target.checked)} />
                      <span className="inline-flex items-center gap-1">
                        <MousePointerClick className="h-3.5 w-3.5" />
                        Take Over: คลิกซ้าย = คลิกจริง · คลิกขวา = คลิกขวาจริง (ส่งพิกัดจริง {geom ? `${geom.width}×${geom.height}` : "…"})
                      </span>
                    </label>
                    <span className="text-[var(--wb-muted)]">
                      {ctrlMsg ? (
                        <span className={ctrlMsg.ok ? "text-emerald-400" : "text-red-400"}>
                          {ctrlMsg.ok ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> : <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />}
                          {ctrlMsg.text}
                        </span>
                      ) : (
                        `คลิกล่าสุด: ${lastPoint ? `${lastPoint.x},${lastPoint.y}` : "ยังไม่มี"}`
                      )}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#252838] text-center">
                  <Monitor className="h-8 w-8 text-[#3a3f4b]" />
                  <div className="text-[13px] text-[var(--wb-fg)]">ยังไม่มีหน้าจอให้แสดง</div>
                  <div className="max-w-[380px] text-[12px] text-[var(--wb-muted)]">
                    {!status
                      ? "กำลังตรวจสถานะคอมพิวเตอร์… (โหลดจาก API จริง)"
                      : status.configured
                        ? "คอมพิวเตอร์ไม่ได้ทำงานอยู่ — กด “เปิดคอมพิวเตอร์” เพื่อสร้าง/เริ่ม container ของคุณก่อน"
                        : "ระบบยังไม่เชื่อมต่อ Computer Manager (ต้องตั้งค่า MANAGER_URL) — หน้านี้จะแสดงข้อมูลจริงเท่านั้น"}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* interactive control panel */}
          {running && (
            <div
              className="rounded-[12px] p-4 space-y-3"
              style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
            >
              <div className="flex items-center justify-between">
                <div className="text-[13.5px] font-semibold inline-flex items-center gap-1.5">
                  <Keyboard className="h-4 w-4" /> คีย์บอร์ด & สกรอลล์ (ควบคุมจริง)
                </div>
                <span className="text-[11px] text-[var(--wb-muted)]">
                  จุดคลิกอ้างอิง: {centerPoint.x},{centerPoint.y}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {KEY_BUTTONS.map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    disabled={ctrlBusy !== null}
                    onClick={() => sendInput({ kind: "key", key: k.key }, k.key)}
                    className="rounded-[6px] bg-[var(--wb-panel)] border border-[var(--wb-line)] px-2 py-1.5 text-[11.5px] font-mono hover:bg-[var(--wb-hover)] disabled:opacity-50"
                  >
                    {k.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex overflow-hidden rounded-[8px] border border-[var(--wb-line)]">
                  <button
                    type="button"
                    disabled={ctrlBusy !== null}
                    onClick={() => sendInput({ kind: "scroll", x: centerPoint.x, y: centerPoint.y, dy: -300 }, "scroll-up")}
                    className="inline-flex items-center gap-1 bg-[var(--wb-panel)] px-3 py-2 text-[12px] hover:bg-[var(--wb-hover)] disabled:opacity-50"
                  >
                    <ArrowUp className="h-3.5 w-3.5" /> สกรอลล์ขึ้น
                  </button>
                  <button
                    type="button"
                    disabled={ctrlBusy !== null}
                    onClick={() => sendInput({ kind: "scroll", x: centerPoint.x, y: centerPoint.y, dy: 300 }, "scroll-down")}
                    className="inline-flex items-center gap-1 border-l border-[var(--wb-line)] bg-[var(--wb-panel)] px-3 py-2 text-[12px] hover:bg-[var(--wb-hover)] disabled:opacity-50"
                  >
                    <ArrowDown className="h-3.5 w-3.5" /> สกรอลล์ลง
                  </button>
                </div>
                <button
                  type="button"
                  disabled={ctrlBusy !== null}
                  onClick={() => sendInput({ kind: "click", x: centerPoint.x, y: centerPoint.y, dbl: true }, "dblclick")}
                  className="rounded-[8px] bg-[var(--wb-panel)] border border-[var(--wb-line)] px-3 py-2 text-[12px] hover:bg-[var(--wb-hover)] disabled:opacity-50"
                >
                  ดับเบิลคลิกตรงจุดล่าสุด
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendType();
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  type="text"
                  value={typeText}
                  onChange={(e) => setTypeText(e.target.value)}
                  placeholder="พิมพ์ข้อความที่จะส่งเข้าหน้าจอ (ไปยังช่องที่คลิกไว้)…"
                  className="min-w-[200px] flex-1 rounded-[8px] bg-[var(--wb-panel)] border border-[var(--wb-line)] px-3 py-2 text-[12.5px] text-[var(--wb-fg)] focus:outline-none"
                />
                <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-[var(--wb-muted)]">
                  <input type="checkbox" checked={pressEnter} onChange={(e) => setPressEnter(e.target.checked)} />
                  กด Enter ต่อ
                </label>
                <button
                  type="submit"
                  disabled={ctrlBusy !== null || !typeText}
                  className="rounded-[8px] bg-[#2b66e0] px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-[#2458c6] disabled:opacity-60"
                >
                  พิมพ์ลงจอ
                </button>
              </form>
              <p className="text-[11px] text-[var(--wb-muted)]">
                เวลาตอบสนอง ~1–3 วิ (ผ่าน xdotool ใน container) — ภาพจะรีเฟรชหลังคำสั่งสำเร็จ
              </p>
            </div>
          )}

          {/* computer-use agent panel */}
          {running && (
            <div
              className="rounded-[12px] p-4 space-y-3"
              style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
            >
              <div className="text-[13.5px] font-semibold inline-flex items-center gap-1.5">
                <Bot className="h-4 w-4" /> AI คุมคอมให้ (Computer-Use Agent)
              </div>
              <div className="text-[11.5px] text-[var(--wb-muted)]">
                พิมพ์เป้าหมายเป็นภาษาไทยหรืออังกฤษ — AI จะมองหน้าจอจริง ขยับเมาส์ คลิก พิมพ์ ทีละก้าว (เห็นจุดฟ้ากะพริบบนจอ) แล้วรายงานผลทุกก้าว
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runUse();
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  type="text"
                  value={useGoal}
                  onChange={(e) => setUseGoal(e.target.value)}
                  placeholder='เช่น "เปิด Chromium แล้วไปที่ wikipedia.org ค้นคำว่า artificial intelligence"'
                  className="min-w-[220px] flex-1 rounded-[8px] bg-[var(--wb-panel)] border border-[var(--wb-line)] px-3 py-2 text-[12.5px] text-[var(--wb-fg)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={useBusy || !useGoal.trim()}
                  className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#2b66e0] px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-[#2458c6] disabled:opacity-60"
                >
                  {useBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                  ให้ AI ลงมือ
                </button>
              </form>
              {(useSteps.length > 0 || useBusy) && (
                <div className="max-h-[220px] space-y-1 overflow-y-auto rounded-lg bg-[#07080c] border border-[#1e202b] p-3 font-mono text-[11.5px]">
                  {useSteps.map((s, i) => (
                    <div key={i} className={s.ok ? "text-[#a3a7b5]" : "text-red-400"}>
                      <span className="text-[#7cb0ff]">[{s.n}] {s.action}{s.target ? ` ${s.target}` : ""}</span>{" "}
                      {s.note} <span className="text-[#5a5e68]">({s.ms} ms)</span>
                    </div>
                  ))}
                  {useBusy && <div className="text-emerald-400">กำลังทำงาน… (มองภาพ → ตัดสินใจ → ขยับจริง)</div>}
                </div>
              )}
              {useSummary && (
                <div className={`text-[12px] ${useSummary.ok ? "text-emerald-400" : "text-red-400"}`}>
                  {useSummary.ok ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> : <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />}
                  {useSummary.text}
                </div>
              )}
            </div>
          )}

          {/* real shell */}
          <div
            className="rounded-[12px] overflow-hidden"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
          >
            <div className="flex items-center gap-2 border-b border-[var(--wb-line)] px-4 py-2 text-[12.5px] font-semibold">
              <Terminal className="h-4 w-4" /> Terminal (exec จริงใน container)
            </div>
            <div ref={termRef} className="max-h-[260px] overflow-y-auto bg-[#07080c] p-3.5 font-mono text-[12px] space-y-1">
              {termLogs.length === 0 ? (
                <div className="text-[#5a5e68]">ยังไม่มีคำสั่ง — พิมพ์คำสั่งด้านล่างเพื่อรันใน Cloud Computer ของคุณ</div>
              ) : (
                termLogs.map((ln, idx) => (
                  <div key={idx} className={ln.cls === "cmd" ? "text-[#7cb0ff]" : ln.cls === "err" ? "text-red-400" : "text-[#a3a7b5]"}>
                    {ln.text}
                  </div>
                ))
              )}
            </div>
            <form onSubmit={runCmd} className="flex items-center gap-2 border-t border-[var(--wb-line)] bg-[#07080c] px-3.5 py-2.5">
              <span className="font-mono text-[12px] text-emerald-400">woibot@cloud-vm:~$</span>
              <input
                type="text"
                value={cmdInput}
                onChange={(e) => setCmdInput(e.target.value)}
                placeholder={running ? "เช่น ls -la workspace/" : "ต้องเปิดคอมพิวเตอร์ก่อน"}
                disabled={!running || execBusy}
                className="flex-1 bg-transparent font-mono text-[12px] text-white focus:outline-none disabled:opacity-50"
              />
              {execBusy && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8f929a]" />}
            </form>
          </div>
        </div>

        {/* right column: real resources + noVNC */}
        <div className="space-y-3">
          <div
            className="rounded-[12px] p-4 space-y-3"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
          >
            <div className="text-[13.5px] font-semibold">ทรัพยากรจริงของ Container</div>
            {!running ? (
              <div className="text-[12px] text-[var(--wb-muted)]">— เปิดคอมพิวเตอร์เพื่อดูข้อมูลจริง —</div>
            ) : stats ? (
              <div className="space-y-2.5 text-[12px] tabular-nums">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[var(--wb-muted)]">CPU</span>
                    <span className="font-mono">{stats.cpuPercent != null ? `${stats.cpuPercent}%` : "ไม่ทราบ"}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--wb-panel)]">
                    <div className="h-full rounded-full bg-[#3b82f6]" style={{ width: `${Math.min(100, stats.cpuPercent ?? 0)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[var(--wb-muted)]">Memory</span>
                    <span className="font-mono">
                      {stats.memUsedMb != null && stats.memTotalMb != null
                        ? `${(stats.memUsedMb / 1024).toFixed(2)} / ${(stats.memTotalMb / 1024).toFixed(2)} GB`
                        : "ไม่ทราบ"}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--wb-panel)]">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${stats.memUsedMb && stats.memTotalMb ? Math.min(100, (stats.memUsedMb / stats.memTotalMb) * 100) : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[var(--wb-muted)]">Disk /home/woibot</span>
                    <span className="font-mono">{stats.diskUsed && stats.diskTotal ? `${stats.diskUsed} / ${stats.diskTotal}` : "ไม่ทราบ"}</span>
                  </div>
                </div>
                <div className="text-[11.5px] text-[var(--wb-muted)]">
                  {stats.uptime ? `รันมาแล้ว ${stats.uptime}` : ""}
                </div>
              </div>
            ) : (
              <div className="text-[12px] text-[var(--wb-muted)]">กำลังอ่านค่าจริงจาก container… (ถ้าไม่ขึ้น = อ่านค่าไม่สำเร็จ)</div>
            )}
          </div>

          <div
            className="rounded-[12px] p-4 space-y-2.5"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
          >
            <div className="text-[13.5px] font-semibold">noVNC (สตรีม VNC เต็มรูปแบบ)</div>
            {vncUrl ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowNovnc((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--wb-panel)] border border-[var(--wb-line)] px-3 py-2 text-[12px] hover:bg-[var(--wb-hover)]"
                >
                  {showNovnc ? "ปิด noVNC" : "ลองเปิด noVNC"}
                </button>
                <a
                  href={vncUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-[12px] text-[#7cb0ff] hover:underline"
                >
                  เปิดแท็บใหม่ <ExternalLink className="h-3 w-3" />
                </a>
                {showNovnc && (
                  <iframe
                    src={vncUrl}
                    title="noVNC"
                    className="h-[420px] w-full rounded-lg border border-[var(--wb-line)] bg-black"
                  />
                )}
                <div className="text-[11px] text-[var(--wb-muted)]">
                  หมายเหตุ: การส่ง VNC ผ่าน proxy ยังไม่เสถียรทุกรูปแบบ — หากจอดำ/ตัดการเชื่อมต่อ ให้ใช้การควบคุมผ่านภาพด้านบน (คลิก/พิมพ์จริง) แทนได้เสมอ
                </div>
              </>
            ) : (
              <div className="text-[12px] text-[var(--wb-muted)]">ยังไม่มี VNC endpoint (ต้องเปิดคอมพิวเตอร์ก่อน)</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}