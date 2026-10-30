# woibot.com — Teammate + Work

**Your Personal AI Team That Actually Gets Work Done.**

| Product | Role | Runtime | Cost model |
|---|---|---|---|
| **Teammate** | AI ผู้ช่วยส่วนตัว 24h — Memory, Connected Apps, Routines, Cloud Computer | Cloud only | Subscription |
| **Work** | ลงมือทำจริง — Coding / Docs / Video / Research / Data | Cloud หรือ Local | Metered per task, มี cap |

Core loop: `สั่งงาน → ลงมือทำ → ตรวจสอบ → ส่งมอบ → ทำงานต่อ`

## Live production

| Surface | URL |
|---|---|
| App | https://woibot.com |
| API | https://woibot-578962358378.asia-southeast1.run.app |
| Cloud Computer host | https://computer.woibot.com/health |
| Repo | https://github.com/Tor2539/woibot |

## Architecture (as deployed)

```
Browser ──TLS──> Caddy (VM) ──> Cloud Run (Next.js 15 standalone)
                                   │
                                   ├─ Cloud SQL Postgres 16 (private 10.87.0.3, no public IP)
                                   ├─ Secret Manager (API keys, AUTH_SECRET, CRON_SECRET)
                                   ├─ GCS  gs://woibot-artifacts-578962358378
                                   └─ VPC connector ──> manager :8080 (VM)
                                                          └─ 1 gVisor container / user
                                                             Xvfb + Chromium CDP:9222
                                                             noVNC :6080  (user takeover)
```

- **Auth:** cookie session (jose HS256, 30 days), bcrypt, per-tenant isolation by `userId` on every row.
- **Store:** `lib/pg.ts` — Postgres `collection, id, tenant_id, data jsonb`; JSON file fallback for local dev only.
- **Cloud Computer:** one `runsc` container per user, capped CPU/RAM, restarted on demand; `computer.woibot.com/users/<id>/vnc/...` gives browser takeover.
- **Routines:** Cloud Scheduler `woibot-routines` every 5 min → `POST /api/cron/run` (header `x-cron-secret`).
- **Cost isolation:** Teammate = subscription quota; Work = estimate + `perTaskCap` + `monthlyCap` gates in `lib/work/estimates.ts`.

## Verification is real, not decorative

`apps/web/lib/verification/live.ts` runs open-source tooling **inside the user's own container** and only passes on real evidence:

| Type | Executed | Evidence |
|---|---|---|
| Coding | `tsc --noEmit`, `npm test`, `npm run build` | exit codes + output tail |
| Document | LibreOffice headless → PDF, `pdfinfo`, `pdftotext` | page count, word count |
| Video | `ffprobe` (format + streams) | duration, codec, resolution, fps, audio, subtitle |
| Data | `pandas` / `openpyxl` | rows × cols, null ratio |
| Research | regex over deliverable | sources, headings, words |

If the container is unreachable the report returns `mode:"unavailable"` with a failed critical check — a task can never reach `completed` on a fabricated pass. Verified example (production):

```
mode=live passed=true  Video verified with ffprobe — 6.0s, 1280x720, h264
  PASS file_readable  /home/woibot/workspace/out.mp4 — 0.14 MB
  PASS duration       6.00s     PASS video_stream  h264 1280x720 @30 yuv420p
  PASS audio_stream   aac 44100Hz 1ch
```

Full component list and licenses: [docs/open-source-stack.md](docs/open-source-stack.md).

## Local development

```bash
pnpm install
cp apps/web/.env.example apps/web/.env     # optional: no DB → JSON store
pnpm --filter @woibot/web dev              # http://localhost:3000
pnpm --filter @woibot/web build
```

## Deploy

```bash
# web image → Cloud Run
gcloud builds submit --config=cloudbuild.yaml --project=woibot
gcloud run deploy woibot --image=asia-southeast1-docker.pkg.dev/woibot/woibot/web:v1 ...

# computer image → Artifact Registry, then VM pulls on boot
gcloud builds submit --config=cloudbuild-computer.yaml --project=woibot
```

VM bootstrap is idempotent (`/var/lib/woibot/bootstrapped-v3`): Docker, gVisor, Caddy, Redis, manager service, image pull.

## Navigation

`/` → `/teammate` → `/work` → `/work/[id]` → `/tasks` → `/files` → `/computer` → `/routines` → `/apps` → `/team` → `/settings`

## Not built yet

Billing/card charges (deferred by decision), hosted video-generation models, orgs/SSO.
