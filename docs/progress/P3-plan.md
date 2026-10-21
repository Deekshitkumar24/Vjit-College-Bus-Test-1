# Phase Plan: P3 Driver Application & Phone Tracking

**Phase ID:** P3  
**Goal:** Production-grade Driver mobile client experience and phone tracking pipeline, including driver OTP sign-in, roster inspection, pre-trip hardware/permission diagnostic checks, shift lifecycle (start, resume, idle detection, 14h timeout, end), background location tracking with 24-hour buffer, tracking mode switcher, driver SOS emergency trigger, rotating boarding QR display, manual boarding check-in, problem reporting/ticketing, and mock-location detection.  
**Prompt Contract:** `AG-MASTER-FINAL-1.0` (Version 1.0, 21 October 2026)  
**Companion Specifications:** `docs/spec/SW-MVP-1.0.pdf` (§8, §11.7, §15, §16.3, §17.4, §18, §19, §28) and `docs/spec/HW-SPEC-1.0.pdf`  
**Date:** 22 October 2026  
**Status:** In Execution (Autonomous Mode)

---

## 1. Specification Sections Read & Referenced

- `SW-MVP-1.0`:
  - §4 & §5.3: Driver user class and permissions (DRV).
  - §8 (F-AUTH-02): Driver email OTP authentication with Turnstile (C-02), 6-digit code, 10-minute expiry, lockout rules.
  - §11.7: Driver phone telemetry endpoints (`POST /api/v1/driver/location`, shift authentication, adaptive intervals).
  - §15: Shifts and trips:
    - §15.1: Pre-trip diagnostic checks (Checks 1 to 9).
    - §15.2: Shift start effects (ACTIVE shift, bus mode, EXPECTED attendance rows, faculty notification).
    - §15.3: Running rules, app restart resume within 10s (AC-DRV-04), 12h session.
    - §15.4: Shift end rules (MANUAL, AUTO_IDLE after 20m + 10m prompt, TIMEOUT at 14h, ADMIN override, SOS block).
    - §15.7: Trip summary calculations (distance, duration, average speed, boardings, source uptime, failovers).
  - §16.3: Driver role workflows and acceptance criteria (AC-DRV-01 to AC-DRV-04).
  - §17.4: Automatic stop arrival/departure detection and manual "Mark arrived" fallback.
  - §18: Attendance QR code generation, 30-second rotating HMAC countdown, manual check-in with reason codes.
  - §19: Driver SOS trigger (2-second hold, category picker, incident progress tracker).
  - §28: 24-hour location offline buffering in SQLite, sequential FIFO flush.

---

## 2. Locked Decisions & Defaults in Force (Part B)

- **L-2:** SOS category stored in `sos_incidents.category`: `EMERGENCY`, `MEDICAL`, `BREAKDOWN`, `OTHER`, `UNKNOWN`.
- **D-06:** Driver phones: College-issued phones preferred; personal phones require recorded consent.
- **C-02:** Cloudflare Turnstile on driver OTP request.
- **C-07 / OV-8:** Driver accounts may use non-college emails only when `college_email_exception` is true and `exception_reason` is filled.
- **C-10:** Phone sample mock flag field name is `is_mock`.
- **OV-4:** Mobile app code extends the existing `apps/mobile` shell established in P0-T18 and extended in Phase P2.

---

## 3. Task Inventory & Dependency Order

| Task ID   | Scope                                                                                                                                                              |     Status      |            Evidence Log            | Verification Criteria & Deliverables                                                                                                           |
| :-------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------: | :--------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| **P3-T1** | **Driver OTP sign-in, roster list & device registration:** OTP login, roster retrieval (assigned buses only, AC-DRV-01), phone device label binding & registration |    **DONE**     | `docs/progress/evidence/P3-T1.log` | Complete. Commit `f795f5a`. Driver roster API, AC-DRV-01 unrostered bus 403, phone label registration, 83/83 mobile + 58/58 API tests passing. |
| **P3-T2** | **Permissions & pre-trip check diagnostics:** 8 pre-trip checks (§15.1, hardware GREEN/AMBER/RED status, location Always, GPS fix < 50m, network reachability)     |    **DONE**     | `docs/progress/evidence/P3-T2.log` | Complete. Commit `da2af0e`. 8-check diagnostic engine, AC-DRV-02 warning and phone fallback, AC-DRV-03 location permission blocking and fix steps. |
| **P3-T3** | **Shift start, restart resume, idle detection & 14h timeout:** Shift start transaction, mid-shift restart resume <10s (AC-DRV-04), 20m idle prompt, 14h timeout    | **NOT STARTED** | `docs/progress/evidence/P3-T3.log` | Shift state machine, mutual exclusion (one shift per bus/driver), resume without duplication, idle prompt & timeout handlers.                  |
| **P3-T4** | **Background location tracking & 24h SQLite buffer:** Foreground service notification, adaptive cadence (10s moving / 30s stopped), SQLite buffer, batch flush     | **NOT STARTED** | `docs/progress/evidence/P3-T4.log` | Location collector, persistent notification state, SQLite buffer with 24h capacity (~8,640 samples), sequential FIFO flush.                    |
| **P3-T5** | **Tracking mode switcher & Driver SOS emergency:** Mode switch (Auto/Hardware/Phone) with confirmation & 140-char note, 2s hold SOS trigger, incident status sheet | **NOT STARTED** | `docs/progress/evidence/P3-T5.log` | Mode switch modal with note validation, 2s hold gesture controller, L-2 category routing, real-time incident status progression.               |
| **P3-T6** | **Boarding QR code display & manual check-in:** 30s rotating HMAC token generator with circular countdown timer, student check-in list with reason codes           | **NOT STARTED** | `docs/progress/evidence/P3-T6.log` | 30s rotating QR presenter, HMAC signature generator, manual check-in modal with mandatory reason when student not expected.                    |
| **P3-T7** | **Report a problem & maintenance ticketing:** Problem reporter (`BUS_BREAKDOWN`, `TRACKER_PROBLEM`, `PHONE_PROBLEM`, `OTHER`), 500-char note, ticket generation    | **NOT STARTED** | `docs/progress/evidence/P3-T7.log` | Problem report form with Zod validation, ticket creation endpoint integration, confirmation feedback.                                          |
| **P3-T8** | **Mock-location handling & Driver integration test suite:** Mock GPS rejection (`is_mock`), driver warning banner, coordinator alert, full driver suite validation | **NOT STARTED** | `docs/progress/evidence/P3-T8.log` | `is_mock` flag isolation, coordinator alert trigger, AC-DRV-01 to AC-DRV-04 verification, zero mock data, full suite passing cleanly.          |

---

## 4. Mandatory Phase P3 Exit Criteria

1. **AC-DRV-01:** Driver roster strictly isolates buses: unrostered buses are hidden, and direct API access to unrostered buses returns HTTP 403 Forbidden.
2. **AC-DRV-02:** When hardware tracker status is RED (no heartbeat in 2 minutes), shift can start with a visible warning and driver phone becomes primary tracking source.
3. **AC-DRV-03:** When location permission is not set to `Always`, shift start is blocked and the platform-specific fix screen is shown.
4. **AC-DRV-04:** When app is closed mid-shift and reopened, the same active shift resumes automatically within 10 seconds with no duplicate shift created.
5. All driver unit and integration test suites pass cleanly with zero mock data and zero lint errors.
