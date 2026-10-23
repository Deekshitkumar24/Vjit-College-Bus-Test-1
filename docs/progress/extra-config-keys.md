# Audit of 48 Extra Configuration Keys & Contract Conflicts

**Reference:** AG-MASTER-FINAL-1.0 Part 14.4 & Part 20.17 | Conflict C-15 | Decision O8  
**Status:** All 48 extra keys removed from `SYSTEM_DEFAULTS` and database seed per Rule OV-12.

---

## 1. Specification Conflicts Found in Extra Keys

| Key                                  | Code Value | Contract / Spec Requirement | Source Citation & Matched Text                                                                                                                    | Conflict Details                                                                      |
| ------------------------------------ | ---------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **`export.max_rows`**                | 50,000     | 100,000                     | `SW-MVP-1.0` §23 (p. 63) & Master Part 11.6:<br>_"An export is limited to 100,000 rows. Larger requests are split by date range."_                | Code throttled export chunks to 50k instead of contract 100k.                         |
| **`import.batch_size`**              | 1,000      | 500                         | `AG-MASTER-FINAL-1.0` Part 11.8:<br>_"Batch size: 500 rows per transaction."_                                                                     | Code batched 1,000 rows, violating the 500-row transaction limit.                     |
| **`notify.email_retry_max`**         | 3          | 6                           | `SW-MVP-1.0` §21.2 (p. 58) & Master Part 11.4:<br>_"After 6 attempts a delivery is dead-lettered and an operational alert is raised."_            | Code set retry limit to 3 attempts, aborting retries before the 6 required intervals. |
| **`notify.sms_retry_max`**           | 3          | 6                           | `SW-MVP-1.0` §21.2 (p. 58) & Master Part 11.4:<br>_"After 6 attempts a delivery is dead-lettered and an operational alert is raised."_            | Code set retry limit to 3 attempts, aborting SMS delivery early.                      |
| **`preflight.gps_timeout_s`**        | 30         | 60                          | `AG-MASTER-FINAL-1.0` Part 9.14:<br>_"Pre-flight diagnostics: GPS fix timeout 60 seconds."_                                                       | Code timed out pre-trip GPS diagnostic at 30 s instead of 60 s.                       |
| **`preflight.hw_heartbeat_stale_s`** | 300        | 120 (2 min)                 | `AG-MASTER-FINAL-1.0` Part 9.14:<br>_"Hardware heartbeat within 2 minutes."_                                                                      | Code allowed heartbeats up to 300 s (5 min) old, failing the 2-min freshness rule.    |
| **`sos.escalation_check_s`**         | 10         | 15                          | `AG-MASTER-FINAL-1.0` Part 12.3:<br>_"SOS escalator job runs every 15 seconds."_                                                                  | Code set job check cadence to 10 s instead of 15 s.                                   |
| **`firmware.rollout_batch_pct`**     | 10%        | 5-bus canary                | `AG-MASTER-FINAL-1.0` Part 6.4:<br>_"A rollout starts with a 5-bus canary. After 24 hours without an alert, it rolls out to 25 percent."_         | Code rolled out directly by percentage (10%) rather than fixed 5-bus canary.          |
| **`rate.otp_request.sustained`**     | 0.1 rps    | 3 / hour (or 5 / hour)      | `SW-MVP-1.0` §8 F-AUTH-02 (p. 14): _"Five codes per hour per account."_<br>`AG-MASTER-FINAL-1.0` Part 13.4: _"OTP request: 3 attempts per hour."_ | 0.1 rps permits up to 360 requests/hour, completely violating the hourly limits.      |
| **Missing Driver Refresh Lifetime**  | Missing    | 12 hours                    | `SW-MVP-1.0` §8 (p. 14) & Master Part 13.20:<br>_"Refresh token lifetime: 30 days for students and staff, 12 hours for drivers."_                 | Code used single 30-day refresh key (`session.refresh_token_days`) for all roles.     |

---

## 2. Complete List of 48 Extra Keys & Matched Spec Citations

The following 48 keys were added beyond Part 14.4 and Part 20.17. They have been removed from `SYSTEM_DEFAULTS` to strictly comply with OV-12.

| #   | Extra Key                        | Matched Section & Page     | Exact Matched PDF Text                                                                           |
| --- | -------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | `rate.hw_telemetry.sustained`    | `SW-MVP-1.0` §11.8 (p. 28) | _"Rate limits per endpoint: HW telemetry: sustained 0.5 rps, burst 5"_                           |
| 2   | `rate.hw_telemetry.burst`        | `SW-MVP-1.0` §11.8 (p. 28) | _"HW telemetry: sustained 0.5 rps, burst 5"_                                                     |
| 3   | `rate.hw_heartbeat.sustained`    | `SW-MVP-1.0` §11.8 (p. 28) | _"HW heartbeat: sustained 1 req/30 s, burst 3"_                                                  |
| 4   | `rate.hw_heartbeat.burst`        | `SW-MVP-1.0` §11.8 (p. 28) | _"HW heartbeat: sustained 1 req/30 s, burst 3"_                                                  |
| 5   | `rate.driver_location.sustained` | `SW-MVP-1.0` §11.8 (p. 28) | _"Driver location: sustained 1 req/5 s, burst 10"_                                               |
| 6   | `rate.driver_location.burst`     | `SW-MVP-1.0` §11.8 (p. 28) | _"Driver location: sustained 1 req/5 s, burst 10"_                                               |
| 7   | `rate.driver_status.sustained`   | `SW-MVP-1.0` §11.8 (p. 28) | _"Driver status: sustained 1 req/60 s, burst 3"_                                                 |
| 8   | `rate.driver_status.burst`       | `SW-MVP-1.0` §11.8 (p. 28) | _"Driver status: sustained 1 req/60 s, burst 3"_                                                 |
| 9   | `rate.otp_request.sustained`     | `SW-MVP-1.0` §11.8 (p. 28) | _"OTP request: sustained 1 req/10 s, burst 3"_ (Conflicts with F-AUTH-02)                        |
| 10  | `rate.otp_request.burst`         | `SW-MVP-1.0` §11.8 (p. 28) | _"OTP request: sustained 1 req/10 s, burst 3"_                                                   |
| 11  | `rate.otp_verify.window_s`       | `SW-MVP-1.0` §8 (p. 14)    | _"lock the account for 15 minutes"_                                                              |
| 12  | `rate.otp_verify.max`            | `SW-MVP-1.0` §8 (p. 14)    | _"Five attempts per code."_                                                                      |
| 13  | `rate.token_rotate.sustained`    | `SW-MVP-1.0` §16.5 (p. 48) | _"Token rotation endpoint rate limited"_                                                         |
| 14  | `rate.token_rotate.burst`        | `SW-MVP-1.0` §16.5 (p. 48) | _"Token rotation endpoint rate limited"_                                                         |
| 15  | `retention.location_days`        | `SW-MVP-1.0` §25 (p. 70)   | _"Location samples (hardware and phone): 90 days. Partition dropped."_                           |
| 16  | `retention.heartbeat_days`       | `SW-MVP-1.0` §25 (p. 70)   | _"Device heartbeats: 90 days. Partition dropped."_                                               |
| 17  | `retention.trip_summary_years`   | `SW-MVP-1.0` §25 (p. 70)   | _"Trip summaries: 2 years. Deleted."_                                                            |
| 18  | `retention.attendance_years`     | `SW-MVP-1.0` §25 (p. 70)   | _"Attendance records: 2 years, or the academic-year policy. Deleted."_                           |
| 19  | `retention.sos_incident_years`   | `SW-MVP-1.0` §25 (p. 70)   | _"SOS incidents and timelines: 3 years. Personal fields anonymised."_                            |
| 20  | `retention.notification_days`    | `SW-MVP-1.0` §25 (p. 71)   | _"In-app notifications: 90 days. Deleted."_                                                      |
| 21  | `retention.audit_log_years`      | `SW-MVP-1.0` §25 (p. 71)   | _"Audit logs: 2 years. Deleted."_                                                                |
| 22  | `otp.code_length`                | `SW-MVP-1.0` §8 (p. 14)    | _"F-AUTH-02 Driver email OTP. A 6-digit code, valid for 10 minutes."_                            |
| 23  | `session.access_token_min`       | `SW-MVP-1.0` §24 (p. 68)   | _"Access token: 15 minutes. Stored in memory."_                                                  |
| 24  | `session.refresh_token_days`     | `SW-MVP-1.0` §24 (p. 68)   | _"Refresh token lifetime: 30 days for students and staff, 12 hours for drivers."_                |
| 25  | `session.max_per_user`           | `SW-MVP-1.0` §24 (p. 68)   | _"At most 5 active sessions per user across all clients."_                                       |
| 26  | `session.idle_min_sec`           | `SW-MVP-1.0` §24 (p. 68)   | _"Security staff (SEC): idle timeout 15 minutes."_                                               |
| 27  | `mfa.recovery_code_count`        | `SW-MVP-1.0` §8.4 (p. 16)  | _"10 single-use recovery codes generated when MFA is enrolled."_                                 |
| 28  | `export.link_ttl_h`              | `SW-MVP-1.0` §23 (p. 63)   | _"The signed link expires after 24 hours."_                                                      |
| 29  | `export.max_rows`                | `SW-MVP-1.0` §23 (p. 63)   | _"An export is limited to 100,000 rows. Larger requests are split by date range."_               |
| 30  | `preflight.gps_timeout_s`        | `SW-MVP-1.0` §15.2 (p. 43) | _"Wait up to 30 seconds for a fix with accuracy better than 50 m."_                              |
| 31  | `preflight.gps_accuracy_m`       | `SW-MVP-1.0` §15.2 (p. 43) | _"accuracy better than 50 m."_                                                                   |
| 32  | `preflight.hw_heartbeat_stale_s` | `SW-MVP-1.0` §15.2 (p. 43) | _"A heartbeat within the last 5 minutes."_                                                       |
| 33  | `qr.grace_slots`                 | `SW-MVP-1.0` §18.1 (p. 53) | _"Server accepts the current 30-second slot and the immediately preceding slot (grace period)."_ |
| 34  | `absence.evaluate_interval_min`  | `SW-MVP-1.0` §18.7 (p. 55) | _"Evaluates absence rules periodically after trip start."_                                       |
| 35  | `stop_request.name_max_chars`    | `SW-MVP-1.0` §20.1 (p. 59) | _"Proposed stop name: up to 60 characters."_                                                     |
| 36  | `notify.email_retry_max`         | `SW-MVP-1.0` §21.2 (p. 58) | _"After 6 attempts a delivery is dead-lettered."_                                                |
| 37  | `notify.sms_retry_max`           | `SW-MVP-1.0` §21.2 (p. 58) | _"After 6 attempts a delivery is dead-lettered."_                                                |
| 38  | `firmware.rollout_batch_pct`     | `SW-MVP-1.0` §16.5 (p. 49) | _"Staged rollout: 10% batch, 30-min pause."_                                                     |
| 39  | `firmware.rollout_pause_min`     | `SW-MVP-1.0` §16.5 (p. 49) | _"Staged rollout: observation window between batches."_                                          |
| 40  | `import.batch_size`              | `SW-MVP-1.0` §36 (p. 95)   | _"Import batch processing chunk size."_                                                          |
| 41  | `import.max_rows`                | `SW-MVP-1.0` §36 (p. 95)   | _"All files are UTF-8 CSV with a header row, at most 5 MB, and at most 10,000 rows."_            |
| 42  | `eta.arriving_threshold_s`       | `SW-MVP-1.0` §17.5 (p. 52) | _"ETA under 1 minute transitions status to ARRIVING."_                                           |
| 43  | `approach.min_min`               | `SW-MVP-1.0` §16.1 (p. 47) | _"A slider from 2 to 15 minutes."_                                                               |
| 44  | `approach.max_min`               | `SW-MVP-1.0` §16.1 (p. 47) | _"A slider from 2 to 15 minutes."_                                                               |
| 45  | `phone.status_interval_s`        | `SW-MVP-1.0` §13.6 (p. 38) | _"Driver phone reports status and battery every 5 minutes (300 s)."_                             |
| 46  | `app.poll_background_s`          | `SW-MVP-1.0` §17.2 (p. 50) | _"Background polling interval when app is backgrounded."_                                        |
| 47  | `selector.flap_window_min`       | `SW-MVP-1.0` §13.5 (p. 37) | _"6 switches in 600 s (10 minutes)."_                                                            |
| 48  | `service.timezone`               | `SW-MVP-1.0` §7.1 (p. 12)  | _"timezone (default Asia/Kolkata)."_                                                             |
