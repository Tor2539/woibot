# OPENHANDS.md — woibot (handover from OpenCode → OpenHands)

**ผู้รับช่วง:** OpenHands Agent Canvas (แทน OpenCode 100%)
**Repo จริง (source of truth):**

    C:\Users\WINDOWS\AppData\Local\hermes\profiles\woibot-com\workspace\woibot

(D:\woibot.com เป็นแค่ session directory ที่ถือไว้ — ห้ามทำงานในนั้น)
**GitHub:** https://github.com/Tor2539/woibot (public, branch `main`)
**Prod:** https://woibot.com · API: https://woibot-578962358378.asia-southeast1.run.app · Computer: https://computer.woibot.com

## กติกาเริ่มงาน (อ่านก่อนทุกครั้ง)

1. Clone / เข้า repo จริงตาม path ด้านบนก่อนเสมอ — ห้ามสร้าง checkout ใหม่ใน D:\woibot.com
2. อ่าน `AGENTS.md` แล้วตามด้วย `docs/HANDOFF.md` (rev.3) **ก่อนแก้โค้ดใด ๆ** — ทั้งสองไฟล์อัปเดตตรง repo แล้ว
3. เปลี่ยนแปลงที่กระทบ code ต้องผ่าน quality plan ของ OpenHands (prepare → fill plan.json → run → check)
4. Commit เฉพาะไฟล์ที่เกี่ยวกับงาน, ห้ามใส่ secrets ใด ๆ (key อยู่แค่ env vars / Secret Manager — ไม่เคยอยู่ใน repo)
5. Release ผ่าน controller เท่านั้น (label `openhands-release` + runner.py) — **ห้ามสร้าง .github/workflows** (เจ้าของสั่งไม่ให้ใช้ GitHub Actions)

## กติกาทอง 5 ข้อ (จาก AGENTS.md — ผูกตามทุกงาน)

1. **Models: Together AI only** — general `deepseek-ai/DeepSeek-V4.1-Flash-1017`, code `zai-org/GLM-5.3-Flash` ห้าม OpenAI/Anthropic เด็ดขาด
2. **ห้าม UI ปลอม / success path ปลอม** — ถ้าทำไม่ได้ต้อง fail ดัง ๆ ด้วยข้อความไทย/อังกฤษชัดเจน
3. ทุก Work task ต้องได้ไฟล์จริง + `verification_report.json` ที่ `mode:"live"` ก่อนขึ้นสถานะ `completed`
4. ก่อนประกาศเสร็จ: `cd apps/web && npm run build` (0 type errors) และ `python scripts/qc.py --only <area>` ต้องผ่าน
5. Deploy เฉพาะด้วยคำสั่งใน `docs/HANDOFF.md` §7 — เปลี่ยน computer-image ทุกครั้งต้อง reset VM

## Backlog ที่ค้างจริง (priority order — อัปเดต 2026-10-31 rev.3)

1. ~~Re-run `python scripts/benchmark_teammate.py`~~ ✅ เสร็จแล้ว (9.00/10 PASS, 14 tasks)
2. Real-microphone spoken test ใน Chrome (server-side verified แล้ว — เหลือทดสอบด้วยไมค์จริง)
3. ย้าย TLS ไป GCP managed certificate บน load balancer เมื่อ ACTIVE (VM Caddy เป็น SPOF อยู่)
4. Billing/payments (owner เลื่อนไว้ก่อน)
5. Manager exec latency spikes (15-17s เป็นครั้งคราว) บน VM woibot-computer-01
6. Per-user tokens สำหรับ computer manager (MANAGER_TOKEN ตอนนี้ shared)

## งานปัจจุบันที่ได้รับมอบหมาย (2026-10-31)

- รับงานพัฒนาต่อจนเสร็จ **และปรับปรุง UX/UI ทั้งหมด** — ห้ามทำ UI ปลอม, ห้ามลด QC gates, ต้องผ่าน build + qc.py + browser ตรวจจริงทุกครั้งก่อน release

## เอกสารอ้างอิง

- `docs/architecture.md` · `docs/capability-matrix.md` · `docs/woibot-prd.md` · `docs/benchmarks/`
- Secrets: env vars เท่านั้น (TOGETHER_API_KEY, PARALLEL_API_KEY, MANAGER_TOKEN, PGPASSWORD, AUTH_SECRET, CRON_SECRET)
- Test account (QC): takin@woibot.com — รายละเอียดใน HANDOFF.md §10