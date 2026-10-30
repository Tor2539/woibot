import Link from "next/link";
import { ArrowRight, Check, Sparkles, Play, ShieldCheck, Zap, Clock3, Globe2, FileCheck2, Video, Code2, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f3]">
      <div className="sticky top-0 z-40 bg-[#f5f5f3]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-[1120px] px-4 py-4">
          <div className="flex items-center justify-between rounded-full border border-[#e5e7eb] bg-white px-5 py-3 shadow-soft">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0d0d0d] text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <span className="text-[15px] font-extrabold tracking-tight">woibot<span className="text-[#1757d7]">.com</span></span>
              </Link>
              <nav className="hidden md:flex items-center gap-6 text-sm text-[#6b7280]">
                <a href="#teammate" className="hover:text-[#0d0d0d] transition-colors">Teammate</a>
                <a href="#work" className="hover:text-[#0d0d0d] transition-colors">Work</a>
                <a href="#tasks" className="hover:text-[#0d0d0d] transition-colors">Tasks</a>
                <a href="#pricing" className="hover:text-[#0d0d0d] transition-colors">Pricing</a>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/teammate" className="hidden sm:inline-flex text-sm font-medium text-[#6b7280] hover:text-[#0d0d0d]">Sign in</Link>
              <Link href="/teammate">
                <Button className="hidden sm:inline-flex">Talk to your Teammate <ArrowRight className="h-4 w-4" /></Button>
              </Link>
              <Link href="/teammate" className="sm:hidden">
                <Button size="sm">Start</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1120px] px-5">
        <div className="grid gap-7 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:py-10">
          <div>
            <Badge variant="default" className="mb-4 rounded-full bg-[#0d0d0d] px-3 py-1 text-xs font-medium tracking-wide">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> NEW - Cloud Computer + Work isolate
            </Badge>
            <h1 className="text-[42px] font-extrabold leading-[0.95] tracking-[-0.03em] text-[#0d0d0d] sm:text-[48px] lg:text-[54px]">
              Your Personal AI Team <br />
              <span className="text-[#1757d7]">That Actually</span> Gets Work Done.
            </h1>
            <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-[#6b7280]">
              Teammate ดูแลทุกวัน - Work ลงมือทำจนส่งไฟล์จริง ใช้ได้ แก้ไขต่อได้<br />
              <span className="font-semibold text-[#0d0d0d]">สั่งงาน - ลงมือทำ - ตรวจสอบ - ส่งมอบ - ทำงานต่อ</span>
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {["สั่งงาน","ลงมือทำ","ตรวจสอบ","ส่งมอบ","ทำงานต่อ"].map((s,i) => (
                <span key={s} className="flex items-center gap-2">
                  <span className="rounded-full border border-[#e5e7eb] bg-white px-3.5 py-2 text-sm font-medium text-[#0d0d0d] shadow-soft">{s}</span>
                  {i < 4 && <span className="text-[#9ca3af]">-&gt;</span>}
                </span>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/teammate"><Button size="lg">Talk to your Teammate <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link href="#work"><Button variant="outline" size="lg"><Play className="h-4 w-4" /> ดูการทำงาน</Button></Link>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3 max-w-[520px]">
              {[
                { k: "24h", v: "Cloud Computer" },
                { k: "Memory", v: "จำวิธีทำงานคุณ" },
                { k: "Verified", v: "ส่งพร้อมหลักฐาน" },
              ].map(item => (
                <div key={item.k} className="rounded-2xl border border-dashed border-[#e5e7eb] bg-white px-4 py-4 text-center">
                  <div className="text-lg font-bold text-[#0d0d0d]">{item.k}</div>
                  <div className="text-xs text-[#6b7280]">{item.v}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 max-w-[520px] text-xs leading-relaxed text-[#9ca3af]">
              หลักคิด: ไม่ต้องเลือก AI เอง - บอกสิ่งที่ต้องการ woibot จะเข้าใจ เลือกทางที่เหมาะ และส่งผลลัพธ์ที่ใช้งานได้จริง
            </p>
          </div>
          <Card className="h-fit">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#0d0d0d]">Teammate</span>
              <Badge variant="default" className="rounded-full bg-[#0d0d0d] text-xs">Always Available</Badge>
            </div>
            <p className="mt-2 text-sm text-[#6b7280]">AI ผู้ช่วยส่วนตัว - สรุปอีเมล ปฏิทิน งานค้าง Daily briefing 08:00</p>
            <div className="mt-4 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock3 className="h-4 w-4 text-[#1757d7]" /> 08:00 Daily Briefing
              </div>
              <div className="mt-2 text-xs text-[#6b7280]">- 3 อีเมลสำคัญจากลูกค้า - ประชุม 10:00 เตรียมสไลด์แล้ว - งานค้าง 2 ชิ้น</div>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="primary" className="text-xs">Handoff -&gt; Work</Badge>
                <span className="text-xs text-[#6b7280]">สร้าง CRM -&gt; ส่งให้ Work พร้อม estimate $2.40</span>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-sm font-semibold text-[#0d0d0d]">Work</span>
              <Badge variant="primary">Cloud / Local</Badge>
            </div>
            <p className="mt-1 text-sm text-[#6b7280]">Coding / Docs / Video / Research - ส่งไฟล์ที่เปิดได้จริง + verification report</p>
            <ul className="mt-3 space-y-2 text-sm text-[#6b7280]">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Coding: tests + preview + coverage</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Docs: เปิดไฟล์จริง + layout check</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Video: ffprobe + thumb + subs</li>
            </ul>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200&q=80&auto=format&fit=crop" alt="team" className="h-16 w-full rounded-xl object-cover" />
              <img src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=200&q=80&auto=format&fit=crop" alt="work" className="h-16 w-full rounded-xl object-cover" />
              <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=200&q=80&auto=format&fit=crop" alt="data" className="h-16 w-full rounded-xl object-cover" />
            </div>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card id="teammate">
            <CardHeader className="p-0 pb-4">
              <CardTitle>Teammate - กลับมาหาทุกวัน</CardTitle>
              <CardDescription>จุดแข็ง: Memory, Connected Apps, Daily Routines, ดูแลงานค้าง - ไม่ใช่แค่ตอบฉลาด</CardDescription>
            </CardHeader>
            <ul className="space-y-2 text-sm text-[#6b7280]">
              <li className="flex gap-2"><span className="text-[#0d0d0d]">-</span> ตั้งชื่อ/บทบาท/ภาษา/บุคลิก - หลาย Teammate + Group chat</li>
              <li className="flex gap-2"><span className="text-[#0d0d0d]">-</span> Memory ระยะยาว (แก้/ลบได้) + แยก personal/team</li>
              <li className="flex gap-2"><span className="text-[#0d0d0d]">-</span> Cloud Computer ส่วนตัว: Browser จริง, Files, noVNC Take Over</li>
              <li className="flex gap-2"><span className="text-[#0d0d0d]">-</span> Connected Apps: Gmail, Calendar, Slack, Notion, Drive, GitHub, Jira</li>
              <li className="flex gap-2"><span className="text-[#0d0d0d]">-</span> Routines: cron + event + teach-by-demo + last/next/success/fail/cost</li>
              <li className="flex gap-2"><span className="text-[#0d0d0d]">-</span> Proactive (consent): แจ้งงานช้า, เตรียมประชุม, เสนอ follow-up</li>
            </ul>
            <div className="mt-5 flex gap-2">
              <Link href="/teammate"><Button size="sm">เริ่มแชทกับ Teammate <ArrowUpRight className="h-3.5 w-3.5" /></Button></Link>
              <Link href="/routines"><Button variant="outline" size="sm">ดู Routines</Button></Link>
            </div>
          </Card>
          <Card id="work">
            <CardHeader className="p-0 pb-4">
              <CardTitle>Work - วัดที่คุณภาพผลงาน</CardTitle>
              <CardDescription>Software / Video / Documents / Legal / Data / Research / Cross-app - มีระบบตรวจสอบ</CardDescription>
            </CardHeader>
            <ul className="space-y-2 text-sm text-[#6b7280]">
              <li className="flex gap-2"><span className="text-[#0d0d0d]">-</span> Coding: รับคำสั่งภาษาไทย -&gt; ส่งโปรเจกต์รันได้ + PR + tests</li>
              <li className="flex gap-2"><span className="text-[#0d0d0d]">-</span> Video: idea - script - gen - edit - subs - export + project file</li>
              <li className="flex gap-2"><span className="text-[#0d0d0d]">-</span> Docs: อ่านหลายไฟล์ -&gt; สร้าง PDF/DOCX/PPTX/XLSX พร้อม preview</li>
              <li className="flex gap-2"><span className="text-[#0d0d0d]">-</span> Execution: Cloud / Local - ระบุค่าใช้จ่ายก่อนเริ่ม</li>
              <li className="flex gap-2"><span className="text-[#0d0d0d]">-</span> Definition of Done 6 ข้อ + verification_report.json</li>
            </ul>
            <div className="mt-5 flex gap-2">
              <Link href="/work"><Button size="sm" variant="primary">สร้างโปรเจกต์ใหม่ <ArrowUpRight className="h-3.5 w-3.5" /></Button></Link>
              <Link href="/tasks"><Button variant="outline" size="sm">ดู Tasks</Button></Link>
            </div>
          </Card>
        </div>

        <Card id="tasks" className="mt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-[#0d0d0d]">One Connected Experience - Teammate - Work</h3>
            <Badge variant="outline">Handoff Packet</Badge>
          </div>
          <p className="mt-2 text-sm text-[#6b7280] leading-relaxed">ผู้ใช้ไม่ต้องคัดลอกบริบท - Teammate ส่ง Handoff Packet (goal, context, files, prefs, deadline, deliverables, budget, verification criteria) ให้ Work อัตโนมัติ ผลลัพธ์กลับมาในบทสนทนาเดิม</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {["User -> Teammate","Intent Router","Work (Cloud/Local + Estimate)","Verify","Teammate สรุป + ส่งไฟล์"].map((s,i) => (
              <span key={s} className="flex items-center gap-2">
                <span className="rounded-full border border-[#e5e7eb] bg-[#f9fafb] px-3 py-1.5 text-xs font-medium">{s}</span>
                {i < 4 && <span className="text-[#9ca3af] text-sm">-&gt;</span>}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#9ca3af]">Unified Tasks: Queued - Planning - In Progress - Waiting for User - Paused - Reviewing - Completed/Partially/Failed/Cancelled - Reverse delegation: Work -&gt; Teammate</p>
        </Card>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { icon: Code2, title: "Coding Work", desc: "สร้างเว็บ/แอป จากคำสั่งภาษาไทย รับ PR + tests + preview", img: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&q=80&auto=format&fit=crop" },
            { icon: Video, title: "Video Production", desc: "60 นาที -> 5 คลิป TikTok พร้อมซับไทย/อังกฤษ", img: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&q=80&auto=format&fit=crop" },
            { icon: FileCheck2, title: "Documents & Legal", desc: "อ่านหลายไฟล์ สร้าง PDF/DOCX/PPTX พร้อมตรวจ layout", img: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&q=80&auto=format&fit=crop" },
          ].map(c => (
            <Card key={c.title} className="overflow-hidden p-0">
              <img src={c.img} alt={c.title} className="h-32 w-full object-cover" />
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f5f3]"><c.icon className="h-4 w-4 text-[#0d0d0d]" /></div>
                  <span className="text-sm font-semibold">{c.title}</span>
                </div>
                <p className="mt-2 text-sm text-[#6b7280]">{c.desc}</p>
              </div>
            </Card>
          ))}
        </div>

        <div id="pricing" className="mt-6 grid gap-4 md:grid-cols-3">
          <Card>
            <Badge variant="outline" className="w-fit">Teammate</Badge>
            <h4 className="mt-3 text-lg font-semibold">Free</h4>
            <div className="mt-1 text-2xl font-bold">0 THB <span className="text-sm font-normal text-[#6b7280]">/ เดือน</span></div>
            <p className="mt-2 text-sm text-[#6b7280]">Cloud Computer 2h/day - Memory 7 วัน - Routines 3 - 200K tokens</p>
            <Button variant="outline" className="mt-4 w-full">เริ่มฟรี</Button>
          </Card>
          <Card className="border-[#0d0d0d] shadow-medium">
            <Badge className="w-fit bg-[#0d0d0d] text-white">Teammate - แนะนำ</Badge>
            <h4 className="mt-3 text-lg font-semibold">Starter</h4>
            <div className="mt-1 text-2xl font-bold">399 THB <span className="text-sm font-normal text-[#6b7280]">/ เดือน</span></div>
            <p className="mt-2 text-sm text-[#6b7280]">1 vCPU/2GB persistent - Memory ไม่จำกัด - Routines 20 - 2M tokens</p>
            <Link href="/teammate" className="mt-4 block"><Button className="w-full">เริ่มใช้ Teammate</Button></Link>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600"><ShieldCheck className="h-3.5 w-3.5" /> ยกเลิกได้ทุกเมื่อ</div>
          </Card>
          <Card>
            <Badge variant="primary" className="w-fit">Teammate + Work</Badge>
            <h4 className="mt-3 text-lg font-semibold">Pro</h4>
            <div className="mt-1 text-2xl font-bold">999 THB <span className="text-sm font-normal text-[#6b7280]">/ เดือน</span></div>
            <p className="mt-2 text-sm text-[#6b7280]">2 vCPU/4GB - Team memory - Routines 100 - 10M tokens - Work estimate ก่อนเริ่ม</p>
            <Button variant="outline" className="mt-4 w-full">เลือก Pro</Button>
          </Card>
        </div>

        <Card className="mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold">Work Usage - แยก ledger โปร่งใส</div>
              <p className="mt-1 text-sm text-[#6b7280]">Coding $0.02/1K + build $0.10/min - Research $0.015/search - Docs $0.50/doc - Video analysis $0.20/min - Video gen $0.30-2.00/sec</p>
              <p className="mt-1 text-xs text-[#9ca3af]">Per-task cap $5 / Monthly cap $50 (ปรับได้) - ทุกงานมี estimate ก่อนเริ่ม</p>
            </div>
            <Badge variant="secondary" className="shrink-0 bg-[#f5f5f3]">Cost Isolation</Badge>
          </div>
          <div className="mt-4 rounded-xl border border-dashed border-[#e5e7eb] bg-[#f9fafb] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm"><span className="font-semibold">Estimate Card:</span><span className="ml-2 text-[#6b7280]">ประเมิน 18 นาที | ~$2.40 | GPT-4o + FFmpeg | เกินงบ $5 จะหยุดรอคุณอนุมัติ</span></div>
              <div className="flex gap-2"><Button size="sm">เริ่มเลย</Button><Button size="sm" variant="outline">ปรับงบ</Button></div>
            </div>
          </div>
        </Card>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card className="bg-[#0d0d0d] border-[#0d0d0d] text-white">
            <div className="flex gap-1">{[1,2,3,4,5].map(i => <span key={i} className="text-amber-400">★</span>)}</div>
            <p className="mt-3 text-sm leading-relaxed text-white/90">สั่งงานภาษาไทยแล้วได้เว็บจริง ไม่ใช่แค่โค้ดตัวอย่าง - มี tests และ preview ให้ตรวจ</p>
            <div className="mt-4 flex items-center gap-3">
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80&auto=format&fit=crop" className="h-8 w-8 rounded-full object-cover" alt="user" />
              <div><div className="text-sm font-medium">คุณณัฐ - Founder</div><div className="text-xs text-white/60">ใช้ Teammate + Work รายวัน</div></div>
            </div>
          </Card>
          <Card className="bg-[#1757d7] border-[#1757d7] text-white">
            <div className="flex items-center gap-2 text-white/80 text-xs font-semibold tracking-wide"><Zap className="h-4 w-4" /> VERIFIED DELIVERABLES</div>
            <p className="mt-3 text-lg font-bold leading-tight">ไม่ใช่แค่ตอบฉลาด<br />แต่ส่งไฟล์ที่ใช้งานได้จริง</p>
            <p className="mt-2 text-sm text-white/80">ทุกงานมี verification_report.json + หลักฐาน</p>
          </Card>
          <Card>
            <div className="flex items-center gap-2"><Globe2 className="h-5 w-5 text-[#1757d7]" /><span className="text-sm font-semibold">Multilingual by Design</span></div>
            <p className="mt-2 text-sm text-[#6b7280]">คุณภาพสูงทั้งภาษาไทยและอังกฤษ - ไม่ต้องเขียน prompt ยาว</p>
            <div className="mt-4 flex gap-2 text-xs"><Badge variant="secondary">ไทย</Badge><Badge variant="secondary">English</Badge><Badge variant="outline">More soon</Badge></div>
          </Card>
        </div>

        <div className="py-10 text-center text-xs text-[#9ca3af]">
          woibot - Talk to your Teammate. Let Work handle the heavy lifting. - Multilingual by Design - Trust Through Verification<br />
          <span className="mt-1 inline-block">© 2026 woibot.com - Privacy - Terms - Status</span>
        </div>
      </div>
    </div>
  );
}
