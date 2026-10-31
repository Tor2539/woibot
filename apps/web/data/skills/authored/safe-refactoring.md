---
id: wb-safe-refactoring
name: Safe Refactoring Workflow
description: Restructures code without changing behavior using a characterization-first, small-steps approach with verification between every step. Use for cleanup, renaming, extraction, and dependency isolation.
tags: [coding, refactoring, quality]
---

# Safe Refactoring Workflow

Refactoring means behavior stays identical while structure improves. Every step is verifiable and reversible.

## Steps

1. Pin current behavior before touching anything: existing tests passing, or if coverage is thin, write characterization tests that capture what the code does today, including quirky outputs. These stay green throughout.
2. Refactor in commits-sized steps, each doing exactly one kind of change: rename, extract function, move file, inline variable, introduce parameter. Mixing kinds makes review impossible.
3. Keep the new code honest: extracted functions get names that state intent ("parseInvoiceRows", not "handle"), and each extraction leaves the caller's logic readable top-down.
4. After every step, run the verification (tests, type check, lint, and a manual smoke of the affected flow if tests are sparse). Failing step? Revert that step; do not push a broken intermediate state onward.
5. Watch the seams: imports and exports updated consistently, no circular dependencies introduced, side effects still fire in the same order.
6. Resist scope creep. Bugs discovered mid-refactor get noted, not fixed inside the refactor (separate change, separate review).
7. Finish by deleting dead code the refactor orphaned and re-running the full verification suite one final time.
8. Summarize for review: what structural change was made, what behavior guarantee holds, evidence it holds (tests/checks run).

## Checks

- Characterization tests unchanged and green at the end.
- Each step is independently revertible.