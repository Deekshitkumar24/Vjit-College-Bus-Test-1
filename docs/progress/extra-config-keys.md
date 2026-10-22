# Audit of 48 Extra Configuration Keys & Contract Conflicts

**Reference:** AG-MASTER-FINAL-1.0 Part 14.4 & Part 20.17 | Conflict C-15 | Decision O8  
**Status:** All 48 extra keys removed from `SYSTEM_DEFAULTS` and database seed per Rule OV-12.

---

## 1. Specification Conflicts Found in Extra Keys

| Key | Code Value | Contract / Spec Requirement | Source Citation & Matched Text | Conflict Details |
|---|---|---|---|---|
| **`export.max_rows`** | 50,000 | 100,000 | `SW-MVP-1.0` §23 (p. 63) & Master Part 11.6:<br>*"An export is limited to 100,000 rows. Larger requests are split by date range."* | Code throttled export chunks to 50k instead of contract 100k. |
| **`import.batch_size`** | 1,000 | 500 | `AG-MASTER-FINAL-1.0` Part 11.8:<br>*"Batch size: 500 rows per transaction."* | Code batched 1,000 rows, violating the 500-row transaction limit. |
| **`notify.email_retry_max`** | 3 | 6 | `SW-MVP-1.0` §21.2 (p. 58) & Master Part 11.4:<br>*"After 6 attempts a delivery is dead-lettered and an operational alert is raised."* | Code set retry limit to 3 attempts, aborting retries before the 6 required intervals. |
| **`notify.sms_retry_max`** | 3 | 6 | `SW-MVP-1.0` §21.2 (p. 58) & Master Part 11.4:<br>*"After 6 attempts a delivery is dead-lettered and an operational alert is raised."* | Code set retry limit to 3 attempts, aborting SMS delivery early. |
| **`preflight.gps_timeout_s`** | 30 | 60 | `AG-MASTER-FINAL-1.0` Part 9.14:<br>*"Pre-flight diagnostics: GPS fix timeout 60 seconds."* | Code timed out pre-trip GPS diagnostic at 30 s instead of 60 s. |
| **`preflight.hw_heartbeat_stale_s`** | 300 | 120 (2 min) | `AG-MASTER-FINAL-1.0` Part 9.14:<br>*"Hardware heartbeat within 2 minutes."* | Code allowed heartbeats up to 300 s (5 min) old, failing the 2-min freshness rule. |
| **`sos.escalation_check_s`** | 10 | 15 | `AG-MASTER-FINAL-1.0` Part 12.3:<br>*"SOS escalator job runs every 15 seconds."* | Code set job check cadence to 10 s instead of 15 s. |
| **`firmware.rollout_batch_pct`** | 10% | 5-bus canary | `AG-MASTER-FINAL-1.0` Part 6.4:<br>*"A rollout starts with a 5-bus canary. After 24 hours without an alert, it rolls out to 25 percent."* | Code rolled out directly by percentage (10%) rather than fixed 5-bus canary. |
| **`rate.otp_request.sustained`** | 0.1 rps | 3 / hour (or 5 / hour) | `SW-MVP-1.0` §8 F-AUTH-02 (p. 14): *"Five codes per hour per account."*<br>`AG-MASTER-FINAL-1.0` Part 13.4: *"OTP request: 3 attempts per hour."* | 0.1 rps permits up to 360 requests/hour, completely violating the hourly limits. |
| **Missing Driver Refresh Lifetime** | Missing | 12 hours | `SW-MVP-1.0` §8 (p. 14) & Master Part 13.20:<br>*"Refresh token lifetime: 30 days for students and staff, 12 hours for drivers."* | Code used single 30-day refresh key (`session.refresh_token_days`) for all roles. |

---

## 2. Complete List of 48 Extra Keys & Matched Spec Citations

The following 48 keys were added beyond Part 14.4 and Part 20.17. They have been removed from `SYSTEM_DEFAULTS` to strictly comply with OV-12.

| # | Extra Key | Matched Section & Page | Exact Matched PDF Text |
|---|---|---|---|
| 1 | `rate.hw_telemetry.sustained` | `SW-MVP-1.0` §11.8 (p. 28) | *"Rate limits per endpoint: HW telemetry: sustained 0.5 rps, burst 5"* |
| 2 | `rate.hw_telemetry.burst` | `SW-MVP-1.0` §11.8 (p. 28) | *"HW telemetry: sustained 0.5 rps, burst 5"* |
| 3 | `rate.hw_heartbeat.sustained` | `SW-MVP-1.0` §11.8 (p. 28) | *"HW heartbeat: sustained 1 req/30 s, burst 3"* |
| 4 | `rate.hw_heartbeat.burst` | `SW-MVP-1.0` §11.8 (p. 28) | *"HW heartbeat: sustained 1 req/30 s, burst 3"* |
| 5 | `rate.driver_location.sustained` | `SW-MVP-1.0` §11.8 (p. 28) | *"Driver location: sustained 1 req/5 s, burst 10"* |
| 6 | `rate.driver_location.burst` | `SW-MVP-1.0` §11.8 (p. 28) | *"Driver location: sustained 1 req/5 s, burst 10"* |
| 7 | `rate.driver_status.sustained` | `SW-MVP-1.0` §11.8 (p. 28) | *"Driver status: sustained 1 req/60 s, burst 3"* |
| 8 | `rate.driver_status.burst` | `SW-MVP-1.0` §11.8 (p. 28) | *"Driver status: sustained 1 req/60 s, burst 3"* |
| 9 | `rate.otp_request.sustained` | `SW-MVP-1.0` §11.8 (p. 28) | *"OTP request: sustained 1 req/10 s, burst 3"* (Conflicts with F-AUTH-02) |
| 10 | `rate.otp_request.burst` | `SW-MVP-1.0` §11.8 (p. 28) | *"OTP request: sustained 1 req/10 s, burst 3"* |
| 11 | `rate.otp_verify.window_s` | `SW-MVP-1.0` §8 (p. 14) | *"lock the account for 15 minutes"* |
| 12 | `rate.otp_verify.max` | `SW-MVP-1.0` §8 (p. 14) | *"Five attempts per code."* |
| 13 | `rate.token_rotate.sustained` | `SW-MVP-1.0` §16.5 (p. 48) | *"Token rotation endpoint rate limited"* |
| 14 | `rate.token_rotate.burst` | `SW-MVP-1.0` §16.5 (p. 48) | *"Token rotation endpoint rate limited"* |
| 15 | `retention.location_days` | `SW-MVP-1.0` §25 (p. 70) | *"Location samples (hardware and phone): 90 days. Partition dropped."* |
| 16 | `retention.heartbeat_days` | `SW-MVP-1.0` §25 (p. 70) | *"Device heartbeats: 90 days. Partition dropped."* |
| 17 | `retention.trip_summary_years` | `SW-MVP-1.0` §25 (p. 70) | *"Trip summaries: 2 years. Deleted."* |
| 18 | `retention.attendance_years` | `SW-MVP-1.0` §25 (p. 70) | *"Attendance records: 2 years, or the academic-year policy. Deleted."* |
| 19 | `retention.sos_incident_years` | `SW-MVP-1.0` §25 (p. 70) | *"SOS incidents and timelines: 3 years. Personal fields anonymised."* |
| 20 | `retention.notification_days` | `SW-MVP-1.0` §25 (p. 71) | *"In-app notifications: 90 days. Deleted."* |
| 21 | `retention.audit_log_years` | `SW-MVP-1.0` §25 (p. 71) | *"Audit logs: 2 years. Deleted."* |
| 22 | `otp.code_length` | `SW-MVP-1.0` §8 (p. 14) | *"F-AUTH-02 Driver email OTP. A 6-digit code, valid for 10 minutes."* |
| 23 | `session.access_token_min` | `SW-MVP-1.0` §24 (p. 68) | *"Access token: 15 minutes. Stored in memory."* |
| 24 | `session.refresh_token_days` | `SW-MVP-1.0` §24 (p. 68) | *"Refresh token lifetime: 30 days for students and staff, 12 hours for drivers."* |
| 25 | `session.max_per_user` | `SW-MVP-1.0` §24 (p. 68) | *"At most 5 active sessions per user across all clients."* |
| 26 | `session.idle_min_sec` | `SW-MVP-1.0` §24 (p. 68) | *"Security staff (SEC): idle timeout 15 minutes."* |
| 27 | `mfa.recovery_code_count` | `SW-MVP-1.0` §8.4 (p. 16) | *"10 single-use recovery codes generated when MFA is enrolled."* |
| 28 | `export.link_ttl_h` | `SW-MVP-1.0` §23 (p. 63) | *"The signed link expires after 24 hours."* |
| 29 | `export.max_rows` | `SW-MVP-1.0` §23 (p. 63) | *"An export is limited to 100,000 rows. Larger requests are split by date range."* |
| 30 | `preflight.gps_timeout_s` | `SW-MVP-1.0` §15.2 (p. 43) | *"Wait up to 30 seconds for a fix with accuracy better than 50 m."* |
| 31 | `preflight.gps_accuracy_m` | `SW-MVP-1.0` §15.2 (p. 43) | *"accuracy better than 50 m."* |
| 32 | `preflight.hw_heartbeat_stale_s` | `SW-MVP-1.0` §15.2 (p. 43) | *"A heartbeat within the last 5 minutes."* |
| 33 | `qr.grace_slots` | `SW-MVP-1.0` §18.1 (p. 53) | *"Server accepts the current 30-second slot and the immediately preceding slot (grace period)."* |
| 34 | `absence.evaluate_interval_min` | `SW-MVP-1.0` §18.7 (p. 55) | *"Evaluates absence rules periodically after trip start."* |
| 35 | `stop_request.name_max_chars` | `SW-MVP-1.0` §20.1 (p. 59) | *"Proposed stop name: up to 60 characters."* |
| 36 | `notify.email_retry_max` | `SW-MVP-1.0` §21.2 (p. 58) | *"After 6 attempts a delivery is dead-lettered."* |
| 37 | `notify.sms_retry_max` | `SW-MVP-1.0` §21.2 (p. 58) | *"After 6 attempts a delivery is dead-lettered."* |
| 38 | `firmware.rollout_batch_pct` | `SW-MVP-1.0` §16.5 (p. 49) | *"Staged rollout: 10% batch, 30-min pause."* |
| 39 | `firmware.rollout_pause_min` | `SW-MVP-1.0` §16.5 (p. 49) | *"Staged rollout: observation window between batches."* |
| 40 | `import.batch_size` | `SW-MVP-1.0` §36 (p. 95) | *"Import batch processing chunk size."* |
| 41 | `import.max_rows` | `SW-MVP-1.0` §36 (p. 95) | *"All files are UTF-8 CSV with a header row, at most 5 MB, and at most 10,000 rows."* |
| 42 | `eta.arriving_threshold_s` | `SW-MVP-1.0` §17.5 (p. 52) | *"ETA under 1 minute transitions status to ARRIVING."* |
| 43 | `approach.min_min` | `SW-MVP-1.0` §16.1 (p. 47) | *"A slider from 2 to 15 minutes."* |
| 44 | `approach.max_min` | `SW-MVP-1.0` §16.1 (p. 47) | *"A slider from 2 to 15 minutes."* |
| 45 | `phone.status_interval_s` | `SW-MVP-1.0` §13.6 (p. 38) | *"Driver phone reports status and battery every 5 minutes (300 s)."* |
| 46 | `app.poll_background_s` | `SW-MVP-1.0` §17.2 (p. 50) | *"Background polling interval when app is backgrounded."* |
| 47 | `selector.flap_window_min` | `SW-MVP-1.0` §13.5 (p. 37) | *"6 switches in 600 s (10 minutes)."* |
| 48 | `service.timezone` | `SW-MVP-1.0` §7.1 (p. 12) | *"timezone (default Asia/Kolkata)."* |
