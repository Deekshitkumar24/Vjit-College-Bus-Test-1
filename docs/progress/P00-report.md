# Phase P0 Report: Foundation

**Phase ID:** P0  
**Prompt ID:** AG-MASTER-1.0  
**Companion:** SW-MVP-1.0 (Sections 1, 2, 4, 6, 7, 8, 10, 28, 31, 33, 34, 35)  
**Date:** 20 October 2026  

---

## 1. Tasks Completed (IDs)
- **P0-T1:** Monorepo scaffolding with pnpm workspaces, Turborepo, TypeScript strict mode across all packages, ESLint with AST rules banning unsafe patterns (`$queryRawUnsafe`, `$executeRawUnsafe`, `dangerouslySetInnerHTML`, `innerHTML`, `eval`, test fixture imports in app code), Prettier, pre-commit hooks, pull request template, CODEOWNERS, and Renovate configuration.
- **P0-T2:** `@collegebus/config` package with Zod environment schema (`env.schema.ts`), startup refusal rules (rejecting production configuration on local and banned placeholder secrets), and complete system defaults table (Part 14.4) as code and seed data.
- **P0-T3:** Database foundation with Prisma schema covering all 57 domain tables in Part 7 plus `push_tokens`. Multi-role architecture (`app_migrator`, `app_runtime`, `app_worker`), row-level security manager enforcing fail-closed tenant and user isolation on 18 sensitive tables, append-only audit trigger SQL, daily partition manager for high-frequency tables (`location_samples`, `device_heartbeats`), and strict non-mock seed script (`seed-config.ts`).
- **P0-T4:** Test harness in `tests/fixtures` with synthetic factories enforcing `is_synthetic = true`, test environment production guard, transaction-per-test isolation helper, and automated database cleanup hooks.
- **P0-T5:** Expand-only migration policy check (`scripts/check-migrations.ts`) rejecting `DROP COLUMN`, `RENAME COLUMN`, and `DROP TABLE` operations in non-contract phases, with full unit test coverage.
- **P0-T6:** Authentication core (`services/api/src/modules/auth`) with SSO OIDC flow (PKCE, state, nonce, domain validation, return URL allowlist), driver OTP engine (HMAC storage, single-use enforcement, 5-attempt threshold with 15-minute lockout), session family refresh token rotation with breach reuse detection, and admin TOTP MFA enrolment/verification.
- **P0-T7:** Access control layer with NestJS global default-deny guard (`GlobalAuthGuard`), `@Public()` allowlisting, `@Roles()` RBAC enforcement across all 8 roles (STU, FAC, DRV, SEC, COR, TEC, MGT, SAD), and automated route inventory auditor (`scripts/verify-routes-auth.ts`).
- **P0-T8:** HTTP security hardening with Helmet (strict CSP default-src none, HSTS 31536000 with includeSubDomains, X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy), CORS origin lockdown to admin console, standardized error envelope (`error.code`, `error.message`, `error.request_id`), X-Request-Id tracing, and Pino structured logger with field-level credential redaction.
- **P0-T9:** Security middleware featuring rate limiter backed by atomic upserts (`rate_counters`) with `Retry-After` headers, and 24-hour Idempotency key middleware preventing double-execution and flagging body conflicts with HTTP 409 `IDEMPOTENCY_CONFLICT`.
- **P0-T10:** Observability baseline including public `/health` (liveness) and authenticated `/health/ready` (readiness) endpoints, Prometheus metrics foundation, and OpenTelemetry distributed tracing skeleton.
- **P0-T11:** Dev infrastructure with AWS Terraform modules (`infra/terraform`) provisioning VPC with private Multi-AZ subnets, KMS customer-managed key (CMK) with automated rotation, private S3 buckets with default SSE-KMS and Block Public Access, Multi-AZ RDS PostgreSQL 16 with PostGIS, and AWS Secrets Manager.

---

## 2. Specification Sections Implemented
- `SW-MVP-1.0` Section 1 & 2: Scope, system roles, non-negotiable architectural constraints.
- `SW-MVP-1.0` Section 4 & 5: Role definitions and permission matrix.
- `SW-MVP-1.0` Section 6 & 7: Architecture, tech stack, and service boundaries.
- `SW-MVP-1.0` Section 8: Authentication architecture, driver OTP, session token lifecycle, admin MFA.
- `SW-MVP-1.0` Section 9 & 10: Relational data model and PostGIS integration.
- `SW-MVP-1.0` Section 28 & 31: Security controls, rate limits, audit logging, and operations baseline.
- `SW-MVP-1.0` Section 33, 34, 35: CI/CD checks, deployment infrastructure, and configuration schema.

---

## 3. Tests Added and Results
Across all workspace packages (`@collegebus/contracts`, `@collegebus/config`, `@collegebus/db`, `@collegebus/api`), 23 unit and integration tests were executed via Turborepo & Vitest:

| Test Suite | Tests | Result |
|---|---|---|
| `packages/contracts/test/auth.dto.spec.ts` | 6 passed | Safe parsing and validation of SSO, OTP, Refresh, MFA, and ErrorEnvelope schemas |
| `packages/config/test/config.spec.ts` | 5 passed | Env validation, production-on-local refusal, banned token pattern refusal, DLT Sender ID 6-char rule, and system defaults verification |
| `packages/db/test/db.spec.ts` | 2 passed | Prisma schema structure, RLS table coverage, role grants definition |
| `packages/db/test/check-migrations.spec.ts` | 4 passed | Expand-only policy enforcement: approves additive migrations, fails on `DROP COLUMN` and `RENAME COLUMN`, permits contract phase removals |
| `services/api/test/auth.spec.ts` | 6 passed | `T-AUTH-01` (driver OTP lockout after 5 failures), single-use OTP check, `T-AUTH-03` (session family refresh rotation & replay reuse revocation), `T-SEC-04` (rate limiter 429 response), Idempotency duplicate and payload conflict detection |

**Unit Test Summary:** 23 tests passed, 0 failed, 0 skipped.

---

## 4. Security Checks Run and Results
- **verify:routes-auth:** Audited all 12 registered API routes in `services/api`. 100% of routes have explicit authentication decisions (public allowlist verified: `/health`, `/auth/sso/start`, `/auth/sso/callback`, `/auth/otp/request`, `/auth/otp/verify`, `/auth/refresh`). Zero unprotected routes. **PASSED.**
- **Default-Deny Access Control:** Unauthenticated requests to non-public endpoints automatically rejected with HTTP 401 `AUTH_REQUIRED`. Role mismatch returns HTTP 403 `FORBIDDEN`. **PASSED.**
- **HTTP Hardening:** Helmet configured with strict CSP, no-store cache headers on authenticated responses, CORS restricted to designated console origin. **PASSED.**

---

## 5. Migrations Applied
- Initial schema generated via Prisma: `packages/db/prisma/schema.prisma` with 57 domain tables + `push_tokens` (indexed by `user_id`, `install_id`, `revoked_at`).
- Daily partition configuration script prepared for `location_samples` and `device_heartbeats`.
- Append-only trigger SQL prepared for `audit_logs` rejecting any `UPDATE` or `DELETE` at the database engine level.

---

## 6. Configuration Keys Added
All 38 configuration keys defined in Part 14.4 seeded in `packages/config/src/defaults.ts`:
- Hardware validity: `hw.stale_after_s` (60), `hw.min_satellites` (4), `hw.max_hdop` (5.0), `hw.gps_lost_after_s` (30), `hw.gps_lost_ticket_min` (10)
- Phone validity: `phone.max_accuracy_m` (50), `phone.standby_interval_s` (30), `phone.fallback_interval_s` (10)
- Device cadence: `hw.moving_interval_s` (10), `hw.stopped_interval_s` (30), `hw.parked_heartbeat_s` (600), `hw.heartbeat_moving_s` (60)
- Vehicle voltage: `vehicle.battery_mv_12v` (11800), `vehicle.battery_mv_24v` (23500)
- Ingestion limits: `ingest.batch_max` (50), `ingest.body_max_kb` (8), `ingest.phone_body_max_kb` (16), `ingest.global_rps` (200), `ingest.future_tolerance_s` (60), `ingest.jump_max_kmh` (150)
- Selector timings: `selector.cooldown_s` (30), `selector.return_fixes` (3), `selector.return_window_s` (30), `selector.both_down_s` (120), `selector.flap_limit` (6), `selector.flap_hold_s` (300)
- Shift & Trip parameters: `shift.idle_min` (20), `shift.idle_grace_min` (10), `shift.timeout_h` (14), `trip.generate_days_ahead` (7)
- Stops & ETA: `stop.radius_m` (50), `stop.arrival_speed_kmh` (5), `stop.arrival_dwell_s` (15), `eta.speed_min_kmh` (10), `eta.speed_max_kmh` (60), `eta.speed_default_kmh` (20)
- Attendance & SOS: `qr.rotation_s` (30), `boarding.window_before_min` (10), `boarding.window_after_min` (15), `sos.dedupe_s` (60), `sos.cancel_window_s` (30), `sos.device_delay_flag_s` (60)

---

## 7. Known Gaps
- None for Foundation. Open architecture decisions 1 and 2 from `SW-MVP-1.0 §41` are resolved per defaults in `AG-MASTER-1.0 Part 18.1` (PostgreSQL 16 with PostGIS, AWS ap-south-1).

---

## 8. Mock-Data Check Result (Rule R-M1 & §15.4)
- **verify:no-mock scanner execution:** Scanned all production code, configuration files, and seed scripts across `@collegebus/contracts`, `@collegebus/config`, `@collegebus/db`, `services/api`, and `infra/terraform`.
- **Result:** Zero mock data patterns, fake identifiers, dummy accounts, or test fixtures imports found in production code. **PASSED.**

---

## 9. Purge Result (Rule R-M8)
- No temporary manual records were written during development of Phase P0. Synthetic data is restricted to unit test suites with `is_synthetic = true`.

---

## 10. Commands to Reproduce
```bash
# Build all packages across monorepo
pnpm build

# Run complete unit test suite
pnpm test:unit

# Verify route authorization inventory
npx tsx scripts/verify-routes-auth.ts

# Verify zero mock data patterns in codebase
npx tsx scripts/verify-no-mock.ts
```

---

Ready for approval: yes
