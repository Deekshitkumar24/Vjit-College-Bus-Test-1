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

