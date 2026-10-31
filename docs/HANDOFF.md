# woibot — HANDOFF (for OpenCode)

**วันที่:** 2026-10-31 (rev.2) · **สถานะ:** production live, QC ผ่านทุกหมวด + computer-use stack ใหม่
**Repo:** `C:/Users/WINDOWS/AppData/Local/hermes/profiles/woibot-com/workspace/woibot`
**GitHub:** https://github.com/Tor2539/woibot (public, branch `main`)
**Prod:** https://woibot.com · API https://woibot-578962358378.asia-southeast1.run.app · Computer https://computer.woibot.com

---

## 1. อ่านก่อนเริ่ม (สำคัญ)

- **ห้ามใช้โมเดลของ OpenAI หรือ Anthropic เด็ดขาด** — ระบบใช้ Together AI เท่านั้น
  - งานทั่วไป/แชท/เอกสาร/รีเสิร์ช/ภาพ/**คุมคอมพิวเตอร์**: `deepseek-ai/DeepSeek-V4.1-Flash-1017` (vision แนบภาพได้)
  - งานโค้ด: `zai-org/GLM-5.3-Flash` + เอนจิน agent-loop ใน container (white-label: "Woibot Coder")
  - Embeddings: BGE-M3 (service ของเราเองบน Cloud Run)
  - ค้นเว็บ: Parallel API (`/v1beta/search`)
- **ห้ามใส่ข้อมูลปลอมใน UI** — ทุกแผงต้องมาจาก API จริง ถ้าไม่มีข้อมูลให้แสดง empty state
- **ทุกงาน Work ต้องมีไฟล์จริง + `verification_report.json` โหมด `live`** ก่อนเป็น `completed`
- Secrets อยู่ใน `secrets.json` / `env.local` ในโฟลเดอร์นี้ (อย่า commit ขึ้น repo public)

## 2. สถาปัตยกรรมที่รันอยู่จริง

```
Browser ──HTTPS──> Caddy (VM 34.21.145.184) ──> Cloud Run woibot (Next.js 15 standalone)
                                                   ├─ Cloud SQL Postgres 16 @ 10.87.0.3 (private, no public IP)
                                                   ├─ Secret Manager (6 secrets)
                                                   ├─ GCS gs://woibot-artifacts-578962358378
                                                   ├─ Cloud Run woibot-embed (BGE-M3, private, 4Gi)
                                                   └─ VPC connector ──> manager :8080 (VM)
                                                                          └─ 1 gVisor container / user
                                                                             Xvfb :99 + Chromium CDP 9222 + noVNC 6080
```

- Cloud Run service `woibot` (asia-southeast1, SA `woibot-web@woibot.iam.gserviceaccount.com`)
- VM `woibot-computer-01` (asia-southeast1-b, e2-standard-2, static `34.21.145.184`, gVisor runsc, Caddy)
- Cloud Scheduler `woibot-routines` ทุก 5 นาที → `/api/cron/run` (header `x-cron-secret`)

## 3. Data layer

`apps/web/lib/pg.ts` — Postgres ตาราง `collection, id, tenant_id, data jsonb` ห่อด้วย API คล้าย Prisma ใน `lib/db.ts`
Model ที่ใช้: teammate, chatMessage, memory, task, deliverable, routine, connectedApp, deliverable, usageEvent, workQuota, vaultSecret

## 4. Harness (หัวใจของ produk)

`POST /api/tasks/{id}/run` → `lib/harness/index.ts#executeTask`

```
ensureComputer(userId)  ← ถ้า container ไม่รัน = งาน fail ทันที (ไม่แกล้งสำเร็จ)
  → runAgentTask() lib/harness/agent.ts
       doc            → LLM JSON spec → DOCX (python zipfile stdlib) + PDF (LibreOffice)
       data           → pandas/openpyxl → report.md + clean.csv + stats.json / .xlsx (สูตรจริง)
       research       → Parallel search → fetch หน้าเว็บจริง → LLM สังเคราะห์ + แหล่งอ้างอิง
       video_analysis → ffprobe + scene detect → ตัดคลิป + analysis.md
       video_gen      → title cards (ImageMagick) + audio bed → MP4 (ffmpeg) + storyboard.json
       image (read)   → tesseract OCR + DeepSeek vision → report.md + PDF
       image (create) → LLM brief → SVG → PNG (1080x1350)
       coding         → GLM เขียน index.html → Chromium screenshot เป็นหลักฐาน
  → deliverable rows (เฉพาะไฟล์ที่ ls เจอจริง)
  → createVerificationReport()  ← รันเครื่องมือจริงใน container (ห้าม hardcode)
  → usageEvent (คิดเงินเฉพาะงานที่ผลิตไฟล์ได้)
```

ไฟล์ที่เกี่ยวข้อง: `lib/harness/{index,agent,container,planner,runner}.ts`, `lib/harness/producers/{documents,media,vision}.ts`, `lib/verification/{live,exec,pipeline,types}.ts`

## 5. สิ่งที่ตรวจแล้วว่าผ่าน (หลักฐานจริง)

| Capability | หลักฐาน |
|---|---|
| Documents | `qc.docx` + `qc.pdf` 5-7 หน้า 470-614 คำ, ดาวน์โหลด 8-12 KB |
| Excel | `qc-excel.xlsx` 25×8 มีสูตร/autofilter, verify ผ่าน pandas |
| CSV | `qc-csv.csv` 10×10, 2.7 KB |
| PDF | จาก DOCX ผ่าน LibreOffice |
| Image read | OCR + vision → PDF 2 หน้า |
| Image create | `qc.png` + `qc.svg` (โปสเตอร์ 1080×1350) |
| Video analyse | `analysis.md` + `probe.json` + `clips/highlight-1.mp4` |
| Video compose | `qc-15.mp4` 16.0s 1920×1080 h264 + storyboard + poster |
| Research | รายงาน 9-10 หัวข้อ 6 แหล่งอ้างอิงจริง |
| Coding | index.html + preview.png (163-342 KB screenshot) |
| Memory search | BGE-M3 ได้ score จริง 0.43/0.33 |
| Team | สร้างกลุ่ม + delegate ข้ามบอทได้คำตอบจริง |
| Voice | `/api/voice/command` → รันคำสั่งใน container จริง |

รันเอง: `python scripts/qc.py` (หรือ `--only doc,xlsx,csv,image`)

## 6. งานที่ยังค้าง (ต้องทำต่อ)

### ผลสนามจริง 5 เอเจนต์ (2026-10-31 รอบที่ 2) — ทุกอย่างแก้แล้ว deploy 00040 + image v10
- **Security ที่เคยรั่ว (แก้แล้ว)**: artifacts PATCH/DELETE ไม่มี auth (ใครก็ลบของใครก็ได้) → ownership checks; chat teammateId ข้ามบัญชี (cross-tenant) → scope ด้วย userId; cron fail-open → fail-closed; billing quota guard ถูก bypass (pg.ts กลืน {increment} เป็น jsonb) → SQL arithmetic จริง + NaN-safe; secrets ไม่เคยออก plaintext
- **Honesty ที่เคยรั่ว (แก้แล้ว)**: Video Studio/CRM demo ปลอมทั้งชุด, ledger $5.75 ปลอม, ปุ่ม Save หลอก, sidebar badge ปลอม, deliverable ปลอมบน files page — ลบ/ต่อ API จริงหมด
- **Stability (แก้แล้ว)**: LibreOffice race (2 งานขนานแย่ง profile ตายเงียบ) → unique profile ต่อ call + verify output + retry; ชื่อไฟล์ชนกัน (`4.docx`) → readable slug + task hash; spreadsheet JSON โดนตัด (budget) → 3 attempts + compact fallback; verification boot-race → exec retry; screen/stats/voice-path fixes; computer-use prompt (append-vs-replace, Return-after-type)
- **Context bug รากฐาน (แก้แล้ว)**: แชทเคยส่งแค่ข้อความปัจจุบันให้โมเดล (stateless ข้ามเทิร์น) → ใส่ประวัติ 10 เทิร์น + กฎสรรพนาม/state-latest-wins — **context_test 5/5** (recall สรรพนาม, inference วันที่, state update, negation)
- **Router (แก้แล้ว)**: จับ "คำกริยาสร้าง + นามผลงาน" ตามที่คนพิมพ์จริง (สร้างเอกสาร/ไฟล์ word/pdf/excel/วิจัย...) + question guard + **แชทสั่ง = รันทันที** — QC router 6/6
- **Computer image v10**: xterm + l3afpad + pcmanfm (คำสั่งเสียง "เปิด terminal/editor/file manager" ใช้ได้จริง)

### ค้างจริง ๆ
1. ทดสอบไมค์จริงใน Chrome (ต้องมีคนพูด — server-side ยืนยันแล้ว)
2. Managed cert บน LB เมื่อ GCP แจ้ง ACTIVE (VM ยังเป็น SPOF ของ TLS)
3. Billing/payment gateway (ผู้ใช้สั่งเลื่อน)
4. Manager exec latency spikes (15-17s บางครั้ง) — ต้องไล่ฝั่ง manager บน VM
5. vncPath ส่ง MANAGER_TOKEN กลับให้ผู้ใช้ (จำเป็นต่อ noVNC แต่ token เดียวใช้ร่วมทุก container — ควรทำ per-user token ฝั่ง manager ในอนาคต)
6. ผล benchmark 9.21/10 ควรรันซ้ำหลัง deploy รอบสนามนี้ (คำตอบแชทฉลาดขึ้นจาก history fix)

### ของใหม่ที่เพิ่มเข้ามา (rev.2)
- **Woibot Coder**: งาน coding ใช้ agent-loop รันใน container ของผู้ใช้ (opencode CLI white-label, โมเดล GLM ผ่าน Together) — รับงานยาว 12 นาที, ผลงาน `coder/<slug>/` + REPORT.md + preview.png, fallback staged generator เมื่อ CLI ไม่มี
- **CursorFX** (`harness/docker/cursorfx.py`): จุดฟ้า+rim ขาวกะพริบทุกครั้งที่คลิก/เลื่อน (mapped window — การวาดลง root window ใช้ไม่ได้ใน Xvfb+fluxbox นี้, พิสูจน์แล้ว)
- **Skills base**: 256 skills ใน `apps/web/data/skills/` (MIT-verified + ชิ้นที่แต่งเอง), auto-select ด้วย BGE-M3+keyword ใน `lib/skills/select.ts`, ฉีดเข้า brief ของงาน doc/coding อัตโนมัติ, sync ต่อได้ด้วย `node scripts/sync-skills.mjs`
- **Memory ML** (`lib/memory.ts`): hybrid recall (recency + BGE-M3 semantic), dedupe cosine ≥0.94, auto-summary ทุกแชท, consolidation >60 rows, งานใหม่ดึงบริบทงานเก่าอัตโนมัติ
- **เอกสาร**: outline → ขยายทีละ section → HTML สวย (ปก/TOC/เลขหน้า/ตาราง) → DOCX+PDF; QC กำหนด ≥7 หน้า ≥1200 คำ
- **Responsive**: dashboard ทุกหน้าใช้ได้จริงตั้งแต่ 360px

## 7. คำสั่ง deploy

```bash
GCLOUD="C:/Users/WINDOWS/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd"
cd C:/Users/WINDOWS/AppData/Local/hermes/profiles/woibot-com/workspace/woibot

# web
"$GCLOUD" builds submit --config=cloudbuild.yaml --project=woibot
"$GCLOUD" run deploy woibot \
  --image=asia-southeast1-docker.pkg.dev/woibot/woibot/web:v1 \
  --region=asia-southeast1 --platform=managed --allow-unauthenticated \
  --service-account=woibot-web@woibot.iam.gserviceaccount.com \
  --add-cloudsql-instances=woibot:asia-southeast1:woibot-pg \
  --vpc-connector=woibot-vpc --vpc-egress=private-ranges-only \
  --set-env-vars=PGHOST=/cloudsql/woibot:asia-southeast1:woibot-pg,PGUSER=woibot_app,PGDATABASE=woibot,MANAGER_URL=http://10.148.0.2:8080,COMPUTER_PUBLIC_ORIGIN=https://computer.woibot.com,NODE_ENV=production,EMBED_URL=https://woibot-embed-578962358378.asia-southeast1.run.app \
  --set-secrets=PGPASSWORD=PGPASSWORD:latest,AUTH_SECRET=AUTH_SECRET:latest,CRON_SECRET=CRON_SECRET:latest,TOGETHER_API_KEY=TOGETHER_API_KEY:latest,PARALLEL_API_KEY=PARALLEL_API_KEY:latest,MANAGER_TOKEN=MANAGER_TOKEN:latest \
  --memory=1Gi --cpu=1 --min-instances=0 --max-instances=10 --timeout=300 --project=woibot

# computer image (ต้อง reset VM หลังเปลี่ยน)
"$GCLOUD" builds submit --config=cloudbuild-computer.yaml --project=woibot
# แก้ tag ใน metadata startup-script แล้ว:
"$GCLOUD" compute instances reset woibot-computer-01 --zone=asia-southeast1-b --project=woibot
```

## 8. กับดักที่เจอมาแล้ว (อย่าเสียเวลาซ้ำ)

- **`gcloud.cmd` บน Windows + bash**: argument ที่มี space/`=` จะถูกตัด → เขียนเป็นไฟล์ `.bat` แล้วเรียกผ่าน `powershell -NoProfile -Command "& 'file.bat'"`
- **Cloud Build ไม่รับ heredoc ใน Dockerfile** → ใช้สคริปต์แยก (ดู `services/embed/download_model.py`)
- **LibreOffice ไม่มี DOCX export filter** ใน image → สร้าง DOCX เองด้วย python stdlib zipfile (`_mkdocx.py`), ใช้ soffice เฉพาะ PDF และต้องมี `HOME=/tmp` + `-env:UserInstallation=file:///tmp/lo`
- **DeepSeek V4.1 Flash บน Together: `response_format: json_object` ทำให้ `content` ว่าง** (JSON ไปอยู่ใน `reasoning_content`) → ห้ามส่ง response_format, สั่งขอ JSON ใน prompt, ตั้ง `max_tokens` ≥ 5,000 (reasoning กินโควตา)
- **Together ปฏิเสธ user-agent ที่ไม่ใช่ browser** (error 1010) → ต้องส่ง header `User-Agent`
- **manager exec ตัด stdout ที่ 20,000 ตัวอักษร** → ไฟล์ใหญ่ต้องอ่านผ่าน `/users/:id/file` (สตรีมจาก bind mount)
- **Caddy ส่ง Host ผิด** → Cloud Run ตอบ 404; ต้อง `header_up Host <run.app>`
- **Container ใหม่ต้องลบ `SingletonLock` ของ Chromium** ไม่งั้น browser ไม่ start (อยู่ใน entrypoint แล้ว)
- **x11vnc ต้องมี `-noxdamage`** ไม่งั้นจอดำ
- **manager exec ตัด stdout ~20k chars (พิสูจน์แล้ว: ภาพ 640px = 12.5KB base64)** → ไฟล์/ภาพใหญ่ให้เขียนลง workspace แล้วดึงผ่าน `/users/:id/file` (ดู `lib/computerUse.ts` grabScreen)
- **วาดลง root window ไม่มีผลใน Xvfb+fluxbox** (fill_rectangle/poly_fill_arc ไม่ raise แต่ไม่ทาสี) → overlay ต้องเป็น mapped override-redirect window (ดู cursorfx.py)
- **เปลี่ยน image tag แล้ว container เก่ายังรันต่อ** → ต้อง `POST /api/computer {"action":"destroy"}` แล้ว `?action=ensure` ใหม่ ไม่งั้น ensure จะ reuse ของเดิม (VM reset อย่างเดียวไม่พอ)
- **GLM-4.5V / Qwen3-VL-235B บน Together ต้อง dedicated endpoint** (serverless ไม่มี) → computer-use ใช้ DeepSeek V4.1 Flash (มี vision, serverless) แทน
- **computer image tag ปัจจุบัน: v9** (xdotool + opencode CLI + python3-xlib + cursorfx) — startup-script บน VM ต้องชี้ tag ตรงกัน (แก้ metadata แล้ว reset)

## 9. ไฟล์สำคัญ

```
apps/web/lib/llm.ts                 LLM router (Together only)
apps/web/lib/search.ts              Parallel search
apps/web/lib/embeddings.ts          BGE-M3 client (identity token จาก metadata server)
apps/web/lib/harness/agent.ts       ตัวสั่งงานจริงทุก kind
apps/web/lib/harness/producers/*    docx/xlsx/csv/poster/video/vision
apps/web/lib/verification/live.ts   ตรวจงานด้วยเครื่องมือจริง
apps/web/lib/computer.ts            control plane ของ Cloud Computer
apps/web/app/api/tasks/[id]/run     endpoint สั่งงาน
apps/web/app/api/tasks/[id]/deliverable  ดาวน์โหลดไฟล์จริง
apps/web/components/voice/*         voice hook
scripts/qc.py                       QC gate (exit 0 = ผ่าน)
services/embed/                     BGE-M3 service
harness/docker/                     computer image (Dockerfile, supervisord, entrypoint)
```

## 10. บัญชีทดสอบ

- Email: `takin@woibot.com` · Password: `Woibot-Strong-Pass-2026` (ใช้ใน QC; เปลี่ยนได้ถ้าต้องการ)
- Computer container ของบัญชีนี้: `woibot-u-d8f26fe02a5d` (port 6339, CDP 7339)
