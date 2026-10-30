"use client";
import { useState } from "react";
import { Sidebar, type Lang } from "@/components/layout/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("th");
  return (
    <div className="min-h-screen bg-[#f5f5f3]">
      <Sidebar lang={lang} onLangToggle={() => setLang(l => l === "th" ? "en" : "th")} />
      <div className="lg:pl-[272px]">
        <main className="min-h-screen">
          <div className="mx-auto max-w-[1200px] px-4 py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
