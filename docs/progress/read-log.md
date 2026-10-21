# Specification and Contract Reading Log

**Document ID:** READ-LOG-1.0  
**Contract Version:** `AG-MASTER-FINAL-1.0` (Version 1.0 final, 21 October 2026)  
**Date Read:** 21 October 2026

---

## 1. Build Contract Parts Read in Full

The entire `AG-MASTER-FINAL-1.0` contract has been read from Part 0 through Part 21 on 21 October 2026:

- **Part 0:** How Antigravity must work (Rules O-1 to O-12, stop gates Step A through Step E)
- **Part 1:** Decisions, conflicts, and defaults (Locked decisions L-1 to L-5, conflict resolutions C-01 to C-12, open decisions D-01 to D-18)
- **Part 2:** Technology stack (Runtimes, frameworks, pinning requirements, testing, security tooling)
- **Part 3:** Repository, environments, variables, scripts (Layout, environments, environment variable schema, root scripts)
- **Part 4:** Research tasks (RS-01 to RS-20 binding research output definitions)
- **Part 5:** End-to-end pipeline (Edge, hardware sample pipeline S1-S16, driver phone, heartbeat, events, read snapshot, SOS, attendance, notifications, admin writes, jobs)
- **Part 6:** Device connection, provisioning, and visibility (Lifecycle, authentication, token rotation/revocation, links, attribution, driver connection, visibility matrix, scope resolution)
- **Part 7:** Data model (Identity, fleet/devices, routes/stops, people/assignments, operations, attendance, emergencies, stop requests, notifications/settings, compliance/audit, RLS, partitions)
- **Part 8:** API specification (Conventions, error envelope, endpoint catalogue, ingestion contracts)
- **Part 9:** GPS, source selection, and bus state (Valid fixes, units, selector algorithm, transitions, anti-flapping, modes, phone cadence, idle detection, arrivals/departures, pre-trip checks, ETA, states, health, plausibility)
- **Part 10:** Features and role workflows (STU, FAC, DRV, SEC, COR, TEC, MGT, SAD workflows and acceptance criteria)
- **Part 11:** Algorithms and rules for feature groups (SOS create/join/escalate, boarding QR tokens, morning-present afternoon-absent rule, notification dispatch, operational alerts, reports/exports, stop requests, CSV imports, leave)
- **Part 12:** Admin console and scheduled jobs (Global behavior, pages, scheduled jobs)
- **Part 13:** Security hardening mandatory controls (13.1 to 13.30 implementation and verification rules)
- **Part 14:** Privacy, retention, operations, and configuration (Principles, retention schedule, consent/age/limited mode, configuration defaults table, observability, non-functional requirements)
- **Part 15:** Testing and the no-mock rules (Levels/gates, test cases, load/failover, no-mock verification and purge, test data policy, mobile/accessibility)
- **Part 16:** Build phases and tasks (P0 through P9 build sequence, exit checks, task maps)
- **Part 17:** Launch checklist / release gate (Security, functional, privacy, data hygiene, infrastructure/operations, mobile, pilot/governance)
- **Part 18:** Decisions, defaults, and scope (18.1 to 18.4)
- **Part 19:** Rules when something fails, and coverage report (Failure protocol, coverage report, final summary, reporting)
- **Part 20:** Completeness addendum (Binding permissions matrix, business rules R-01 to R-20, user settings, SOS details, firmware download contract, MFA/sessions, GeoJSON upload, trip summary, CI/CD, deployment specifics, runbooks RB-01 to RB-13, reports by role, CSV columns, edge cases 1-30, test IDs)
- **Part 21:** Amendments, register, and reading lists (What changed, conflict register, specification reading lists per phase, role creation/auth, notification categories, job-to-task map, coverage gate)

---

## 2. Companion Specification Documents Read

- **`docs/spec/SW-MVP-1.0.pdf`** (103 pages): Read in full on 20-21 October 2026.
- **`docs/spec/HW-SPEC-1.0.pdf`** (30 pages): Read in full on 20-21 October 2026.
