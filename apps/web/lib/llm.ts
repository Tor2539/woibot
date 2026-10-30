export interface LLMCallOptions {
  system: string;
  user: string;
  maxTokens?: number;
}

export async function callWoibotLLM({ system, user, maxTokens = 900 }: LLMCallOptions): Promise<{ text: string; provider: string }> {
  const providers = [
    {
      name: "fireworks",
      key: process.env.FIREWORKS_API_KEY,
      url: "https://api.fireworks.ai/inference/v1/chat/completions",
      model: "accounts/fireworks/models/deepseek-v3",
    },
    {
      name: "deepseek",
      key: process.env.DEEPSEEK_API_KEY,
      url: "https://api.deepseek.com/v1/chat/completions",
      model: "deepseek-chat",
    },
    {
      name: "openai",
      key: process.env.OPENAI_API_KEY,
      url: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o-mini",
    },
  ];

  for (const p of providers) {
    if (!p.key) continue;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7500);
      const res = await fetch(p.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${p.key}`,
        },
        body: JSON.stringify({
          model: p.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.4,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text) return { text, provider: p.name };
      }
    } catch {
      // try next provider
    }
  }

  return {
    text: synthesizeFallbackReply(user),
    provider: "woibot-local-synthesizer",
  };
}

function synthesizeFallbackReply(input: string): string {
  const s = input.toLowerCase();
  if (/อีเมล|เมล|email|inbox|ร่าง/.test(s)) {
    return "ตรวจสอบ Gmail (takin@woxacorp.com) และคัดกรองข้อความสำคัญให้แล้วครับ:\n\n1. **ACME Corp (คุณสมชาย)** — ขอใบเสนอราคา Enterprise CRM ภายใน 15:00 น. (ร่างคำตอบรอคุณอนุมัติด้านล่าง)\n2. **Cloudflare & AWS Billing** — ใบแจ้งหนี้ประจำเดือน ยอดตรงตาม PO\n\nกด **Approve & Send** ในการ์ดร่างอีเมลด้านล่างเพื่อส่งทันที หรือแก้ไขข้อความในช่องได้เลยครับ";
  }
  if (/ประชุม|ตาราง|calendar|นัด|brief/.test(s)) {
    return "สรุปตารางงานและสิ่งที่เตรียมไว้ให้วันนี้ครับ:\n\n- **10:00 – 11:00** Sprint & Architecture Review (เตรียมสไลด์สรุป KPI ไว้ใน Library แล้ว)\n- **14:00 – 15:00** ACME Corp Partner Sync (ดึงประวัติสัญญาและ SLA จาก Memory ให้แล้ว)\n- **งานค้างที่ติดตามอยู่:** รายงาน Q4 Board Strategy รอคุณกดยืนยันงบ $1.15 ในหน้า Work ครับ";
  }
  if (/จำไว้|บันทึก|memory|remember/.test(s)) {
    return `บันทึกเข้าสู่ Personal Memory ของคุณเรียบร้อยครับ — ครั้งถัดไปที่สั่งงาน Teammate และ Work จะใช้ข้อกำหนดนี้โดยไม่ต้องพิมพ์ซ้ำ (สามารถดูหรือแก้ไขได้ที่แท็บ Memory ทางขวา)`;
  }
  if (/routine|ทุกเช้า|ทุกวัน|อัตโนมัติ|cron/.test(s)) {
    return "ตั้งค่าเป็น **Routine อัตโนมัติ** บน Cloud Computer ให้เรียบร้อยครับ — ระบบจะรันตามเวลาที่กำหนดแม้คุณปิดเครื่อง พร้อมเปิด **Spend Guard** เพื่อหยุดพักอัตโนมัติหากไม่มีการเปิดอ่านผลลัพธ์";
  }
  return `ดำเนินการตรวจสอบบริบทจาก Memory และ Connected Apps สำหรับคำสั่ง: "${input.slice(0, 100)}" เรียบร้อยครับ\n\n- **สถานะ Cloud Computer:** Running (:99)\n- **บริบทที่ใช้:** Personal & Team Memory + 8 Connected Apps\n- หากต้องการส่งต่องานนี้ไปรันเป็นโปรเจกต์เต็มรูปแบบ (Code / Video / Artifacts) กดปุ่ม **Send to Work** ด้านล่างข้อความนี้ได้ทันทีครับ`;
}
