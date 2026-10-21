/**
 * System configuration defaults as defined in SW-MVP-1.0 Section 35.
 *
 * All values are held in the database settings table.
 * Code reads the value at runtime and never uses hardcoded feature thresholds.
 *
 * KEY NAMING CONVENTION: <domain>.<parameter>
 * Every key listed in SW-MVP-1.0 §35 is present below.
 * Values MUST match the specification exactly.
 */
export const SYSTEM_DEFAULTS: Record<string, number | string | number[] | string[]> = {
  // ── Hardware validity (§13.1, §35) ──
  'hw.stale_after_s': 60,
  'hw.min_satellites': 4,
  'hw.max_hdop': 5.0,
  'hw.gps_lost_after_s': 30,
  'hw.gps_lost_ticket_min': 10,

  // ── Phone validity (§13.1, §35) ──
  'phone.max_accuracy_m': 50,
  'phone.standby_interval_s': 30,
  'phone.fallback_interval_s': 10,
  'phone.status_interval_s': 300,

  // ── Device cadence (§11.6, §35, HW-SPEC-1.0 §10.1) ──
  'hw.moving_interval_s': 10,
  'hw.stopped_interval_s': 30,
  'hw.parked_heartbeat_s': 600,
  'hw.heartbeat_moving_s': 60,

  // ── Vehicle voltage (§12, §35, HW-SPEC-1.0 §6.3) ──
  'vehicle.battery_mv_12v': 11800,
  'vehicle.battery_mv_24v': 23500,

  // ── Ingestion validation (§11.3, §11.5, §11.8, §35) ──
  'ingest.future_tolerance_s': 60,
  'ingest.buffered_after_min': 10,
  'ingest.stale_timestamp_days': 7,
  'ingest.jump_max_kmh': 150,
  'ingest.jump_reset_min': 30,
  'ingest.clock_skew_s': 300,
  'ingest.service_area_buffer_km': 10,
  'ingest.batch_max': 50,
  'ingest.body_max_kb': 8,
  'ingest.phone_body_max_kb': 16,
  'ingest.global_rps': 200,

  // ── Ingestion rate limits per endpoint (§11.8, §35) ──
  'rate.hw_telemetry.sustained': 0.5, // 1 req / 2s
  'rate.hw_telemetry.burst': 5,
  'rate.hw_heartbeat.sustained': 0.033, // 1 req / 30s
  'rate.hw_heartbeat.burst': 3,
  'rate.driver_location.sustained': 0.2, // 1 req / 5s
  'rate.driver_location.burst': 10,
  'rate.driver_status.sustained': 0.017, // 1 req / 60s
  'rate.driver_status.burst': 3,
  'rate.otp_request.sustained': 0.1, // 1 req / 10s
  'rate.otp_request.burst': 3,
  'rate.otp_verify.window_s': 900,
  'rate.otp_verify.max': 5,
  'rate.token_rotate.sustained': 0.00028, // 1 req / 3600s
  'rate.token_rotate.burst': 2,

  // ── Source selector (§13.3, §13.5, §13.6, §35) ──
  'selector.cooldown_s': 30,
  'selector.return_fixes': 3,
  'selector.return_window_s': 30,
  'selector.both_down_s': 120,
  'selector.flap_limit': 6,
  'selector.flap_window_min': 10,
  'selector.flap_hold_s': 300,

  // ── Shifts (§15.2, §15.4, §15.6, §35) ──
  'shift.idle_min': 20,
  'shift.idle_speed_kmh': 3,
  'shift.idle_grace_min': 10,
  'shift.timeout_h': 14,
  'shift.late_start_min': 10,
  'shift.late_start_coordinator_min': 20,
  'trip.generate_days_ahead': 7,

  // ── Stops, ETA, and stop detection (§17.4, §17.5, §35) ──
  'stop.radius_m': 50,
  'stop.arrival_speed_kmh': 5,
  'stop.arrival_dwell_s': 15,
  'stop.departure_dwell_s': 10,
  'stop.departure_speed_kmh': 10,
  'eta.speed_min_kmh': 10,
  'eta.speed_max_kmh': 60,
  'eta.speed_default_kmh': 20,
  'eta.speed_window_min': 5,
  'eta.arriving_threshold_s': 60,
  'snapshot.cache_s': 3,

  // ── Attendance, boarding, and leave (§18.1, §18.5, §18.7, §35) ──
  'qr.rotation_s': 30,
  'qr.grace_slots': 1,
  'boarding.window_before_min': 10,
  'boarding.window_after_min': 15,
  'leave.cutoff_before_trip_min': 30,
  'approach.default_min': 5,
  'approach.min_min': 2,
  'approach.max_min': 15,

  // ── SOS emergency (§19.2, §19.3, §19.6, §19.8, §35) ──
  'sos.dedupe_s': 60,
  'sos.cancel_window_s': 30,
  'sos.escalation_min': [0, 2, 5, 10],
  'sos.escalation_repeat_min': 5,
  'sos.escalation_check_s': 15,
  'sos.device_delay_flag_s': 60,
  'sos.message_max_chars': 280,
  'sos.resolution_note_max_chars': 500,

  // ── Firmware (§33.8, §35) ──
  'firmware.url_ttl_s': 900,
  'firmware.rollout_batch_pct': 10,
  'firmware.rollout_pause_min': 30,

  // ── Stop requests (§20.1, §35) ──
  'route.corridor_m': 300,
  'stop.duplicate_m': 100,
  'stop_request.limit_days': 7,
  'stop_request.name_max_chars': 60,

  // ── Notifications (§21.3, §21.4, §35) ──
  'notify.quiet_start': '22:00',
  'notify.quiet_end': '06:00',
  'notify.push_per_hour': 6,
  'notify.group_window_s': 120,
  'notify.retry_min': [1, 5, 30, 120],
  'notify.sms_retry_max': 3,
  'notify.email_retry_max': 3,
  'summary.send_time': '08:00',

  // ── Sessions and OTP (§8, F-AUTH-02, §35) ──
  'session.access_token_min': 15,
  'session.refresh_token_days': 30,
  'session.idle_min': 30,
  'session.idle_min_sec': 15,
  'session.max_per_user': 5,
  'otp.ttl_min': 10,
  'otp.attempts': 5,
  'otp.lock_min': 15,
  'otp.code_length': 6,

  // ── MFA recovery (§8, §35) ──
  'mfa.recovery_code_count': 10,

  // ── Documents (§35) ──
  'doc.expiry_warn_days': [30, 7],

  // ── Clients (§17.2, §17.3, §35) ──
  'app.poll_foreground_s': 10,
  'app.poll_background_s': 60,
  'web.poll_s': 10,

  // ── CSV import (§22, §35) ──
  'import.batch_size': 500,
  'import.max_rows': 10000,

  // ── Export (§23, §35) ──
  'export.link_ttl_h': 24,
  'export.max_rows': 100000,

  // ── Data retention (§29.4, §35) ──
  'retention.location_days': 90,
  'retention.heartbeat_days': 90,
  'retention.trip_summary_years': 2,
  'retention.audit_log_years': 3,
  'retention.sos_incident_years': 5,
  'retention.attendance_years': 2,
  'retention.notification_days': 90,

  // ── Calendar and service hours (§35) ──
  'service.hours': '05:30 to 22:30',
  'service.timezone': 'Asia/Kolkata',

  // ── Pre-trip checks (§15.1, §35) ──
  'preflight.gps_timeout_s': 60,
  'preflight.gps_accuracy_m': 50,
  'preflight.hw_heartbeat_stale_s': 120,

  // ── Absence evaluator (§18.6, §25, §35) ──
  'absence.evaluate_interval_min': 5,
};

/** All key names from SW-MVP-1.0 §35. Used by tests to verify completeness. */
export const SECTION_35_KEYS = Object.keys(SYSTEM_DEFAULTS);

export type SystemDefaultKey = keyof typeof SYSTEM_DEFAULTS;
