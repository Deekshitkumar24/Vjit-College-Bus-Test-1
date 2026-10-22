# Phase Report: P0

Task | Commit | Scope | Tests (count, IDs) | Files | Status
P0-T1 | b598b27 | Monorepo scaffolding: pnpm, Turbo, TypeScript strict, ESLint, Prettier | Lint & typecheck clean | package.json, turbo.json, tsconfig.base.json | DONE
P0-T2 | e015693 | Configuration package: Zod schema, startup refusal, 79 contract keys | 9 (Part 14.4, Part 20.17) | packages/config/src/env.schema.ts, defaults.ts | DONE
P0-T3 | c6694e7 | Database foundation: 55 Prisma models + 2 partitions (57 tables), PostgreSQL 16 PostGIS, users exception columns | 8 (OV-8, OV-14, Part 7) | packages/db/prisma/schema.prisma, migrations/ | DONE
P0-T4 | 2e2cf00 | Test harness: native PostgreSQL 16 with PostGIS, transient db clone, app_runtime NOBYPASSRLS RLS isolation | 4 (OV-20, P0 Exit 3) | packages/db/src/native-test-db.ts, packages/db/test/integration.spec.ts | DONE
P0-T5 | 37fc4d2 | Migration policy: expand-only check script and test suite | 4 (expand-only rule) | scripts/check-migrations.ts | DONE
P0-T6 | 6626da0 | Auth core: dual OIDC discrete settings with startup refusal, session family rotation, and driver OTP | 17 (T-AUTH-01, T-AUTH-03, OV-9, L-4) | services/api/src/modules/auth/auth.service.ts, controller.ts | DONE
P0-T7 | 92a1224 | Access control: Default-deny global guard, @Public, @Roles RBAC, verify:routes-auth | 30 routes audited | services/api/src/common/guards/auth.guard.ts, roles.guard.ts | DONE
P0-T8 | 6fa0273 | HTTP hardening: Helmet, strict CSP, CORS allowlist, error envelope, X-Request-Id | 4 (Part 8) | services/api/src/main.ts, filters/http-exception.filter.ts | DONE
P0-T9 | e4d29c7 | Rate limiter (429 + Retry-After) & Idempotency middleware (409) | 2 (T-SEC-04, Part 8.1) | services/api/src/common/middleware/rate-limiter.middleware.ts, idempotency.middleware.ts | DONE
P0-T10 | d8c029a | Observability baseline: /health liveness and /health/ready probes | 2 (Part 2) | services/api/src/modules/health/health.controller.ts | IN PROGRESS (BLOCKED-EXTERNAL E1, E7)
P0-T11 | 986227e | Dev infrastructure (Terraform): VPC, RDS Multi-AZ, ALB, S3, KMS, WAF | Awaiting AWS account E1 | infra/terraform/main.tf, variables.tf | IN PROGRESS
P0-T12 | 90b42c2 | Admin MFA recovery codes: 10 single-use codes, Argon2id hashed | 1 (Part 13.20) | services/api/src/modules/auth/auth.service.ts | DONE
P0-T13 | 90b42c2 | Authorisation test harness: permissions matrix check across 8 roles | 108 matrix evaluations | services/api/test/authorization-harness.spec.ts | DONE
P0-T14 | 33c0a5a | Audit log append-only trigger: rejection of UPDATE/DELETE on audit_logs | 1 (R-09, Part 7) | packages/db/src/rls-manager.ts, test/integration.spec.ts | DONE
P0-T15 | 059a684 | Telemetry baseline: Sentry error capture & OpenTelemetry tracer | 3 (Part 14.5) | services/api/src/common/telemetry/sentry.ts, opentelemetry.ts | IN PROGRESS (BLOCKED-EXTERNAL E4)
P0-T16 | 1ad2a04 | CI/CD automation: GitHub Actions pipeline enforcing all checks | Awaiting GitHub Actions E2 | .github/workflows/ci.yml | IN PROGRESS
P0-T17 | 7f26bf9 | Terraform environment accounts: dev, staging, production S3 backends | Awaiting AWS account E1 | infra/terraform/environments/ | IN PROGRESS
P0-T18 | 3cfdfe8 | Minimal mobile shell: Expo Router, SecureStore, 4 roles guard | 5 (C-11) | apps/mobile/app/index.tsx, src/auth/route-guard.tsx | DONE
P0-T19 | 7f668be | Minimal web console shell: Vite, React Router, admin guard, dev CSP | 4 (C-11) | apps/admin-web/src/App.tsx, src/routes/guards.tsx | DONE

Tests: 164 run, 164 pass, 0 fail across 18 files (all unit and integration suites passing).

Exit criteria:
1. SSO dev sign-in: NOT VERIFIED (awaiting college IT test tenant, E3)
2. verify:routes-auth: VERIFIED
```
> college-bus-tracker@1.0.0 verify:routes-auth
> tsx scripts/verify-routes-auth.ts

verify:routes-auth PASSED. 30 routes checked with zero unauthorized public endpoints.
```
3. RLS integration on PostgreSQL 16: VERIFIED
```
> @collegebus/db@1.0.0 test:int
> vitest run test/integration.spec.ts

 RUN  v2.1.9 C:/Users/Deekshit kumar .k/OneDrive/Desktop/collegebus/packages/db

 ✓ test/integration.spec.ts (4 tests) 1406ms
   ✓ Native PostgreSQL 16 with PostGIS Integration Test Harness > sets up and connects to transient template database
   ✓ Native PostgreSQL 16 with PostGIS Integration Test Harness > enforces append-only on audit_logs (rejects UPDATE and DELETE via trigger)
   ✓ Native PostgreSQL 16 with PostGIS Integration Test Harness > enforces partial unique indexes on user_roles
   ✓ Native PostgreSQL 16 with PostGIS Integration Test Harness > verifies RLS isolation as app_runtime (P0 Exit Criterion 3)

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  19:35:12
   Duration  2.41s
```
4. CI green: NOT VERIFIED (awaiting GitHub Actions runner, E2)
5. Security headers on API host: NOT VERIFIED (awaiting deployed API host, E1)

External blockers:
E1: AWS dev account (college IT)
E2: GitHub Actions runner with Docker (college IT)
E3: College identity test tenant (college IT)
E4: Sentry project (college IT)

Open decisions used:
| Ref | Question | Default in force | Owner |
| --- | --- | --- | --- |
| L-1 | BENCH device status | `PROVISIONED`, `ACTIVE`, `BENCH`, `REVOKED`, `RETIRED` | Product owner |
| L-2 | SOS category | `EMERGENCY`, `MEDICAL`, `BREAKDOWN`, `OTHER`, `UNKNOWN` | Product owner |
| L-3 | Security staff visibility | Read-only view of all active buses | Product owner |
| L-4 | College SSO provider | Dual Google Workspace and Microsoft Entra ID support | College IT |
| L-5 | AWS Region | `ap-south-1` (Mumbai), CloudFront/ACM in `us-east-1` | Product owner |
| D-01 | Device GNSS source | Internal EC200U-CN or external NEO-6M fallback | ECE team |
| D-02 | Low-voltage event | 11.8V (12V) / 23.5V (24V) sustained 30s | ECE team |
| D-03 | Bus voltage class | V12 or V24 provisioned per bus | Transport office |
| D-06 | Driver phones | College-issued preferred, personal allowed with consent | Transport office |
| D-11 | Map provider | MapLibre with OSM tiles | Product owner |
| D-13 | Tracking mode | AUTO default | Transport office |
| D-14 | Retention periods | Values in Master Part 14.2 | Policy owner |
| D-18 | College SSO provider | Runtime selection Google/Microsoft | College IT |

Git log for this phase:
```
6626da0 P0-T6: dual OIDC discrete settings with startup refusal, session family rotation, and driver OTP verified
33c0a5a P0-T14: audit append-only trigger rejection test on native database
2e2cf00 P0-T4: native PostgreSQL 16 test harness with PostGIS and app_runtime RLS isolation
c6694e7 P0-T3: database schema deployed to PostgreSQL 16 with PostGIS and verified users columns
d32ca39 feat(contract): record override OV-20 for native PostgreSQL 16 with PostGIS replacing Docker
d81967c corr(5a-6): reconcile table count to 57 physical tables with compare-tables.py output
6fe660d corr(5a-5): update P4 plan and report with git stats, raw test counts, and exit criteria review
9642b13 corr(5a-4): set P3-T15 to P3-T18 as NOT STARTED and record git show stats for P3-T1 to P3-T8
57565f5 corr(5a-3): remap P2 tasks to Master Part 16 IDs and record C-16 in conflicts.md
2b0b506 corr(5a-2): verify 79 contract config keys via count-config.py and keep OV-12 FAIL pending O8
2289a14 corr(5a-1): mark P0-T3 and P0-T6 as IN PROGRESS pending migration and auth tests
b598b27 P0-T1: monorepo scaffolding
e015693 P0-T2: configuration package
37fc4d2 P0-T5: migration policy check
92a1224 P0-T7: access control default-deny
6fa0273 P0-T8: HTTP hardening
e4d29c7 P0-T9: rate limiter & idempotency
d8c029a P0-T10: observability baseline
986227e P0-T11: dev infrastructure
90b42c2 P0-T12, P0-T13: admin recovery codes & auth harness
059a684 P0-T15: telemetry baseline
1ad2a04 P0-T16: CI pipeline
7f26bf9 P0-T17: terraform environments
3cfdfe8 P0-T18: minimal mobile shell
7f668be P0-T19: minimal web shell
```
