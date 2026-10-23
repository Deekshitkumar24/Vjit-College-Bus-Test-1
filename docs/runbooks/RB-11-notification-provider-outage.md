# RB-11: Notification Provider Outage

## 1. Trigger

Primary notification gateway (FCM, APNs, or SMS telecom aggregator) reports sustained service failure (> 5 minutes).

## 2. First Five Minutes

1. Check status page of third-party providers (Google Firebase, Apple System Status, SMS Gateway).
2. Verify dead letter count in notification outbox.
3. Switch active SMS provider route to secondary backup carrier in console settings.
4. Notify campus communications team.

## 3. Diagnosis

- Review HTTP error codes returned by provider endpoints (503 Service Unavailable, 401 Auth Failure, 429 Rate Limit).
- Check whether DLT sender ID or template scrubbers are rejecting messages.

## 4. Mitigation

- Reroute critical safety alerts to email (AWS SES) and in-app polling snapshots.
- For SOS emergencies, engage direct telephone tree to campus security control.
- Re-enable primary provider once upstream health confirms 100% recovery.

## 5. Communication Template

> NOTICE: Push notifications experiencing provider-side delays. In-app live map and alerts remain active.

## 6. Post-Incident Review

A blameless post-incident review must be conducted within five working days. The review must document root causes, action items, and prevention mechanisms.
