# Phase Plan: P0 Foundation

**Phase ID:** P0  
**Goal:** Build a secure, empty platform that signs users in, enforces access, and has the test harness and database controls in place.  
**Prompt ID:** AG-MASTER-1.0 (Part 16, Phase P0)  
**Companion:** SW-MVP-1.0 Sections 1, 2, 4, 6, 7, 8, 10, 28, 31, 33, 34, 35  
**Date:** 20 October 2026  

---

## Specification Sections Read
- `SW-MVP-1.0` Sections: 1, 2, 4, 6, 7, 8, 10, 28, 31, 33, 34, 35
- `AG-MASTER-1.0` Sections: Parts 1, 2, 3, 5, 6, 7, 8, 13, 14, 15, 16, 20, 21

---

## Tasks Inventory

| Task ID | Description | Target Files Touched | Tests & Validation |
|---|---|---|---|
| **P0-T1** | Monorepo scaffolding: pnpm workspaces, Turborepo, TypeScript strict, ESLint with security rules, Prettier, pre-commit hooks, pull request template, CODEOWNERS, Renovate config. | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.eslintrc.js`, `.prettierrc`, `.github/CODEOWNERS`, `.github/pull_request_template.md`, `renovate.json`, `.gitignore` | `pnpm lint`, `pnpm typecheck` |
| **P0-T2** | Configuration package: Zod environment schema (Part 3.3), startup refusal rules, system defaults table (Part 14.4) as code and seed. | `packages/config/package.json`, `packages/config/src/index.ts`, `packages/config/src/env.schema.ts`, `packages/config/src/defaults.ts` | Vitest unit tests in `packages/config` validating schema rules, invalid env rejection, and placeholder bans |
| **P0-T3** | Database: Prisma schema for every table in Part 7 + `push_tokens`. Multi-role migrations (`app_migrator`, `app_runtime`, `app_worker`). RLS enablement and fail-closed policies. Audit append-only trigger. Daily partitions for `location_samples` & `device_heartbeats`. | `packages/db/package.json`, `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/*`, `packages/db/src/index.ts`, `packages/db/src/partition-manager.ts` | Migration tests, RLS isolation tests, audit append-only tests |
| **P0-T4** | Test harness: Testcontainers with PostgreSQL and PostGIS. Synthetic factories in `tests/fixtures`. Transaction-per-test isolation helper. Clean-up hooks. | `packages/db/test/test-helper.ts`, `tests/fixtures/factories.ts`, `tests/fixtures/synthetic.guard.ts` | Test harness connectivity test, synthetic flag enforcement test |
| **P0-T5** | Migration policy: expand-only check in CI. A migration that drops or renames a column or table fails unless recorded in contract phase. | `scripts/check-migrations.ts`, `.github/workflows/ci.yml` | Negative test checking migration script fails on `DROP COLUMN` or `ALTER TABLE ... RENAME` |
| **P0-T6** | Authentication core: SSO via openid-client (RS-09) with PKCE, state, nonce, domain restriction, return-URL allowlist, session family rotation. Driver OTP: HMAC storage, single use, attempt limits, lockout, Turnstile integration. | `services/api/src/modules/auth/*`, `packages/contracts/src/auth.dto.ts` | `T-AUTH-01` (10 OTP attempts lock account), `T-AUTH-03` (refresh token reuse revokes family), `T-AUTH-04` (PKCE/state mismatch), `T-AUTH-05` (generic error messages) |
| **P0-T7** | Access control: Default-deny guard, `@Public()`, `@Roles()`, scope decorators, and route inventory with `verify:routes-auth`. | `services/api/src/common/guards/*`, `services/api/src/common/decorators/*`, `scripts/verify-routes-auth.ts` | `npm run verify:routes-auth`, `T-SEC-01` partial for auth endpoints |
| **P0-T8** | HTTP hardening: Helmet, security headers (Part 13.18), CORS allowlist, standardized error envelope, request ID propagation, Pino structured logger with redaction, Sentry, OpenAPI JSON protection. | `services/api/src/main.ts`, `services/api/src/common/filters/http-exception.filter.ts`, `services/api/src/common/interceptors/request-id.interceptor.ts`, `services/api/src/common/logger/*` | Automated security header verification test, logger redaction test |
| **P0-T9** | Rate limiter (`rate_counters`) & Idempotency middleware: atomic upsert in sliding window; 24h idempotency key persistence. | `services/api/src/common/middleware/rate-limiter.middleware.ts`, `services/api/src/common/middleware/idempotency.middleware.ts` | `T-SEC-04` (rate limits return 429), Idempotency duplicate and conflict test |
| **P0-T10** | Observability baseline: health endpoints (`/health`, `/health/ready`), Prometheus metrics, OpenTelemetry tracing setup, external probe configs. | `services/api/src/modules/health/*`, `services/api/src/common/telemetry/*` | Liveness and readiness endpoint verification tests |
| **P0-T11** | Infrastructure for dev (Terraform): VPC with private subnets, ALB with HTTPS redirect, ECS service, RDS PostgreSQL Multi-AZ with PostGIS, S3, KMS, Secrets Manager, WAF, ACM, Route 53, CloudFront. | `infra/terraform/*` | Terraform validation and linting (`tflint`, `terraform validate`) |

---

## Phase Exit Criteria
1. SSO sign-in works in dev.
2. `verify:routes-auth` passes.
3. RLS tests pass (Part 13.1).
4. CI is green (all unit and integration tests passing).
5. Security headers test passes on the API host.
