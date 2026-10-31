---
id: wb-code-review-checklist
name: Code Review Checklist
description: Reviews code changes systematically for correctness, safety, readability, and test coverage, with feedback phrased to be actionable and kind. Use before approving PRs or handoffs.
tags: [coding, quality, collaboration]
---

# Code Review Checklist

Review in one pass per concern. Comment on code, not people; every comment should be either a question, a suggestion, or a blocker, labeled as such.

## Steps

1. Understand the intent first: read the task description and the diff summary. If you cannot state what the change is supposed to do, ask before nitpicking.
2. Correctness: trace the main path and at least two edge cases (empty input, error path, boundary value). Check off-by-one risks, null/undefined handling, and error propagation — do errors get surfaced or swallowed?
3. Safety and side effects: new inputs validated, secrets absent from code and logs, destructive operations guarded, queries parameterized, permissions checked where the data boundary changes.
4. Design fit: does the change follow existing patterns in the codebase? Duplication that should reuse an existing helper? New abstraction justified by at least two use sites?
5. Tests: does the change include or update tests for the behavior added? Would the tests fail if the feature were reverted? If untested, say exactly which case deserves the test.
6. Readability: names say what things do, functions do one thing, dead code and debug prints removed, comments explain why rather than what.
7. Label feedback: "blocker" (must fix), "should" (strong preference), "nit" (optional). Ask questions when behavior might be intentional — it often is.
8. End with an explicit verdict: approve, approve with comments, or request changes, plus the one thing that most improves the PR.