---
id: wb-deployment-checklist
name: Deployment Checklist
description: Runs a pre-deploy and post-deploy checklist covering build, config, migrations, smoke tests, monitoring, and rollback readiness. Use for production releases of apps and services.
tags: [ops, devops, quality]
---

# Deployment Checklist

Deployments go wrong on the boring steps. The checklist makes the boring steps non-optional.

## Pre-deploy

1. Version and artifacts pinned: what exact build is going out (commit, image tag), built from a clean checkout; note the previous version for rollback.
2. Config diff reviewed: environment variables, feature flags, and secrets for the target environment — no missing, no surprising new defaults.
3. Migrations: reviewed, reversible where possible, tested against a production-like dataset, and the order relative to code deploy decided (backward-compatible first).
4. Dependencies of the release verified: downstream services informed if contracts changed; permissions for service accounts correct.
5. Team ready: deploy window chosen, owner named, second person available for verification, on-call aware.

## Deploy

6. Deploy during the chosen window; watch the rollout progress and the first error rates/latency in real time rather than assuming success from a green pipeline.
7. Smoke test the critical user paths immediately after deploy (login, core action, payment path as applicable) with a real account.

## Post-deploy

8. Monitor for the agreed soak period (30-60 min minimum for meaningful changes): error rate, latency, key business metric.
9. Verify rollback readiness one last time: the previous version's artifacts still available and the rollback command known.
10. Close out: changelog updated, deployment noted in the team channel with version and owner, any anomalies logged as issues while fresh.

## Checks

- Rollback tested or explicitly accepted as a risk, in writing.
- Smoke tests passed against production, not staging.