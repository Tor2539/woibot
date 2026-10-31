---
id: wb-test-plan-writer
name: Test Plan Writer
description: Writes practical test plans mapping features to test cases with priorities, environments, and entry/exit criteria. Use before releases, migrations, and integrations.
tags: [qa, testing, planning]
---

# Test Plan Writer

A test plan answers "what must be true for this to ship, and how will we prove it". Cases without priorities waste the testing window.

## Steps

1. List the features and flows in scope, each with the user-visible promise it makes ("checkout completes with a discount code"). Out of scope goes on an explicit not-testing list.
2. Derive test cases from promises, not from code: each promise gets a happy-path case plus its most likely failure modes (empty inputs, expired session, double submit, network drop).
3. Prioritize with a simple scheme: P1 blocks release (money, data loss, login), P2 must-fix (main flows, common errors), P3 nice-to-have (cosmetic, edge cases). If everything is P1, the plan has no structure — re-rank.
4. Specify per case: steps with exact test data, expected result, and how to verify (what screen, what value, what email). "It works" is not an expected result.
5. Define environments: where tests run (staging with what seed data), browser/device matrix limited to the real user distribution, and any accounts or flags needed.
6. Write entry and exit criteria: entry = build deployed and smoke test passing; exit = all P1/P2 passed, known issues logged with severity, and no open blocker.
7. Plan regression depth honestly: full suite vs the subset touching changed modules — state which and why.
8. Add the bug-reporting convention: where to log, what fields (steps, expected, actual, environment, screenshot), and who triages.

## Output

Test plan document with scope, case table (id, promise, steps, data, expected, priority), environments, criteria, and bug process.