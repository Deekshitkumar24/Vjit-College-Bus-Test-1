# Traceability & Verification Coverage Matrix

**Contract:** `AG-MASTER-FINAL-1.0` (Section 21.7) & `AG-MVP-PRODUCTION-2.0`  
**Generated:** 2026-10-23T07:46:24.004Z  
**Total Items Verified:** 110 (100% mapped to active test files)  

## Features

| Item ID | Description | Implementation Path | Authoritative Test File | Status |
| :--- | :--- | :--- | :--- | :---: |
| **F-ING-01** | Hardware telemetry ingestion (S1-S13) | `services/api/src/modules/telemetry/` | `services/api/test/telemetry-pipeline.spec.ts` | **Built and passing** |
| **F-ING-02** | Driver phone telemetry ingestion | `services/api/src/modules/driver/` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **F-ING-03** | Tracker heartbeats and health state | `services/api/src/modules/heartbeat/` | `services/api/test/heartbeat-pipeline.spec.ts` | **Built and passing** |
| **F-SRC-01** | Source selection engine & anti-flapping | `services/api/src/modules/selector/` | `services/api/test/source-selector-pipeline.spec.ts` | **Built and passing** |
| **F-MAP-01** | Student/Faculty Live Map views | `apps/mobile/src/map/` | `apps/mobile/test/map-marker.spec.ts` | **Built and passing** |
| **F-ETA-01** | Stop arrival and ETA projection | `packages/domain/src/eta-stop-arrival.ts` | `apps/mobile/test/eta-stop-card.spec.ts` | **Built and passing** |
| **F-ATT-01** | 30s rotating QR boarding check-in | `services/api/src/modules/attendance/` | `services/api/test/attendance-scan.spec.ts` | **Built and passing** |
| **F-ATT-02** | Driver manual check-in & guest boarding | `services/api/src/modules/attendance/` | `services/api/test/attendance-manual-concurrency.spec.ts` | **Built and passing** |
| **F-ATT-03** | Absence detection and safety alerts | `services/api/src/modules/attendance/` | `services/api/test/absence-evaluator.spec.ts` | **Built and passing** |
| **F-ATT-04** | Leave application & cutoff guard | `services/api/src/modules/attendance/` | `services/api/test/leave-flow.spec.ts` | **Built and passing** |
| **F-SOS-01** | Multi-channel SOS creation & 60s join | `services/api/src/modules/sos/` | `services/api/test/p6-sos-notifications.spec.ts` | **Built and passing** |
| **F-SOS-02** | Escalation ladder & cancellation lock | `services/api/src/modules/sos/` | `services/api/test/p6-sos-notifications.spec.ts` | **Built and passing** |
| **F-NTF-01** | Notification dispatch & quiet hours | `services/api/src/modules/notifications/` | `services/api/test/p6-sos-notifications.spec.ts` | **Built and passing** |
| **F-EXP-01** | 100k row export & formula sanitization | `services/api/src/modules/reports/` | `services/api/test/p7-reports-privacy-retention.spec.ts` | **Built and passing** |
| **F-PRV-01** | Minor consent & GDPR/DPDP data erasure | `services/api/src/modules/privacy/` | `services/api/test/p7-reports-privacy-retention.spec.ts` | **Built and passing** |

## Rules

| Item ID | Description | Implementation Path | Authoritative Test File | Status |
| :--- | :--- | :--- | :--- | :---: |
| **R-01** | Jump check (>150 km/h) marks sample invalid | `packages/domain/src/gps-quality.ts` | `services/api/test/telemetry-pipeline.spec.ts` | **Built and passing** |
| **R-02** | Anti-flapping: min 3 valid samples to switch | `packages/domain/src/source-selector.ts` | `services/api/test/source-selector-pipeline.spec.ts` | **Built and passing** |
| **R-03** | Stale threshold: 30s hardware, 20s phone | `packages/domain/src/source-selector.ts` | `services/api/test/source-selector-pipeline.spec.ts` | **Built and passing** |
| **R-04** | Geofence arrival within 50m radius | `packages/domain/src/eta-stop-arrival.ts` | `apps/mobile/test/eta-stop-card.spec.ts` | **Built and passing** |
| **R-05** | QR token 30s rotating HMAC | `packages/domain/src/qr-attendance.ts` | `services/api/test/attendance-scan.spec.ts` | **Built and passing** |
| **R-06** | Driver OTP max attempts & 15m lockout | `services/api/src/modules/auth/` | `services/api/test/auth.spec.ts` | **Built and passing** |
| **R-07** | Concurrency: unique index on attendance | `packages/db/prisma/schema.prisma` | `services/api/test/attendance-manual-concurrency.spec.ts` | **Built and passing** |
| **R-08** | Driver mutual exclusion: 1 active shift/bus | `services/api/src/modules/driver/` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **R-09** | Audit log append-only trigger rejection | `packages/db/src/rls-manager.ts` | `packages/db/test/integration.spec.ts` | **Built and passing** |
| **R-10** | Refresh token reuse family revocation | `services/api/src/modules/auth/` | `services/api/test/auth.spec.ts` | **Built and passing** |
| **R-11** | SOS cancellation rejected after ack | `services/api/src/modules/sos/` | `services/api/test/p6-sos-notifications.spec.ts` | **Built and passing** |
| **R-12** | Morning boarded + afternoon absent alert | `services/api/src/modules/attendance/` | `services/api/test/absence-evaluator.spec.ts` | **Built and passing** |
| **R-13** | Leave cutoff 30m before departure | `services/api/src/modules/attendance/` | `services/api/test/leave-flow.spec.ts` | **Built and passing** |
| **R-14** | CSV formula injection sanitization | `services/api/src/modules/reports/` | `services/api/test/p7-reports-privacy-retention.spec.ts` | **Built and passing** |
| **R-15** | Minor without guardian restricted | `services/api/src/modules/privacy/` | `services/api/test/p7-reports-privacy-retention.spec.ts` | **Built and passing** |
| **R-16** | Data deletion anonymizes SOS events | `services/api/src/modules/privacy/` | `services/api/test/p7-reports-privacy-retention.spec.ts` | **Built and passing** |
| **R-17** | Retention purges expired partitions | `services/api/src/modules/retention/` | `services/api/test/p7-reports-privacy-retention.spec.ts` | **Built and passing** |
| **R-18** | Quiet hours non-safety suppressed | `services/api/src/modules/notifications/` | `services/api/test/p6-sos-notifications.spec.ts` | **Built and passing** |
| **R-19** | Recipient notification rate limit 5/min | `services/api/src/modules/notifications/` | `services/api/test/p6-sos-notifications.spec.ts` | **Built and passing** |
| **R-20** | SMS DLT template mismatch blocked | `services/api/src/modules/notifications/` | `services/api/test/p6-sos-notifications.spec.ts` | **Built and passing** |

## Acceptance Tests

| Item ID | Description | Implementation Path | Authoritative Test File | Status |
| :--- | :--- | :--- | :--- | :---: |
| **AC-COR-01** | Revoked tracker token 401 rejection | `services/api/src/modules/telemetry/` | `services/api/test/p4-coordinator-technician.integration.spec.ts` | **Built and passing** |
| **AC-COR-02** | Bulk CSV import dry-run validation | `apps/admin-web/src/pages/Users.tsx` | `services/api/test/p4-coordinator-technician.integration.spec.ts` | **Built and passing** |
| **AC-COR-03** | User deactivation instant session revocation | `services/api/src/modules/auth/` | `services/api/test/p4-coordinator-technician.integration.spec.ts` | **Built and passing** |
| **AC-TEC-01** | Bench tracker test mode first heartbeat < 2m | `apps/admin-web/src/pages/BenchMode.tsx` | `apps/admin-web/test/bench-mode.spec.ts` | **Built and passing** |
| **AC-TEC-02** | Replacement hardware telemetry segregation | `services/api/src/modules/driver/` | `services/api/test/p4-coordinator-technician.integration.spec.ts` | **Built and passing** |
| **AC-STU-01..05** | Student mobile navigation, map, QR, requests, SOS | `apps/mobile/src/` | `apps/mobile/test/qr-attendance.spec.ts` | **Built and passing** |
| **AC-FAC-01..03** | Faculty passenger manifest & alerts | `apps/mobile/src/` | `apps/mobile/test/faculty-manifest.spec.ts` | **Built and passing** |
| **AC-DRV-01..04** | Driver shift lifecycle, pre-trip, QR display, SOS | `apps/mobile/src/` | `apps/mobile/test/shift-lifecycle.spec.ts` | **Built and passing** |
| **T-ING-01..10** | Telemetry stages S1-S13 & conflict handling | `services/api/src/modules/telemetry/` | `services/api/test/telemetry-pipeline.spec.ts` | **Built and passing** |
| **T-SEL-01..05** | Source selection arbitration & anti-flapping | `services/api/src/modules/selector/` | `services/api/test/source-selector-pipeline.spec.ts` | **Built and passing** |
| **T-SEC-01** | Global route authorization harness across all roles | `services/api/src/common/guards/` | `services/api/test/authorization-harness.spec.ts` | **Built and passing** |
| **T-SEC-02** | Kinematic speed clamp & jump checks | `services/api/src/modules/telemetry/` | `services/api/test/telemetry-pipeline.spec.ts` | **Built and passing** |
| **T-SEC-03** | Formula injection sanitization | `services/api/src/modules/reports/` | `services/api/test/p7-reports-privacy-retention.spec.ts` | **Built and passing** |
| **T-SEC-04** | Rate limiting 429 and idempotency 409 | `services/api/src/common/middleware/` | `services/api/test/auth.spec.ts` | **Built and passing** |
| **T-SEC-05** | Admin role guards 403/404 isolation | `services/api/src/common/guards/` | `services/api/test/p4-coordinator-technician.integration.spec.ts` | **Built and passing** |
| **T-SHF-01..04** | Driver shift mutual exclusion & persistence | `services/api/src/modules/driver/` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **T-OFF-01** | 24-hour offline location SQLite buffer | `apps/mobile/src/services/location-buffer.ts` | `apps/mobile/test/location-buffer.spec.ts` | **Built and passing** |
| **T-ATT-01..04** | Attendance token expiration, duplicates, absence | `services/api/src/modules/attendance/` | `services/api/test/attendance-scan.spec.ts` | **Built and passing** |
| **T-CON-01** | Concurrency unique index on boarding | `packages/db/prisma/schema.prisma` | `services/api/test/attendance-manual-concurrency.spec.ts` | **Built and passing** |
| **T-CON-03** | Atomic advisory lock on concurrent SOS triggers | `services/api/src/modules/sos/` | `services/api/test/p6-sos-notifications.spec.ts` | **Built and passing** |
| **T-SOS-01..06** | SOS create/join, isolation, escalation, cancellation | `services/api/src/modules/sos/` | `services/api/test/p6-sos-notifications.spec.ts` | **Built and passing** |
| **T-NTF-01..03** | Quiet hours, rate limits, DLT template checks | `services/api/src/modules/notifications/` | `services/api/test/p6-sos-notifications.spec.ts` | **Built and passing** |
| **T-PRV-01..03** | Minor restricted mode, erasure, partition retention | `services/api/src/modules/privacy/` | `services/api/test/p7-reports-privacy-retention.spec.ts` | **Built and passing** |

## Configuration

| Item ID | Description | Implementation Path | Authoritative Test File | Status |
| :--- | :--- | :--- | :--- | :---: |
| **CFG-79** | All 79 system config keys validated with Zod schema | `packages/config/src/schema.ts` | `packages/config/test/config.spec.ts` | **Built and passing** |

## Jobs

| Item ID | Description | Implementation Path | Authoritative Test File | Status |
| :--- | :--- | :--- | :--- | :---: |
| **JOB-01** | Shift Auto-End: terminates idle shifts (>60m) & 14h timeout | `services/api/src/modules/shift/shift-auto-end.service.ts` | `services/api/test/shift-auto-end.spec.ts` | **Built and passing** |
| **JOB-02** | Absence Evaluator: morning present, afternoon absent alerts | `services/api/src/modules/attendance/absence-evaluator.service.ts` | `services/api/test/absence-evaluator.spec.ts` | **Built and passing** |
| **JOB-03** | SOS Escalation: 2-minute unacknowledged escalation | `services/api/src/modules/sos/sos.service.ts` | `services/api/test/p6-sos-notifications.spec.ts` | **Built and passing** |
| **JOB-04** | Retention Purge: 90-day partition expiration purge | `services/api/src/modules/retention/retention.service.ts` | `services/api/test/p7-reports-privacy-retention.spec.ts` | **Built and passing** |

## Alerts

| Item ID | Description | Implementation Path | Authoritative Test File | Status |
| :--- | :--- | :--- | :--- | :---: |
| **ALT-01** | Morning-present afternoon-absent discrepancy alert (D-12) | `services/api/src/modules/attendance/absence-evaluator.service.ts` | `services/api/test/absence-evaluator.spec.ts` | **Built and passing** |
| **ALT-02** | SOS Emergency safety broadcast alert | `services/api/src/modules/sos/sos.service.ts` | `services/api/test/p6-sos-notifications.spec.ts` | **Built and passing** |
| **ALT-03** | Missing recipient list setup alert (T-SOS-06) | `services/api/src/modules/notifications/` | `services/api/test/p6-sos-notifications.spec.ts` | **Built and passing** |
| **ALT-04** | Operational SEV-1 to SEV-4 alert classification | `services/api/src/modules/reports/` | `services/api/test/operational-alerts-export.spec.ts` | **Built and passing** |

## Events

| Item ID | Description | Implementation Path | Authoritative Test File | Status |
| :--- | :--- | :--- | :--- | :---: |
| **EVT-01** | Hardware telemetry sample ingestion events | `services/api/src/modules/telemetry/` | `services/api/test/telemetry-pipeline.spec.ts` | **Built and passing** |
| **EVT-02** | Hardware heartbeat and diagnostic events (E1-E6) | `services/api/src/modules/heartbeat/` | `services/api/test/heartbeat-pipeline.spec.ts` | **Built and passing** |
| **EVT-03** | SOS trigger, join, escalation, and ack events | `services/api/src/modules/sos/` | `services/api/test/p6-sos-notifications.spec.ts` | **Built and passing** |
| **EVT-04** | Append-only audit trail events | `packages/db/src/rls-manager.ts` | `packages/db/test/integration.spec.ts` | **Built and passing** |

## Roles

| Item ID | Description | Implementation Path | Authoritative Test File | Status |
| :--- | :--- | :--- | :--- | :---: |
| **ROLES-8** | 8 platform roles (STU, FAC, DRV, SEC, COR, TEC, MGT, SAD) | `services/api/src/common/guards/roles.guard.ts` | `services/api/test/authorization-harness.spec.ts` | **Built and passing** |

## Conflicts

| Item ID | Description | Implementation Path | Authoritative Test File | Status |
| :--- | :--- | :--- | :--- | :---: |
| **C-01..12** | Locked decisions and resolutions (C-01 to C-12) | `services/api/src/modules/` | `services/api/test/auth.spec.ts` | **Built and passing** |

## Endpoints

| Item ID | Description | Implementation Path | Authoritative Test File | Status |
| :--- | :--- | :--- | :--- | :---: |
| **POST /api/v1/attendance/corrections/:id** | Protected: Authenticated | `services/api/src/modules/attendance.controller.ts` | `services/api/test/attendance-scan.spec.ts` | **Built and passing** |
| **POST /api/v1/attendance/manual** | Protected: Authenticated | `services/api/src/modules/attendance.controller.ts` | `services/api/test/attendance-scan.spec.ts` | **Built and passing** |
| **POST /api/v1/attendance/scan** | Protected: Authenticated | `services/api/src/modules/attendance.controller.ts` | `services/api/test/attendance-scan.spec.ts` | **Built and passing** |
| **GET /api/v1/attendance/trips/:id/qr** | Protected: Authenticated | `services/api/src/modules/attendance.controller.ts` | `services/api/test/attendance-scan.spec.ts` | **Built and passing** |
| **POST /api/v1/auth/logout** | Protected: Authenticated | `services/api/src/modules/auth.controller.ts` | `services/api/test/auth.spec.ts` | **Built and passing** |
| **POST /api/v1/auth/mfa/enrol** | Protected: Authenticated | `services/api/src/modules/auth.controller.ts` | `services/api/test/auth.spec.ts` | **Built and passing** |
| **POST /api/v1/auth/mfa/verify** | Protected: Authenticated | `services/api/src/modules/auth.controller.ts` | `services/api/test/auth.spec.ts` | **Built and passing** |
| **POST /api/v1/auth/otp/request** | Public endpoint | `services/api/src/modules/auth.controller.ts` | `services/api/test/auth.spec.ts` | **Built and passing** |
| **POST /api/v1/auth/otp/verify** | Public endpoint | `services/api/src/modules/auth.controller.ts` | `services/api/test/auth.spec.ts` | **Built and passing** |
| **POST /api/v1/auth/refresh** | Public endpoint | `services/api/src/modules/auth.controller.ts` | `services/api/test/auth.spec.ts` | **Built and passing** |
| **GET /api/v1/auth/sessions** | Protected: Authenticated | `services/api/src/modules/auth.controller.ts` | `services/api/test/auth.spec.ts` | **Built and passing** |
| **DELETE /api/v1/auth/sessions/:id** | Protected: Authenticated | `services/api/src/modules/auth.controller.ts` | `services/api/test/auth.spec.ts` | **Built and passing** |
| **GET /api/v1/auth/sso/callback** | Public endpoint | `services/api/src/modules/auth.controller.ts` | `services/api/test/auth.spec.ts` | **Built and passing** |
| **POST /api/v1/auth/sso/start** | Public endpoint | `services/api/src/modules/auth.controller.ts` | `services/api/test/auth.spec.ts` | **Built and passing** |
| **GET /api/v1/driver/bus/:busId** | Protected: DRV | `services/api/src/modules/driver.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **POST /api/v1/driver/checkin** | Protected: DRV | `services/api/src/modules/driver.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **POST /api/v1/driver/device-register** | Protected: DRV | `services/api/src/modules/driver.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **POST /api/v1/driver/locations** | Protected: DRV | `services/api/src/modules/driver.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **GET /api/v1/driver/manifest/:tripId** | Protected: DRV | `services/api/src/modules/driver.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **POST /api/v1/driver/mode** | Protected: DRV | `services/api/src/modules/driver.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **GET /api/v1/driver/roster** | Protected: DRV | `services/api/src/modules/driver.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **POST /api/v1/driver/sos** | Protected: DRV | `services/api/src/modules/driver.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **GET /api/v1/driver/sos/:incidentId** | Protected: DRV | `services/api/src/modules/driver.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **POST /api/v1/driver/status** | Protected: DRV | `services/api/src/modules/driver.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **GET /api/v1/driver/stops/:shiftId** | Protected: DRV | `services/api/src/modules/driver.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **POST /api/v1/driver/stops/arrival** | Protected: DRV | `services/api/src/modules/driver.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **POST /api/v1/driver/tickets** | Protected: DRV | `services/api/src/modules/driver.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **GET /api/v1/driver/trip-summary/:shiftId** | Protected: DRV | `services/api/src/modules/driver.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **POST /api/v1/events** | Public endpoint | `services/api/src/modules/heartbeat.controller.ts` | `services/api/test/heartbeat-pipeline.spec.ts` | **Built and passing** |
| **GET /api/v1/health** | Public endpoint | `services/api/src/modules/health.controller.ts` | `services/api/test/health.spec.ts` | **Built and passing** |
| **GET /api/v1/health/ready** | Public endpoint | `services/api/src/modules/health.controller.ts` | `services/api/test/health.spec.ts` | **Built and passing** |
| **POST /api/v1/heartbeat** | Public endpoint | `services/api/src/modules/heartbeat.controller.ts` | `services/api/test/heartbeat-pipeline.spec.ts` | **Built and passing** |
| **GET /api/v1/shifts/active** | Protected: DRV | `services/api/src/modules/shift.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **POST /api/v1/shifts/claim** | Protected: DRV | `services/api/src/modules/shift.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **POST /api/v1/shifts/end** | Protected: DRV | `services/api/src/modules/shift.controller.ts` | `services/api/test/driver-pipeline.spec.ts` | **Built and passing** |
| **GET /api/v1/snapshot** | Protected: STU, FAC, DRV, SEC, COR, TEC, MGT, SAD | `services/api/src/modules/snapshot.controller.ts` | `services/api/test/snapshot-pipeline.spec.ts` | **Built and passing** |
| **POST /api/v1/telemetry** | Public endpoint | `services/api/src/modules/telemetry.controller.ts` | `services/api/test/telemetry-pipeline.spec.ts` | **Built and passing** |

