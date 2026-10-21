# Specification and Contract Reading Log

**Document ID:** READ-LOG-1.0  
**Contract Version:** `AG-MASTER-FINAL-1.0` (Version 1.0, 21 October 2026)  
**Date Read:** 21 October 2026

---

## 1. Specification Documents Verification

Both required companion specifications are present in `docs/spec/`. Verified via PDF page parsing and cryptographic hashing:

| Document Path               | Byte Size       | SHA-256 Checksum                                                   | Page Count |
| :-------------------------- | :-------------- | :----------------------------------------------------------------- | :--------: |
| `docs/spec/SW-MVP-1.0.pdf`  | 2,936,484 bytes | `b9fbafc61a2f5dc1df736c1bbeda12adcae29d92c67f8c418beb910fd370cd90` | 103 pages  |
| `docs/spec/HW-SPEC-1.0.pdf` | 932,058 bytes   | `16c0f230c751fa45097ba1db51326e1aa9843e625f51814182bd9a066a3b31d2` |  30 pages  |
| `AGENTS.md`                 | 35,129 bytes    | `462ae880d3d29fa400058ef9676faa6d463cc7b16b483434e1f59d249e430077` |    N/A     |

---

## 2. Build Contract Parts Read in Full (Rule A-1)

The entire `AG-MASTER-FINAL-1.0` contract has been read from start to finish on 21 October 2026 in accordance with Rule A-1:

- **Part A:** How Antigravity must work (Rules A-1 to A-14, stop gates Step A through Step E)
- **Part B:** Decisions, conflicts, defaults, and Phase P0 scope:
  - **B.1:** Locked decisions (L-1 to L-5)
  - **B.2:** Conflict register (C-01 to C-12)
  - **B.3:** Open decisions and the defaults in force (D-01 to D-18)
  - **B.4:** Research rules overriding master Part 4 (RS-19, RS-06)
  - **B.5:** Phase P0 scope and evidence requirements (P0-T1 to P0-T19 and exit criteria)
- **Part C:** Overrides to the master text (OV-1 to OV-19)
- **Master Part 1:** Project rules (Mission, no mock data R-M1 to R-M9, security, authority, coding standards, definition of done)
- **Master Part 2:** Technology stack (Runtimes, frameworks, pinning requirements, testing, security tooling)
- **Master Part 3:** Repository, environments, variables, scripts (Layout, environments, environment variable schema, root scripts)
- **Master Part 4:** Research tasks (RS-01 to RS-20 binding research output definitions)
- **Master Part 5:** End-to-end pipeline (Edge, hardware sample pipeline S1-S16, driver phone, heartbeat, events, read snapshot, SOS, attendance, notifications, admin writes, jobs)
- **Master Part 6:** Device connection, provisioning, and visibility (Lifecycle, authentication, token rotation/revocation, links, attribution, driver connection, visibility matrix, scope resolution)
- **Master Part 7:** Data model (Identity, fleet/devices, routes/stops, people/assignments, operations, attendance, emergencies, stop requests, notifications/settings, compliance/audit, RLS, partitions)
- **Master Part 8:** API specification (Conventions, error envelope, endpoint catalogue, ingestion contracts)
- **Master Part 9:** GPS, source selection, and bus state (Valid fixes, units, selector algorithm, transitions, anti-flapping, modes, phone cadence, idle detection, arrivals/departures, pre-trip checks, ETA, states, health, plausibility)
- **Master Part 10:** Features and role workflows (STU, FAC, DRV, SEC, COR, TEC, MGT, SAD workflows and acceptance criteria)
- **Master Part 11:** Algorithms and rules for feature groups (SOS create/join/escalate, boarding QR tokens, morning-present afternoon-absent rule, notification dispatch, operational alerts, reports/exports, stop requests, CSV imports, leave)
- **Master Part 12:** Admin console and scheduled jobs (Global behavior, pages, scheduled jobs)
- **Master Part 13:** Security hardening mandatory controls (13.1 to 13.30 implementation and verification rules)
- **Master Part 14:** Privacy, retention, operations, and configuration (Principles, retention schedule, consent/age/limited mode, configuration defaults table, observability, non-functional requirements)
- **Master Part 15:** Testing and the no-mock rules (Levels/gates, test cases, load/failover, no-mock verification and purge, test data policy, mobile/accessibility)
- **Master Part 16:** Build phases and tasks (P0 through P9 build sequence, exit checks, task maps)
- **Master Part 17:** Launch checklist / release gate (Security, functional, privacy, data hygiene, infrastructure/operations, mobile, pilot/governance)
- **Master Part 18:** Decisions, defaults, and scope (18.1 to 18.4)
- **Master Part 19:** Rules when something fails, and coverage report (Failure protocol, coverage report, final summary, reporting)
- **Master Part 20:** Completeness addendum (Binding permissions matrix, business rules R-01 to R-20, user settings, SOS details, firmware download contract, MFA/sessions, GeoJSON upload, trip summary, CI/CD, deployment specifics, runbooks RB-01 to RB-13, reports by role, CSV columns, edge cases 1-30, test IDs)
- **Master Part 21:** Amendments, register, and reading lists (What changed, conflict register, specification reading lists per phase, role creation/auth, notification categories, job-to-task map, coverage gate)

---

## 3. Companion Specification Sections Read for Phase P0

- **`SW-MVP-1.0.pdf`:** Read sections 1, 2, 4, 6, 7, 8, 10, 28, 31, 33, 34, 35, 41 in full.
- **`HW-SPEC-1.0.pdf`:** Read sections 5, 6, 7, 8, 9, 10, 11, 12, 13, 17, 22 in full.
