# Phase Plan: P2 Student and Faculty Mobile Applications

**Phase ID:** P2  
**Goal:** Complete, production-grade mobile experience for Students (STU) and Faculty (FAC), including live bus tracking, authoritative source badges, ETA progression, QR attendance scanning, leave/stop requests, faculty safety manifests, and emergency SOS.  
**Prompt Contract:** `AG-MASTER-FINAL-1.0` (Version 1.0, 21 October 2026)  
**Companion Specifications:** `docs/spec/SW-MVP-1.0.pdf` and `docs/spec/HW-SPEC-1.0.pdf`  
**Date:** 21 October 2026  
**Status:** In Execution (Autonomous Mode)

---

## 1. Specification Sections Read (Part 21.3)

The following sections from `SW-MVP-1.0` have been reviewed for Phase P2:

- `SW-MVP-1.0`: §4 (User Classes & Permissions), §5.1-§5.2 (Student & Faculty Roles), §7 (Frontend Architectures), §13.7 (Authoritative Source Badges), §14 (ETA & Progress Calculations), §17 (Live Tracking & Map Displays), §18 (Attendance, QR Boarding, Morning-Present/Afternoon-Absent Safety Rule), §19 (Emergency SOS & Incident Response), §21 (Student Requests & Leaves), §28 (Offline Support & Caching).

---

## 2. Locked Decisions & Defaults in Force (Part B)

- **L-2:** SOS category stored in `sos_incidents.category`: `EMERGENCY`, `MEDICAL`, `BREAKDOWN`, `OTHER`, `UNKNOWN`.
- **L-3:** Security staff (SEC) see all active buses, read-only.
- **D-10:** Boarding method: QR at launch with dynamic rotating HMAC token.
- **D-11:** Map provider: MapLibre with OpenStreetMap tiles, tile provider switchable.
- **D-12:** Morning-present, afternoon-absent rule: Automated escalation if a student boarded in the morning fails to board the afternoon return bus by scheduled departure.
- **OV-4:** P2-T1 extends the P0-T18 mobile shell (`apps/mobile`).

---

## 3. Task Inventory & Dependency Order

| Task ID   | Scope                                                                                                                                                  |     Status      |            Evidence Log            | Verification Criteria & Deliverables                                          |
| :-------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------: | :--------------------------------: | :---------------------------------------------------------------------------- |
| **P2-T1** | **Mobile navigation & state store:** Expo Router navigation tree for Student and Faculty tabs, offline cache store, snapshot poller with 304 ETag      |    **DONE**     | `docs/progress/evidence/P2-T1.log` | Complete. 15/15 mobile tests passing. Router, cache, and 304 poller verified. |
| **P2-T2** | **Live map & authoritative marker:** Map view, bus heading marker, source badges (`Live · bus tracker`, `Live · driver's phone`, `Delayed`, `Offline`) | **NOT STARTED** | `docs/progress/evidence/P2-T2.log` | Badge rendering, marker rotation, corridor polyline render.                   |
| **P2-T3** | **Stop arrival & ETA card:** Next stop countdown, ETA calculation, stop list with progress badges (`PASSED`, `ARRIVING`, `ARRIVED`, `UPCOMING`)        | **NOT STARTED** | `docs/progress/evidence/P2-T3.log` | Progress calculations, off-route banner (> 300m), unit tests.                 |
| **P2-T4** | **Student QR attendance scanner:** Camera scanner, rotating QR validator (HMAC token, 15s window, anti-replay), attendance recording endpoint          | **NOT STARTED** | `docs/progress/evidence/P2-T4.log` | QR payload parser, anti-replay verification, API contract tests.              |
| **P2-T5** | **Student requests & leave module:** Stop change request submission, trip leave application, history & status badges (`PENDING`, `APPROVED`, etc.)     | **NOT STARTED** | `docs/progress/evidence/P2-T5.log` | Form validation with Zod, state transitions, unit tests.                      |
| **P2-T6** | **Faculty attendance manifest & safety alert:** Live passenger manifest, manual check-in toggle, morning-present/afternoon-absent safety alert (D-12)  | **NOT STARTED** | `docs/progress/evidence/P2-T6.log` | Manifest list, D-12 alert rule trigger, faculty verification test.            |
| **P2-T7** | **Emergency SOS trigger:** Guarded 3-second hold trigger, GPS capture, category picker (L-2), incident dispatch, active emergency banner               | **NOT STARTED** | `docs/progress/evidence/P2-T7.log` | 3s hold gesture, SOS dispatch, acknowledgement receipt test.                  |
| **P2-T8** | **Integration test harness & verification:** End-to-end component and flow tests for mobile suite, offline resiliency, and permission boundaries       | **NOT STARTED** | `docs/progress/evidence/P2-T8.log` | All test suites passing, zero mock data, zero linter errors.                  |

---

## 4. Mandatory Phase P2 Exit Criteria

1. Student can view assigned bus on map with correct authoritative source badge and real-time ETA.
2. QR attendance scanner validates rotating driver code and records student boarding.
3. Faculty live manifest correctly displays boarded students and flags morning-present/afternoon-absent discrepancies.
4. Emergency SOS can be triggered with 3-second hold and broadcasts incident with captured coordinates.
5. All mobile unit and integration tests pass cleanly with zero mock data.
