---
id: wb-data-privacy-audit
name: Data Privacy Audit Basics
description: Audits what personal data a product collects, where it flows, who can access it, and whether practice matches policy, producing a gap list and remediation plan. Use before compliance reviews and integrations.
tags: [security, compliance, legal]
---

# Data Privacy Audit Basics

You cannot protect or correctly disclose data you have not inventoried. Start with facts, compare with promises, close the gaps.

## Steps

1. Inventory personal data end to end: each data category (identity, contact, payment, behavior, files), where it is collected, where it is stored, retention period, and every system that reads it. Include copies: logs, backups, exports, analytics.
2. Map flows: for each category, the internal and third-party recipients (analytics, payments, email tools, AI services). For each processor, note the contract basis and data location if known.
3. Compare practice against promises: does the privacy notice match the inventory? Undisclosed sharing, missing retention limits, or "we may use for improvements" language with no boundary are the classic gaps.
4. Check the controls: who can access personal data (least privilege?), is access logged, is data encrypted at rest and in transit, and can a specific user's data actually be located and deleted on request within the promised time?
5. Check consent flows where consent is the basis: collected before use, purpose stated, easy to withdraw, and the withdrawal actually stops the processing.
6. Test a data request end to end: simulate an access request and a deletion request; time them and note every manual step. Manual steps are fine if documented — impossible ones are findings.
7. Produce the gap list: finding, evidence, risk, and remediation with owner and date (stop collecting X, shorten retention, sign processor agreement, add access logging).
8. Date the audit and set the next review; inventories rot within months.