# RB-04: Database Failover

## 1. Trigger

RDS PostgreSQL Multi-AZ primary instance failure, unreachable health check, or read-write failover event.

## 2. First Five Minutes

1. Verify RDS console for failover state and standby promotion status.
2. Check API connection pool error logs for reconnection backoff.
3. Ensure ECS tasks reconnect to promoted master DNS endpoint.
4. Verify PostGIS extension availability on the promoted replica.

## 3. Diagnosis

- Inspect AWS RDS event log for hardware degradation, OOM kill, or storage IOPS starvation.
- Check whether PgBouncer or NestJS Prisma client re-resolved the cluster endpoint.
- Run `SELECT current_user, pg_is_in_recovery();` to confirm primary read-write capability.

## 4. Mitigation

- Restart API pods if connection pools hold stale DNS or zombie sockets.
- Ensure `app_runtime` RLS grants and triggers are active on the newly promoted master.
- Verify replication lag on newly assigned standby.

## 5. Communication Template

> SERVICE NOTICE: Database automated failover completed. Reconnection in progress; expect brief latency stabilization.

## 6. Post-Incident Review

A blameless post-incident review must be conducted within five working days. The review must document root causes, action items, and prevention mechanisms.
