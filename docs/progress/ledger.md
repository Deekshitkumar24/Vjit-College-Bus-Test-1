# System Exit Criteria Ledger

| Exit ID | Phase | Description | Status | Evidence Path | Unlocking External Input |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **P0-EXIT-01** | P0 | SSO dev sign-in against college test tenant | **BLOCKED-EXTERNAL** | `pnpm activate:sso` | E3 |
| **P0-EXIT-02** | P0 | verify:routes-auth passes across all endpoints | **VERIFIED** | `docs/progress/evidence/P0-T7.log` | - |
| **P0-EXIT-03** | P0 | RLS integration on PostgreSQL 16 PostGIS | **VERIFIED** | `docs/progress/evidence/test-rls.json` | - |
| **P0-EXIT-04** | P0 | CI green on GitHub Actions | **BLOCKED-EXTERNAL** | `pnpm activate:ci` | E2 |
| **P0-EXIT-05** | P0 | Security headers on API host | **BLOCKED-EXTERNAL** | `pnpm activate:headers` | E1 |
| **P1-EXIT-01** | P1 | Simulator drives 50 buses across 6 scenarios | **VERIFIED** | `docs/progress/evidence/P1-T11.log` | - |
| **P1-EXIT-02** | P1 | Contract harness passes on recorded streams | **VERIFIED** | `docs/progress/evidence/P1-T10.log` | - |
| **P1-EXIT-03** | P1 | T-LOAD-01 50-bus load test on staging | **BLOCKED-EXTERNAL** | `pnpm activate:staging-load` | E1, E7 |
| **P2-EXIT-01** | P2 | AC-STU-01 to AC-STU-05 on physical device | **BLOCKED-EXTERNAL** | `pnpm activate:device-p2` | E6, E3 |
| **P2-EXIT-02** | P2 | AC-FAC-01 to AC-FAC-03 on physical device | **BLOCKED-EXTERNAL** | `pnpm activate:device-p2` | E6, E3 |
| **P3-EXIT-01** | P3 | AC-DRV-01 to AC-DRV-04 on physical reference phone | **BLOCKED-EXTERNAL** | `pnpm activate:device-p3` | E6, E3 |
| **P3-EXIT-02** | P3 | Two-hour battery test (T-MOB-01 <= 8%/hr) | **BLOCKED-EXTERNAL** | `pnpm activate:battery` | E6 |
| **P4-EXIT-01** | P4 | AC-COR-01 (revocation & ticket creation) | **VERIFIED** | `docs/progress/evidence/P4-T2.log` | - |
| **P4-EXIT-02** | P4 | AC-COR-02 (CSV dry-run rejection) | **VERIFIED** | `docs/progress/evidence/P4-T3.log` | - |
| **P4-EXIT-03** | P4 | AC-COR-03 (user deactivation session revoke) | **VERIFIED** | `docs/progress/evidence/P4-T4.log` | - |
| **P4-EXIT-04** | P4 | AC-TEC-01 (bench tracker first heartbeat < 2m) | **BLOCKED-EXTERNAL** | `pnpm activate:bench` | E11 |
| **P4-EXIT-05** | P4 | AC-TEC-02 (device replacement history) | **VERIFIED** | `docs/progress/evidence/P4-T5.log` | - |
| **P4-EXIT-06** | P4 | T-SEC-05 (admin endpoints 403/404) | **VERIFIED** | `docs/progress/evidence/P4-T9.log` | - |
| **P5-EXIT-01** | P5 | T-ATT-01 (QR code valid 30s, rejected 65s) | **VERIFIED** | `docs/progress/evidence/P5-T2.log` | - |
| **P5-EXIT-02** | P5 | T-ATT-02 (duplicate scan rejected) | **VERIFIED** | `docs/progress/evidence/P5-T3.log` | - |
| **P5-EXIT-03** | P5 | T-ATT-03 (morning present, afternoon absent alert) | **VERIFIED** | `docs/progress/evidence/P5-T4.log` | - |
| **P5-EXIT-04** | P5 | T-ATT-04 (leave prevents absence alert) | **VERIFIED** | `docs/progress/evidence/P5-T5.log` | - |
| **P5-EXIT-05** | P5 | T-CON-01 (two parallel transactions unique index) | **VERIFIED** | `docs/progress/evidence/P5-T6.log` | - |
| **P6-EXIT-01** | P6 | T-SOS-01 (Tier 0 push within 5s at p95) | **BLOCKED-EXTERNAL** | `pnpm activate:push` | E12, E1 |
| **P6-EXIT-02** | P6 | T-SOS-02 (two triggers 20s apart join one incident) | **VERIFIED** | `docs/progress/evidence/P6-T1.json` | - |
| **P6-EXIT-03** | P6 | T-SOS-03 (two buses in same second create 2 incidents) | **VERIFIED** | `docs/progress/evidence/P6-T2.json` | - |
| **P6-EXIT-04** | P6 | T-SOS-04 (tier 1 after 2 minutes unacknowledged) | **VERIFIED** | `docs/progress/evidence/P6-T3.json` | - |
| **P6-EXIT-05** | P6 | T-SOS-05 (cancellation refused after ack) | **VERIFIED** | `docs/progress/evidence/P6-T4.json` | - |
| **P6-EXIT-06** | P6 | T-SOS-06 (missing recipient list raises setup alert) | **VERIFIED** | `docs/progress/evidence/P6-T5.json` | - |
| **P6-EXIT-07** | P6 | T-NTF-01 (quiet hours non-safety suppressed) | **VERIFIED** | `docs/progress/evidence/P6-T6.json` | - |
| **P6-EXIT-08** | P6 | T-NTF-02 (rate limit 5/min at dispatch) | **VERIFIED** | `docs/progress/evidence/P6-T7.json` | - |
| **P6-EXIT-09** | P6 | T-NTF-03 (SMS template mismatch blocked) | **VERIFIED** | `docs/progress/evidence/P6-T8.json` | - |
| **P6-EXIT-10** | P6 | T-CON-03 (parallel SOS triggers create one incident) | **VERIFIED** | `docs/progress/evidence/P6-T1.json` | - |
| **P6-EXIT-11** | P6 | T-LOAD-02 (SOS burst of five buses on staging) | **BLOCKED-EXTERNAL** | `pnpm activate:staging-load` | E7 |
| **P6-EXIT-12** | P6 | Live SMS transmission via DLT | **BLOCKED-EXTERNAL** | `pnpm activate:sms` | E13 |
| **P7-EXIT-01** | P7 | T-SEC-03 (CSV formula injection escaped) | **VERIFIED** | `docs/progress/evidence/P7-T1.json` | - |
| **P7-EXIT-02** | P7 | T-PRV-01 (under-18 restricted without consent) | **VERIFIED** | `docs/progress/evidence/P7-T2.json` | - |
| **P7-EXIT-03** | P7 | T-PRV-02 (deletion removes attendance, anonymizes SOS) | **VERIFIED** | `docs/progress/evidence/P7-T3.json` | - |
| **P7-EXIT-04** | P7 | T-PRV-03 (retention purges expired partitions) | **VERIFIED** | `docs/progress/evidence/P7-T4.json` | - |
| **P7-EXIT-05** | P7 | Exports (100k limit & 24h presigned URLs) | **VERIFIED** | `docs/progress/evidence/P7-T5.json` | - |
| **P7-EXIT-06** | P7 | Staging infrastructure apply | **BLOCKED-EXTERNAL** | `pnpm activate:staging-load` | E1, E7 |
| **P8-EXIT-01** | P8 | Part 13 checks (IDOR, SQLi, headers, Argon2id) | **VERIFIED** | `docs/progress/evidence/P8-T1.json` | - |
| **P8-EXIT-02** | P8 | Backup and restore drill (RB-09 rehearsal) | **VERIFIED** | `docs/progress/evidence/P8-backup-restore-drill.log` | - |
| **P8-EXIT-03** | P8 | Zero high/critical audit findings | **VERIFIED** | `docs/progress/evidence/P8-T3.json` | - |
| **P8-EXIT-04** | P8 | Complete SBOM generated | **VERIFIED** | `docs/progress/evidence/P8-T4.json` | - |
| **P8-EXIT-05** | P8 | TLS scan & HSTS on deployed hosts | **BLOCKED-EXTERNAL** | `pnpm activate:headers` | E1 |
| **P8-EXIT-06** | P8 | Staging load and failover tests (T-FO-01..04) | **BLOCKED-EXTERNAL** | `pnpm activate:staging-load` | E1, E7 |
| **P8-EXIT-07** | P8 | Third-party penetration testing | **BLOCKED-EXTERNAL** | `pnpm activate:pentest` | E8 |
| **P9-EXIT-01** | P9 | Runbooks RB-01 to RB-13 written | **NOT VERIFIED** | `docs/progress/evidence/P9-EXIT-01.json` | - |
| **P9-EXIT-02** | P9 | verify:prod-clean dry run passed | **VERIFIED** | `docs/progress/evidence/P9-T2.json` | - |
| **P9-EXIT-03** | P9 | EAS builds & store submission | **BLOCKED-EXTERNAL** | `pnpm activate:stores` | E9, E14 |
| **P9-EXIT-04** | P9 | 2-week, 10-bus live operational pilot | **BLOCKED-EXTERNAL** | `pnpm activate:pilot` | E10, O7 |
| **P9-EXIT-05** | P9 | Staging purge | **BLOCKED-EXTERNAL** | `pnpm activate:purge-staging` | E7 |
| **P9-EXIT-06** | P9 | Production Terraform apply | **BLOCKED-OWNER** | `infra/terraform/environments/production/` | E1 + Owner instruction "GO: apply production" |
| **P9-EXIT-07** | P9 | Production verify:prod-clean run | **BLOCKED-EXTERNAL** | `` | Gated on P9-EXIT-06 |
