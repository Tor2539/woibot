# woibot — Monetization & Cost Isolation (Product Requirement)

## หลักการ
- Teammate เข้าถึงง่าย (subscription ต่ำ) — ไม่ควรถูกงานหนักทำให้ขาดทุน
- Work คิดตามต้นทุนจริง — โปร่งใสก่อนเริ่ม, จำกัดวงเงินได้

## Teammate Plans
| Plan | ราคา (เสนอ) | Cloud Computer | Memory | Routines | Token/เดือน |
|------|-------------|----------------|--------|----------|-------------|
| Free | 0 | 2h/day ephemeral | 7 วัน | 3 | 200K |
| Starter | 399 THB | 1 vCPU/2GB persistent | ไม่จำกัด | 20 | 2M |
| Pro | 999 THB | 2 vCPU/4GB | ไม่จำกัด + team memory | 100 | 10M |

## Work Meter (แยก ledger)
- Coding: $0.02 / 1K tokens + $0.10 / build-minute
- Research: $0.015 / search + $0.02 / page synthesized
- Docs (10+ pages): $0.50 / doc + $0.10 / revision
- Video analysis: $0.20 / min + whisper cost
- Video gen: $0.30–2.00 / sec (model-dependent) — GPU pool แยก
- Cloud execution: $0.05 / vCPU-hour

UI ต้องแสดง Estimate Card ก่อนเริ่มทุกงาน Work:
> ประเมิน: 18 นาที | ~$2.40 | ใช้ GPT-4o + FFmpeg | เกินงบ $5 จะหยุดรอคุณอนุมัติ [เริ่มเลย] [ปรับงบ]

## Guardrails
- Per-task cap (default $5), Monthly cap (default $50)
- Video gen ต้อง confirm แยก (cost สูง)
- ถ้า Work cost > Teammate allowance → ไม่หักจาก Teammate, ไป Work ledger แทน
- Admin เห็น Cost per Accepted Task แยก Teammate/Work
