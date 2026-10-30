"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  MessageCircleMore,
  Briefcase,
  CheckSquare,
  FolderOpen,
  Monitor,
  Repeat2,
  Puzzle,
  Users2,
  Settings2,
  Menu,
  X,
  Sparkles,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

export type Lang = "th" | "en";

export const NAV_ITEMS = [
  { href: "/teammate", icon: MessageCircleMore, label: { th: "Teammate", en: "Teammate" }, desc: { th: "แชทกับ AI ผู้ช่วย", en: "Chat with your AI" } },
  { href: "/work", icon: Briefcase, label: { th: "Work", en: "Work" }, desc: { th: "โปรเจกต์ & งานหนัก", en: "Projects & Execution" } },
  { href: "/tasks", icon: CheckSquare, label: { th: "Tasks", en: "Tasks" }, desc: { th: "ติดตามงานทั้งหมด", en: "Unified tasks" } },
  { href: "/files", icon: FolderOpen, label: { th: "Files", en: "Files" }, desc: { th: "ไฟล์และผลงาน", en: "Files & deliverables" } },
  { href: "/computer", icon: Monitor, label: { th: "Computer", en: "Computer" }, desc: { th: "Cloud Computer", en: "Cloud Computer" } },
  { href: "/routines", icon: Repeat2, label: { th: "Routines", en: "Routines" }, desc: { th: "งานประจำอัตโนมัติ", en: "Automations" } },
  { href: "/apps", icon: Puzzle, label: { th: "Apps", en: "Apps" }, desc: { th: "เชื่อมต่อบริการ", en: "Connected apps" } },
  { href: "/team", icon: Users2, label: { th: "Team", en: "Team" }, desc: { th: "AI Teammates", en: "AI Teammates" } },
  { href: "/settings", icon: Settings2, label: { th: "Settings & Usage", en: "Settings & Usage" }, desc: { th: "ตั้งค่าและค่าใช้จ่าย", en: "Billing & usage" } },
];

function NavLink({ href, icon: Icon, label, active, onClick }: { href: string; icon: any; label: string; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-medium transition-all",
        active
          ? "bg-[#0d0d0d] text-white shadow-sm"
          : "text-[#6b7280] hover:bg-white hover:text-[#0d0d0d] hover:shadow-soft"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar({ lang = "th", onLangToggle }: { lang?: Lang; onLangToggle?: () => void }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-[72px] items-center gap-2 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0d0d0d] text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-extrabold tracking-tight text-[#0d0d0d] leading-none">
            woibot<span className="text-[#1757d7]">.com</span>
          </span>
          <span className="text-[11px] font-medium text-[#9ca3af] tracking-wide">PERSONAL AI TEAM</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto lg:hidden h-8 w-8"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Separator className="mx-5 w-auto" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <p className="px-3 pb-2 text-[11px] font-semibold tracking-widest text-[#9ca3af]">NAVIGATION</p>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label[lang]}
            active={isActive(item.href)}
            onClick={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 space-y-3">
        {/* Plan card */}
        <div className="rounded-2xl bg-[#0d0d0d] p-4 text-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-white/70">PLAN</span>
            <Badge variant="secondary" className="bg-white/15 text-white border-white/10 text-[11px]">Pro</Badge>
          </div>
          <p className="mt-2 text-sm font-semibold">999 THB / เดือน</p>
          <p className="text-xs text-white/60">10M tokens • 2 vCPU/4GB</p>
          <div className="mt-3 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full w-[64%] bg-[#1757d7] rounded-full" />
          </div>
          <p className="mt-1.5 text-[11px] text-white/50">6.4M / 10M tokens used</p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&q=80&auto=format&fit=crop" />
            <AvatarFallback>ST</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#0d0d0d] truncate">สมชาย ท.</p>
            <p className="text-xs text-[#6b7280] truncate">somchai@woibot.com</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onLangToggle} title={lang === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}>
            <Globe className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-[272px] flex-col border-r border-[#e5e7eb] bg-white">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#e5e7eb] bg-white px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0d0d0d] text-white">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-extrabold">woibot<span className="text-[#1757d7]">.com</span></span>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-[300px] bg-white shadow-large animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

export function Topbar({ title, subtitle, actions, lang = "th" }: { title: string; subtitle?: string; actions?: React.ReactNode; lang?: Lang }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0d0d0d]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[#6b7280]">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
