# woibot — Open-source stack (what is actually wired)

ทุกบรรทัดในเอกสารนี้คือสิ่งที่รันอยู่จริงในระบบ ไม่ใช่รายการ "น่าจะใช้"
เป้าหมาย: ให้ต้นทุนต่ำตั้งแต่วันแรก และให้ทุกงานมีเครื่องมือตรวจสอบที่พิสูจน์ได้

## 1. Runtime / platform

| Component | License | Where it runs | Why this one |
|---|---|---|---|
| Next.js 15 (App Router) | MIT | Cloud Run (`woibot`), image `asia-southeast1-docker.pkg.dev/woibot/woibot/web` | SSR + API routes in one artifact, standalone output keeps image small |
| PostgreSQL 16 (Cloud SQL) | PostgreSQL License | Private IP `10.87.0.3`, VPC connector | Durable store; jsonb collection rows keep the data layer cheap to evolve |
| gVisor (`runsc`) | Apache-2.0 | Compute Engine `woibot-computer-01` | Per-user kernel isolation for the Cloud Computer without per-user VMs |
| Docker Engine | Apache-2.0 | same VM | One container per user, `--memory/--cpus` capped, restarted on demand |
| Caddy 2 | Apache-2.0 | VM, `computer.woibot.com` | Automatic TLS + reverse proxy, zero config |
| noVNC + websockify | MPL-2.0 / BSD | inside each user container (:6080 → 5900) | Browser-based screen takeover, no client install |
| Xvfb + fluxbox + x11vnc | MIT / GPL-2.0 / GPL-2.0 | inside each container | Headful Chromium the agent can drive and the user can watch |
| Chromium (CDP :9222) | BSD-3-Clause | inside each container | Real browser for sites without an API |
| Redis 7 | BSD-3-Clause | VM, loopback only | Manager state + future queue backend |
| Cloud Scheduler | (managed) | `woibot-routines` every 5 min → `/api/cron/run` | Routines execute without a browser open |

## 2. Verification tooling (the differentiator)

Every Work task must produce evidence before it can reach `completed`.
`apps/web/lib/verification/live.ts` runs these inside the **user's own** container:

| Task type | Tools actually executed | Checks produced |
|---|---|---|
| Coding | `tsc --noEmit`, `npm test --if-present`, `npm run build --if-present` | typecheck / tests / build exit codes + tail of real output |
| Documents | LibreOffice headless (`soffice --convert-to pdf`), `pdfinfo`, `pdftotext` | file opens, page count, extracted word count |
| Video | `ffprobe` (JSON: format + streams) | bytes, duration vs requested, codec/resolution/fps/pix_fmt, audio stream, aspect, subtitle stream |
| Data | `pandas` (CSV/XLSX via `openpyxl`) | parses, rows × cols, null ratio |
| Research | Python regex over the deliverable | word count, heading count, unique source URLs |

Licenses: FFmpeg (LGPL/GPL), LibreOffice (MPL-2.0), poppler (GPL-2.0), pandas (BSD-3), openpyxl (MIT), Tesseract (Apache-2.0), ImageMagick (ImageMagick License).

Extra media/OCR binaries baked into the image for agent use: `tesseract-ocr` (+ `tha`, `eng`), `imagemagick`, `poppler-utils`.

**Honesty rule:** if the container is unreachable, the report comes back `mode: "unavailable"` with a failed critical check — never a fabricated pass.

## 3. What is deliberately not built yet

- Billing/charges (postponed by decision). Cost *isolation* exists: Teammate runs on subscription quota, Work is metered per task with a per-task cap (`perTaskCap`) and a monthly cap, enforced in `apps/web/lib/work/estimates.ts` + `/api/tasks`.
- Video generation models (Seedance/Runway class) — cost is quoted and gated before running.
- Multi-user orgs / SSO.

## 4. Cost posture

- Cloud Run scales to zero (`min-instances=0`).
- One shared VM hosts many isolated containers instead of one VM per user.
- Postgres `db-f1-micro` + jsonb rows instead of a wide schema.
- Artifacts in GCS (`woibot-artifacts-578962358378`), not in the database.
