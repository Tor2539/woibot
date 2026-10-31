---
id: wb-root-cause-analysis
name: Root Cause Analysis Guide
description: Runs a disciplined root cause investigation for incidents, defects, or process failures using 5 Whys and factor mapping, ending with corrective actions tested against recurrence.
tags: [analysis, quality, operations]
---

# Root Cause Analysis Guide

Fix causes, not symptoms. A corrective action that would not stop recurrence is the wrong action.

## Steps

1. Define the problem precisely: what happened, when, where, how often, and what the measurable gap is versus expected behavior.
2. Map the sequence of events timeline first (facts only, no blame, no interpretation).
3. Ask "why" iteratively (5 Whys), staying on the causal chain:
   - Each "why" must be answered with something checkable, not a person's name. Blaming individuals hides system causes.
   - Stop when you reach a process, design, or policy factor you could actually change.
4. Broaden with factor families when 5 Whys stalls: people and training, process and procedure, tools and equipment, information and communication, environment.
5. Distinguish root cause from contributing causes; both get actions, but label them differently.
6. For each proposed corrective action, run the recurrence test: "If this action were in place last month, would the incident have been prevented or caught earlier?" If no, keep digging.
7. Assign each action an owner, deadline, and verification method (how we will know it worked).
8. Write the summary: problem, timeline, root cause, contributing factors, corrective actions, verification date.

## Checks

- Would the recurrence test pass for every action?
- Is any conclusion resting on an assumption marked as needing data?