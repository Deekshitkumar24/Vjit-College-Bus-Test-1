# Phase Plan: P5 Attendance and Alerts

**Phase ID:** P5  
**Goal:** Implement production-grade attendance verification and safety alert pipelines: daily trip generation with holiday filtering, expected passenger rosters, rotating HMAC-SHA256 QR boarding tokens with rate limiting and replay prevention, driver manual check-in / guest boarding, coordinator corrections, automated boarding-cutoff jobs, morning-present/afternoon-absent safety evaluator, leave lifecycle with cutoff gates, faculty alert handling with late boarding reconciliation, operational fleet alerts, coordinator daily summaries, and secure CSV attendance exports.  
**Prompt Contract:** `AG-MASTER-FINAL-1.0` (Version 1.0, 21 October 2026)  
**Companion Specifications:** `docs/spec/SW-MVP-1.0.pdf` (§18, §21.1, §22, §23, §25, §36)  
**Date:** 22 October 2026  
**Status:** NOT STARTED (Approved for execution via chat directive "P4 approved")  

---

## 1. Specification Sections Read & Referenced

- `SW-MVP-1.0`:
  - §18: Attendance system: QR token rotation, scan validation, passenger manifests, manual boarding, leave rules, morning-present/afternoon-absent safety logic.
  - §21.1: Operational notifications & alerts categories and delivery channels.
  - §22: Operational alerts (Severity 1, 2, 3), threshold calculations, and coordinator summary.
  - §23: Attendance reporting, CSV streaming, formula-injection guards (`T-SEC-03`).
  - §25: Scheduled background jobs: trip generator, attendance expected builder, boarding cutoff, absence evaluator, coordinator summary.
- `AG-MASTER-FINAL-1.0`:
  - Part 11.2: Boarding QR format (`v1.<key_version>.<base64url payload>.<base64url signature>`), 30-second slot (`floor(epoch/30)`), 8-step validation order, 10 scans/min/user rate limit.
  - Part 11.3: Morning-present, afternoon-absent rule, afternoon cutoff trigger (+15m), unique `(student_id, service_date)` alert constraint, late boarding transition (`BOARDED_LATE`).
  - Part 11.5: Operational alerts table: fleet silence, bus unavailable, device offline, source flapping, auth failures, rejection spikes.
  - Part 11.9: Leave rules: cutoff 30 minutes before departure for students, boarding cutoff for faculty; revert to expected on cancel; categories `PERSONAL`, `ACADEMIC`, `OTHER`.
  - Part 12.3: Idempotent background jobs with exponential backoff and dead-letter alert after 6 attempts.
  - Part 13.16: Formula-injection guard on CSV exports (reject/escape `=`, `+`, `-`, `@`).
  - Part 16: Phase P5 task breakdown (`P5-T1` through `P5-T7`) and exit criteria.
  - Part 18.1 / Part B.3 Defaults: `D-10` (QR at launch), `D-12` (Morning-present, afternoon-absent rule).

---

## 2. Locked Decisions & Defaults in Force (Part B)

- **D-10:** Boarding method is QR at launch; RFID in Phase 2.
- **D-12:** Morning-present, afternoon-absent rule: candidates are students with MORNING status BOARDED/LATE_BOARDED and AFTERNOON record on same date. Evaluator triggers at afternoon cutoff (departure + 15 min); status ABSENT triggers `absence_alerts`.
- **C-06:** Export presigned links valid for 24 hours.
- **C-09 / OV-1:** Ingestion sample rejection inside 200 response; HTTP 409 reserved for `IDEMPOTENCY_CONFLICT`.

---

## 3. Task Inventory & Dependency Order

| Task ID | Scope | Status | Evidence Log | Test ID / Deliverable |
| :--- | :--- | :---: | :---: | :--- |
| **P5-T1** | **Trip Generator & Expected-Passenger Builder:** Daily trip generator (00:30 IST, next 7 days, skipping holidays), and on-trip-start expected passenger builder (`EXPECTED` records in `attendance_records` per student on route). | DONE | `docs/progress/evidence/P5-T1.log` | `services/api/test/trip-generator.spec.ts`, `packages/domain/test/trip-generator.spec.ts` (4 tests passing) |
| **P5-T2** | **QR Token Generation & Scan Validation (Part 11.2):** Token format `v1.<key_version>.<payload>.<signature>`, 30s slots, HMAC-SHA256, validation pipeline steps 1-8, rate limit (10/min/user). | DONE | `docs/progress/evidence/P5-T2.log` | `T-ATT-01` (`packages/domain/test/qr-attendance.spec.ts`, `services/api/test/attendance-scan.spec.ts` - 13 tests passing) |
| **P5-T3** | **Manual Check-In, FLAGGED_GUEST, LATE_BOARDED & Corrections:** Driver manual check-in, guest boarding, late check-in, coordinator corrections with reasons, duplicate guard, and concurrency locking. | DONE | `docs/progress/evidence/P5-T3.log` | `T-ATT-02`, `T-CON-01` (`services/api/test/attendance-manual-concurrency.spec.ts` - 5 tests passing) |
| **P5-T4** | **Boarding-Cutoff Job & Absence Evaluator (Part 11.3):** Background boarding-cutoff job (+15m departure -> `ABSENT`), absence evaluator (morning present + afternoon absent -> `absence_alerts` row). | NOT STARTED | `docs/progress/evidence/P5-T4.log` | `T-ATT-03` (`services/api/test/absence-evaluator.spec.ts`) |
| **P5-T5** | **Leave Flows for Students & Faculty (Part 11.9):** Student leave submission (up to 30m before departure), faculty bus leave, cancellation rules, sets status `ON_LEAVE`. | NOT STARTED | `docs/progress/evidence/P5-T5.log` | `T-ATT-04` (`services/api/test/leave-flow.spec.ts`) |
| **P5-T6** | **Absence Alerts Management for Faculty & Coordinators:** Alerts list/detail, faculty acknowledgement, investigation notes, and `BOARDED_LATE` transition when boarding occurs after alert. | NOT STARTED | `docs/progress/evidence/P5-T6.log` | `services/api/test/absence-alerts-management.spec.ts` |
| **P5-T7** | **Operational Alerts, Coordinator Summary & CSV Export:** Severity 1-3 operational alert engine, 08:00 IST daily coordinator summary, and streaming CSV export with formula injection guards (Part 13.16). | NOT STARTED | `docs/progress/evidence/P5-T7.log` | `services/api/test/operational-alerts-export.spec.ts` |

---

## 4. Phase Exit Criteria

| Criterion | Target | Verification Method | Status |
| :--- | :--- | :--- | :---: |
| **T-ATT-01** | QR acceptance & expiry (Part 11.2) | QR from 30s ago accepted; QR from 65s ago returns `QR_EXPIRED` | **VERIFIED** |
| **T-ATT-02** | Duplicate boarding prevention | Second scan returns `DUPLICATE_BOARDING` | **VERIFIED** |
| **T-ATT-03** | Absence alert creation | Morning boarded + afternoon absent triggers `absence_alerts` within 5m of cutoff | NOT STARTED |
| **T-ATT-04** | Leave immunity | Approved leave prevents absence alert creation | NOT STARTED |
| **T-CON-01** | Parallel scan concurrency | Two parallel scans create exactly one record | **VERIFIED** |
