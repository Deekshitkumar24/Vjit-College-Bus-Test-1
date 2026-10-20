# RS-06: DLT Transactional SMS Architecture & Ingestion Webhooks (India)

**Document ID:** RS-06  
**Source:** Telecom Regulatory Authority of India (TRAI) TCCCPR 2018, DLT Provider Protocols  
**Date Checked:** 20 October 2026  

---

## 1. TRAI Regulatory Framework & DLT Requirements
In accordance with TRAI regulations for commercial communications:
1. **Entity Registration:** The college entity must be registered as a Principal Entity on a telecom DLT portal (e.g., Vilpower / Jio / Airtel / Smartping).
2. **Sender ID (Header):** 6-character alphabetic header assigned to the college (e.g., `CLGBUS`).
3. **Template Registration:** Every SMS message pattern must be pre-approved as a **Service Implicit / Transactional** template. Any message body that does not match an approved template with its exact static text and placeholder variables is rejected by the carrier and never sent (`SW-MVP-1.0` §21.5).

---

## 2. Approved MVP SMS Templates

| Template ID | Purpose | Registered Pattern |
|---|---|---|
| `DLT_TMP_01` | SOS Tier 1 Escalation | `[EMERGENCY] SOS triggered on {#var#}. No acknowledgment received. Open console: {#var#}` |
| `DLT_TMP_02` | SOS Tier 2 Escalation | `[CRITICAL] Unacknowledged SOS on {#var#} for 5 mins. Duty staff must respond immediately: {#var#}` |
| `DLT_TMP_03` | SOS Tier 3 Escalation | `[EMERGENCY BROADCAST] Persistent unacknowledged SOS on {#var#}. Contact transport team immediately.` |
| `DLT_TMP_04` | Minor Guardian Verification | `Your ward {#var#} has registered for College Bus Tracker. Use code {#var#} to verify consent.` |

*Rule:* Under `SW-MVP-1.0` §21.5, SMS messages **never contain coordinates**. They contain bus identifiers, status details, and secure console links requiring authenticated access.

---

## 3. Webhook Delivery Reports & HMAC Verification
When the SMS gateway posts asynchronous delivery receipts:
1. Webhook endpoint: `POST /api/v1/webhooks/sms/delivery-status`
2. Signature header: `X-Provider-Signature: t=<timestamp>,v1=<hmac_sha256_hex>`
3. Verification algorithm (`AG-MASTER-1.0` §13.19):
   - Extract timestamp `t` and signature `v1`.
   - Reject if `|server_utc - t| > 300` seconds (prevents replay attacks).
   - Recreate HMAC-SHA256 signature using `SMS_CALLBACK_SECRET` over `${t}.${raw_body}`.
   - Verify signatures using constant-time comparison (`crypto.timingSafeEqual`).
   - Deduplicate incoming deliveries by `(provider_message_id, delivery_status)` before processing.
