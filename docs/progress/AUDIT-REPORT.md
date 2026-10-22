# Step 0 Clean-Up Audit Report (Corrected per Review)

**Date:** 22 October 2026 | **Status:** Step 0 DONE | **Next Gate:** STOPPED — Awaiting Written Approval

### S0.1 Archival of Superseded Documents
- Premature/unverified reports archived in `docs/progress/archive/` with rationale headers.
- All active phase plans and reports reset to `IN PROGRESS` with unrun exit checks marked `NOT VERIFIED`.

### S0.2 Commit Audit & Disentanglement
- Mapped in `docs/progress/commit-audit.md`. P0 tasks linked to genuine commits `b598b27` through `7f668be`.
- Corrected P0 mapping: verified via `git show --stat 562e190` that commit `562e190` belongs strictly to `P1-T9`.
- Shared docs commit `441b4e5` disentangled to individual task commits.

### S0.3 Verified Counts & Reconciliations (Scripts in `scripts/audit/`)
- **Tables (`compare-tables.py`):** 56 Part 7 tables + 1 `push_tokens` (OV-15) = 57 contract tables. Reconciled as 55 Prisma models + 2 range-partitioned tables (`location_samples`, `device_heartbeats`). 0 extra, 0 missing.
- **Routes (`extract-routes.py`):** Discovered 30 routes from NestJS `@Controller` decorators with `/api/v1` prefix. Matches `verify-routes-auth` inventory 1:1 (0 diff).
- **Tests (Real Runner Totals):** **364 passed, 0 failed, 0 skipped** across 45 test files (mobile 149, API 62, domain 99, web 21, DB 10 [6 unit + 4 int], simulator 7, config 6, contracts 6, root 4).
- **Config Keys (`count-config.py`):** Contract baseline is 79 keys (Part 14.4 [75] + Part 20.17 [4]). Code has 127 keys. The 51 additional operational keys are mapped with section references in `docs/progress/extra-config-keys.md`.

### S0.4 Contract Conformance Audit (OV-1 to OV-19)
- Audited in `docs/progress/contract-audit.md`: 15 PASS, 4 FAIL.
- All PASS entries have exact file and line references (including OV-5 at `variables.tf:6-8` and OV-15 at `schema.prisma:1034`).
- `OV-8` & `OV-14` (`college_email_exception` / `exception_reason` missing in `users`) logged as a scheduled P0-T3 correction.
- `OV-9` (dual Google/Microsoft OIDC) logged as scheduled P0-T6 correction. `OV-12` logged as Conflict C-15.

### S0.5 Conflict Register & Governance Alignment
- Updated `docs/decisions/conflicts.md`:
  - `C-13` confirmed per Decision O3 with exact quote from `SW-MVP-1.0` F-AUTH-02 (p. 14): 10 consecutive failures lock account for 15 min.
  - `C-14` documents withdrawal of autonomous directive and reset of P0–P4 to `IN PROGRESS`.
  - `C-15` documents the 51 additional config keys required by `SW-MVP-1.0` and codified per Rule 1.6.

### Gate Status: STOPPED
All audit scripts moved to `scripts/audit/` and verified. Execution is STOPPED. No tasks or phase builds will start until formal approval.
