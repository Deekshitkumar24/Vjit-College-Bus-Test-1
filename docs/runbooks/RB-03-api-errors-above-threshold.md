# RB-03: API Errors Above Threshold

## 1. Trigger

HTTP 5xx error rate exceeds 1% of total requests over a rolling 5-minute window.

## 2. First Five Minutes

1. Inspect Sentry real-time dashboard for newly spiked exception signatures.
2. Check CloudWatch ALB metrics for 502/503/504 vs 500 target responses.
3. Verify database CPU utilization and connection counts in RDS metrics.
4. Check memory usage on API ECS tasks.

## 3. Diagnosis

- Identify offending route path from access logs (e.g. /api/v1/telemetry or /api/v1/snapshot).
- Determine if errors are caused by database lock contention, third-party timeout, or unhandled null pointer.
- Check recent git deployment commits within the last 2 hours.

## 4. Mitigation

- If correlated with recent release: execute RB-08 (Release Rollback).
- If database contention: kill long-running analytical queries blocking transaction slots.
- If memory leak: trigger rolling restart of ECS API tasks.

## 5. Communication Template

> SYSTEM STATUS: Elevated API error rates detected. Technical team is mitigating. Critical safety services remain monitored.

## 6. Post-Incident Review

A blameless post-incident review must be conducted within five working days. The review must document root causes, action items, and prevention mechanisms.
