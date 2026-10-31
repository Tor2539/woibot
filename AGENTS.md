# AGENTS.md — woibot (continuation brief)

You are continuing **woibot** — a production AI teammate + work-execution platform.

Start here: **`docs/HANDOFF.md`** (architecture, verified state, backlog, deployment commands, pitfalls).
Secrets are provided as environment variables (TOGETHER_API_KEY, PARALLEL_API_KEY, MANAGER_TOKEN, PGPASSWORD, AUTH_SECRET, CRON_SECRET). Do not hardcode or commit them.

## Hard rules
1. Models: Together AI only — general `deepseek-ai/DeepSeek-V4.1-Flash-1017`, code `zai-org/GLM-5.3-Flash`. Never OpenAI/Anthropic.
2. No fabricated UI data and no fake success paths. If something cannot run, fail loudly with a clear Thai/English message.
3. Every Work task must produce real files plus `verification_report.json` with `mode:"live"`.
4. Before claiming done: `cd apps/web && npm run build` (0 type errors) and `python scripts/qc.py --only <area>` must pass.
5. Deploy only with the commands in `docs/HANDOFF.md` §7. After any computer-image change, reset the VM.

## Current state (verified 2026-10-31, rev.2)
QC gates live: documents (docx+pdf, >=7 pages), xlsx, csv, image-read, image-create, video-compose, video-analyze, research, coding (Woibot Coder agent loop), chat, vision, voice command (+ persistence into ChatMessage), team groups + cross-bot delegation, BGE-M3 memory recall, computer geometry/input/computer-use agent.

## Backlog (priority order)
1. Run `python scripts/benchmark_teammate.py` against prod; iterate until >= 9/10.
2. Real-microphone spoken test in Chrome (server side already verified).
3. Move TLS to the GCP managed certificate on the load balancer when it becomes ACTIVE.
4. Billing/payments (deferred by the owner).

## Commands
```
cd apps/web && npm run build      # typecheck + build
python scripts/qc.py             # full QC gate (exit 0 = pass)
```
