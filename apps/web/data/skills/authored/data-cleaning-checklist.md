---
id: wb-data-cleaning-checklist
name: Data Cleaning Checklist
description: Applies a safe, reversible data-cleaning sequence for messy tables: standardization, missing-value policy, deduplication, and outlier handling, with every decision logged. Use before analysis or dashboards.
tags: [data, quality, spreadsheets]
---

# Data Cleaning Checklist

Clean data reproducibly: every transformation is logged and reversible, and no row is silently destroyed.

## Steps

1. Work on a copy. Keep the raw file untouched and name the cleaned output distinctly.
2. Standardize before you decide anything: trim whitespace, unify case for category labels, parse all dates to one format and timezone, strip currency symbols into separate numeric columns with one unit column.
3. Fix structure before content: one observation per row, one attribute per column. Split combined fields ("City, Country"), unpivot repeated month columns if needed.
4. Missing values — choose a policy per column and write it down: drop row (only when the key fields are missing), drop column (mostly empty and non-essential), impute (state the method: median, mode, forward-fill for time series), or keep as "unknown" category. Never fill numeric fields with zero without justification.
5. Duplicates: exact rows first; then natural-key duplicates (same invoice ID twice) — investigate before keeping the latest.
6. Outliers: separate "impossible" (fix or drop with note) from "surprising but real" (keep; consider robust statistics). Document every excluded row count per rule.
7. Validate after cleaning: row counts before vs after with a per-rule breakdown, re-run type checks, spot-check 5 rows against the raw file.
8. Produce a cleaning log: ordered list of transformations with parameters, so the process can be re-run on next month's file.

## Checks

- Raw file untouched; cleaned file traceable to it.
- Every drop/impute rule has a count and a reason.