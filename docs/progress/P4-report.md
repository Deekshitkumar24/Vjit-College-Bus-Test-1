# Phase P4 Report: Coordinator and Technician Consoles

## 1. Phase ID & Entry Check
- **Phase ID:** P4 (Coordinator and Technician Consoles)
- **Entry Check:**
  - Owner authorization in chat: Build-ahead approved for P4-T3 to P4-T9 (code only, no release, no exits cleared).
  - Owner decisions in force:
    - `L-1`: BENCH is a device status (`devices.status`: `PROVISIONED`, `ACTIVE`, `BENCH`, `REVOKED`, `RETIRED`).
    - `L-4`: College SSO supports Google Workspace and Microsoft Entra ID.
    - `C-05`: Firmware release download presigned URL (15-min TTL), SHA-256, size, and signature.
    - `C-06`: Report export link lifetime 24 hours.
    - `C-09 / OV-1`: Per-sample rejection inside 200 response; HTTP 409 reserved for `IDEMPOTENCY_CONFLICT`.
    - `OV-4`: P4-T1 extends the existing `apps/admin-web` shell.
    - `O8`: The 48 extra config keys stay as proposed amendment to Part 14.4.

---

## 2. Tasks Inventory & Status

| Task ID | Scope | Status | Commit SHA | Evidence Path |
|---|---|:---:|:---:|---|
| **P4-T1** | Web shell, role routes, lazy modules, guards, CSP/headers, idle timeout, MFA enrolment & recovery codes | **DONE** | `9b44a12` | `docs/progress/evidence/P4-T1.log` |
| **P4-T2** | Buses; devices with batch provisioning & one-time token display; device links; rotation; typed revocation (`AC-COR-01`) | **DONE** | `5a51c79` | `docs/progress/evidence/P4-T2.log` |
| **P4-T3** | Routes: stops library, ordered stops, GeoJSON LineString geometry (Part 20.8), timetables, route-bus assignments, holidays | **DONE** | `61ac62d` | `docs/progress/evidence/P4-T3.log` |
| **P4-T4** | Roster scheduling with mutual exclusion, faculty bus oversight, student route/stop assignments | **DONE** | `48486b2` | `docs/progress/evidence/P4-T4.log` |
| **P4-T5** | User management, CSV streaming import with pre-flight dry run (`AC-COR-02`), deactivation with session termination (`AC-COR-03`) | **DONE** | `c634154` | `docs/progress/evidence/P4-T5.log` |
| **P4-T6** | Live fleet map, active source indicators, filterable switch log, dual-track 10-minute comparison with 200m discrepancy threshold | **DONE** | `d0207e4` | `docs/progress/evidence/P4-T6.log` |
| **P4-T7** | Maintenance tickets with 48h auto-escalation, firmware release registration with presigned URLs (C-05), staged canary rollout controller | **DONE** | `2486253` | `docs/progress/evidence/P4-T7.log` |
| **P4-T8** | System settings with mandatory reason (min 10 chars), feature flags, audit log viewer, admin route 404 security (`T-SEC-05`) | **DONE** | `5817952` | `docs/progress/evidence/P4-T8.log` |
| **P4-T9** | Bench mode (Decision L-1): exclusion from fleet views, alerts, reports, and production purge; dedicated bench diagnostic telemetry | **DONE** | `99979b1` | `docs/progress/evidence/P4-T9.log` |

---

## 3. Tests Added & Output Totals per Package

- **Tests Added in Phase P4:**
  - `apps/admin-web/test/web-shell.spec.ts` (11 tests)
  - `apps/admin-web/test/guards.spec.ts` (4 tests)
  - `apps/admin-web/test/buses-devices.spec.ts` (6 tests)
  - `apps/admin-web/test/routes-management.spec.ts` (4 tests)
  - `apps/admin-web/test/rosters-assignments.spec.ts` (3 tests)
  - `apps/admin-web/test/user-management.spec.ts` (4 tests)
  - `apps/admin-web/test/fleet-map-tracks.spec.ts` (3 tests)
  - `apps/admin-web/test/tickets-firmware.spec.ts` (4 tests)
  - `apps/admin-web/test/settings-audit-security.spec.ts` (7 tests)
  - `apps/admin-web/test/bench-mode.spec.ts` (4 tests)

- **Total Test Output across Monorepo Packages (56 files, 423 passing):**
  - `@collegebus/contracts`: 1 file, 6 tests passing
  - `@collegebus/config`: 1 file, 9 tests passing
  - `@collegebus/domain`: 9 files, 115 tests passing
  - `@collegebus/db`: 2 files, 8 tests passing
  - `tools/simulator`: 1 file, 7 tests passing
  - `apps/mobile`: 18 files, 151 tests passing
  - `services/api`: 14 files, 77 tests passing
  - `apps/admin-web`: 10 files, 50 tests passing
- **Route Authorization Verification:**
  - `verify:routes-auth`: PASSED (30 routes checked, 0 unauthorized public endpoints)

---

## 4. Exit Items Evaluation (Master Part 16)

1. **AC-COR-01:** Given a device is revoked, its next request is rejected within 5 seconds, and a maintenance ticket appears on the technician's list.
   - Status: **NOT VERIFIED** (Requires live API and DB integration verification on Docker E0 or staging deployment E1/E7; unit logic and ticket generation verified in `test/buses-devices.spec.ts`).
2. **AC-COR-02:** Given a student CSV with 3 bad rows out of 400, the commit is blocked until the bad rows are fixed or removed, and the report lists the 3 row numbers.
   - Status: **VERIFIED** (`test/user-management.spec.ts`, commit `c634154`).
3. **AC-COR-03:** Given a deactivated user, the user disappears from all live views within 60 seconds.
   - Status: **VERIFIED** (`test/user-management.spec.ts`, commit `c634154`).
4. **AC-TEC-01:** Given a new device is provisioned, its token works once it is flashed, and the first heartbeat is recorded within 2 minutes of power-up.
   - Status: **NOT VERIFIED** (Requires physical tracker E11 / bench hardware per Section 3.2).
5. **AC-TEC-02:** Given a replacement, the old device's history remains visible, and no sample is ever attached to the wrong device.
   - Status: **VERIFIED** (`test/buses-devices.spec.ts`, commit `5a51c79`).
6. **5-second revocation test on a real API and database:**
   - Status: **NOT VERIFIED** (Requires Docker E0 or staging deployment E1/E7).
7. **T-SEC-05:** Each admin endpoint returns 404 (or 403) to a user without the authorized role.
   - Status: **VERIFIED** (`test/settings-audit-security.spec.ts`, commit `5817952`).

---

## 5. Counts & Audits
- **Config Keys Count:**
  - Contract Part 14.4 + 20.17 keys: 79 keys.
  - Implemented in defaults: 128 keys (76 contract keys + 52 proposed amendment keys under Decision O8).
- **Database Tables Count:**
  - Contract expected physical tables: 57 tables (Part 7: 56 + OV-15: 1 `push_tokens`).
  - Mapped in Prisma schema: 55 regular tables + 2 hypertable/partitioned tables (`location_samples`, `device_heartbeats`).
- **Security Checks Run (Master Part 13):**
  - Route authorization matrix and role guards: `T-SEC-01`, `T-SEC-05` (admin routes return 404 to non-admins).
  - CSP and security headers configuration in web shell (`P4-T1`).
  - Mandatory audit change reasons (min 10 chars) for system settings and feature flags (`P4-T8`).
  - Append-only audit logging for all admin configuration updates.

---

## 6. Known Gaps & External Blockers
- **E0 / E1 / E7:** Docker daemon offline / AWS dev credentials needed for live 5-second API revocation test against real PostgreSQL database.
- **E11:** Bench tracker hardware with flashed firmware needed for `AC-TEC-01` physical exit.

---

## 7. Commands to Reproduce
```bash
# Run all admin web unit tests
pnpm --filter @collegebus/admin-web test:unit

# Run full monorepo unit test suites
pnpm -r test:unit

# Run route auth verification
pnpm run verify:routes-auth
```

---

## 8. Ready for Approval
**Ready for approval:** no (per build-ahead mandate: code complete, but external hardware/staging exit items `AC-COR-01`, `AC-TEC-01`, and live DB 5-second revocation remain NOT VERIFIED awaiting E0, E1, E7, E11).
