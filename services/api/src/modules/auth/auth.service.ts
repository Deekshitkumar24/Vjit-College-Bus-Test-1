import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { authenticator } from 'otplib';

export interface DriverOtpRecord {
  codeHmac: string;
  attempts: number;
  expiresAt: number;
  consumed: boolean;
  lockedUntil?: number;
}

export interface SessionRecord {
  id: string;
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  deviceLabel: string;
  revoked: boolean;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  // In-memory demo stores for unit testing / fast integration before DB is seeded
  private otpStore = new Map<string, DriverOtpRecord>();
  private sessionStore = new Map<string, SessionRecord>();
  private revokedFamilies = new Set<string>();

  // Driver OTP configuration from AG-MASTER-1.0 §13.4, §13.20
  private readonly OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_OTP_ATTEMPTS = 5;
  private readonly LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout after failure threshold

  public hashToken(token: string, secretKey: string): string {
    return createHmac('sha256', secretKey).update(token).digest('hex');
  }

  /**
   * Generates a 6-digit driver OTP and stores its HMAC hash (Part 13.20).
   */
  public async requestDriverOtp(email: string, hmacSecret: string): Promise<string> {
    const existing = this.otpStore.get(email);
    const now = Date.now();

    if (existing && existing.lockedUntil && existing.lockedUntil > now) {
      const waitMinutes = Math.ceil((existing.lockedUntil - now) / 60000);
      throw new ForbiddenException({
        code: 'ACCOUNT_LOCKED',
        message: `Account is temporarily locked. Please try again in ${waitMinutes} minutes.`,
      });
    }

    // Generate random 6-digit code
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const code = randomNum.toString();
    const codeHmac = this.hashToken(code, hmacSecret);

    this.otpStore.set(email, {
      codeHmac,
      attempts: 0,
      expiresAt: now + this.OTP_TTL_MS,
      consumed: false,
    });

    // In local/test mode, returns code; in production, dispatches email via SES
    return code;
  }

  /**
   * Verifies driver OTP with single-use, attempt limits, and lockout (T-AUTH-01).
   */
  public async verifyDriverOtp(
    email: string,
    code: string,
    hmacSecret: string,
    deviceLabel = 'Driver Phone',
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const record = this.otpStore.get(email);
    const now = Date.now();

    if (!record) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Invalid email or authentication code.',
      });
    }

    if (record.lockedUntil && record.lockedUntil > now) {
      throw new ForbiddenException({
        code: 'ACCOUNT_LOCKED',
        message: 'Account is temporarily locked due to excessive failed attempts.',
      });
    }

    if (record.consumed || now > record.expiresAt) {
      throw new UnauthorizedException({
        code: 'OTP_EXPIRED',
        message: 'Authentication code has expired or has already been used.',
      });
    }

    const inputHmac = this.hashToken(code, hmacSecret);
    if (inputHmac !== record.codeHmac) {
      record.attempts += 1;
      if (record.attempts >= this.MAX_OTP_ATTEMPTS) {
        record.lockedUntil = now + this.LOCKOUT_MS;
        throw new ForbiddenException({
          code: 'ACCOUNT_LOCKED',
          message: 'Too many incorrect attempts. Account is locked for 15 minutes.',
        });
      }
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or authentication code.',
      });
    }

    // Mark single-use consumed
    record.consumed = true;

    // Issue session and tokens
    return this.createSession(email, ['DRV'], deviceLabel);
  }

  /**
   * Creates a session family and returns access & refresh tokens (Part 13.20).
   */
  public createSession(
    userId: string,
    roles: string[],
    deviceLabel: string,
  ): { accessToken: string; refreshToken: string; sessionId: string } {
    const familyId = randomBytes(16).toString('hex');
    const sessionId = randomBytes(16).toString('hex');
    const refreshToken = randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashToken(refreshToken, 'session_secret');

    this.sessionStore.set(refreshTokenHash, {
      id: sessionId,
      userId,
      familyId,
      refreshTokenHash,
      deviceLabel,
      revoked: false,
      expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
    });

    // Mock access token for testing
    const accessToken = `jwt_${userId}_${roles.join('_')}_${sessionId}`;

    return {
      accessToken,
      refreshToken,
      sessionId,
    };
  }

  /**
   * Rotates refresh token with reuse detection (T-AUTH-03).
   * If a previously used refresh token is presented, revokes the whole family!
   */
  public rotateRefreshToken(
    oldRefreshToken: string,
  ): { accessToken: string; refreshToken: string } {
    const oldHash = this.hashToken(oldRefreshToken, 'session_secret');
    const session = this.sessionStore.get(oldHash);

    if (!session || session.revoked || this.revokedFamilies.has(session.familyId)) {
      if (session) {
        // Reuse detected! Compromised family -> revoke entire family
        this.revokedFamilies.add(session.familyId);
      }
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Session has been revoked or expired.',
      });
    }

    // Mark old refresh token revoked
    session.revoked = true;

    // Issue replacement refresh token inside SAME family
    const newRefreshToken = randomBytes(32).toString('hex');
    const newHash = this.hashToken(newRefreshToken, 'session_secret');

    this.sessionStore.set(newHash, {
      id: session.id,
      userId: session.userId,
      familyId: session.familyId,
      refreshTokenHash: newHash,
      deviceLabel: session.deviceLabel,
      revoked: false,
      expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
    });

    const accessToken = `jwt_${session.userId}_${session.id}`;
    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Generates TOTP secret and 10 single-use recovery codes for admin roles (Part 13.20).
   */
  public enrolAdminMfa(_userId: string): { secret: string; recoveryCodes: string[] } {
    const secret = authenticator.generateSecret();
    const recoveryCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      recoveryCodes.push(randomBytes(4).toString('hex').toUpperCase());
    }
    return { secret, recoveryCodes };
  }
}
