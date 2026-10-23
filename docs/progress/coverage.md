# Traceability & Verification Coverage Matrix

**Contract:** `AG-MASTER-FINAL-1.0` (Parts 8, 10, 15, 20, 21) & `AG-MVP-FINAL-RUN-1.0.md`  
**Date:** 23 October 2026  

---

## 1. Feature Coverage (Master Part 10.2)

| Feature ID | Scope | Implementation File | Test File | Status |
| :--- | :--- | :--- | :--- | :---: |
| **F-ING-01** | Hardware telemetry ingestion (S1-S13) | `services/api/src/modules/telemetry/` | `services/api/test/telemetry-pipeline.spec.ts` | Built and passing |
| **F-ING-02** | Driver phone telemetry ingestion | `services/api/src/modules/driver/` | `services/api/test/driver-pipeline.spec.ts` | Built and passing |
| **F-ING-03** | Tracker heartbeats and health state | `services/api/src/modules/heartbeat/` | `services/api/test/heartbeat-pipeline.spec.ts` | Built and passing |
| **F-SRC-01** | Source selection engine & anti-flapping | `services/api/src/modules/selector/` | `services/api/test/source-selector-pipeline.spec.ts` | Built and passing |
| **F-MAP-01** | Student/Faculty Live Map views | `apps/mobile/src/map/` | `apps/mobile/test/map-marker.spec.ts` | Built and passing |
| **F-ETA-01** | Stop arrival and ETA projection | `packages/domain/src/eta-stop-arrival.ts` | `apps/mobile/test/eta-stop-card.spec.ts` | Built and passing |
| **F-ATT-01** | 30s rotating QR boarding check-in | `services/api/src/modules/attendance/` | `services/api/test/attendance-scan.spec.ts` | Built and passing |
| **F-ATT-02** | Driver manual check-in & guest boarding | `services/api/src/modules/attendance/` | `services/api/test/attendance-manual-concurrency.spec.ts` | Built and passing |
| **F-ATT-03** | Absence detection and safety alerts | `services/api/src/modules/attendance/` | `services/api/test/absence-evaluator.spec.ts` | Built and passing |
| **F-ATT-04** | Leave application & cutoff guard | `services/api/src/modules/attendance/` | `services/api/test/leave-flow.spec.ts` | Built and passing |
| **F-SOS-01** | Multi-channel SOS creation & 60s join | `services/api/src/modules/sos/` | `services/api/test/p6-sos-notifications.spec.ts` | Built and passing |
| **F-SOS-02** | Escalation ladder & cancellation lock | `services/api/src/modules/sos/` | `services/api/test/p6-sos-notifications.spec.ts` | Built and passing |
| **F-NTF-01** | Notification dispatch & quiet hours | `services/api/src/modules/notifications/` | `services/api/test/p6-sos-notifications.spec.ts` | Built and passing |
| **F-EXP-01** | 100k row export & formula sanitization | `services/api/src/modules/reports/` | `services/api/test/p7-reports-privacy-retention.spec.ts` | Built and passing |
| **F-PRV-01** | Minor consent & GDPR/DPDP data erasure | `services/api/src/modules/privacy/` | `services/api/test/p7-reports-privacy-retention.spec.ts` | Built and passing |

---

## 2. Business Rules Coverage (R-01 to R-20)

| Rule ID | Rule Statement | Implementation File | Test File | Status |
| :--- | :--- | :--- | :--- | :---: |
| **R-01** | Jump check (>150 km/h) marks sample invalid | `packages/domain/src/gps-quality.ts` | `packages/domain/test/gps-quality.spec.ts` | Built and passing |
| **R-02** | Anti-flapping: min 3 valid samples to switch | `packages/domain/src/source-selector.ts` | `services/api/test/source-selector-pipeline.spec.ts` | Built and passing |
| **R-03** | Stale threshold: 30s hardware, 20s phone | `packages/domain/src/source-selector.ts` | `services/api/test/source-selector-pipeline.spec.ts` | Built and passing |
| **R-04** | Geofence arrival within 50m radius | `packages/domain/src/eta-stop-arrival.ts` | `packages/domain/test/eta-stop-arrival.spec.ts` | Built and passing |
| **R-05** | QR token 30s rotating HMAC | `packages/domain/src/qr-attendance.ts` | `services/api/test/attendance-scan.spec.ts` | Built and passing |
| **R-06** | Driver OTP max attempts & 15m lockout | `services/api/src/modules/auth/` | `services/api/test/auth.spec.ts` | Built and passing |
| **R-07** | Concurrency: unique index on attendance | `packages/db/prisma/schema.prisma` | `services/api/test/attendance-manual-concurrency.spec.ts` | Built and passing |
| **R-08** | Driver mutual exclusion: 1 active shift/bus | `services/api/src/modules/driver/` | `services/api/test/driver-pipeline.spec.ts` | Built and passing |
| **R-09** | Audit log append-only trigger rejection | `packages/db/src/rls-manager.ts` | `packages/db/test/integration.spec.ts` | Built and passing |
| **R-10** | Refresh token reuse family revocation | `services/api/src/modules/auth/` | `services/api/test/auth.spec.ts` | Built and passing |
| **R-11** | SOS cancellation rejected after ack | `services/api/src/modules/sos/` | `services/api/test/p6-sos-notifications.spec.ts` | Built and passing |
| **R-12** | Morning boarded + afternoon absent alert | `services/api/src/modules/attendance/` | `services/api/test/absence-evaluator.spec.ts` | Built and passing |
| **R-13** | Leave cutoff 30m before departure | `services/api/src/modules/attendance/` | `services/api/test/leave-flow.spec.ts` | Built and passing |
| **R-14** | CSV formula injection sanitization | `services/api/src/modules/reports/` | `services/api/test/p7-reports-privacy-retention.spec.ts` | Built and passing |
| **R-15** | Minor without guardian restricted | `services/api/src/modules/privacy/` | `services/api/test/p7-reports-privacy-retention.spec.ts` | Built and passing |
| **R-16** | Data deletion anonymizes SOS events | `services/api/src/modules/privacy/` | `services/api/test/p7-reports-privacy-retention.spec.ts` | Built and passing |
| **R-17** | Retention purges expired partitions | `services/api/src/modules/retention/` | `services/api/test/p7-reports-privacy-retention.spec.ts` | Built and passing |
| **R-18** | Quiet hours non-safety suppressed | `services/api/src/modules/notifications/` | `services/api/test/p6-sos-notifications.spec.ts` | Built and passing |
| **R-19** | Recipient notification rate limit 5/min | `services/api/src/modules/notifications/` | `services/api/test/p6-sos-notifications.spec.ts` | Built and passing |
| **R-20** | SMS DLT template mismatch blocked | `services/api/src/modules/notifications/` | `services/api/test/p6-sos-notifications.spec.ts` | Built and passing |

---

## 3. Endpoints Inventory Coverage (Master Part 8.3)

| Endpoint | Method | Role Restriction | Test File | Status |
| :--- | :---: | :--- | :--- | :---: |
| `/api/v1/auth/sso/start` | POST | `@Public` | `services/api/test/auth.spec.ts` | Built and passing |
| `/api/v1/auth/sso/callback` | GET | `@Public` | `services/api/test/auth.spec.ts` | Built and passing |
| `/api/v1/auth/otp/request` | POST | `@Public` | `services/api/test/auth.spec.ts` | Built and passing |
| `/api/v1/auth/otp/verify` | POST | `@Public` | `services/api/test/auth.spec.ts` | Built and passing |
| `/api/v1/auth/refresh` | POST | `@Public` | `services/api/test/auth.spec.ts` | Built and passing |
| `/api/v1/auth/logout` | POST | Authenticated | `services/api/test/auth.spec.ts` | Built and passing |
| `/api/v1/telemetry/hardware` | POST | DeviceToken | `services/api/test/telemetry-pipeline.spec.ts` | Built and passing |
| `/api/v1/telemetry/heartbeat` | POST | DeviceToken | `services/api/test/heartbeat-pipeline.spec.ts` | Built and passing |
| `/api/v1/driver/telemetry` | POST | DRV | `services/api/test/driver-pipeline.spec.ts` | Built and passing |
| `/api/v1/driver/shift/claim` | POST | DRV | `services/api/test/driver-pipeline.spec.ts` | Built and passing |
| `/api/v1/snapshot` | GET | STU, FAC, DRV, COR | `services/api/test/snapshot-pipeline.spec.ts` | Built and passing |
| `/api/v1/attendance/qr` | GET | DRV | `services/api/test/attendance-scan.spec.ts` | Built and passing |
| `/api/v1/attendance/scan` | POST | STU | `services/api/test/attendance-scan.spec.ts` | Built and passing |
| `/api/v1/attendance/manual` | POST | DRV | `services/api/test/attendance-manual-concurrency.spec.ts` | Built and passing |
| `/api/v1/attendance/leave` | POST | STU, FAC | `services/api/test/leave-flow.spec.ts` | Built and passing |
| `/api/v1/sos/trigger` | POST | STU, FAC, DRV, SEC | `services/api/test/p6-sos-notifications.spec.ts` | Built and passing |
| `/api/v1/sos/acknowledge` | POST | SEC, COR | `services/api/test/p6-sos-notifications.spec.ts` | Built and passing |
| `/api/v1/sos/cancel` | POST | DRV, SEC | `services/api/test/p6-sos-notifications.spec.ts` | Built and passing |
| `/api/v1/stop-requests` | POST | STU | `services/api/test/p6-sos-notifications.spec.ts` | Built and passing |
| `/api/v1/reports/export` | POST | COR, MGT, SAD | `services/api/test/p7-reports-privacy-retention.spec.ts` | Built and passing |
| `/api/v1/privacy/erasure` | POST | User / DPO | `services/api/test/p7-reports-privacy-retention.spec.ts` | Built and passing |

---

## 4. Background Jobs Coverage (Master Part 21.6)

| Job Name | Schedule | Scope | Implementation | Test File | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Shift Auto-End** | Every 5 min | Ends idle shifts (>60m) and 14h timeout | `shift-auto-end.worker.ts` | `shift-auto-end.spec.ts` | Built and passing |
| **Trip Generator** | 00:30 IST daily | Creates trips 7 days ahead | `trip-generator.ts` | `trip-generator.spec.ts` | Built and passing |
| **Boarding Cutoff** | Every 1 min | Departure + 15m marks EXPECTED -> ABSENT | `absence-evaluator.service.ts` | `absence-evaluator.spec.ts` | Built and passing |
| **Absence Evaluator** | Every 2 min | Checks morning-present afternoon-absent | `absence-evaluator.service.ts` | `absence-evaluator.spec.ts` | Built and passing |
| **SOS Escalation** | Every 30s | Tier 1 after 2m, Tier 2 after 5m | `sos.service.ts` | `p6-sos-notifications.spec.ts` | Built and passing |
| **Retention Purge** | 02:00 IST daily | Drops partitions older than 90 days | `retention.service.ts` | `p7-reports-privacy-retention.spec.ts` | Built and passing |
