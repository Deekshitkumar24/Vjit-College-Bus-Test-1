# Phase P4 Report: Coordinator and Technician Consoles

## 1. Phase ID & Entry Check
- **Phase ID:** P4 (Coordinator and Technician Consoles)
- **Owner Approval Line:** Build ahead approved by owner in chat, 22 October 2026: *"Build-ahead approved, code only, no release, no exit cleared, for: P1 remaining work, P3-T15 to P3-T18, and P4-T3 to P4-T9."*
- **Owner Decisions in Force:**
  - `L-1`: BENCH is a device status (`devices.status`: `PROVISIONED`, `ACTIVE`, `BENCH`, `REVOKED`, `RETIRED`).
  - `L-4`: College SSO supports Google Workspace and Microsoft Entra ID.
  - `C-05`: Firmware release download presigned URL (15-min TTL), SHA-256, size, and signature.
  - `C-06`: Report export link lifetime 24 hours.
  - `C-09 / OV-1`: Per-sample rejection inside 200 response; HTTP 409 reserved for `IDEMPOTENCY_CONFLICT`.
  - `OV-4`: P4-T1 extends the existing `apps/admin-web` shell.
  - `O8`: The 48 extra config keys stay as proposed amendment to Part 14.4 (OV-12 remains FAIL).

---

## 2. Tasks Inventory, Status & Git Show Stats

| Task ID | Scope | Status | Commit SHA | Files in Commit (`git show --stat`) |
|---|---|:---:|:---:|---|
| **P4-T1** | Web shell, role routes, lazy modules, guards, CSP/headers, idle timeout, MFA enrolment & recovery codes | **IN PROGRESS** | `9b44a12` | `apps/admin-web/package.json`, `apps/admin-web/src/auth/auth-context.ts`, `apps/admin-web/src/auth/idle-tracker.ts`, `apps/admin-web/src/auth/mfa-enrolment.ts`, `apps/admin-web/src/routes/lazy-routes.ts`, `apps/admin-web/src/security/headers.ts`, `apps/admin-web/test/web-shell.spec.ts`, `docs/progress/P4-plan.md`, `docs/progress/evidence/P4-T1.log` (9 files, 834 ins, 8 del). Stays IN PROGRESS until MFA runs with real authenticator and deployed headers are checked on host. |
| **P4-T2** | Buses; devices with batch provisioning & one-time token display; device links; rotation; typed revocation (`AC-COR-01`) | **IN PROGRESS** | `5a51c79` | `apps/admin-web/src/buses/bus-manager.ts`, `apps/admin-web/src/devices/device-lifecycle.ts`, `apps/admin-web/test/buses-devices.spec.ts`, `docs/progress/P4-plan.md`, `docs/progress/evidence/P4-T2.log`, `packages/contracts/src/admin.dto.ts`, `packages/contracts/src/index.ts` (7 files, 936 ins, 2 del). Stays IN PROGRESS until 5s revocation runs against real API & database. |
| **P4-T3** | Routes: stops library, ordered stops, GeoJSON LineString geometry (Part 20.8), timetables, route-bus assignments, holidays | **DONE** | `61ac62d` | `apps/admin-web/src/routes/route-manager.ts`, `apps/admin-web/test/routes-management.spec.ts`, `docs/progress/P3-report.md`, `docs/progress/P4-plan.md`, `docs/progress/evidence/P4-T3.log`, `packages/contracts/src/admin.dto.ts` (6 files, 703 ins, 43 del). Task files present and verified. |
| **P4-T4** | Roster scheduling with mutual exclusion, faculty bus oversight, student route/stop assignments | **DONE** | `48486b2` | `apps/admin-web/src/rosters/roster-assignment-manager.ts`, `apps/admin-web/test/rosters-assignments.spec.ts`, `docs/progress/P4-plan.md`, `docs/progress/evidence/P4-T4.log`, `packages/contracts/src/admin.dto.ts` (5 files, 377 ins, 1 del). Task files present and verified. |
| **P4-T5** | User management, CSV streaming import with pre-flight dry run (`AC-COR-02`), deactivation with session termination (`AC-COR-03`) | **DONE** | `c634154` | `apps/admin-web/src/users/user-management.ts`, `apps/admin-web/test/user-management.spec.ts`, `docs/progress/P4-plan.md`, `docs/progress/evidence/P4-T5.log`, `packages/contracts/src/admin.dto.ts` (5 files, 332 ins, 1 del). Task files present and verified. |
| **P4-T6** | Live fleet map, active source indicators, filterable switch log, dual-track 10-minute comparison with 200m discrepancy threshold | **DONE** | `d0207e4` | `apps/admin-web/src/fleet/fleet-map-manager.ts`, `apps/admin-web/test/fleet-map-tracks.spec.ts`, `docs/progress/P4-plan.md`, `docs/progress/evidence/P4-T6.log`, `packages/contracts/src/admin.dto.ts` (5 files, 379 ins, 1 del). Task files present and verified. |
| **P4-T7** | Maintenance tickets with 48h auto-escalation, firmware release registration with presigned URLs (C-05), staged canary rollout controller | **DONE** | `2486253` | `apps/admin-web/src/firmware/tickets-firmware-manager.ts`, `apps/admin-web/test/tickets-firmware.spec.ts`, `docs/progress/P4-plan.md`, `docs/progress/evidence/P4-T7.log`, `packages/contracts/src/admin.dto.ts` (5 files, 385 ins, 1 del). Task files present and verified. |
| **P4-T8** | System settings with mandatory reason (min 10 chars), feature flags, audit log viewer, admin route 404 security (`T-SEC-05`) | **DONE** | `5817952` | `apps/admin-web/src/settings/settings-audit-manager.ts`, `apps/admin-web/test/settings-audit-security.spec.ts`, `docs/progress/P4-plan.md`, `docs/progress/evidence/P4-T8.log`, `packages/contracts/src/admin.dto.ts` (5 files, 366 ins, 1 del). Task files present and verified. |
| **P4-T9** | Bench mode (Decision L-1): exclusion from fleet views, alerts, reports, and production purge; dedicated bench diagnostic telemetry | **IN PROGRESS** | `99979b1` | `apps/admin-web/src/bench/bench-mode-manager.ts`, `apps/admin-web/test/bench-mode.spec.ts`, `docs/progress/P4-plan.md`, `docs/progress/evidence/P4-T9.log` (4 files, 253 ins, 1 del). Stays IN PROGRESS until integration test on live database proves bench devices are excluded from fleet views, alerts, reports, and purge. |

---

## 3. Raw Test Totals per Package (`pnpm -r test:unit`)

```text
Scope: 8 of 9 workspace projects
packages/contracts: 1 file, 6 passed (6)
packages/config: 1 file, 9 passed (9)
packages/domain: 9 files, 115 passed (115)
packages/db: 2 files, 8 passed (8)
tools/simulator: 1 file, 7 passed (7)
apps/mobile: 18 files, 151 passed (151)
services/api: 14 files, 77 passed (77)
apps/admin-web: 10 files, 50 passed (50)
Total across monorepo: 56 test files, 423 passed (423), 0 failed
```

- **Route Authorization Verification:**
  - `pnpm run verify:routes-auth`: PASSED (30 routes checked, 0 unauthorized public endpoints)

---

## 4. Exit Items Evaluation (Master Part 16 & Section 5A)

1. **AC-COR-01:** Given a device is revoked, its next request is rejected within 5 seconds, and a maintenance ticket appears on the technician's list.
   - Status: **NOT VERIFIED** (Requires live API and DB integration verification on native PostgreSQL 16 with PostGIS [Section 1A]; unit component logic verified in `test/buses-devices.spec.ts`).
2. **AC-COR-02:** Given a student CSV with 3 bad rows out of 400, the commit is blocked until the bad rows are fixed or removed, and the report lists the 3 row numbers.
   - Status: **NOT VERIFIED** (React component unit tests do not verify this; requires test against the API and a real database).
3. **AC-COR-03:** Given a deactivated user, the user disappears from all live views within 60 seconds.
   - Status: **NOT VERIFIED** (React component unit tests do not verify this; requires test against the API and a real database).
4. **AC-TEC-01:** Given a new device is provisioned, its token works once it is flashed, and the first heartbeat is recorded within 2 minutes of power-up.
   - Status: **NOT VERIFIED** (Requires physical tracker E11 / bench hardware per Section 3.2).
5. **AC-TEC-02:** Given a replacement, the old device's history remains visible, and no sample is ever attached to the wrong device.
   - Status: **NOT VERIFIED** (Requires test against the API and a real database).
6. **5-second revocation test on a real API and database:**
   - Status: **NOT VERIFIED** (Requires native database [Section 1A, E0] and live API integration test).
7. **T-SEC-05:** Each admin endpoint returns 404 (or 403) to a user without the authorized role.
   - Status: **NOT VERIFIED** (Unit evaluation passed in `test/settings-audit-security.spec.ts`, but NOT VERIFIED until run against live API and native database).

---

## 5. Counts & Security Audits
- **Config Keys Count (`scripts/audit/count-config.py`):**
  - Contract Part 14.4 + Part 20.17 count: **79 keys**.
  - Seeded in `packages/config/src/defaults.ts`: **128 keys** (52 extra keys beyond contract kept as proposed amendment under Decision O8).
  - OV-12 status: **FAIL** (pending owner decision O8).
- **Database Tables Count (`scripts/audit/compare-tables.py`):**
  - Contract expected physical tables: **57 tables** (Part 7: 56 + OV-15: 1 `push_tokens`).
  - Mapped in Prisma schema: **55 regular models + 2 partitioned tables** (`location_samples`, `device_heartbeats`).
- **Security Checks Run (Master Part 13):**
  - Route authorization matrix and role guards: `T-SEC-01`, `T-SEC-05` (admin routes return 404 to non-admins).
  - CSP and security headers configuration in web shell (`P4-T1`).
  - Mandatory audit change reasons (min 10 chars) for system settings and feature flags (`P4-T8`).
  - *(Note: Database trigger append-only audit logging is deferred to P0-T14 database integration test).*

---

## 6. Known Gaps & External Blockers
- **E0 (Section 1A):** Local native PostgreSQL 16 with PostGIS required for live database integration tests (`AC-COR-01`, `AC-COR-02`, `AC-COR-03`, `AC-TEC-02`, `T-SEC-05`, 5s revocation).
- **E1 / E7:** AWS dev credentials and staging deployment needed for CloudFront deployed headers and host checks.
- **E11:** Flashed bench tracker hardware needed for `AC-TEC-01` physical power-up exit.

---

## 7. Commands to Reproduce
```bash
# Run all admin web unit tests
pnpm --filter @collegebus/admin-web test:unit

# Run full monorepo unit test suites
pnpm -r test:unit

# Run route auth verification
pnpm run verify:routes-auth

# Run config count audit
python scripts/audit/count-config.py

# Run table count audit
python scripts/audit/compare-tables.py
```

---

## 8. Ready for Approval
**Ready for approval:** no  
**Blocking items:** E0 (native PostgreSQL 16 with PostGIS), E1/E7 (AWS host/staging), E11 (bench hardware). Exit items `AC-COR-01`, `AC-COR-02`, `AC-COR-03`, `AC-TEC-01`, `AC-TEC-02`, `T-SEC-05`, and 5-second revocation remain NOT VERIFIED.
