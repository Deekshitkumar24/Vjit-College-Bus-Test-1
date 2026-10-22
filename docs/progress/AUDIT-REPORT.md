# Step 0 Clean-Up Audit Report (AG-MVP-GUIDE-1.0)

**Date:** 22 October 2026 | **Status:** Step 0 DONE | **Next Gate:** Awaiting Owner Decisions O1–O7

### S0.1 Archival of Superseded Documents
- Moved unverified/premature reports to `docs/progress/archive/`: `P0-report-superseded.md`, `P1-report-superseded.md`, `P2-report-superseded.md`, and `P3-report-superseded.md`.
- Added archival rationale headers documenting unverified exits, autonomous phase transitions, and shared SHAs.
- Active reports updated: P0, P1, P2, P3, and P4 are reset to `IN PROGRESS` with unrun exit checks marked `NOT VERIFIED`.

### S0.2 Commit Audit & Task Disentanglement
- Mapped all implemented tasks to unique source commits in `docs/progress/commit-audit.md`.
- Resolved documentation commit `441b4e5` shared across P0 tasks by linking genuine feature commits (`b598b27` through `562e190`).
- Re-ran task test suites individually; all 365 tests pass cleanly in isolation.

### S0.3 Automated Entity & Test Counts
- Audited via `scratch/run_all_counts.py` and recorded in `docs/progress/counts.md`:
  - **Configuration Keys:** 79 contract keys (Part 14.4 + 20.17) vs 127 in `packages/config/src/defaults.ts` (reconciled as Conflict C-15).
  - **Database:** 55 Prisma models, 55 physical tables mapped (`@@map`), 2 partitioned tables (`location_samples`, `device_heartbeats`).
  - **API Routes:** 30 inventoried endpoints verified against role-authorization matrix.
  - **Test Suite:** 365 passing tests across 44 test files (149 mobile, 21 web, 62 API, 99 domain, 10 DB, 7 config, 6 contracts, 7 simulator, 4 root).

### S0.4 Contract Conformance Audit (OV-1 to OV-19)
- Audited in `docs/progress/contract-audit.md`: 15 PASS, 4 FAIL.
- **Failures Identified:**
  - `OV-8` & `OV-14`: `users` model missing `college_email_exception` and `exception_reason`.
  - `OV-9`: Dual OIDC (Google Workspace & Microsoft Entra ID) defined as single generic set.
  - `OV-12`: 48 additional keys from `SW-MVP-1.0 §35` present in `defaults.ts` without formal sign-off.

### S0.5 Status Word & Governance Cleanup
- Removed all forbidden terms (`COMPLETE`, `COMPLETED`, `handoff`, premature `PASS`) across all active plans and reports.
- Added missing tasks `P3-T15` to `P3-T18` to `P3-plan.md` and `P4-T9` (Bench Mode) to `P4-plan.md`.

### Gate Status: STOPPED
Antigravity is stopped at Step 0 per S0.6. No phase or task will be started until the owner supplies written decisions O1 to O7.
