---
id: wb-chart-choice-guide
name: Chart Choice and Design Guide
description: Picks the right visualization for a question and designs it honestly: correct scales, readable labels, no junk. Use when turning tables into charts or reviewing chart drafts.
tags: [data, visualization, design]
---

# Chart Choice and Design Guide

Start from the question, not the chart type. Then design so the chart can be understood in five seconds without a legend treasure hunt.

## Steps

1. Name the question the chart answers: comparison, composition, distribution, trend, or relationship.
2. Pick the default form for that question:
   - Comparison across categories: bar chart (horizontal when labels are long).
   - Composition of a whole: stacked bar for few segments; avoid pies beyond 3-4 slices.
   - Trend over time: line chart with consistent intervals; never connect unevenly spaced points as if they were even.
   - Distribution: histogram or box plot; never a bar chart of averages alone.
   - Relationship between two numerics: scatter plot.
3. Axis honesty: bar charts start at zero; line charts may zoom but must label the baseline; state units and time window in the axis title.
4. Design: direct-label the series when possible instead of a legend; sort bars by value (unless order is inherent, like months); cap series count at 4-5 or split into small multiples.
5. Annotate the takeaway as the chart title ("Churn doubled after the March price change"), with the descriptive title as a subtitle.
6. Check readability: contrast, color-blind-safe palette, one accent color for the thing that matters, gridlines light or absent.
7. Add source and date under the chart; if any series is partial or provisional, mark it visibly.

## Checks

- The takeaway is stated in the title.
- Removing any element makes the chart worse or it should be removed.