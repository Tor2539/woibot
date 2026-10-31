# woibot — HANDOFF (for OpenCode)

**วันที่:** 2026-10-31 · **สถานะ:** production live, QC ผ่านทุกหมวด
**Repo:** `C:/Users/WINDOWS/AppData/Local/hermes/profiles/woibot-com/workspace/woibot`
**GitHub:** https://github.com/Tor2539/woibot (public, branch `main`, HEAD `826eff1`)
**Prod:** https://woibot.com · API https://woibot-578962358378.asia-southeast1.run.app · Computer https://computer.woibot.com

---

## 1. อ่านก่อนเริ่ม (สำคัญ)

- **ห้ามใช้โมเดลของ OpenAI หรือ Anthropic เด็ดขาด** — ระบบใช้ Together AI เท่านั้น
  - งานทั่วไป/แชท/เอกสาร/รีเสิร์ช/ภาพ: `deepseek-ai/DeepSeek-V4.1-Flash-1017`
  - งานโค้ด: `zai-org/GLM-5.3-Flash`
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

1. **noVNC ควบคุมเมาส์/คีย์บอร์ด**: WS handshake 101 ผ่าน, RFB banner มาถึง แต่ client โชว์ error — ตอนนี้ใช้ภาพหน้าจอสด (`/api/computer?action=screen&raw=1`, JPEG 640px รีเฟรช 8 วิ) แทน. จุดที่ควรไล่: path ของ websockify ผ่าน manager proxy, HTTP/1.1 vs h2, `-noxdamage` ของ x11vnc
2. **ไมโครโฟนจริง**: hook + API พร้อม แต่ยังไม่มีใครทดสอบด้วยเสียงจริงในเบราว์เซอร์ (ต้อง HTTPS + user gesture)
3. **Managed cert บน Load Balancer**: `FAILED_NOT_VISIBLE` — TLS ปัจจุบัน terminate ที่ Caddy บน VM (VM เป็น SPOF ของหน้าเว็บ); LB + NEG สร้างไว้แล้ว สลับได้เมื่อ cert ACTIVE
4. **Billing/ตัดบัตร**: ยังไม่ต่อ payment gateway (ผู้ใช้สั่งเลื่อน) — แต่ quota/cap ทำงานแล้ว
5. **Voice action turns** ไม่ถูกบันทึกเป็น ChatMessage (หายเมื่อ reload) — route `/api/voice/command` ต้องเพิ่ม persistence ถ้าต้องการ history

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
