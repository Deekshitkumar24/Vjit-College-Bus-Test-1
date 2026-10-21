import { describe, it, expect, beforeEach } from 'vitest';
import { HeartbeatService } from '../src/modules/heartbeat/heartbeat.service.js';
import { generateDeviceToken, hashDeviceToken, DeviceRecord, KeyRing } from '@collegebus/domain';
import { HeartbeatRequestDto, HardwareEventDto } from '@collegebus/contracts';

describe('Heartbeat & Event Pipelines (P1-T4, Stages H1-H8, E1-E6, C-05, C-08)', () => {
  let service: HeartbeatService;
  const secretKey = '0123456789abcdef0123456789abcdef';
  const keyring: KeyRing = { 1: secretKey };

  beforeEach(() => {
    service = new HeartbeatService();
  });

  describe('Heartbeat Pipeline (Stages H1-H8)', () => {
    it('authenticates PROVISIONED device, transitions to ACTIVE (C-01), computes ONLINE health state', async () => {
      const rawToken = generateDeviceToken();
      const tokenHash = hashDeviceToken(rawToken, secretKey);

      const device: DeviceRecord = {
        id: 'dev_h1',
        device_id: 'HW_801',
        status: 'PROVISIONED',
        token_hash: tokenHash,
        key_version: 1,
        first_used_at: null,
        vehicle_class: 'V12',
      };
      service.registerDevice(device);

      const now = new Date('2026-10-21T10:00:00Z');
      const dto: HeartbeatRequestDto = {
        schema_version: 1,
        device_id: 'HW_801',
        boot_id: 'boot_h01',
        fw_version: '1.0.0',
        sent_at: now.toISOString(),
        uptime_s: 3600,
        network_status: 'REGISTERED',
        sim_status: 'READY',
        signal_rssi_dbm: -68,
        vehicle_battery_mv: 12600,
        device_battery_mv: 3900,
        gps_status: 'FIX_VALID',
        buffer_bytes: 0,
        buffer_capacity_bytes: 65536,
        ignition: 'ON',
        temperature_c: 28.5,
      };

      const response = await service.processHeartbeat('HW_801', rawToken, dto, keyring, now);

      expect(response.schema_version).toBe(1);
      expect(response.pending_action).toBe('NONE');
      expect(response.config).toEqual({
        moving_interval_s: 10,
        stopped_interval_s: 30,
        parked_heartbeat_s: 600,
      });

      // Confirm device transitioned to ACTIVE
      expect(service.getDevice('HW_801')?.status).toBe('ACTIVE');
      expect(service.getDevice('HW_801')?.first_used_at).toBeDefined();

      // Confirm health record updated
      const health = service.getDeviceHealth('HW_801');
      expect(health).toBeDefined();
      expect(health?.state).toBe('ONLINE');
      expect(health?.signal_rssi_dbm).toBe(-68);
      expect(health?.gps_status).toBe('FIX_VALID');
    });

    it('creates maintenance ticket on low vehicle battery threshold crossing (Part B.3 D-02)', async () => {
      const rawToken = generateDeviceToken();
      const tokenHash = hashDeviceToken(rawToken, secretKey);

      const device: DeviceRecord = {
        id: 'dev_h2',
        device_id: 'HW_802',
        status: 'ACTIVE',
        token_hash: tokenHash,
        key_version: 1,
        first_used_at: new Date('2026-10-21T00:00:00Z'),
        vehicle_class: 'V12',
      };
      service.registerDevice(device);

      const now = new Date('2026-10-21T10:05:00Z');
      const dto: HeartbeatRequestDto = {
        schema_version: 1,
        device_id: 'HW_802',
        boot_id: 'boot_h02',
        fw_version: '1.0.0',
        sent_at: now.toISOString(),
        uptime_s: 7200,
        network_status: 'REGISTERED',
        sim_status: 'READY',
        signal_rssi_dbm: -75,
        vehicle_battery_mv: 11400, // < 11800 mV (V12 threshold)
        device_battery_mv: 3800,
        gps_status: 'FIX_VALID',
        buffer_bytes: 128,
        buffer_capacity_bytes: 65536,
        ignition: 'ON',
      };

      await service.processHeartbeat('HW_802', rawToken, dto, keyring, now);

      const tickets = service.getMaintenanceTickets();
      expect(tickets.some((t) => t.category === 'LOW_VEHICLE_BATTERY')).toBe(true);
    });

    it('returns FIRMWARE_UPDATE with presigned url, sha256, and signature per C-05/Part 20.6', async () => {
      const rawToken = generateDeviceToken();
      const tokenHash = hashDeviceToken(rawToken, secretKey);

      const device: DeviceRecord = {
        id: 'dev_h3',
        device_id: 'HW_803',
        status: 'ACTIVE',
        token_hash: tokenHash,
        key_version: 1,
        first_used_at: new Date('2026-10-21T00:00:00Z'),
        vehicle_class: 'V12',
      };
      service.registerDevice(device);

      service.setFirmwareTarget({
        version: '1.2.0',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        size_bytes: 524288,
        storage_key: 'firmware_v1.2.0.bin',
        signature: 'sig_rsa_valid_firmware_blob_signature',
      });

      const now = new Date('2026-10-21T10:10:00Z');
      const dto: HeartbeatRequestDto = {
        schema_version: 1,
        device_id: 'HW_803',
        boot_id: 'boot_h03',
        fw_version: '1.0.0', // older than target 1.2.0
        sent_at: now.toISOString(),
        uptime_s: 1800,
        network_status: 'REGISTERED',
        sim_status: 'READY',
        signal_rssi_dbm: -62,
        vehicle_battery_mv: 12800,
        device_battery_mv: 4000,
        gps_status: 'FIX_VALID',
        buffer_bytes: 0,
        buffer_capacity_bytes: 65536,
        ignition: 'ON',
      };

      const res = await service.processHeartbeat('HW_803', rawToken, dto, keyring, now);

      expect(res.pending_action).toBe('FIRMWARE_UPDATE');
      expect(res.firmware_target).toBe('1.2.0');
      expect(res.firmware_sha256).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
      expect(res.firmware_size_bytes).toBe(524288);
      expect(res.firmware_signature).toBe('sig_rsa_valid_firmware_blob_signature');
      expect(res.firmware_url).toContain('collegebus-firmware/firmware_v1.2.0.bin');
      expect(res.firmware_url).toContain('expires=');
    });
  });

  describe('Event Pipeline (Stages E1-E6)', () => {
    it('processes and deduplicates events, recording raw SOS and opening tickets for tamper and low battery', async () => {
      const rawToken = generateDeviceToken();
      const tokenHash = hashDeviceToken(rawToken, secretKey);

      const device: DeviceRecord = {
        id: 'dev_e1',
        device_id: 'HW_804',
        status: 'ACTIVE',
        token_hash: tokenHash,
        key_version: 1,
        first_used_at: new Date('2026-10-21T00:00:00Z'),
      };
      service.registerDevice(device);

      const now = new Date('2026-10-21T11:00:00Z');
      const events: HardwareEventDto[] = [
        {
          type: 'SOS',
          seq: 1,
          occurred_at: now.toISOString(),
          data: { triggered_at: now.toISOString() },
        },
        {
          type: 'TAMPER',
          seq: 2,
          occurred_at: now.toISOString(),
          data: {},
        },
        {
          type: 'UNRECOGNIZED_CUSTOM_EVENT',
          seq: 3,
          occurred_at: now.toISOString(),
          data: {},
        },
      ];

      const results = await service.processEvents(
        'HW_804',
        rawToken,
        'boot_e1',
        events,
        keyring,
        now,
      );

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ seq: 1, status: 'RECORDED', incident_id: null });
      expect(results[1]).toEqual({ seq: 2, status: 'PROCESSED', incident_id: null });
      expect(results[2]).toEqual({ seq: 3, status: 'IGNORED', incident_id: null }); // Part 5.5

      // Confirm tamper ticket created
      expect(service.getMaintenanceTickets().some((t) => t.category === 'TAMPER_ALERT')).toBe(true);

      // Resending identical event batch tests deduplication
      const duplicateResults = await service.processEvents(
        'HW_804',
        rawToken,
        'boot_e1',
        events,
        keyring,
        now,
      );
      expect(duplicateResults).toEqual(results);
    });

    it('pauses firmware rollout on FIRMWARE_FAILED event', async () => {
      const rawToken = generateDeviceToken();
      const tokenHash = hashDeviceToken(rawToken, secretKey);

      const device: DeviceRecord = {
        id: 'dev_e2',
        device_id: 'HW_805',
        status: 'ACTIVE',
        token_hash: tokenHash,
        key_version: 1,
        first_used_at: new Date('2026-10-21T00:00:00Z'),
      };
      service.registerDevice(device);

      service.setFirmwareTarget({
        version: '1.2.0',
        sha256: 'hash',
        size_bytes: 1000,
        storage_key: 'target.bin',
        signature: 'sig',
      });

      const now = new Date('2026-10-21T11:30:00Z');
      const failedEvent: HardwareEventDto[] = [
        {
          type: 'FIRMWARE_FAILED',
          seq: 10,
          occurred_at: now.toISOString(),
          data: { attempted_version: '1.2.0', reason: 'Flash write error' },
        },
      ];

      const res = await service.processEvents(
        'HW_805',
        rawToken,
        'boot_e2',
        failedEvent,
        keyring,
        now,
      );
      expect(res[0]?.status).toBe('PROCESSED');
      expect(service.isRolloutPausedForDevice('HW_805')).toBe(true);

      // Verify that subsequent heartbeat does not trigger FIRMWARE_UPDATE because rollout is paused for this device
      const hbDto: HeartbeatRequestDto = {
        schema_version: 1,
        device_id: 'HW_805',
        boot_id: 'boot_e2',
        fw_version: '1.0.0',
        sent_at: now.toISOString(),
        uptime_s: 120,
        network_status: 'REGISTERED',
        sim_status: 'READY',
        signal_rssi_dbm: -70,
        vehicle_battery_mv: 12500,
        device_battery_mv: 3900,
        gps_status: 'FIX_VALID',
        buffer_bytes: 0,
        buffer_capacity_bytes: 65536,
        ignition: 'ON',
      };
      const hbRes = await service.processHeartbeat('HW_805', rawToken, hbDto, keyring, now);
      expect(hbRes.pending_action).toBe('NONE');
    });
  });
});
