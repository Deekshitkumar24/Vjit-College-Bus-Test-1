# Phase Plan: P1 Ingestion & The Source Engine

**Phase ID:** P1  
**Goal:** Devices and driver phones send data, the server stores it correctly, picks one source per bus, and serves a snapshot.  
**Prompt Contract:** `AG-MASTER-FINAL-1.0` (Version 1.0, 21 October 2026)  
**Companion Specifications:** `docs/spec/SW-MVP-1.0.pdf` and `docs/spec/HW-SPEC-1.0.pdf`  
**Date:** 21 October 2026  
**Status:** In Execution (Autonomous Mode)

---

## 1. Specification Sections Read (Part 21.3)

The following sections from `SW-MVP-1.0` and `HW-SPEC-1.0` have been reviewed for Phase P1:

- `SW-MVP-1.0`: §5 (Actors & Roles), §9 (Route & Timetable Model), §10.5 (Telemetry & Heartbeat Schemas), §11 (Device Connection & Ingestion Protocol), §12 (Device Events), §13 (Dual-Source Location & Source Selection), §14 (ETA & Progress Calculations), §17.3 (Bus Live Marker & Source Badges), §25 (Background Workers), §26.2-§26.3 (Telemetry & Heartbeat Processing), §30 (Data Retention & Purging), §32.2-§32.3 (Simulator & Synthetic Workflows).
- `HW-SPEC-1.0`: §5 (Communication Protocol), §8 (Bearer Token Security), §10 (Message Formats & Cadence), §13 (Provisioning & Activation).

---

## 2. Task Inventory & Execution Status

| Task ID    | Scope                                                                                                                                           |     Status      |            Evidence Log             | Current State & Verified Commit SHA                                |
| :--------- | :---------------------------------------------------------------------------------------------------------------------------------------------- | :-------------: | :---------------------------------: | :----------------------------------------------------------------- |
| **P1-T1**  | **Device tokens:** generation, HMAC storage, key versions, activation on first use (C-01), rotation with overlap, revocation (Part 6.2 to 6.4). |    **DONE**     | `docs/progress/evidence/P1-T1.log`  | Complete. Commit `e393f9a`. 7/7 unit tests passing.                |
| **P1-T2**  | **Device links:** bus-device linking with row locks and attribution rules (Part 6.5 & 6.6).                                                     |    **DONE**     | `docs/progress/evidence/P1-T2.log`  | Complete. Commit `dfa07b7`. 5/5 unit tests passing.                |
| **P1-T3**  | **Telemetry pipeline stages S1 to S13:** validation, dedup, duplicate sample 200 CONFLICT (C-09/OV-1), storage (Part 5.2).                      |    **DONE**     | `docs/progress/evidence/P1-T3.log`  | Complete. Commit `a0ba87b`. 4/4 pipeline tests passing.            |
| **P1-T4**  | **Heartbeat & Event pipelines:** stages H1-H8, E1-E6, device health states, non-SOS event handlers (Part 5.4, 5.5, C-08).                       |    **DONE**     | `docs/progress/evidence/P1-T4.log`  | Complete. 34/34 tests passing (29 domain + 5 API).                 |
| **P1-T5**  | **Driver phone endpoints & shift claim:** POST /driver/telemetry, shift locking, active claim issuance (Part 5.3 & 6.7).                        |    **DONE**     | `docs/progress/evidence/P1-T5.log`  | Complete. 19/19 tests passing (12 domain + 7 API).                 |
| **P1-T6**  | **packages/domain:** validity rules, speed jump, future/past time, plausibility, frozen GPS, unit conversions (Part 9.1, 9.2, 9.14).            |    **DONE**     | `docs/progress/evidence/P1-T6.log`  | Complete. 14/14 tests passing. 55 domain unit tests total.         |
| **P1-T7**  | **Source selector:** locked bus_state, source_switches, outbox trigger, anti-flapping rules, phone cadence response (Part 9.3-9.7).             |    **DONE**     | `docs/progress/evidence/P1-T7.log`  | Complete. 22/22 unit & pipeline tests passing (13 domain + 9 API). |
| **P1-T8**  | **Snapshot API:** GET /snapshot, scope resolution, ETag, 3-second cache per route version, 404 rule (Part 5.6 & 6.9).                           |    **DONE**     | `docs/progress/evidence/P1-T8.log`  | Complete. 23/23 unit & pipeline tests passing (14 domain + 9 API). |
| **P1-T9**  | **ETA and stop arrival:** packages/domain, PostGIS queries, passed/off-route/arriving states (Part 9.9 & 9.11).                                 |    **DONE**     | `docs/progress/evidence/P1-T9.log`  | Complete. Commit `562e190`. 17/17 domain tests passing.            |
| **P1-T10** | **Contract test harness:** recorded hardware messages replay against telemetry endpoints.                                                       |    **DONE**     | `docs/progress/evidence/P1-T10.log` | Complete. Commit `e93f054`. 6/6 recorded hardware stream tests passing. |
| **P1-T11** | **Simulator in tools/simulator:** 50 buses, hardware + phone sources, failure behaviours (Part 3.2, R-M5).                                      | **NOT STARTED** | `docs/progress/evidence/P1-T11.log` | Staged for execution.                                              |

---

## 3. Mandatory Phase P1 Exit Criteria

1. Simulator drives the states correctly across 50 buses without errors.
2. Contract harness passes against all recorded hardware sample streams.
3. Unit and integration tests for source selection, anti-flapping, and duplicate sample conflict pass cleanly.
