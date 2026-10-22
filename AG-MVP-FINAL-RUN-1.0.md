# AG-MVP-FINAL-RUN-1.0: Build the College Bus Tracker to Production Readiness (P1 to P9)

Version 1.0 | 22 October 2026
This is the only execution prompt from now on. It replaces AG-MVP-PROMPT-2.0, AG-MVP-PHASES-1.0, AG-MVP-GUIDE-1.0, the autonomy directive, and every per-report correction prompt. Do not use those.

---

## 0. Mission

Finish phases P1 to P9 and make the system production ready. Work continuously. Do not ask for approval between tasks or phases. A phase report is not a stop. When a phase is complete, start the next one in the same session.

You may claim production ready only when the readiness gate in section 9 prints PRODUCTION READY. Until then, say exactly which items are open.

---

## 1. Sources and precedence

1. AGENTS.md: the contract (Parts A, B, C, and master Parts 1 to 21).
2. docs/spec/SW-MVP-1.0.pdf and docs/spec/HW-SPEC-1.0.pdf: required behaviour.
3. This file: execution rules. It overrides AGENTS.md only where it says so explicitly (section 2 and section 8).

Conflicts: choose the stricter option for privacy, security, and safety. Record the conflict and the choice in docs/decisions/conflicts.md. Then continue. A conflict alone is never a reason to stop.

Defaults: every open decision in AGENTS.md Part B.3 has a default in force. Use it. Do not ask about it.

---

## 2. Environment (no Docker)

- Database: PostgreSQL 16 with PostGIS, installed natively on Windows. Connection in DATABASE_URL_TEST (git-ignored .env).
- Each test run creates a uniquely named database, creates the postgis extension, runs migrations as app_migrator, and drops the database afterwards, including after failure.
- Row-level security (RLS) assertions connect as app_runtime, never as a superuser. A superuser bypasses RLS, so such an assertion is invalid.
- Object storage: MinIO, installed natively on Windows, as the S3-compatible target for tests and local runs. Use the S3 SDK with an endpoint override. Do not write a mock S3 client.
- Email: Mailpit, installed natively on Windows, as the SMTP target for local runs.
- Android: an Android emulator (Android Studio) for emulator-level runs. iOS simulators need macOS. Physical iOS verification needs a Mac or a device farm (E6).
- CI: GitHub Actions, with a PostGIS service container (image postgis/postgis:16-3.4) and a MinIO service. The owner installs nothing for CI.

---

## 3. Status words and evidence (strict)

Allowed statuses: NOT STARTED, IN PROGRESS, DONE, BLOCKED-EXTERNAL (name the E-item), BLOCKED-OWNER (name the O-item, and only when no default applies).

A task is DONE only when all of these hold:
- one commit for that task, and the commit message starts with the task ID;
- the task's test IDs ran, and the raw output is saved in docs/progress/evidence/PXX-Tn.log;
- the list of files changed is in the phase report;
- no test is skipped.

An exit item is VERIFIED only when it ran in the environment it names, with raw output or a run link:
- database and RLS: a real PostgreSQL (native locally, or CI);
- API behaviour: a running API process against the real database;
- web: a real browser (Playwright);
- mobile: an emulator or a physical device, as the exit names;
- security headers and TLS: a deployed host;
- CI: a GitHub Actions run for the commit.

Unit tests alone never verify an API, database, device, staging, or security exit.

Forbidden, always:
- .skip, .only, xit, xdescribe, or todo placeholders counted as passes;
- changing an expected value to match wrong output;
- deleting or weakening a failing test;
- mocking the system under test (the database, the API, the device, the identity provider);
- writing a status or a count without the output that proves it.

---

## 4. Autonomy rules

1. Continue across tasks and phases. Do not write "waiting for approval" anywhere.
2. Exhaust all unblocked work before any stop.
3. Stop only in these cases. Before stopping, write docs/progress/NEXT.md with the blocker, the ID, and the next step.
   a. A task needs an E-item (section 5.2), and no code path can make progress without it. Mark the task BLOCKED-EXTERNAL and continue with other work.
   b. A decision in section 5.1 has no default in force.
   c. An action would spend money, apply infrastructure to staging or production, publish to an app store, delete production-like data, or change access to a real person's account. These need the owner's written instruction in the form "GO: <action>". Applying dev infrastructure is allowed once the E1 account has been provided.
   d. Every phase is complete and the readiness gate has run.
4. Token budget: if you are close to the limit, finish the current task with its evidence, write docs/progress/NEXT.md, and stop. On resume, read NEXT.md and this file. Do not re-read the whole contract. Read only the Part the current task names.
5. Run the full gate (section 7) at the end of each phase, not after every task. After each task, run that task's tests and the affected package's tests.

---

## 5. Decisions and external inputs

### 5.1 Owner decisions (defaults in force; do not ask)

| Ref | Question | Default in force |
|---|---|---|
| O1 | Accept any unmet phase exit in writing? | No. Exits stay open until verified or accepted in writing |
| O2 | Duplicate sample with different content returns 200 with a per-sample CONFLICT (C-09) | Yes (OV-1) |
| O3 | OTP lockout (C-13) | Implement the per-code attempt limit and the 15-minute lock. Record the 10-consecutive-failures account rule as open |
| O4 | Firmware download contract (C-05) | Contract as written in AGENTS.md Part 20.6 |
| O5 | Export link lifetime (C-06) and driver non-college email (C-07) | 24 hours. Exception requires a recorded reason |
| O6 | Build ahead | Not needed. Phases run in order |
| O7 | Pilot participants and reference phones | Needed only for P9-T5 and the device exits |
| O8 | 48 extra configuration keys | Keep as a proposed amendment, marked OV-12 FAIL, with a note in docs/decisions/extra-config-keys.md |
| O9 | No Docker | Accepted |

### 5.2 External inputs (the owner provides; the agent cannot create them)

| Ref | Input | Unlocks |
|---|---|---|
| E1 | AWS dev account with billing and a Terraform role, plus staging and production accounts later | Dev infrastructure (P0-T11), staging (P1, P6, P7, P8), production (P9-T6) |
| E2 | GitHub repository with Actions enabled | CI (P0-T16), CI-based RLS and load runs |
| E3 | College identity test tenant: Google Workspace and Microsoft Entra, two test users each, dev redirect URIs | P0 exit 1, sign-in on device (P2, P3) |
| E4 | Sentry DSN for dev | P0-T15 live error capture |
| E5 | Cloudflare Turnstile keys for dev | P0-T6 OTP and P3-T1 driver sign-in |
| E6 | Physical phones: one Android 10 or later, one iOS 16 or later (iOS needs a Mac or device farm) | Device exits (P2, P3), two-hour battery test |
| E7 | Staging environment (after E1) | Staging exits (P1 load, P6 SOS burst, P8 load and failover) |
| E8 | Penetration tester engaged, with budget | P8-T6 before launch |
| E9 | College-owned Google Play Console and Apple Developer accounts | P9-T2 store submission |
| E10 | Pilot operator consent and participants | P9-T5 |
| E11 | Bench tracker flashed with the contract firmware (ECE team) | AC-TEC-01, the live tracker check |
| E12 | Firebase project with FCM and APNs keys (service account JSON) | Live push, P6-T1 to T3 |
| E13 | SMS provider contract, approved DLT entity, and approved templates (D-07) | Live SMS, P6-T3 |
| E14 | Expo account with EAS access | P9-T2 builds |

---

## 6. Corrections to apply first

Apply each as its own commit, in this order, before starting P1 remaining work. Record each change in docs/progress/corrections.md.

1. P0-T15 (Sentry, OpenTelemetry, CloudWatch): change to IN PROGRESS. The live error reaching Sentry needs E4, so record the blocker as BLOCKED-EXTERNAL once the code is complete.
2. P0-T10 (observability baseline): change to IN PROGRESS. Add metrics, traces, dashboard definitions, and external probe definitions as Part 14.5 requires. Probe execution needs a deployed host (E1, E7).
3. Commit map: P0-T1, T2, T5, T7, T8, T9, T12, and T13 cite commit 441b4e5, which is a documentation commit. For each task, identify the commit or commits that contain its code. Run its tests on its own and save the output. Record the true SHA in the plan. Do not rewrite history.
4. P0-T3: DONE only with the output of db:migrate against native PostgreSQL 16 with PostGIS, showing both users columns (college_email_exception, exception_reason).
5. P0-T6: DONE only with tests for PKCE, state, and nonce; refresh reuse revoking the family (T-AUTH-03); and runtime choice between Google and Microsoft. The live SSO sign-in is exit 1 and stays BLOCKED-EXTERNAL (E3) until run.
6. P0-T11, P0-T16, P0-T17: IN PROGRESS until terraform validate and plan pass in CI (E2). Apply dev only after E1 is provided.
7. P2: confirm that tasks P2-T1 to P2-T14 each exist under their Part 16 IDs with their own tests. The recent commits show T4, T6, T8, T12, T13, and T14. Verify T1, T2, T3, T5, T7, T9, T10, and T11 separately. The QR scanner is P2-T9, stop requests are P2-T10, and the leave screen is P2-T11.
8. P3: confirm each claimed task (T1 to T8, T15 to T18) with tests that run locally. The device exits and the battery test are BLOCKED-EXTERNAL (E6, E3, E5).
9. P4 (corrects the P4 report): AC-COR-01, AC-COR-02, AC-COR-03, and T-SEC-05 are VERIFIED only through integration tests that run the real API against the native database. React unit tests do not count. AC-TEC-01 is BLOCKED-EXTERNAL (E11). AC-TEC-02 is verified through an integration test of the replacement history.
10. P5: T-CON-01 must run two concurrent transactions against the native PostgreSQL with the unique index. If the current test uses in-memory state, rewrite it. T-ATT-01 to T-ATT-04 must run against the real database and the real clock or an injected clock.
11. P1: run T-LOAD-01 locally against the native database with 50 simulated buses as a smoke run. Record it as smoke evidence only. The staging exit stays BLOCKED-EXTERNAL (E7).
12. Owner-approved phases P2, P3, P4 (approved in chat) have open exits. Approval does not change the evidence. Record in docs/progress/owner-acceptance.md only the exit items the owner has explicitly accepted, quoted from the owner's message. Keep every other open exit open in the readiness gate.

---

## 7. Global quality gate (run at the end of each phase)

Run these commands. Create any script that does not exist yet. Save the output of each run to docs/progress/evidence/gate-PXX.log. The gate must be green before a phase report is written.

- pnpm lint, pnpm typecheck
- pnpm test:unit (all packages)
- pnpm test:int (real PostgreSQL with PostGIS)
- pnpm test:rls (as app_runtime)
- pnpm test:contract (recorded device messages)
- pnpm test:security (authorisation matrix, IDOR suite, route inventory, headers, CORS, injection payloads, rate limits)
- pnpm verify:no-mock, pnpm verify:routes-auth, pnpm verify:migrations
- pnpm security:scan (Semgrep, gitleaks, pnpm audit --prod --audit-level=high)
- pnpm test:e2e:web and pnpm test:a11y, when the phase touches the web console
- mobile unit tests, and Maestro flows on the Android emulator, when the phase touches the mobile apps
- coverage: packages/domain at 80% of lines or more (Part 15.1)

No high or critical audit finding may be open at any phase end.

---

## 8. Phase tasks

Task IDs and scope come from master Part 16. Test IDs come from master Part 15.2. Acceptance criteria come from master Part 10. Where a task's exit needs an environment in section 5.2, the local part is built and verified now, and the exit is recorded as BLOCKED-EXTERNAL.

### P1 Ingestion and source engine

- Tasks P1-T1 to P1-T11, as in master Part 16. Verify each one; add missing tests.
- Test IDs: T-ING-01 to T-ING-10; T-SEL-01 to T-SEL-05; T-SEC-02; R-01, R-02, R-07 concurrency tests.
- Exits:
  - the simulator drives the states correctly across 50 buses, run locally: VERIFIED (local);
  - the contract harness passes on recorded messages from every firmware version: VERIFIED;
  - T-LOAD-01 on staging: BLOCKED-EXTERNAL (E7). The local smoke run is recorded as evidence only.

### P2 Student and faculty apps

- Tasks P2-T1 to P2-T14, under their Part 16 IDs. Each with its own tests (section 6, item 7).
- Test IDs: AC-STU-01 to AC-STU-05 and AC-FAC-01 to AC-FAC-03 as in master Part 10.3 and 10.4. Run on the Android emulator for local evidence.
- Exits:
  - AC-STU-01 to AC-STU-05 and AC-FAC-01 to AC-FAC-03 on a physical device: BLOCKED-EXTERNAL (E3, E6, O7). Emulator runs are evidence only.
  - SOS trigger in the student app is recorded under P3-T5 and P6-T7. It has no P2 ID.

### P3 Driver app and phone tracking

- Tasks P3-T1 to P3-T8 and P3-T15 to P3-T18.
- Local tests: T-SHF-01 to T-SHF-04 against the real API and database. T-OFF-01 (phone buffer flushes in order after 30 minutes offline) with a real SQLite file, not a mocked store. T-MOB-02 and T-MOB-03 as emulator tests.
- Exits:
  - AC-DRV-01 to AC-DRV-04 on a physical reference phone: BLOCKED-EXTERNAL (E6, E3).
  - Two-hour battery test on the reference phone (T-MOB-01, 8 percent per hour or less): BLOCKED-EXTERNAL (E6).

### P4 Coordinator and technician consoles

- Tasks P4-T1 to P4-T9. Verify each against section 6, item 9.
- Local integration tests against the real API and native database:
  - AC-COR-01: revoked device rejected within 5 seconds, ticket created;
  - AC-COR-02: CSV with 3 bad rows out of 400 blocks the commit and lists the 3 rows;
  - AC-COR-03: deactivated user gone from live views within 60 seconds;
  - AC-TEC-02: replacement keeps the old device's history, and no sample is attached to the wrong device;
  - T-SEC-05: each admin endpoint returns 404 (or 403) to a user without the role, across the route inventory.
- Playwright tests for the coordinator and technician flows, against the running web console and the local API.
- Exits: AC-TEC-01 (first heartbeat within 2 minutes of power-up): BLOCKED-EXTERNAL (E11).

### P5 Attendance and alerts

- Tasks P5-T1 to P5-T7.
- Tests: T-ATT-01 (QR accepted at 30 seconds, rejected at 65 seconds), T-ATT-02 (duplicate scan), T-ATT-03 (morning present, afternoon absent, alert within 5 minutes of cutoff), T-ATT-04 (leave prevents the alert), T-CON-01 (two parallel scans create one record). All against the native database, with an injected clock where time is involved.
- Exit: T-ATT-01 to T-ATT-04 and T-CON-01: VERIFIED (local, real database).

### P6 SOS, stop requests, and notifications

- Tasks P6-T1 to P6-T8.
- Local tests: T-SOS-02 (two triggers 20 seconds apart give one incident), T-SOS-03 (two buses in the same second give two incidents), T-SOS-04 (tier 1 after 2 minutes without acknowledgement), T-SOS-05 (cancellation refused after acknowledgement), T-SOS-06 (missing recipient list raises the setup alert), T-NTF-01 to T-NTF-03 (quiet hours and rate limits applied at dispatch, SMS template mismatch blocked), T-CON-03 (two parallel SOS triggers create one incident). All against the native database.
- Exits:
  - T-SOS-01 (tier 0 push within 5 seconds at p95): BLOCKED-EXTERNAL (E12, E1 for SES).
  - T-LOAD-02 (SOS burst of five buses): BLOCKED-EXTERNAL (E7).
  - Live SMS: BLOCKED-EXTERNAL (E13). Until then, tiers 1 to 3 use push and email, and the setup alert is raised (D-07).

### P7 Reports, privacy, and retention

- Tasks P7-T1 to P7-T7.
- Local tests: exports written to MinIO with the 100,000-row limit, a 24-hour presigned link, and expiry; T-SEC-03 (formula injection escaped); T-PRV-01 (under-18 without consent sees only the notice and SOS), T-PRV-02 (deletion removes attendance and location, anonymises SOS), T-PRV-03 (retention purges expired partitions and writes the summary); the audit coverage test for every write route (Part 13.12).
- Exits: T-PRV-01 to T-PRV-03 and the export tests: VERIFIED (local). Staging apply: BLOCKED-EXTERNAL (E1, E7).

### P8 Security hardening and load

- Tasks P8-T1 to P8-T8.
- Local: run every Verify step in master Part 13 that can run locally. Run the IDOR suite on every identifier route. Run OWASP ZAP baseline against the local API. Generate the SBOM. Run a backup and restore drill from a local dump into a second database, and record the measured time.
- Exits:
  - every Part 13 check that can run locally: VERIFIED (local);
  - TLS scan, HSTS on the deployed hosts, and the staging load and failover tests (T-LOAD-01, T-LOAD-02, T-FO-01 to T-FO-04): BLOCKED-EXTERNAL (E1, E7);
  - penetration test: BLOCKED-EXTERNAL (E8).
- No high or critical finding may be open.

### P9 Release readiness and pilot

- Tasks P9-T1 to P9-T7.
- Local: accessibility fixes and axe scans on every console page (WCAG 2.1 AA); runbooks RB-01 to RB-13 written in docs/runbooks, with the local stack used to rehearse RB-01, RB-02, RB-03, and RB-08 where possible; the verify:prod-clean script written and run against a clean local database as a dry run.
- Blocked: EAS builds and store submission (E9, E14); the pilot (E10, O7); staging purge (E7); the production Terraform apply (E1, and the owner's "GO: apply production"); the production verify:prod-clean run.
- Exit: pilot exit criteria in master Part 16 (P9-T5) and the launch checklist in master Part 17. Both are BLOCKED-EXTERNAL until their inputs are provided.

---

## 9. Production readiness gate

Build scripts/readiness/check.ts. It reads docs/progress/ledger.md, which has one row per exit item with its ID, phase, status, and evidence path. It also reads the E and O items and runs the gate in section 7. It writes docs/progress/READINESS.md.

It prints PRODUCTION READY only when all of these hold:
- every exit item is VERIFIED;
- no item is BLOCKED-EXTERNAL or BLOCKED-OWNER;
- the gate in section 7 is green;
- docs/progress/coverage.md maps every feature ID in Part 10.2, every business rule R-01 to R-20, every endpoint in Part 8.3, every AC-* and T-* test, and every job in Part 21.6, and each row is "built and passing" with a test file;
- no high or critical security finding is open;
- the runbooks exist, and the backup restore drill is evidenced;
- every launch checklist item in Part 17 has evidence.

Otherwise it prints NOT READY and lists each open item with the E or O input that unlocks it. Do not write "production ready" in any report unless the script prints PRODUCTION READY.

---

## 10. Correction rules (always)

1. A failing test: reproduce it, find the root cause, fix the code, add a regression test, run the affected tests, then run the gate. Commit as "fix(<area>): <what> (PXX-Tn)".
2. Never weaken an assertion or change an expected value to match a wrong result. If the specification has changed, record the specification page in docs/decisions/conflicts.md first.
3. If a later phase breaks an earlier phase's test, fix it before finishing the current phase.
4. A wrong claim in any record is corrected in a new commit. History is never rewritten.
5. After each phase, add any new lesson as a numbered rule in docs/progress/RULES.md. At the end of P9, check every rule against every phase.
6. Keep the ledger (docs/progress/ledger.md) current after every task.

---

## 11. Reporting

Phase report (docs/progress/PXX-report.md), short:
- tasks, each with status, commit SHA, and evidence path;
- exit items, each VERIFIED, BLOCKED-EXTERNAL, or BLOCKED-OWNER, with evidence;
- gate output summary, with the evidence path;
- rules added to RULES.md;
- open items, each with its E or O input.

Do not write "waiting for approval". After the report, start the next phase.

Chat messages: one line per phase completed, plus the list of open E and O items at the end. Under 10 lines per message.

---

## 12. Hard prohibitions

- No Docker.
- No spending money. No paid AWS resources beyond the dev account the owner provided.
- No staging or production infrastructure apply, no app store submission, and no use of production data, without the owner's "GO: <action>".
- No real student, driver, parent, or phone data in any environment. Synthetic data only, flagged is_synthetic, and only in tests and the simulator.
- No secrets in git. .env is git-ignored. gitleaks must be clean.
- No disabling a security control, a lint rule, or a test, without a reason comment and a tracking ID.
- No history rewrite.
- No claim without evidence.

---

## 13. Start now

Begin with section 6, as the first commits. Then continue with P1 remaining work, then P2, through P9. Do not wait for anyone between steps. Stop only for the reasons in section 4.
