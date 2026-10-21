import crypto from 'node:crypto';

export type DeviceStatus = 'PROVISIONED' | 'ACTIVE' | 'BENCH' | 'REVOKED' | 'RETIRED';

export interface DeviceRecord {
  id: string;
  device_id: string;
  status: DeviceStatus;
  token_hash: string;
  key_version: number;
  previous_token_hash?: string | null;
  previous_token_expires_at?: Date | null;
  first_used_at?: Date | null;
  revoked_at?: Date | null;
  vehicle_class?: 'V12' | 'V24';
}

export interface KeyRing {
  [version: number]: string;
}

export function parseKeyRing(envString: string): KeyRing {
  const keyring: KeyRing = {};
  const pairs = envString.split(',');
  for (const pair of pairs) {
    const [verStr, key] = pair.split(':');
    if (verStr && key) {
      keyring[parseInt(verStr, 10)] = key;
    }
  }
  return keyring;
}

export function generateDeviceToken(): string {
  // 32 cryptographically secure bytes -> 64 char hex string (256-bit)
  return 'dvt_' + crypto.randomBytes(32).toString('hex');
}

export function hashDeviceToken(token: string, secretKey: string): string {
  return crypto.createHmac('sha256', secretKey).update(token).digest('hex');
}

export function verifyDeviceToken(
  rawToken: string,
  storedHash: string,
  secretKey: string,
): boolean {
  const computed = hashDeviceToken(rawToken, secretKey);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export interface DeviceAuthResult {
  allowed: boolean;
  shouldActivate: boolean;
  reason?: string;
  code?: string;
}

export function authenticateDevice(
  device: DeviceRecord,
  rawToken: string,
  keyring: KeyRing,
  now: Date = new Date(),
): DeviceAuthResult {
  // 1. Check revocation / retirement
  if (device.status === 'REVOKED') {
    return {
      allowed: false,
      shouldActivate: false,
      code: 'DEVICE_REVOKED',
      reason: 'Device token is revoked',
    };
  }
  if (device.status === 'RETIRED') {
    return {
      allowed: false,
      shouldActivate: false,
      code: 'DEVICE_RETIRED',
      reason: 'Device is retired',
    };
  }

  // 2. Validate token hash against current key version
  const currentKey = keyring[device.key_version];
  if (!currentKey) {
    return {
      allowed: false,
      shouldActivate: false,
      code: 'KEY_VERSION_UNKNOWN',
      reason: 'Unknown key version',
    };
  }

  let tokenValid = verifyDeviceToken(rawToken, device.token_hash, currentKey);

  // 3. Check previous token if within overlap grace period
  if (!tokenValid && device.previous_token_hash && device.previous_token_expires_at) {
    if (now <= device.previous_token_expires_at) {
      tokenValid = verifyDeviceToken(rawToken, device.previous_token_hash, currentKey);
    }
  }

  if (!tokenValid) {
    return {
      allowed: false,
      shouldActivate: false,
      code: 'INVALID_TOKEN',
      reason: 'Invalid bearer token',
    };
  }

  // 4. Status Transition Check (Conflict C-01)
  if (device.status === 'PROVISIONED') {
    if (!device.first_used_at) {
      // First authenticated request: sets status ACTIVE and first_used_at in one transaction
      return { allowed: true, shouldActivate: true };
    } else {
      return {
        allowed: false,
        shouldActivate: false,
        code: 'DEVICE_NOT_ACTIVE',
        reason: 'Provisioned device has already been used and must be ACTIVE',
      };
    }
  }

  if (device.status === 'ACTIVE' || device.status === 'BENCH') {
    return { allowed: true, shouldActivate: false };
  }

  return {
    allowed: false,
    shouldActivate: false,
    code: 'DEVICE_NOT_ACTIVE',
    reason: 'Device is not active',
  };
}
