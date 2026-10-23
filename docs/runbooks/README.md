# Runbook Index: RB-01 to RB-13

| Ref | Runbook Title | Purpose |
| :--- | :--- | :--- |
| **RB-01** | [RB-01: Incident Response & Severity Classification](./RB-01-incident-response.md) | Severity 1-4 classification, escalation paths, on-call protocol |
| **RB-02** | [RB-02: SOS Emergency Triaging & Police Escalation](./RB-02-sos-emergency.md) | Tier 0-3 escalation, campus security & local police dispatch |
| **RB-03** | [RB-03: Tracker Hardware Replacement & Provisioning](./RB-03-tracker-hardware-replacement.md) | Swap tracker hardware, bind new device, preserve old history |
| **RB-04** | [RB-04: Firmware Canary & Rollback Procedure](./RB-04-firmware-canary-rollback.md) | Staged firmware deployment (canary 5% to 100%) and instant rollback |
| **RB-05** | [RB-05: Ingestion Pipeline Lag & Anti-Flapping Remediation](./RB-05-ingestion-lag-remediation.md) | Resolves telemetry lag, dead letter queues, and rapid source flapping |
| **RB-06** | [RB-06: Session Breach Invalidation & Family Revocation](./RB-06-session-breach-invalidation.md) | Refresh token reuse detection and instant family-wide session purge |
| **RB-07** | [RB-07: Data Subject Request (DSR) Erasure & Export](./RB-07-dsr-erasure-export.md) | GDPR / DPDP statutory erasure, SOS anonymization, export packaging |
| **RB-08** | [RB-08: Database Point-In-Time Recovery & Restore Drill](./RB-08-database-backup-restore.md) | Native PostgreSQL backup, restore procedure, and PostGIS verification |
| **RB-09** | [RB-09: DNS & CloudFront Failover](./RB-09-dns-cloudfront-failover.md) | Origin failover, Route 53 health checks, and global edge management |
| **RB-10** | [RB-10: DLT Entity & SMS Template Switchover](./RB-10-dlt-sms-switchover.md) | Regulatory SMS failure remediation and automatic fallback to push/email |
| **RB-11** | [RB-11: Turnstile Captcha Failure Fallback](./RB-11-turnstile-fallback.md) | Bot detection outage handling and sliding window rate limiter fallback |
| **RB-12** | [RB-12: Pilot Deployment & Driver Shift Onboarding](./RB-12-pilot-deployment.md) | 10-bus live pilot execution, driver roster validation, consent checks |
| **RB-13** | [RB-13: Production Clean Verification & Zero-Synthetic Data Audit](./RB-13-prod-clean-verification.md) | Validates clean production database with zero synthetic/mock records |
