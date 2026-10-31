---
id: wb-ticket-triage
name: Support Ticket Triage
description: Triage incoming support tickets by urgency, impact, and type with clear routing, first-response standards, and escalation triggers. Use for support queues and on-call intakes.
tags: [support, ops, quality]
---

# Support Ticket Triage

Triage exists so that the most urgent work gets the first attention, and nothing silently rots. Speed of first response matters more than speed of resolution for perceived quality.

## Steps

1. Classify each incoming ticket on two axes:
   - Urgency: is the customer blocked right now?
   - Impact: one customer or many (same issue reported repeatedly = incident, not ticket).
2. Assign severity: S1 blocked with no workaround or money/data at risk; S2 blocked with a workaround; S3 question or non-blocking issue; S4 request (feature, export, bulk change).
3. Route by type: technical bug → engineering queue with reproduction info; billing → finance with transaction IDs; how-to → support with the relevant article or a written mini-guide; account/access → identity verification FIRST before any change.
4. First response standards by severity: S1 within 30 minutes (acknowledgment + who is on it), S2 within 4 hours, S3 same business day. Acknowledgment ≠ resolution; say what happens next.
5. Escalation triggers, written down: three reports of the same issue in a day, any S1 open past 2 hours, any legal/threat/security keyword — escalate to the named owner, not to the group.
6. Enrich before routing: verify account status, recent changes on the customer's side, and known incidents — 30 seconds of checking kills 30 minutes of back-and-forth.
7. Close the loop on triage decisions: when a ticket is downgraded or merged into an incident, the customer is told, and the original ticket references the master issue.
8. Review the queue daily for aging tickets past their standard; anything breached gets a proactive update, not silence.