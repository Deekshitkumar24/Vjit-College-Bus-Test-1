import { describe, it, expect } from 'vitest';
import {
  generateDeviceToken,
  hashDeviceToken,
  verifyDeviceToken,
  authenticateDevice,
  DeviceRecord,
  KeyRing,
  parseKeyRing,
} from '../src/device-tokens.js';

describe('Device Token Lifecycle & Authentication (P1-T1, C-01, Part 6.2-6.4)', () => {
  const secretKey = '0123456789abcdef0123456789abcdef';
  const keyring: KeyRing = { 1: secretKey };

  it('generates a 256-bit cryptographically secure token with dvt_ prefix', () => {
    const token = generateDeviceToken();
    expect(token).toMatch(/^dvt_[a-f0-9]{64}$/);
  });

  it('computes HMAC-SHA256 and securely verifies matching token in constant time', () => {
    const token = generateDeviceToken();
    const hash = hashDeviceToken(token, secretKey);

    expect(verifyDeviceToken(token, hash, secretKey)).toBe(true);
    expect(verifyDeviceToken('dvt_invalid', hash, secretKey)).toBe(false);
  });

  it('parses versioned keyrings correctly (Part 3.3 DEVICE_TOKEN_HMAC_KEYS)', () => {
    const parsed = parseKeyRing('1:key_one,2:key_two');
    expect(parsed[1]).toBe('key_one');
    expect(parsed[2]).toBe('key_two');
  });

  it('enforces Conflict C-01: PROVISIONED device is accepted on first use and flags activation', () => {
    const token = generateDeviceToken();
    const hash = hashDeviceToken(token, secretKey);

    const device: DeviceRecord = {
      id: 'dev_1',
      device_id: 'HW_901',
      status: 'PROVISIONED',
      token_hash: hash,
      key_version: 1,
      first_used_at: null,
    };

    // First request when first_used_at is null: allowed and shouldActivate is true
    const result = authenticateDevice(device, token, keyring);
    expect(result.allowed).toBe(true);
    expect(result.shouldActivate).toBe(true);

    // If first_used_at is already set but status is still PROVISIONED: rejected!
    const usedProvisioned: DeviceRecord = {
      ...device,
      first_used_at: new Date(),
    };
    const rejected = authenticateDevice(usedProvisioned, token, keyring);
    expect(rejected.allowed).toBe(false);
    expect(rejected.code).toBe('DEVICE_NOT_ACTIVE');
  });

  it('allows ACTIVE and BENCH devices', () => {
    const token = generateDeviceToken();
    const hash = hashDeviceToken(token, secretKey);

    const activeDevice: DeviceRecord = {
      id: 'dev_2',
      device_id: 'HW_902',
      status: 'ACTIVE',
      token_hash: hash,
      key_version: 1,
      first_used_at: new Date(),
    };

    const res = authenticateDevice(activeDevice, token, keyring);
    expect(res.allowed).toBe(true);
    expect(res.shouldActivate).toBe(false);

    const benchDevice: DeviceRecord = {
      ...activeDevice,
      status: 'BENCH',
    };
    expect(authenticateDevice(benchDevice, token, keyring).allowed).toBe(true);
  });

  it('rejects REVOKED and RETIRED devices immediately', () => {
    const token = generateDeviceToken();
    const hash = hashDeviceToken(token, secretKey);

    const revokedDevice: DeviceRecord = {
      id: 'dev_3',
      device_id: 'HW_903',
      status: 'REVOKED',
      token_hash: hash,
      key_version: 1,
      revoked_at: new Date(),
    };

    const resRevoked = authenticateDevice(revokedDevice, token, keyring);
    expect(resRevoked.allowed).toBe(false);
    expect(resRevoked.code).toBe('DEVICE_REVOKED');

    const retiredDevice: DeviceRecord = {
      ...revokedDevice,
      status: 'RETIRED',
    };
    const resRetired = authenticateDevice(retiredDevice, token, keyring);
    expect(resRetired.allowed).toBe(false);
    expect(resRetired.code).toBe('DEVICE_RETIRED');
  });

  it('supports token rotation with overlap grace period', () => {
    const oldToken = generateDeviceToken();
    const oldHash = hashDeviceToken(oldToken, secretKey);

    const newToken = generateDeviceToken();
    const newHash = hashDeviceToken(newToken, secretKey);

    const device: DeviceRecord = {
      id: 'dev_4',
      device_id: 'HW_904',
      status: 'ACTIVE',
      token_hash: newHash,
      key_version: 1,
      previous_token_hash: oldHash,
      previous_token_expires_at: new Date(Date.now() + 60000), // 1 min in future
    };

    // Both new and old tokens are valid during overlap
    expect(authenticateDevice(device, newToken, keyring).allowed).toBe(true);
    expect(authenticateDevice(device, oldToken, keyring).allowed).toBe(true);

    // After expiration of overlap period, old token fails
    const expiredNow = new Date(Date.now() + 120000);
    expect(authenticateDevice(device, oldToken, keyring, expiredNow).allowed).toBe(false);
  });
});
