---
id: wb-web-app-from-brief
name: Web App From Brief
description: Builds small, complete, runnable web applications from a product brief, preferring a self-contained approach with real content, working interactions, and verified output. Use for landing pages, tools, demos, and internal apps.
tags: [coding, web, development]
---

# Web App From Brief

Deliver something that actually runs. Every feature claimed must exist in the files.

## Steps

1. Parse the brief into: purpose, primary user, core interactions, content, and success criteria. If the brief is thin, choose sensible defaults and state them in a short plan before coding.
2. Plan the file structure: a self-contained index.html with inline CSS and JS is ideal when allowed; split files only when the app genuinely needs them (data, assets, backend).
3. Build the page skeleton first: semantic HTML with real headings and sections, accessible controls (labels, alt text, focus states), and no placeholder lorem — write real copy matching the brief's language.
4. Style with restraint: one accent color, consistent spacing scale, responsive down to ~380px, readable type sizes. Layout must survive different content lengths.
5. Implement interactions as small, testable functions: form validation with visible error messages, state kept in one object, event handlers wired to real behavior. No dead buttons.
6. Verify like a user: open the file in a browser, click every control, submit the form with bad input and good input, resize the window. Fix what breaks, then re-check.
7. Check code health: no console errors, no unused code paths, `node --check` passes for standalone JS files, no external CDNs unless the brief requires them.
8. Finish with a short README section in comments or a separate file: what it does, how to run it, known limits.

## Checks

- Every visible control does something real.
- The page works from file:// without a build step (when self-contained).