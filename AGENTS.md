# AG-MASTER-FINAL-1.0: College Bus Tracker Build Contract

Version 1.0 | 21 October 2026  
This is one file. It replaces every earlier AG-MASTER version, the understanding document, every phase plan, and every conflict register.  
Attach to the repository before you start:

- `docs/spec/SW-MVP-1.0.pdf`: what the software does. Read it in full.
- `docs/spec/HW-SPEC-1.0.pdf`: what the tracker does. Read it in full. The ECE team owns it.

Organisation of this file, in precedence order:

1. Part A: how you must work.
2. Part B: locked decisions, conflict resolutions, open defaults, and the Phase P0 scope.
3. Part C: overrides to the master text in this file, each with its exact location.
4. Master Parts 1 to 21: the build contract. Where Part C changes a master section, Part C wins.

---

## Part A. How Antigravity must work

A-1. Read this whole file before any action. Record the date and the Parts you read in `docs/progress/read-log.md`.

A-2. Work in this order and stop at each gate:

- Step A: research RS-01 to RS-20. Write files in `docs/decisions/` only. No code.
- Step B: the phase plan in `docs/progress/P0-plan.md`. List each task with its status and the evidence you will produce.
- Step C: STOP. Wait for written approval.
- Step D: code for the phase, one task at a time.
- Step E: the phase report. STOP. Wait for written approval before the next phase.
- Repeat Steps B to E for every phase.

A-3. Write no code before Step C is approved in writing.

A-4. Allowed status values: NOT STARTED, IN PROGRESS, DONE, BLOCKED. No other value. There are no deferrals. A task you cannot finish is BLOCKED, and the report names the blocker and the owner. Only the product owner can change scope.

A-5. A task is DONE only when its report gives the commit SHA, the exact command, the pasted output, and the files changed. A word such as "passed" with no output does not count.

A-6. Any check that needs Docker, AWS, or the college identity tenant is NOT VERIFIED until it runs in CI or in the named environment and you record the run link. Never mark such a check DONE from a local claim.

A-7. You may say code exists only if git log shows the commit. You may say CI is green only with a GitHub Actions run link for that commit SHA showing success.

A-8. Every research claim needs a source URL, the version or date checked, and a quoted sentence from the source. A link containing `/latest/` is not acceptable. Pin the version.

A-9. Where a decision is open, use the default in Part B.3 and record it in `docs/decisions/defaults-used.md`. One row per default. Do not repeat headers or sentences.

A-10. Synthetic data exists only in `tests/fixtures` and `tools/simulator`. Run `db:purge-synthetic` before you report any task that created test data.

A-11. If this file and a specification disagree, stop, record the conflict in `docs/decisions/conflicts.md`, and wait. Do not guess.

A-12. Ask only about things this file does not answer and no default covers.

A-13. Save Part A, Part B, Part C, and master Part 1 together as `AGENTS.md` at the repository root. Antigravity reads it in every session.

A-14. Do not add a task, table, route, or configuration key that this file does not list. If you think one is needed, record it in `conflicts.md` and wait.

---

## Part B. Decisions, conflicts, defaults, and Phase P0 scope

### B.1 Locked decisions (confirmed by the owner)

| Ref | Decision                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-1 | BENCH is a device status. `devices.status` takes `PROVISIONED`, `ACTIVE`, `BENCH`, `REVOKED`, `RETIRED`.                                                                                                                                                 |
| L-2 | SOS category is stored in `sos_incidents.category`: `EMERGENCY`, `MEDICAL`, `BREAKDOWN`, `OTHER`, `UNKNOWN`.                                                                                                                                             |
| L-3 | Security staff (SEC) see all active buses, read-only.                                                                                                                                                                                                    |
| L-4 | College SSO supports Google Workspace and Microsoft Entra ID. Both use OpenID Connect and are selected by runtime configuration.                                                                                                                         |
| L-5 | AWS region `ap-south-1` (Mumbai), conditional on RS-19. If RS-19 finds a required service missing there, use `ap-south-2` (Hyderabad) and record the change. CloudFront's ACM certificate and WAF web ACL are global and must be created in `us-east-1`. |

### B.2 Conflict register (replaces the master Part 21.2 register)

| ID   | Issue                                                                                                                         | Resolution in this file                                                                                                                                                                                               | Owner to confirm                                             | Status                                     |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| C-01 | `SW-MVP-1.0` section 11.5 step 2 requires ACTIVE. Sections 16.5 and `HW-SPEC-1.0` section 13.2 create devices as PROVISIONED. | A PROVISIONED device is accepted only on its first authenticated request, when `first_used_at` is empty. That request sets status ACTIVE and `first_used_at` in one transaction. Every later request requires ACTIVE. | Engineering lead, ECE team                                   | Applied                                    |
| C-02 | Turnstile on driver OTP is not in `SW-MVP-1.0` F-AUTH-02.                                                                     | Kept as an added control, recorded in `defaults-used.md`.                                                                                                                                                             | Engineering lead, counsel                                    | Applied, awaiting owner                    |
| C-03 | The spec uses `is_mock`. Earlier drafts used `mocked`.                                                                        | `is_mock` everywhere.                                                                                                                                                                                                 | Engineering lead                                             | Applied                                    |
| C-04 | `SW-MVP-1.0` section 19.1 captures an SOS category, but section 10.7 has no column for it.                                    | `sos_incidents.category` (L-2).                                                                                                                                                                                       | Engineering lead                                             | Applied                                    |
| C-05 | The heartbeat returned `firmware_target` only, so the device could not download an image.                                     | `FIRMWARE_UPDATE` response carries `firmware_url` (presigned GET, valid 15 minutes), `firmware_sha256`, `firmware_size_bytes`, and `firmware_signature` (master Part 20.6).                                           | ECE team confirms the device side (`HW-SPEC-1.0` section 17) | Applied, awaiting ECE confirmation         |
| C-06 | Export link lifetime: `SW-MVP-1.0` section 23 says 24 hours.                                                                  | Exports: 24 hours. Firmware links: 15 minutes.                                                                                                                                                                        | Product owner                                                | Applied, awaiting product owner            |
| C-07 | The release gate required college email for every user. Section 4 allows driver email.                                        | Driver accounts may use a non-college email only when `users.college_email_exception` is true and `users.exception_reason` is filled (OV-8).                                                                          | Product owner, counsel                                       | Applied, awaiting owner                    |
| C-08 | The SOS flow in master Part 5.5 depends on the SOS service.                                                                   | P1 stores SOS events only. Incident creation and join are built in P3-T16.                                                                                                                                            | Engineering lead                                             | Applied                                    |
| C-09 | A duplicate sample with different content: section 11.5 says per-sample CONFLICT, and section 27 lists HTTP 409.              | Per-sample rejection with reason CONFLICT, inside a 200 response. HTTP 409 is used only for `IDEMPOTENCY_CONFLICT` on app and console writes (OV-1).                                                                  | Engineering lead                                             | Default adopted, awaiting engineering lead |
| C-10 | Phone sample flag name.                                                                                                       | `is_mock` (same as C-03).                                                                                                                                                                                             | Engineering lead                                             | Applied                                    |
| C-11 | An earlier plan deferred the mobile and web shells to P2 and P4.                                                              | Minimal shells are built in P0 (`P0-T18`, `P0-T19`). P2-T1 and P4-T1 extend them (OV-4).                                                                                                                              | Product owner                                                | Applied                                    |
| C-12 | An earlier plan deferred the Terraform environments.                                                                          | Dev, staging, and production Terraform are written in `P0-T17`. Dev is applied in `P0-T11`, staging in P7, and production in P9 (`P9-T6`) (OV-18).                                                                    | Product owner                                                | Applied                                    |

### B.3 Open decisions and the defaults in force

Use these defaults until the owner answers. Record each use in `docs/decisions/defaults-used.md`.

| Ref  | Question                               | Default in force                                                                                                                                                                    | Owner                   |
| ---- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| D-01 | Device GNSS source                     | Use the EC200U-CN internal GNSS if the order code includes it. Otherwise use an external NEO-6M. Software is identical either way.                                                  | ECE team                |
| D-02 | Low-voltage event                      | The device emits `LOW_VEHICLE_BATTERY` at 11.8 V (12 V class) and 23.5 V (24 V class), sustained for 30 seconds. Cut-off behaviour stays in firmware. There is no extra event type. | ECE team                |
| D-03 | Mixed 12 V and 24 V fleet              | Each device is set to its bus voltage class at provisioning (`devices.vehicle_class`, V12 or V24).                                                                                  | Transport office        |
| D-04 | Backup battery                         | Not in the MVP hardware. The schema is unaffected.                                                                                                                                  | Budget holder           |
| D-05 | Tamper switch and door sensors         | Not in the MVP production batch. Their event handlers exist but are inactive.                                                                                                       | Budget holder           |
| D-06 | Driver phones                          | College-issued phones preferred. Personal phones only with recorded consent.                                                                                                        | Transport office        |
| D-07 | DLT entity and SMS templates           | SMS is disabled in production until the DLT entity and templates are approved. Until then, SOS tiers 1 to 3 use push and email, and the setup alert is raised.                      | College IT              |
| D-08 | Minimum mobile OS                      | Android 10 and later. iOS 16 and later.                                                                                                                                             | Product owner           |
| D-09 | Regional disaster recovery             | Accept a regional restore of about 4 hours for the MVP.                                                                                                                             | Super admin, college IT |
| D-10 | Boarding method                        | QR at launch. RFID in phase 2.                                                                                                                                                      | Transport office        |
| D-11 | Map provider                           | MapLibre with OpenStreetMap tiles. The tile provider stays switchable.                                                                                                              | Product owner           |
| D-12 | Morning-present, afternoon-absent rule | As written in `SW-MVP-1.0` section 18.6 and master Part 11.                                                                                                                         | Faculty committee       |
| D-13 | Default tracking mode                  | AUTO.                                                                                                                                                                               | Transport office        |
| D-14 | Retention periods                      | The values in master Part 14.2.                                                                                                                                                     | Policy owner            |
| D-15 | Parental consent                       | Guardian one-time code. Unconsented minors see limited mode. Counsel confirms.                                                                                                      | Counsel                 |
| D-16 | Critical Alerts on iOS                 | Not used in the MVP. Time-sensitive interruption level.                                                                                                                             | Product owner           |
| D-17 | Escalation contacts                    | Entered by the college in the console. Until then, raise the setup alert and use no placeholder.                                                                                    | Security office         |
| D-18 | College SSO provider                   | L-4. Narrow later if college IT confirms one provider.                                                                                                                              | College IT              |

### B.4 Research rules that override master Part 4

- RS-19 must give yes or no for every service listed in master Part 4 (ECS on Fargate, ALB, RDS PostgreSQL with PostGIS, S3, SES, SNS, KMS, WAF, ACM, Secrets Manager, CloudFront), each with its source line. A CloudFront certificate or WAF web ACL that must be created in `us-east-1` is a constraint, not a missing service.
- RS-06 stays INCOMPLETE until the SMS provider is chosen. Then it records the provider name, the template and entity registration process, and the delivery-report format.
- RS-19 and RS-06 do not close until these rules are met. Other research files follow A-8.

### B.5 Phase P0 scope and evidence

P0 tasks replace the master Part 16 P0 list where they differ.

| Task            | Scope                                                                                                                                                              | Evidence the report must show                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| P0-T1 to P0-T11 | As master Part 16. The region rule in OV-5 applies to P0-T11.                                                                                                      | Per task: the command, the output, the commit SHA                                                   |
| P0-T12          | Admin MFA recovery codes: 10 single-use codes per admin, hashed with argon2id, shown once, rejected on reuse (master Part 13, `recovery_codes`).                   | Test output: generate, use once, reject the second use                                              |
| P0-T13          | Authorisation harness: every route tested against every role and unauthenticated, from the permissions matrix in master Part 20 (the authority for T-SEC-01).      | Test output with route count and role count                                                         |
| P0-T14          | Audit log: append-only trigger that rejects UPDATE and DELETE on `audit_logs`, and the grants for `app_runtime`, `app_worker`, and `app_migrator` (master Part 7). | Integration test output on Testcontainers PostgreSQL                                                |
| P0-T15          | Telemetry: Sentry capture, OpenTelemetry traces and metrics, CloudWatch exporter configured for dev.                                                               | A deliberate test error reaches Sentry dev, and a trace reaches CloudWatch. Event IDs in the report |
| P0-T16          | CI pipeline: build, typecheck, lint, test:unit, test:int, test:rls, verify:no-mock, verify:routes-auth, verify:migrations, security:scan on every pull request.    | GitHub Actions run link for the SHA, showing success                                                |
| P0-T17          | Terraform for dev, staging, and production: directories and variable files. Only dev is applied in P0 (OV-18).                                                     | `terraform validate` and `terraform plan` output for each environment                               |
| P0-T18          | Minimal mobile shell: Expo Router, SecureStore token storage, one sign-in screen, a role route guard, and a role switcher placeholder for the four app roles.      | Guard unit test output. Typecheck and lint output                                                   |
| P0-T19          | Minimal web shell: Vite, React Router, auth context, one sign-in screen, a route guard for admin roles, and the CSP header in the dev configuration.               | Guard unit test output. One Playwright smoke test output                                            |

P0 exit criteria (master Part 16, P0 exit, with OV-16 applied):

1. SSO sign-in works in dev against the college test tenant. NOT VERIFIED until it runs against that tenant. If IT has not provided the tenant, P0 is BLOCKED, and the owner names the blocker.
2. `verify:routes-auth` passes, with its output pasted.
3. RLS integration tests pass against Testcontainers PostgreSQL with PostGIS (master Part 13.1). They must show that a user cannot read another user's rows through `app_runtime`, and that a request with no session value returns zero rows.
4. CI is green, with a GitHub Actions run link for the SHA.
5. The security headers test passes on the API host, run against the running API.

Only the product owner can accept an unmet exit criterion, and the acceptance is written into `docs/decisions/`.

---

## Part C. Overrides to the master text

Each override names the master location it changes. Where an override and the master text differ, the override wins.

| OV    | Master location                                         | Change                                                                                                                                                                                                                                                                                                      |
| ----- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OV-1  | Part 8.2 error table, row CONFLICT (currently HTTP 409) | CONFLICT is not a top-level HTTP status for ingestion. Ingestion returns HTTP 200 with a per-sample rejected entry, reason CONFLICT. IDEMPOTENCY_CONFLICT stays HTTP 409.                                                                                                                                   |
| OV-2  | Part 5.2 step S7                                        | Replace "Different content: CONFLICT" with "Different content: rejected with reason CONFLICT inside the 200 response (OV-1)".                                                                                                                                                                               |
| OV-3  | Part 16, Phase P0 task list                             | Replace with Part B.5. P0-T1 to P0-T11 keep their master wording, with OV-5 applied to P0-T11. P0-T12 to P0-T19 are added.                                                                                                                                                                                  |
| OV-4  | Part 16, P2-T1 and P4-T1                                | P2-T1 extends the P0-T18 mobile shell. P4-T1 extends the P0-T19 web shell. Neither creates a new shell.                                                                                                                                                                                                     |
| OV-5  | Part 16, P0-T11 and every region reference              | The AWS region is `ap-south-1` (L-5). The CloudFront ACM certificate and WAF web ACL are created in `us-east-1`. Every other resource is in `ap-south-1`.                                                                                                                                                   |
| OV-6  | Part 4, RS-19                                           | Apply Part B.4. A global constraint is recorded as a constraint, not as a missing service.                                                                                                                                                                                                                  |
| OV-7  | Part 4, RS-06                                           | Apply Part B.4. The SMS research stays INCOMPLETE until the provider is chosen.                                                                                                                                                                                                                             |
| OV-8  | Part 7, `users` table                                   | Add `college_email_exception` (boolean, default false) and `exception_reason` (text, required when `college_email_exception` is true). Source: C-07.                                                                                                                                                        |
| OV-9  | Part 3 (authentication variables) and Part 13 (SSO)     | Provide one OpenID Connect configuration for Google Workspace and one for Microsoft Entra ID (L-4), each with issuer, client ID, and client secret. The active provider is chosen by runtime configuration, not by code. Replaces the single `OIDC_ISSUER`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET` set. |
| OV-10 | Part 19.2, coverage statuses                            | Allowed values: "built and passing", "missing", or "BLOCKED with owner". "deferred" is not a status (A-4).                                                                                                                                                                                                  |
| OV-11 | Part 1.8, definition of done                            | Superseded by Part A, A-5 to A-7.                                                                                                                                                                                                                                                                           |
| OV-12 | Part 14.4 and Part 20.17, configuration keys            | The settings keys are exactly the rows of Part 14.4 and the keys listed in Part 20.17. The code and seed data contain no other key. Any extra key needs a recorded decision in `docs/decisions/defaults-used.md`. The P0 report counts both lists and lists any difference.                                 |
| OV-13 | Part 21.2, conflict register                            | Replaced by Part B.2 (C-01 to C-12).                                                                                                                                                                                                                                                                        |
| OV-14 | Part 21.1, storage added                                | Also add `users.college_email_exception` and `users.exception_reason` (OV-8).                                                                                                                                                                                                                               |
| OV-15 | Part 7 and P0-T3, table list                            | The only added table is `push_tokens`. `recovery_codes` and `outbox` are already in Part 7 and are not additions.                                                                                                                                                                                           |
| OV-16 | Part 16, P0 exit criteria                               | Apply Part B.5. A check listed as NOT VERIFIED is not DONE (A-6).                                                                                                                                                                                                                                           |
| OV-17 | Part 1.10, phase report template                        | Each phase report must also give: the commit SHAs, the command output for each DONE claim, the NOT VERIFIED list, the configuration key count, the table count, and each research source with its date checked (A-5, A-8).                                                                                  |
| OV-18 | Part 16, P0-T11 and P9-T6                               | Dev Terraform is applied in P0-T11. Staging is applied in P7. Production is applied in P9-T6.                                                                                                                                                                                                               |
| OV-19 | Part 16, P0-T18 and P0-T19                              | These are minimal shells (Part B.5). Full screens are built in P2 and P4.                                                                                                                                                                                                                                   |

---

## Part 1. Project rules (save as AGENTS.md)

### 1.1 Mission

Build the production software for a college bus tracker. It has four parts: a mobile app for iOS and Android (students, faculty, drivers, security), a web console for transport staff (coordinators, technicians, super admins, management), a backend API with a device and driver-phone ingestion pipeline, and background workers on a PostgreSQL database with PostGIS. The first release must be production-grade, not a prototype.

### 1.2 No mock, fake, or demo data (absolute rules)

- **R-M1:** Production code, the production seed, and production images contain no mock, fake, dummy, sample, demo, lorem, or placeholder records. This includes buses, devices, routes, stops, people, phone numbers, email addresses, coordinates, tokens, and notifications.
- **R-M2:** Synthetic data exists only in `tests/fixtures/` and `tools/simulator/`. Application code must never import from these folders. A lint rule enforces this.
- **R-M3:** Every synthetic row written to a shared environment (development or staging) has `is_synthetic` set to `true`. Every business table has this column (Part 7).
- **R-M4:** Tests create their own data inside a transaction or a disposable database, and clean up afterwards. No test depends on data left by another test.
- **R-M5:** The simulator refuses to run unless `APP_ENV` is local or staging, and only against hostnames on its allowlist. It is excluded from the production build and the production image.
- **R-M6:** Before any release, the checks in Part 15.4 (`verify:no-mock` and `verify:prod-clean`) must pass. A failing check blocks the release.
- **R-M7:** The interface never shows sample buses, students, or times. Empty states say what to do next (for example: _No buses yet. Coordinators can add buses from the Buses page_).
- **R-M8:** If you create temporary test data by hand during development, remove it with the purge script before reporting the task as done. Record the purge in the phase report.
- **R-M9:** Never use real student, driver, or phone data in development. If a real record seems necessary for debugging, stop and ask.

### 1.3 Security

Every item in Part 13 is mandatory. A feature is not done until its security checks pass.

### 1.4 Authority and conflicts

Log any conflict between this prompt and `SW-MVP-1.0` in `docs/decisions/conflicts.md`, and stop work on that task until it is resolved.

### 1.5 Scope

Build only the in-scope items in Part 18.3. Do not add features the specification does not describe. Record ideas in `docs/future.md`.

### 1.6 Configuration, not constants

Thresholds and timings come from configuration (Part 14.4). Store them in the `settings` table, with code defaults that match Part 14.4 exactly. Never hardcode a threshold in a feature file.

### 1.7 Coding standards

- TypeScript in strict mode everywhere. No `any`. No non-null assertions unless a comment explains why.
- Validate every external input with Zod at the boundary: HTTP bodies, query strings, headers, CSV rows, webhook payloads, environment variables, and device messages. Reject unknown fields.
- Business logic lives in services or in `packages/domain` (pure functions, no framework imports). Controllers only parse input, authorise, call a service, and map the result.
- No SQL built by string concatenation. Use the ORM or tagged template queries only.
- Store all timestamps in UTC. Convert to Asia/Kolkata only in the presentation layer. Use a date library for arithmetic (for example luxon).
- Errors are typed domain errors. They are mapped to the error envelope in Part 8.2. Never return stack traces.
- Logs are structured (Part 14.2). No personal data in logs.
- No TODO or FIXME on the main branch without a tracking ID.
- Every service function has a unit test.

### 1.8 Definition of done (every task)

- Superseded by Part A, A-5 to A-7.
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

### 1.9 Work process per phase

1. Write `docs/progress/PXX-plan.md` before coding. List each task ID, the files it touches, and its tests.
2. Build tasks in the order given. Commit after each task. The commit message starts with the task ID.
3. Run all checks after each task. Fix failures before continuing.
4. Write `docs/progress/PXX-report.md` using the template in 1.10.
5. Stop at the end of the phase and wait for approval.

### 1.10 Phase report template

Phase ID. Tasks completed (IDs). Specification sections implemented. Tests added and results. Security checks run and results. Migrations applied. Configuration keys added. Known gaps, each linked to a decision ID. Mock-data check result. Purge result. Commands to reproduce. Plus items required by OV-17 (commit SHAs, command output for DONE, NOT VERIFIED list, config key count, table count, research sources with dates).

### 1.11 When to ask

Ask only when a decision in Part 18.2 has no default, or when a conflict is logged. Otherwise use the default, and record it in `docs/decisions/defaults-used.md`.
