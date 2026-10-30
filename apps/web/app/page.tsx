"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  Clapperboard,
  Layers,
  Monitor,
  Brain,
  Repeat2,
  ShieldCheck,
  Lock,
  Sun,
  Moon,
  Terminal,
  FileText,
  Sparkles,
} from "lucide-react";

export default function LandingPage() {
  const [previewMode, setPreviewMode] = useState<"teammate" | "work">("teammate");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    try {
      const t = document.documentElement.getAttribute("data-theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("woibot.theme", next);
    } catch {}
  };

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: "var(--wb-bg)", color: "var(--wb-fg)" }}>
      {/* Floating Header */}
      <header
        className="sticky top-0 z-40 backdrop-blur-xl"
        style={{ backgroundColor: "color-mix(in srgb, var(--wb-bg) 82%, transparent)", borderBottom: "1px solid var(--wb-line)" }}
      >
        <div className="mx-auto flex h-[60px] max-w-[1240px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#2b66e0] text-[13px] font-bold text-white shadow-sm">
                W
              </div>
              <span className="text-[15.5px] font-bold tracking-tight">
                woibot<span className="text-[#3b82f6]">.com</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-5 text-[13px] text-[var(--wb-muted)]">
              <Link href="/teammate" className="hover:text-[var(--wb-fg)] transition-colors">
                Teammate
              </Link>
              <Link href="/work?area=code" className="hover:text-[var(--wb-fg)] transition-colors">
                Work (Code · Video · Artifacts)
              </Link>
              <Link href="/computer" className="hover:text-[var(--wb-fg)] transition-colors">
                Cloud Computer
              </Link>
              <Link href="/tasks" className="hover:text-[var(--wb-fg)] transition-colors">
                Unified Tasks
              </Link>
              <a href="#pricing" className="hover:text-[var(--wb-fg)] transition-colors">
                Pricing & Cost Isolation
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-[7px] hover:bg-[var(--wb-hover)] text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
              style={{ border: "1px solid var(--wb-line)" }}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              href="/work?area=code"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-[8px] px-3.5 py-1.5 text-[13px] font-medium hover:bg-[var(--wb-hover)]"
              style={{ border: "1px solid var(--wb-line)", backgroundColor: "var(--wb-raised)" }}
            >
              <span>Work Studio</span>
            </Link>
            <Link
              href="/teammate"
              className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#2b66e0] hover:bg-[#2458c6] px-4 py-1.5 text-[13px] font-semibold text-white"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14)" }}
            >
              <span>Open App</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-[1240px] px-4 sm:px-6 py-10 sm:py-14 space-y-16">
        {/* Hero + Interactive Desktop Window Preview */}
        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-5">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11.5px] font-medium"
              style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>AI Personal Teammate (Cloud 24/7) + AI Workforce Studio</span>
            </div>

            <h1 className="text-[34px] sm:text-[44px] lg:text-[48px] font-bold leading-[1.08] tracking-[-0.025em]">
              Talk to your Teammate.{" "}
              <span className="text-[#3b82f6]">Let Work handle</span> the heavy lifting.
            </h1>

            <p className="max-w-[580px] text-[15px] leading-relaxed text-[var(--wb-muted)]">
              ผสานความสามารถของ <strong>AI Teammate</strong> ที่มี Cloud Computer ส่วนตัว, 2-Tier Memory, Connected Apps และ Routines เข้ากับ <strong>Work Studio (Code · Video · Artifacts)</strong> ที่ส่งมอบไฟล์จริงพร้อมรายงานตรวจสอบคุณภาพ (<span className="font-mono text-[var(--wb-fg)]">verification_report.json</span>)
            </p>

            {/* Core Loop Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
              {["1. สั่งงาน", "2. ลงมือทำ", "3. ตรวจสอบ (Verify)", "4. ส่งมอบไฟล์จริง", "5. แก้ไขทำงานต่อ"].map((step, i) => (
                <span
                  key={step}
                  className="rounded-[7px] px-2.5 py-1 font-medium"
                  style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                >
                  {step}
                </span>
              ))}
            </div>

            {/* Sanctioned Hero CTA Pair (stacks full-width on mobile, row on sm+) */}
            <div className="flex flex-col gap-3 sm:flex-row pt-1">
              <Link
                href="/teammate"
                className="inline-flex items-center justify-center gap-2 rounded-[9px] bg-[#2b66e0] hover:bg-[#2458c6] px-6 py-3 text-[14px] font-semibold text-white transition-all"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14)" }}
              >
                <span>Launch Teammate Workspace</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/work?area=artifacts"
                className="inline-flex items-center justify-center gap-2 rounded-[9px] px-6 py-3 text-[14px] font-semibold hover:bg-[var(--wb-hover)] transition-all"
                style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
              >
                <span>Explore Work & Artifacts Studio</span>
                <ArrowUpRight className="h-4 w-4 text-[#3b82f6]" />
              </Link>
            </div>

            {/* KPI Row (Tabular Numerals) */}
            <div className="grid grid-cols-3 gap-3 pt-2 tabular-nums">
              {[
                { label: "Cloud Computer", val: "24/7", sub: "Persistent Linux + CDP :9222" },
                { label: "Work Studio Areas", val: "Code · Video · Artifacts", sub: "Verified Deliverables" },
                { label: "Cost Isolation", val: "2 Ledgers", sub: "Subscription vs Work Meter" },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-[10px] p-3"
                  style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--wb-muted)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" />
                    <span>{k.label}</span>
                  </div>
                  <div className="mt-1 text-[15px] font-bold text-[var(--wb-fg)]">{k.val}</div>
                  <div className="mt-0.5 text-[10.5px] text-[var(--wb-muted)]">{k.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Interactive Unified Desktop Window Preview (Grok Bot + Claude Desktop Shell) */}
          <div
            className="overflow-hidden rounded-[14px] shadow-2xl"
            style={{ backgroundColor: "var(--wb-sidebar)", border: "1px solid var(--wb-line-strong)" }}
          >
            {/* Window Top Bar with Interactive [ Teammate | Work ] Switch */}
            <div
              className="flex items-center justify-between px-3.5 py-2.5"
              style={{ borderBottom: "1px solid var(--wb-line)", backgroundColor: "var(--wb-panel)" }}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#32343d]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#32343d]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#32343d]" />
              </div>

              <div className="wb-mode-tabs">
                <button
                  type="button"
                  onClick={() => setPreviewMode("teammate")}
                  className={`wb-mode-tab !h-[26px] !text-[12px] ${previewMode === "teammate" ? "is-active" : ""}`}
                >
                  <span>Teammate (Daily Cloud Assistant)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("work")}
                  className={`wb-mode-tab !h-[26px] !text-[12px] ${previewMode === "work" ? "is-active" : ""}`}
                >
                  <span>Work (Code · Video · Artifacts)</span>
                </button>
              </div>

              <span className="font-mono text-[10.5px] text-emerald-400">LIVE PREVIEW</span>
            </div>

            {previewMode === "teammate" ? (
              <div className="p-4 space-y-3" style={{ backgroundColor: "var(--wb-bg)" }}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-semibold">Woibot Main · Chief Personal Teammate</span>
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10.5px] text-emerald-400">
                    On its computer · :99
                  </span>
                </div>

                <div
                  className="rounded-[10px] p-3 space-y-1.5 text-[12px]"
                  style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                >
                  <div className="text-[11px] font-mono text-[var(--wb-muted)]">
                    Worked for 14s · Checked Gmail, Calendar, Memory ›
                  </div>
                  <div>
                    สรุป Briefing เช้านี้เรียบร้อยครับ — ร่างคำตอบให้คุณสมชาย (ACME Corp) ในโหมด <strong>Ask-first</strong> และส่งงานสร้างระบบ Sales CRM ต่อให้ <strong>woibot Work</strong> พร้อมใบประเมินราคา $2.40 แล้วครับ
                  </div>
                </div>

                <div
                  className="rounded-[10px] p-3 space-y-2"
                  style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
                >
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="font-semibold text-[#7cb0ff]">Handoff Packet → Work (CODING)</span>
                    <span className="font-mono tabular-nums">Est. $2.40 · ~18m</span>
                  </div>
                  <div className="text-[11.5px] text-[var(--wb-muted)]">
                    Enterprise Sales CRM + Playwright E2E Verification · Isolated Work Ledger
                  </div>
                  <div className="flex justify-end gap-2">
                    <Link
                      href="/teammate"
                      className="rounded-[6px] bg-[#2b66e0] px-3 py-1 text-[11.5px] font-medium text-white"
                    >
                      Try Live in Teammate →
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-3" style={{ backgroundColor: "var(--wb-bg)" }}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-semibold">Work Studio · Code | Video | Artifacts</span>
                  <span className="rounded bg-[#2b66e0]/20 px-2 py-0.5 text-[10.5px] text-[#7cb0ff]">
                    5/5 Verification Gates Passed
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11.5px]">
                  <Link
                    href="/work?area=code"
                    className="rounded-lg p-2.5 hover:border-[#3b82f6]"
                    style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                  >
                    <div className="font-semibold text-[#7cb0ff]">1. Code</div>
                    <div className="mt-0.5 text-[11px] text-[var(--wb-muted)]">
                      tsc + vitest + Playwright + Git Diff
                    </div>
                  </Link>
                  <Link
                    href="/work?area=video"
                    className="rounded-lg p-2.5 hover:border-[#3b82f6]"
                    style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                  >
                    <div className="font-semibold text-emerald-400">2. Video</div>
                    <div className="mt-0.5 text-[11px] text-[var(--wb-muted)]">
                      Storyboard + FFmpeg + TH/EN Subs
                    </div>
                  </Link>
                  <Link
                    href="/work?area=artifacts"
                    className="rounded-lg p-2.5 hover:border-[#3b82f6]"
                    style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
                  >
                    <div className="font-semibold text-amber-400">3. Artifacts</div>
                    <div className="mt-0.5 text-[11px] text-[var(--wb-muted)]">
                      Docs · Slides · Design · BI · 3D
                    </div>
                  </Link>
                </div>

                <div
                  className="rounded-[10px] p-3 font-mono text-[11px] space-y-1"
                  style={{ backgroundColor: "#090a0f", border: "1px solid var(--wb-line)", color: "#d2d3d8" }}
                >
                  <div className="text-emerald-400">✓ verification_report.json signed (trace_crm_9821a)</div>
                  <div>• typecheck: 0 errors | vitest: 14/14 passed | playwright: 1440px & 390px green</div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Product Architecture Split: Teammate vs Work */}
        <section className="grid gap-5 md:grid-cols-2">
          <div
            className="rounded-[14px] p-6 space-y-4"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
          >
            <div className="flex items-center justify-between">
              <span className="rounded bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 uppercase">
                Product A · Always-On Cloud
              </span>
              <span className="font-mono text-[12px] text-[var(--wb-muted)]">Cloud Only · 24/7</span>
            </div>
            <h2 className="text-[20px] font-bold">woibot Teammate — AI ที่คุณกลับมาหาทุกวัน</h2>
            <p className="text-[13.5px] text-[var(--wb-muted)] leading-relaxed">
              จุดแข็งอยู่ที่ความทรงจำระยะยาว (2-Tier Personal & Team Memory), การเชื่อมต่อแอปจริง, งานประจำอัตโนมัติ (Routines + Spend Guard) และคอมพิวเตอร์ส่วนตัวบนคลาวด์ที่เปิดดูหน้าจอสดหรือเข้าไป Take Over ได้ตลอดเวลา
            </p>
            <ul className="space-y-2 text-[13px] text-[var(--wb-fg-soft)]">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Roster of Specialist Bots + ห้องสนทนากลุ่ม (Executive Standup Room)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Interactive Cards: ร่างอีเมล (Ask-first), ขออนุมัติแบบลำดับขั้น และ 1Password Vault</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Teach-by-Demonstration: ทำขั้นตอนให้ดูบนจอ 1 ครั้ง บันทึกเป็น Routine ทันที</span>
              </li>
            </ul>
          </div>

          <div
            className="rounded-[14px] p-6 space-y-4"
            style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
          >
            <div className="flex items-center justify-between">
              <span className="rounded bg-[#2b66e0]/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#7cb0ff] uppercase">
                Product B · Heavy Execution
              </span>
              <span className="font-mono text-[12px] text-[var(--wb-muted)]">Cloud or Local</span>
            </div>
            <h2 className="text-[20px] font-bold">woibot Work — วัดคุณภาพจากผลงานที่ใช้ได้จริง</h2>
            <p className="text-[13.5px] text-[var(--wb-muted)] leading-relaxed">
              แยกพื้นที่ทำงานเป็น 3 สตูดิโอหลัก: <strong>Code</strong>, <strong>Video</strong> และ <strong>Artifacts (Docs · Slides · Design · Dashboard · 3D)</strong> พร้อมระบบตรวจสอบงานเฉพาะประเภท และใบประเมินราคาก่อนเริ่มงานเสมอ
            </p>
            <ul className="space-y-2 text-[13px] text-[var(--wb-fg-soft)]">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#3b82f6] shrink-0" />
                <span>Coding Verification: tsc + vitest + Playwright smoke + Unified Git Diff</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#3b82f6] shrink-0" />
                <span>Video Studio: Storyboard + FFmpeg + Whisper TH/EN Subtitles + Remotion Bundle</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#3b82f6] shrink-0" />
                <span>Artifacts Gallery + Designer Mode (Ask-First Brief) + Live In-Place Editor</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Pricing & Cost Isolation */}
        <section id="pricing" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-bold">Monetization & Strict Cost Isolation</h2>
              <p className="text-[13.5px] text-[var(--wb-muted)]">
                แยกสิทธิ์และการคิดต้นทุนตั้งแต่ระดับ Product Requirement — งานหนักใน Work ไม่กระทบความคุ้มค่าของ Teammate
              </p>
            </div>
            <Link
              href="/settings"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-[8px] px-4 py-2 text-[12.5px] font-semibold"
              style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line)" }}
            >
              <span>Configure Work Caps & Ledger</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3 tabular-nums">
            {[
              {
                tier: "Free Trial",
                price: "฿0",
                sub: "/ เดือน",
                desc: "1 AI Teammate · Ephemeral Cloud Computer (2h/day) · 3 Routines · 200K Tokens",
                cta: "Start Free",
                href: "/teammate",
                highlight: false,
              },
              {
                tier: "Starter Teammate",
                price: "฿399",
                sub: "/ เดือน",
                desc: "3 AI Teammates · Persistent Cloud Computer (1 vCPU / 2GB) · Unlimited Memory · 20 Routines",
                cta: "Launch Starter",
                href: "/teammate",
                highlight: false,
              },
              {
                tier: "Pro Teammate + Work Studio",
                price: "฿999",
                sub: "/ เดือน + Work Meter",
                desc: "10 AI Teammates · 2 vCPU / 4GB Persistent VM · Team Memory · 100 Routines · Full Work Studio Access",
                cta: "Open Pro Workspace",
                href: "/teammate",
                highlight: true,
              },
            ].map((p) => (
              <div
                key={p.tier}
                className="flex flex-col justify-between rounded-[14px] p-6 space-y-4"
                style={{
                  backgroundColor: "var(--wb-raised)",
                  border: p.highlight ? "1px solid #3b82f6" : "1px solid var(--wb-line)",
                }}
              >
                <div className="space-y-2">
                  <div className="text-[13px] font-semibold text-[#7cb0ff]">{p.tier}</div>
                  <div className="text-[28px] font-bold">
                    {p.price} <span className="text-[13px] font-normal text-[var(--wb-muted)]">{p.sub}</span>
                  </div>
                  <p className="text-[12.5px] text-[var(--wb-muted)] leading-relaxed">{p.desc}</p>
                </div>
                <Link
                  href={p.href}
                  className={`inline-flex items-center justify-center rounded-[8px] py-2.5 text-[13px] font-semibold transition-colors ${
                    p.highlight
                      ? "bg-[#2b66e0] hover:bg-[#2458c6] text-white"
                      : "bg-[var(--wb-panel)] hover:bg-[var(--wb-hover)] text-[var(--wb-fg)] border border-[var(--wb-line)]"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Sanctioned Page-End Centered CTA */}
        <section
          className="rounded-[16px] p-8 text-center space-y-4"
          style={{ backgroundColor: "var(--wb-raised)", border: "1px solid var(--wb-line-strong)" }}
        >
          <h2 className="text-[22px] font-bold">พร้อมใช้งานจริงตั้งแต่วันนี้บน woibot.com</h2>
          <p className="mx-auto max-w-[540px] text-[13.5px] text-[var(--wb-muted)]">
            เริ่มต้นสั่งงานผ่าน Teammate หรือเปิดโปรเจกต์ใน Work Studio (Code · Video · Artifacts) ได้ทันทีโดยไม่ต้องตั้งค่าซับซ้อน
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <Link
              href="/teammate"
              className="w-full max-w-xs sm:w-auto inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#2b66e0] hover:bg-[#2458c6] px-6 py-2.5 text-[13.5px] font-semibold text-white"
            >
              <span>Talk to your Teammate</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/work?area=code"
              className="w-full max-w-xs sm:w-auto inline-flex items-center justify-center gap-2 rounded-[8px] px-6 py-2.5 text-[13.5px] font-semibold hover:bg-[var(--wb-hover)]"
              style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
            >
              <span>Open Work Studio</span>
            </Link>
          </div>
        </section>
      </main>

      {/* Single-Level Balanced Footer */}
      <footer
        className="mt-12 py-10 text-[12.5px] text-[var(--wb-muted)]"
        style={{ borderTop: "1px solid var(--wb-line)", backgroundColor: "var(--wb-sidebar)" }}
      >
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-2">
            <div className="text-[14px] font-bold text-[var(--wb-fg)]">
              woibot<span className="text-[#3b82f6]">.com</span>
            </div>
            <p className="text-[12px] leading-relaxed">
              Your Personal AI Team That Actually Gets Work Done.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--wb-muted)]">Teammate</div>
            <ul className="space-y-1.5">
              <li><Link href="/teammate" className="hover:text-[var(--wb-fg)]">Conversational Workspace</Link></li>
              <li><Link href="/computer" className="hover:text-[var(--wb-fg)]">Cloud Computer (noVNC :99)</Link></li>
              <li><Link href="/routines" className="hover:text-[var(--wb-fg)]">Routines & Spend Guard</Link></li>
              <li><Link href="/apps" className="hover:text-[var(--wb-fg)]">Connected Apps & Vault</Link></li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--wb-muted)]">Work Studio</div>
            <ul className="space-y-1.5">
              <li><Link href="/work?area=code" className="hover:text-[var(--wb-fg)]">Autonomous Coding</Link></li>
              <li><Link href="/work?area=video" className="hover:text-[var(--wb-fg)]">Video Production & Subs</Link></li>
              <li><Link href="/work?area=artifacts" className="hover:text-[var(--wb-fg)]">Artifacts & Designer Mode</Link></li>
              <li><Link href="/tasks" className="hover:text-[var(--wb-fg)]">Unified Tasks (10 States)</Link></li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--wb-muted)]">Governance</div>
            <ul className="space-y-1.5">
              <li><Link href="/settings" className="hover:text-[var(--wb-fg)]">Cost Isolation & Quotas</Link></li>
              <li><Link href="/files" className="hover:text-[var(--wb-fg)]">Verified Deliverables</Link></li>
              <li><Link href="/team" className="hover:text-[var(--wb-fg)]">AI Teammates Roster</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
