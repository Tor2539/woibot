"use client";

import React, { useState, Suspense } from "react";
import { Sidebar, type Lang } from "@/components/layout/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("th");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="min-h-screen w-full"
      style={{ backgroundColor: "var(--wb-bg)", color: "var(--wb-fg)" }}
    >
      <Suspense fallback={null}>
        <Sidebar
          lang={lang}
          onLangToggle={() => setLang((l) => (l === "th" ? "en" : "th"))}
          collapsed={collapsed}
          onCollapseToggle={() => setCollapsed((c) => !c)}
        />
      </Suspense>
      <div
        className={`min-h-screen transition-[padding-left] duration-150 ${
          collapsed ? "lg:pl-[56px]" : "lg:pl-[268px]"
        }`}
      >
        <main className="min-h-[calc(100vh-48px)] lg:min-h-screen w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
