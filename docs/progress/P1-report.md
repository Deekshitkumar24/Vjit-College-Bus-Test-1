# Phase Report: P1

Task | Commit | Scope | Tests (count, IDs) | Files | Status
P1-T1 | e393f9a | Device tokens: generation, HMAC storage, key rings, first-use activation (C-01), rotation, revocation (Part 6.2 to 6.4) | 7 (T-SEC-01) | packages/domain/src/device-tokens.ts | DONE
P1-T2 | dfa07b7 | Device links: bus-device linking with row locks and attribution rule (Part 6.5 & 6.6) | 5 (Part 6.5) | packages/domain/src/device-links.ts | DONE
P1-T3 | a0ba87b | Telemetry pipeline stages S1 to S13 with C-09/OV-1 per-sample 200 CONFLICT handling (Part 5.2) | 4 (Part 5.2) | services/api/src/modules/telemetry/ | DONE
P1-T4 | 417c872 | Heartbeat & Event pipelines H1-H8 & E1-E6, health states, C-05 firmware URLs (Part 5.4, 5.5) | 34 (H1-H8, E1-E6) | services/api/src/modules/device/, packages/domain/src/device-health.ts | DONE
P1-T5 | e7aadcc | Driver phone endpoints & shift claim service with mutual exclusion (Part 5.3 & 6.7) | 19 (Part 5.3) | services/api/src/modules/driver/, packages/domain/src/driver-telemetry.ts | DONE
P1-T6 | 0c8b0ae | packages/domain: validity rules, jump check (>150 km/h), frozen position, time checks (Part 9.1, 9.2, 9.14) | 14 (Part 9.1) | packages/domain/src/gps-quality.ts | DONE
P1-T7 | 2ebf988 | Source selector: locked bus_state, source_switches, outbox trigger, anti-flapping (Part 9.3 to 9.7) | 22 (Part 9.3) | services/api/src/modules/selector/, packages/domain/src/source-selector.ts | DONE
P1-T8 | 1764437 | Snapshot API: scope resolution across 8 roles, ETag, 3-second cache, 404 rule (Part 5.6 & 6.9) | 23 (Part 5.6) | services/api/src/modules/snapshot/, packages/domain/src/snapshot.ts | DONE
P1-T9 | 562e190 | ETA and stop arrival in packages/domain: polyline projection, smoothed speed, stop detector (Part 9.9, 9.11) | 17 (Part 9.9) | packages/domain/src/eta-stop-arrival.ts | DONE
P1-T10 | e93f054 | Contract test harness: replay recorded hardware message streams against telemetry endpoints | 6 (Part 15.2) | services/api/test/contract-harness.spec.ts | DONE
P1-T11 | 596dbe5 | Simulator in tools/simulator: 50 buses, dual sources, failure scenarios, R-M5 guards (Part 3.2, R-M5) | 7 (Part 3.2) | tools/simulator/src/, tools/simulator/test/ | DONE

Tests: 199 run, 199 pass, 0 fail across 24 files (packages/domain 115 pass, tools/simulator 7 pass, services/api 77 pass).

Exit criteria:

1. Simulator drives the states correctly across 50 buses: VERIFIED

```
> vitest run tools/simulator/test/simulator.spec.ts

 RUN  v2.1.9 C:/Users/Deekshit kumar .k/OneDrive/Desktop/collegebus

 ✓ tools/simulator/test/simulator.spec.ts (7 tests) 91ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  20:20:30
   Duration  2.17s
```

2. Contract harness passes against all recorded hardware sample streams: VERIFIED

```
> vitest run services/api/test/contract-harness.spec.ts

 RUN  v2.1.9 C:/Users/Deekshit kumar .k/OneDrive/Desktop/collegebus

 ✓ services/api/test/contract-harness.spec.ts (6 tests) 51ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  20:22:04
   Duration  3.50s
```

3. Load test T-LOAD-01 passes in staging: NOT VERIFIED (awaiting staging environment E7)

External blockers:
E1: AWS dev account (college IT)
E2: GitHub Actions runner with Docker (college IT)
E3: College identity test tenant (college IT)
E4: Sentry project (college IT)
E7: Staging environment for load test T-LOAD-01 (college IT)

Open decisions used:

| Ref  | Question                  | Default in force                                        | Owner            |
| ---- | ------------------------- | ------------------------------------------------------- | ---------------- |
| L-1  | BENCH device status       | `PROVISIONED`, `ACTIVE`, `BENCH`, `REVOKED`, `RETIRED`  | Product owner    |
| L-2  | SOS category              | `EMERGENCY`, `MEDICAL`, `BREAKDOWN`, `OTHER`, `UNKNOWN` | Product owner    |
| L-3  | Security staff visibility | Read-only view of all active buses                      | Product owner    |
| L-4  | College SSO provider      | Dual Google Workspace and Microsoft Entra ID support    | College IT       |
| L-5  | AWS Region                | `ap-south-1` (Mumbai), CloudFront/ACM in `us-east-1`    | Product owner    |
| D-01 | Device GNSS source        | Internal EC200U-CN or external NEO-6M fallback          | ECE team         |
| D-02 | Low-voltage event         | 11.8V (12V) / 23.5V (24V) sustained 30s                 | ECE team         |
| D-03 | Bus voltage class         | V12 or V24 provisioned per bus                          | Transport office |
| D-06 | Driver phones             | College-issued preferred, personal allowed with consent | Transport office |
| D-11 | Map provider              | MapLibre with OSM tiles                                 | Product owner    |
| D-13 | Tracking mode             | AUTO default                                            | Transport office |
| D-14 | Retention periods         | Values in Master Part 14.2                              | Policy owner     |

Git log for this phase:

```
596dbe5 feat(simulator): implement 50-bus fleet simulator with dual sources and failure scenarios (P1-T11)
6508b03 docs(p1): record commit SHA e93f054 for P1-T10
e93f054 feat(telemetry): build contract test harness and replay recorded hardware message streams (P1-T10)
20d851b docs(p1): record commit SHA 562e190 for P1-T9
562e190 feat(domain): implement polyline projection, stop arrival detector, and ETA (P1-T9)
1764437 feat(snapshot): implement snapshot endpoint, role scope resolution, ETag, and 3-second cache (P1-T8)
2ebf988 feat(selector): implement dual-source selector, bus_state locking, outbox triggers, and anti-flapping (P1-T7)
0c8b0ae feat(domain): implement GPS validity, kinematic jump check, and frozen position rules (P1-T6)
e7aadcc feat(api): implement driver phone telemetry and shift claim service (P1-T5)
417c872 feat(api): implement heartbeat (H1-H8) and event (E1-E6) pipelines (P1-T4)
a0ba87b feat(api): implement telemetry pipeline stages S1 to S13 with C-09 conflict handling (P1-T3)
dfa07b7 feat(domain): implement device links and historical sample attribution rule (P1-T2)
e393f9a feat(domain): implement device token generation, HMAC validation, and C-01 activation (P1-T1)
```
