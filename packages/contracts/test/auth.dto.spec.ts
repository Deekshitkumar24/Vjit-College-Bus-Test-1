import { describe, it, expect } from 'vitest';
import {
  SsoStartSchema,
  DriverOtpRequestSchema,
  DriverOtpVerifySchema,
  RefreshTokenSchema,
  MfaVerifySchema,
  ErrorEnvelopeSchema,
} from '../src/auth.dto';

describe('Contracts - Auth DTOs', () => {
  it('validates SsoStartSchema correctly', () => {
    expect(SsoStartSchema.safeParse({}).success).toBe(true);
    expect(SsoStartSchema.safeParse({ return_url: 'https://college.edu/callback' }).success).toBe(
      true,
    );
    expect(SsoStartSchema.safeParse({ return_url: 'not-a-url' }).success).toBe(false);
  });

  it('validates DriverOtpRequestSchema correctly', () => {
    expect(DriverOtpRequestSchema.safeParse({ email: 'driver@college.edu' }).success).toBe(true);
    expect(DriverOtpRequestSchema.safeParse({ email: 'invalid-email' }).success).toBe(false);
  });

  it('validates DriverOtpVerifySchema correctly', () => {
    expect(
      DriverOtpVerifySchema.safeParse({ email: 'driver@college.edu', code: '123456' }).success,
    ).toBe(true);
    expect(
      DriverOtpVerifySchema.safeParse({ email: 'driver@college.edu', code: '12345' }).success,
    ).toBe(false);
    expect(
      DriverOtpVerifySchema.safeParse({ email: 'driver@college.edu', code: '1234567' }).success,
    ).toBe(false);
  });

  it('validates RefreshTokenSchema correctly', () => {
    expect(RefreshTokenSchema.safeParse({ refresh_token: 'valid-token' }).success).toBe(true);
    expect(RefreshTokenSchema.safeParse({ refresh_token: '' }).success).toBe(false);
  });

  it('validates MfaVerifySchema correctly', () => {
    expect(MfaVerifySchema.safeParse({ totp_code: '654321' }).success).toBe(true);
    expect(MfaVerifySchema.safeParse({ totp_code: '123' }).success).toBe(false);
  });

  it('validates ErrorEnvelopeSchema correctly', () => {
    const validError = {
      error: {
        code: 'AUTH_REQUIRED',
        message: 'No valid credentials',
        request_id: 'req-12345',
      },
    };
    expect(ErrorEnvelopeSchema.safeParse(validError).success).toBe(true);

    const invalidError = {
      code: 'AUTH_REQUIRED',
    };
    expect(ErrorEnvelopeSchema.safeParse(invalidError).success).toBe(false);
  });
});
