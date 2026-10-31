---
id: wb-translation-quality-check
name: Translation Quality Reviewer
description: Reviews translations for accuracy, completeness, terminology consistency, and naturalness against the source, with a categorized issue report. Use before publishing translated documents.
tags: [translation, quality, editing]
---

# Translation Quality Reviewer

Review systematically, not by vibes: accuracy first, then completeness, then consistency, then style. Each pass catches a different failure.

## Steps

1. Accuracy pass, segment by segment: compare source and target for mistranslation, added content (target says more than source), and dropped content (source says more than target). Numbers, names, dates, and negations get special attention — negation flips are the costliest error class.
2. Completeness: headers, footnotes, table cells, image captions, list items — fragments outside body paragraphs are the most commonly dropped pieces. Verify formatting structure mirrors the source.
3. Terminology consistency: the same source term maps to exactly one target term throughout (build a mini glossary while checking); inconsistent terms confuse readers more than an imperfect but steady choice.
4. Register match: formality level consistent end to end and appropriate to the document (a contract must not read like a brochure). Check politeness markers and honorifics carried correctly.
5. Naturalness: read the target aloud; flag target-language grammar that a native writer would not produce, calques that sound foreign, and punctuation conventions violated (spacing, quotes, date order).
6. Locale conventions: dates, times, currency, units, phone number formats, and address order match the target audience's conventions.
7. Report issues in a table: location, category (accuracy/completeness/terminology/register/naturalness), severity (blocker = meaning changed; major = reader misled; minor = polish), and suggested fix. Blockers get re-verified after fixing.