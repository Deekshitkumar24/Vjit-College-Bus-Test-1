# RB-07: Queue Backlog

## 1. Trigger

Telemetry ingestion or notification queue depth exceeds 10,000 messages or processing latency > 30 seconds.

## 2. First Five Minutes

1. Inspect queue metrics (Redis Streams / SQS message count and age).
2. Check worker consumer count and worker CPU/memory consumption.
3. Verify downstream database write throughput and IOPS limits.
4. Declare SEV-2 operational backlog.

## 3. Diagnosis

- Identify whether consumer workers are crashing, hanging on locks, or throttled by database writes.
- Check if backlog is caused by batch retry storms or invalid malformed payloads.

## 4. Mitigation

- Auto-scale worker fleet by +100% capacity.
- Divert poisoned/malformed messages to Dead Letter Queue (DLQ) for asynchronous analysis.
- Increase batch write transaction size in database ingestion pipeline.

## 5. Communication Template

> SYSTEM NOTICE: Temporary queuing delay in location updates. System auto-scaling engaged to clear backlog.

## 6. Post-Incident Review

A blameless post-incident review must be conducted within five working days. The review must document root causes, action items, and prevention mechanisms.
