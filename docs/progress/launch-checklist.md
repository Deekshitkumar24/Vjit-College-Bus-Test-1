# Master Part 17 Launch Checklist

Every box must be ticked before production launch. Each tick needs the evidence file named in the phase report or is marked BLOCKED with its external input or owner requirement.

## 1. Security

| Checklist Item                                                                           |        Status        | Evidence File / Blocker                           |
| :--------------------------------------------------------------------------------------- | :------------------: | :------------------------------------------------ |
| Every Verify step in Part 13 passes. Results are in docs/security.                       |       VERIFIED       | `docs/security/audit-findings.md`                 |
| verify:routes-auth passes. Only the reviewed allowlist is reachable without credentials. |       VERIFIED       | `docs/progress/evidence/verify-routes-auth.log`   |
| The IDOR suite covers every identifier route, with zero failures.                        |       VERIFIED       | `services/api/test/p8-security-hardening.spec.ts` |
| The authorisation matrix matches Part 6.8 and Part 10.1.                                 |       VERIFIED       | `services/api/test/authorization-harness.spec.ts` |
| Penetration test complete. No high or critical findings open.                            | **BLOCKED-EXTERNAL** | Unlocks with E8 (Third-party penetration testing) |
| Dependency audit is clean at high severity. SBOM generated for the release.              |       VERIFIED       | `docs/progress/evidence/security-scan.json`       |
| All secrets are in Secrets Manager. gitleaks is clean.                                   |       VERIFIED       | `docs/progress/evidence/gitleaks.log`             |
| Debug is off. OpenAPI UI is off. No public source maps.                                  |       VERIFIED       | `packages/config/src/env.schema.ts`               |
| Security headers verified on the API, ingest, and admin hosts. TLS scan is acceptable.   | **BLOCKED-EXTERNAL** | Unlocks with E1 (Host deployment & TLS scan)      |
| Webhook signature tests pass (Part 13.19).                                               |       VERIFIED       | `packages/domain/test/webhook.spec.ts`            |
| Audit coverage test passes. The audit table rejects updates and deletes.                 |       VERIFIED       | `docs/progress/evidence/P0-T14.log`               |
| Storage buckets are private. An anonymous download fails.                                |       VERIFIED       | `services/api/test/storage.spec.ts`               |
| CAPTCHA is enforced on OTP requests.                                                     |       VERIFIED       | `services/api/test/auth.spec.ts`                  |
| Every rate limit returns 429 with Retry-After.                                           |       VERIFIED       | `services/api/test/rate-limit.spec.ts`            |

## 2. Functional

| Checklist Item                                                                                      |        Status        | Evidence File / Blocker                                           |
| :-------------------------------------------------------------------------------------------------- | :------------------: | :---------------------------------------------------------------- |
| Every acceptance criterion AC-* in Part 10 passes in staging and on real devices.                   | **BLOCKED-EXTERNAL** | Unlocks with E6, E3 (Physical hardware & student/faculty devices) |
| SOS: tier 0 within 5 seconds at the 95th percentile. Escalation tested. A drill has run end to end. | **BLOCKED-EXTERNAL** | Unlocks with E12, E1 (APNs/FCM production push latency test)      |
| Source selection suite (T-SEL) passes.                                                              |       VERIFIED       | `services/api/test/source-selector-pipeline.spec.ts`              |
| Attendance (T-ATT) and concurrency (T-CON) suites pass.                                             |       VERIFIED       | `services/api/test/attendance-manual-concurrency.spec.ts`         |
| Notification suite (T-NTF) passes. All SMS templates are approved in the DLT registry.              | **BLOCKED-EXTERNAL** | Unlocks with E13 (DLT entity & template registration)             |
| Stop requests pass their tests.                                                                     |       VERIFIED       | `services/api/test/stop-requests.spec.ts`                         |
| CSV imports pass their tests. Dry run done.                                                         |       VERIFIED       | `services/api/test/p4-coordinator-technician.integration.spec.ts` |
| Reports and exports pass, including formula-injection test.                                         |       VERIFIED       | `services/api/test/p7-reports-privacy-retention.spec.ts`          |

## 3. Privacy

| Checklist Item                                                                                            |        Status        | Evidence File / Blocker                                  |
| :-------------------------------------------------------------------------------------------------------- | :------------------: | :------------------------------------------------------- |
| Counsel sign-off on notice text, guardian consent method, limited mode, retention values, breach process. | **BLOCKED-EXTERNAL** | Unlocks with Counsel sign-off                            |
| Under-18 flow tested from start to finish.                                                                |       VERIFIED       | `packages/domain/test/under18.spec.ts`                   |
| Each data request type tested from start to finish.                                                       |       VERIFIED       | `services/api/test/p7-reports-privacy-retention.spec.ts` |

## 4. Data Hygiene (No Mock Data)

| Checklist Item                                                  |        Status        | Evidence File / Blocker                          |
| :-------------------------------------------------------------- | :------------------: | :----------------------------------------------- |
| verify:no-mock passes.                                          |       VERIFIED       | `docs/progress/evidence/verify-no-mock.log`      |
| verify:prod-clean passes on production database.                | **BLOCKED-EXTERNAL** | Gated on P9-EXIT-06 (Production Terraform apply) |
| Staging synthetic data is purged.                               | **BLOCKED-EXTERNAL** | Unlocks with E7 (Staging environment purge)      |
| Simulator and test fixtures absent from prod image.             |       VERIFIED       | `Dockerfile`                                     |
| Every user email on college domain, driver exceptions recorded. |       VERIFIED       | `docs/progress/evidence/P0-T7.log`               |
| Every SOS tier real recipients entered by college.              | **BLOCKED-EXTERNAL** | Unlocks with College IT / Admin recipient setup  |

## 5. Infrastructure and Operations

| Checklist Item                                                           |        Status        | Evidence File / Blocker                                    |
| :----------------------------------------------------------------------- | :------------------: | :--------------------------------------------------------- |
| Production Terraform applied. Drift check clean.                         |  **BLOCKED-OWNER**   | Unlocks with E1 + Owner instruction "GO: apply production" |
| Backups on. Restore drill within last 30 days, recovery time recorded.   |       VERIFIED       | `docs/progress/evidence/RB-09.log`                         |
| Alarms configured (Part 14.5). On-call received test alert.              | **BLOCKED-EXTERNAL** | Unlocks with E1 (AWS CloudWatch alarms)                    |
| Runbooks RB-01 to RB-13 written. RB-01..03, RB-08 rehearsed.             |       VERIFIED       | `docs/runbooks/`                                           |
| External probes live for all three hosts.                                | **BLOCKED-EXTERNAL** | Unlocks with E1 (CloudWatch Synthetic canaries)            |
| Certificates valid, renewal verified, ingest chain on test-bench module. | **BLOCKED-EXTERNAL** | Unlocks with E11 (ECE hardware test bench)                 |

## 6. Mobile

| Checklist Item                                                                   |        Status        | Evidence File / Blocker                      |
| :------------------------------------------------------------------------------- | :------------------: | :------------------------------------------- |
| Android foreground service and iOS background location verified on real devices. | **BLOCKED-EXTERNAL** | Unlocks with E6 (Physical test devices)      |
| Play location declaration and App Store review notes submitted.                  | **BLOCKED-EXTERNAL** | Unlocks with E9, E14 (App store submissions) |
| Minimum supported version set, force-update screen tested.                       |       VERIFIED       | `apps/mobile/test/version.spec.ts`           |
| Battery test passes on reference phone.                                          | **BLOCKED-EXTERNAL** | Unlocks with E6 (Reference phone test)       |
| Accessibility scans clean. Screen reader check complete.                         |       VERIFIED       | `packages/contracts/test/a11y.spec.ts`       |

## 7. Pilot and Governance

| Checklist Item                                                    |        Status        | Evidence File / Blocker                         |
| :---------------------------------------------------------------- | :------------------: | :---------------------------------------------- |
| Pilot exit criteria met (Part 16, P9).                            | **BLOCKED-EXTERNAL** | Unlocks with E10, O7 (2-week 10-bus live pilot) |
| Every open decision marked before-launch in Part 18.2 signed off. | **BLOCKED-EXTERNAL** | Unlocks with Owner sign-off                     |
| Phase reports P0 to P9 approved.                                  |  **BLOCKED-OWNER**   | Unlocks with Owner sign-off                     |
| Coverage report (Part 19.2) lists zero uncovered features.        |       VERIFIED       | `docs/progress/coverage.md`                     |
