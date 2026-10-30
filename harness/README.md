# woibot Harness

Harness คือ execution layer ที่รันงาน Work จริง — ไม่ใช่แค่ UI

## Architecture

```
User Intent → Intent Router → Teammate (chat)
                           → Work (harness execution)
                                    │
                          ┌─────────┴─────────┐
                          │   Harness Manager  │
                          │  (Node + BullMQ)  │
                          └─────────┬─────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
       Cloud Computer         Verification         Billing (isolated)
       per-user Docker        per-type checks      Teammate vs Work
       + Browser (CDP)        + evidence           + estimate gate
       + noVNC TakeOver       + report.json        + caps
```

## Components

1. **Cloud Computer** (`harness/docker/`)
   - 1 user = 1 container (isolated, persistent volume)
   - Base image: `woibot/computer:base` (Ubuntu + Chromium + Node + Python + FFmpeg + LibreOffice)
   - Resources: cgroup limits per plan (Free 0.5CPU/1GB, Starter 1CPU/2GB, Pro 2CPU/4GB)
   - Browser: Chromium with persistent profile + CDP endpoint :9222
   - File relay: S3-compatible (R2/MinIO) mount at /home/woibot/workspace
   - Supervision: Docker restart policy + health check

2. **Execution Engine** (`apps/web/lib/harness/`)
   - Queue: BullMQ + Redis (or in-memory for dev)
   - Executor: picks job, creates container if needed, runs steps
   - Planner: breaks goal into steps (LLM + template)
   - Runner: executes shell/JS/browser actions in container
   - Checkpointer: saves progress, resume from pause

3. **Verification Pipeline** (`apps/web/lib/verification/`)
   - Coding: typecheck + tests + preview smoke + deliverable openable
   - Docs: LibreOffice open + page/layout/toc/charts check + preview
   - Video: ffprobe + thumbnail strip + subtitle sync + project file
   - Outputs: verification_report.json + evidence screenshots/files

4. **TakeOver** (`apps/web/components/harness/`)
   - noVNC view of container desktop
   - Collaborative cursor, pause/resume
   - User can intervene, then handoff back to AI

5. **Local Mode**
   - woibot CLI (`harness/scripts/woibot-local.js`) runs on user machine
   - Connects via WebSocket to control plane, executes locally
   - Never auto-uploads files without consent, respects `must_not_leak` constraints

## Cost Isolation

- Teammate ledger vs Work ledger (separate tables, separate quotas)
- Every Work task gets estimate before start (tokens + gpu_seconds + build_minutes)
- Caps: per_task_cap + monthly_cap, exceed → pause waiting_for_user
- Video GPU pool separate from Teammate CPU pool

## Status Flow (10 states)

Queued → Planning → In Progress → Waiting for User → Paused → Reviewing → Completed
                                   ↘ Failed / Cancelled / Partially Completed

