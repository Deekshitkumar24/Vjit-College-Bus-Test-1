# Phase Report: P2 Student & Faculty Mobile Applications

**Phase ID:** P2  
**Goal:** Done, production-grade mobile client experience for Students (STU) and Faculty (FAC), including live bus tracking, authoritative source badges, real-time ETA progression, QR attendance scanning, leave/stop requests, faculty safety manifests, and emergency SOS incident dispatch.  
**Prompt Contract:** `AG-MASTER-FINAL-1.0` (Version 1.0, 21 October 2026)  
**Date:** 22 October 2026  
**Status:** IN PROGRESS (On-device exit criteria NOT VERIFIED; awaiting physical device verification and owner written approval)

---

## 1. Executive Summary

Phase P2 has implemented the mobile client experience for Students and Faculty across 8 tasks:

- **Mobile Navigation & Offline Cache Store (P2-T1):** Integrated Expo Router tab-based navigation trees tailored for Student and Faculty roles (`/(student)` and `/(faculty)`), local encrypted SQLite cache (`MobileCacheStore`), and snapshot polling client with weak ETag support (handling HTTP 304 Not Modified).
- **Live Map & Authoritative Marker Model (P2-T2):** Interactive MapLibre / OpenStreetMap (Default D-11) map interface with animated bus heading rotation, dynamic camera viewport bounds, and color-coded authoritative source badges (`Live · bus tracker` [GREEN], `Live · driver's phone` [BLUE], `Delayed` [AMBER], and `Offline` [GRAY]).
- **Stop Arrival & Monotonic ETA Progression (P2-T3):** Real-time next-stop arrival cards, monotonic countdown timers with drift correction, stop sequence status list (`PASSED`, `ARRIVING`, `ARRIVED`, `UPCOMING`), and 300m corridor off-route warning banner.
- **Student QR Attendance Scanner (P2-T4):** Secure attendance camera scanner validating rotating QR tokens (Default D-10) using HMAC-SHA256 signatures, 15-second epoch tolerance, in-memory anti-replay nonce tracking, and offline attendance queueing.
- **Student Requests & Leave Module (P2-T5):** Full workflow for submitting stop change requests and trip leaves, Zod schema validation, status badge presenters (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`), request cancellation, and offline sync.
- **Faculty Passenger Manifest & Safety Alert (P2-T6):** Live roster of assigned students, manual check-in toggle with audit tracking, search/filter engine by stop/status, and automated morning-present/afternoon-absent discrepancy alerts per Default D-12.
- **Emergency SOS Trigger (P2-T7):** Guarded 3-second hold gesture controller with progressive haptic feedback, GPS location capture, Locked Decision L-2 category routing (`EMERGENCY`, `MEDICAL`, `BREAKDOWN`, `OTHER`), dispatch payload broadcast, security office hotline fallback, and active emergency state banner.
- **Integration Test Harness & Verification (P2-T8):** 5 end-to-end integration flows exercising tracking, attendance, requests, manifests, and emergency dispatch, passing 77/77 tests across 9 test suites with zero mock data and zero lint errors.

---

## 2. Task Verification Matrix (Rule A-5)

| Task ID   | Scope                                                                                                                 |  Status  | Commit SHA | Verification Evidence Log          |
| :-------- | :-------------------------------------------------------------------------------------------------------------------- | :------: | :--------: | :--------------------------------- |
| **P2-T1** | Mobile navigation tree, offline cache store, snapshot polling client with 304 ETag                                    | **DONE** | `da561c0`  | `docs/progress/evidence/P2-T1.log` |
| **P2-T2** | Live map, bus heading marker, authoritative source badges, camera bounds, D-11 OpenStreetMap tile provider            | **DONE** | `37e23ef`  | `docs/progress/evidence/P2-T2.log` |
| **P2-T3** | Stop arrival card, next-stop countdown, stop status timeline, 300m corridor off-route banner                          | **DONE** | `4538661`  | `docs/progress/evidence/P2-T3.log` |
| **P2-T4** | QR attendance scanner, rotating HMAC token validator (15s window, anti-replay), offline attendance queue              | **DONE** | `60ad047`  | `docs/progress/evidence/P2-T4.log` |
| **P2-T5** | Stop change & leave requests, Zod validation, status badge presenters, cancel action, offline sync                    | **DONE** | `1e74d59`  | `docs/progress/evidence/P2-T5.log` |
| **P2-T6** | Faculty passenger manifest, manual check-in toggle, filter engine, D-12 morning-present/afternoon-absent safety alert | **DONE** | `a3dde2b`  | `docs/progress/evidence/P2-T6.log` |
| **P2-T7** | Emergency SOS trigger (3-second guarded hold, GPS capture, L-2 category routing, security hotline fallback)           | **DONE** | `38e2a8d`  | `docs/progress/evidence/P2-T7.log` |
| **P2-T8** | Mobile integration test harness and full test verification suite (77/77 tests passing)                                | **DONE** | `602db65`  | `docs/progress/evidence/P2-T8.log` |

---

## 3. Mandatory Phase P2 Exit Criteria Verification (Master Part 16 & Rule A-6)

Per Master Part 16: *"Exit: AC-STU-01 to 05 and AC-FAC-01 to 03 pass on device."*
Per Rule A-6: Component and unit tests in Vitest do not count as on-device verification.

1. **AC-STU-01 to AC-STU-05 pass on device:**  
   - **Status:** **NOT VERIFIED** (Unit/component tests pass in Vitest, but physical iOS/Android on-device execution requires external inputs E3 and E6).
2. **AC-FAC-01 to AC-FAC-03 pass on device:**  
   - **Status:** **NOT VERIFIED** (Unit/component tests pass in Vitest, but physical iOS/Android on-device execution requires external inputs E3 and E6).

---

## 4. Phase P2 Sign-Off & Status

Phase P2 is **IN PROGRESS**. Awaiting owner written approval and physical mobile device verification before Phase P3 can be approved.

Owner approval:
