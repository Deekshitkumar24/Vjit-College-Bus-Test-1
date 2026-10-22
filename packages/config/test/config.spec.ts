import { describe, it, expect } from 'vitest';
import { loadAndValidateEnv } from '../src/env.schema.js';
import { SYSTEM_DEFAULTS, SECTION_35_KEYS } from '../src/defaults.js';

describe('Configuration Package & Startup Refusal Rules', () => {
  const validEnv = {
    APP_ENV: 'dev',
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://app_runtime:k8Fm9QzXvL2nPtRw@localhost:5432/collegebus',
    DATABASE_URL_MIGRATIONS: 'postgresql://app_migrator:w4Ty7UoPqA1sDfGh@localhost:5432/collegebus',
    DATABASE_URL_WORKER: 'postgresql://app_worker:z9XcVbNmK3jHgFdS@localhost:5432/collegebus',
    JWT_SIGNING_KEY: 'e4b2c1d0f8a7e6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f',
    JWT_KEY_ID: 'v1',
    DEVICE_TOKEN_HMAC_KEYS: 'v1:8f7e6d5c4b3a29182736451029384756',
    QR_HMAC_KEYS: 'v1:a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4',
    OTP_HMAC_KEY: '9f8e7d6c5b4a39281726354859607182',
    OIDC_ISSUER: 'https://accounts.google.com',
    OIDC_CLIENT_ID: 'college-bus-tracker-client-id.apps.googleusercontent.com',
    OIDC_CLIENT_SECRET: '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',
    COLLEGE_EMAIL_DOMAINS: 'college.edu,faculty.college.edu',
    SSO_ALLOWED_RETURN_URLS:
      'https://admin.college.edu/auth/callback,https://bus.college.edu/auth/callback',
    FCM_SERVICE_ACCOUNT_JSON: '{"type":"service_account","project_id":"college-bus"}',
    SMS_PROVIDER_KEY: 'sms_live_api_key_8f7d6e5c4b3a2019',
    SMS_SENDER_ID: 'CLGBUS',
    SMS_CALLBACK_SECRET: 'cbk_9a8b7c6d5e4f3a2b1c0d',
    SES_REGION: 'ap-south-1',
    SES_FROM_ADDRESS: 'notifications@college.edu',
    SNS_EMAIL_TOPIC_ARNS: 'arn:aws:sns:ap-south-1:123456789012:ses-events',
    S3_EXPORT_BUCKET: 'collegebus-reports-export-bucket',
    S3_IMPORT_BUCKET: 'collegebus-imports-bucket',
    TURNSTILE_SECRET_KEY: '0x4AAAAAAAc_mK9pL2oI8uY7tR5eW3qA1zX',
    CORS_ALLOWED_ORIGINS: 'https://admin.college.edu',
    API_PUBLIC_HOST: 'api.college.edu',
    INGEST_PUBLIC_HOST: 'ingest.college.edu',
    ADMIN_PUBLIC_HOST: 'admin.college.edu',
    LOG_LEVEL: 'info',
    SERVICE_TIMEZONE: 'Asia/Kolkata',
    SIMULATOR_ALLOWED_HOSTS: 'localhost,127.0.0.1',
  };

  it('validates a completely valid configuration successfully', () => {
    const config = loadAndValidateEnv(validEnv);
    expect(config.APP_ENV).toBe('dev');
    expect(config.SMS_SENDER_ID).toBe('CLGBUS');
  });

  it('refuses startup if NODE_ENV is production while APP_ENV is local', () => {
    const invalidEnv = {
      ...validEnv,
      APP_ENV: 'local',
      NODE_ENV: 'production',
    };
    expect(() => loadAndValidateEnv(invalidEnv)).toThrowError(
      /NODE_ENV cannot be production while APP_ENV is local/,
    );
  });

  it('refuses startup if any secret matches a prohibited token string', () => {
    const invalidSecretEnv = {
      ...validEnv,
      JWT_SIGNING_KEY: 'prohibited_changeme_key_for_unit_tests',
    };
    expect(() => loadAndValidateEnv(invalidSecretEnv)).toThrowError(
      /matches prohibited credential pattern/,
    );
  });

  it('refuses startup if DLT SMS Sender ID is not exactly 6 characters', () => {
    const invalidSenderEnv = {
      ...validEnv,
      SMS_SENDER_ID: 'BUS1',
    };
    expect(() => loadAndValidateEnv(invalidSenderEnv)).toThrowError(
      /DLT SMS Sender ID must be exactly 6 characters/,
    );
  });

  it('refuses startup if Google Workspace OIDC configuration is incomplete (P0-T6, OV-9, L-4)', () => {
    const invalidGoogleEnv = {
      ...validEnv,
      SSO_PROVIDER: 'GOOGLE',
      GOOGLE_OIDC_ISSUER: 'https://accounts.google.com',
      GOOGLE_OIDC_CLIENT_ID: 'google-client-id',
      GOOGLE_OIDC_CLIENT_SECRET: '',
      OIDC_CLIENT_SECRET: '',
    };
    expect(() => loadAndValidateEnv(invalidGoogleEnv)).toThrowError(
      /Google Workspace OIDC configuration is incomplete/,
    );
  });

  it('refuses startup if Microsoft Entra ID OIDC configuration is incomplete (P0-T6, OV-9, L-4)', () => {
    const invalidEntraEnv = {
      ...validEnv,
      SSO_PROVIDER: 'ENTRA',
      ENTRA_OIDC_ISSUER: 'https://login.microsoftonline.com/tenant-123/v2.0',
      ENTRA_OIDC_CLIENT_ID: '',
      ENTRA_OIDC_CLIENT_SECRET: 'MSFT-9x8y7z6w5v4u3t2s1r0q9p8o',
    };
    expect(() => loadAndValidateEnv(invalidEntraEnv)).toThrowError(
      /Microsoft Entra ID OIDC configuration is incomplete/,
    );
  });

  it('accepts valid dual Google Workspace and Microsoft Entra ID OIDC configuration (P0-T6, OV-9, L-4)', () => {
    const validDualEnv = {
      ...validEnv,
      SSO_PROVIDER: 'BOTH',
      GOOGLE_OIDC_ISSUER: 'https://accounts.google.com',
      GOOGLE_OIDC_CLIENT_ID: 'google-client-id-123',
      GOOGLE_OIDC_CLIENT_SECRET: 'GOCSPX-9x8y7z6w5v4u3t2s1r0q9p8o',
      ENTRA_OIDC_ISSUER: 'https://login.microsoftonline.com/tenant-123/v2.0',
      ENTRA_OIDC_CLIENT_ID: 'entra-client-id-456',
      ENTRA_OIDC_CLIENT_SECRET: 'MSFT-1a2b3c4d5e6f7g8h9i0j1k2l',
      ENTRA_OIDC_TENANT_ID: 'tenant-123',
    };
    const config = loadAndValidateEnv(validDualEnv);
    expect(config.SSO_PROVIDER).toBe('BOTH');
    expect(config.GOOGLE_OIDC_CLIENT_ID).toBe('google-client-id-123');
    expect(config.ENTRA_OIDC_CLIENT_ID).toBe('entra-client-id-456');
  });

  it('verifies that system defaults match specification values exactly', () => {
    // Hardware validity
    expect(SYSTEM_DEFAULTS['hw.stale_after_s']).toBe(60);
    expect(SYSTEM_DEFAULTS['hw.min_satellites']).toBe(4);
    expect(SYSTEM_DEFAULTS['hw.max_hdop']).toBe(5.0);
    expect(SYSTEM_DEFAULTS['hw.gps_lost_after_s']).toBe(30);

    // Phone validity
    expect(SYSTEM_DEFAULTS['phone.max_accuracy_m']).toBe(50);
    expect(SYSTEM_DEFAULTS['phone.standby_interval_s']).toBe(30);
    expect(SYSTEM_DEFAULTS['phone.fallback_interval_s']).toBe(10);

    // Selector
    expect(SYSTEM_DEFAULTS['selector.cooldown_s']).toBe(30);
    expect(SYSTEM_DEFAULTS['selector.return_fixes']).toBe(3);
    expect(SYSTEM_DEFAULTS['selector.both_down_s']).toBe(120);
    expect(SYSTEM_DEFAULTS['selector.flap_limit']).toBe(6);
    expect(SYSTEM_DEFAULTS['selector.flap_hold_s']).toBe(300);

    // Stops and ETA
    expect(SYSTEM_DEFAULTS['stop.radius_m']).toBe(50);
    expect(SYSTEM_DEFAULTS['stop.arrival_speed_kmh']).toBe(5);
    expect(SYSTEM_DEFAULTS['stop.arrival_dwell_s']).toBe(15);
    expect(SYSTEM_DEFAULTS['eta.speed_default_kmh']).toBe(20);

    // Attendance
    expect(SYSTEM_DEFAULTS['qr.rotation_s']).toBe(30);
    expect(SYSTEM_DEFAULTS['boarding.window_before_min']).toBe(10);
    expect(SYSTEM_DEFAULTS['boarding.window_after_min']).toBe(15);
    expect(SYSTEM_DEFAULTS['leave.cutoff_before_trip_min']).toBe(30);

    // SOS
    expect(SYSTEM_DEFAULTS['sos.dedupe_s']).toBe(60);
    expect(SYSTEM_DEFAULTS['sos.cancel_window_s']).toBe(30);
    expect(SYSTEM_DEFAULTS['sos.escalation_min']).toEqual([0, 2, 5, 10]);

    // Notifications
    expect(SYSTEM_DEFAULTS['notify.quiet_start']).toBe('22:00');
    expect(SYSTEM_DEFAULTS['notify.quiet_end']).toBe('06:00');
    expect(SYSTEM_DEFAULTS['notify.push_per_hour']).toBe(6);
    expect(SYSTEM_DEFAULTS['notify.group_window_s']).toBe(120);

    // Sessions and OTP
    expect(SYSTEM_DEFAULTS['session.idle_min']).toBe(30);
    expect(SYSTEM_DEFAULTS['session.idle_min_sec']).toBe(15);
    expect(SYSTEM_DEFAULTS['otp.ttl_min']).toBe(10);
    expect(SYSTEM_DEFAULTS['otp.attempts']).toBe(5);
    expect(SYSTEM_DEFAULTS['otp.lock_min']).toBe(15);

    // Data retention
    expect(SYSTEM_DEFAULTS['retention.location_days']).toBe(90);
    expect(SYSTEM_DEFAULTS['retention.audit_log_years']).toBe(3);

    // Service
    expect(SYSTEM_DEFAULTS['service.hours']).toBe('05:30 to 22:30');
  });

  it('seeds every key listed in SW-MVP-1.0 §35 (completeness check)', () => {
    // This test ensures that the SYSTEM_DEFAULTS object contains all keys
    // that the specification defines. Each key must have a defined, non-undefined value.
    const keys = SECTION_35_KEYS;
    expect(keys.length).toBeGreaterThanOrEqual(85);

    for (const key of keys) {
      expect(SYSTEM_DEFAULTS[key], `Missing value for key: ${key}`).toBeDefined();
    }

    // Spot-check key domain coverage — every domain prefix must be present
    const domains = new Set(keys.map((k) => k.split('.')[0]));
    const requiredDomains = [
      'hw',
      'phone',
      'vehicle',
      'ingest',
      'rate',
      'selector',
      'shift',
      'trip',
      'stop',
      'eta',
      'snapshot',
      'qr',
      'boarding',
      'leave',
      'approach',
      'sos',
      'firmware',
      'route',
      'notify',
      'summary',
      'session',
      'otp',
      'mfa',
      'doc',
      'app',
      'web',
      'import',
      'export',
      'retention',
      'service',
      'preflight',
      'absence',
      'stop_request',
    ];
    for (const domain of requiredDomains) {
      expect(domains.has(domain), `Missing domain prefix: ${domain}`).toBe(true);
    }
  });
});

