---
id: wb-incident-response-playbook
name: Incident Response Playbook Template
description: Creates a working incident playbook with severity levels, roles, first-hour checklist, communication templates, and a postmortem path. Use for services, stores, and internal systems.
tags: [security, ops, planning]
---

# Incident Response Playbook Template

The middle of an incident is the wrong time to design the process. Write the playbook now, rehearse it once, and update it after every incident.

## Steps

1. Define severity levels with concrete triggers and response times: S1 (service down or data at risk — respond now, all hands), S2 (major feature broken, workaround exists — respond within hours), S3 (minor degradation — next business day). One paragraph each, no ambiguity.
2. Assign roles by function, not name: Incident Lead (coordinates, decides), Comms Lead (updates stakeholders), Investigator(s), Scribe (timeline log). Backup for each when the primary is asleep.
3. First-hour checklist: confirm the incident and set severity; open the incident channel and start the scribe log; stabilize or roll back first, diagnose second (a running earlier version beats a perfect fix at 2am); notify affected stakeholders per the severity matrix.
4. Write the containment options in advance per failure type: how to roll back a deploy, disable a feature flag, switch traffic, or take a component offline — each with the exact command or console path and who is authorized.
5. Communication templates: first notice (what we know, impact, next update time), progress update every 30-60 minutes for S1, resolution notice (cause, fix, follow-ups). Pre-draft the skeletons so filling takes one minute.
6. Escalation map: who to call at each severity, in order, with the fallback if unreachable.
7. Postmortem path: within 48 hours, timeline, root cause, contributing factors, action items with owners — blameless, focused on systems.
8. Rehearse quarterly with a tabletop scenario and fix what the rehearsal exposes.