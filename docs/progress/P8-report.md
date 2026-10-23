# Phase Report: P8 Security Hardening and Load

**Phase ID:** P8  
**Status:** COMPLETE (Local Gates Verified; Staging & Cloud Exits BLOCKED-EXTERNAL)  
**Date:** 23 October 2026

---

## 1. Task Inventory

| Task ID   | Scope                                                                   | Tests (Count & IDs)                   | Evidence Path                                        |        Status        |
| :-------- | :---------------------------------------------------------------------- | :------------------------------------ | :--------------------------------------------------- | :------------------: |
| **P8-T1** | IDOR verification test suite across tenant boundary endpoints           | 1 (`IDOR Suite`)                      | `docs/progress/evidence/P8-security-hardening.log`   |       **DONE**       |
| **P8-T2** | Security headers and injection payload test suite                       | 2 (`SQLi`, `Headers`)                 | `docs/progress/evidence/P8-security-hardening.log`   |       **DONE**       |
| **P8-T3** | Software Bill of Materials (SBOM) generation                            | CycloneDX / JSON SBOM                 | `docs/progress/evidence/sbom.json`                   |       **DONE**       |
| **P8-T4** | Backup and restore drill rehearsal (RB-08) against native PostgreSQL 16 | 2 (Backup & Restore parity)           | `docs/progress/evidence/P8-backup-restore-drill.log` |       **DONE**       |
| **P8-T5** | Dependency vulnerability scan (pnpm audit --prod --audit-level=high)    | 0 high / 0 critical                   | `docs/progress/evidence/P8-security-hardening.log`   |       **DONE**       |
| **P8-T6** | External penetration testing engagement check                           | Blocked on budget & vendor engagement | Stays open pending `E8`                              | **BLOCKED-EXTERNAL** |
| **P8-T7** | Staging load and failover checks (T-LOAD-01, T-LOAD-02, T-FO-01..04)    | Blocked on AWS dev/staging accounts   | Stays open pending `E1`, `E7`                        | **BLOCKED-EXTERNAL** |
| **P8-T8** | Local security hardening test suite consolidation                       | 4 tests passed on native DB           | `docs/progress/evidence/P8-security-hardening.log`   |       **DONE**       |

---

## 2. Exit Criteria

| Exit Item                   | Description                                                               |        Status        | Evidence / Blocker                                                    |
| :-------------------------- | :------------------------------------------------------------------------ | :------------------: | :-------------------------------------------------------------------- |
| **Part 13 Checks (Local)**  | IDOR suite, SQLi protection, security headers, Argon2id replay protection |     **VERIFIED**     | Real DB test passing (`p8-security-hardening.spec.ts`)                |
| **Backup & Restore Drill**  | pg_dump and psql restore rehearsal with verified parity (RB-08)           |     **VERIFIED**     | Measured 803ms backup, 3198ms restore (`P8-backup-restore-drill.log`) |
| **Audit Scan**              | 0 high or critical vulnerabilities in production dependencies             |     **VERIFIED**     | `pnpm audit --prod --audit-level=high` (0 high, 0 crit)               |
| **SBOM**                    | Complete Software Bill of Materials generated                             |     **VERIFIED**     | Generated in `docs/progress/evidence/sbom.json`                       |
| **TLS / Deployed HSTS**     | Live TLS configuration and HSTS scans on deployed hosts                   | **BLOCKED-EXTERNAL** | Awaiting deployed host `E1`                                           |
| **Staging Load & Failover** | T-LOAD-01, T-LOAD-02, T-FO-01 to T-FO-04 on staging                       | **BLOCKED-EXTERNAL** | Awaiting staging environment `E7`                                     |
| **Penetration Test**        | External penetration testing before launch                                | **BLOCKED-EXTERNAL** | Awaiting penetration tester engaged `E8`                              |

---

## 3. Rules Added to RULES.md

- **Rule 17:** All queries fetching tenant resources must include the caller's `college_id` in the filter predicate or rely on strict RLS policies to eliminate IDOR vulnerabilities.
- **Rule 18:** Recovery codes must be hashed using Argon2id with work parameters `m=65536, t=3, p=4` and rejected unconditionally upon replay.
- **Rule 19:** Backup and restore drills must verify PostGIS functional integrity and row count parity on the target database after restore.

---

## 4. Open External Items

- `E1`: AWS dev account (college IT)
- `E7`: Staging environment (college IT)
- `E8`: Penetration tester engaged (college IT / owner)
