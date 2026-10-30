"use client";

import React, { useState, useEffect } from "react";
import { Blocks, Lock, ShieldCheck, Globe, Plus, CheckCircle2 } from "lucide-react";

const CATALOG_META: Record<string, { label: string; category: string; desc: string }> = {
  gmail: { label: "Gmail & Google Workspace", category: "Email", desc: "อ่าน สรุป และร่างตอบอีเมลสำคัญภายใต้โหมด Ask-first" },
  calendar: { label: "Google Calendar", category: "Calendar", desc: "ตรวจสอบตารางนัดหมาย แจ้งเตือนความขัดแย้ง และเตรียมวาระประชุม" },
  slack: { label: "Slack Workspace Bot", category: "Communication", desc: "รับคำสั่งผ่าน @woibot ในห้องแชทและส่งสรุปความคืบหน้า" },
  github: { label: "GitHub Repositories & PRs", category: "Development", desc: "เชื่อมต่อ Repository สำหรับ Work (Code) เพื่อเปิด PR และรัน Verification" },
  drive: { label: "Google Drive", category: "Storage", desc: "อ่านเอกสารต้นฉบับและซิงค์ Deliverables ที่ตรวจผ่านแล้ว" },
  notion: { label: "Notion Knowledge Base", category: "Productivity", desc: "เชื่อมฐานความรู้ทีมและบันทึกสรุปการประชุม" },
  linear: { label: "Linear Issue Tracker", category: "Project Mgmt", desc: "ซิงค์ตั๋วงานกับศูนย์ Unified Tasks อัตโนมัติ" },
  onepassword: { label: "1Password Service Vault", category: "Security Vault", desc: "กรอกรหัสผ่านอัตโนมัติบนเบราว์เซอร์ Cloud Computer โดยไม่เปิดเผยค่าให้โมเดลเห็น" },
};

export default function ConnectedAppsVaultPage() {
  const [apps, setApps] = useState<any[]>([]);
  const [secrets, setSecrets] = useState<any[]>([]);
  const [secName, setSecName] = useState("");
  const [secHost, setSecHost] = useState("*.acmecorp.co.th");
  const [secVal, setSecVal] = useState("");

  const loadData = () => {
    fetch("/api/connected-apps")
      .then((r) => r.json())
      .then((res) => {
        setApps(res?.apps || []);
        setSecrets(res?.secrets || []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleApp = async (app: any) => {
    await fetch("/api/connected-apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: app.id, provider: app.provider }),
    });
    loadData();
  };

  const handleAddSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secName.trim() || !secVal.trim()) return;
    await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isVaultSecret: true,
        key: secName.trim().toUpperCase(),
        hostAllowlist: secHost.trim(),
        value: secVal,
      }),
    });
    setSecName("");
    setSecVal("");
    loadData();
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-[18px] font-bold">Connected Apps, 1Password Bridge & Logins Vault</h1>
        <p className="text-[12.5px] text-[var(--wb-muted)]">
          ควบคุมสิทธิ์ Read/Write รายบริการ และเก็บรหัสผ่านแบบ Write-Only (AI กรอกใช้งานได้บน Host ที่อนุญาตโดยไม่เห็นรหัสจริง)
        </p>
      </div>

      {/* Connected OAuth Services Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {apps.map((app) => {
          const meta = CATALOG_META[app.provider] || {
            label: app.provider,
            category: "Integration",
            desc: "Connected service",
          };
          const connected = app.status === "connected";
          return (
            <div
              key={app.id}
              className="flex flex-col justify-between rounded-[12px] p-4 space-y-3"
              style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[var(--wb-panel)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--wb-muted)]">
                    {meta.category}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase ${
                      connected ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                    }`}
                  >
                    {connected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <div className="text-[14px] font-semibold">{meta.label}</div>
                <p className="text-[11.5px] text-[var(--wb-muted)] leading-relaxed">{meta.desc}</p>
              </div>

              <div className="pt-2 space-y-2" style={{ borderTop: "1px solid var(--wb-line)" }}>
                <div className="truncate font-mono text-[11px] text-[var(--wb-muted)]">
                  Account: {app.account || "Not linked"}
                </div>
                <button
                  type="button"
                  onClick={() => toggleApp(app)}
                  className={`w-full rounded-[7px] py-1.5 text-[12px] font-medium transition-colors ${
                    connected
                      ? "bg-[var(--wb-panel)] border border-[var(--wb-line)] text-[var(--wb-fg-soft)] hover:text-red-400"
                      : "bg-[#2b66e0] text-white hover:bg-[#2458c6]"
                  }`}
                >
                  {connected ? "Revoke Access" : "Authorize OAuth"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Secure Vault Logins & Secrets Section (Grok Bot §2.5) */}
      <div
        className="rounded-[12px] p-5 space-y-4"
        style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-400" />
              <h2 className="text-[15px] font-semibold">Woibot Zero-Knowledge Secrets & Browser Autofill Vault</h2>
            </div>
            <p className="text-[12px] text-[var(--wb-muted)]">
              Never shown to your Bot or teammates. Only injected/autofilled inside the Cloud Computer on matching host allowlists.
            </p>
          </div>
        </div>

        <form onSubmit={handleAddSecret} className="grid gap-2.5 sm:grid-cols-4">
          <input
            type="text"
            value={secName}
            onChange={(e) => setSecName(e.target.value)}
            placeholder="SECRET_NAME (e.g. STRIPE_LIVE_KEY)"
            className="rounded-[8px] px-3 py-2 font-mono text-[12px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
          />
          <input
            type="text"
            value={secHost}
            onChange={(e) => setSecHost(e.target.value)}
            placeholder="Allowed Host (*.stripe.com)"
            className="rounded-[8px] px-3 py-2 font-mono text-[12px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
          />
          <input
            type="password"
            value={secVal}
            onChange={(e) => setSecVal(e.target.value)}
            placeholder="Secret / Password Value..."
            className="rounded-[8px] px-3 py-2 text-[12px] bg-[var(--wb-panel)] border border-[var(--wb-line)]"
          />
          <button
            type="submit"
            className="rounded-[8px] bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-[12.5px] font-semibold text-white"
          >
            + Store in Vault
          </button>
        </form>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {secrets.map((sec) => (
            <div
              key={sec.id}
              className="flex items-center justify-between rounded-[9px] px-3.5 py-2.5"
              style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
            >
              <div>
                <div className="font-mono text-[12.5px] font-semibold text-[#7cb0ff]">{sec.name}</div>
                <div className="font-mono text-[11px] text-[var(--wb-muted)]">
                  Allowed Host: {sec.hostAllowlist} · {sec.maskedValue}
                </div>
              </div>
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-medium text-emerald-400">
                Write-Only
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
