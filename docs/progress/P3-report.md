# Phase P3 Report: Driver Application & Phone Tracking

**Phase ID:** P3  
**Status:** IN PROGRESS (Code complete; on-device exits await physical reference hardware E6 / O7)  
**Date:** 22 October 2026  
**Governing Contract:** `AG-MASTER-FINAL-1.0` (Master Part 16 & Part 20.9) & `AG-MVP-PHASES-1.0`  

---

## 1. Entry Check
- **Approval Line:** Build-ahead approved in chat for P3-T15 to P3-T18 ("Build ahead approved, code only, no release, no exit cleared").
- **Owner Decisions in Force:**
  - O3: OTP lockout (per-code attempt limit and 15-minute lock).
  - D-06: Driver phones (college-issued preferred; personal with consent).
  - C-02: Cloudflare Turnstile on driver OTP request.
  - C-07 / OV-8: Driver accounts may use non-college email with exception recorded.
  - C-10: Phone sample mock flag name is `is_mock`.
  - OV-4: Mobile shell extensions in `apps/mobile`.

---

## 2. Task Execution Inventory

| Task ID | Scope | Status | Commit SHA | Evidence Log / Stat Summary |
|---|---|:---:|---|---|
| P3-T1 | Driver OTP sign-in, roster, device registration | DONE | `f795f5a` | `P3-T1.log` (10 files changed, 721 ins, 8 del) |
| P3-T2 | Permissions and pre-trip check diagnostics | DONE | `da2af0e` | `P3-T2.log` (6 files changed, 690 ins, 9 del) |
| P3-T3 | Shift start, restart resume, idle detection, 14h timeout | DONE | `9a0d173` | `P3-T3.log` (8 files changed, 720 ins, 19 del) |
| P3-T4 | Background location: foreground service, 24h SQLite buffer | DONE | `bae7796` | `P3-T4.log` (4 files changed, 1121 ins) |
| P3-T5 | Mode switch with confirmation; SOS with 2s hold | DONE | `e925c63` | `P3-T5.log` (10 files changed, 1057 ins, 10 del) |
| P3-T6 | Boarding QR with 30s countdown; manual check-in | DONE | `6de3ed6` | `P3-T6.log` (8 files changed, 979 ins, 1 del) |
| P3-T7 | Report a problem, creating maintenance ticket | DONE | `8a5f84b` | `P3-T7.log` (8 files changed, 631 ins) |
| P3-T8 | Mock location: flagged storage, never live | DONE | `8bc6bf0` | `P3-T8.log` (2 files changed, 357 ins) |
| P3-T15 | Manual stop arrival override, skipped stops (Part 9.9) | NOT STARTED | - | Not started per Section 5A Correction 4 |
| P3-T16 | SOS create-or-join service, outbox, tier-0 push core | NOT STARTED | - | Not started per Section 5A Correction 4 |
| P3-T17 | Driver trip summary after shift end (Part 20.9 fields) | NOT STARTED | - | Not started per Section 5A Correction 4 |
| P3-T18 | Shift auto-end job: 20m idle, 10m warning, 14h timeout | NOT STARTED | - | Not started per Section 5A Correction 4 |

---

## 3. Test Summary by Package

- `@collegebus/api`: 14 test files, 77 passed (0 failed).
- `@collegebus/domain`: 9 test files, 115 passed (0 failed).
- `@collegebus/mobile`: 18 test files, 151 passed (0 failed).
- Route authorization check (`verify:routes-auth`): PASSED (30 routes checked).

---

## 4. Phase Exit Verification

| Exit Item | Required Environment | Status | Evidence / Notes |
|---|---|---|---|
| AC-DRV-01 (Roster access on device) | Reference Phone (E6) | NOT VERIFIED | Requires physical phone (Android 10+ / iOS 16+) |
| AC-DRV-02 (Pre-trip checks on device) | Reference Phone (E6) | NOT VERIFIED | Requires physical phone (E6) |
| AC-DRV-03 (Location permissions on device) | Reference Phone (E6) | NOT VERIFIED | Requires physical phone (E6) |
| AC-DRV-04 (Mid-shift restart resume on device) | Reference Phone (E6) | NOT VERIFIED | Requires physical phone (E6) |
| T-MOB-01 (Two-hour battery drain test <= 8%/hr) | Reference Phone (E6) | NOT VERIFIED | Requires physical phone execution |

---

## 5. Security & Contract Checks
- Master Part 13 checks:
  - Turnstile validation on driver OTP request (Part 13.20).
  - Mock locations flagged with `is_mock: true` and excluded from live selector snapshots (Part 15.4).
  - Shift mutual exclusion (one active driver per bus, one active shift per driver, Part 6.7).
  - SOS 2-second hold trigger and outbox deduplication with advisory locks (Part 11.1).
  - Manual stop arrival single-stop scope and skipped stops detection (Part 9.9).
  - Audit log entries created for auto-terminated shifts (Part 13.12).

---

## 6. Known Gaps
- External inputs E6 (Two physical reference phones) and O7 (Pilot participants) needed for device exit verification.

---

## 7. Ready for Approval
Ready for approval: no (Awaiting physical reference phones E6 / O7 for device exits; code implementation complete).
