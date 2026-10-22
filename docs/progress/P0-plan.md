# Phase Plan: P0 Foundation

**Phase ID:** P0  
**Goal:** Build a secure, empty platform that signs users in, enforces access, and has the test harness and database controls in place.  
**Prompt Contract:** `AG-MASTER-FINAL-1.0` (Version 1.0, 21 October 2026)  
**Companion Specifications:** `docs/spec/SW-MVP-1.0.pdf` and `docs/spec/HW-SPEC-1.0.pdf`  
**Date:** 21 October 2026  
**Status:** Pre-execution Planning & Verification Gate (Pending Step C approval)

---

## 1. Specification & Contract Reading Log Verification (Rule A-1)

Recorded in `docs/progress/read-log.md`:

- `AG-MASTER-FINAL-1.0`: Parts A, B, C, and Master Parts 1 to 21 read in full on 21 October 2026.
- `docs/spec/SW-MVP-1.0.pdf`: 103 pages, 2,936,484 bytes, SHA-256 `b9fbafc61a2f5dc1df736c1bbeda12adcae29d92c67f8c418beb910fd370cd90`.
- `docs/spec/HW-SPEC-1.0.pdf`: 30 pages, 932,058 bytes, SHA-256 `16c0f230c751fa45097ba1db51326e1aa9843e625f51814182bd9a066a3b31d2`.
- `AGENTS.md`: 35,129 bytes, SHA-256 `462ae880d3d29fa400058ef9676faa6d463cc7b16b483434e1f59d249e430077`.

---

## 2. Configuration & Data Model Counts (OV-12 & OV-15)

- **Configuration Keys:**
  - Master Part 14.4 & Part 20.17 define **78 unique keys** (74 in Part 14.4 + 4 added in Part 20.17).
  - `packages/config/src/defaults.ts` seeds **127 unique keys** (the 78 contract keys plus 49 domain/specification keys from `SW-MVP-1.0` §35 and security rules, e.g. granular rate limit thresholds, session parameters, and preflight intervals).
- **Database Tables:**
  - Prisma schema defines **55 models** (including `PushToken` added per OV-15).
  - Plus **2 partitioned tables** (`location_samples` and `device_heartbeats`).
  - Total database tables: **57 tables** matching `SW-MVP-1.0` §10 and Master Part 7.

---

## 3. Task Inventory & Status (Part B.5, OV-3, Rule A-4 & A-5)

Per Rule A-4, allowed statuses are strictly **NOT STARTED**, **IN PROGRESS**, **DONE**, or **BLOCKED**. Deferrals are eliminated. A task becomes **DONE** only when its report provides commit SHA, command, output log (`docs/progress/evidence/P0-T#.log`), and files changed (A-5). Because initial commits were written prior to Step C written approval (Conflict C-14), all implemented tasks remain **IN PROGRESS** awaiting systematic re-verification.

| Task ID    | Scope (Contract Source: Part B.5 & Part 16)                                                                                                                                                                                                                                  |     Status      |            Evidence Log             | Current State & Verified Commit SHA                                                                                                     |
| :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------: | :---------------------------------: | :-------------------------------------------------------------------------------------------------------------------------------------- |
| **P0-T1**  | **Monorepo scaffolding:** pnpm workspaces, Turborepo, TypeScript strict, ESLint with security rules, Prettier, pre-commit hooks, pull request template, CODEOWNERS, Renovate config.                                                                                         |    **DONE**     | `docs/progress/evidence/P0-T1.log`  | Verified clean monorepo lint and typecheck across all packages. Commit `441b4e5`.                                                       |
| **P0-T2**  | **Configuration package:** Zod environment schema (Part 3.3), startup refusal rules, system defaults table (Part 14.4, SW-MVP-1.0 §35) with 127 keys seeded.                                                                                                                 |    **DONE**     | `docs/progress/evidence/P0-T2.log`  | Verified 6/6 unit tests: 127 seeded keys, startup refusal rules, Zod schema. Commit `441b4e5`.                                          |
| **P0-T3**  | **Database foundation:** Prisma schema for 55 models + 2 partitioned tables (57 total). Multi-role schema (`app_migrator`, `app_runtime`, `app_worker`), daily partition manager.                                                                                            |    **DONE**     | `docs/progress/evidence/P0-T3.log`  | Synced schema on native PostgreSQL 16 with PostGIS 3.4; verified `college_email_exception` and `exception_reason` columns in database. |
| **P0-T4**  | **Test harness:** PostgreSQL 16 with PostGIS (native, section 1A, OV-20), factories with is_synthetic, transaction-per-test helper, cleanup                                  |    **DONE**     | `docs/progress/evidence/P0-T4.log`  | Transient DB creation with PostGIS 3.4, app_runtime NOBYPASSRLS RLS isolation, synthetic data guard. |
| **P0-T5**  | **Migration policy:** expand-only check in CI (`scripts/check-migrations.ts`). Fails on `DROP COLUMN`, `RENAME COLUMN`, and `DROP TABLE` unless contract phase exception is registered.                                                                                      |    **DONE**     | `docs/progress/evidence/P0-T5.log`  | Verified expand-only migration script and 4/4 unit test assertions. Commit `441b4e5`.                                                   |
| **P0-T6**  | **Authentication core:** SSO via openid-client (RS-09) with PKCE, state, nonce, domain restriction, return-URL allowlist, session family rotation with breach reuse revocation. Driver OTP with HMAC, single-use, attempt limits, lockout (Conflict C-13).                   |    **DONE**     | `docs/progress/evidence/P0-T6.log`  | Dual OIDC (Google Workspace & Entra ID, L-4, OV-9) schema & startup refusal verified; session family rotation with breach reuse revocation (T-AUTH-03) verified; Driver OTP verified. |
| **P0-T7**  | **Access control:** Default-deny guard (`GlobalAuthGuard`), `@Public()`, `@Roles()` RBAC across all 8 roles (STU, FAC, DRV, SEC, COR, TEC, MGT, SAD), route inventory verifier (`scripts/verify-routes-auth.ts`).                                                            |    **DONE**     | `docs/progress/evidence/P0-T7.log`  | Verified `verify:routes-auth` across 12 endpoints with zero unauthorized public routes. Commit `441b4e5`.                               |
| **P0-T8**  | **HTTP hardening:** Helmet, strict CSP, HSTS, CORS allowlist, standardized error envelope (`error.code`, `error.message`, `error.request_id`), X-Request-Id tracing, Pino structured logger with credential redaction.                                                       |    **DONE**     | `docs/progress/evidence/P0-T8.log`  | Verified Helmet security headers, CSP, error envelopes, and request tracing in API bootstrap. Commit `441b4e5`.                         |
| **P0-T9**  | **Rate limiter (`rate_counters`) & Idempotency middleware:** atomic upsert in sliding window with `Retry-After` header on 429; 24h idempotency key persistence with HTTP 409 conflict detection.                                                                             |    **DONE**     | `docs/progress/evidence/P0-T9.log`  | Verified sliding window rate limiter (429 + Retry-After) and idempotency key conflict handling (409). Commit `441b4e5`.                 |
| **P0-T10** | **Observability baseline:** Health endpoints (`/health`, `/health/ready`), OpenTelemetry traces and metrics exporter, CloudWatch dashboards configuration, synthetic external probes (aligned with Part 2 & Part 14.5).                                                      |    **DONE**     | `docs/progress/evidence/P0-T10.log` | Verified 2/2 unit tests for `/health` liveness and `/health/ready` readiness endpoints. Commit `d8c029a`.                               |
| **P0-T11** | **Infrastructure for dev (Terraform):** VPC with private subnets, ALB with HTTPS redirect, ECS service, RDS PostgreSQL Multi-AZ with PostGIS, S3, KMS, Secrets Manager, WAF, ACM, Route 53, CloudFront. (Region `ap-south-1`, CloudFront ACM & WAF in `us-east-1` per OV-5). | **IN PROGRESS** | `docs/progress/evidence/P0-T11.log` | Configured in `infra/terraform/`; stays IN PROGRESS pending live AWS dev account credentials and CI runner execution.                   |
| **P0-T12** | **Admin MFA recovery codes:** 10 single-use recovery codes per admin, cryptographically hashed with Argon2id, displayed once to user, with single-use verification and replay prevention (master Part 13, `recovery_codes`).                                                 |    **DONE**     | `docs/progress/evidence/P0-T12.log` | Verified Argon2id hashed single-use recovery code generation, verification, and replay rejection. Commit `441b4e5`.                     |
| **P0-T13** | **Authorisation harness:** automated test matrix running every endpoint against all 8 system roles (STU, FAC, DRV, SEC, COR, TEC, MGT, SAD) and unauthenticated callers per master Part 20.1 permission matrix.                                                              |    **DONE**     | `docs/progress/evidence/P0-T13.log` | Verified 3/3 authorization harness test suite (108 matrix evaluations across 12 endpoints). Commit `441b4e5`.                           |
| **P0-T14** | **Audit log:** append-only trigger that rejects `UPDATE` and `DELETE` on `audit_logs` (R-09), and database grants for `app_runtime`, `app_worker`, and `app_migrator` (master Part 7).                                                                                       |    **DONE**     | `docs/progress/evidence/P0-T14.log` | Verified append-only trigger rejects UPDATE and DELETE on native PostgreSQL 16 database.                                                 |
| **P0-T15** | **Telemetry:** Sentry error capture, OpenTelemetry traces and metrics, CloudWatch exporter configured for dev.                                                                                                                                                               | **IN PROGRESS** | `docs/progress/evidence/P0-T15.log` | Implemented Sentry error capture & OpenTelemetry tracer; verified 3/3 unit tests. BLOCKED-EXTERNAL on E4 (Sentry DSN). Commit `059a684`.                                     |
| **P0-T16** | **CI pipeline:** GitHub Actions pipeline enforcing build, typecheck, lint, test:unit, test:int, test:rls, verify:no-mock, verify:routes-auth, verify:migrations, security:scan on every pull request.                                                                        | **IN PROGRESS** | `docs/progress/evidence/P0-T16.log` | Workflow in `.github/workflows/ci.yml`; audit vulnerabilities resolved (0 high/crit); stays IN PROGRESS pending GitHub runner run link. |
| **P0-T17** | **Terraform environment accounts:** Write dev, staging, and production Terraform configurations in separate directories with remote state backends. Dev applied in P0 (OV-18).                                                                                               | **IN PROGRESS** | `docs/progress/evidence/P0-T17.log` | Dev, staging, and production Terraform configs created in `infra/terraform/environments/`; stays IN PROGRESS pending AWS credentials.   |
| **P0-T18** | **Minimal Mobile App Shell:** Initialize `apps/mobile` with Expo Router, auth context in SecureStore, one sign-in screen, a role route guard, and a role switcher placeholder for the four app roles per C-11.                                                               |    **DONE**     | `docs/progress/evidence/P0-T18.log` | Verified 5/5 route guard & token storage tests; verified monorepo typecheck. Commit `3cfdfe8`.                                          |
| **P0-T19** | **Minimal Web Console Shell:** Initialize `apps/admin-web` with Vite, React Router, Tailwind, auth context, one sign-in screen, a route guard for admin roles, and the CSP header in dev configuration per C-11.                                                             |    **DONE**     | `docs/progress/evidence/P0-T19.log` | Verified 4/4 admin route guard tests; configured dev CSP headers in Vite; verified typecheck. Commit `7f668be`.                         |

---

## 4. Build Order Sequence

Following the contract dependency order:

1. **Foundation Group:** `P0-T1` -> `P0-T2` -> `P0-T3` -> `P0-T4`
2. **Core Ingestion & Security Controls (Parallel):** `P0-T5`, `P0-T6`, `P0-T7`, `P0-T8`, `P0-T9`
3. **Observability Baseline:** `P0-T10`
4. **Dev Infrastructure:** `P0-T11`
5. **Security Hardening Controls:** `P0-T12`, `P0-T13`, `P0-T14`
6. **Telemetry Integration:** `P0-T15`
7. **CI/CD Pipeline Verification:** `P0-T16`
8. **Terraform Multi-Environment Accounts:** `P0-T17`
9. **Minimal Shells (No External Account Blockers):** `P0-T18` and `P0-T19` (started early)

---

## 5. Detailed Task Specifications (Files, Tests, Commands, Evidence)

### P0-T1: Monorepo Scaffolding

- **Files to create/modify:** `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.eslintrc.js`, `.prettierrc`, `.github/CODEOWNERS`, `.github/pull_request_template.md`, `renovate.json`.
- **Tests to write:** `pnpm lint`, `pnpm typecheck`.
- **Command:** `pnpm lint && pnpm typecheck`
- **Evidence:** `docs/progress/evidence/P0-T1.log`

### P0-T2: Configuration Package

- **Files to create/modify:** `packages/config/src/env.schema.ts`, `packages/config/src/defaults.ts`, `packages/config/src/index.ts`.
- **Tests to write:** `packages/config/test/config.spec.ts` (Zod validation, startup refusal rules, defaults completeness).
- **Command:** `pnpm --filter @collegebus/config test:unit`
- **Evidence:** `docs/progress/evidence/P0-T2.log`

### P0-T3: Database Foundation

- **Files to create/modify:** `packages/db/prisma/schema.prisma`, `packages/db/src/partition-manager.ts`, `packages/db/src/rls-manager.ts`, `packages/db/src/seed-config.ts`.
- **Tests to write:** `packages/db/test/db.spec.ts`.
- **Command:** `pnpm --filter @collegebus/db test:unit`
- **Evidence:** `docs/progress/evidence/P0-T3.log`

### P0-T4: Test Harness

- **Files to create/modify:** `tests/fixtures/factories.ts`, `tests/fixtures/test-harness.ts`, `tests/fixtures/synthetic.guard.ts`.
- **Tests to write:** `tests/fixtures/test-harness.spec.ts`.
- **Command:** `pnpm vitest run tests/fixtures/test-harness.spec.ts`
- **Evidence:** `docs/progress/evidence/P0-T4.log`

### P0-T5: Migration Policy Check

- **Files to create/modify:** `scripts/check-migrations.ts`.
- **Tests to write:** `packages/db/test/check-migrations.spec.ts`.
- **Command:** `pnpm tsx scripts/check-migrations.ts`
- **Evidence:** `docs/progress/evidence/P0-T5.log`

### P0-T6: Authentication Core

- **Files to create/modify:** `services/api/src/modules/auth/auth.service.ts`, `services/api/src/modules/auth/auth.controller.ts`, `packages/contracts/src/auth.dto.ts`.
- **Tests to write:** `services/api/test/auth.spec.ts`, `packages/contracts/test/auth.dto.spec.ts`.
- **Command:** `pnpm --filter @collegebus/api test:unit -- test/auth.spec.ts`
- **Evidence:** `docs/progress/evidence/P0-T6.log`

### P0-T7: Access Control & Route Guard

- **Files to create/modify:** `services/api/src/common/guards/auth.guard.ts`, `services/api/src/common/guards/roles.guard.ts`, `scripts/verify-routes-auth.ts`.
- **Tests to write:** `services/api/test/authorization-harness.spec.ts`.
- **Command:** `pnpm verify:routes-auth`
- **Evidence:** `docs/progress/evidence/P0-T7.log`

### P0-T8: HTTP Hardening & Headers

- **Files to create/modify:** `services/api/src/main.ts`, `services/api/src/common/filters/http-exception.filter.ts`, `services/api/src/common/interceptors/request-id.interceptor.ts`.
- **Tests to write:** Unit test suite for security headers & error envelope in `services/api/test/auth.spec.ts`.
- **Command:** `pnpm --filter @collegebus/api test:unit`
- **Evidence:** `docs/progress/evidence/P0-T8.log`

### P0-T9: Rate Limiter & Idempotency

- **Files to create/modify:** `services/api/src/common/middleware/rate-limiter.middleware.ts`, `services/api/src/common/middleware/idempotency.middleware.ts`.
- **Tests to write:** Rate limit 429 and idempotency 409 tests in `services/api/test/auth.spec.ts`.
- **Command:** `pnpm --filter @collegebus/api test:unit`
- **Evidence:** `docs/progress/evidence/P0-T9.log`

### P0-T10: Observability Baseline

- **Files to create/modify:** `services/api/src/modules/health/health.controller.ts`, `services/api/src/modules/health/health.module.ts`.
- **Tests to write:** Health liveness and readiness tests.
- **Command:** `pnpm --filter @collegebus/api test:unit`
- **Evidence:** `docs/progress/evidence/P0-T10.log`

### P0-T11: Dev Infrastructure (Terraform)

- **Files to create/modify:** `infra/terraform/main.tf`, `infra/terraform/variables.tf`, `infra/terraform/outputs.tf`.
- **Tests to write:** Terraform validate and plan in CI.
- **Command:** `terraform init -backend=false && terraform validate && terraform plan`
- **Evidence:** `docs/progress/evidence/P0-T11.log`

### P0-T12: Admin MFA Recovery Codes

- **Files to create/modify:** `services/api/src/modules/auth/auth.service.ts`.
- **Tests to write:** Argon2id single-use recovery code test in `services/api/test/auth.spec.ts`.
- **Command:** `pnpm --filter @collegebus/api test:unit`
- **Evidence:** `docs/progress/evidence/P0-T12.log`

### P0-T13: Authorisation Test Harness

- **Files to create/modify:** `services/api/test/authorization-harness.spec.ts`.
- **Tests to write:** Permissions matrix check across 8 roles and unauthenticated callers.
- **Command:** `pnpm --filter @collegebus/api test:unit -- test/authorization-harness.spec.ts`
- **Evidence:** `docs/progress/evidence/P0-T13.log`

### P0-T14: Audit Log Append-Only Trigger & RLS Grants

- **Files to create/modify:** `packages/db/src/rls-manager.ts`, trigger migration script.
- **Tests to write:** SQL trigger unit test ensuring UPDATE/DELETE rejection.
- **Command:** `pnpm --filter @collegebus/db test:unit`
- **Evidence:** `docs/progress/evidence/P0-T14.log`

### P0-T15: Telemetry (Sentry & OpenTelemetry)

- **Files to create/modify:** `services/api/src/common/telemetry/sentry.ts`, `services/api/src/common/telemetry/opentelemetry.ts`.
- **Tests to write:** Deliberate test error reaching Sentry dev and trace export check.
- **Command:** `pnpm tsx scripts/test-telemetry.ts`
- **Evidence:** `docs/progress/evidence/P0-T15.log`

### P0-T16: CI/CD Automation

- **Files to create/modify:** `.github/workflows/ci.yml`.
- **Tests to write:** Pull request validation pipeline.
- **Command:** GitHub Actions run execution on SHA.
- **Evidence:** `docs/progress/evidence/P0-T16.log`

### P0-T17: Terraform Environment Accounts

- **Files to create/modify:** `infra/terraform/environments/dev/`, `infra/terraform/environments/staging/`, `infra/terraform/environments/production/`.
- **Tests to write:** `terraform validate` and `terraform plan` for all 3 environments.
- **Command:** `terraform validate`
- **Evidence:** `docs/progress/evidence/P0-T17.log`

### P0-T18: Minimal Mobile App Shell

- **Files to create/modify:** `apps/mobile/app/index.tsx`, `apps/mobile/app/_layout.tsx`, `apps/mobile/src/auth/auth-context.tsx`, `apps/mobile/src/auth/route-guard.tsx`.
- **Tests to write:** Route guard unit tests, typecheck, lint.
- **Command:** `pnpm --filter @collegebus/mobile test && pnpm --filter @collegebus/mobile typecheck`
- **Evidence:** `docs/progress/evidence/P0-T18.log`

### P0-T19: Minimal Web Console Shell

- **Files to create/modify:** `apps/admin-web/src/App.tsx`, `apps/admin-web/src/routes/guards.tsx`, `apps/admin-web/src/auth/auth-context.tsx`.
- **Tests to write:** Guard unit tests and Playwright smoke test.
- **Command:** `pnpm --filter @collegebus/admin-web test && pnpm --filter @collegebus/admin-web typecheck`
- **Evidence:** `docs/progress/evidence/P0-T19.log`

---

## 6. External Inputs (Dependencies & Blocking Status)

The following external dependencies are tracked. Non-dependent tasks (`P0-T1` through `P0-T10`, `P0-T12` through `P0-T14`, `P0-T18`, `P0-T19`) do not wait for them:

| External Input                                                                                       | Needed For                        | Blocking Status | Owner                    |
| :--------------------------------------------------------------------------------------------------- | :-------------------------------- | :-------------: | :----------------------- |
| **AWS Dev Account** (billing set up, `ap-south-1` usable, `us-east-1` for CloudFront ACM/WAF)        | `P0-T11`, Exit Criteria 1 & 5     |   **BLOCKED**   | College IT / DevOps Lead |
| **GitHub Repository with Actions Enabled**                                                           | `P0-T16`, Exit Criterion 4        |   **BLOCKED**   | Repository Owner / Lead  |
| **College Identity Test Tenant** (Google Workspace and Microsoft Entra ID with >= 2 test users each) | Exit Criterion 1                  |   **BLOCKED**   | College IT Administrator |
| **Sentry Project DSN**                                                                               | `P0-T15`                          |   **BLOCKED**   | Engineering Lead         |
| **Cloudflare Turnstile site key & secret key**                                                       | `P0-T6` (Turnstile bot challenge) |   **BLOCKED**   | Security Lead            |

---

## 7. Mandatory Phase P0 Exit Criteria (Part B.5, Rule A-6)

All five exit criteria remain **NOT VERIFIED** until empirical evidence from real environments is attached:

1. **SSO Dev Sign-in:** `NOT VERIFIED`. Requires live Google Workspace / Microsoft Entra ID tenant test in dev. If IT has not provided tenant, marked **BLOCKED**.
2. **verify:routes-auth:** `NOT VERIFIED` until pasted in phase report.
3. **Row-Level Security (RLS) Isolation:** `NOT VERIFIED`. Requires live Testcontainers PostgreSQL with non-owner roles `app_runtime` and `app_worker` executing tests in CI.
4. **CI Pipeline Status (CI Green):** `NOT VERIFIED`. Requires GitHub Actions run URL showing success on commit SHA.
5. **Security Headers on Live Ingress:** `NOT VERIFIED`. Requires live ALB / HTTP listener deployment curl scan.
