---
id: wb-dataset-first-look
name: Dataset First-Look Profiler
description: Profiles any new CSV or spreadsheet before analysis: shape, types, missing values, distributions, outliers, and data quality traps. Use as the mandatory first step before any chart, model, or report.
tags: [data, analysis, quality]
---

# Dataset First-Look Profiler

Never analyze a dataset you have not profiled. The first look decides whether later results can be trusted.

## Steps

1. Establish shape and identity: row count, column count, what one row represents (a customer? an order? a click?), and the collection window.
2. Check types and units per column: dates parsed as dates, numbers as numbers, categories as categories. Note columns that are numeric IDs (do not average them) and mixed-type columns.
3. Quantify missingness: per-column null counts and the pattern behind them (random gaps versus whole blocks, which hint at upstream failures).
4. Duplicates: exact duplicate rows and duplicate natural keys (same customer ID twice) — decide keep/drop policy explicitly before analysis.
5. Distribution scan per numeric column: min/max, mean vs median gap (skew), impossible values (negative age, 1000% discount) and outliers flagged by range or z-score.
6. Category sanity: cardinality of each categorical column, near-duplicate labels ("THB" vs "thb"), and free-text columns that should have been categories.
7. Time sanity: sort key continuity, gaps in the date range, timezone mixing, and future-dated rows.
8. Write a one-paragraph data quality verdict: what can be analyzed as-is, what needs cleaning, and what conclusions the data cannot support. Attach the cleaning checklist derived from steps 3-7.

## Output

Profile table (column, type, nulls, notes), then the verdict paragraph.