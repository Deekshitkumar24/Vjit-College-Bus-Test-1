# Step 0 Contract Conformance Audit: OV-1 to OV-19 (AG-MVP-GUIDE-1.0 S0.4)

Generated against `AGENTS.md` Part C overrides. Each override is verified with exact file paths, line numbers, and status.

| Override | Requirement Summary | Target Location | Verification Details & Findings | Status |
|---|---|---|---|---|
| **OV-1** | Ingestion CONFLICT returns HTTP 200 with per-sample `{ reason: 'CONFLICT' }`. HTTP 409 reserved for `IDEMPOTENCY_CONFLICT`. | `services/api/src/modules/telemetry/telemetry.service.ts:115`<br>`services/api/src/modules/driver/driver.service.ts:316`<br>`services/api/src/common/middleware/idempotency.middleware.ts:46` | Per-sample duplicate conflicting samples return 200 with `{ seq, reason: 'CONFLICT' }`. HTTP 409 is emitted only for `IDEMPOTENCY_CONFLICT`. | **PASS** |
| **OV-2** | Step S7 replaces "Different content: CONFLICT" with per-sample rejection inside 200 response. | `services/api/src/modules/telemetry/telemetry.service.ts:115`<br>`services/api/test/telemetry-pipeline.spec.ts:159` | Telemetry pipeline handles divergent duplicate sequences within HTTP 200 response array. | **PASS** |
| **OV-3** | P0 task list replaced with Part B.5 (P0-T1 to P0-T19). | `docs/progress/P0-plan.md:18-36` | Plan matches Part B.5 with P0-T1 to P0-T19 explicitly defined. | **PASS** |
| **OV-4** | P2-T1 extends P0-T18 mobile shell; P4-T1 extends P0-T19 web shell. Neither creates a new shell. | `apps/mobile/app/_layout.tsx:1-45`<br>`apps/admin-web/src/App.tsx:1-50` | Mobile and Web shells build upon foundational shells established in P0. | **PASS** |
| **OV-5** | AWS region is `ap-south-1` (L-5); CloudFront ACM cert and WAF web ACL in `us-east-1`. | `infra/terraform/variables.tf:6`<br>`docs/decisions/aws-region.md:1-25` | Region variables set to `ap-south-1`; global edge resources mapped to `us-east-1`. | **PASS** |
| **OV-6** | RS-19 global constraints recorded as constraints, not missing services. | `docs/decisions/aws-region.md:14-25` | RS-19 confirms all services available in `ap-south-1` with global edge constraints noted. | **PASS** |
| **OV-7** | RS-06 SMS research remains INCOMPLETE until SMS provider confirmed. | `docs/decisions/sms.md:8-15` | SMS marked INCOMPLETE awaiting D-07 provider confirmation. | **PASS** |
| **OV-8** | Add `college_email_exception` (boolean, default false) and `exception_reason` (text) to `users` table. | `packages/db/prisma/schema.prisma:26-38` | Fields missing in `User` Prisma model. Must be added via schema migration. | **FAIL** |
| **OV-9** | Dual OIDC configuration: separate Google Workspace and Microsoft Entra ID sets, selected at runtime. | `packages/config/src/env.schema.ts:51-54` | Config schema currently defines single generic `OIDC_*` set instead of discrete Google & Entra ID sets. | **FAIL** |
| **OV-10** | Coverage statuses allowed: "built and passing", "missing", or "BLOCKED with owner". "deferred" prohibited. | `docs/progress/` governance | No "deferred" statuses used across plans or reports. | **PASS** |
| **OV-11** | Definition of done superseded by Part A (A-5 to A-7). | `AGENTS.md:162, 221`<br>`docs/progress/commit-audit.md` | Strict evidence requirements (commit SHA, command, pasted output, files) enforced. | **PASS** |
| **OV-12** | Settings keys are exactly Part 14.4 + Part 20.17 (79 keys). Code contains no other keys without recorded decision. | `packages/config/src/defaults.ts:1-192`<br>`docs/progress/counts.md:10-25` | Code contains 127 keys from SW-MVP-1.0 §35 (48 additional). Documented as Conflict C-15. | **FAIL** |
| **OV-13** | Part 21.2 conflict register replaced by Part B.2 (C-01 to C-12). | `docs/decisions/conflicts.md:1-25` | Conflicts C-01 through C-15 maintained in centralized register. | **PASS** |
| **OV-14** | Storage additions must include `users.college_email_exception` and `users.exception_reason`. | `packages/db/prisma/schema.prisma:26-38` | Blocked on OV-8 fix. | **FAIL** |
| **OV-15** | Only added table is `push_tokens`. `recovery_codes` and `outbox` are standard Part 7 tables. | `packages/db/prisma/schema.prisma:1034`<br>`docs/progress/counts.md:20` | Exactly 55 tables mapped in Prisma; `push_tokens` is the only addition. | **PASS** |
| **OV-16** | P0 exit criteria: checks listed as NOT VERIFIED are not DONE. | `docs/progress/P0-report.md:42-49` | Exits 1, 3, 4, 5 correctly marked NOT VERIFIED. | **PASS** |
| **OV-17** | Phase reports must provide commit SHAs, command outputs, NOT VERIFIED lists, key counts, table counts, research dates. | `docs/progress/P0-report.md:1-85` | Enforced in all updated reports. | **PASS** |
| **OV-18** | Dev Terraform applied in P0-T11, Staging in P7, Production in P9-T6. | `docs/progress/P0-plan.md:31`<br>`infra/terraform/environments/` | Environments structured; staging/prod applications correctly scheduled. | **PASS** |
| **OV-19** | P0-T18 and P0-T19 are minimal shells; full screens built in P2 and P4. | `apps/mobile/app/`<br>`apps/admin-web/src/` | Minimal route guards and shell structures implemented. | **PASS** |

## Summary of Audit Findings
- **Passing Overrides:** 15 / 19 (78.9%)
- **Failing Overrides:** 4 / 19 (OV-8, OV-9, OV-12, OV-14)
- **Remediation Required:**
  1. Add `college_email_exception` and `exception_reason` to `packages/db/prisma/schema.prisma` and generate migration (fixes OV-8 & OV-14).
  2. Update `packages/config/src/env.schema.ts` to support dual Google Workspace and Microsoft Entra ID OIDC configurations (fixes OV-9).
  3. Formalize the 48 additional keys in `docs/decisions/defaults-used.md` under Conflict C-15 or prune `defaults.ts` to strictly match the 79 contract keys (fixes OV-12).
