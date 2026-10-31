---
id: wb-app-security-review
name: Application Security Review Basics
description: Checks web applications for the highest-impact vulnerability classes: input handling, auth, secrets, access control, and dependency risk, producing a prioritized findings list. Use before launches and after major changes.
tags: [security, coding, web]
---

# Application Security Review Basics

Focus on the vulnerability classes that cause real incidents. This is a first-pass review that complements — not replaces — dedicated security testing.

## Steps

1. Map the attack surface: entry points (forms, APIs, file uploads, webhooks), auth boundaries, admin functions, and where user data lands (DB, logs, exports).
2. Input handling: every input validated server-side against an allowlist where possible; SQL built only with parameterized queries; user content rendered with context-aware escaping; file uploads restricted by type/size and stored outside executable paths.
3. Authentication and sessions: passwords hashed with a modern algorithm, login rate-limited, session tokens random and expiring, logout invalidates server-side, password reset flows do not leak whether an account exists.
4. Access control (the classic breach): for each sensitive action and object, verify the server checks the requesting user's permission every time — including API endpoints and object IDs in URLs (test changing the ID to another user's resource).
5. Secrets: no keys, tokens, or passwords in code, config files, logs, or error messages; secrets come from environment or a secrets manager; scan the repo history for accidental commits.
6. Transport and headers: HTTPS enforced, cookies marked Secure/HttpOnly/SameSite, security headers set (CSP at minimum), no mixed content.
7. Dependencies: check for known-vulnerable versions of libraries in use and remove unused ones; note versions that need upgrading.
8. Output the findings table: finding, location, risk (high/med/low), and the concrete fix. Highs get an owner and a date. Verify fixes with the same steps used to find them.