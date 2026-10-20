# RS-07: AWS SNS Webhook Signature Verification for SES Bounces & Complaints

**Document ID:** RS-07  
**Source:** Amazon SNS Developer Guide, AWS SES Event Publishing Guidelines  
**Date Checked:** 20 October 2026

---

## 1. Context & Architecture

When Amazon SES encounters an email bounce or complaint, it publishes a notification to an Amazon SNS Topic (`SNS_EMAIL_TOPIC_ARNS`). SNS then issues an HTTP POST webhook call to `services/api` (`POST /api/v1/webhooks/ses`).

To prevent webhook spoofing, the API must perform full cryptographic signature verification on the payload before acting on any message (`AG-MASTER-1.0` §13.19).

---

## 2. Signature Verification Algorithm

1. **Certificate URL Validation:**
   - Extract `SigningCertURL` from JSON payload.
   - Must be an HTTPS URL.
   - Hostname must match the strict regex: `^sns\.[a-z0-9\-]+\.amazonaws\.com(\.cn)?$` (e.g., `sns.ap-south-1.amazonaws.com`).
   - Download the X.509 certificate and cache in-memory with a 1-hour TTL.

2. **Topic ARN Validation:**
   - Compare payload `TopicArn` against the configured environment variable `SNS_EMAIL_TOPIC_ARNS`.
   - Reject immediately if not in the approved allowlist.

3. **Timestamp / Replay Guard:**
   - Parse `Timestamp` (ISO 8601 UTC).
   - Reject if older than 15 minutes (`AG-MASTER-1.0` §13.19).

4. **Construct Canonical String to Sign:**
   - For `Notification`:
     ```text
     Message\n<Message>\nMessageId\n<MessageId>\nSubject\n<Subject>\nTimestamp\n<Timestamp>\nTopicArn\n<TopicArn>\nType\nNotification\n
     ```
   - For `SubscriptionConfirmation`:
     ```text
     Message\n<Message>\nMessageId\n<MessageId>\nSubscribeURL\n<SubscribeURL>\nTimestamp\n<Timestamp>\nToken\n<Token>\nTopicArn\n<TopicArn>\nType\nSubscriptionConfirmation\n
     ```

5. **Signature Check:**
   - Decode base64 `Signature`.
   - Verify RSA-SHA1 / SHA256 against the downloaded X.509 certificate public key.

6. **Deduplication:**
   - Deduplicate incoming SNS messages by `MessageId` to ensure idempotent handling.
