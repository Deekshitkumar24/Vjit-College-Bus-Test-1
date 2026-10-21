import { describe, it, expect, beforeEach } from 'vitest';
import { TelemetryService } from '../src/modules/telemetry/telemetry.service.js';
import {
  generateDeviceToken,
  hashDeviceToken,
  DeviceRecord,
  DeviceLink,
  KeyRing,
} from '@collegebus/domain';
import { TelemetryBatchDto } from '@collegebus/contracts';

describe('Telemetry Ingestion Pipeline (P1-T3, Stages S1-S13, C-01, C-09)', () => {
  let service: TelemetryService;
  const secretKey = '0123456789abcdef0123456789abcdef';
  const keyring: KeyRing = { 1: secretKey };

  beforeEach(() => {
    service = new TelemetryService();
  });

  it('authenticates PROVISIONED device on first use, sets ACTIVE and first_used_at, and ingests batch', async () => {
    const rawToken = generateDeviceToken();
    const tokenHash = hashDeviceToken(rawToken, secretKey);

    const device: DeviceRecord = {
      id: 'dev_101',
      device_id: 'HW_901',
      status: 'PROVISIONED',
      token_hash: tokenHash,
      key_version: 1,
      first_used_at: null,
    };
    service.registerDevice(device);

    const batch: TelemetryBatchDto = {
      boot_id: 'boot_001',
      samples: [
        {
          seq: 1,
          recorded_at: new Date().toISOString(),
          gps_valid: true,
          lat: 12.9716,
          lng: 77.5946,
          speed_kmh: 25.5,
          heading_deg: 90,
          satellites: 8,
          hdop: 1.1,
          ignition: 'ON',
        },
      ],
    };

    const res = await service.ingestBatch('HW_901', rawToken, batch, keyring);

    expect(res.accepted_count).toBe(1);
    expect(res.rejected_count).toBe(0);
    expect(res.rejections).toHaveLength(0);

    // Verify device transitioned to ACTIVE per Conflict C-01
    const updatedDevice = service.getDevice('HW_901');
    expect(updatedDevice?.status).toBe('ACTIVE');
    expect(updatedDevice?.first_used_at).toBeDefined();
  });

  it('attributes samples to historical linked bus', async () => {
    const rawToken = generateDeviceToken();
    const tokenHash = hashDeviceToken(rawToken, secretKey);

    const device: DeviceRecord = {
      id: 'dev_102',
      device_id: 'HW_902',
      status: 'ACTIVE',
      token_hash: tokenHash,
      key_version: 1,
      first_used_at: new Date('2026-10-21T00:00:00Z'),
    };
    service.registerDevice(device);

    const links: DeviceLink[] = [
      {
        id: 'link_1',
        device_id: 'dev_102',
        bus_id: 'bus_KA01AB1234',
        linked_at: new Date('2026-10-21T06:00:00Z'),
        unlinked_at: null,
      },
    ];
    service.setDeviceLinks('dev_102', links);

    const now = new Date('2026-10-21T08:00:00Z');
    const batch: TelemetryBatchDto = {
      boot_id: 'boot_002',
      samples: [
        {
          seq: 10,
          recorded_at: now.toISOString(),
          gps_valid: true,
          lat: 13.0827,
          lng: 80.2707,
          speed_kmh: 30,
          heading_deg: 180,
          satellites: 10,
          hdop: 0.9,
          ignition: 'ON',
        },
      ],
    };

    const res = await service.ingestBatch('HW_902', rawToken, batch, keyring, now);
    expect(res.accepted_count).toBe(1);

    const stored = service.getStoredSamples();
    expect(stored[0]?.bus_id).toBe('bus_KA01AB1234');
  });

  it('handles idempotent re-submissions and enforces Conflict C-09 (200 with per-sample CONFLICT)', async () => {
    const rawToken = generateDeviceToken();
    const tokenHash = hashDeviceToken(rawToken, secretKey);

    const device: DeviceRecord = {
      id: 'dev_103',
      device_id: 'HW_903',
      status: 'ACTIVE',
      token_hash: tokenHash,
      key_version: 1,
    };
    service.registerDevice(device);

    const now = new Date();
    const sampleTime = now.toISOString();

    const initialBatch: TelemetryBatchDto = {
      boot_id: 'boot_003',
      samples: [
        {
          seq: 5,
          recorded_at: sampleTime,
          gps_valid: true,
          lat: 12.9716,
          lng: 77.5946,
          speed_kmh: 40,
          heading_deg: 45,
          satellites: 9,
          hdop: 1.0,
          ignition: 'ON',
        },
      ],
    };

    // First ingestion: accepted
    const firstRes = await service.ingestBatch('HW_903', rawToken, initialBatch, keyring, now);
    expect(firstRes.accepted_count).toBe(1);

    // Exact identical retry: accepted as idempotent duplicate (accepted_count = 1, rejections = 0)
    const retryRes = await service.ingestBatch('HW_903', rawToken, initialBatch, keyring, now);
    expect(retryRes.accepted_count).toBe(1);
    expect(retryRes.rejected_count).toBe(0);

    // Divergent sample with SAME seq (5) but DIFFERENT coordinates -> must be rejected with CONFLICT inside 200 response (C-09 / OV-1)
    const divergentBatch: TelemetryBatchDto = {
      boot_id: 'boot_003',
      samples: [
        {
          seq: 5,
          recorded_at: sampleTime,
          gps_valid: true,
          lat: 13.0001, // Different coordinate!
          lng: 77.6001,
          speed_kmh: 40,
          heading_deg: 45,
          satellites: 9,
          hdop: 1.0,
          ignition: 'ON',
        },
      ],
    };

    const conflictRes = await service.ingestBatch('HW_903', rawToken, divergentBatch, keyring, now);
    expect(conflictRes.accepted_count).toBe(0);
    expect(conflictRes.rejected_count).toBe(1);
    expect(conflictRes.rejections[0]).toEqual({
      seq: 5,
      reason: 'CONFLICT',
    });
  });

  it('rejects samples failing domain validity rules (future timestamp, zero coordinates, excessive speed)', async () => {
    const rawToken = generateDeviceToken();
    const tokenHash = hashDeviceToken(rawToken, secretKey);

    const device: DeviceRecord = {
      id: 'dev_104',
      device_id: 'HW_904',
      status: 'ACTIVE',
      token_hash: tokenHash,
      key_version: 1,
    };
    service.registerDevice(device);

    const now = new Date('2026-10-21T12:00:00Z');

    const invalidBatch: TelemetryBatchDto = {
      boot_id: 'boot_004',
      samples: [
        // 1. Future timestamp > 30s
        {
          seq: 1,
          recorded_at: new Date(now.getTime() + 60000).toISOString(),
          gps_valid: true,
          lat: 12.9716,
          lng: 77.5946,
          speed_kmh: 30,
          heading_deg: 0,
          satellites: 7,
          hdop: 1.2,
          ignition: 'ON',
        },
        // 2. Zero coordinates
        {
          seq: 2,
          recorded_at: now.toISOString(),
          gps_valid: false,
          lat: 0,
          lng: 0,
          speed_kmh: 0,
          heading_deg: 0,
          satellites: 0,
          hdop: 99,
          ignition: 'OFF',
        },
        // 3. Excessive speed > 150 km/h
        {
          seq: 3,
          recorded_at: now.toISOString(),
          gps_valid: true,
          lat: 12.9716,
          lng: 77.5946,
          speed_kmh: 185.0, // Bus going 185 km/h is implausible
          heading_deg: 180,
          satellites: 8,
          hdop: 1.0,
          ignition: 'ON',
        },
      ],
    };

    const res = await service.ingestBatch('HW_904', rawToken, invalidBatch, keyring, now);

    expect(res.accepted_count).toBe(0);
    expect(res.rejected_count).toBe(3);
    expect(res.rejections).toEqual([
      { seq: 1, reason: 'FUTURE_TIMESTAMP' },
      { seq: 2, reason: 'INVALID_COORDINATES' },
      { seq: 3, reason: 'EXCESSIVE_SPEED' },
    ]);
  });
});
