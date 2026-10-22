/**
 * System configuration defaults as defined strictly in AG-MASTER-FINAL-1.0 Part 14.4 and Part 20.17.
 *
 * All values are held in the database settings table.
 * Code reads the value at runtime and never uses hardcoded feature thresholds.
 *
 * KEY NAMING CONVENTION: <domain>.<parameter>
 * Every key listed in Part 14.4 and Part 20.17 is present below (exactly 79 keys).
 * Strictly complies with Rule OV-12 (no extra keys permitted without owner approval).
 */
export const SYSTEM_DEFAULTS: Record<string, number | string | number[] | string[]> = {
  // ── Hardware validity (Part 14.4) ──
  'hw.stale_after_s': 60,
  'hw.min_satellites': 4,
  'hw.max_hdop': 5.0,
  'hw.gps_lost_after_s': 30,
  'hw.gps_lost_ticket_min': 10,

  // ── Phone validity (Part 14.4) ──
  'phone.max_accuracy_m': 50,
  'phone.standby_interval_s': 30,
  'phone.fallback_interval_s': 10,

  // ── Device cadence (Part 14.4) ──
  'hw.moving_interval_s': 10,
  'hw.stopped_interval_s': 30,
  'hw.parked_heartbeat_s': 600,
  'hw.heartbeat_moving_s': 60,

  // ── Vehicle voltage (Part 14.4) ──
  'vehicle.battery_mv_12v': 11800,
  'vehicle.battery_mv_24v': 23500,

  // ── Ingestion validation (Part 14.4) ──
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

  // ── Dual-source selector (Part 14.4) ──
  'selector.cooldown_s': 30,
  'selector.return_fixes': 3,
  'selector.return_window_s': 30,
  'selector.both_down_s': 120,
  'selector.flap_limit': 6,
  'selector.flap_hold_s': 300,

  // ── Shifts & Trips (Part 14.4) ──
  'shift.idle_min': 20,
  'shift.idle_speed_kmh': 3,
  'shift.idle_grace_min': 10,
  'shift.timeout_h': 14,
  'shift.late_start_min': 10,
  'shift.late_start_coordinator_min': 20,
  'trip.generate_days_ahead': 7,

  // ── Stops & ETA (Part 14.4) ──
  'stop.radius_m': 50,
  'stop.arrival_speed_kmh': 5,
  'stop.arrival_dwell_s': 15,
  'stop.departure_dwell_s': 10,
  'stop.departure_speed_kmh': 10,
  'eta.speed_min_kmh': 10,
  'eta.speed_max_kmh': 60,
  'eta.speed_default_kmh': 20,
  'eta.speed_window_min': 5,
  'snapshot.cache_s': 3,

  // ── Attendance & Boarding (Part 14.4) ──
  'qr.rotation_s': 30,
  'boarding.window_before_min': 10,
  'boarding.window_after_min': 15,
  'leave.cutoff_before_trip_min': 30,
  'approach.default_min': 5,

  // ── SOS Incidents (Part 14.4) ──
  'sos.dedupe_s': 60,
  'sos.cancel_window_s': 30,
  'sos.escalation_min': [0, 2, 5, 10],
  'sos.device_delay_flag_s': 60,

  // ── Stop requests (Part 14.4) ──
  'route.corridor_m': 300,
  'stop.duplicate_m': 100,
  'stop_request.limit_days': 7,

  // ── Notifications (Part 14.4) ──
  'notify.quiet_start': '22:00',
  'notify.quiet_end': '06:00',
  'notify.push_per_hour': 6,
  'notify.group_window_s': 120,
  'notify.retry_min': [1, 5, 30, 120],
  'summary.send_time': '08:00',

  // ── Sessions & OTP (Part 14.4) ──
  'session.idle_min': 30,
  'otp.ttl_min': 10,
  'otp.attempts': 5,
  'otp.lock_min': 15,

  // ── Documents (Part 14.4) ──
  'doc.expiry_warn_days': [30, 7],

  // ── Client Polling (Part 14.4) ──
  'app.poll_foreground_s': 10,
  'web.poll_s': 10,

  // ── Calendar & Service (Part 14.4) ──
  'service.hours': '05:30 to 22:30',
  'holidays': 'college calendar, set each year',

  // ── Completeness Addendum (Part 20.17) ──
  'ops.peak_windows': 'set at kickoff',
  'sos.message_max_chars': 280,
  'firmware.url_ttl_s': 900,
  'sos.security_office_phone': 'shown to students offline',
};

/**
 * List of all 79 keys strictly authorized by AG-MASTER-FINAL-1.0 Part 14.4 and Part 20.17.
 */
export const SECTION_35_KEYS = Object.keys(SYSTEM_DEFAULTS);
