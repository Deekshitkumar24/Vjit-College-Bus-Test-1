# RB-01: Incident Response & Severity Classification

## 1. Purpose
Defines the standard operational response to production alerts, system degradation, and outages across the College Bus Tracker platform.

## 2. Severity Levels
- **SEV-1 (Critical Outage):** Active SOS dispatch failure, complete API unavailability (>50% requests failing), or database unavailable.
  - *Response Time:* < 15 minutes.
  - *On-Call Escalation:* Engineering Lead, DevOps, Security Officer.
- **SEV-2 (Major Degradation):** Telemetry ingestion delayed > 60s for > 20% of buses, driver authentication failing, or SMS aggregator down.
  - *Response Time:* < 30 minutes.
- **SEV-3 (Moderate Defect):** Minor reporting failure, single bus GPS quality drop, or non-critical background job delay.
  - *Response Time:* < 4 hours.
- **SEV-4 (Minor/Cosmetic):** Minor UI styling issue or documentation discrepancy.
  - *Response Time:* Next business day.

## 3. Communication Protocol
1. Open Incident channel in Slack/Teams `#incident-<id>`.
2. Post status updates every 15 minutes for SEV-1.
3. Once mitigated, post Root Cause Analysis (RCA) within 24 hours.
