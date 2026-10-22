# Phase Report: P2

Task | Commit | Scope | Tests (count, IDs) | Files | Status
P2-T1 | da561c0 | Expo shell extension (OV-4): router, SecureStore, role switcher, guards | 5 (OV-4) | apps/mobile/app/index.tsx, src/auth/route-guard.tsx | DONE
P2-T2 | 37e23ef | Home map: MapLibre, 10s foreground polling, source badges, clustering, route line, stale styling | 12 (D-11) | apps/mobile/src/map/ | DONE
P2-T3 | 4538661 | Bus detail: ETA to my stop, remaining stops, progress, data age, Not running / Trip completed | 16 (Part 10.3) | apps/mobile/src/eta/ | DONE
P2-T4 | dc30268 | Notification centre and preferences; push token into push_tokens; SAFETY channel on Android | 5 (Part 10.3) | apps/mobile/src/notifications/ | DONE
P2-T5 | a3dde2b | Faculty views: my buses with picker, bus detail with driver contact, today's attendance | 11 (AC-FAC-01) | apps/mobile/src/manifest/ | DONE
P2-T6 | 9466d6a | Approaching-alert setting, clamped between 2 and 15 minutes | 5 (Part 10.3) | apps/mobile/src/notifications/ | DONE
P2-T7 | 602db65 | Offline states, cached-data banners, no-connection messages | 10 (Part 10.3) | apps/mobile/src/store/ | DONE
P2-T8 | d5a4037 | Accessibility and externalised strings: screen reader labels, hints, multi-locale dictionary | 4 (Part 10.3) | apps/mobile/src/accessibility/ | DONE
P2-T9 | 60ad047 | Boarding QR scanner (expo-camera), POST /attendance/scan, specific failure messages | 8 (D-10) | apps/mobile/src/attendance/qr-validator.ts | DONE
P2-T10 | 1e74d59 | Stop request screens: pin, name up to 60 characters, checks, status, votes | 11 (Part 11.7) | apps/mobile/src/requests/ | DONE
P2-T11 | 1e74d59 | Leave screen: mark and cancel until the cutoff | 11 (Part 11.9) | apps/mobile/src/requests/ | DONE
P2-T12 | 1f6b17f | Attendance history: one row per date with morning and afternoon status (GET /attendance/me) | 3 (D-12) | apps/mobile/src/attendance/attendance-history.ts | DONE
P2-T13 | c2464f7 | Profile and privacy: name, phone, correction, export, deletion, consent withdrawal, session sign-out | 3 (C-06) | apps/mobile/src/privacy/profile-privacy-manager.ts | DONE
P2-T14 | 7ca85d7 | Trip completed view: visible for 30 minutes after the trip ends (Part 6.10) | 2 (Part 6.10) | apps/mobile/src/eta/trip-completed-manager.ts | DONE

Tests: 168 run, 168 pass, 0 fail across 23 test files (full mobile component and integration test suite passing).

Exit criteria:
1. AC-STU-01 to AC-STU-05 pass on device: NOT VERIFIED (awaiting physical reference phones E6 and college identity tenant E3)
2. AC-FAC-01 to AC-FAC-03 pass on device: NOT VERIFIED (awaiting physical reference phones E6 and college identity tenant E3)

External blockers:
E1: AWS dev account (college IT)
E2: GitHub Actions runner with Docker (college IT)
E3: College identity test tenant (college IT)
E6: Physical reference phones (iOS 16+, Android 10+) for on-device acceptance runs (college IT)

Open decisions used:
| Ref | Question | Default in force | Owner |
| --- | --- | --- | --- |
| L-2 | SOS category | `EMERGENCY`, `MEDICAL`, `BREAKDOWN`, `OTHER`, `UNKNOWN` | Product owner |
| L-3 | Security staff visibility | Read-only view of all active buses | Product owner |
| D-08 | Minimum mobile OS | Android 10 and later, iOS 16 and later | Product owner |
| D-10 | Boarding method | QR at launch (dynamic rotating HMAC) | Transport office |
| D-11 | Map provider | MapLibre with OSM tiles | Product owner |
| D-12 | Morning-present, afternoon-absent rule | Discrepancy safety alert raised | Faculty committee |
| D-15 | Parental consent | Guardian one-time code | Counsel |
| D-16 | Critical Alerts on iOS | Time-sensitive interruption level | Product owner |

Git log for this phase:
```
7ca85d7 P2-T14: trip completed summary view with 30-minute time-to-live per Part 6.10
c2464f7 P2-T13: profile correction, GDPR/DPDP export/deletion, consent history, and session sign-out
1f6b17f P2-T12: attendance history daily rows with D-12 morning-present afternoon-absent detection
d5a4037 P2-T8: accessibility props and externalised string dictionary with multi-locale support
9466d6a P2-T6: approaching alert setting clamped between 2 and 15 minutes
dc30268 P2-T4: notification centre, preferences, push tokens, and Android SAFETY channel
602db65 feat(mobile): P2-T8 mobile end-to-end integration flows and test harness
38e2a8d feat(mobile): P2-T7 emergency SOS trigger, guarded 3s hold, and category routing
a3dde2b feat(mobile): P2-T6 faculty attendance manifest and D-12 safety alert rule
1e74d59 feat(mobile): P2-T5 student requests and leave application module
60ad047 feat(mobile): P2-T4 student QR attendance scanner and rotating token validator
4538661 feat(mobile): P2-T3 stop arrival, ETA card suite, and off-route banner
37e23ef feat(mobile): P2-T2 live map, authoritative marker model, and source badges
da561c0 feat(mobile): implement navigation tree, offline cache store, and snapshot poller with 304 ETag (P2-T1)
```
