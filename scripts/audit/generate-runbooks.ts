import * as fs from 'fs';
import * as path from 'path';

const runbooks = [
  {
    id: 'RB-01',
    slug: 'RB-01-fleet-silence',
    title: 'Fleet Silence',
    trigger: 'Zero telemetry received from > 50% of active buses for 3 consecutive minutes during active service hours.',
    firstFiveMinutes: [
      '1. Check CloudWatch / Prometheus alert dashboard for API gateway ingestion drop.',
      '2. Verify cellular gateway / APN network status across carriers (Airtel / Jio).',
      '3. Verify ALB health check status for telemetry ingestion ECS task group.',
      '4. Declare SEV-1 incident in communication channel #incident-fleet-silence.',
    ],
    diagnosis: [
      '- Inspect ECS ingestion container logs for TLS handshake failures or database connection pool exhaustion.',
      '- Query PostgreSQL `location_samples` for the most recent timestamp received fleet-wide.',
      '- Check if AWS WAF or ALB rate limiting rule is blocking tracker IPs.',
      '- Query AWS CloudWatch for network bytes in/out on telemetry load balancer.',
    ],
    mitigation: [
      '- If ECS service task unhealthy: scale task count +50% and restart failing tasks.',
      '- If database pool exhausted: increase PgBouncer pool ceiling and recycle stuck idle connections.',
      '- If cellular outage: send alert to college transport coordinators to instruct drivers to engage Driver App phone tracking fallback.',
      '- If WAF block: temporarily bypass or adjust IP rate limiter on telemetry endpoints.',
    ],
    commTemplate: 'URGENT: Fleet telemetry ingestion delay observed. Telemetry failover to driver phone tracking initiated. Estimated resolution time: 15 minutes.',
  },
  {
    id: 'RB-02',
    slug: 'RB-02-sos-not-delivered',
    title: 'SOS Not Delivered',
    trigger: 'SOS event triggered but no push/SMS dispatched within 5 seconds (T-SOS-01 breach) or dead-letter queue count > 0.',
    firstFiveMinutes: [
      '1. Verify active SOS incidents table in database (`SELECT * FROM sos_incidents WHERE status = \'OPEN\';`).',
      '2. Check notification dispatcher queue lag and dead-letter queue (DLQ) in Redis / SQS.',
      '3. Check FCM / APNs error rates and SES / SMS provider health.',
      '4. Escalate immediately to On-Call Lead and Campus Security Coordinator.',
    ],
    diagnosis: [
      '- Check logs in `NotificationDispatcherService` for third-party provider timeouts or credential expiry.',
      '- Verify recipient resolution logic for on-duty security staff and coordinators.',
      '- Query `sos_events` table for unacknowledged events older than 60 seconds.',
    ],
    mitigation: [
      '- Trigger manual SMS broadcast via backup telecom route for all open SOS incidents.',
      '- Restart stuck notification dispatch worker instances.',
      '- Direct voice phone call to campus security control room for any unacknowledged SOS.',
    ],
    commTemplate: 'SECURITY ALERT: Automated SOS push delivery experiencing delay. Emergency response personnel notified via direct voice dispatch.',
  },
  {
    id: 'RB-03',
    slug: 'RB-03-api-errors-above-threshold',
    title: 'API Errors Above Threshold',
    trigger: 'HTTP 5xx error rate exceeds 1% of total requests over a rolling 5-minute window.',
    firstFiveMinutes: [
      '1. Inspect Sentry real-time dashboard for newly spiked exception signatures.',
      '2. Check CloudWatch ALB metrics for 502/503/504 vs 500 target responses.',
      '3. Verify database CPU utilization and connection counts in RDS metrics.',
      '4. Check memory usage on API ECS tasks.',
    ],
    diagnosis: [
      '- Identify offending route path from access logs (e.g. /api/v1/telemetry or /api/v1/snapshot).',
      '- Determine if errors are caused by database lock contention, third-party timeout, or unhandled null pointer.',
      '- Check recent git deployment commits within the last 2 hours.',
    ],
    mitigation: [
      '- If correlated with recent release: execute RB-08 (Release Rollback).',
      '- If database contention: kill long-running analytical queries blocking transaction slots.',
      '- If memory leak: trigger rolling restart of ECS API tasks.',
    ],
    commTemplate: 'SYSTEM STATUS: Elevated API error rates detected. Technical team is mitigating. Critical safety services remain monitored.',
  },
  {
    id: 'RB-04',
    slug: 'RB-04-database-failover',
    title: 'Database Failover',
    trigger: 'RDS PostgreSQL Multi-AZ primary instance failure, unreachable health check, or read-write failover event.',
    firstFiveMinutes: [
      '1. Verify RDS console for failover state and standby promotion status.',
      '2. Check API connection pool error logs for reconnection backoff.',
      '3. Ensure ECS tasks reconnect to promoted master DNS endpoint.',
      '4. Verify PostGIS extension availability on the promoted replica.',
    ],
    diagnosis: [
      '- Inspect AWS RDS event log for hardware degradation, OOM kill, or storage IOPS starvation.',
      '- Check whether PgBouncer or NestJS Prisma client re-resolved the cluster endpoint.',
      '- Run `SELECT current_user, pg_is_in_recovery();` to confirm primary read-write capability.',
    ],
    mitigation: [
      '- Restart API pods if connection pools hold stale DNS or zombie sockets.',
      '- Ensure `app_runtime` RLS grants and triggers are active on the newly promoted master.',
      '- Verify replication lag on newly assigned standby.',
    ],
    commTemplate: 'SERVICE NOTICE: Database automated failover completed. Reconnection in progress; expect brief latency stabilization.',
  },
  {
    id: 'RB-05',
    slug: 'RB-05-device-token-compromise',
    title: 'Device Token Compromise',
    trigger: 'Suspicious device token activity: duplicate concurrent connections with differing IPs, or reported hardware theft.',
    firstFiveMinutes: [
      '1. Immediately identify compromised `device_id` and associated token prefix.',
      '2. Execute token revocation API call or database update setting device status = \'REVOKED\'.',
      '3. Verify all active sessions and links associated with the hardware device are terminated.',
      '4. Notify Campus Transportation Office and Hardware Engineering Team.',
    ],
    diagnosis: [
      '- Query `device_heartbeats` and `location_samples` for geometric anomalies or conflicting telemetry.',
      '- Check access logs for brute-force attacks or replay attempts on `/api/v1/telemetry`.',
    ],
    mitigation: [
      '- Invalidate HMAC secret and rotate provisioning keys for the affected device batch.',
      '- Provision replacement tracker hardware following standard technician workflow (AC-TEC-02).',
      '- Add IP block if anomalous calls originate from known adversarial CIDR blocks.',
    ],
    commTemplate: 'SECURITY NOTICE: Device token revoked due to security protocol. Hardware device isolated; fleet telemetry unaffected.',
  },
  {
    id: 'RB-06',
    slug: 'RB-06-certificate-renewal-failure',
    title: 'Certificate Renewal Failure',
    trigger: 'ACM or CloudFront SSL/TLS certificate expires in <= 14 days without automatic renewal confirmation.',
    firstFiveMinutes: [
      '1. Inspect AWS Certificate Manager (ACM) console in us-east-1 and ap-south-1.',
      '2. Check Route 53 DNS validation CNAME records for domain verification.',
      '3. Verify domain WHOIS / registrar administrative contact.',
      '4. Escalate to DevOps Lead for manual DNS validation.',
    ],
    diagnosis: [
      '- Check if DNS authorization CNAME records were inadvertently modified or deleted.',
      '- Verify CAA (Certificate Authority Authorization) records allow Amazon Trust Services.',
    ],
    mitigation: [
      '- Re-create missing DNS CNAME verification records in Route 53.',
      '- Request immediate certificate re-issuance through ACM.',
      '- Associate renewed certificate with CloudFront distribution and ALB listener.',
    ],
    commTemplate: 'INFRASTRUCTURE ADVISORY: SSL certificate renewal in progress. No user-facing interruption expected.',
  },
  {
    id: 'RB-07',
    slug: 'RB-07-queue-backlog',
    title: 'Queue Backlog',
    trigger: 'Telemetry ingestion or notification queue depth exceeds 10,000 messages or processing latency > 30 seconds.',
    firstFiveMinutes: [
      '1. Inspect queue metrics (Redis Streams / SQS message count and age).',
      '2. Check worker consumer count and worker CPU/memory consumption.',
      '3. Verify downstream database write throughput and IOPS limits.',
      '4. Declare SEV-2 operational backlog.',
    ],
    diagnosis: [
      '- Identify whether consumer workers are crashing, hanging on locks, or throttled by database writes.',
      '- Check if backlog is caused by batch retry storms or invalid malformed payloads.',
    ],
    mitigation: [
      '- Auto-scale worker fleet by +100% capacity.',
      '- Divert poisoned/malformed messages to Dead Letter Queue (DLQ) for asynchronous analysis.',
      '- Increase batch write transaction size in database ingestion pipeline.',
    ],
    commTemplate: 'SYSTEM NOTICE: Temporary queuing delay in location updates. System auto-scaling engaged to clear backlog.',
  },
  {
    id: 'RB-08',
    slug: 'RB-08-rolling-back-an-api-or-app-release',
    title: 'Rolling Back an API or App Release',
    trigger: 'Critical bug, security defect, or severe regression discovered immediately following a production deployment.',
    firstFiveMinutes: [
      '1. Halt ongoing deployment pipeline in GitHub Actions / CodeDeploy.',
      '2. Notify engineering leads and incident management channel.',
      '3. Identify previous stable release commit SHA and container image digest.',
      '4. Issue rollback deployment command.',
    ],
    diagnosis: [
      '- Review diff between previous release and broken release.',
      '- Verify whether database schema migrations were applied and whether they are backward-compatible (expand-only per P0-T5).',
      '- Check client error reports in Sentry and crash logs.',
    ],
    mitigation: [
      '- Roll back ECS task definition to previous stable task revision.',
      '- If mobile app release affected: halt Google Play / Apple staged rollout immediately.',
      '- Flush CloudFront edge cache if static web console assets were affected.',
      '- Verify health probes return 200 OK across all rolled-back instances.',
    ],
    commTemplate: 'DEPLOYMENT NOTICE: Production release rolled back to previous stable baseline. Services operational and verified.',
  },
  {
    id: 'RB-09',
    slug: 'RB-09-restoring-from-backup',
    title: 'Restoring from Backup',
    trigger: 'Catastrophic database corruption, accidental table truncation, or hardware failure requiring full snapshot restore.',
    firstFiveMinutes: [
      '1. Freeze API writes by enabling maintenance mode banner.',
      '2. Identify target point-in-time recovery (PITR) timestamp or latest verified snapshot.',
      '3. Provision restore target database instance in RDS.',
      '4. Notify executive stakeholders and campus leadership.',
    ],
    diagnosis: [
      '- Inspect audit logs to establish exact timestamp and scope of data loss.',
      '- Verify integrity of automated S3 WAL archives and pg_dump backups.',
    ],
    mitigation: [
      '- Execute restore procedure (tested via `backup-restore-drill.ts`).',
      '- Verify row counts, foreign key integrity, and PostGIS extension functionality.',
      '- Verify checksum equality against known pre-incident records.',
      '- Repoint API connection strings to restored database instance and disable maintenance mode.',
    ],
    commTemplate: 'EMERGENCY MAINTENANCE: Database restore executed successfully from verified backup. Full data parity confirmed.',
  },
  {
    id: 'RB-10',
    slug: 'RB-10-halting-a-firmware-rollout',
    title: 'Halting a Firmware Rollout',
    trigger: 'Firmware canary update causes device crash loop, GPS freeze, or elevated battery drain on reference fleet.',
    firstFiveMinutes: [
      '1. Access firmware management console / API.',
      '2. Revoke active firmware target URL in `firmware_updates` table.',
      '3. Set device firmware target back to stable baseline version.',
      '4. Alert ECE hardware team.',
    ],
    diagnosis: [
      '- Analyze heartbeat error codes returned by upgraded units.',
      '- Check device cellular signal levels and crash dump telemetry.',
    ],
    mitigation: [
      '- Issue rollback firmware image via next heartbeat response (H1-H8 / C-05).',
      '- Physically quarantine affected vehicles if tracker fails to communicate.',
      '- Deploy field technician with manual serial flasher if OTA recovery fails.',
    ],
    commTemplate: 'FIRMWARE ADVISORY: Firmware OTA rollout halted due to diagnostic alert. Devices reverted to stable baseline.',
  },
  {
    id: 'RB-11',
    slug: 'RB-11-notification-provider-outage',
    title: 'Notification Provider Outage',
    trigger: 'Primary notification gateway (FCM, APNs, or SMS telecom aggregator) reports sustained service failure (> 5 minutes).',
    firstFiveMinutes: [
      '1. Check status page of third-party providers (Google Firebase, Apple System Status, SMS Gateway).',
      '2. Verify dead letter count in notification outbox.',
      '3. Switch active SMS provider route to secondary backup carrier in console settings.',
      '4. Notify campus communications team.',
    ],
    diagnosis: [
      '- Review HTTP error codes returned by provider endpoints (503 Service Unavailable, 401 Auth Failure, 429 Rate Limit).',
      '- Check whether DLT sender ID or template scrubbers are rejecting messages.',
    ],
    mitigation: [
      '- Reroute critical safety alerts to email (AWS SES) and in-app polling snapshots.',
      '- For SOS emergencies, engage direct telephone tree to campus security control.',
      '- Re-enable primary provider once upstream health confirms 100% recovery.',
    ],
    commTemplate: 'NOTICE: Push notifications experiencing provider-side delays. In-app live map and alerts remain active.',
  },
  {
    id: 'RB-12',
    slug: 'RB-12-personal-data-breach-response',
    title: 'Personal Data Breach Response',
    trigger: 'Unauthorized exfiltration, credential leak, or inadvertent disclosure of personally identifiable information (PII).',
    firstFiveMinutes: [
      '1. Immediately revoke compromised session tokens, API keys, and IAM credentials.',
      '2. Isolate affected network endpoints and enable strict CloudFront WAF block.',
      '3. Preserve all access logs, audit logs, and database transaction logs for forensic review.',
      '4. Notify Data Protection Officer (DPO), College Counsel, and Incident Response Team.',
    ],
    diagnosis: [
      '- Analyze `audit_logs` table (append-only protected) for unauthorized SELECT/EXPORT activity.',
      '- Identify exact student/faculty records accessed or exported.',
      '- Determine breach vector (IDOR, credential compromise, misconfigured S3 bucket).',
    ],
    mitigation: [
      '- Patch exploited vulnerability and rotate all production database credentials.',
      '- Invalidate all active user sessions across mobile and web consoles.',
      '- Prepare formal regulatory breach notification in compliance with DPDP / GDPR requirements within 72 hours.',
    ],
    commTemplate: 'SECURITY ADVISORY: Security incident contained. No evidence of ongoing exposure. Affected users will receive direct advisory.',
  },
  {
    id: 'RB-13',
    slug: 'RB-13-use-of-the-emergency-access-account',
    title: 'Use of the Emergency Access Account',
    trigger: 'Break-glass root/superuser access required due to total lockout, infrastructure failure, or security disaster.',
    firstFiveMinutes: [
      '1. Two-person authorization: obtain dual sign-off from Engineering Lead and Campus Security Officer.',
      '2. Retrieve emergency credential from encrypted hardware vault.',
      '3. Initiate screen recording and session logging on dedicated bastion host.',
      '4. Notify executive stakeholders before accessing production.',
    ],
    diagnosis: [
      '- Establish specific technical blocker preventing normal role-based access.',
      '- Document every command executed in the emergency session log.',
    ],
    mitigation: [
      '- Perform only minimal actions necessary to restore standard administrative access.',
      '- Revoke emergency session immediately upon resolution.',
      '- Rotate break-glass credentials and generate new recovery codes.',
    ],
    commTemplate: 'AUDIT ADVISORY: Emergency break-glass access activated under dual authorization. Incident logging enabled.',
  },
];

const runbooksDir = path.resolve('docs/runbooks');
if (!fs.existsSync(runbooksDir)) {
  fs.mkdirSync(runbooksDir, { recursive: true });
}

// Clean old mismatching files
const existingFiles = fs.readdirSync(runbooksDir);
for (const file of existingFiles) {
  if (file.endsWith('.md') && file !== 'README.md') {
    fs.unlinkSync(path.join(runbooksDir, file));
  }
}

for (const rb of runbooks) {
  const filePath = path.join(runbooksDir, `${rb.slug}.md`);
  let content = `# ${rb.id}: ${rb.title}\n\n`;
  content += `## 1. Trigger\n${rb.trigger}\n\n`;
  content += `## 2. First Five Minutes\n${rb.firstFiveMinutes.join('\n')}\n\n`;
  content += `## 3. Diagnosis\n${rb.diagnosis.join('\n')}\n\n`;
  content += `## 4. Mitigation\n${rb.mitigation.join('\n')}\n\n`;
  content += `## 5. Communication Template\n> ${rb.commTemplate}\n\n`;
  content += `## 6. Post-Incident Review\nA blameless post-incident review must be conducted within five working days. The review must document root causes, action items, and prevention mechanisms.\n`;

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Generated: ${filePath}`);
}

console.log('All 13 canonical runbooks RB-01 to RB-13 written with complete Part 20.12 sections.');
