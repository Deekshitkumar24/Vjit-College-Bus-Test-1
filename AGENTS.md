# Project Rules: College Bus Tracker (Software MVP)

**Prompt ID:** AG-MASTER-1.0  
**Companion:** SW-MVP-1.0 (Software Specification, 103 pages)  
**Date:** 19 October 2026  

---

## 1.1 Mission
Build the production software for a college bus tracker. It has four parts: a mobile app for iOS and Android (students, faculty, drivers, security), a web console for transport staff (coordinators, technicians, super admins, management), a backend API with a device and driver-phone ingestion pipeline, and background workers on a PostgreSQL database with PostGIS. The first release must be production-grade, not a prototype.

---

## 1.2 No mock, fake, or demo data (absolute rules)
- **R-M1:** Production code, the production seed, and production images contain no mock, fake, dummy, sample, demo, lorem, or placeholder records. This includes buses, devices, routes, stops, people, phone numbers, email addresses, coordinates, tokens, and notifications.
- **R-M2:** Synthetic data exists only in `tests/fixtures/` and `tools/simulator/`. Application code must never import from these folders. A lint rule enforces this.
- **R-M3:** Every synthetic row written to a shared environment (development or staging) has `is_synthetic` set to `true`. Every business table has this column (Part 7).
- **R-M4:** Tests create their own data inside a transaction or a disposable database, and clean up afterwards. No test depends on data left by another test.
- **R-M5:** The simulator refuses to run unless `APP_ENV` is local or staging, and only against hostnames on its allowlist. It is excluded from the production build and the production image.
- **R-M6:** Before any release, the checks in Part 15.4 (`verify:no-mock` and `verify:prod-clean`) must pass. A failing check blocks the release.
- **R-M7:** The interface never shows sample buses, students, or times. Empty states say what to do next (for example: *No buses yet. Coordinators can add buses from the Buses page*).
- **R-M8:** If you create temporary test data by hand during development, remove it with the purge script before reporting the task as done. Record the purge in the phase report.
- **R-M9:** Never use real student, driver, or phone data in development. If a real record seems necessary for debugging, stop and ask.

---

## 1.3 Security
Every item in Part 13 is mandatory. A feature is not done until its security checks pass.

---

## 1.4 Authority and conflicts
Log any conflict between this prompt and `SW-MVP-1.0` in `docs/decisions/conflicts.md`, and stop work on that task until it is resolved.

---

## 1.5 Scope
Build only the in-scope items in Part 18.3. Do not add features the specification does not describe. Record ideas in `docs/future.md`.

---

## 1.6 Configuration, not constants
Thresholds and timings come from configuration (Part 14.4). Store them in the `settings` table, with code defaults that match Part 14.4 exactly. Never hardcode a threshold in a feature file.

---

## 1.7 Coding standards
- TypeScript in strict mode everywhere. No `any`. No non-null assertions unless a comment explains why.
- Validate every external input with Zod at the boundary: HTTP bodies, query strings, headers, CSV rows, webhook payloads, environment variables, and device messages. Reject unknown fields.
- Business logic lives in services or in `packages/domain` (pure functions, no framework imports). Controllers only parse input, authorise, call a service, and map the result.
- No SQL built by string concatenation. Use the ORM or tagged template queries only.
- Store all timestamps in UTC. Convert to Asia/Kolkata only in the presentation layer. Use a date library for arithmetic (for example luxon).
- Errors are typed domain errors. They are mapped to the error envelope in Part 8.2. Never return stack traces.
- Logs are structured (Part 14.2). No personal data in logs.
- No TODO or FIXME on the main branch without a tracking ID.
- Every service function has a unit test.

---

## 1.8 Definition of done (every task)
- Merged through a pull request with one review.
- Unit and integration tests pass, covering success and failure.
- Authorisation tests exist for every new endpoint (the role matrix in Part 10.1).
- Every new input is validated with Zod.
- Migrations are expand-only (Part 16, P0-T5) and reversible in staging.
- Every admin write writes an audit row.
- The OpenAPI document is updated.
- Logs and metrics are added.
- `verify:no-mock` passes.
- The phase report is updated.

---

## 1.9 Work process per phase
1. Write `docs/progress/PXX-plan.md` before coding. List each task ID, the files it touches, and its tests.
2. Build tasks in the order given. Commit after each task. The commit message starts with the task ID.
3. Run all checks after each task. Fix failures before continuing.
4. Write `docs/progress/PXX-report.md` using the template in 1.10.
5. Stop at the end of the phase and wait for approval.

---

## 1.10 Phase report template
Phase ID. Tasks completed (IDs). Specification sections implemented. Tests added and results. Security checks run and results. Migrations applied. Configuration keys added. Known gaps, each linked to a decision ID. Mock-data check result. Purge result. Commands to reproduce.

---

## 1.11 When to ask
Ask only when a decision in Part 18.2 has no default, or when a conflict is logged. Otherwise use the default, and record it in `docs/decisions/defaults-used.md`.
