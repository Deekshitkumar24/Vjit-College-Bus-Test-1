# Phase Report: P4

Task | Commit | Scope | Tests (count, IDs) | Files | Status
P4-T1 | 9b44a12 | Web shell, role routes, guards, idle tracker, MFA enrolment & recovery codes | 11 (T-SEC-01, P4-T1) | apps/admin-web/src/auth/, src/routes/ | DONE
P4-T2 | 5a51c79 | Buses & devices management, batch provisioning, one-time token, links, rotation, revocation | 6 (AC-COR-01) | apps/admin-web/src/buses/, src/devices/ | DONE
P4-T3 | 61ac62d | Routes, stops library, GeoJSON geometry (Part 20.8), timetables, route-bus assignment, holidays | 4 (Part 20.8) | apps/admin-web/src/routes/route-manager.ts | DONE
P4-T4 | 48486b2 | Driver roster scheduling, faculty bus oversight, student route assignments | 3 (Part 16.4) | apps/admin-web/src/rosters/roster-assignment-manager.ts | DONE
P4-T5 | c634154 | User management, CSV bulk import with dry run (AC-COR-02), deactivation (AC-COR-03) | 4 (AC-COR-02, AC-COR-03) | apps/admin-web/src/users/user-management.ts | DONE
P4-T6 | d0207e4 | Live fleet map, source indicators, switch log, dual-track 10-minute comparison | 3 (Part 21) | apps/admin-web/src/fleet/fleet-map-manager.ts | DONE
P4-T7 | 2486253 | Maintenance tickets with 48h escalation, firmware releases with presigned URLs (C-05), staged rollout | 4 (C-05, Part 24) | apps/admin-web/src/firmware/tickets-firmware-manager.ts | DONE
P4-T8 | 5817952 | Settings with change reason, feature flags, audit viewer, admin route 404 security (T-SEC-05) | 7 (T-SEC-05) | apps/admin-web/src/settings/settings-audit-manager.ts | DONE
P4-T9 | 99979b1 | Bench mode (Decision L-1): registration, exclusion from fleet views, alerts, reports, purge | 4 (L-1) | apps/admin-web/src/bench/bench-mode-manager.ts | DONE

Tests: 50 run, 50 pass, 0 fail across 10 files (full admin web unit suite passing).

Exit criteria:

1. AC-COR-01: NOT VERIFIED (awaiting live deployment and test hardware)
2. AC-COR-02: NOT VERIFIED (awaiting integration test in staging)
3. AC-COR-03: NOT VERIFIED (awaiting integration test in staging)
4. AC-TEC-01: NOT VERIFIED (awaiting physical bench hardware E11)
5. AC-TEC-02: NOT VERIFIED (awaiting integration test in staging)
6. T-SEC-05: NOT VERIFIED (awaiting deployed API host E1)

External blockers:
E1: AWS dev account (college IT)
E7: Staging environment (college IT)
E11: Bench tracker hardware (ECE team)

Open decisions used:

| Ref  | Question                   | Default in force                                       | Owner            |
| ---- | -------------------------- | ------------------------------------------------------ | ---------------- |
| L-1  | BENCH device status        | `PROVISIONED`, `ACTIVE`, `BENCH`, `REVOKED`, `RETIRED` | Product owner    |
| L-4  | College SSO provider       | Dual Google Workspace and Microsoft Entra ID support   | College IT       |
| C-05 | Firmware update URLs       | Presigned GET valid 15m with SHA-256 and signature     | ECE team         |
| C-06 | Export link lifetime       | 24 hours                                               | Product owner    |
| C-09 | Duplicate sample rejection | Per-sample CONFLICT inside 200 response                | Engineering lead |
| OV-4 | Web shell extension        | P4-T1 extends P0-T19 web shell in apps/admin-web       | Product owner    |

Git log for this phase:

```
99979b1 P4-T9: implement bench mode exclusion and diagnostic telemetry (Decision L-1)
5817952 P4-T8: implement settings, feature flags, audit viewer, and T-SEC-05 verification
2486253 P4-T7: implement maintenance tickets and staged firmware rollout (C-05)
d0207e4 P4-T6: implement live fleet map, source-switch log, and dual-track comparison
c634154 P4-T5: implement user management, CSV bulk import, and deactivation (AC-COR-02, AC-COR-03)
48486b2 P4-T4: implement driver rosters, faculty oversight, and student route assignments
61ac62d P4-T3: implement routes, stops library, GeoJSON geometry, timetables and holidays (Part 20.8)
5a51c79 feat(fleet): complete P4-T2 buses and devices management with batch provisioning AC-COR-01 and AC-TEC-01/02
9b44a12 feat(web): complete P4-T1 web shell role routing MFA enrolment and session idle tracker
```
