---
id: wb-runbook-writer
name: Runbook Writer
description: Writes operational runbooks for recurring tasks and failure modes: purpose, prerequisites, numbered procedure with verification, and rollback. Use for deployments, maintenance, and on-call operations.
tags: [ops, devops, documentation]
---

# Runbook Writer

A runbook is executed at 2am by someone half-awake. Assume nothing is remembered; verify everything written.

## Steps

1. Header: what this runbook does, when to run it (trigger/schedule), expected duration, and who is authorized. If it has a schedule, say which system enforces it.
2. Prerequisites checklist: access needed, systems that must be up, capacity or quota headroom, and the backup/snapshot to take first. A runbook without its prerequisites fails at step 3.
3. Numbered procedure: one command or action per step with the exact command to copy-paste (no "restart the service" — the actual command, with the actual service name), plus the expected output of that command so the executor knows it worked.
4. Verification step after each significant phase: the exact check (health endpoint, log line, metric) that proves the phase succeeded. "Continue" without evidence is how partial failures compound.
5. Rollback section: the decision criteria (when to stop and roll back) and the exact rollback steps, tested at least once. An untested rollback is a rumor.
6. Failure appendix: the 3-5 most likely failure modes, the symptom to look for, and the first action for each. When unknown, the escalation contact and what information to bring.
7. Keep it current: after every execution note date + executor at the bottom; after any system change, update the commands and re-test. A stale runbook is more dangerous than none.
8. Store where it will be found during the incident (linked from the alert or dashboard), not in a folder nobody opens.

## Checks

- Every step has expected output and a verification.
- Rollback steps exist and have been executed at least once.