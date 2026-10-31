"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Code2,
  Clapperboard,
  Layers,
  CheckSquare,
  FolderOpen,
  Monitor,
  Repeat2,
  Blocks,
  Users2,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Plus,
  Sun,
  Moon,
  Globe,
  ShieldCheck,
  Terminal,
  Laptop,
  Cloud,
  ChevronRight,
  Command,
  X,
  Menu,
  ArrowUpRight,
} from "lucide-react";

export type Lang = "th" | "en";
export type ProductMode = "teammate" | "work";
export type WorkAreaTab = "code" | "video" | "artifacts";

function TeammateGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4.5h9a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H8l-4 3v-3a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z" />
      <circle cx="15.5" cy="4.5" r="2.6" fill="#2d79d8" stroke="#2d79d8" />
    </svg>
  );
}

function WorkGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6.5 5-5 5 5 5M13.5 5l5 5-5 5M11.5 3l-3 14" />
    </svg>
  );
}

export const ROSTER_BOTS = [
  { id: "tm_main", name: "Woibot Main", role: "Chief Teammate", status: "On its computer · :99", dot: "#34d399", badge: "MAIN" },
  { id: "tm_exec", name: "Exec Chief", role: "Calendar & Briefing", status: "Checking calendar", dot: "#3b82f6" },
  { id: "tm_inbox", name: "Inbox Triage", role: "Gmail & Slack", status: "2 drafts ready", dot: "#f59e0b", unread: 2 },
  { id: "tm_ops", name: "Ops & Finance", role: "Invoice & KPI Audit", status: "Idle · Ready", dot: "#8f929a" },
  { id: "tm_research", name: "Research Scout", role: "Market & Competitor", status: "Browsing web", dot: "#3b82f6" },
  { id: "tm_room_standup", name: "Executive Standup", role: "Group Room · 3 Bots", status: "3 bots active", dot: "#10b981", isGroup: true },
];

export const WORK_JOBS_SIDEBAR = [
  { id: "tsk_crm_code", title: "Enterprise Sales CRM + Dashboard", kind: "code", origin: "teammate", status: "completed", cost: "$2.15", dot: "#34d399" },
  { id: "tsk_video_promo", title: "30s Launch Promo Video (3x Ratios)", kind: "video", origin: "work", status: "reviewing", cost: "$3.60", dot: "#3b82f6" },
  { id: "tsk_doc_q4", title: "Q4 Board Strategy Report & PPTX", kind: "artifacts", origin: "teammate", status: "waiting_for_user", cost: "$1.15", dot: "#f59e0b" },
  { id: "tsk_local_repo", title: "Local Repo CVE & Dependency Audit", kind: "code", origin: "work", status: "in_progress", cost: "$0.65", dot: "#3b82f6", isLocal: true },
];

export const TEAMMATE_NAV = [
  { href: "/teammate", icon: MessageSquare, label: { th: "Teammate Chat", en: "Teammate Chat" }, badge: "Live" },
  { href: "/tasks", icon: CheckSquare, label: { th: "Tasks & Approvals", en: "Tasks & Approvals" }, badge: "1" },
  { href: "/routines", icon: Repeat2, label: { th: "Routines (Cron/Events)", en: "Routines" } },
  { href: "/apps", icon: Blocks, label: { th: "Connected Apps & Vault", en: "Apps & Vault" }, badge: "8" },
  { href: "/computer", icon: Monitor, label: { th: "Cloud Computer (:99)", en: "Cloud Computer" } },
  { href: "/files", icon: FolderOpen, label: { th: "Files & Library", en: "Files & Library" } },
  { href: "/team", icon: Users2, label: { th: "Team Bots & Rooms", en: "Team Bots & Rooms" } },
  { href: "/settings", icon: Settings, label: { th: "Settings & Billing", en: "Settings & Billing" } },
];

export interface SidebarProps {
  lang?: Lang;
  onLangToggle?: () => void;
  collapsed?: boolean;
  onCollapseToggle?: () => void;
}

export function Sidebar({
  lang = "th",
  onLangToggle,
  collapsed = false,
  onCollapseToggle,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [dbBots, setDbBots] = useState<any[]>([]);
  const [dbComputer, setDbComputer] = useState<any>(null);
  const [dbJobs, setDbJobs] = useState<any[]>([]);

  const NAV_JOBS = (dbJobs.length ? dbJobs : WORK_JOBS_SIDEBAR).map((j: any) => ({
    id: j.id,
    title: j.title,
    kind: j.workKind || j.kind || "work",
    status: j.status,
    cost: j.estimate?.cost ? `$${Number(j.estimate.cost).toFixed(2)}` : j.cost || "—",
    origin: j.product === "work" ? "Work" : j.origin || "Work",
    dot: j.status === "completed" ? "#34d399" : j.status === "failed" ? "#ef4444" : j.status === "reviewing" ? "#3b82f6" : "#f59e0b",
    isLocal: j.executionMode === "local",
  }));

  const NAV_BOTS = dbBots.length
    ? dbBots.filter((b: any) => !b.isGroup).map((b: any) => ({
        id: b.id,
        name: b.name,
        role: b.role,
        status: b.isMain
          ? dbComputer?.status === "running"
            ? "Main · Cloud Computer running"
            : "Main · Idle"
          : "Idle · Ready",
        dot: b.isMain ? "#34d399" : "#8f929a",
        badge: b.isMain ? "MAIN" : undefined,
        unread: 0,
      }))
    : ROSTER_BOTS;


  const isWorkMode: ProductMode = pathname.startsWith("/work") ? "work" : "teammate";
  const currentArea = (searchParams.get("area") as WorkAreaTab) || "code";
  const activeBotId = searchParams.get("bot") || "tm_main";

  useEffect(() => {
    fetch("/api/teammate")
      .then((r) => r.json())
      .then((res) => setDbBots(res?.teammates || []))
      .catch(() => {});
    fetch("/api/computer")
      .then((r) => r.json())
      .then((res) => setDbComputer(res?.computer || null))
      .catch(() => {});
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((res) => {
        const list = res?.data?.tasks || res?.tasks || [];
        setDbJobs(list.filter((t: any) => t.product === "work").slice(0, 6));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const t = document.documentElement.getAttribute("data-theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setCmdOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("woibot.theme", next);
    } catch {}
  };

  const switchMode = (target: ProductMode) => {
    setMobileOpen(false);
    if (target === "work") {
      router.push("/work?area=code");
    } else {
      router.push("/teammate");
    }
  };

  const switchWorkArea = (area: WorkAreaTab) => {
    setMobileOpen(false);
    router.push(`/work?area=${area}`);
  };

  const commandItems = [
    { group: "Modes", label: "Switch to Teammate (Personal Assistant · Cloud 24/7)", action: () => switchMode("teammate") },
    { group: "Modes", label: "Switch to Work › Code (Autonomous Software Engineering)", action: () => switchWorkArea("code") },
    { group: "Modes", label: "Switch to Work › Video (Multi-Scene Video Studio)", action: () => switchWorkArea("video") },
    { group: "Modes", label: "Switch to Work › Artifacts (Claude Artifacts Gallery & Designer Mode)", action: () => switchWorkArea("artifacts") },
    ...NAV_BOTS.map((b) => ({
      group: "Teammates",
      label: `Chat with ${b.name} (${b.role}) — ${b.status}`,
      action: () => router.push(`/teammate?bot=${b.id}`),
    })),
    ...NAV_JOBS.map((j) => ({
      group: "Work Jobs",
      label: `Open Work Job: ${j.title} (${j.status})`,
      action: () => router.push(`/work/${j.id}`),
    })),
    { group: "Navigation", label: "Open Live Cloud Computer (noVNC :99)", action: () => router.push("/computer") },
    { group: "Navigation", label: "Manage Routines & Spend Guard", action: () => router.push("/routines") },
    { group: "Navigation", label: "Connected Apps & 1Password Vault", action: () => router.push("/apps") },
    { group: "Navigation", label: "Billing & Teammate/Work Cost Isolation", action: () => router.push("/settings") },
    { group: "Preferences", label: `Toggle Theme (${theme === "dark" ? "Switch to Light" : "Switch to Dark"})`, action: toggleTheme },
  ].filter((item) => item.label.toLowerCase().includes(cmdQuery.toLowerCase()));

  const renderSidebarBody = (isMobileDrawer = false) => {
    const isRail = collapsed && !isMobileDrawer;

    return (
      <div
        className="flex h-full flex-col select-none"
        style={{
          backgroundColor: "var(--wb-sidebar)",
          borderRight: "1px solid var(--wb-line)",
          color: "var(--wb-fg)",
        }}
      >
        {/* Top 48px Header: Collapse + [ Teammate | Work ] Segmented Switch */}
        <div
          className="flex h-[48px] shrink-0 items-center justify-between gap-1.5 px-2.5"
          style={{ borderBottom: "1px solid var(--wb-line)" }}
        >
          {!isRail ? (
            <>
              <div className="wb-mode-tabs flex-1" role="tablist" aria-label="Product modes">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isWorkMode === "teammate"}
                  onClick={() => switchMode("teammate")}
                  className={`wb-mode-tab flex-1 justify-center ${isWorkMode === "teammate" ? "is-active" : ""}`}
                >
                  <TeammateGlyph />
                  <span>Teammate</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isWorkMode === "work"}
                  onClick={() => switchMode("work")}
                  className={`wb-mode-tab flex-1 justify-center ${isWorkMode === "work" ? "is-active" : ""}`}
                >
                  <WorkGlyph />
                  <span>Work</span>
                </button>
              </div>
              {isMobileDrawer ? (
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--wb-hover)] text-[var(--wb-muted)]"
                  aria-label="Close sidebar"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCollapseToggle}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-[var(--wb-hover)] text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              )}
            </>
          ) : (
            <div className="flex w-full flex-col items-center gap-1 py-1">
              <button
                type="button"
                onClick={onCollapseToggle}
                className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--wb-hover)] text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Quick Search / Command Palette + Primary New Button */}
        {!isRail ? (
          <div className="px-2.5 pt-2.5 pb-1.5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  if (isWorkMode === "work") {
                    router.push(`/work?area=${currentArea}&new=1`);
                  } else {
                    router.push("/teammate?new=1");
                  }
                }}
                className="flex flex-1 items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[12.5px] font-medium text-white transition-all"
                style={{
                  backgroundColor: "var(--wb-primary)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14)",
                }}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {isWorkMode === "work"
                    ? lang === "th"
                      ? "สั่งงาน Work ใหม่"
                      : "New Work Job"
                    : lang === "th"
                    ? "แชทใหม่ / สั่งงาน"
                    : "New Chat"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                className="flex h-[30px] items-center gap-1.5 rounded-[7px] px-2.5 text-[12px] text-[var(--wb-muted)] hover:text-[var(--wb-fg)] transition-colors"
                style={{
                  backgroundColor: "var(--wb-raised)",
                  border: "1px solid var(--wb-line)",
                }}
                title="Command Palette (Ctrl+K)"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="font-mono text-[10.5px] opacity-75">⌘K</span>
              </button>
            </div>

            {/* When in WORK Mode: 3-Area Segmented Switch (Code | Video | Artifacts) per Claude Desktop / NymoruWork spec */}
            {isWorkMode === "work" && (
              <div className="pt-1">
                <div className="mb-1 flex items-center justify-between px-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--wb-muted)]">
                    Work Studio Area
                  </span>
                  <span className="text-[10px] font-mono text-[var(--wb-accent)]">3 Engines</span>
                </div>
                <div
                  className="grid grid-cols-3 gap-1 rounded-[8px] p-1"
                  style={{ backgroundColor: "var(--wb-panel)", border: "1px solid var(--wb-line)" }}
                >
                  {[
                    { id: "code" as const, label: "Code", Icon: Code2 },
                    { id: "video" as const, label: "Video", Icon: Clapperboard },
                    { id: "artifacts" as const, label: "Artifacts", Icon: Layers },
                  ].map((item) => {
                    const active = pathname === "/work" && currentArea === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => switchWorkArea(item.id)}
                        className={`flex items-center justify-center gap-1.5 rounded-[6px] py-1.5 text-[11.5px] font-medium transition-all ${
                          active
                            ? "bg-[var(--wb-active)] text-[var(--wb-fg)] shadow-sm"
                            : "text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                        }`}
                      >
                        <item.Icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-2">
            <button
              type="button"
              onClick={() => switchMode(isWorkMode === "teammate" ? "work" : "teammate")}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--wb-active)] text-[var(--wb-fg)]"
              title={`Current: ${isWorkMode.toUpperCase()} (Click to switch)`}
            >
              {isWorkMode === "teammate" ? <TeammateGlyph /> : <WorkGlyph />}
            </button>
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--wb-hover)] text-[var(--wb-muted)]"
              title="Search (⌘K)"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Scrollable Middle Lists */}
        <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-4">
          {!isRail ? (
            <>
              {isWorkMode === "teammate" ? (
                <>
                  {/* Grok Bot Pinned Bots Roster */}
                  <div>
                    <div className="mb-1 flex items-center justify-between px-2">
                      <span className="text-[11px] font-medium text-[var(--wb-muted)]">
                        {lang === "th" ? "AI Teammates (Bots)" : "AI Teammates"}
                      </span>
                      <Link
                        href="/team"
                        onClick={() => setMobileOpen(false)}
                        className="text-[11px] text-[var(--wb-accent)] hover:underline"
                      >
                        + Bot
                      </Link>
                    </div>
                    <div className="space-y-0.5">
                      {NAV_BOTS.map((bot) => {
                        const isSelected = pathname === "/teammate" && activeBotId === bot.id;
                        return (
                          <Link
                            key={bot.id}
                            href={`/teammate?bot=${bot.id}`}
                            onClick={() => setMobileOpen(false)}
                            className={`wb-nav-row group justify-between ${isSelected ? "is-active" : ""}`}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--wb-raised)] border border-[var(--wb-line-strong)] text-[10px] font-bold text-[var(--wb-fg)]">
                                {bot.name.slice(0, 2).toUpperCase()}
                                <span
                                  className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-[var(--wb-sidebar)]"
                                  style={{ backgroundColor: bot.dot }}
                                />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-[12.5px] font-medium leading-tight">
                                    {bot.name}
                                  </span>
                                  {bot.badge && (
                                    <span className="rounded bg-[#2b66e0]/20 px-1 py-0 text-[9.5px] font-semibold text-[#7cb0ff]">
                                      {bot.badge}
                                    </span>
                                  )}
                                </div>
                                <div className="truncate text-[11px] text-[var(--wb-muted)] leading-tight">
                                  {bot.status}
                                </div>
                              </div>
                            </div>
                            {bot.unread ? (
                              <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#2b66e0] px-1 text-[10px] font-semibold text-white tabular-nums">
                                {bot.unread}
                              </span>
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  {/* Platform Surfaces Navigation */}
                  <div>
                    <div className="mb-1 px-2 text-[11px] font-medium text-[var(--wb-muted)]">
                      {lang === "th" ? "ระบบจัดการ & คอมพิวเตอร์" : "Workspace & Tools"}
                    </div>
                    <div className="space-y-0.5">
                      {TEAMMATE_NAV.map((item) => {
                        const active = pathname === item.href || pathname.startsWith(item.href + "/");
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={`wb-nav-row justify-between ${active ? "is-active" : ""}`}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--wb-muted)]" />
                              <span className="truncate">{item.label[lang]}</span>
                            </span>
                            {item.badge && (
                              <span className="rounded-full bg-[var(--wb-raised)] border border-[var(--wb-line)] px-1.5 py-0 text-[10px] font-medium text-[var(--wb-muted)] tabular-nums">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* WORK Mode Sidebar: Active Work Jobs + Origin Badges */}
                  <div>
                    <div className="mb-1 flex items-center justify-between px-2">
                      <span className="text-[11px] font-medium text-[var(--wb-muted)]">
                        {lang === "th" ? "โปรเจกต์ใน Work (Jobs)" : "Active Work Jobs"}
                      </span>
                      <Link
                        href="/work"
                        onClick={() => setMobileOpen(false)}
                        className="text-[11px] text-[var(--wb-accent)] hover:underline"
                      >
                        All ({NAV_JOBS.length})
                      </Link>
                    </div>
                    <div className="space-y-1">
                      {NAV_JOBS.map((job) => {
                        const active = pathname === `/work/${job.id}`;
                        return (
                          <Link
                            key={job.id}
                            href={`/work/${job.id}`}
                            onClick={() => setMobileOpen(false)}
                            className={`wb-nav-row flex-col !items-start gap-1 py-2 ${active ? "is-active" : ""}`}
                          >
                            <div className="flex w-full items-center justify-between gap-1.5">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: job.dot }}
                                />
                                <span className="truncate text-[12.5px] font-medium">
                                  {job.title}
                                </span>
                              </span>
                              <span className="shrink-0 font-mono text-[11px] text-[var(--wb-muted)] tabular-nums">
                                {job.cost}
                              </span>
                            </div>
                            <div className="flex w-full items-center justify-between pl-3.5 text-[10.5px] text-[var(--wb-muted)]">
                              <span className="inline-flex items-center gap-1">
                                {job.origin === "teammate" ? (
                                  <span className="rounded bg-[#2b66e0]/15 px-1.5 py-0 text-[10px] text-[#7cb0ff]">
                                    From Teammate
                                  </span>
                                ) : (
                                  <span className="rounded bg-[var(--wb-raised)] px-1.5 py-0 text-[10px] text-[var(--wb-muted)]">
                                    Direct in Work
                                  </span>
                                )}
                                {job.isLocal && (
                                  <span className="rounded bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-400">
                                    Local
                                  </span>
                                )}
                              </span>
                              <span className="capitalize">{job.status.replace(/_/g, " ")}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick jump across shared surfaces */}
                  <div>
                    <div className="mb-1 px-2 text-[11px] font-medium text-[var(--wb-muted)]">
                      {lang === "th" ? "ศูนย์รวมงาน & ไฟล์" : "Shared Surfaces"}
                    </div>
                    <div className="space-y-0.5">
                      {[
                        { href: "/work?area=artifacts", icon: Layers, label: "Artifacts Gallery (Docs/Slides/3D)" },
                        { href: "/tasks", icon: CheckSquare, label: "Unified Task Board (10 States)" },
                        { href: "/files", icon: FolderOpen, label: "Deliverables & Cloud Drive" },
                        { href: "/computer", icon: Terminal, label: "Cloud Sandbox & Terminal" },
                        { href: "/settings", icon: ShieldCheck, label: "Work Quota & Cost Ledger" },
                      ].map((row) => (
                        <Link
                          key={row.href}
                          href={row.href}
                          onClick={() => setMobileOpen(false)}
                          className="wb-nav-row"
                        >
                          <row.icon className="h-3.5 w-3.5 shrink-0 text-[var(--wb-muted)]" />
                          <span className="truncate">{row.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-1">
              {TEAMMATE_NAV.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                      active
                        ? "bg-[var(--wb-active)] text-[var(--wb-fg)]"
                        : "text-[var(--wb-muted)] hover:bg-[var(--wb-hover)] hover:text-[var(--wb-fg)]"
                    }`}
                    title={item.label[lang]}
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Dock: Cloud Computer Status Pill + Isolated Cost Meter + Account Row */}
        <div
          className="shrink-0 p-2.5 space-y-2"
          style={{ borderTop: "1px solid var(--wb-line)" }}
        >
          {!isRail && (
            <>
              {isWorkMode === "teammate" ? (
                <Link
                  href="/computer"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between rounded-[8px] px-2.5 py-2 transition-colors hover:border-[var(--wb-line-strong)]"
                  style={{
                    backgroundColor: "var(--wb-raised)",
                    border: "1px solid var(--wb-line)",
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
                    <div className="min-w-0">
                      <div className="truncate text-[11.5px] font-medium text-[var(--wb-fg)]">
                        Cloud Computer · :99
                      </div>
                      <div className="truncate text-[10.5px] text-[var(--wb-muted)] tabular-nums">
                        {dbComputer?.status === "running"
                          ? `${dbComputer?.name || "container"} · port ${dbComputer?.port ?? "—"}`
                          : dbComputer
                            ? "not running"
                            : "checking…"}
                      </div>
                    </div>
                  </div>
                  <span className="rounded bg-[var(--wb-active)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--wb-fg-soft)]">
                    Screen
                  </span>
                </Link>
              ) : (
                <Link
                  href="/settings"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-[8px] px-2.5 py-2 transition-colors"
                  style={{
                    backgroundColor: "var(--wb-raised)",
                    border: "1px solid var(--wb-line)",
                  }}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-[var(--wb-fg)]">Work Meter (Isolated)</span>
                    <span className="font-mono font-semibold text-[#7cb0ff] tabular-nums">$5.75 / $50.00</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--wb-panel)]">
                    <div className="h-full rounded-full bg-[#2b66e0]" style={{ width: "11.5%" }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--wb-muted)] tabular-nums">
                    <span>Per-task cap: $5.00</span>
                    <span>Teammate: ฿0 impact</span>
                  </div>
                </Link>
              )}
            </>
          )}

          {/* Account & Theme/Lang Controls */}
          <div className="flex items-center justify-between gap-1 pt-0.5">
            {!isRail ? (
              <>
                <Link
                  href="/"
                  className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[var(--wb-hover)]"
                  title="woibot.com Home"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2b66e0] text-[11px] font-bold text-white">
                    W
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold leading-tight">
                      woibot<span className="text-[#3b82f6]">.com</span>
                    </div>
                    <div className="truncate text-[10px] text-[var(--wb-muted)] leading-tight">
                      Pro Plan · Takin
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--wb-hover)] text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                    title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  >
                    {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={onLangToggle}
                    className="flex h-7 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold hover:bg-[var(--wb-hover)] text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                    title="Switch Language TH/EN"
                  >
                    {lang.toUpperCase()}
                  </button>
                  <Link
                    href="/settings"
                    className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--wb-hover)] text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
                    title="Settings & Usage"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={toggleTheme}
                className="mx-auto flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--wb-hover)] text-[var(--wb-muted)]"
                title="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile / Tablet Sticky Top Bar (<1024px) with direct [ Teammate | Work ] switch */}
      <div
        className="sticky top-0 z-30 flex h-[48px] items-center justify-between px-3 lg:hidden"
        style={{
          backgroundColor: "var(--wb-sidebar)",
          borderBottom: "1px solid var(--wb-line)",
        }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--wb-hover)] text-[var(--wb-fg)]"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="text-[13.5px] font-bold tracking-tight">
            woibot<span className="text-[#3b82f6]">.com</span>
          </span>
        </div>

        <div className="wb-mode-tabs">
          <button
            type="button"
            onClick={() => switchMode("teammate")}
            className={`wb-mode-tab !h-[26px] !px-2.5 !text-[11.5px] ${isWorkMode === "teammate" ? "is-active" : ""}`}
          >
            <TeammateGlyph />
            <span>Teammate</span>
          </button>
          <button
            type="button"
            onClick={() => switchMode("work")}
            className={`wb-mode-tab !h-[26px] !px-2.5 !text-[11.5px] ${isWorkMode === "work" ? "is-active" : ""}`}
          >
            <WorkGlyph />
            <span>Work</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--wb-hover)] text-[var(--wb-muted)]"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--wb-hover)] text-[var(--wb-muted)]"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] shadow-2xl">
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}

      {/* Desktop Fixed Sidebar */}
      <aside
        className={`hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block transition-[width] duration-150 ${
          collapsed ? "lg:w-[56px]" : "lg:w-[268px]"
        }`}
      >
        {renderSidebarBody(false)}
      </aside>

      {/* Command Palette Modal (⌘K) */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-xs"
            onClick={() => setCmdOpen(false)}
          />
          <div
            className="relative z-10 w-full max-w-[560px] overflow-hidden rounded-xl shadow-2xl"
            style={{
              backgroundColor: "var(--wb-raised)",
              border: "1px solid var(--wb-line-strong)",
            }}
          >
            <div
              className="flex items-center gap-2.5 px-3.5 py-3"
              style={{ borderBottom: "1px solid var(--wb-line)" }}
            >
              <Command className="h-4 w-4 text-[var(--wb-muted)]" />
              <input
                type="text"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Jump to Teammate Bot, Work Studio (Code / Video / Artifacts), Routine, or Setting..."
                className="w-full bg-transparent text-[13.5px] text-[var(--wb-fg)] placeholder:text-[var(--wb-muted)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCmdOpen(false)}
                className="rounded px-1.5 py-0.5 text-[11px] text-[var(--wb-muted)] hover:bg-[var(--wb-hover)]"
              >
                ESC
              </button>
            </div>
            <div className="max-h-[340px] overflow-y-auto p-2 space-y-1">
              {commandItems.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setCmdOpen(false);
                    item.action();
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[12.5px] hover:bg-[var(--wb-hover)] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="rounded bg-[var(--wb-panel)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--wb-muted)]">
                      {item.group}
                    </span>
                    <span className="truncate text-[var(--wb-fg)]">{item.label}</span>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--wb-muted)]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
