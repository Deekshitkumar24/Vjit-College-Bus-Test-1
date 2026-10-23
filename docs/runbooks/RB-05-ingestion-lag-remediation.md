# RB-05: Ingestion Pipeline Lag & Anti-Flapping Remediation

## 1. Purpose
Diagnosing and resolving ingestion lag, queue buildup, and rapid source switching (Part 9.3).

## 2. Diagnostics
1. Check CloudWatch/Prometheus metric `ingestion_batch_latency_seconds`.
2. Inspect `source_switches` table for buses flapping > 3 times in 5 minutes.
3. Check PostgreSQL lock contention on `bus_state`.

## 3. Remediation
1. **Source Flapping:** Lock bus into `MANUAL_HW` or `MANUAL_PHONE` mode via Coordinator console to stabilize live views.
2. **Partition Lag:** Run `PartitionManager.ensurePartitionsAhead(7)` to ensure today's `location_samples_yyyy_mm_dd` exists.
3. **Database Concurrency:** Scale connection pool or increase worker ECS tasks.
