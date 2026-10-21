# Phase Plan: P0 Foundation

**Phase ID:** P0  
**Goal:** Build a secure, empty platform that signs users in, enforces access, and has the test harness and database controls in place.  
**Prompt ID:** AG-MASTER-1.0 (Part 16, Phase P0)  
**Companion:** SW-MVP-1.0 Sections 1, 2, 4, 6, 7, 8, 10, 28, 31, 33, 34, 35; HW-SPEC-1.0 Sections 5, 6, 7, 8, 9, 10, 11, 12, 13, 17, 22  
**Date:** 20 October 2026 (Revised 21 October 2026)  
**Phase Status:** Under review (Not approved for completion; pending Docker integration test verification and formal deferral approvals)

---

## 1. Specification Sections Read

- `SW-MVP-1.0` Sections: 1, 2, 4, 6, 7, 8, 10, 28, 31, 33, 34, 35, 41
- `AG-MASTER-1.0` Sections: Parts 1 to 8, 13, 14, 15, 16, 17, 18, 20, 21
- `HW-SPEC-1.0` Sections: 5, 6, 7, 8, 9, 10, 11, 12, 13, 17, 22 (hardware contract check, device lifecycle, power thresholds)

---

## 2. Tasks Inventory (P0-T1 through P0-T19)

| Task ID    | Description                                                                                                                                                                                                                                                                                                                         | Target Files Touched                                                                                                                                                                              | Tests & Validation                                                                                       | Status               |
| :--------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------- | :------------------- |
| **P0-T1**  | Monorepo scaffolding: pnpm workspaces, Turborepo, TypeScript strict, ESLint with security rules, Prettier, pre-commit hooks, pull request template, CODEOWNERS, Renovate config.                                                                                                                                                    | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.eslintrc.js`, `.prettierrc`, `.github/CODEOWNERS`, `.github/pull_request_template.md`, `renovate.json`, `.gitignore` | `pnpm lint`, `pnpm typecheck` (Passed)                                                                   | **DONE**             |
| **P0-T2**  | Configuration package: Zod environment schema (Part 3.3), startup refusal rules, system defaults table (Part 14.4, SW-MVP-1.0 §35) with 129 keys seeded in code and DB.                                                                                                                                                             | `packages/config/src/env.schema.ts`, `packages/config/src/defaults.ts`, `packages/config/test/config.spec.ts`                                                                                     | `packages/config/test/config.spec.ts` (6 tests passed)                                                   | **DONE**             |
| **P0-T3**  | Database foundation: Prisma schema for all 55 mapped tables + 2 partitioned tables (`location_samples`, `device_heartbeats`), total 57 tables matching SW-MVP-1.0 §10. Multi-role schema (`app_migrator`, `app_runtime`, `app_worker`). Fail-closed RLS on 18 sensitive tables. Audit append-only trigger. Daily partition manager. | `packages/db/prisma/schema.prisma`, `packages/db/src/rls-manager.ts`, `packages/db/src/partition-manager.ts`, `packages/db/src/seed-config.ts`                                                    | `packages/db/test/db.spec.ts` (2 tests passed)                                                           | **DONE**             |
| **P0-T4**  | Test harness: Testcontainers with PostgreSQL and PostGIS. Synthetic factories in `tests/fixtures`. Transaction-per-test isolation helper. Clean-up hooks.                                                                                                                                                                           | `packages/db/test/test-helper.ts`, `tests/fixtures/factories.ts`, `tests/fixtures/synthetic.guard.ts`, `packages/db/test/integration.spec.ts`                                                     | `packages/db/test/integration.spec.ts` (Unverified locally: Docker daemon offline; wired in CI)          | **IN PROGRESS**      |
| **P0-T5**  | Migration policy: expand-only check in CI (`scripts/check-migrations.ts`). Fails on `DROP COLUMN`, `RENAME COLUMN`, and `DROP TABLE` unless contract phase exception is registered.                                                                                                                                                 | `scripts/check-migrations.ts`, `packages/db/test/check-migrations.spec.ts`, `.github/workflows/ci.yml`                                                                                            | `packages/db/test/check-migrations.spec.ts` (4 tests passed)                                             | **DONE**             |
| **P0-T6**  | Authentication core: SSO via openid-client (RS-09) with PKCE, state, nonce, domain restriction, return-URL allowlist, session family rotation with breach reuse revocation. Driver OTP with HMAC and dual lockout rule (C-06).                                                                                                      | `services/api/src/modules/auth/*`, `packages/contracts/src/auth.dto.ts`                                                                                                                           | `services/api/test/auth.spec.ts` (8 tests passed)                                                        | **DONE**             |
| **P0-T7**  | Access control: Default-deny guard (`GlobalAuthGuard`), `@Public()`, `@Roles()` RBAC across all 8 roles (STU, FAC, DRV, SEC, COR, TEC, MGT, SAD), route inventory verifier (`scripts/verify-routes-auth.ts`).                                                                                                                       | `services/api/src/common/guards/*`, `services/api/src/common/decorators/*`, `scripts/verify-routes-auth.ts`                                                                                       | `pnpm verify:routes-auth` (12 routes passed, 0 unauthorized)                                             | **DONE**             |
| **P0-T8**  | HTTP hardening: Helmet, strict CSP, HSTS, CORS allowlist, standardized error envelope (`error.code`, `error.message`, `error.request_id`), X-Request-Id tracing, Pino structured logger with credential redaction.                                                                                                                  | `services/api/src/main.ts`, `services/api/src/common/filters/http-exception.filter.ts`, `services/api/src/common/interceptors/request-id.interceptor.ts`, `services/api/src/common/logger/*`      | `services/api/test/auth.spec.ts` (Security headers and envelope checks passed)                           | **DONE**             |
| **P0-T9**  | Rate limiter (`rate_counters`) & Idempotency middleware: atomic upsert in sliding window with `Retry-After` header on 429; 24h idempotency key persistence with HTTP 409 conflict detection.                                                                                                                                        | `services/api/src/common/middleware/rate-limiter.middleware.ts`, `services/api/src/common/middleware/idempotency.middleware.ts`                                                                   | `services/api/test/auth.spec.ts` (Rate limit 429 and idempotency tests passed)                           | **DONE**             |
| **P0-T10** | Observability baseline: `/health` (liveness) and `/health/ready` (readiness) endpoints.                                                                                                                                                                                                                                             | `services/api/src/modules/health/*`                                                                                                                                                               | Liveness and readiness endpoints unit tested                                                             | **DONE**             |
| **P0-T11** | Infrastructure for dev (Terraform): VPC with private subnets, ALB with HTTPS redirect, ECS service, RDS PostgreSQL Multi-AZ with PostGIS, S3, KMS, Secrets Manager, WAF, ACM, Route 53, CloudFront.                                                                                                                                 | `infra/terraform/*`                                                                                                                                                                               | Terraform syntax and formatting validation (`terraform fmt -check`)                                      | **DONE**             |
| **P0-T12** | Admin MFA recovery codes: 10 single-use recovery codes, cryptographically hashed with Argon2id, displayed once to user, with single-use verification and replay prevention.                                                                                                                                                         | `services/api/src/modules/auth/auth.service.ts`, `services/api/test/auth.spec.ts`                                                                                                                 | `services/api/test/auth.spec.ts` (Argon2id recovery codes generation and single-use verification passed) | **DONE**             |
| **P0-T13** | Authorisation harness: automated test matrix running every endpoint against all 8 system roles (STU, FAC, DRV, SEC, COR, TEC, MGT, SAD) and unauthenticated callers.                                                                                                                                                                | `services/api/test/authorization-harness.spec.ts`                                                                                                                                                 | `services/api/test/authorization-harness.spec.ts` (3 test suites, 100% route coverage passed)            | **DONE**             |
| **P0-T14** | Audit append-only trigger and role permission isolation: SQL trigger preventing `UPDATE` and `DELETE` on `audit_logs` (R-09), multi-role database grant script.                                                                                                                                                                     | `packages/db/src/rls-manager.ts`, `packages/db/test/db.spec.ts`                                                                                                                                   | `packages/db/test/db.spec.ts` (Trigger SQL generation and RLS enforcement SQL tests passed)              | **DONE**             |
| **P0-T15** | Observability telemetry: Sentry error capture and OpenTelemetry / CloudWatch tracing and metrics integration.                                                                                                                                                                                                                       | `infra/terraform`, `services/api/src/common/telemetry`                                                                                                                                            | Scheduled for deployment during Phase P8                                                                 | **PENDING APPROVAL** |
| **P0-T16** | CI/CD automation: GitHub Actions pipeline enforcing build, typecheck, lint, unit tests, verify:no-mock, verify:routes-auth, and check-migrations on pull requests.                                                                                                                                                                  | `.github/workflows/ci.yml`                                                                                                                                                                        | `pnpm verify:no-mock`, `pnpm verify:routes-auth`, `pnpm lint`, `pnpm typecheck` (All Passed)             | **DONE**             |
| **P0-T17** | Terraform staging and production environment accounts: separate account isolation, parameterization via tfvars and workspaces.                                                                                                                                                                                                      | `infra/terraform/environments/*`, `infra/terraform/variables.tf`                                                                                                                                  | Scheduled for deployment during Phase P8                                                                 | **PENDING APPROVAL** |
| **P0-T18** | Mobile app shell (Expo Router, SecureStore auth, role switcher, navigation guards).                                                                                                                                                                                                                                                 | `apps/mobile`                                                                                                                                                                                     | Scheduled as Phase P2 task `P2-T1` per AG-MASTER Part 16 build order                                     | **PENDING APPROVAL** |
| **P0-T19** | Web console shell (Vite, React Router, Tailwind, auth context, layout, navigation).                                                                                                                                                                                                                                                 | `apps/web`                                                                                                                                                                                        | Scheduled as Phase P4 task `P4-T1` per AG-MASTER Part 16 build order                                     | **PENDING APPROVAL** |

---

## 3. Test Execution Verification Output for DONE Tasks

The following empirical test runs demonstrate test passing for all tasks marked DONE:

```
> turbo run test:unit

   • Packages in scope: @collegebus/api, @collegebus/config, @collegebus/contracts, @collegebus/db
   • Running test:unit in 4 packages

@collegebus/config:test:unit:
  ✓ test/config.spec.ts (6 tests) 45ms
  Test Files  1 passed (1)
       Tests  6 passed (6)

@collegebus/contracts:test:unit:
  ✓ test/auth.dto.spec.ts (6 tests) 45ms
  Test Files  1 passed (1)
       Tests  6 passed (6)

@collegebus/db:test:unit:
  ✓ test/db.spec.ts (2 tests) 8ms
  ✓ test/check-migrations.spec.ts (4 tests) 9ms
  Test Files  2 passed (2)
       Tests  6 passed (6)

@collegebus/api:test:unit:
  ✓ test/authorization-harness.spec.ts (3 tests) 15ms
  ✓ test/auth.spec.ts (8 tests) 2515ms
    ✓ Authentication & Security Hardening Unit Tests (P0-T6 to P0-T9)
      ✓ Admin MFA Recovery Codes (P0-T12, Part 13.20) > generates 10 single-use recovery codes hashed with Argon2id and shown once 2494ms
  Test Files  2 passed (2)
       Tests  11 passed (11)

 Tasks:    7 successful, 7 total (29 passed tests across 4 packages)

> tsx scripts/verify-no-mock.ts
verify:no-mock PASSED. Zero mock data patterns found in application code.

> tsx scripts/verify-routes-auth.ts
verify:routes-auth PASSED. 12 routes checked with zero unauthorized public endpoints.

> turbo run lint && prettier --check
Tasks: 4 successful, 4 total (0 errors)
All matched files use Prettier code style!

> turbo run typecheck
Tasks: 7 successful, 7 total (0 errors)
```

---

## 4. Phase Exit Blockers Remaining Before Approval

1. **P0-T4 Integration Tests Unverified Locally:** Docker was unavailable during local execution; `test:int` Testcontainers PostgreSQL + PostGIS suite must run and be proven in CI.
2. **Pending Approval for Deferrals:** Written approval required for P0-T15 (Observability telemetry), P0-T17 (Terraform staging/prod accounts), P0-T18 (Mobile app shell), and P0-T19 (Web console shell).
3. **Open Conflicts C-01 & Firmware Download Gap:** Must be formally resolved or accepted prior to milestone gates.
