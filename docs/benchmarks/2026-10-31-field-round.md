# woibot Teammate Benchmark Report

- **Base:** https://woibot.com
- **Judge model:** `deepseek-ai/DeepSeek-V4.1-Flash-1017` (Together AI, strict rubric + objective checks)
- **Runs:** 1 × 14 tasks across 6 categories
- **Test account:** takin@woibot.com
- **Generated:** 2026-10-31T08:24:57+00:00 (UTC)
- **Threshold:** 9.0/10 (grok-bot level)

## Result: **9.00 / 10** → **PASS** ✅

## Category breakdown

| Category | Score | Tasks |
|---|---|---|
| factual-knowledge | 9.00 | fk1, fk2, fk3 |
| thai-writing | 8.00 | tw1, tw2 |
| data-analysis | 9.00 | da1, da2 |
| web-research | 9.00 | wr1, wr2 |
| reasoning-math | 10.00 | rm1, rm2 |
| teamwork | 9.00 | tm1, tm2, tm3 |

## Per-task detail

| # | Task | Category | Score | Latency | Objective checks | Judge note |
|---|---|---|---|---|---|---|
| 1 | เมืองหลวงออสเตรเลีย (fk1) | factual-knowledge | 8.0 | 3373 ms (p50 3373) | 3/3 hard | ถูกครบ 3 ประเด็น กระชับ ภาษาไทยลื่น แต่มีจุดเล็กน้อย: เขียนติดกัน 'เขตAustralian' และไม่ได้ระบุปี 1908/บริบทสหพันธ์ชัด |
| 2 | อะพอลโล 11 (fk2) | factual-knowledge | 10.0 | 3764 ms (p50 3764) | 4/4 hard | ถูกต้องครบทั้ง 4 ข้อ กระชับ ภาษาไทยลื่นไหล มีชื่ออังกฤษกำกับและระบุยาน Columbia เพิ่มความสมบูรณ์ ไม่มีข้อผิดพลาด |
| 3 | ปรากฏการณ์เรือนกระจก (fk3) | factual-knowledge | 9.0 | 2657 ms (p50 2657) | 3/4 hard | ครบทั้ง 3 ประเด็น ถูกต้องแม่นยำ (กลไก/CO₂/ดาวศุกร์ 465°C) ภาษาไทยลื่นไหล ผลตรวจ CO2 ที่ FAIL เป็นเพียงสคริปต์จับ 'CO2' ไม่เจออักขระตัวห้อย C |
| 4 | จดหมายแสดงความเสียใจ (tw1) | thai-writing | 9.0 | 3895 ms (p50 3895) | 2/2 hard | โทนจริงใจ อบอุ่น ภาษาไทยสุภาพลื่นไหล ไม่มี AI-slop ความยาวใกล้เคียง 4-6 บรรทัด มีหมายเหตุการใช้งานที่ชาญฉลาด (ส่งจากผู้รู้จักจริง ไม่แนบเรื่ |
| 5 | ประกาศซ่อมบำรุงลิฟต์ (tw2) | thai-writing | 7.0 | 4174 ms (p50 4174) | 7/7 hard | เนื้อหาครบตาม ground truth โครงสร้างดีและเป็นทางการ แต่มีคำต่างประเทศหลุด 'berikut' (อินโดนีเซีย) และแนะนำให้ใช้ 'บันไดหนีไฟ' เป็นทางเดินปกต |
| 6 | ตารางรายได้/ค่าใช้จ่าย 6 เดือน (CSV inline) (da1) | data-analysis | 8.0 | 4355 ms (p50 4355) | 4/4 hard | ตัวเลขกำไรและข้อสรุปถูกต้อง วิธีคิดชัด แต่มีจุดพลาด: อ้าง 'ธ.ค.' แทน ม.ค. ในข้อ 2, สูตร linear 50%÷5=10% อธิบายวกวน และปิดท้ายด้วยการอ้างไฟล |
| 7 | ตารางการเบิกเงินทีม (CSV inline) (da2) | data-analysis | 10.0 | 3568 ms (p50 3568) | 6/6 hard | ตัวเลขถูกครบทุกข้อ แสดงวิธีคิดบวกและหารชัดเจน กระชับ อ่านง่าย ไม่มีข้อผิดพลาด |
| 8 | ราคาน้ำมันดิบ WTI (สด) (wr1) | web-research | 9.0 | 4218 ms (p50 4218) | 2/2 hard | ซื่อสัตย์ว่าไม่มีราคาสด ไม่เดาตัวเลข ให้แหล่งอ้างอิง 4+ แหล่งเป็นรูปธรรม พร้อมกรอบปัจจัยขับเคลื่อนสัปดาห์นี้และข้อเสนอช่วยดึงข้อมูล ภาษาไทยล |
| 9 | หุ้น NVDA ล่าสุด (สด) (wr2) | web-research | 9.0 | 5022 ms (p50 5022) | 2/2 hard | ซื่อสัตย์ว่าไม่มีข้อมูลสด ไม่เดาราคา ให้บริบทความรู้เดิมที่ถูกต้องพร้อมเตือนอาจล้าสมัย และแนะนำแหล่งติดตาม 3 แหล่งชัดเจน ภาษาไทยลื่นไหล มีปร |
| 10 | โจทย์น้ำหนัก 3 กล่อง (rm1) | reasoning-math | 10.0 | 2220 ms (p50 2220) | 4/4 hard | ถูกต้องครบ ตั้งตัวแปรชัด สมการและตรวจสอบย้อนกลับครบ กระชับ ตรงตามที่โจทย์ต้องการ |
| 11 | เหรียญไม่เที่ยง โอกาสหัว >= 3 จาก 5 ครั้ง (rm2) | reasoning-math | 10.0 | 2826 ms (p50 2826) | 2/2 hard | ใช้ทวินามถูกต้อง แสดงทุกเทอมครบ ผลรวม 0.68256 แปลงเป็น 68.3% ตรงตามเฉลย โครงสร้างชัดเจน กระชับ ไม่มีข้อผิดพลาด |
| 12 | สร้างห้องกลุ่ม 3 บอทจริง (tm1) | teamwork | 9.0 | 142 ms (p50 142) | 2/2 hard | สร้างกลุ่มสำเร็จ ok=true, id ขึ้น grp_, ชื่อตรง, สมาชิก resolve ครบ 3 ตัวตรงเป๊ะ ไม่มีบอทปลอม, memories ว่างสมเหตุสมผล; จุดเล็กน้อยคือ respo |
| 13 | แชร์กฎทีมเข้ากลุ่ม + ตรวจการมองเห็น (tm2) | teamwork | 9.0 | 7049 ms (p50 7049) | 2/2 hard, 0/1 advisory | แชร์กฎสำเร็จ scope=team, groupId ตรง, attribute ถึง Woibot Main, และยืนยันด้วย GET ว่าเห็นในกลุ่ม; จุดที่ขาดคือไม่ได้รายงานผล search ซึ่งเป็ |
| 14 | มอบงานข้ามบอทภายในกลุ่ม (tm3) | teamwork | 9.0 | 1722 ms (p50 1722) | 7/7 hard | ตัวเลขถูกต้องครบ (กำไร 22,500 / 26.79%) ภาษาไทยลื่น มีบรรทัด HAND-BACK และสรุปตามกฎทีม ตรงบทบาทผู้รับงาน จุดเล็กน้อยคือรวมบรรทัด HAND-BACK ก |

## Latency (POST /api/chat + team ops, per task run)

- mean 3499 ms · p50 3666 ms · max 7049 ms

## Methodology

1. **Flow** — login (`POST /api/auth/login` → `wb_session` cookie) → 14 tasks; chat tasks via `POST /api/chat` (240 s timeout, latency recorded), teamwork tasks against the real `/api/team/groups`, `/api/team/delegate`, `/api/memories/search` endpoints using teammate ids discovered from `GET /api/chat`.
2. **Rubric judge** — every task is scored 0-10 by the Together LLM with embedded ground truth (key facts), expected qualities, and objective-check evidence. Anchors: 9-10 = correct, complete, grok-level structure/fluency; 0-2 = empty, error text, evasive or heavily hallucinated. For live-info tasks, honest limitation + credible source suggestions score well; confident fabrication of current numbers scores 0-3.
3. **Objective checks** — keyword groups (key facts/numbers must appear), Thai-character ratio, minimum length, ≥2 source mentions for research tasks, HAND-BACK line and `memoriesUsed` for delegation, exact member resolution and memory visibility for group ops. Advisory checks (e.g., semantic search availability) are reported but not graded.
4. **Final score** — mean of all task scores (per run, then across runs). PASS iff total ≥ 9.0 with zero missing scores. No score is ever fabricated: API/judge failures surface as `NULL` and exit code 3.
5. **Router note** — chat prompts are deliberately phrased to stay on the teammate direct-answer path; the script lints every prompt against `routeIntent()`'s work-trigger regex and records `routed_to_work` if the canned handoff path ever fires.
6. **Cleanup** — the benchmark group + shared rule created for teamwork tasks are deleted after each run (unless `--keep-artifacts`).

