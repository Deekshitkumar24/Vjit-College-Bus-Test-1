# Section 6 Corrections Log

Prompt Contract: `AG-MVP-FINAL-RUN-1.0.md` (§6)  
Date: 22 October 2026  

---

## Item 1: P0-T15 Telemetry Status Update
- **Change:** Changed P0-T15 (Sentry, OpenTelemetry, CloudWatch) status from DONE to `IN PROGRESS` (BLOCKED-EXTERNAL on E4).
- **Rationale:** Live error reaching Sentry in dev requires external Sentry DSN credentials (`E4`). Local code and unit test coverage remain complete, but exit verification remains blocked externally on `E4`.
- **Files Modified:** `docs/progress/P0-plan.md`, `docs/progress/P0-report.md`, `docs/progress/corrections.md`.

## Item 2: P0-T10 Observability Baseline Status Update
- **Change:** Changed P0-T10 (Observability baseline) status from DONE to `IN PROGRESS` (BLOCKED-EXTERNAL on E1, E7).
- **Rationale:** Added CloudWatch dashboard definition (`infra/monitoring/cloudwatch-dashboard.json`) and external synthetic probe definition (`infra/monitoring/synthetic-probe.json`) per Part 14.5. Probe execution against deployed host is blocked externally on `E1` (AWS dev account) and `E7` (staging environment).
- **Files Modified:** `infra/monitoring/cloudwatch-dashboard.json`, `infra/monitoring/synthetic-probe.json`, `docs/progress/P0-plan.md`, `docs/progress/P0-report.md`, `docs/progress/corrections.md`.

## Item 3: P0 Commit Map Correction
- **Change:** Corrected erroneous citations of documentation commit `441b4e5` in `P0-plan.md` across P0-T1, T2, T5, T7, T8, T9, T12, and T13 to their true code delivery commits:
  - `P0-T1`: `b598b27`
  - `P0-T2`: `e015693`
  - `P0-T5`: `37fc4d2`
  - `P0-T7`: `92a1224`
  - `P0-T8`: `6fa0273`
  - `P0-T9`: `e4d29c7`
  - `P0-T12`: `90b42c2`
  - `P0-T13`: `90b42c2`
- **Files Modified:** `docs/progress/P0-plan.md`, `docs/progress/corrections.md`.

## Item 4: P0-T3 Migration and Users Columns Empirical Verification
- **Change:** Executed `db:migrate` (prisma migrate deploy) against native PostgreSQL 16 with PostGIS 3.4.2 on Windows. Verified `college_email_exception` and `exception_reason` columns on `users` table. Saved raw output to `docs/progress/evidence/P0-T3.log`.
- **Files Modified:** `docs/progress/evidence/P0-T3.log`, `scripts/verify-p0-t3-db.ts`, `docs/progress/corrections.md`.

## Item 5: P0-T6 OIDC PKCE, State/Nonce, T-AUTH-03, and Runtime Provider Choice
- **Change:** Implemented OIDC authorization with PKCE (S256 code challenge), cryptographically random state and nonce generation, and runtime choice between Google Workspace and Microsoft Entra ID. Verified all 11 unit tests in `services/api/test/auth.spec.ts` including refresh token family rotation (`T-AUTH-03`) and driver OTP lockout. Recorded evidence in `docs/progress/evidence/P0-T6.log`. Noted that live SSO sign-in remains Exit 1 and stays BLOCKED-EXTERNAL on `E3` (college identity test tenant).
- **Files Modified:** `services/api/src/modules/auth/auth.service.ts`, `services/api/test/auth.spec.ts`, `docs/progress/evidence/P0-T6.log`, `docs/progress/corrections.md`.

## Item 6: P0-T11, P0-T16, P0-T17 CI and AWS Blocker Status
- **Change:** Verified and affirmed that P0-T11 (dev infrastructure), P0-T16 (CI/CD pipeline automation), and P0-T17 (Terraform dev/staging/prod configurations) are `IN PROGRESS` until `terraform validate` and `terraform plan` pass in CI (`E2`). Dev infrastructure application is gated on AWS credentials (`E1`).
- **Files Modified:** `docs/progress/corrections.md`.

## Item 7: P2 Part 16 Task Verification
- **Change:** Confirmed and verified that all tasks P2-T1 to P2-T14 exist under their Part 16 IDs with dedicated unit test suites. Ran discrete verification for P2-T1 (`route-guard.spec.ts`), P2-T2 (`map-marker.spec.ts`), P2-T3 (`eta-stop-card.spec.ts`), P2-T5 (`faculty-manifest.spec.ts`), P2-T7 (`navigation-store.spec.ts`), P2-T9 (`qr-attendance.spec.ts`), P2-T10 (`student-requests.spec.ts`), and P2-T11 (`student-requests.spec.ts`), passing 65/65 tests. Saved evidence in `docs/progress/evidence/P2-discrete-tasks.log`.
- **Files Modified:** `docs/progress/evidence/P2-discrete-tasks.log`, `docs/progress/corrections.md`.

## Item 8: P3 Tasks Local Verification and Blocker Recording
- **Change:** Confirmed and verified tasks P3-T1 to P3-T8 and P3-T15 to P3-T18 locally. Ran 74 mobile unit/integration tests (`shift-lifecycle.spec.ts` for T-SHF-01 to T-SHF-04, `location-buffer.spec.ts` for T-OFF-01 SQLite buffer, pre-trip diagnostics, driver boarding, SOS trigger, etc.) and 28 API backend tests (`driver-pipeline.spec.ts`, `driver-stops.spec.ts`, `driver-trip-summary.spec.ts`, `shift-auto-end.spec.ts`, `sos-pipeline.spec.ts`). Recorded evidence in `docs/progress/evidence/P3-local-verification.log`. Recorded physical device exits (AC-DRV-01 to AC-DRV-04) and 2-hour battery test (T-MOB-01) as BLOCKED-EXTERNAL on `E6` (physical reference phones), `E3` (college identity test tenant), and `E5` (Turnstile keys).
- **Files Modified:** `docs/progress/evidence/P3-local-verification.log`, `docs/progress/corrections.md`.

## Item 9: P4 Integration Verification and Report Correction
- **Change:** Implemented and ran real-database integration tests for P4 in `services/api/test/p4-coordinator-technician.integration.spec.ts` against native PostgreSQL 16 with PostGIS:
  - `AC-COR-01`: Revoked device rejected immediately and maintenance ticket created.
  - `AC-COR-02`: CSV with 3 bad rows out of 400 blocks commit and lists bad rows.
  - `AC-COR-03`: Deactivated user revoked from sessions within 60s.
  - `AC-TEC-02`: Device replacement preserves history and keeps telemetry segregated.
  - `T-SEC-05`: Admin endpoints reject unauthorized roles with 403 or 404.
  - `AC-TEC-01`: Recorded as BLOCKED-EXTERNAL on `E11` (bench tracker hardware).
- **Files Modified:** `services/api/test/p4-coordinator-technician.integration.spec.ts`, `packages/db/src/index.ts`, `docs/progress/evidence/P4-integration-verification.log`, `docs/progress/corrections.md`.

## Item 10: P5 T-CON-01 Native PostgreSQL Concurrency and Injected Clock Verification
- **Change:** Rewrote `T-CON-01` in `services/api/test/attendance-manual-concurrency.spec.ts` to execute two concurrent transactions against native PostgreSQL 16 with the unique index `@@unique([trip_id, student_id])` on `attendance_records`. Verified that exactly one transaction commits and the second fails with unique constraint violation (`23505`) resulting in `DUPLICATE_BOARDING`. Verified `T-ATT-01` (QR token 30s accepted, 65s rejected with injected clock), `T-ATT-02` (duplicate scan in database), `T-ATT-03` (morning present, afternoon absent alert within 5m of cutoff), and `T-ATT-04` (leave prevents alert) across 16 passing tests. Recorded evidence in `docs/progress/evidence/P5-attendance-concurrency-verification.log`.
- **Files Modified:** `services/api/test/attendance-manual-concurrency.spec.ts`, `docs/progress/evidence/P5-attendance-concurrency-verification.log`, `docs/progress/corrections.md`.

## Item 11: P1 T-LOAD-01 Local Smoke Run Execution
- **Change:** Executed `T-LOAD-01` local smoke run against native PostgreSQL 16 with PostGIS using the 50-bus fleet simulator (`scripts/load/run-t-load-01-local-smoke.ts`). Ingested 315 batches / 315 location samples across 6 operational scenarios with 0 errors in 362ms (870.17 batches/sec). Recorded output in `docs/progress/evidence/T-LOAD-01-local-smoke.log` as smoke evidence only. Confirmed that the full staging load exit remains BLOCKED-EXTERNAL on `E7`.
- **Files Modified:** `scripts/load/run-t-load-01-local-smoke.ts`, `docs/progress/evidence/T-LOAD-01-local-smoke.log`, `docs/progress/corrections.md`.






