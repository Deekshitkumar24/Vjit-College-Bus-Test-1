import { QrPayload, QrPayloadSchema } from '@collegebus/contracts';

export type QrValidationResult =
  | { isValid: true; payload: QrPayload }
  | { isValid: false; error: 'INVALID_FORMAT' | 'EXPIRED' | 'REPLAY_DETECTED'; message: string };

export class QrAttendanceValidator {
  private readonly seenNonces = new Map<string, number>();
  private readonly epochWindowMs: number;
  private readonly maxEpochSkew: number;
  private readonly nonceRetentionMs: number;

  constructor(options?: {
    epochWindowMs?: number;
    maxEpochSkew?: number;
    nonceRetentionMs?: number;
  }) {
    this.epochWindowMs = options?.epochWindowMs ?? 15_000; // 15-second epoch
    this.maxEpochSkew = options?.maxEpochSkew ?? 1; // +/- 1 epoch window (max 30s)
    this.nonceRetentionMs = options?.nonceRetentionMs ?? 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Parses raw QR payload string into typed QrPayload object.
   * Supports JSON format or pipe-delimited string (tripId|busId|epoch|nonce|signature).
   */
  public parsePayload(raw: string): QrPayload | null {
    try {
      if (raw.startsWith('{')) {
        const parsed = JSON.parse(raw);
        const validated = QrPayloadSchema.safeParse(parsed);
        return validated.success ? validated.data : null;
      }

      const parts = raw.split('|');
      if (parts.length === 5) {
        const candidate = {
          trip_id: parts[0]!,
          bus_id: parts[1]!,
          epoch: parseInt(parts[2]!, 10),
          nonce: parts[3]!,
          signature: parts[4]!,
        };
        const validated = QrPayloadSchema.safeParse(candidate);
        return validated.success ? validated.data : null;
      }
    } catch {
      return null;
    }

    return null;
  }

  /**
   * Validates dynamic QR code freshness and guards against replay attacks.
   */
  public validate(raw: string, currentTimestampMs: number = Date.now()): QrValidationResult {
    this.cleanupOldNonces(currentTimestampMs);

    const payload = this.parsePayload(raw);
    if (!payload) {
      return {
        isValid: false,
        error: 'INVALID_FORMAT',
        message: 'Scanned QR code is not a valid bus attendance token',
      };
    }

    // Check anti-replay
    if (this.seenNonces.has(payload.nonce)) {
      return {
        isValid: false,
        error: 'REPLAY_DETECTED',
        message: 'This QR code was already scanned and used',
      };
    }

    // Check epoch freshness
    const currentEpoch = Math.floor(currentTimestampMs / this.epochWindowMs);
    const epochDiff = Math.abs(payload.epoch - currentEpoch);

    if (epochDiff > this.maxEpochSkew) {
      return {
        isValid: false,
        error: 'EXPIRED',
        message: 'QR code expired. Please point camera at the driver screen again.',
      };
    }

    // Register nonce
    this.seenNonces.set(payload.nonce, currentTimestampMs);

    return {
      isValid: true,
      payload,
    };
  }

  private cleanupOldNonces(now: number): void {
    for (const [nonce, timestamp] of this.seenNonces.entries()) {
      if (now - timestamp > this.nonceRetentionMs) {
        this.seenNonces.delete(nonce);
      }
    }
  }

  public getSeenNonceCount(): number {
    return this.seenNonces.size;
  }
}
