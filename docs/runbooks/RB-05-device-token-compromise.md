# RB-05: Device Token Compromise

## 1. Trigger

Suspicious device token activity: duplicate concurrent connections with differing IPs, or reported hardware theft.

## 2. First Five Minutes

1. Immediately identify compromised `device_id` and associated token prefix.
2. Execute token revocation API call or database update setting device status = 'REVOKED'.
3. Verify all active sessions and links associated with the hardware device are terminated.
4. Notify Campus Transportation Office and Hardware Engineering Team.

## 3. Diagnosis

- Query `device_heartbeats` and `location_samples` for geometric anomalies or conflicting telemetry.
- Check access logs for brute-force attacks or replay attempts on `/api/v1/telemetry`.

## 4. Mitigation

- Invalidate HMAC secret and rotate provisioning keys for the affected device batch.
- Provision replacement tracker hardware following standard technician workflow (AC-TEC-02).
- Add IP block if anomalous calls originate from known adversarial CIDR blocks.

## 5. Communication Template

> SECURITY NOTICE: Device token revoked due to security protocol. Hardware device isolated; fleet telemetry unaffected.

## 6. Post-Incident Review

A blameless post-incident review must be conducted within five working days. The review must document root causes, action items, and prevention mechanisms.
