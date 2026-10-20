import { z } from 'zod';

export const SsoStartSchema = z.object({
  return_url: z.string().url().optional(),
});

export const DriverOtpRequestSchema = z.object({
  email: z.string().email(),
  turnstile_token: z.string().optional(),
});

export const DriverOtpVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, 'OTP must be exactly 6 digits'),
  device_label: z.string().max(100).optional(),
});

export const RefreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

export const MfaEnrolResponseSchema = z.object({
  secret: z.string(),
  qr_code_uri: z.string(),
  recovery_codes: z.array(z.string()).length(10),
});

export const MfaVerifySchema = z.object({
  totp_code: z.string().length(6, 'TOTP code must be 6 digits'),
});

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    request_id: z.string(),
  }),
});
