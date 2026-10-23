import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { RateLimiterMiddleware } from '../src/common/middleware/rate-limiter.middleware.js';
import { IdempotencyMiddleware } from '../src/common/middleware/idempotency.middleware.js';

describe('Authentication & Security Hardening Unit Tests (P0-T6 to P0-T9)', () => {
  let authService: AuthService;
  const testSecret = '0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    authService = new AuthService();
    RateLimiterMiddleware.reset();
    IdempotencyMiddleware.reset();
  });

  describe('OIDC SSO with PKCE, State & Nonce (P0-T6, RS-09, L-4, OV-9)', () => {
    it('generates authorization URL with code_challenge (S256), state, and nonce for Google Workspace', () => {
      const redirectUri = 'https://portal.college.edu/auth/callback';
      const result = authService.generateOidcAuthorizationUrl('GOOGLE', redirectUri);

      expect(result.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(result.url).toContain('code_challenge=');
      expect(result.url).toContain('code_challenge_method=S256');
      expect(result.url).toContain(`state=${result.state}`);
      expect(result.url).toContain(`nonce=${result.nonce}`);
      expect(result.codeVerifier.length).toBeGreaterThanOrEqual(43);
    });

    it('generates authorization URL with code_challenge (S256), state, and nonce for Microsoft Entra ID', () => {
      const redirectUri = 'https://portal.college.edu/auth/callback';
      const result = authService.generateOidcAuthorizationUrl('MICROSOFT', redirectUri);

      expect(result.url).toContain(
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      );
      expect(result.url).toContain('code_challenge_method=S256');
      expect(result.url).toContain(`state=${result.state}`);
      expect(result.url).toContain(`nonce=${result.nonce}`);
    });

    it('validates matching state and nonce, and rejects mismatched state with INVALID_OIDC_STATE', () => {
      const redirectUri = 'https://portal.college.edu/auth/callback';
      const authReq = authService.generateOidcAuthorizationUrl('GOOGLE', redirectUri);

      // Successful validation
      const validated = authService.validateOidcCallback({
        state: authReq.state,
        code: 'auth_code_from_idp',
        idTokenNonce: authReq.nonce,
      });
      expect(validated.valid).toBe(true);
      expect(validated.provider).toBe('GOOGLE');
      expect(validated.codeVerifier).toBe(authReq.codeVerifier);

      // Tampered state fails
      expect(() =>
        authService.validateOidcCallback({
          state: 'tampered-or-expired-state',
          code: 'auth_code',
        }),
      ).toThrowError(/Invalid or expired OIDC state parameter/);
    });
  });

  describe('Driver OTP & Lockout (T-AUTH-01, Part 13.4, Part 13.20)', () => {
    it('dispatches a valid code and locks account after 5 consecutive incorrect attempts per code (C-06)', async () => {
      const email = 'driver.ops@college.edu';
      const code = await authService.requestDriverOtp(email, testSecret);
      expect(code).toMatch(/^\d{6}$/);

      // Attempt 1 to 4: Failures
      for (let i = 1; i < 5; i++) {
        await expect(authService.verifyDriverOtp(email, '000000', testSecret)).rejects.toThrowError(
          /Invalid email or authentication code/,
        );
      }

      // Attempt 5: Exceeds threshold -> triggers account lockout
      await expect(authService.verifyDriverOtp(email, '000000', testSecret)).rejects.toThrowError(
        /Account is locked for 15 minutes/,
      );

      // Subsequent attempt rejected while locked
      await expect(authService.verifyDriverOtp(email, code, testSecret)).rejects.toThrowError(
        /Account is temporarily locked/,
      );
    });

    it('successfully verifies correct code and marks it single-use', async () => {
      const email = 'driver.success@college.edu';
      const code = await authService.requestDriverOtp(email, testSecret);

      const tokens = await authService.verifyDriverOtp(email, code, testSecret);
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();

      // Second attempt with same code must fail (single-use enforcement)
      await expect(authService.verifyDriverOtp(email, code, testSecret)).rejects.toThrowError(
        /expired or has already been used/,
      );
    });

    it('enforces F-AUTH-02: 10 consecutive failures across codes locks account for 15 minutes (C-06)', async () => {
      const email = 'driver.consecutive@college.edu';
      // Code 1: 4 attempts
      await authService.requestDriverOtp(email, testSecret);
      for (let i = 0; i < 4; i++) {
        await expect(authService.verifyDriverOtp(email, '000000', testSecret)).rejects.toThrowError(
          /Invalid email or authentication code/,
        );
      }
      // Code 2: 4 attempts
      await authService.requestDriverOtp(email, testSecret);
      for (let i = 0; i < 4; i++) {
        await expect(authService.verifyDriverOtp(email, '000000', testSecret)).rejects.toThrowError(
          /Invalid email or authentication code/,
        );
      }
      // Code 3: 2 attempts -> reaches 10 consecutive failures!
      await authService.requestDriverOtp(email, testSecret);
      await expect(authService.verifyDriverOtp(email, '000000', testSecret)).rejects.toThrowError(
        /Invalid email or authentication code/,
      );

      await expect(authService.verifyDriverOtp(email, '000000', testSecret)).rejects.toThrowError(
        /Account is locked for 15 minutes/,
      );
    });
  });

  describe('Admin MFA Recovery Codes (P0-T12, Part 13.20)', () => {
    it('generates 10 single-use recovery codes hashed with Argon2id and shown once', async () => {
      const userId = 'admin_user_001';
      const { secret, recoveryCodes } = await authService.enrolAdminMfa(userId);

      expect(secret).toBeDefined();
      expect(recoveryCodes).toHaveLength(10);
      expect(recoveryCodes[0]).toMatch(/^RC-[A-F0-9]{4}-[A-F0-9]{4}$/);

      // Verify the first recovery code succeeds
      const firstCode = recoveryCodes[0];
      const valid = await authService.verifyRecoveryCode(userId, firstCode);
      expect(valid).toBe(true);

      // Second use of the same recovery code MUST fail (single-use enforcement)
      await expect(authService.verifyRecoveryCode(userId, firstCode)).rejects.toThrowError(
        /Invalid or previously used recovery code/,
      );

      // An invalid code fails
      await expect(authService.verifyRecoveryCode(userId, 'RC-0000-0000')).rejects.toThrowError(
        /Invalid or previously used recovery code/,
      );
    }, 30000);
  });

  describe('Session Token Family Rotation & Reuse Detection (T-AUTH-03, Part 13.20)', () => {
    it('rotates refresh token cleanly on valid request', () => {
      const session = authService.createSession('user_123', ['STU'], 'iPhone 15');
      const rotated = authService.rotateRefreshToken(session.refreshToken);

      expect(rotated.accessToken).toBeDefined();
      expect(rotated.refreshToken).toBeDefined();
      expect(rotated.refreshToken).not.toBe(session.refreshToken);
    });

    it('revokes entire session family if an old/reused refresh token is presented', () => {
      const session = authService.createSession('user_compromised', ['STU'], 'Android 14');
      const initialToken = session.refreshToken;

      // Legitimate user rotates token
      const legitRotation = authService.rotateRefreshToken(initialToken);
      expect(legitRotation.refreshToken).toBeDefined();

      // Attacker attempts to replay the old initialToken!
      expect(() => authService.rotateRefreshToken(initialToken)).toThrowError(
        /Session has been revoked or expired/,
      );

      // Now legitimate user's new token is ALSO revoked because the family was breached!
      expect(() => authService.rotateRefreshToken(legitRotation.refreshToken)).toThrowError(
        /Session has been revoked or expired/,
      );
    });
  });

  describe('Rate Limiter Middleware (T-SEC-04, Part 13.4)', () => {
    it('returns 429 when route rate limits are exceeded', () => {
      const middleware = new RateLimiterMiddleware();
      const mockReq: any = {
        path: '/api/v1/auth/otp/verify',
        method: 'POST',
        ip: '192.168.1.100',
      };
      const headers: Record<string, string> = {};
      const mockRes: any = {
        setHeader: (k: string, v: string) => {
          headers[k] = v;
        },
      };
      const nextFn = () => {};

      // Limit for /auth/otp/verify is 5 requests per 900s
      for (let i = 0; i < 5; i++) {
        middleware.use(mockReq, mockRes, nextFn);
      }

      // 6th attempt must trigger 429 RATE_LIMITED
      expect(() => middleware.use(mockReq, mockRes, nextFn)).toThrowError(/Rate limit exceeded/);
      expect(headers['Retry-After']).toBeDefined();
      expect(headers['RateLimit-Remaining']).toBe('0');
    });
  });

  describe('Idempotency Middleware (Part 8.1)', () => {
    it('catches conflicting payload submitted with same Idempotency-Key', () => {
      const middleware = new IdempotencyMiddleware();
      const mockReq1: any = {
        method: 'POST',
        headers: { 'idempotency-key': 'e8a7c6b5-d4e3-4f2a-1b0c-9d8e7f6a5b4c' },
        user: { userId: 'usr_1' },
        body: { amount: 100 },
      };
      const mockRes1: any = {
        statusCode: 200,
        json: (b: any) => b,
      };

      middleware.use(mockReq1, mockRes1, () => {});
      mockRes1.json({ success: true });

      // Repeat with DIFFERENT body -> must throw 409 IDEMPOTENCY_CONFLICT
      const mockReq2: any = {
        method: 'POST',
        headers: { 'idempotency-key': 'e8a7c6b5-d4e3-4f2a-1b0c-9d8e7f6a5b4c' },
        user: { userId: 'usr_1' },
        body: { amount: 200 },
      };
      const mockRes2: any = {
        statusCode: 200,
        json: (b: any) => b,
      };

      expect(() => middleware.use(mockReq2, mockRes2, () => {})).toThrowError(
        /Idempotency key reused with different request payload/,
      );
    });
  });
});
