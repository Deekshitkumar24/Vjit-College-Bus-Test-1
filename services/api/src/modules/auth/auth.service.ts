import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { authenticator } from 'otplib';
import * as argon2 from 'argon2';

export interface DriverOtpRecord {
  codeHmac: string;
  attempts: number;
  expiresAt: number;
  consumed: boolean;
}

export interface AccountLockoutRecord {
  consecutiveFailures: number;
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

export interface StoredRecoveryCode {
  codeHash: string;
  usedAt: number | null;
}

@Injectable()
export class AuthService {
  // In-memory demo stores for unit testing / fast integration
  private otpStore = new Map<string, DriverOtpRecord>();
  private accountLockouts = new Map<string, AccountLockoutRecord>();
  private sessionStore = new Map<string, SessionRecord>();
  private revokedFamilies = new Set<string>();
  private recoveryCodeStore = new Map<string, StoredRecoveryCode[]>();

  // Driver OTP configuration: Section 35 has otp.attempts = 5 and otp.lock_min = 15;
  // F-AUTH-02 specifies 5 attempts per code, and 10 consecutive failures locks the account for 15 minutes (C-06).
  private readonly OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_CODE_ATTEMPTS = 5; // 5 attempts per code
  private readonly MAX_CONSECUTIVE_FAILURES = 10; // 10 consecutive failures lock account
  private readonly LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

  public hashToken(token: string, secretKey: string): string {
    return createHmac('sha256', secretKey).update(token).digest('hex');
  }

  /**
   * Generates a 6-digit driver OTP and stores its HMAC hash (Part 13.20).
   */
  public async requestDriverOtp(email: string, hmacSecret: string): Promise<string> {
    const lockout = this.accountLockouts.get(email);
    const now = Date.now();

    if (lockout && lockout.lockedUntil && lockout.lockedUntil > now) {
      const waitMinutes = Math.ceil((lockout.lockedUntil - now) / 60000);
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

    return code;
  }

  /**
   * Verifies driver OTP with single-use, attempt limits, and lockout (T-AUTH-01, C-06).
   */
  public async verifyDriverOtp(
    email: string,
    code: string,
    hmacSecret: string,
    deviceLabel = 'Driver Phone',
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const record = this.otpStore.get(email);
    let lockout = this.accountLockouts.get(email);
    if (!lockout) {
      lockout = { consecutiveFailures: 0 };
      this.accountLockouts.set(email, lockout);
    }

    const now = Date.now();

    if (lockout.lockedUntil && lockout.lockedUntil > now) {
      throw new ForbiddenException({
        code: 'ACCOUNT_LOCKED',
        message: 'Account is temporarily locked due to excessive failed attempts.',
      });
    }

    if (!record) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Invalid email or authentication code.',
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
      lockout.consecutiveFailures += 1;

      // Rule F-AUTH-02 / C-06: 10 consecutive failures lock account for 15 mins
      // Also if per-code attempts reach 5, code is invalidated
      if (
        lockout.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES ||
        record.attempts >= this.MAX_CODE_ATTEMPTS
      ) {
        lockout.lockedUntil = now + this.LOCKOUT_MS;
        record.consumed = true; // Invalidate code
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

    // Success: reset consecutive failures and mark single-use consumed
    lockout.consecutiveFailures = 0;
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
  public rotateRefreshToken(oldRefreshToken: string): {
    accessToken: string;
    refreshToken: string;
  } {
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
   * P0-T12: Generates TOTP secret and 10 single-use recovery codes hashed with Argon2id (Part 13.20).
   * The 10 plaintext codes are returned ONCE to the user.
   */
  public async enrolAdminMfa(userId: string): Promise<{ secret: string; recoveryCodes: string[] }> {
    const secret = authenticator.generateSecret();
    const recoveryCodes: string[] = [];
    const storedCodes: StoredRecoveryCode[] = [];

    for (let i = 0; i < 10; i++) {
      const code = `RC-${randomBytes(2).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
      recoveryCodes.push(code);
      const codeHash = await argon2.hash(code, { type: argon2.argon2id });
      storedCodes.push({ codeHash, usedAt: null });
    }

    this.recoveryCodeStore.set(userId, storedCodes);
    return { secret, recoveryCodes };
  }

  /**
   * P0-T12: Verifies and consumes a single-use Argon2id recovery code.
   * If valid and unconsumed, marks it consumed with timestamp. Re-use fails.
   */
  public async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    const storedCodes = this.recoveryCodeStore.get(userId);
    if (!storedCodes || storedCodes.length === 0) {
      throw new UnauthorizedException({
        code: 'INVALID_RECOVERY_CODE',
        message: 'No recovery codes configured for this account.',
      });
    }

    for (const record of storedCodes) {
      if (record.usedAt === null) {
        const matches = await argon2.verify(record.codeHash, code);
        if (matches) {
          record.usedAt = Date.now(); // Mark single-use consumed!
          return true;
        }
      }
    }

    throw new UnauthorizedException({
      code: 'INVALID_RECOVERY_CODE',
      message: 'Invalid or previously used recovery code.',
    });
  }
}
