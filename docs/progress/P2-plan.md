# Phase Plan: P2 Student and Faculty Mobile Applications

**Phase ID:** P2  
**Goal:** Production-grade mobile experience for Students (STU) and Faculty (FAC), including live bus tracking, authoritative source badges, ETA progression, QR attendance scanning, leave/stop requests, and privacy management per Master Part 16.  
**Prompt Contract:** `AG-MASTER-FINAL-1.0` (Version 1.0, 21 October 2026) & `AG-MVP-PROMPT-2.0`  
**Companion Specifications:** `docs/spec/SW-MVP-1.0.pdf` and `docs/spec/HW-SPEC-1.0.pdf`  
**Date:** 22 October 2026  
**Status:** IN PROGRESS (Re-mapped to Master Part 16 Task IDs per Correction 5A-3)

---

## 1. Specification & Contract Reference
Master Part 16 defines exactly 14 tasks for Phase P2 (P2-T1 through P2-T14).
Note: An SOS trigger in the student app is not a P2 task in Part 16 (handled under P3-T5 and P6-T7).

---

## 2. Locked Decisions & Defaults in Force (Part B)
- **L-2:** SOS category stored in `sos_incidents.category`.
- **L-3:** Security staff (SEC) see all active buses, read-only.
- **D-10:** Boarding method: QR at launch with dynamic rotating HMAC token.
- **D-11:** Map provider: MapLibre with OpenStreetMap tiles.
- **D-12:** Morning-present, afternoon-absent rule.
- **OV-4:** P2-T1 extends the P0-T18 mobile shell (`apps/mobile`).

---

## 3. Task Inventory (Master Part 16 Task IDs)

| Task ID | Scope (Master Part 16) | Status | Evidence Log | Notes |
|---|---|:---:|---|---|
| **P2-T1** | Expo shell extension (OV-4): router, SecureStore, role switcher, guards | **DONE** | `docs/progress/evidence/P2-T1.log` | Shell extension, route guards, token storage (Commit `da561c0`) |
| **P2-T2** | Home map: MapLibre, 10-second foreground polling, source badges, clustering, route line, stale styling | **DONE** | `docs/progress/evidence/P2-T2.log` | Map markers, source badges, 10s poll (Commit `37e23ef`) |
| **P2-T3** | Bus detail: ETA to my stop, remaining stops, progress, data age, Not running and Trip completed | **DONE** | `docs/progress/evidence/P2-T3.log` | ETA countdown, progress badges, data age (Commit `4538661`) |
| **P2-T4** | Notification centre and preferences; push token into push_tokens; SAFETY channel on Android | **DONE** | `docs/progress/evidence/P2-T4.log` | Preferences, notification center, push token, Android SAFETY channel |
| **P2-T5** | Faculty views: my buses with picker, bus detail with driver contact, today's attendance | **DONE** | `docs/progress/evidence/P2-T5.log` | Faculty manifest and driver contact (Commit `a3dde2b`) |
| **P2-T6** | Approaching-alert setting, 2 to 15 minutes | **DONE** | `docs/progress/evidence/P2-T6.log` | Approaching alert preference slider clamped 2-15 min |
| **P2-T7** | Offline states, cached-data banners, no-connection messages | **DONE** | `docs/progress/evidence/P2-T7.log` | Offline caching & banners (Commit `602db65`) |
| **P2-T8** | Accessibility and externalised strings | **IN PROGRESS** | `docs/progress/evidence/P2-T8.log` | Screen reader labels & i18n |
| **P2-T9** | Boarding QR scanner (expo-camera), POST /attendance/scan, specific failure messages. Nothing queued offline | **DONE** | `docs/progress/evidence/P2-T9.log` | QR scanner, camera view, scan endpoint (Commit `60ad047`) |
| **P2-T10** | Stop request screens: pin, name up to 60 characters, checks, status, votes | **DONE** | `docs/progress/evidence/P2-T10.log` | Stop change requests & status (Commit `1e74d59`) |
| **P2-T11** | Leave screen: mark and cancel until the cutoff | **DONE** | `docs/progress/evidence/P2-T11.log` | Trip leave management & cancellation (Commit `1e74d59`) |
| **P2-T12** | Attendance history: one row per date with morning and afternoon status | **IN PROGRESS** | `docs/progress/evidence/P2-T12.log` | Daily attendance ledger view |
| **P2-T13** | Profile and privacy: name and phone, correction, export, deletion, consent withdrawal, consent history, sessions | **IN PROGRESS** | `docs/progress/evidence/P2-T13.log` | User privacy settings & consent management |
| **P2-T14** | Trip completed view: visible for 30 minutes after the trip ends | **IN PROGRESS** | `docs/progress/evidence/P2-T14.log` | Post-trip completion screen with 30m TTL |

---

## 4. Mandatory Phase P2 Exit Criteria
- `AC-STU-01` to `AC-STU-05` and `AC-FAC-01` to `AC-FAC-03` pass on device (E3, E6, O7).
- Acceptance tests named in master Part 10.3 and 10.4.
- Status: **NOT VERIFIED** (Requires physical reference phones E6 and college identity tenant E3).
