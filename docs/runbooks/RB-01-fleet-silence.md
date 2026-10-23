# RB-01: Fleet Silence

## 1. Trigger
Zero telemetry received from > 50% of active buses for 3 consecutive minutes during active service hours.

## 2. First Five Minutes
1. Check CloudWatch / Prometheus alert dashboard for API gateway ingestion drop.
2. Verify cellular gateway / APN network status across carriers (Airtel / Jio).
3. Verify ALB health check status for telemetry ingestion ECS task group.
4. Declare SEV-1 incident in communication channel #incident-fleet-silence.

## 3. Diagnosis
- Inspect ECS ingestion container logs for TLS handshake failures or database connection pool exhaustion.
- Query PostgreSQL `location_samples` for the most recent timestamp received fleet-wide.
- Check if AWS WAF or ALB rate limiting rule is blocking tracker IPs.
- Query AWS CloudWatch for network bytes in/out on telemetry load balancer.

## 4. Mitigation
- If ECS service task unhealthy: scale task count +50% and restart failing tasks.
- If database pool exhausted: increase PgBouncer pool ceiling and recycle stuck idle connections.
- If cellular outage: send alert to college transport coordinators to instruct drivers to engage Driver App phone tracking fallback.
- If WAF block: temporarily bypass or adjust IP rate limiter on telemetry endpoints.

## 5. Communication Template
> URGENT: Fleet telemetry ingestion delay observed. Telemetry failover to driver phone tracking initiated. Estimated resolution time: 15 minutes.

## 6. Post-Incident Review
A blameless post-incident review must be conducted within five working days. The review must document root causes, action items, and prevention mechanisms.
