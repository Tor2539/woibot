---
id: wb-release-readiness-review
name: Release Readiness Review
description: Runs a pre-release gate across functionality, data, performance, rollback, and communication, producing a go/no-go with evidence per criterion. Use before deploying features, migrations, or launches.
tags: [qa, devops, quality]
---

# Release Readiness Review

A release gate works only with evidence per criterion, not vibes. No evidence = not ready.

## Steps

1. List the release contents: features, fixes, migrations, config changes. Each item gets an owner and a verification status.
2. Functionality: P1 test cases passed on the staging environment that matches production as closely as possible; record the actual run date and result, not "tested" as a claim.
3. Data: any schema change or migration has been run on a production-like dataset, has a tested backup/restore step, and the rollback path is written down and rehearsed once.
4. Performance: known load verified (or a stated risk accepted), page/endpoint latency checked against the current baseline, no new N+1 or unbounded queries in changed code paths.
5. Safety: feature flags default states correct for a partial rollout, errors and alerts configured for the new paths, and rollback procedure executable by someone other than the author.
6. Communication: changelog entry drafted, support team briefed with known issues and workarounds, customer-facing notice scheduled if behavior changes.
7. Timing: release date avoids the freeze window and someone is on call for the first 24 hours with the checklist in hand.
8. Verdict: GO / NO-GO / GO WITH CONDITIONS, where conditions are specific, named, and dated ("X verified by Tue 10:00"). Unmet conditions with no owner = NO-GO.

## Output

Criterion-by-criterion table with evidence, then the verdict line.