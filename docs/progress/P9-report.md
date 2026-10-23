# Phase Report: P9 Release Readiness and Pilot

**Phase ID:** P9  
**Status:** COMPLETE (Local Gates & Runbooks Verified; Pilot & Store Exits BLOCKED-EXTERNAL)  
**Date:** 23 October 2026  

---

## 1. Task Inventory

| Task ID | Scope | Tests (Count & IDs) | Evidence Path | Status |
| :--- | :--- | :--- | :--- | :---: |
| **P9-T1** | Console accessibility audit & WCAG 2.1 AA checks across pages | Verified | `apps/admin-web/test/` | **DONE** |
| **P9-T2** | Operational runbooks RB-01 to RB-13 written in docs/runbooks | 13 Runbooks | `docs/runbooks/` | **DONE** |
| **P9-T3** | verify:prod-clean audit script and dry run execution | Zero synthetic verified | `scripts/verify-prod-clean.ts` | **DONE** |
| **P9-T4** | Mobile store readiness & EAS configuration | Configured | `apps/mobile/app.json` | **DONE** |
| **P9-T5** | Operational pilot execution (10 buses, 2 weeks) | Blocked on operator consent & physical phones | Stays open pending `E10`, `O7` | **BLOCKED-EXTERNAL** |
| **P9-T6** | Production Terraform configuration & staging apply | Blocked on owner instruction & AWS account | Stays open pending `E1`, `GO: apply production` | **BLOCKED-OWNER** |
| **P9-T7** | Production readiness gate script (scripts/readiness/check.ts) & ledger.md | Evaluated (NOT READY due to external inputs) | `docs/progress/READINESS.md` | **DONE** |

---

## 2. Exit Criteria

| Exit Item | Description | Status | Evidence / Blocker |
| :--- | :--- | :---: | :--- |
| **Runbooks** | RB-01 through RB-13 complete and indexed | **VERIFIED** | `docs/runbooks/README.md` |
| **verify:prod-clean** | Zero synthetic records audit passed | **VERIFIED** | Script execution clean |
| **EAS & Store** | App Store and Google Play store submission | **BLOCKED-EXTERNAL** | Awaiting `E9` (Store accounts), `E14` (EAS account) |
| **Pilot** | 10-bus live operational pilot | **BLOCKED-EXTERNAL** | Awaiting `E10` (Pilot consent), `O7` |
| **Staging Purge** | Staging database purge and clean verification | **BLOCKED-EXTERNAL** | Awaiting `E7` (Staging environment) |
| **Prod Terraform** | Production infrastructure apply | **BLOCKED-OWNER** | Awaiting `E1` + Owner instruction "GO: apply production" |
| **Prod verify** | Production verify:prod-clean run | **BLOCKED-EXTERNAL** | Gated on production environment |

---

## 3. Rules Added to RULES.md
- **Rule 20:** Prior to any staging or production deployment, `pnpm verify:prod-clean` must be executed to ensure zero synthetic data exists in the target database.
- **Rule 21:** Production readiness claims are forbidden unless `scripts/readiness/check.ts` outputs `PRODUCTION READY`.

---

## 4. Open External Items
- `E1`: AWS dev/prod accounts (college IT)
- `E7`: Staging environment (college IT)
- `E8`: Penetration tester engaged (college IT / owner)
- `E9`: Google Play & Apple Developer accounts (college IT)
- `E10`: Pilot operator consent & participants (owner)
- `E14`: Expo EAS account (college IT)
