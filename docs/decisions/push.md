# RS-05: FCM HTTP v1 API & APNs Provider Push Configuration

**Document ID:** RS-05  
**Sources:**

- Firebase Cloud Messaging HTTP v1 API: `https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages` (Pinned Version: FCM HTTP v1 / `firebase-admin` `v12.5.0`)
- Apple Developer Documentation - Sending Notification Requests to APNs: `https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns` (Updated 2024 / iOS 17-18)
  **Date Checked:** 20 October 2026 (Re-confirmed 21 October 2026)  
  **Quoted Verification (FCM HTTP v1):**

> "The HTTP v1 protocol provides the most secure and up-to-date way to send messages to Android, iOS, and web clients using short-lived OAuth 2.0 access tokens."  
> **Quoted Verification (Apple APNs Provider API):**  
> "Set the apns-priority header to 10 when the notification requires immediate delivery. Notifications with priority 10 are sent immediately, deliver an alert, play a sound, or badge the app’s icon on the user’s device."

---

## 1. FCM HTTP v1 & APNs Architecture

All push notifications are dispatched via **Firebase Cloud Messaging (FCM) HTTP v1 API** using service account credentials (`firebase-admin v12.5.0`). For iOS devices, Firebase delivers to Apple Push Notification service (APNs) via configured APNs Authentication Keys (`.p8` tokens) with Team ID and Key ID.

Endpoint: `POST https://fcm.googleapis.com/v1/projects/{project_id}/messages:send`

### 1.1 Apple Push Notification service (APNs) Requirements

- **APNs Header `apns-push-type`:** Must be explicitly set to `alert` for banner/sound notifications, or `background` for silent data sync.
- **APNs Header `apns-priority`:**
  - `10` (Immediate): Sent immediately, wakes the device radio, bypasses power budgets for critical emergency alerts.
  - `5` (Power-considerate): Delivered at a time that conserves battery power for non-critical status updates.
- **APNs Payload Interruption Level (`interruption-level`):**
  - `"time-sensitive"`: Bypasses Focus modes and Scheduled Summaries immediately. Used for SOS emergency alerts and stop approach alerts (`SW-MVP-1.0` §19.5, §21.2).
  - `"active"`: Default delivery presented in the notification center.

---

## 2. High-Priority Safety Alerts Payload Structure (SOS)

For Tier 0 emergency alerts (`SW-MVP-1.0` §19.3, §19.5, §20.5), payloads are configured to wake sleeping devices, bypass battery restrictions, and present alerts with audio:

```json
{
  "message": {
    "token": "<target_fcm_or_apns_token>",
    "data": {
      "category": "SAFETY",
      "incident_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "bus_number": "Bus 07",
      "first_trigger_type": "HW_BUTTON",
      "type": "SOS_ALERT"
    },
    "android": {
      "priority": "HIGH",
      "ttl": "0s",
      "notification": {
        "title": "EMERGENCY: SOS Raised on Bus 07",
        "body": "Driver activated emergency alert. Open immediately.",
        "channel_id": "sos_high_importance",
        "sound": "emergency_alarm",
        "priority": "MAX",
        "visibility": "PUBLIC",
        "default_vibrate_timings": true
      }
    },
    "apns": {
      "headers": {
        "apns-priority": "10",
        "apns-push-type": "alert",
        "apns-expiration": "0"
      },
      "payload": {
        "aps": {
          "alert": {
            "title": "EMERGENCY: SOS Raised on Bus 07",
            "body": "Driver activated emergency alert. Open immediately."
          },
          "sound": "emergency_alarm.caf",
          "interruption-level": "time-sensitive",
          "badge": 1
        }
      }
    }
  }
}
```

---

## 3. Standard Non-Safety Notification Payload Structure

For approaching alerts, delay announcements, or attendance confirmations:

- **Android:** `"priority": "NORMAL"`, channel `bus_updates`.
- **APNs:** `"apns-priority": "5"`, `apns-push-type: "alert"`, interruption level `"active"`.
- **Rate-Limiting & Quiet Hours:** Checked prior to dispatch by the background notification worker (`SW-MVP-1.0` §21.3, §21.4). Non-safety notifications are capped at 6 pushes per hour per user and suppressed during quiet hours (22:00 to 06:00 IST).
