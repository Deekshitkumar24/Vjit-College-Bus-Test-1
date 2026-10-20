# RS-11: pg-boss Background Queue Architecture & Job Scheduling

**Document ID:** RS-11  
**Source:** pg-boss (v10) GitHub and Documentation  
**Date Checked:** 20 October 2026  

---

## 1. Architectural Decisions
The MVP uses **pg-boss** running directly on PostgreSQL 16 (`SW-MVP-1.0` §6.2, §7; `AG-MASTER-1.0` §12.3).
- **No Redis Dependency:** Avoids running or maintaining a separate Redis cluster during MVP.
- **Transactional Enqueueing (Outbox Pattern):** Job rows can be scheduled inside the same database transaction that updates domain records, ensuring zero lost notifications or unprocessed events.
- **Concurrency & Scaling:** Uses PostgreSQL native `FOR UPDATE SKIP LOCKED` for lock-free parallel job dispatch across multiple worker instances (`services/worker`).

---

## 2. Queue Configuration & Retry Semantics
Every background job conforms to the following operational parameters (`AG-MASTER-1.0` §5.11, §12.3):

| Parameter | Configuration | Description |
|---|---|---|
| `retryLimit` | `6` | Maximum delivery attempts before dead-lettering (`SW-MVP-1.0` §6.2, §21.2) |
| `retryBackoff` | `true` | Exponential backoff between failed retries (1m, 5m, 30m, 2h) |
| `deadLetter` | `dead-letter-jobs` | Failed jobs after 6 attempts trigger Sev 1 / Sev 2 alerts |
| `singletonKey` | Dynamic (e.g. `bus_id`) | Enforces deduplication / single concurrent execution per entity |
| `expireInSeconds` | `30` to `300` | Job lease timeout; expired locks automatically release for redelivery |

---

## 3. Scheduled Cron Tasks Map (`AG-MASTER-1.0` §12.3, §21.6)

```typescript
// Cron specifications configured in services/worker
const scheduledJobs = [
  { name: 'trip-generator', cron: '30 0 * * *', tz: 'Asia/Kolkata' }, // Daily at 00:30 IST
  { name: 'retention-purger', cron: '0 2 * * *', tz: 'Asia/Kolkata' }, // Daily at 02:00 IST
  { name: 'coordinator-summary', cron: '0 8 * * *', tz: 'Asia/Kolkata' }, // Daily at 08:00 IST
  { name: 'cert-and-token-check', cron: '0 3 * * *', tz: 'Asia/Kolkata' }, // Daily at 03:00 IST
  { name: 'partition-manager', cron: '0 1 * * *', tz: 'Asia/Kolkata' }, // Daily at 01:00 IST
  { name: 'backup-verifier', cron: '0 4 * * *', tz: 'Asia/Kolkata' }, // Daily at 04:00 IST
  { name: 'rate-counter-cleanup', cron: '0 * * * *', tz: 'Asia/Kolkata' }, // Hourly
];
```

Fast intervals (source-selector every 5s, sos-escalator every 15s, stale-checker every 30s, shift-auto-end every 60s, late-start-check every 60s, boarding-cutoff every minute) are executed via scheduled polling loops and recurring pg-boss task handlers.
