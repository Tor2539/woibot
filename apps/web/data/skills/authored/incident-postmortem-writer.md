---
id: wb-incident-postmortem-writer
name: Blameless Postmortem Writer
description: Writes postmortems that prevent recurrence: timeline from evidence, root cause with mechanism, contributing factors, and owned action items with verification. Use after any significant incident.
tags: [ops, quality, writing]
---

# Blameless Postmortem Writer

A postmortem asks "how did the system allow this", never "who pressed the button". People make sense inside their context; systems are what we can fix.

## Steps

1. Set the frame in one line: impact in user terms (who, what, how long), severity, and the detection time from alert to awareness.
2. Build the timeline from evidence only — alert timestamps, logs, chat messages, deploy records, ticket times. Each entry: time (with timezone), event, source. No interpretation inside the timeline.
3. Find root cause as a mechanism, not a location: not "the bug was in the queue code" but "the retry storm saturated the DB connection pool because retries had no backoff cap". If you cannot write the because-chain, keep digging.
4. List contributing factors honestly: what made detection slow, what made the fix hard, what made the blast radius big (missing alerts, stale runbook, no rate limit, single point of failure).
5. Ask the standard amplifiers: Did monitoring see it or did a human? Did we follow the runbook — and was the runbook right? Was there a safer action (rollback/flag) we did not take because it was undocumented or unclear who could decide?
6. Action items: for each factor, a specific change with an owner and a date, split into prevention (stop recurrence) and mitigation (limit blast radius / time-to-detect). Verify each item would actually have changed this incident's timeline — same test as root cause.
7. Close with what went well (detection, communication, luck to engineer away) and a review date for action items.
8. Circulate to the team and archive where future responders will find it; recurring-incident reports should link to the previous postmortem.