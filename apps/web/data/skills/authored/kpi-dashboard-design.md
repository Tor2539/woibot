---
id: wb-kpi-dashboard-design
name: KPI Dashboard Design
description: Designs dashboards that answer named business questions with a small set of well-defined KPIs, clear targets, and honest trend framing. Use for management reports, ops dashboards, and weekly reviews.
tags: [data, business, visualization]
---

# KPI Dashboard Design

A dashboard is not a data dump. It is a set of questions with answers, targets, and a call to act.

## Steps

1. Interview the audience (or infer from the brief): list the 3-5 recurring questions they must answer weekly, e.g. "is revenue on track?", "are we over budget?". The dashboard answers those questions — nothing else.
2. Map each question to one primary KPI with an exact definition (numerator, denominator, window, filter). Write the definition in the dashboard footer; ambiguity here causes most arguments.
3. Add context to every KPI: target or last period, delta, and whether up is good. A number without comparison is unreadable.
4. Choose honest framings: period-to-date against the same period last cycle; cumulative line against target line; rolling averages for noisy daily data (state the window).
5. Layout in reading order: headline KPIs with deltas on top, trend of the primary KPI second, breakdowns (by channel, region, product) below, drill-down tables last.
6. Mark data freshness ("data through Oct 29, 06:00") and note known caveats (missing channel, delayed attribution).
7. Trim ruthlessly: if a widget has no owner or decision attached, cut it. Review the set quarterly — KPIs retire when they stop driving decisions.

## Output

Question-to-KPI mapping table, layout sketch description, and definition footer text.