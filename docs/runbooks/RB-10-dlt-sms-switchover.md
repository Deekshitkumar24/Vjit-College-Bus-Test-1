# RB-10: DLT Entity & SMS Template Switchover

## 1. Purpose
Handling regulatory SMS rejections, TRAI DLT template failures, and fallback routing (Decision D-07, RS-06).

## 2. Default In Force
- Until college IT approves DLT entity and template IDs, SMS channel is disabled in production (D-07).
- Tier 1 to Tier 3 notifications automatically fall back to Push and Email.

## 3. Template Switchover
1. Once approved, register Principal Entity ID and Content Template IDs in `sms_templates` table.
2. If aggregator returns DLT rejection code (`DLT_TEMPLATE_MISMATCH` or `PE_FAIL`), notification dispatcher automatically raises setup alert and switches to fallback email/push outbox.
