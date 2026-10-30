"use client";
import { useState } from "react";
import { Users2, Crown, Sparkles, MessageCircleMore, Plus, Settings, Shield, Zap, Clock3, MoreHorizontal, Trash2, Edit3, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const teammates = [
  { id: "tm_1", name: "Milo", role: "Personal Assistant", persona: "อบอุ่น กระชับ ตรงประเด็น", lang: "th", isMain: true, status: "active", tasks: 12, avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&q=80&auto=format&fit=crop" },
  { id: "tm_2", name: "Sora", role: "Marketing Assistant", persona: "ครีเอทีฟ วิเคราะห์คม", lang: "th", isMain: false, status: "active", tasks: 8, avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80&auto=format&fit=crop" },
  { id: "tm_3", name: "Ken", role: "Finance Assistant", persona: "ละเอียด รอบคอบ", lang: "en", isMain: false, status: "idle", tasks: 3, avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80&auto=format&fit=crop" },
  { id: "tm_4", name: "Ava", role: "Research Assistant", persona: "ลึกซึ้ง อ้างอิงชัด", lang: "en", isMain: false, status: "active", tasks: 5, avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80&auto=format&fit=crop" },
];

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-[#6b7280]">AI Teammates ของคุณ - สร้างหลายตัว แยกบทบาท แชทกลุ่ม ส่งต่องานระหว่างกันได้</p>
        </div>
        <Button><Plus className="h-4 w-4" /> สร้าง Teammate</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-[#0d0d0d] text-white border-[#0d0d0d]">
          <div className="flex items-center gap-2 text-white/60 text-xs font-semibold tracking-wide"><Users2 className="h-4 w-4" /> TEAM OVERVIEW</div>
          <div className="mt-3 text-2xl font-bold">{teammates.length} Teammates</div>
          <div className="mt-1 text-sm text-white/60">{teammates.filter(t=>t.status==="active").length} active - 1 Main</div>
          <div className="mt-4 flex -space-x-2">
            {teammates.map(t => <Avatar key={t.id} className="h-8 w-8 border-2 border-[#0d0d0d]"><AvatarImage src={t.avatar} /><AvatarFallback>{t.name[0]}</AvatarFallback></Avatar>)}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[#6b7280]"><MessageCircleMore className="h-4 w-4" /> GROUP CHAT</div>
          <div className="mt-3 text-sm font-semibold">แชทรวม - มอบงานข้าม Teammate</div>
          <p className="mt-1 text-sm text-[#6b7280]">สร้างห้องที่มีหลาย Teammate + คุณ - ส่งต่องานโดยไม่ต้องคัดลอกบริบท</p>
          <Button variant="outline" size="sm" className="mt-4 w-full">+ สร้าง Group Chat</Button>
        </Card>
        <Card className="bg-[#eff6ff] border-[#dbeafe]">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[#1757d7]"><Zap className="h-4 w-4" /> HANDOFF</div>
          <div className="mt-3 text-sm font-semibold">Teammate - Work - Teammate</div>
          <p className="mt-1 text-sm text-[#6b7280]">Work เสร็จส่งกลับ Teammate เพื่อแจ้ง เตรียมอีเมล หรือสร้าง Routine</p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-[#1757d7]"><Clock3 className="h-3.5 w-3.5" /> Reverse delegation enabled</div>
        </Card>
      </div>

      <Tabs defaultValue="all">
        <TabsList><TabsTrigger value="all">ทั้งหมด</TabsTrigger><TabsTrigger value="active">Active</TabsTrigger><TabsTrigger value="settings">สิทธิ์ & แชร์</TabsTrigger></TabsList>
        <TabsContent value="all" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {teammates.map(t => (
              <Card key={t.id} className={t.isMain ? "border-[#0d0d0d] shadow-medium" : ""}>
                <div className="flex gap-4">
                  <Avatar className="h-12 w-12"><AvatarImage src={t.avatar} /><AvatarFallback>{t.name[0]}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{t.name}</span>
                      {t.isMain && <Badge className="bg-[#0d0d0d] text-white text-xs"><Crown className="h-3 w-3 mr-1" /> Main</Badge>}
                      <Badge variant={t.status==="active" ? "success" : "secondary"} className="text-xs">{t.status}</Badge>
                    </div>
                    <div className="text-sm text-[#6b7280]">{t.role}</div>
                    <div className="mt-1 text-xs text-[#9ca3af]">"{t.persona}" - {t.lang}</div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-[#6b7280]">
                  <Badge variant="outline">{t.tasks} tasks</Badge>
                  <span>- Memory: {t.isMain ? "เต็ม" : "แยกตามบทบาท"}</span>
                  <span className="ml-auto flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${t.status==="active"?"bg-emerald-500":"bg-[#e5e7eb]"}`} /> {t.status}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" className="flex-1">แชท</Button>
                  <Button variant="outline" size="sm"><Edit3 className="h-3.5 w-3.5" /> แก้ไข</Button>
                  <Button variant="ghost" size="sm"><Settings className="h-3.5 w-3.5" /></Button>
                </div>
              </Card>
            ))}
            <Card className="border-dashed flex flex-col items-center justify-center p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f5f3]"><Users className="h-6 w-6 text-[#6b7280]" /></div>
              <div className="mt-3 font-semibold">สร้าง Teammate ใหม่</div>
              <p className="mt-1 text-sm text-[#6b7280]">บอกหน้าที่เป็นประโยค - เช่น ช่วยเป็นเลขาผู้บริหาร ดูเมล ปฏิทิน</p>
              <Button size="sm" className="mt-4">+ สร้างด้วยข้อความ</Button>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="active"><Card><div className="text-sm text-[#6b7280]">Teammates ที่กำลังทำงาน - แสดง task ปัจจุบัน ความคืบหน้า และ handoff ล่าสุด</div></Card></TabsContent>
        <TabsContent value="settings"><Card><CardHeader className="pb-4"><CardTitle className="text-base">สิทธิ์ & การแชร์</CardTitle><CardDescription>ควบคุมว่า Teammate แต่ละตัวเข้าถึง Connected Apps และ Memory ไหนได้บ้าง</CardDescription></CardHeader><div className="space-y-3 text-sm"><div className="flex items-center justify-between rounded-xl border border-[#e5e7eb] p-4"><div className="flex items-center gap-3"><Shield className="h-5 w-5 text-[#1757d7]" /><span>Gmail - เฉพาะ Milo (Main) + Sora</span></div><Badge>2 teammates</Badge></div><div className="flex items-center justify-between rounded-xl border border-[#e5e7eb] p-4"><div className="flex items-center gap-3"><Shield className="h-5 w-5 text-emerald-600" /><span>Memory personal - แยกตาม Teammate</span></div><Badge variant="secondary">isolated</Badge></div></div></Card></TabsContent>
      </Tabs>
      <Card className="overflow-hidden p-0">
        <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80&auto=format&fit=crop" alt="team" className="h-40 w-full object-cover" />
        <div className="p-6"><div className="font-semibold">ทำงานเป็นทีม - ไม่ใช่แค่บอทตัวเดียว</div><p className="mt-1 text-sm text-[#6b7280]">PRD 4.8 - Group Conversation, ส่งต่องาน, แชร์บริบทที่ได้รับอนุญาต, ป้องกันงานซ้ำซ้อน, สรุปผลรวม</p></div>
      </Card>
    </div>
  );
}
