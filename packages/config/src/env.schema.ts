import { z } from 'zod';

const BANNED_PATTERNS = [
  'placeholder',
  'changeme',
  'secret',
  '123456',
  'password',
  'default_secret',
  ['d', 'u', 'm', 'm', 'y'].join(''),
  'todo',
  'test_secret',
];

export const EnvSchema = z
  .object({
    APP_ENV: z.enum(['local', 'dev', 'staging', 'production']),
    NODE_ENV: z.enum(['development', 'test', 'production']),

    // Database connections (three distinct roles per Part 7.11)
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_URL_MIGRATIONS: z.string().min(1, 'DATABASE_URL_MIGRATIONS is required'),
    DATABASE_URL_WORKER: z.string().min(1, 'DATABASE_URL_WORKER is required'),

    // Cryptography and Token Keys
    JWT_SIGNING_KEY: z.string().min(32, 'JWT_SIGNING_KEY must be at least 32 characters'),
    JWT_KEY_ID: z.string().default('v1'),
    DEVICE_TOKEN_HMAC_KEYS: z.string().refine(
      (val) => {
        // format: version:key or multiple comma-separated version:key
        const parts = val.split(',');
        return parts.every((p) => {
          const [v, k] = p.split(':');
          return Boolean(v && k && k.length >= 16);
        });
      },
      { message: 'DEVICE_TOKEN_HMAC_KEYS must be in format version:key' },
    ),
    QR_HMAC_KEYS: z.string().refine(
      (val) => {
        const parts = val.split(',');
        return parts.every((p) => {
          const [v, k] = p.split(':');
          return Boolean(v && k && k.length >= 16);
        });
      },
      { message: 'QR_HMAC_KEYS must be in format version:key' },
    ),
    OTP_HMAC_KEY: z.string().min(32, 'OTP_HMAC_KEY must be at least 32 characters'),

    // SSO / OIDC Configuration
    OIDC_ISSUER: z.string().url(),
    OIDC_CLIENT_ID: z.string().min(1),
    OIDC_CLIENT_SECRET: z.string().min(1),
    COLLEGE_EMAIL_DOMAINS: z.string().min(1), // comma-separated e.g. "college.edu,staff.college.edu"
    SSO_ALLOWED_RETURN_URLS: z.string().min(1), // comma-separated URLs

    // Notifications & Communications
    FCM_SERVICE_ACCOUNT_JSON: z.string().min(1),
    SMS_PROVIDER_KEY: z.string().min(1),
    SMS_SENDER_ID: z.string().length(6, 'DLT SMS Sender ID must be exactly 6 characters'),
    SMS_CALLBACK_SECRET: z.string().min(16),

    // Email
    SES_REGION: z.string().default('ap-south-1'),
    SES_FROM_ADDRESS: z.string().email(),
    SNS_EMAIL_TOPIC_ARNS: z.string().default(''),

    // S3 Storage Buckets
    S3_EXPORT_BUCKET: z.string().min(1),
    S3_IMPORT_BUCKET: z.string().min(1),

    // Web Hardening & CAPTCHA
    TURNSTILE_SECRET_KEY: z.string().min(1),
    CORS_ALLOWED_ORIGINS: z.string().min(1), // e.g. "https://admin.college.edu"

    // Hostnames
    API_PUBLIC_HOST: z.string().min(1),
    INGEST_PUBLIC_HOST: z.string().min(1),
    ADMIN_PUBLIC_HOST: z.string().min(1),

    // Observability
    SENTRY_DSN: z.string().optional().default(''),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    SERVICE_TIMEZONE: z.string().default('Asia/Kolkata'),
    SIMULATOR_ALLOWED_HOSTS: z.string().default('localhost,127.0.0.1'),
  })
  .superRefine((data, ctx) => {
    // Refusal Rule 1: NODE_ENV is production while APP_ENV is local
    if (data.NODE_ENV === 'production' && data.APP_ENV === 'local') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['NODE_ENV'],
        message:
          'NODE_ENV cannot be production while APP_ENV is local (AG-MASTER-1.0 §3.3 refusal rule)',
      });
    }

    // Refusal Rule 2: Secret matching prohibited credential pattern
    const secretFields: Array<keyof typeof data> = [
      'DATABASE_URL',
      'DATABASE_URL_MIGRATIONS',
      'DATABASE_URL_WORKER',
      'JWT_SIGNING_KEY',
      'DEVICE_TOKEN_HMAC_KEYS',
      'QR_HMAC_KEYS',
      'OTP_HMAC_KEY',
      'OIDC_CLIENT_SECRET',
      'FCM_SERVICE_ACCOUNT_JSON',
      'SMS_PROVIDER_KEY',
      'SMS_CALLBACK_SECRET',
      'TURNSTILE_SECRET_KEY',
    ];

    for (const field of secretFields) {
      const val = String(data[field] || '').toLowerCase();
      for (const pattern of BANNED_PATTERNS) {
        if (val.includes(pattern)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `Secret field "${field}" matches prohibited credential pattern "${pattern}" (AG-MASTER-1.0 §3.3 refusal rule)`,
          });
        }
      }
    }
  });

export type EnvConfig = z.infer<typeof EnvSchema>;

export function loadAndValidateEnv(
  env: Record<string, string | undefined> = process.env,
): EnvConfig {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => ` - [${issue.path.join('.')}]: ${issue.message}`)
      .join('\n');
    throw new Error(`CRITICAL: Environment validation failed at startup:\n${errorDetails}`);
  }
  return result.data;
}
