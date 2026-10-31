---
id: wb-uat-script-builder
name: UAT Script Builder
description: Builds user acceptance test scripts that non-technical business users can execute and sign off, focused on real business scenarios with explicit pass criteria. Use before go-lives and major updates.
tags: [qa, business, testing]
---

# UAT Script Builder

UAT proves the system works for the business, in the business's language. Technical checks stay out; scenarios and sign-offs come in.

## Steps

1. Extract 8-15 end-to-end business scenarios with the process owner: "customer orders 3 items, applies membership discount, pays by bank transfer, receives invoice by email". Cover each money path, each approval path, and the most common exception paths.
2. For each scenario write steps the user can follow without code knowledge: click paths in UI terms, the exact test data to use, and what they should see. One scenario per script section.
3. Give each scenario explicit pass criteria as observable outcomes: "invoice PDF downloads and total shows 1,850 THB including 7% VAT". Ambiguity here turns sign-off into arguments.
4. Include realistic data prepared in advance (accounts, records, permissions) — list who prepares it and where it lives. UAT stalls for days waiting for data; prevent that.
5. Assign executors who actually do the job daily, plus a note-taker to log results in a shared table: scenario, executor, date, pass/fail, issue reference.
6. Agree the rules before starting: what counts as a fail (any deviation from expected = fail with screenshot), how issues get triaged daily, and what the sign-off requires (all P1 scenarios passed; P2 agreed with the owner).
7. Keep sessions short (max 2-3 hours) and batch issues daily rather than collecting a pile for the end.

## Output

Scenario table (id, scenario, steps, data, pass criteria, executor) plus sign-off sheet.