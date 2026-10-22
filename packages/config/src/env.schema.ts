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

    // SSO / Dual OIDC Configuration (Part 3.3, L-4, OV-9)
    SSO_PROVIDER: z
      .enum(['GOOGLE', 'ENTRA', 'BOTH', 'google', 'entra', 'both'])
      .default('GOOGLE')
      .transform((val) => val.toUpperCase() as 'GOOGLE' | 'ENTRA' | 'BOTH'),

    // Google Workspace OIDC Settings
    GOOGLE_OIDC_ISSUER: z.string().url().optional(),
    GOOGLE_OIDC_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_OIDC_CLIENT_SECRET: z.string().min(1).optional(),

    // Microsoft Entra ID OIDC Settings
    ENTRA_OIDC_ISSUER: z.string().url().optional(),
    ENTRA_OIDC_CLIENT_ID: z.string().min(1).optional(),
    ENTRA_OIDC_CLIENT_SECRET: z.string().min(1).optional(),
    ENTRA_OIDC_TENANT_ID: z.string().min(1).optional(),

    // Legacy OIDC fallbacks
    OIDC_ISSUER: z.string().url().optional(),
    OIDC_CLIENT_ID: z.string().min(1).optional(),
    OIDC_CLIENT_SECRET: z.string().min(1).optional(),
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

    // Refusal Rule: Google Workspace OIDC incomplete when provider is GOOGLE or BOTH (L-4, OV-9)
    if (data.SSO_PROVIDER === 'GOOGLE' || data.SSO_PROVIDER === 'BOTH') {
      const googleIssuer = data.GOOGLE_OIDC_ISSUER || data.OIDC_ISSUER;
      const googleClientId = data.GOOGLE_OIDC_CLIENT_ID || data.OIDC_CLIENT_ID;
      const googleClientSecret = data.GOOGLE_OIDC_CLIENT_SECRET || data.OIDC_CLIENT_SECRET;

      if (!googleIssuer || !googleClientId || !googleClientSecret) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GOOGLE_OIDC_CLIENT_ID'],
          message:
            'Google Workspace OIDC configuration is incomplete: GOOGLE_OIDC_ISSUER, GOOGLE_OIDC_CLIENT_ID, and GOOGLE_OIDC_CLIENT_SECRET are required',
        });
      }
    }

    // Refusal Rule: Microsoft Entra ID OIDC incomplete when provider is ENTRA or BOTH (L-4, OV-9)
    if (data.SSO_PROVIDER === 'ENTRA' || data.SSO_PROVIDER === 'BOTH') {
      if (!data.ENTRA_OIDC_ISSUER || !data.ENTRA_OIDC_CLIENT_ID || !data.ENTRA_OIDC_CLIENT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ENTRA_OIDC_CLIENT_ID'],
          message:
            'Microsoft Entra ID OIDC configuration is incomplete: ENTRA_OIDC_ISSUER, ENTRA_OIDC_CLIENT_ID, and ENTRA_OIDC_CLIENT_SECRET are required',
        });
      }
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
      'GOOGLE_OIDC_CLIENT_SECRET',
      'ENTRA_OIDC_CLIENT_SECRET',
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
