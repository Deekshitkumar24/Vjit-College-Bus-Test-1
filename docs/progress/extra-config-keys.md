# Specification Line References for 51 Additional Configuration Keys

Documented per AG-MVP-GUIDE-1.0 Step 0 (C-15 / OV-12). These keys reflect operational thresholds explicitly stated in `SW-MVP-1.0` and codified in `packages/config/src/defaults.ts` under Rule 1.6 (Configuration, not constants).

| Configuration Key | SW-MVP-1.0 Section & Page | Code Default | Purpose in Specification |
|---|---|---|---|
| `rate.hw_telemetry.sustained` | SW-MVP-1.0 §11.8 (p. 28) | `0.5 rps` | HW telemetry sustained rate limit |
| `rate.hw_telemetry.burst` | SW-MVP-1.0 §11.8 (p. 28) | `5` | HW telemetry burst limit |
| `rate.hw_heartbeat.sustained` | SW-MVP-1.0 §11.8 (p. 28) | `0.033 rps` | HW heartbeat sustained rate limit (1/30s) |
| `rate.hw_heartbeat.burst` | SW-MVP-1.0 §11.8 (p. 28) | `3` | HW heartbeat burst limit |
| `rate.driver_location.sustained` | SW-MVP-1.0 §11.8 (p. 28) | `0.2 rps` | Driver location sustained rate limit (1/5s) |
| `rate.driver_location.burst` | SW-MVP-1.0 §11.8 (p. 28) | `10` | Driver location burst limit |
| `rate.driver_status.sustained` | SW-MVP-1.0 §11.8 (p. 28) | `0.017 rps` | Driver status sustained rate limit (1/60s) |
| `rate.driver_status.burst` | SW-MVP-1.0 §11.8 (p. 28) | `3` | Driver status burst limit |
| `rate.otp_request.sustained` | SW-MVP-1.0 §8 (p. 14) | `0.1 rps` | OTP request rate limit (1/10s, 5/hour) |
| `rate.otp_request.burst` | SW-MVP-1.0 §8 (p. 14) | `3` | OTP request burst limit |
| `rate.otp_verify.window_s` | SW-MVP-1.0 §8 (p. 14) | `900` | OTP lockout window (15 minutes) |
| `rate.otp_verify.max` | SW-MVP-1.0 §8 (p. 14) | `5` | Max OTP verify attempts per code |
| `rate.token_rotate.sustained` | SW-MVP-1.0 §16.5 (p. 48) | `0.1 rps` | Device token rotation rate limit |
| `rate.token_rotate.burst` | SW-MVP-1.0 §16.5 (p. 48) | `2` | Device token rotation burst limit |
| `retention.location_days` | SW-MVP-1.0 §25 (p. 70) | `90` | Location samples partition drop retention |
| `retention.heartbeat_days` | SW-MVP-1.0 §25 (p. 70) | `90` | Device heartbeats partition drop retention |
| `retention.trip_summary_years` | SW-MVP-1.0 §25 (p. 70) | `2` | Trip summaries retention |
| `retention.attendance_years` | SW-MVP-1.0 §25 (p. 70) | `2` | Attendance records retention |
| `retention.sos_incident_years` | SW-MVP-1.0 §25 (p. 70) | `3` | SOS incidents retention before anonymisation |
| `retention.notification_days` | SW-MVP-1.0 §25 (p. 71) | `90` | Notification deliveries retention |
| `retention.audit_log_years` | SW-MVP-1.0 §25 (p. 71) | `2` | Audit log retention |
| `otp.code_length` | SW-MVP-1.0 §8 (p. 14) | `6` | Driver OTP digit length |
| `session.access_token_min` | SW-MVP-1.0 §24 (p. 68) | `15` | Access token expiry minutes |
| `session.refresh_token_days` | SW-MVP-1.0 §24 (p. 68) | `30` | Refresh token family lifetime days |
| `session.max_per_user` | SW-MVP-1.0 §24 (p. 68) | `5` | Max concurrent user sessions |
| `session.idle_min_sec` | SW-MVP-1.0 §24 (p. 68) | `900` | Security staff 15-min idle timeout in seconds |
| `mfa.recovery_code_count` | SW-MVP-1.0 §8.4 (p. 16) | `10` | Number of single-use admin recovery codes |
| `export.link_ttl_h` | SW-MVP-1.0 §23 (p. 66) | `24` | Export S3 presigned URL lifetime hours |
| `export.max_rows` | SW-MVP-1.0 §23 (p. 66) | `50000` | Maximum rows per exported CSV chunk |
| `preflight.gps_timeout_s` | SW-MVP-1.0 §15.2 (p. 43) | `30` | Pre-flight GPS fix wait timeout |
| `preflight.gps_accuracy_m` | SW-MVP-1.0 §15.2 (p. 43) | `50` | Pre-flight GPS minimum accuracy |
| `preflight.hw_heartbeat_stale_s` | SW-MVP-1.0 §15.2 (p. 43) | `300` | Pre-flight hardware heartbeat staleness |
| `qr.grace_slots` | SW-MVP-1.0 §18.1 (p. 53) | `1` | Allowed historical QR time-slot tolerance |
| `absence.evaluate_interval_min` | SW-MVP-1.0 §18.7 (p. 55) | `5` | Scheduled absence evaluator execution cadence |
| `stop_request.name_max_chars` | SW-MVP-1.0 §20.1 (p. 59) | `60` | Maximum length for proposed stop name |
| `notify.email_retry_max` | SW-MVP-1.0 §21.2 (p. 62) | `3` | SES email max delivery attempts |
| `notify.sms_retry_max` | SW-MVP-1.0 §21.2 (p. 62) | `3` | SMS max delivery attempts |
| `firmware.rollout_batch_pct` | SW-MVP-1.0 §16.5 (p. 49) | `10` | Percentage of fleet in first rollout batch |
| `firmware.rollout_pause_min` | SW-MVP-1.0 §16.5 (p. 49) | `30` | Observation window between rollout stages |
| `import.batch_size` | SW-MVP-1.0 §36 (p. 95) | `1000` | Database insert chunk size during import |
| `import.max_rows` | SW-MVP-1.0 §36 (p. 95) | `10000` | Maximum allowable CSV rows per import |
| `eta.arriving_threshold_s` | SW-MVP-1.0 §17.5 (p. 52) | `60` | Seconds remaining to trigger ARRIVING status |
| `approach.min_min` | SW-MVP-1.0 §16.1 (p. 47) | `2` | Minimum allowed approach alert threshold |
| `approach.max_min` | SW-MVP-1.0 §16.1 (p. 47) | `15` | Maximum allowed approach alert threshold |
| `phone.status_interval_s` | SW-MVP-1.0 §13.6 (p. 38) | `300` | Driver phone heartbeat status report interval |
| `app.poll_background_s` | SW-MVP-1.0 §17.2 (p. 50) | `60` | App background polling rate when minimized |
| `selector.flap_window_min` | SW-MVP-1.0 §13.5 (p. 37) | `10` | Window for evaluation of 6-switch flap limit |
| `sos.escalation_check_s` | SW-MVP-1.0 §19.3 (p. 57) | `10` | Cadence for escalator job checking open incidents |
| `sos.escalation_repeat_min` | SW-MVP-1.0 §19.3 (p. 57) | `5` | Interval between repeated tier alerts |
| `sos.resolution_note_max_chars` | SW-MVP-1.0 §19.7 (p. 58) | `500` | Maximum character limit for incident resolution note |
| `service.timezone` | SW-MVP-1.0 §7.1 (p. 12) | `'Asia/Kolkata'` | Campus operational timezone |
