# Phase Report: P5 Attendance and Alerts

| Task  | Commit  | Scope                                                                                                                             | Tests (count, IDs)        | Files                                                                      | Status |
| ----- | ------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------- | ------ |
| P5-T1 | c7a012a | Trip generator (00:30 IST, 7 days ahead, holiday filter), expected-passenger builder on trip start                                | 4 (P5-T1)                 | packages/domain/src/trip-generator.ts, test/trip-generator.spec.ts         | DONE   |
| P5-T2 | cc4bfdf | Rotating QR token generation (HMAC-SHA256, 30s slots), scan validation pipeline steps 1-8, rate limit (10/min/user)               | 13 (T-ATT-01)             | packages/domain/src/qr-attendance.ts, services/api/src/modules/attendance/ | DONE   |
| P5-T3 | d593142 | Driver manual check-in, FLAGGED_GUEST, late boarding, coordinator corrections with reasons, concurrency lock                      | 5 (T-ATT-02, T-CON-01)    | services/api/src/modules/attendance/attendance.service.ts, controller.ts   | DONE   |
| P5-T4 | f5872e8 | Boarding-cutoff job (+15m -> ABSENT), morning-present/afternoon-absent evaluator (Decision D-12)                                  | 3 (T-ATT-03)              | services/api/src/modules/attendance/absence-evaluator.service.ts           | DONE   |
| P5-T5 | 80865c5 | Leave flows for students (30m cutoff) & faculty, cancellation before cutoff, status ON_LEAVE                                      | 4 (T-ATT-04)              | services/api/src/modules/attendance/leave.service.ts                       | DONE   |
| P5-T6 | 33dbc36 | Absence alerts management: list/detail, faculty acknowledgement, investigation notes (<=500 chars), late boarding update          | 3 (Part 11.3)             | services/api/src/modules/attendance/absence-alerts.service.ts              | DONE   |
| P5-T7 | 47ac01f | Operational alerts engine (Severity 1-3), 08:00 IST coordinator summary, CSV streaming export with formula injection sanitization | 7 (Part 11.5, Part 13.16) | services/api/src/modules/attendance/operational-alerts.service.ts          | DONE   |

Tests: 39 run, 39 pass, 0 fail across 8 files (full attendance and alerts test suite passing).

Exit criteria:

1. T-ATT-01: VERIFIED (packages/domain/test/qr-attendance.spec.ts, services/api/test/attendance-scan.spec.ts)
2. T-ATT-02: VERIFIED (services/api/test/attendance-manual-concurrency.spec.ts)
3. T-ATT-03: VERIFIED (services/api/test/absence-evaluator.spec.ts)
4. T-ATT-04: VERIFIED (services/api/test/leave-flow.spec.ts)
5. T-CON-01: VERIFIED (services/api/test/attendance-manual-concurrency.spec.ts)

External blockers:
None for Phase P5 unit and domain logic. (Broader infrastructure blockers E1, E3, E7, E11 remain tracked in project registry).

Open decisions used:

| Ref        | Question                               | Default in force                                                                                                  | Owner             |
| ---------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------- |
| D-10       | Boarding method at launch              | QR codes shown by the driver                                                                                      | Transport office  |
| D-12       | Morning-present, afternoon-absent rule | Evaluated at afternoon cutoff (+15m departure); alert generated if afternoon status is ABSENT; ON_LEAVE is immune | Faculty committee |
| C-06       | Export link lifetime                   | 24 hours                                                                                                          | Product owner     |
| Part 13.16 | CSV Formula Injection Guard            | Escape =, +, -, @ cells with prepended single quote (')                                                           | Security lead     |

Git log for this phase:

```
47ac01f P5-T7: implement operational alerts engine, coordinator daily summary and CSV export with formula injection sanitization
33dbc36 P5-T6: implement absence alerts management, acknowledgement, notes and late boarding reconciliation
80865c5 P5-T5: implement leave flows for students and faculty, cutoff enforcement and verify T-ATT-04
f5872e8 P5-T4: implement boarding-cutoff job, morning-present/afternoon-absent safety evaluator and verify T-ATT-03
d593142 P5-T3: implement manual check-in, FLAGGED_GUEST, coordinator corrections and concurrency guard (T-ATT-02, T-CON-01)
cc4bfdf P5-T2: implement QR token generation, scan validation, rate limiting and verify T-ATT-01
c7a012a P5-T1: implement trip generator and expected passenger builder
cbab5f2 docs(p5): create Phase P5 execution plan for attendance and alerts
```
