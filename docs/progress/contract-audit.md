# Contract Conformance Audit: Overrides OV-1 to OV-19

**Standard:** `AGENTS.md` Part C Overrides  
**Auditor:** Antigravity Engineering Agent  
**Date:** 22 October 2026

| Ref | Contract Requirement Summary | Verified File & Line Number | Evidence & Findings | Status |
|---|---|---|---|:---:|
| **OV-1** | Ingestion CONFLICT returns HTTP 200 with per-sample `{ reason: 'CONFLICT' }`. HTTP 409 reserved for `IDEMPOTENCY_CONFLICT`. | `services/api/src/modules/telemetry/telemetry.service.ts:115-116`<br>`services/api/src/modules/driver/driver.service.ts:316-319`<br>`services/api/src/common/middleware/idempotency.middleware.ts:45-46` | Duplicate conflicting GPS sequence returns HTTP 200 array with `{ seq, reason: 'CONFLICT' }`. HTTP 409 is thrown strictly on header key collision. | **PASS** |
| **OV-2** | Pipeline Stage S7: replace "Different content: CONFLICT" with per-sample rejection inside 200 response (OV-1). | `services/api/src/modules/telemetry/telemetry.service.ts:115`<br>`services/api/test/telemetry-pipeline.spec.ts:159-183` | Divergent duplicate coordinates verified returning 200 with rejection reason `CONFLICT`. | **PASS** |
| **OV-3** | Phase P0 task list replaced with Part B.5 (P0-T1 to P0-T19). | `docs/progress/P0-plan.md:18-36` | Plan includes all 19 tasks from Part B.5. | **PASS** |
| **OV-4** | P2-T1 extends P0-T18 mobile shell; P4-T1 extends P0-T19 web shell. Neither creates a new shell. | `apps/mobile/app/_layout.tsx:1-45`<br>`apps/admin-web/src/App.tsx:1-50` | Role routing and layout trees build upon foundation shells. | **PASS** |
| **OV-5** | AWS region is `ap-south-1` (L-5); CloudFront ACM certificate and WAF web ACL in `us-east-1`. | `infra/terraform/variables.tf:6-8`<br>`docs/decisions/aws-region.md:1-25` | Region variable defaults to `ap-south-1`. Global edge resources mapped to `us-east-1`. | **PASS** |
| **OV-6** | RS-19 global constraints recorded as constraints, not missing services. | `docs/decisions/aws-region.md:14-25` | RS-19 confirms all services present in `ap-south-1` with global constraints noted. | **PASS** |
| **OV-7** | RS-06 SMS research remains INCOMPLETE until SMS provider confirmed. | `docs/decisions/sms.md:8-15` | SMS research marked INCOMPLETE awaiting provider confirmation (D-07). | **PASS** |
| **OV-8** | Add `college_email_exception` (boolean, default false) and `exception_reason` (text) to `users` table. | `packages/db/prisma/schema.prisma:26-38` | Fields missing in Prisma schema. Logged as P0-T3 correction, scheduled but not yet done. | **FAIL** |
| **OV-9** | Dual OIDC: discrete Google Workspace and Microsoft Entra ID configs, chosen at runtime. | `packages/config/src/env.schema.ts:51-54` | Config schema defines generic `OIDC_*` set. Logged as P0-T6 correction, scheduled but not yet done. | **FAIL** |
| **OV-10** | Allowed coverage statuses: "built and passing", "missing", "BLOCKED with owner". "deferred" prohibited. | `docs/progress/P0-plan.md:18-36` | Zero occurrences of "deferred" across plans and reports. | **PASS** |
| **OV-11** | Definition of Done superseded by Part A (Rules A-5 to A-7). | `AGENTS.md:162, 221`<br>`docs/progress/commit-audit.md:1-100` | Evidence standards enforced. | **PASS** |
| **OV-12** | Settings keys are exactly Part 14.4 + Part 20.17 (79 keys). Code contains no other keys without recorded decision. | `packages/config/src/defaults.ts:1-192`<br>`scripts/audit/count-config.py:1-45` | Code contains 127 keys (51 additional). Documented in `extra-config-keys.md` under C-15, awaiting owner sign-off. | **FAIL** |
| **OV-13** | Part 21.2 conflict register replaced by Part B.2 (C-01 to C-15). | `docs/decisions/conflicts.md:1-25` | Centralized conflict register maintained. | **PASS** |
| **OV-14** | Storage additions must include `users.college_email_exception` and `users.exception_reason`. | `packages/db/prisma/schema.prisma:26-38` | Storage addition pending. Logged as P0-T3 correction, scheduled but not yet done. | **FAIL** |
| **OV-15** | Only added table is `push_tokens`. `recovery_codes` and `outbox` are Part 7 tables. | `packages/db/prisma/schema.prisma:1034`<br>`scripts/audit/compare-tables.py:1-35` | 56 contract tables + 1 `push_tokens` = 57 physical tables reconciled. | **PASS** |
| **OV-16** | P0 exit criteria: checks listed as NOT VERIFIED are not DONE. | `docs/progress/P0-report.md:42-49` | Exits 1, 3, 4, 5 correctly marked NOT VERIFIED. | **PASS** |
| **OV-17** | Phase reports must give commit SHAs, command outputs for DONE claims, NOT VERIFIED list, key/table counts, research dates. | `docs/progress/P0-report.md:1-85` | Required sections fully structured. | **PASS** |
| **OV-18** | Dev Terraform applied in P0-T11, Staging in P7, Production in P9-T6. | `docs/progress/P0-plan.md:31`<br>`infra/terraform/environments/` | Environments structured; apply lifecycle scheduled per contract. | **PASS** |
| **OV-19** | P0-T18 and P0-T19 are minimal shells; full screens built in P2 and P4. | `apps/mobile/app/`<br>`apps/admin-web/src/` | Minimal route guards and shell structures implemented. | **PASS** |

### Summary
- **Passing Overrides:** 15 / 19 (78.9%)
- **Failing Overrides:** 4 / 19 (OV-8, OV-9, OV-12, OV-14)
- **Action Plan:**
  - `OV-8` & `OV-14`: Scheduled as P0-T3 correction (Prisma migration to add `college_email_exception` and `exception_reason`).
  - `OV-9`: Scheduled as P0-T6 correction (add `GOOGLE_OIDC_*` and `AZURE_OIDC_*` to `env.schema.ts`).
  - `OV-12`: 51 extra keys fully documented in `docs/progress/extra-config-keys.md` under C-15, awaiting owner confirmation.
