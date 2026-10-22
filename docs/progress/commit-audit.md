# Commit Audit Report

**Date:** 22 October 2026  
**Auditor:** Antigravity Engineering Agent  
**Standard:** `AG-MVP-GUIDE-1.0` (Step 0, S0.2) & `AGENTS.md` (Rules A-5 to A-7, G-3, G-4)

---

## 1. Discrepancy Analysis: The Shared Commit `441b4e5` in P0 Report

The superseded `P0-report.md` listed commit `441b4e5` across nine separate tasks (`P0-T1` through `P0-T9`, `P0-T12` through `P0-T14`).
Inspection of the git commit history confirms:
- Commit `441b4e5` was a documentation and contract alignment commit (`docs: align contract, read-log, conflicts, and P0 plan with AG-MASTER-FINAL-1.0`), not the code delivery commit.
- Each individual task was in fact delivered in distinct, dedicated commits earlier in git history.
- The table below maps every task to its genuine code implementation commit SHA.

---

## 2. Done Task-to-Commit Mapping

### Phase P0: Foundation
| Task ID | Description | Code Delivery Commit SHA | Commit Message | Verified Test Suite & Output | Status |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **P0-T1** | Monorepo scaffolding, ESLint, Prettier, Turbo | `b598b27` | `P0-T1: monorepo scaffolding with Turborepo, ESLint security rules, and project configs` | Monorepo lint & typecheck passed cleanly | **DONE** |
| **P0-T2** | Config package, Zod schema, refusal rules | `e015693` | `P0-T2: configuration package with Zod environment schema, startup refusal rules, and system defaults` | `packages/config/test/config.spec.ts` (6 passed) | **DONE** |
| **P0-T3** | Database foundation (57 tables, PostGIS, RLS) | `980eedd` | `P0-T3: database schema for all Part 7 tables + push_tokens, RLS manager, audit triggers, and daily partition manager` | `packages/db/test/db.spec.ts` (2 passed) | **DONE** |
| **P0-T4** | Test harness, synthetic factories, non-prod guard | `777d078` | `P0-T4: test harness with synthetic factories, transaction isolation helper, and production guard` | Factory instantiation & production refusal tests | **DONE** |
| **P0-T5** | Expand-only migration policy CI check | `37fc4d2` | `P0-T5: expand-only migration policy check script and test suite for CI` | `packages/db/test/check-migrations.spec.ts` (4 passed) | **DONE** |
| **P0-T6** | Auth core (SSO PKCE, driver OTP, family rotation) | `8bfe777` | `P0-T6: authentication core with SSO OIDC, driver OTP lockout, refresh token family rotation, and admin MFA` | `services/api/test/auth.spec.ts` (8 passed) | **DONE** |
| **P0-T7** | Default-deny guard, @Public, @Roles, route audit | `92a1224` | `P0-T7: default-deny global guard, @Public, @Roles, scope decorators, and verify:routes-auth script` | `scripts/verify-routes-auth.ts` (30 routes audited, 0 unauth) | **DONE** |
| **P0-T8** | HTTP hardening, Helmet, strict CSP, request IDs | `6fa0273` | `P0-T8: HTTP hardening with Helmet, security headers, CORS allowlist, error envelope, and request IDs` | Helmet & security filter unit suite | **DONE** |
| **P0-T9** | Rate limiter (429 + Retry-After), Idempotency (409) | `e4d29c7` | `P0-T9: rate limiter (rate_counters) and idempotency middleware with collision detection` | `T-SEC-04` rate limit & 409 idempotency conflict | **DONE** |
| **P0-T10** | Observability baseline (/health, /health/ready) | `5879516` | `P0-T10: observability baseline with health liveness/readiness probes and app module wiring` | `services/api/test/health.spec.ts` (2 passed; metrics/dashboards pending) | **IN PROGRESS** |
| **P0-T11** | Dev Terraform (VPC, ALB, ECS, RDS, S3, KMS) | `986227e` | `P0-T11: infrastructure for dev with AWS Terraform modules for VPC, RDS Multi-AZ, S3, KMS, and Secrets Manager` | Terraform syntax validated; apply pending AWS dev account E1 | **IN PROGRESS** |
| **P0-T12** | Admin MFA recovery codes (10 Argon2id single-use) | `90b42c2` | `P0-T12, P0-T13, P0-T16: delivery of recovery codes, auth harness, CI workflow...` | `services/api/test/auth.spec.ts` (Recovery codes generated & single-use verified) | **DONE** |
| **P0-T13** | Authorisation harness (every route vs all 8 roles) | `90b42c2` | (Shared with P0-T12 in delivery commit) | `services/api/test/authorization-harness.spec.ts` (3 passed, 100% matrix) | **DONE** |
| **P0-T14** | Audit log append-only trigger and RLS grants | `980eedd` | (Delivered with P0-T3 schema and SQL generators) | `packages/db/test/db.spec.ts` (Trigger SQL generation verified) | **DONE** |
| **P0-T15** | Telemetry (Sentry & OpenTelemetry tracing) | `059a684` | `feat(api): implement telemetry baseline with Sentry and OpenTelemetry (P0-T15)` | Instrumentation wired; verification pending Sentry DSN E4 | **IN PROGRESS** |
| **P0-T16** | CI pipeline (.github/workflows/ci.yml) | `1ad2a04` | `ci: done CI pipeline workflow and eliminate audit vulnerabilities (P0-T16)` | Workflow authored; verification pending GitHub Actions runner E2 | **IN PROGRESS** |
| **P0-T17** | Terraform environments (dev, staging, production) | `7f26bf9` | `infra: structure dev, staging, and production terraform environments (P0-T17)` | Directories & tfvars structured; apply pending AWS accounts | **IN PROGRESS** |
| **P0-T18** | Minimal mobile shell (Expo Router, 4 roles) | `3cfdfe8` | `feat(mobile): initialize minimal mobile shell with route guard and token storage (P0-T18)` | Navigation guard tests pass | **DONE** |
| **P0-T19** | Minimal web shell (Vite, React Router, admin guard) | `7f668be` | `feat(web): initialize minimal web console shell with admin route guards and dev CSP (P0-T19)` | `apps/admin-web/test/guards.spec.ts` (4 passed) | **DONE** |

---

### Phase P1: Ingestion & Source Engine
| Task ID | Description | Delivery Commit SHA | Commit Message | Verified Test Suite | Status |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **P1-T1** | Device tokens: generation, HMAC, rotation, revocation | `e393f9a` | `feat(domain): implement device token generation, HMAC validation, and C-01 activation (P1-T1)` | `packages/domain/src/device-tokens.ts` unit tests | **DONE** |
| **P1-T2** | Device links: mutual exclusion, historical attribution | `dfa07b7` | `feat(domain): implement device links and historical sample attribution rule (P1-T2)` | `packages/domain/src/device-links.ts` unit tests | **DONE** |
| **P1-T3** | Telemetry pipeline S1-S13, 200 CONFLICT (C-09 / OV-1) | `a0ba87b` | `feat(api): implement telemetry pipeline stages S1 to S13 with C-09 conflict handling (P1-T3)` | `services/api/test/telemetry-pipeline.spec.ts` | **DONE** |
| **P1-T4** | Heartbeat H1-H8 & Event E1-E6, presigned URL (C-05) | `417c872` | `feat(api): implement heartbeat (H1-H8) and event (E1-E6) pipelines (P1-T4)` | `services/api/test/heartbeat-pipeline.spec.ts` | **DONE** |
| **P1-T5** | Driver phone endpoints, shift claim, adaptive cadence | `e7aadcc` | `feat(api): implement driver phone telemetry and shift claim service (P1-T5)` | `services/api/test/driver-pipeline.spec.ts` | **DONE** |
| **P1-T6** | packages/domain: kinematic jump (>150 km/h), plausibility | `0c8b0ae` | `feat(domain): implement GPS validity, kinematic jump check, and frozen position rules (P1-T6)` | `packages/domain/src/gps-quality.ts` unit tests | **DONE** |
| **P1-T7** | Dual-source selector, bus_state lock, anti-flapping | `2ebf988` | `feat(selector): implement dual-source selector, bus_state locking, outbox triggers, and anti-flapping (P1-T7)` | `services/api/test/source-selector-pipeline.spec.ts` | **DONE** |
| **P1-T8** | Snapshot API: GET /snapshot, 8 roles, ETag / 304 | `1764437` | `feat(snapshot): implement snapshot endpoint, role scope resolution, ETag, and 3-second cache (P1-T8)` | `services/api/test/snapshot-pipeline.spec.ts` | **DONE** |
| **P1-T9** | ETA and stop arrival: polyline projection, speed clamp | `562e190` | `feat(domain): implement polyline projection, stop arrival detector, and ETA (P1-T9)` | `packages/domain/src/eta-stop-arrival.ts` unit tests | **DONE** |
| **P1-T10** | Contract test harness: replay recorded streams | `e93f054` | `feat(telemetry): build contract test harness and replay recorded hardware message streams (P1-T10)` | `services/api/test/contract-harness.spec.ts` | **DONE** |
| **P1-T11** | 50-bus fleet simulator, dual sources, failure modes | `596dbe5` | `feat(simulator): implement 50-bus fleet simulator with dual sources and failure scenarios (P1-T11)` | `tools/simulator/test/simulator.spec.ts` (7 passed) | **DONE** |

---

### Phase P2: Student & Faculty Mobile Apps
| Task ID | Description | Delivery Commit SHA | Commit Message | Verified Test Suite | Status |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **P2-T1** | Navigation tree, offline cache store, snapshot poller | `da561c0` | `feat(mobile): implement navigation tree, offline cache store, and snapshot poller with 304 ETag (P2-T1)` | `apps/mobile/test/navigation-store.spec.ts` (10 passed) | **DONE** |
| **P2-T2** | Live map, bus heading marker, authoritative source badges | `37e23ef` | `feat(mobile): P2-T2 live map, authoritative marker model, and source badges` | `apps/mobile/test/map-marker.spec.ts` (12 passed) | **DONE** |
| **P2-T3** | Stop arrival card, next-stop countdown, off-route banner | `4538661` | `feat(mobile): P2-T3 stop arrival, ETA card suite, and off-route banner` | `apps/mobile/test/eta-stop-card.spec.ts` (8 passed) | **DONE** |
| **P2-T4** | QR attendance scanner, rotating HMAC token validator | `60ad047` | `feat(mobile): P2-T4 student QR attendance scanner and rotating token validator` | `apps/mobile/test/qr-attendance.spec.ts` (8 passed) | **DONE** |
| **P2-T5** | Stop change & leave requests, cancel, offline sync | `1e74d59` | `feat(mobile): P2-T5 student requests and leave application module` | `apps/mobile/test/student-requests.spec.ts` (11 passed) | **DONE** |
| **P2-T6** | Faculty passenger manifest, D-12 safety alert rule | `a3dde2b` | `feat(mobile): P2-T6 faculty attendance manifest and D-12 safety alert rule` | `apps/mobile/test/faculty-manifest.spec.ts` (11 passed) | **DONE** |
| **P2-T7** | Emergency SOS trigger (3s hold, GPS capture, L-2 routing) | `38e2a8d` | `feat(mobile): P2-T7 emergency SOS trigger, guarded 3s hold, and category routing` | `apps/mobile/test/emergency-sos.spec.ts` (7 passed) | **DONE** |
| **P2-T8** | Mobile integration test harness (77/77 tests passing) | `602db65` | `feat(mobile): P2-T8 mobile end-to-end integration flows and test harness` | `apps/mobile/test/mobile-flows.integration.spec.ts` | **DONE** |

---

### Phase P3: Driver App & Phone Tracking
| Task ID | Description | Delivery Commit SHA | Commit Message | Verified Test Suite | Status |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **P3-T1** | Driver OTP, roster list, device registration (label) | `f795f5a` | `feat(driver): P3-T1 driver OTP sign-in, roster list and device registration` | `apps/mobile/test/driver-roster.spec.ts` (6 passed) | **DONE** |
| **P3-T2** | Permissions and pre-trip check diagnostics | `da2af0e` | `feat(driver): P3-T2 permissions and pre-trip check diagnostics suite` | `apps/mobile/test/pre-trip-diagnostics.spec.ts` (13 passed) | **DONE** |
| **P3-T3** | Shift start, restart resume, idle detection, 14h timeout | `9a0d173` | `feat(driver): P3-T3 shift start, restart resume, idle detection and 14h timeout` | `apps/mobile/test/shift-lifecycle.spec.ts` (8 passed) | **DONE** |
| **P3-T4** | Background location tracking, 24h SQLite buffer | `bae7796` | `feat(driver): implement background location tracking & 24h SQLite buffer (P3-T4)` | `apps/mobile/test/location-buffer.spec.ts` (11 passed) | **DONE** |
| **P3-T5** | Mode switcher (note), SOS 2s hold, incident status | `e925c63` | `feat(driver): tracking mode switcher & driver SOS emergency (P3-T5)` | `apps/mobile/test/driver-mode-sos.spec.ts` (10 passed) | **DONE** |
| **P3-T6** | Boarding QR display (30s countdown), manual check-in | `6de3ed6` | `feat(driver): 30s rotating HMAC boarding QR and manual check-in (P3-T6)` | `apps/mobile/test/driver-boarding.spec.ts` (12 passed) | **DONE** |
| **P3-T7** | Problem reporter, maintenance ticket generation | `8a5f84b` | `feat(driver): report a problem and maintenance ticketing (P3-T7)` | `apps/mobile/test/driver-tickets.spec.ts` (6 passed) | **DONE** |
| **P3-T8** | Mock GPS handling, driver warning, integration suite | `8bc6bf0` | `feat(driver): mock-location detection, banner, and integration test suite (P3-T8)` | `apps/mobile/test/driver-integration-suite.spec.ts` (6 passed) | **DONE** |
| **P3-T15** | Manual stop arrival override (Part 9.9) | — | Not yet implemented | Planned | **NOT STARTED** |
| **P3-T16** | SOS create-or-join service, outbox, tier-0 push | — | Not yet implemented | Planned | **NOT STARTED** |
| **P3-T17** | Driver trip summary screen (Part 20.9 fields) | — | Not yet implemented | Planned | **NOT STARTED** |
| **P3-T18** | Shift auto-end job (`shift-auto-end`, Part 12.3) | — | Not yet implemented | Planned | **NOT STARTED** |

---

### Phase P4: Coordinator & Technician Consoles
| Task ID | Description | Delivery Commit SHA | Commit Message | Verified Test Suite | Status |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **P4-T1** | Web shell: role routes, idle tracker, MFA enrolment | `9b44a12` | `feat(web): done P4-T1 web shell role routing MFA enrolment and session idle tracker` | `apps/admin-web/test/web-shell.spec.ts` (Unit passed; deployed headers pending) | **IN PROGRESS** |
| **P4-T2** | Buses and devices: batch provisioning, link, revoke | `5a51c79` | `feat(fleet): done P4-T2 buses and devices management with batch provisioning AC-COR-01 and AC-TEC-01/02` | `apps/admin-web/test/buses-devices.spec.ts` (Unit passed; 5s live API test pending) | **IN PROGRESS** |
| **P4-T3** to **P4-T9** | Routes, Rosters, CSV, Fleet Map, Tickets, Settings, Bench | — | Not yet implemented | Planned | **NOT STARTED** |
