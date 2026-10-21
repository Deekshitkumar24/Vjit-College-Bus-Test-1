import { describe, it, expect } from 'vitest';
import {
  validateDeviceLinkCreation,
  resolveSampleBusAttribution,
  DeviceLink,
} from '../src/device-links.js';
import { DeviceRecord } from '../src/device-tokens.js';

describe('Device Links & Attribution Rule (P1-T2, Part 6.5 & 6.6)', () => {
  const activeDevice: DeviceRecord = {
    id: 'dev_100',
    device_id: 'HW_910',
    status: 'ACTIVE',
    token_hash: 'hash_test',
    key_version: 1,
  };

  it('validates successful device link creation when both device and bus are free', () => {
    const existingLinks: DeviceLink[] = [];
    const result = validateDeviceLinkCreation(activeDevice, 'bus_1', existingLinks);
    expect(result.valid).toBe(true);
  });

  it('rejects link creation if device is REVOKED or RETIRED', () => {
    const revokedDevice: DeviceRecord = { ...activeDevice, status: 'REVOKED' };
    const res = validateDeviceLinkCreation(revokedDevice, 'bus_1', []);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('DEVICE_INACTIVE');
  });

  it('rejects link creation if target bus already has another active tracker linked', () => {
    const existingLinks: DeviceLink[] = [
      {
        id: 'link_1',
        device_id: 'dev_other',
        bus_id: 'bus_1',
        linked_at: new Date('2026-10-01T08:00:00Z'),
        unlinked_at: null, // still active
      },
    ];

    const res = validateDeviceLinkCreation(activeDevice, 'bus_1', existingLinks);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('BUS_ALREADY_LINKED');
  });

  it('rejects link creation if device is already actively linked to another bus', () => {
    const existingLinks: DeviceLink[] = [
      {
        id: 'link_2',
        device_id: 'dev_100',
        bus_id: 'bus_other',
        linked_at: new Date('2026-10-01T08:00:00Z'),
        unlinked_at: null,
      },
    ];

    const res = validateDeviceLinkCreation(activeDevice, 'bus_1', existingLinks);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('DEVICE_ALREADY_LINKED');
  });

  it('enforces historical Attribution Rule: attributes sample to the bus linked at sample timestamp', () => {
    const linkHistory: DeviceLink[] = [
      // Bus A linked from 08:00 to 12:00
      {
        id: 'link_a',
        device_id: 'dev_100',
        bus_id: 'bus_A',
        linked_at: new Date('2026-10-21T08:00:00Z'),
        unlinked_at: new Date('2026-10-21T12:00:00Z'),
      },
      // Bus B linked from 13:00 onwards
      {
        id: 'link_b',
        device_id: 'dev_100',
        bus_id: 'bus_B',
        linked_at: new Date('2026-10-21T13:00:00Z'),
        unlinked_at: null,
      },
    ];

    // Sample recorded at 10:30 -> Bus A
    const sampleTime1 = new Date('2026-10-21T10:30:00Z');
    expect(resolveSampleBusAttribution(sampleTime1, linkHistory)).toBe('bus_A');

    // Sample recorded at 14:15 -> Bus B
    const sampleTime2 = new Date('2026-10-21T14:15:00Z');
    expect(resolveSampleBusAttribution(sampleTime2, linkHistory)).toBe('bus_B');

    // Sample recorded at 12:30 (during unlinked bench transit) -> null
    const sampleTime3 = new Date('2026-10-21T12:30:00Z');
    expect(resolveSampleBusAttribution(sampleTime3, linkHistory)).toBeNull();
  });
});
