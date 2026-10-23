# RB-02: SOS Not Delivered

## 1. Trigger
SOS event triggered but no push/SMS dispatched within 5 seconds (T-SOS-01 breach) or dead-letter queue count > 0.

## 2. First Five Minutes
1. Verify active SOS incidents table in database (`SELECT * FROM sos_incidents WHERE status = 'OPEN';`).
2. Check notification dispatcher queue lag and dead-letter queue (DLQ) in Redis / SQS.
3. Check FCM / APNs error rates and SES / SMS provider health.
4. Escalate immediately to On-Call Lead and Campus Security Coordinator.

## 3. Diagnosis
- Check logs in `NotificationDispatcherService` for third-party provider timeouts or credential expiry.
- Verify recipient resolution logic for on-duty security staff and coordinators.
- Query `sos_events` table for unacknowledged events older than 60 seconds.

## 4. Mitigation
- Trigger manual SMS broadcast via backup telecom route for all open SOS incidents.
- Restart stuck notification dispatch worker instances.
- Direct voice phone call to campus security control room for any unacknowledged SOS.

## 5. Communication Template
> SECURITY ALERT: Automated SOS push delivery experiencing delay. Emergency response personnel notified via direct voice dispatch.

## 6. Post-Incident Review
A blameless post-incident review must be conducted within five working days. The review must document root causes, action items, and prevention mechanisms.
