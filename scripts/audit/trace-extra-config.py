import fitz, re

doc = fitz.open('docs/spec/SW-MVP-1.0.pdf')
# Extract all 103 pages once into memory
pages = [doc[i].get_text() for i in range(len(doc))]

keys = [
    'absence.evaluate_interval_min',
    'app.poll_background_s',
    'approach.max_min',
    'approach.min_min',
    'eta.arriving_threshold_s',
    'export.link_ttl_h',
    'export.max_rows',
    'firmware.rollout_batch_pct',
    'firmware.rollout_pause_min',
    'import.batch_size',
    'import.max_rows',
    'mfa.recovery_code_count',
    'notify.email_retry_max',
    'notify.sms_retry_max',
    'otp.code_length',
    'phone.status_interval_s',
    'preflight.gps_accuracy_m',
    'preflight.gps_timeout_s',
    'preflight.hw_heartbeat_stale_s',
    'qr.grace_slots',
    'rate.driver_location.burst',
    'rate.driver_location.sustained',
    'rate.driver_status.burst',
    'rate.driver_status.sustained',
    'rate.hw_heartbeat.burst',
    'rate.hw_heartbeat.sustained',
    'rate.hw_telemetry.burst',
    'rate.hw_telemetry.sustained',
    'rate.otp_request.burst',
    'rate.otp_request.sustained',
    'rate.otp_verify.max',
    'rate.otp_verify.window_s',
    'rate.token_rotate.burst',
    'rate.token_rotate.sustained',
    'retention.attendance_years',
    'retention.audit_log_years',
    'retention.heartbeat_days',
    'retention.location_days',
    'retention.notification_days',
    'retention.sos_incident_years',
    'retention.trip_summary_years',
    'selector.flap_window_min',
    'service.timezone',
    'session.access_token_min',
    'session.idle_min_sec',
    'session.max_per_user',
    'session.refresh_token_days',
    'sos.escalation_check_s',
    'sos.escalation_repeat_min',
    'sos.resolution_note_max_chars',
    'stop_request.name_max_chars'
]

results = []
for k in keys:
    found_pages = []
    for p_idx, text in enumerate(pages):
        if k in text:
            found_pages.append(p_idx + 1)
    results.append({'key': k, 'pages': found_pages})

print("Direct key matches in SW-MVP-1.0.pdf:")
for r in results:
    print(f"  {r['key']}: pages {r['pages']}")
