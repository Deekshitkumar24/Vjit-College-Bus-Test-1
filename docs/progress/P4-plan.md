# Phase Plan: P4 Coordinator & Technician Web Consoles

**Phase ID:** P4  
**Goal:** Production-grade web consoles for transport staff (Coordinators [COR], Technicians [TEC], Super Admins [SAD], and Management [MGT]) to manage fleet operations, device provisioning and lifecycle, route definitions, roster/faculty/student assignments, user bulk CSV imports, real-time fleet map oversight, maintenance tickets, firmware rollouts, and system audit logs.  
**Prompt Contract:** `AG-MASTER-FINAL-1.0` (Version 1.0, 21 October 2026)  
**Companion Specifications:** `docs/spec/SW-MVP-1.0.pdf` (§4, §5.4, §5.5, §16.4, §16.5, §16.6, §20, §21, §22, §23, §24, §25, §33, §35) and `docs/spec/HW-SPEC-1.0.pdf` (§13, §15, §17)  
**Date:** 22 October 2026  
**Status:** IN PROGRESS (Blocked on written phase approvals; P4-T1 and P4-T2 in progress pending live API/deployed verification; no new tasks may start)

---

## 1. Specification Sections Read & Referenced

- `SW-MVP-1.0`:
  - §4 & §5.4: Coordinator (COR) user class, permissions, fleet oversight, and route authority.
  - §5.5: Technician (TEC) user class, hardware diagnostics, provisioning, and maintenance authority (strict isolation: no student/attendance access).
  - §16.4: Coordinator workflows, destructive action confirmation rules, audit logging, and acceptance criteria (`AC-COR-01`, `AC-COR-02`, `AC-COR-03`).
  - §16.5: Technician workflows, batch device provisioning, commissioning checklist, replacement wizard, staged firmware rollout, and acceptance criteria (`AC-TEC-01`, `AC-TEC-02`).
  - §16.6: Super Admin (SAD) workflows, college SSO/MFA configuration, settings editor with mandatory change reason.
  - §20: Device provisioning, token generation, HMAC storage, key rotation, revocation, and bench mode (`L-1`).
  - §21: Live fleet map, route delays, stop ETA progression, source-switch log, and dual-track comparison.
  - §22: Shift oversight, driver re-assignment, manual shift termination.
  - §23: CSV reporting and export security (`T-SEC-03`).
  - §24: Maintenance tickets, ticket escalation (>48h), ticket resolution notes.
  - §33: Firmware rollout staged deployment and auto-pause safety gates.
  - §35: System configuration dictionary (88 keys).
- `AG-MASTER-FINAL-1.0`:
  - Part 16 (Phase P4 tasks P4-T1 through P4-T9).
  - Part 6.8 & Part 10.1: Security permissions matrix and role enforcement (`T-SEC-01`, `T-SEC-05`).
  - Overrides `OV-4`: P4-T1 extends the existing `apps/admin-web` shell established in P0-T19.
  - Decisions `L-1` (BENCH status), `C-05` (Firmware presigned URL & signature), `C-06` (Export 24h lifetime).

---

## 2. Locked Decisions & Defaults in Force (Part B)

- **L-1:** BENCH is a device status: `devices.status` takes `PROVISIONED`, `ACTIVE`, `BENCH`, `REVOKED`, `RETIRED`. Bench devices are excluded from live fleet views and passenger alerts (verified under P4-T9).
- **L-4:** College SSO supports Google Workspace and Microsoft Entra ID with OpenID Connect.
- **C-05:** Firmware updates provide presigned download URL (15-min TTL), SHA-256, image size, and cryptographic signature.
- **C-06:** Report export links valid for 24 hours.
- **C-09 / OV-1:** Ingestion sample rejection inside 200 response; HTTP 409 reserved for `IDEMPOTENCY_CONFLICT`.
- **OV-4:** P4-T1 extends the existing `apps/admin-web` shell.
- **OV-8 / C-07:** Driver non-college email exception rules.

---

## 3. Task Inventory & Dependency Order

| Task ID   | Scope                                                                                                                                                             |    Status     |            Evidence Log            | Verification Criteria & Deliverables                                                                                                                                    |
| :-------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-----------: | :--------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P4-T1** | **Web Shell, Role Routing & MFA Enrolment:** Lazy-loaded admin routes, role guards (`COR`, `TEC`, `SAD`, `MGT`), idle timeout, TOTP MFA enrolment & recovery codes | **IN PROGRESS** | `docs/progress/evidence/P4-T1.log` | Code written & unit tests pass (Commit `9b44a12`). IN PROGRESS until TOTP flow runs with real authenticator and CloudFront security headers are verified on a deployed host. |
| **P4-T2** | **Buses & Devices Management:** Bus CRUD, batch device provisioning (one-time token text/QR), device links, token rotation, typed revocation (`AC-COR-01`)         | **IN PROGRESS** | `docs/progress/evidence/P4-T2.log` | Code written & unit tests pass (Commit `5a51c79`). IN PROGRESS until AC-COR-01 live API test verifies 5s rejection with DEVICE_REVOKED. Bench mode claimed only in P4-T9.      |
| **P4-T3** | **Routes, Stops, Geometries & Timetables:** Stops library, ordered stop sequencing, map geometry / GeoJSON upload, timetables, route-bus assignments, holidays    | **NOT STARTED** | `docs/progress/evidence/P4-T3.log` | Stops management with 50m radius, route geometry editor, stop ordering, calendar holiday exceptions, and bus-route binding. STOP: blocked on written approval.                 |
| **P4-T4** | **Rosters, Faculty Assignments & Student Routes:** Driver roster scheduling, faculty bus oversight assignments, student route binding and stop assignment       | **NOT STARTED** | `docs/progress/evidence/P4-T4.log` | Driver roster allocation, faculty safety assignment matrix, student route allocations with stop association.                                                            |
| **P4-T5** | **User Management, CSV Bulk Import & Deactivation:** CSV import engine with dry run, row error validation (`AC-COR-02`), user deactivation with date (`AC-COR-03`) | **NOT STARTED** | `docs/progress/evidence/P4-T5.log` | User directory, CSV streaming parser with pre-flight dry run (blocking commit on bad rows), user deactivation with session termination.                                |
| **P4-T6** | **Live Fleet Map, Source-Switch Log & Dual Track:** Real-time fleet map, authoritative source indicators, filterable switch log, dual track 10-minute comparison   | **NOT STARTED** | `docs/progress/evidence/P4-T6.log` | Fleet overview map, status cards, source switch history with reason codes, dual track comparison view (hardware vs phone GPS paths).                                     |
| **P4-T7** | **Maintenance Tickets & Staged Firmware Rollout:** Ticket board, notes, 48h escalation, firmware release registration, staged canary rollout controller (C-05)    | **NOT STARTED** | `docs/progress/evidence/P4-T7.log` | Ticket lifecycle manager, 48h coordinator auto-escalation, firmware release registry with presigned URLs, staged rollout with auto-pause safety limits.                 |
| **P4-T8** | **Settings, Feature Flags, Audit Logs & T-SEC-05 Verification:** System settings with reason notes, feature flag toggles, audit viewer, admin route 404 security  | **NOT STARTED** | `docs/progress/evidence/P4-T8.log` | Super admin settings manager requiring audit reasons, feature flag manager, append-only audit log viewer, and `T-SEC-05` route authorization validation.               |
| **P4-T9** | **Bench Mode (Decision L-1, master Part 16):** Registration as BENCH, exclusion from fleet views, alerts, reports; dedicated bench acceptance test                 | **NOT STARTED** | `docs/progress/evidence/P4-T9.log` | Device BENCH lifecycle state, fleet exclusion filter, alert suppression, report exclusion, and dedicated bench test suite per master Part 16 & §16.5 workflow 7.       |

---

## 4. Mandatory Phase P4 Exit Criteria (Master Part 16)

1. **AC-COR-01:** Given a device is revoked, its next request is rejected within 5 seconds, and a maintenance ticket appears on the technician's list.  
   - *Status:* **NOT VERIFIED** (Requires live API and DB integration verification).
2. **AC-COR-02:** Given a student CSV with 3 bad rows out of 400, the commit is blocked until the bad rows are fixed or removed, and the report lists the 3 row numbers.  
   - *Status:* **NOT VERIFIED** (Not yet reached).
3. **AC-COR-03:** Given a deactivated user, the user disappears from all live views within 60 seconds.  
   - *Status:* **NOT VERIFIED** (Not yet reached).
4. **AC-TEC-01:** Given a new device is provisioned, its token works once it is flashed, and the first heartbeat is recorded within 2 minutes of power-up.  
   - *Status:* **NOT VERIFIED** (Not yet reached).
5. **AC-TEC-02:** Given a replacement, the old device's history remains visible, and no sample is ever attached to the wrong device.  
   - *Status:* **NOT VERIFIED** (Not yet reached).
6. **T-SEC-05:** Each admin endpoint returns 404 (or 403) to a user without the authorized role.  
   - *Status:* **NOT VERIFIED** (Not yet reached).
7. All admin web unit, component, and security suites pass cleanly with zero mock data and zero lint errors.  
   - *Status:* **IN PROGRESS** (Unit suite passes locally; deployed and integration suites pending).
