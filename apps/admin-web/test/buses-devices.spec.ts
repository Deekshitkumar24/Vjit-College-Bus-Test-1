import { describe, it, expect } from 'vitest';
import { BusManager } from '../src/buses/bus-manager.js';
import { DeviceLifecycleManager } from '../src/devices/device-lifecycle.js';

describe('Buses & Devices Management (P4-T2)', () => {
  describe('Bus Operations & Uniqueness Enforcement', () => {
    it('creates and updates buses with unique bus numbers and license plates', () => {
      const manager = new BusManager();

      const bus1 = manager.createBus({
        bus_number: 'BUS-101',
        license_plate: 'KA-01-AB-1234',
        capacity: 45,
        model: 'Tata Marcopolo',
        status: 'ACTIVE',
      });

      expect(bus1.bus_number).toBe('BUS-101');
      expect(bus1.status).toBe('ACTIVE');

      // Duplicate bus number rejected
      expect(() =>
        manager.createBus({
          bus_number: 'bus-101', // case-insensitive check
          license_plate: 'KA-01-CD-5678',
          capacity: 50,
        }),
      ).toThrowError(/already exists/);

      // Duplicate license plate rejected
      expect(() =>
        manager.createBus({
          bus_number: 'BUS-102',
          license_plate: 'ka-01-ab-1234',
          capacity: 50,
        }),
      ).toThrowError(/already exists/);

      // Search & filter
      manager.createBus({
        bus_number: 'BUS-102',
        license_plate: 'KA-01-EF-9999',
        capacity: 30,
        status: 'MAINTENANCE',
      });

      const activeBuses = manager.listBuses({ status: 'ACTIVE' });
      expect(activeBuses).toHaveLength(1);
      const firstActive = activeBuses[0];
      expect(firstActive?.bus_number).toBe('BUS-101');

      const searchResults = manager.listBuses({ search: '9999' });
      expect(searchResults).toHaveLength(1);
      const firstSearch = searchResults[0];
      expect(firstSearch?.bus_number).toBe('BUS-102');
    });
  });

  describe('Device Provisioning & Acceptance Criterion AC-TEC-01', () => {
    it('provisions a batch of devices, generates one-time token display, and handles bench mode (L-1)', () => {
      const manager = new DeviceLifecycleManager();

      const batch = manager.provisionBatch([
        {
          device_id: 'TRK-001',
          serial_number: 'SN-001-A',
          imei: '860123456789012',
          iccid: '89911234567890123456',
          vehicle_class: 'V12',
          is_bench: false,
        },
        {
          device_id: 'TRK-BENCH-99',
          serial_number: 'SN-BENCH-99',
          imei: '860987654321098',
          iccid: '89919876543210987654',
          vehicle_class: 'V12',
          is_bench: true, // Locked Decision L-1
        },
      ]);

      expect(batch).toHaveLength(2);

      // Device 1: PROVISIONED with one-time token plaintext and QR code
      const dev1 = batch[0];
      expect(dev1).toBeDefined();
      expect(dev1?.device_id).toBe('TRK-001');
      expect(dev1?.status).toBe('PROVISIONED');
      expect(dev1?.token_plaintext).toMatch(/^dvt_/);
      expect(dev1?.token_qr_uri).toContain(dev1?.token_plaintext);
      expect(dev1?.label_payload.imei).toBe('860123456789012');

      // Device 2: BENCH status
      const dev2 = batch[1];
      expect(dev2).toBeDefined();
      expect(dev2?.device_id).toBe('TRK-BENCH-99');
      expect(dev2?.status).toBe('BENCH');

      // Verify stored records
      const record1 = manager.getDevice('TRK-001');
      expect(record1?.status).toBe('PROVISIONED');
      expect(record1?.is_bench).toBe(false);

      const record2 = manager.getDevice('TRK-BENCH-99');
      expect(record2?.status).toBe('BENCH');
      expect(record2?.is_bench).toBe(true);

      // Filter excludes bench devices when requested
      const operationalDevices = manager.listDevices({ is_bench: false });
      expect(operationalDevices.map((d) => d.device_id)).toEqual(['TRK-001']);
    });
  });

  describe('Device Link Permissions & Authority Isolation', () => {
    it('permits Coordinator to link devices to buses and strictly blocks Technicians (SW-MVP §16.5)', () => {
      const manager = new DeviceLifecycleManager();
      manager.provisionBatch([
        {
          device_id: 'TRK-002',
          serial_number: 'SN-002',
          imei: '860222222222222',
          iccid: '89912222222222222222',
          vehicle_class: 'V12',
          is_bench: false,
        },
      ]);

      // Technician attempt to link is REJECTED
      expect(() =>
        manager.linkDeviceToBus(
          { bus_id: 'bus-uuid-1', device_id: 'TRK-002' },
          'BUS-101',
          'TEC',
        ),
      ).toThrowError(/Technicians cannot link a device to a bus/);

      // Coordinator link SUCCEEDS
      manager.linkDeviceToBus(
        { bus_id: 'bus-uuid-1', device_id: 'TRK-002' },
        'BUS-101',
        'COR',
      );

      const linked = manager.getDevice('TRK-002');
      expect(linked?.linked_bus_id).toBe('bus-uuid-1');
      expect(linked?.linked_bus_number).toBe('BUS-101');
    });
  });

  describe('Device Replacement Wizard & Acceptance Criterion AC-TEC-02', () => {
    it('retires old device, links new device, and preserves historical sample attribution', () => {
      const manager = new DeviceLifecycleManager();
      manager.provisionBatch([
        {
          device_id: 'TRK-OLD',
          serial_number: 'SN-OLD',
          imei: '860111111111111',
          iccid: '89911111111111111111',
          vehicle_class: 'V12',
          is_bench: false,
        },
        {
          device_id: 'TRK-NEW',
          serial_number: 'SN-NEW',
          imei: '860222222222222',
          iccid: '89912222222222222222',
          vehicle_class: 'V12',
          is_bench: false,
        },
      ]);

      // Initially link old device
      manager.linkDeviceToBus(
        { bus_id: 'bus-uuid-10', device_id: 'TRK-OLD' },
        'BUS-10',
        'COR',
      );

      // Execute replacement wizard
      manager.replaceDevice(
        {
          bus_id: 'bus-uuid-10',
          old_device_id: 'TRK-OLD',
          new_device_id: 'TRK-NEW',
          reason: 'UPGRADED',
          notes: 'Upgraded to LTE Cat-1 tracker',
        },
        'BUS-10',
        'COR',
      );

      const oldDev = manager.getDevice('TRK-OLD');
      const newDev = manager.getDevice('TRK-NEW');

      expect(oldDev?.status).toBe('RETIRED');
      expect(oldDev?.linked_bus_id).toBeNull();

      expect(newDev?.linked_bus_id).toBe('bus-uuid-10');
      expect(newDev?.linked_bus_number).toBe('BUS-10');

      // Verify link history preserves both periods (AC-TEC-02)
      const history = manager.getLinkHistory();
      expect(history).toHaveLength(2);
      const link0 = history[0];
      const link1 = history[1];
      expect(link0?.device_id).toBe('TRK-OLD');
      expect(link0?.unlinked_at).not.toBeNull(); // Closed historical window
      expect(link1?.device_id).toBe('TRK-NEW');
      expect(link1?.unlinked_at).toBeNull(); // Active window
    });
  });

  describe('Typed Revocation & Acceptance Criterion AC-COR-01', () => {
    it('revokes device upon typed confirmation, rejects next request within 5s, and opens technician ticket', () => {
      const manager = new DeviceLifecycleManager();
      manager.provisionBatch([
        {
          device_id: 'TRK-FAULTY',
          serial_number: 'SN-FAULTY',
          imei: '860333333333333',
          iccid: '89913333333333333333',
          vehicle_class: 'V12',
          is_bench: false,
        },
      ]);

      manager.linkDeviceToBus(
        { bus_id: 'bus-uuid-42', device_id: 'TRK-FAULTY' },
        'BUS-42',
        'COR',
      );

      // Mismatched typed confirmation is REJECTED
      expect(() =>
        manager.revokeDevice({
          device_id: 'TRK-FAULTY',
          confirm_bus_number: 'BUS-99', // wrong bus number
          reason: 'Tampered tracker casing',
        }),
      ).toThrowError(/Confirmation mismatch/);

      // Exact typed confirmation SUCCEEDS
      const revokeResult = manager.revokeDevice({
        device_id: 'TRK-FAULTY',
        confirm_bus_number: 'BUS-42',
        reason: 'Physical enclosure tampered with',
      });

      expect(revokeResult.success).toBe(true);

      const device = manager.getDevice('TRK-FAULTY');
      expect(device?.status).toBe('REVOKED');
      expect(device?.linked_bus_id).toBeNull();

      // AC-COR-01 Check 1: Subsequent device request is immediately rejected
      const auth = manager.authenticateDeviceRequest('TRK-FAULTY');
      expect(auth.allowed).toBe(false);
      expect(auth.code).toBe('DEVICE_REVOKED');

      // AC-COR-01 Check 2: High priority maintenance ticket appears on technician list
      const tickets = manager.listTickets();
      expect(tickets).toHaveLength(1);
      const ticket = tickets[0];
      expect(ticket?.id).toBe(revokeResult.ticketId);
      expect(ticket?.device_id).toBe('TRK-FAULTY');
      expect(ticket?.bus_number).toBe('BUS-42');
      expect(ticket?.category).toBe('DEVICE_REVOKED');
      expect(ticket?.priority).toBe('HIGH');
      expect(ticket?.status).toBe('OPEN');
    });

    it('rotates device token and increments key version', () => {
      const manager = new DeviceLifecycleManager();
      manager.provisionBatch([
        {
          device_id: 'TRK-ROTATE',
          serial_number: 'SN-ROT',
          imei: '860444444444444',
          iccid: '89914444444444444444',
          vehicle_class: 'V12',
          is_bench: false,
        },
      ]);

      const rotation = manager.rotateToken({
        device_id: 'TRK-ROTATE',
        reason: 'Routine annual rotation',
      });

      expect(rotation.key_version).toBe(2);
      const updated = manager.getDevice('TRK-ROTATE');
      expect(updated?.key_version).toBe(2);
      expect(updated?.token_hash).toContain('hmac_rotated_v2');
    });
  });
});
