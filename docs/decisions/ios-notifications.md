# RS-04, RS-18: iOS Notifications, Background Modes, and App Store Privacy Labels

**Document IDs:** RS-04, RS-18  
**Sources:** Apple Developer Documentation, App Store Review Guidelines  
**Date Checked:** 20 October 2026

---

## 1. RS-04: Apple App Review Guidance: Background Location & Notifications

### 1.1 Background Location Justification

- **Guideline 2.5.4 (Multitasking Apps):** Background location is permitted only for navigation, fitness, fleet management, and vehicle tracking.
- The Driver app qualifies under Fleet Management & Real-time Public Transit Safety.
- The Student and Faculty apps **do not request location permissions** in the MVP (`SW-MVP-1.0` R-19, §16.1 #2), ensuring zero rejection risk for student profiles.

### 1.2 Time-Sensitive Notifications vs Critical Alerts

- **Time-Sensitive Notifications (`UNNotificationInterruptionLevelTimeSensitive`):**
  - Entitlement: Standard entitlement available to all developers in Xcode / EAS without special Apple approval.
  - Used for: Stop approaching alerts, driver idle prompts, and initial SOS notifications (`SW-MVP-1.0` §19.5).
  - Capability: Breaks through Focus modes and Scheduled Summaries immediately.
- **Critical Alerts (`com.apple.developer.usernotification.critical-alerts`):**
  - Requires explicit custom entitlement approval from Apple.
  - Decision: Open Decision 11 in `SW-MVP-1.0` §41 confirms **Critical Alerts are NOT in MVP**. Time-sensitive interruption level is utilized, alongside in-app persistent audio alarms that sound while the incident remains active (`SW-MVP-1.0` §19.5, §20.5).

---

## 2. RS-18: App Store Privacy Nutrition Labels

Under Apple's App Store Connect Privacy details requirements:

### 2.1 Student / Faculty App Profile

- **Data Used to Track You:** None (no third-party tracking, advertising SDKs, or data brokers).
- **Data Linked to You:**
  - _Contact Info:_ Name, Email address, Phone number (for authentication, trip notices, and emergency escalation).
  - _User Content:_ Stop requests, attendance records, leave submissions.
  - _Identifiers:_ User ID, Installation ID.
- **Location Data:** **None collected** from the student device (`SW-MVP-1.0` R-19).

### 2.2 Driver App Profile

- **Data Linked to You:**
  - _Precise Location:_ Collected exclusively during active shifts for bus tracking and ETA calculation (`SW-MVP-1.0` R-18).
  - _Contact Info:_ Name, Email, Phone number.
  - _Diagnostics:_ Phone battery, permission status, app crash logs.
- **Data Not Linked to You:**
  - Anonymous performance metrics and server response latencies.
