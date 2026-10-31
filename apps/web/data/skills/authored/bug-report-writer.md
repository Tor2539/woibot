---
id: wb-bug-report-writer
name: Bug Report Writer
description: Writes bug reports engineers can reproduce on the first try: minimal steps, expected vs actual, environment, and evidence attached. Use for any defect, glitch, or unexpected behavior.
tags: [qa, testing, collaboration]
---

# Bug Report Writer

A bug report is a reproduction recipe. If the engineer cannot reproduce it, it does not exist.

## Steps

1. Write a one-line summary that names the broken behavior and the place: "Cart total ignores discount code on payment step" — not "cart broken".
2. Reproduce it yourself once more while writing the steps down; steps must be exact: URL, account type, data entered, click order. Remove steps that do not matter by testing without them (minimal repro).
3. State expected vs actual explicitly: "Expected: 1,000 THB total (100 x 0.9). Actual: 1,100 THB". Numbers, not adjectives.
4. Record environment: page/version, browser and OS (or app version), account/role, date and time with timezone.
5. Attach evidence: screenshot with the relevant part visible, console errors if any, and the network response when the bug involves data. Crop to what matters.
6. Note frequency and scope: always or intermittent? one user or all? started when? This determines severity faster than any description.
7. Classify severity (blocker/critical/major/minor) by user impact, not by how embarrassed anyone is. Workaround present? Say it in one line — it decouples the fix from the pain.
8. After filing, stay available for questions and add follow-up comments as new evidence appears ("also happens on mobile web").

## Checks

- Engineer can reproduce without asking you anything.
- Expected and actual both contain concrete values.