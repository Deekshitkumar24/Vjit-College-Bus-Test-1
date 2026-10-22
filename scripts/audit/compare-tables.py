import re

part7_expected = [
    'colleges', 'users', 'user_roles', 'sessions', 'otp_challenges', 'mfa_factors', 'recovery_codes', 'student_profiles',
    'buses', 'devices', 'device_tokens', 'device_links', 'device_health', 'device_heartbeats', 'device_events', 'firmware_releases', 'firmware_rollouts', 'maintenance_tickets',
    'stops', 'routes', 'route_stops', 'route_geometries', 'route_bus_assignments', 'timetables', 'holidays',
    'driver_roster', 'faculty_assignments', 'student_routes',
    'shifts', 'trips', 'location_samples', 'bus_state', 'source_switches', 'stop_events', 'outbox', 'rate_counters', 'idempotency_keys',
    'attendance_records', 'leave_records', 'absence_alerts',
    'sos_incidents', 'sos_events',
    'stop_requests', 'stop_request_votes',
    'notifications', 'notification_deliveries', 'notification_preferences', 'announcements', 'settings', 'feature_flags', 'sms_templates',
    'audit_logs', 'data_requests', 'consents', 'notice_versions', 'export_jobs',
    'push_tokens' # OV-15 authorized addition
]

with open('packages/db/prisma/schema.prisma', 'r', encoding='utf-8') as f:
    schema_tables = set(re.findall(r'@@map\("([a-z0-9_]+)"\)', f.read()))

partitioned_tables = ['location_samples', 'device_heartbeats']

print(f"Contract Part 7 tables: 56")
print(f"OV-15 authorized additions: 1 ('push_tokens')")
print(f"Total contract expected physical tables: {len(part7_expected)} (57)")
print(f"Prisma schema mapped tables: {len(schema_tables)}")
print(f"Partitioned tables (Part 7.12): {len(partitioned_tables)} ({', '.join(partitioned_tables)})")

missing = [t for t in part7_expected if t not in schema_tables]
extra = [t for t in schema_tables if t not in part7_expected]

print(f"Missing in schema.prisma ({len(missing)}): {missing}")
print(f"Extra in schema.prisma ({len(extra)}): {extra}")
