# Step 0 Counts Audit (AG-MVP-GUIDE-1.0 S0.3)

Generated via automated verification script `scratch/run_all_counts.py`.

## 1. Verified Counts Table

| Metric | Measured Count | Contract Baseline Reference | Status / Reconciliation |
|---|---|---|---|
| **Contract Configuration Keys** | 79 | AG-MASTER-FINAL-1.0 Part 14.4 (75) + Part 20.17 (4) | Baseline defined in master contract |
| **Seeded Configuration Keys** | 127 | `packages/config/src/defaults.ts` | 48 additional keys from `SW-MVP-1.0 §35` (recorded in `conflicts.md`) |
| **Prisma Models** | 55 | `packages/db/prisma/schema.prisma` | Matches all schema entities |
| **Partitioned Tables** | 2 | `location_samples`, `device_heartbeats` | Verified range partitioning |
| **Total Physical Tables** | 55 | PostgreSQL mapped tables via Prisma (`@@map`) | Matches 55 Prisma models |
| **API Routes** | 30 | `scripts/verify-routes-auth.ts` inventory | Verified against role-auth matrix |
| **Mobile Tests** | 149 | `apps/mobile/test/**/*.spec.ts` (17 files) | 100% passing |
| **Web Tests** | 21 | `apps/admin-web/test/**/*.spec.ts` (3 files) | 100% passing |
| **API Tests** | 62 | `services/api/test/**/*.spec.ts` (10 files) | 100% passing |
| **Domain Tests** | 99 | `packages/domain/test/**/*.spec.ts` (8 files) | 100% passing |
| **DB & Migration Tests** | 10 | `packages/db/test/**/*.spec.ts` (3 files) | 100% passing |
| **Config Tests** | 7 | `packages/config/test/**/*.spec.ts` (1 file) | 100% passing |
| **Contracts Tests** | 6 | `packages/contracts/test/**/*.spec.ts` (1 file) | 100% passing |
| **Simulator Tests** | 7 | `tools/simulator/test/**/*.spec.ts` (1 file) | 100% passing |
| **Root Tests** | 4 | `tests/fixtures/test-harness.spec.ts` (1 file) | 100% passing |
| **Total Test Suite Count** | 365 | Across all monorepo packages | All passing locally |

## 2. Reconciliation Notes

1. **Config Keys Mismatch (127 in code vs 79 in contract):**
   - Part 14.4 defines 75 keys; Part 20.17 adds 4 keys (`ops.peak_windows`, `sos.message_max_chars`, `firmware.url_ttl_s`, `sos.security_office_phone`).
   - `defaults.ts` contains 127 keys imported from `SW-MVP-1.0 §35` (e.g., granular rate limits, retention periods, session parameters, QR timing).
   - Per OV-12, extra keys require recording in `docs/decisions/defaults-used.md` and resolution under Conflict `C-15` in `docs/decisions/conflicts.md`.

2. **Table Set:**
   - 55 physical tables mapped in Prisma. Per OV-15, `push_tokens` is the only added table; `recovery_codes` and `outbox` are standard Part 7 tables.
