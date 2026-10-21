import crypto from 'node:crypto';

export interface BoardingQrPayload {
  type: 'BOARDING_QR';
  v: number;
  bus_id: string;
  trip_id: string;
  epoch: number;
  sig: string;
  ts: string;
}

export interface BoardingQrState {
  token: string;
  payload: BoardingQrPayload;
  epochWindow: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  progress: number;
  busId: string;
  tripId: string;
}

export interface QrGeneratorOptions {
  busId: string;
  tripId: string;
  secretKey: string;
  windowSeconds?: number;
}

/**
 * Driver Boarding QR Generator
 * Per SW-MVP-1.0 §18:
 * - Generates 30-second rotating HMAC-SHA256 authenticated boarding QR tokens.
 * - Produces circular countdown timer state (remaining seconds, elapsed, progress 0.0 to 1.0).
 * - Rotates automatically every 30s epoch boundary.
 */
export class DriverQrGenerator {
  readonly busId: string;
  readonly tripId: string;
  readonly secretKey: string;
  readonly windowSeconds: number;

  constructor(options: QrGeneratorOptions) {
    if (!options.busId) throw new Error('busId is required');
    if (!options.tripId) throw new Error('tripId is required');
    if (!options.secretKey) throw new Error('secretKey is required');

    this.busId = options.busId;
    this.tripId = options.tripId;
    this.secretKey = options.secretKey;
    this.windowSeconds = options.windowSeconds ?? 30;
  }

  /**
   * Computes the epoch window index for a given timestamp.
   */
  getEpochWindow(timestampMs: number = Date.now()): number {
    return Math.floor(timestampMs / (this.windowSeconds * 1000));
  }

  /**
   * Generates HMAC-SHA256 signature for a specific epoch window.
   */
  generateSignature(epochWindow: number): string {
    const message = `cb:qr:${this.busId}:${this.tripId}:${epochWindow}`;
    return crypto.createHmac('sha256', this.secretKey).update(message).digest('hex');
  }

  /**
   * Generates QR payload and encoded token for the current or given timestamp.
   */
  generateQr(timestampMs: number = Date.now()): BoardingQrState {
    const epochWindow = this.getEpochWindow(timestampMs);
    const sig = this.generateSignature(epochWindow);
    const ts = new Date(timestampMs).toISOString();

    const payload: BoardingQrPayload = {
      type: 'BOARDING_QR',
      v: 1,
      bus_id: this.busId,
      trip_id: this.tripId,
      epoch: epochWindow,
      sig,
      ts,
    };

    const token = JSON.stringify(payload);

    const elapsedSeconds = Math.floor(timestampMs / 1000) % this.windowSeconds;
    const remainingSeconds = this.windowSeconds - elapsedSeconds;
    const progress = Number((remainingSeconds / this.windowSeconds).toFixed(4));

    return {
      token,
      payload,
      epochWindow,
      remainingSeconds,
      elapsedSeconds,
      progress,
      busId: this.busId,
      tripId: this.tripId,
    };
  }

  /**
   * Verifies an incoming QR payload or token string against allowed time drift (±windows).
   */
  static verifyQrToken(
    tokenOrPayload: string | BoardingQrPayload,
    secretKey: string,
    allowedDriftWindows: number = 1,
    nowMs: number = Date.now(),
    windowSeconds: number = 30,
  ): { valid: boolean; payload?: BoardingQrPayload; error?: string } {
    let payload: BoardingQrPayload;
    if (typeof tokenOrPayload === 'string') {
      try {
        payload = JSON.parse(tokenOrPayload) as BoardingQrPayload;
      } catch {
        return { valid: false, error: 'MALFORMED_JSON_TOKEN' };
      }
    } else {
      payload = tokenOrPayload;
    }

    if (payload.type !== 'BOARDING_QR' || payload.v !== 1) {
      return { valid: false, error: 'INVALID_QR_TYPE' };
    }

    const currentEpoch = Math.floor(nowMs / (windowSeconds * 1000));
    const minEpoch = currentEpoch - allowedDriftWindows;
    const maxEpoch = currentEpoch + allowedDriftWindows;

    if (payload.epoch < minEpoch || payload.epoch > maxEpoch) {
      return { valid: false, error: 'TOKEN_EXPIRED_WINDOW' };
    }

    const expectedMessage = `cb:qr:${payload.bus_id}:${payload.trip_id}:${payload.epoch}`;
    const expectedSig = crypto
      .createHmac('sha256', secretKey)
      .update(expectedMessage)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSig, 'hex');
    const actualBuf = Buffer.from(payload.sig, 'hex');

    if (
      expectedBuf.length !== actualBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, actualBuf)
    ) {
      return { valid: false, error: 'SIGNATURE_MISMATCH' };
    }

    return { valid: true, payload };
  }
}
