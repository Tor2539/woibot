---
id: wb-systematic-debugging
name: Systematic Debugging Method
description: Finds root causes before attempting fixes using evidence-first reproduction, binary search over the failure surface, and hypothesis testing. Use for any bug, error, or unexpected behavior.
tags: [coding, debugging, quality]
---

# Systematic Debugging Method

No fixes without root cause investigation first. A patch that silences the symptom is a bug deferred.

## Steps

1. Reproduce reliably. Find the minimal, repeatable trigger — command, input, or click sequence. An intermittent bug is understood only when you can make it happen at will or identify the timing condition.
2. Write down the expected vs actual behavior in one sentence each. Vague problems produce vague fixes.
3. Gather evidence without theorizing: full error messages, logs around the failure, the exact inputs, what recently changed (code, config, data, dependencies).
4. Form exactly one hypothesis at a time, phrased as "X causes Y because Z, so doing Q should change the output". Design the cheapest test that supports or kills it.
5. Localize by binary search: comment out, log, or bypass half the pipeline between working state and failing state; repeat until the failing component is isolated.
6. When found, understand the mechanism (why it fails), not just the location (where it fails). If you cannot explain the cause in one sentence, you have not found it.
7. Fix the cause. Add the regression test that would have caught this bug. Check for the same pattern in sibling code paths.
8. Verify by reproducing the original trigger: it must now pass, and nothing else broke. Note in the write-up: symptom, root cause, fix, test.

## Checks

- You can explain the bug mechanism to a colleague in two sentences.
- A test now covers the failure.