# woibot — capability matrix & open-source stack (live, verified)

อัปเดตล่าสุด: 2026-10-31 · ทุกบรรทัดคือสิ่งที่รันจริงใน production

## 1. Models (Together AI only — ไม่ใช้ OpenAI/Anthropic)

| งาน | Model | เรียกจาก |
|---|---|---|
| งานทั่วไป / แชท / เอกสาร / Research / OCR summary | `deepseek-ai/DeepSeek-V4.1-Flash-1017` | `lib/llm.ts` (`MODELS.general`) |
| Code / refactor / สร้างแอป | `zai-org/GLM-5.3-Flash` | `lib/llm.ts` (`MODELS.code`) |
| อ่านภาพ (vision) | `deepseek-ai/DeepSeek-V4.1-Flash-1017` + image_url data URL | `lib/harness/agent.ts` → `produceImageReport` |
| Embeddings | **BGE-M3** (self-hosted service `services/embed` on Cloud Run) | `lib/embeddings.ts` |
| Web search | **Parallel Fast** `POST https://api.parallel.ai/v1beta/search` | `lib/search.ts` |

หมายเหตุ: Together ปฏิเสธ user-agent ที่ไม่ใช่ browser (error 1010) — client ต้องส่ง `User-Agent` เสมอ

## 2. Harness — executor จริงต่อผู้ใช้

```
POST /api/tasks/{id}/run
   └─ executeTask()  lib/harness/index.ts
        ├─ ensureComputer(userId)        ← ถ้า container ไม่รัน = งาน fail ทันที (ไม่แกล้งสำเร็จ)
        ├─ runAgentTask()  lib/harness/agent.ts
        │     ├─ doc     → LLM → DOCX (stdlib zipfile) + PDF (LibreOffice)
        │     ├─ data    → pandas/openpyxl → report.md + clean.csv + stats.json (+ .xlsx)
        │     ├─ research→ Parallel search → fetch หน้าเว็บจริง → LLM สังเคราะห์ + แหล่งอ้างอิง
        │     ├─ video_analysis → ffprobe + scene detect → ตัดคลิปจริง + analysis.md
        │     ├─ image   → tesseract OCR + DeepSeek vision → report.md + PDF
        │     └─ coding  → GLM เขียนแอป → Chromium headless screenshot เป็นหลักฐาน
        ├─ deliverable rows (เฉพาะไฟล์ที่ `ls -l` เจอจริง)
        ├─ createVerificationReport()    ← รันเครื่องมือจริงใน container
        └─ usageEvent (คิดเงินเฉพาะงานที่ผลิตไฟล์ได้)
```

- `video_gen` และ `media_heavy` = **ปิดไว้อย่างตรงไปตรงมา** (ยังไม่มีโมเดลสร้างวิดีโอจริง) → งานจบเป็น `failed` พร้อมเหตุผล ไม่มีผลงานปลอม
- ทุกงานต้องได้ `verification_report.json` แบบ `mode:"live"`; ถ้า container ล่ม → `mode:"unavailable"` + critical fail

## 3. Open-source ที่ใช้จริง

| Layer | Component | License | ใช้ทำอะไร |
|---|---|---|---|
| Runtime | Next.js 15, PostgreSQL 16, gVisor (runsc), Docker, Caddy, noVNC, Xvfb, x11vnc, fluxbox, Chromium | MIT / PostgreSQL / Apache-2.0 / MPL-2.0 / GPL-2.0 | web, DB, isolation, TLS, remote screen |
| Docs | LibreOffice (writer/calc/impress), poppler-utils, python3 stdlib `zipfile` (DOCX writer) | MPL-2.0 / GPL-2.0 / PSF | แปลง/ตรวจ PDF, สร้าง DOCX โดยไม่พึ่ง pip |
| Data | pandas, openpyxl | BSD-3 / MIT | อ่าน CSV/XLSX, สร้างสเปรดชีต |
| Media | FFmpeg, ImageMagick | LGPL/GPL / ImageMagick | ตัดคลิป, ตรวจ duration/codec, ย่อภาพ |
| Vision | Tesseract OCR (+tha/eng) | Apache-2.0 | OCR ภาษาไทย/อังกฤษ |
| Browser | Chromium headless | BSD-3 | screenshot หลักฐานว่าแอปเรนเดอร์ได้ |
| Search | Parallel API (managed) | — | ค้นเว็บจริง |
| Embeddings | BGE-M3 (self-host, OpenRAIL-M) | MIT | memory search แบบ semantic |

## 4. QC gate

```bash
python scripts/qc.py                # ทุกหมวด
python scripts/qc.py --only doc,image
```

ตรวจ: auth → computer running → สร้าง/รันงานแต่ละประเภท → ไฟล์มีจริง → ดาวน์โหลดได้ → verification live ผ่าน → chat/vision/voice/team
exit 0 = ผ่านทั้งหมด; รายงานจะพิมพ์ PASS/FAIL พร้อมหลักฐานทุกบรรทัด
