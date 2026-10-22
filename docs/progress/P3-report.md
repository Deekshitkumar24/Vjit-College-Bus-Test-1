# Phase Report: P3 Driver Application & Phone Tracking

**Phase ID:** P3  
**Goal:** Production-grade Driver mobile client experience and phone tracking pipeline, including driver OTP sign-in, roster inspection, pre-trip hardware/permission diagnostic checks, shift lifecycle (start, resume, idle detection, 14h timeout, end), background location tracking with 24-hour buffer, tracking mode switcher, driver SOS emergency trigger, rotating boarding QR display, manual boarding check-in, problem reporting/ticketing, and mock-location detection.  
**Prompt Contract:** `AG-MASTER-FINAL-1.0` (Version 1.0, 21 October 2026)  
**Date:** 22 October 2026  
**Status:** IN PROGRESS (On-device exit criteria NOT VERIFIED; awaiting physical reference phone testing and written approval)

---

## 1. Executive Summary

Phase P3 has implemented the codebase tasks P3-T1 through P3-T8 for the Driver Application:

- **Driver OTP Sign-in & Roster List (P3-T1):** Integrated driver email OTP login flow with Cloudflare Turnstile token verification (C-02), 6-digit one-time code generation/verification, and strict roster isolation. Drivers only see and select buses actively assigned to them on the operational roster (`AC-DRV-01`); direct API access to unrostered buses returns `HTTP 403 FORBIDDEN`. Mobile device registration binds unique hardware UUID, platform model, and display label.
- **Pre-trip Diagnostics & Permission Checks (P3-T2):** Implemented the 8-stage pre-trip diagnostic engine in `@collegebus/domain` (`PreTripDiagnosticsEngine`). Validates driver session validity, assigned bus status, hardware tracker heartbeat freshness (< 120s), location permission (`Always` required on Android/iOS; blocks shift start per `AC-DRV-03` with step-by-step fix guides), notification permission, high-accuracy GPS fix (< 50m within 60s), network reachability, and battery level (> 15%). Emits `AC-DRV-02` warning banner and switches primary tracking source to phone fallback when hardware tracker status is RED.
- **Shift Lifecycle Management (P3-T3):** End-to-end driver shift state machine (`ShiftLifecycleManager`) enforcing atomic shift start, restart resume logic within 10 seconds without duplicate shift generation (`AC-DRV-04`), 20-minute stationary idle prompt with 10-minute grace period before `AUTO_IDLE` termination, 14-hour hard timeout (`TIMEOUT`), and strict shift-end block when open SOS emergencies remain active.
- **Background Location Tracking & 24h Buffer (P3-T4):** Developed `PhoneLocationCollector` utilizing persistent foreground notification service, dynamic adaptive cadence (10s moving / 30s stopped), and an offline SQLite database buffer holding up to 24 hours of telemetry samples (~8,640 records) with sequential FIFO batch flushing terminating on server `ack_seq`.
- **Mode Switcher & Driver SOS Trigger (P3-T5):** Built `ModeSwitcher` supporting Auto, Hardware, and Phone tracking overrides with mandatory 140-character explanatory notes; engineered 2-second hold emergency SOS trigger button (`DriverEmergencySos`) with haptic countdown, Locked Decision L-2 category routing (`EMERGENCY`, `MEDICAL`, `BREAKDOWN`, `OTHER`), and live incident status sheet.
- **Boarding QR Display & Manual Check-in (P3-T6):** Designed rotating HMAC-SHA256 QR code generator (`DriverBoardingQr`) cycling tokens every 30 seconds with a circular animated countdown timer and active passenger manifest manager (`DriverManifestManager`) supporting manual check-ins with standardized reason codes (`FLAGGED_GUEST`, `LATE_BOARDED`, `CARD_FORGOTTEN`, `OTHER`) and offline sync.
- **Problem Reporting & Ticketing (P3-T7):** Built driver ticket reporting system (`DriverProblemReporter`) with 5-500 character note validation, automatic priority assignment (`BUS_BREAKDOWN` -> HIGH, tracker/phone -> MEDIUM, `OTHER` -> LOW), offline queueing with auto-sync on network reconnect, and backend `POST /api/v1/driver/tickets` endpoint.
- **Mock Location Handling & Integration Suite (P3-T8):** Implemented mock GPS detection flag (`is_mock`) per Rule C-10, driver warning banner (`MockLocationBanner`), coordinator alert trigger (`onMockDetected`), driver integration test suite (`driver-integration-suite.spec.ts`), and 2-hour continuous trip location simulation in Vitest.

---

## 2. Task Verification Matrix (Rule A-5)

| Task ID   | Scope                                                                                                                 |  Status  | Commit SHA | Verification Evidence Log          |
| :-------- | :-------------------------------------------------------------------------------------------------------------------- | :------: | :--------: | :--------------------------------- |
| **P3-T1** | Driver OTP sign-in, roster list, device registration, AC-DRV-01 unrostered bus 403 isolation                          | **DONE** | `f795f5a`  | `docs/progress/evidence/P3-T1.log` |
| **P3-T2** | 8 pre-trip checks, AC-DRV-02 RED hardware warning & phone fallback, AC-DRV-03 location Always blocking & fix screen   | **DONE** | `da2af0e`  | `docs/progress/evidence/P3-T2.log` |
| **P3-T3** | Shift start, AC-DRV-04 restart resume <10s without duplicates, 20m idle prompt, 14h timeout, SOS shift-end block     | **DONE** | `9a0d173`  | `docs/progress/evidence/P3-T3.log` |
| **P3-T4** | Foreground service notification, adaptive cadence (10s moving/30s stopped), 24h SQLite buffer (~8.6k), FIFO flush    | **DONE** | `bae7796`  | `docs/progress/evidence/P3-T4.log` |
| **P3-T5** | Mode switcher (Auto/Hardware/Phone) with 140-char note, 2s hold SOS trigger, L-2 category routing, incident tracker   | **DONE** | `e925c63`  | `docs/progress/evidence/P3-T5.log` |
| **P3-T6** | 30s rotating HMAC QR code generator with circular timer, passenger manifest, manual check-in with reason codes       | **DONE** | `6de3ed6`  | `docs/progress/evidence/P3-T6.log` |
| **P3-T7** | Problem reporter, 5-500 char validation, priority derivation, offline queue & sync, backend ticket submission        | **DONE** | `8a5f84b`  | `docs/progress/evidence/P3-T7.log` |
| **P3-T8** | Mock GPS detection (`is_mock`), warning banner, coordinator alert, AC-DRV-01 to 04 integration suite, 2h simulation   | **DONE** | `8bc6bf0`  | `docs/progress/evidence/P3-T8.log` |

---

## 3. Mandatory Phase P3 Exit Criteria Verification (Master Part 16 & Rule A-6)

Per Master Part 16: *"Exit: AC-DRV-01 to 04 pass on device. Two-hour battery test passes on the reference phone."*
Per Rule A-6: Code that requires a specific environment (device, Docker, AWS) is NOT VERIFIED until run in that environment. Software simulations and unit tests do not constitute on-device proof.

1. **AC-DRV-01: Driver roster strictly isolates buses:**
   - **Status:** **NOT VERIFIED** (Unit/API tests pass in `apps/mobile/test/driver-roster.spec.ts`, but not verified on physical device).

2. **AC-DRV-02: RED hardware tracker status triggers warning and phone fallback:**
   - **Status:** **NOT VERIFIED** (Unit tests pass in `apps/mobile/test/driver-diagnostics.spec.ts`, but not verified on physical device).

3. **AC-DRV-03: Location permission not set to `Always` blocks shift start:**
   - **Status:** **NOT VERIFIED** (Unit tests pass in `apps/mobile/test/driver-diagnostics.spec.ts`, but not verified on physical device).

4. **AC-DRV-04: Mid-shift restart resumes active shift within 10 seconds without duplication:**
   - **Status:** **NOT VERIFIED** (Simulated 4ms in-memory restart in `driver-shift-lifecycle.spec.ts` does not count as on-device evidence; requires physical phone app kill and relaunch).

5. **Two-hour battery test passes on reference phone:**
   - **Status:** **NOT VERIFIED** (Requires reference phone execution).

---

## 4. Phase P3 Sign-Off & Status

Phase P3 is **IN PROGRESS**. In accordance with Rule A-2, Step E: **STOP. Wait for written approval before the next phase.** No subsequent phase may be started.
