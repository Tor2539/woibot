"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "ดำเนินการไม่สำเร็จ");
        return;
      }
      router.push("/teammate");
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ backgroundColor: "var(--wb-bg)" }}>
      <div className="hidden lg:flex flex-col justify-between p-10" style={{ backgroundColor: "var(--wb-sidebar)", borderRight: "1px solid var(--wb-line)" }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#2b66e0] text-[14px] font-bold text-white">W</div>
          <span className="text-[16px] font-bold tracking-tight">woibot<span className="text-[#3b82f6]">.com</span></span>
        </div>
        <div className="space-y-4">
          <h1 className="text-[30px] font-bold leading-tight tracking-tight">
            Your Personal AI Team<br />That Actually Gets Work Done.
          </h1>
          <p className="text-[13.5px] text-[var(--wb-muted)] max-w-[420px] leading-relaxed">
            Teammate ดูแลงานประจำวันบน Cloud Computer ส่วนตัว 24 ชั่วโมง — Work ลงมือสร้าง Code, Video และ Artifacts พร้อมรายงานตรวจสอบทุกชิ้น
          </p>
          <ul className="space-y-2 text-[13px] text-[var(--wb-fg-soft)]">
            <li>Cloud Computer แยกต่อบัญชี · เปิดดูหน้าจอและ Take Over ได้</li>
            <li>Memory 2 ชั้น · Connected Apps · Routines พร้อม Spend Guard</li>
            <li>ทุกงาน Work มี estimate ก่อนเริ่ม และแยกบัญชีต้นทุนชัดเจน</li>
          </ul>
        </div>
        <div className="text-[11.5px] text-[var(--wb-muted)]">© 2026 woibot.com</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-[380px] space-y-5">
          <div className="lg:hidden flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#2b66e0] text-[14px] font-bold text-white">W</div>
            <span className="text-[16px] font-bold">woibot.com</span>
          </div>

          <div>
            <h2 className="text-[20px] font-bold">{mode === "signup" ? "สร้างบัญชีใหม่" : "เข้าสู่ระบบ"}</h2>
            <p className="text-[12.5px] text-[var(--wb-muted)] mt-1">
              {mode === "signup" ? "เริ่มใช้งาน Teammate และ Work ได้ทันที" : "กลับเข้าสู่ workspace ของคุณ"}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="block text-[11.5px] text-[var(--wb-muted)] mb-1">ชื่อที่ใช้แสดง</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Takin"
                  className="w-full rounded-[8px] px-3 py-2 text-[13px] bg-[var(--wb-raised)] border border-[var(--wb-line)] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
                />
              </div>
            )}
            <div>
              <label className="block text-[11.5px] text-[var(--wb-muted)] mb-1">อีเมล</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-[8px] px-3 py-2 text-[13px] bg-[var(--wb-raised)] border border-[var(--wb-line)] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
              />
            </div>
            <div>
              <label className="block text-[11.5px] text-[var(--wb-muted)] mb-1">รหัสผ่าน</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                className="w-full rounded-[8px] px-3 py-2 text-[13px] bg-[var(--wb-raised)] border border-[var(--wb-line)] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
              />
            </div>

            {error && (
              <div className="rounded-[8px] bg-red-500/10 border border-red-500/30 px-3 py-2 text-[12px] text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-[8px] bg-[#2b66e0] hover:bg-[#2458c6] disabled:opacity-50 py-2.5 text-[13px] font-semibold text-white"
            >
              {busy ? "กำลังดำเนินการ..." : mode === "signup" ? "สร้างบัญชีและเริ่มใช้งาน" : "เข้าสู่ระบบ"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }}
            className="w-full text-[12.5px] text-[var(--wb-muted)] hover:text-[var(--wb-fg)]"
          >
            {mode === "signup" ? "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ" : "ยังไม่มีบัญชี? สมัครใช้งาน"}
          </button>
        </div>
      </div>
    </div>
  );
}
