# woibot.com — Teammate + Work

> **Your Personal AI Team That Actually Gets Work Done.**

Nymoru Vision → woibot rebrand. Two-product platform:

| Product | Role | Env | Pricing |
|---------|------|-----|---------|
| **Teammate** | AI ผู้ช่วยส่วนตัว 24h, Memory, Connected Apps, Routines | Cloud Only | Subscription (Free/Starter 399฿/Pro 999฿) |
| **Work** | ลงมือทำจริง — Coding / Docs / Video / Research / Data | Cloud or Local | Metered (estimate ก่อนเริ่ม, cap ได้) |

**Core loop:** `สั่งงาน → ลงมือทำ → ตรวจสอบ → ส่งมอบ → ทำงานต่อ` — ดีมากตั้งแต่วันแรก

## Quick Start

```bash
pnpm install
cp apps/web/.env.example apps/web/.env
pnpm --filter @woibot/web db:push   # create SQLite dev.db + generate client
pnpm --filter @woibot/web db:seed   # seed demo user + tasks (optional)
pnpm dev                              # http://localhost:3000
pnpm build                            # verify 23 routes
```

## Architecture

- **Frontend:** Next.js 15 App Router + Tailwind + shadcn/ui (Geist, #f5f5f3 #0d0d0d #1757d7)
- **DB:** Prisma + SQLite (dev) / Postgres (prod, RLS-ready)
- **Harness:** `lib/harness/*` — Docker per-user Cloud Computer + BullMQ queue + Planner/Runner/Checkpointer + noVNC TakeOver
- **Verification:** `lib/verification/pipeline.ts` — per-type checks (coding: tsc+tests+playwright, doc: LibreOffice, video: ffprobe+thumbs+subs) → `verification_report.json`
- **Billing:** `lib/billing/*` — Teammate subscription vs Work meter (6 kinds), `estimateTask()` + quota gates, separate ledgers
- **Handoff:** Seamless Teammate↔Work via `HandoffPacket` (goal, context, attachments, deliverables, constraints, verification criteria, trace_id)
- **Docker:** `harness/docker/Dockerfile` — Ubuntu + Chromium + CDP :9222 + novnc :6080 + supervisor

## Navigation (9 sections per PRD)

`/` (landing) → `/teammate` → `/work` → `/work/[id]` → `/tasks` → `/files` → `/computer` → `/routines` → `/apps` → `/team` → `/settings`

## Cost Isolation (PRD 12)

Every Work task shows `estimated_cost + estimated_time + required_tools` before start.
User sets `perTaskCap` + `monthlyCap` — exceed → pause `waiting_for_user`.
Video GPU pool separate from Teammate CPU pool.

## Deploy

```bash
# Vercel (Postgres via Supabase)
vercel --prod   # set DATABASE_URL to Postgres, keep .env.example as ref

# Docker (harness)
docker build -t woibot/computer:base harness/docker/
docker run -d --name woibot-user1 -p 9222:9222 -p 6080:6080 -v woibot-vol:/home/woibot woibot/computer:base
```

## Docs

- `docs/woibot-prd.md` — Full PRD (TH, 984 lines)
- `docs/architecture.md` — System + cost isolation design
- `docs/billing.md` — Monetization
- `harness/README.md` — Execution layer

