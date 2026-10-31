---
id: wb-secret-hygiene-checklist
name: Secret Hygiene Checklist
description: Finds and prevents credential leaks across code, config, logs, and shared channels, with rotation steps for the worst cases. Use for repos, deployments, and team workflow audits.
tags: [security, devops, quality]
---

# Secret Hygiene Checklist

Secrets leak through four doors: code, config, logs, and chat. Check all four and make the safe path the easy path.

## Steps

1. Scan the codebase and its git history for known secret patterns (API keys, tokens, passwords, private keys) with a scanning tool or pattern search. History counts: deleting a secret from HEAD does not remove it from old commits.
2. Check config and deployment files: .env files excluded from version control (verify .gitignore), example files contain only placeholders, CI variables not echoed to logs, and container images free of baked-in credentials.
3. Check logs and error reporting: no tokens, authorization headers, or request bodies containing credentials; scrub at the logging boundary, not by policy.
4. Check shared channels: chat threads, docs, and ticket attachments are common leak sites. Rotate anything found in a channel — assume it is public.
5. Assess blast radius for each finding: scope of the credential (read-only? production? payment?), expiry, and what it unlocks. Prioritize rotation accordingly.
6. Rotate exposed credentials immediately, in this order: revoke/reissue, update all consumers, verify the old secret is dead, and check access logs for misuse during the exposure window.
7. Fix the workflow so it does not repeat: move secrets to a manager (env vars from a secure store, platform secrets), add secret scanning to CI so future commits are caught, and create a documented onboarding path for how devs get local secrets.
8. Report: findings, actions taken, and the prevention measures installed.