---
id: wb-ui-layout-review
name: UI Layout and Usability Review
description: Reviews screens and page layouts against core usability principles: hierarchy, affordance, consistency, accessibility, and mobile behavior, producing prioritized fixes. Use for web pages, apps, and forms.
tags: [design, web, ux]
---

# UI Layout and Usability Review

Judge the screen the way a first-time user does: scan, hesitate, click. Every fix should remove hesitation.

## Steps

1. Define the primary task the screen supports and the primary user. Walk through completing that task, narrating each step and noting where you hesitated or looked for something.
2. Hierarchy: does the eye land on the right thing first? Primary action visually strongest; secondary actions clearly lighter; destructive actions separated and muted.
3. Affordances: buttons look pressable, links identifiable, inputs show clear boundaries and placeholder vs value, disabled states visibly disabled. Anything clickable that does not look clickable (or vice versa) is a defect.
4. Consistency: same actions look the same across the flow; spacing and type scale repeat; terminology matches everywhere (one word for the same object).
5. Content: labels speak the user's language, error messages say what went wrong and how to fix it, empty states tell users what to do next, forms ask for the minimum and explain why for anything sensitive.
6. Accessibility baseline: contrast >= 4.5:1 for text, focus states visible, keyboard path completes the task, hit targets >= 44px, text reflows at mobile width without horizontal scroll.
7. Prioritize the fixes in three tiers: blockers (task cannot be completed), major friction (hesitation or error risk), polish. One-line rationale each.

## Output

Findings list tagged by tier with the element, the problem, and the suggested fix.