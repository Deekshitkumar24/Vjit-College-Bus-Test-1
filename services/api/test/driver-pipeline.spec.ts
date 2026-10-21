import { describe, it, expect, beforeEach } from 'vitest';
import { ShiftService } from '../src/modules/shift/shift.service.js';
import { DriverService } from '../src/modules/driver/driver.service.js';
import { DriverRosterEntry } from '@collegebus/domain';
import { DriverLocationsBatchDto, DriverStatusDto } from '@collegebus/contracts';

describe('Driver Phone Pipeline & Shift Claim (P1-T5, Part 5.3 & 6.7)', () => {
  let shiftService: ShiftService;
  let driverService: DriverService;
  const baseTime = new Date('2026-10-21T07:30:00Z');

  beforeEach(() => {
    shiftService = new ShiftService();
    driverService = new DriverService(shiftService);
  });

  describe('Shift Claim Issuance & Mutual Exclusion (Part 6.7)', () => {
    it('issues shift claim for rostered driver, enforces bus mutual exclusion and end-shift lifecycle', async () => {
      const roster: DriverRosterEntry = {
        id: 'roster_1',
        driver_id: 'drv_101',
        bus_id: 'bus_07',
        valid_from: new Date('2026-10-01T00:00:00Z'),
        valid_to: new Date('2026-11-01T00:00:00Z'),
      };
      shiftService.addRosterEntry(roster);

      // 1. Successfully start shift
      const claim = await shiftService.startShift(
        'drv_101',
        {
          bus_id: 'bus_07',
          route_id: 'route_12',
          trip_type: 'MORNING',
        },
        baseTime,
      );

      expect(claim.shift_id).toBeDefined();
      expect(claim.bus_id).toBe('bus_07');
      expect(claim.driver_id).toBe('drv_101');
      expect(claim.route_id).toBe('route_12');
      expect(claim.trip_id).toBeDefined();

      // 2. Reject second driver claiming the same bus while active
      const secondRoster: DriverRosterEntry = {
        id: 'roster_2',
        driver_id: 'drv_102',
        bus_id: 'bus_07',
        valid_from: new Date('2026-10-01T00:00:00Z'),
        valid_to: new Date('2026-11-01T00:00:00Z'),
      };
      shiftService.addRosterEntry(secondRoster);

      await expect(
        shiftService.startShift(
          'drv_102',
          {
            bus_id: 'bus_07',
            route_id: 'route_12',
            trip_type: 'MORNING',
          },
          baseTime,
        ),
      ).rejects.toThrow('Bus already has an ongoing active shift');

      // 3. Successfully end shift
      const endedShift = await shiftService.endShift(
        'drv_101',
        claim.shift_id,
        new Date(baseTime.getTime() + 3600 * 1000),
      );
      expect(endedShift.status).toBe('COMPLETED');
      expect(endedShift.ended_at).toBeDefined();

      // 4. After shift ends, another shift can now be claimed on the bus
      const newClaim = await shiftService.startShift(
        'drv_102',
        {
          bus_id: 'bus_07',
          route_id: 'route_12',
          trip_type: 'AFTERNOON',
        },
        new Date(baseTime.getTime() + 7200 * 1000),
      );
      expect(newClaim.shift_id).toBeDefined();
    });
  });

  describe('Driver Location Telemetry Ingestion (Part 5.3 & SW-MVP §11.7)', () => {
    let activeShiftId: string;

    beforeEach(async () => {
      shiftService.addRosterEntry({
        id: 'roster_3',
        driver_id: 'drv_201',
        bus_id: 'bus_09',
        valid_from: new Date('2026-10-01T00:00:00Z'),
        valid_to: null,
      });

      const claim = await shiftService.startShift(
        'drv_201',
        {
          bus_id: 'bus_09',
          route_id: 'route_33',
          trip_type: 'MORNING',
        },
        baseTime,
      );
      activeShiftId = claim.shift_id;
    });

    it('ingests valid phone locations, converts m/s to km/h, and returns adaptive standby cadence (30s)', async () => {
      const batch: DriverLocationsBatchDto = {
        shift_id: activeShiftId,
        app_version: '1.2.0',
        device_model: 'Pixel 8',
        samples: [
          {
            seq: 1,
            recorded_at: baseTime.toISOString(),
            lat: 12.9716,
            lng: 77.5946,
            accuracy_m: 14.2,
            speed_mps: 12.5, // 12.5 * 3.6 = 45.0 km/h
            heading_deg: 90,
            provider: 'GPS',
            is_mock: false,
          },
        ],
      };

      const res = await driverService.ingestLocations('drv_201', batch, baseTime);

      expect(res.ack_seq).toBe(1);
      expect(res.rejected).toHaveLength(0);
      expect(res.phone_interval_s).toBe(30); // Default Standby cadence
      expect(res.active_source).toBe('HW');

      const stored = driverService.getStoredSamples();
      expect(stored).toHaveLength(1);
      expect(stored[0]?.bus_id).toBe('bus_09');
      expect(stored[0]?.speed_kmh).toBe(45.0);
    });

    it('returns adaptive fallback cadence (10s) when active source is PHONE', async () => {
      driverService.setBusActiveSource('bus_09', 'PHONE');

      const batch: DriverLocationsBatchDto = {
        shift_id: activeShiftId,
        app_version: '1.2.0',
        device_model: 'Pixel 8',
        samples: [
          {
            seq: 2,
            recorded_at: baseTime.toISOString(),
            lat: 12.972,
            lng: 77.595,
            accuracy_m: 18.0,
            speed_mps: 8.0,
            heading_deg: 95,
            provider: 'FUSED',
            is_mock: false,
          },
        ],
      };

      const res = await driverService.ingestLocations('drv_201', batch, baseTime);
      expect(res.phone_interval_s).toBe(10); // Fallback cadence per Part 5.3
      expect(res.active_source).toBe('PHONE');
    });

    it('rejects mock locations from live state but stores them flagged (Part 5.3 & Conflict C-03/C-10)', async () => {
      const batch: DriverLocationsBatchDto = {
        shift_id: activeShiftId,
        app_version: '1.2.0',
        device_model: 'Pixel 8',
        samples: [
          {
            seq: 3,
            recorded_at: baseTime.toISOString(),
            lat: 12.972,
            lng: 77.595,
            accuracy_m: 10.0,
            speed_mps: 10.0,
            heading_deg: 0,
            provider: 'GPS',
            is_mock: true, // Mocked location
          },
        ],
      };

      const res = await driverService.ingestLocations('drv_201', batch, baseTime);
      expect(res.rejected).toHaveLength(1);
      expect(res.rejected[0]).toEqual({ seq: 3, reason: 'MOCK_LOCATION' });

      // Stored flagged per Part 5.3
      const stored = driverService.getStoredSamples();
      expect(stored.some((s) => s.seq === 3 && s.is_mock === true)).toBe(true);
    });

    it('rejects conflicting sample sequence with per-sample 200 CONFLICT (Conflict C-09 & OV-1)', async () => {
      const batch1: DriverLocationsBatchDto = {
        shift_id: activeShiftId,
        app_version: '1.2.0',
        device_model: 'Pixel 8',
        samples: [
          {
            seq: 5,
            recorded_at: baseTime.toISOString(),
            lat: 12.9716,
            lng: 77.5946,
            accuracy_m: 15,
            speed_mps: 10,
            heading_deg: 90,
            provider: 'GPS',
            is_mock: false,
          },
        ],
      };
      await driverService.ingestLocations('drv_201', batch1, baseTime);

      // Duplicate sample with different coordinates and same seq
      const batch2: DriverLocationsBatchDto = {
        shift_id: activeShiftId,
        app_version: '1.2.0',
        device_model: 'Pixel 8',
        samples: [
          {
            seq: 5,
            recorded_at: baseTime.toISOString(),
            lat: 13.0827, // Conflicting latitude
            lng: 80.2707,
            accuracy_m: 15,
            speed_mps: 10,
            heading_deg: 90,
            provider: 'GPS',
            is_mock: false,
          },
        ],
      };

      const res2 = await driverService.ingestLocations('drv_201', batch2, baseTime);
      expect(res2.rejected).toHaveLength(1);
      expect(res2.rejected[0]).toEqual({ seq: 5, reason: 'CONFLICT' });
    });

    it('rejects uploads once shift has been completed (Part 6.7 step 5)', async () => {
      await shiftService.endShift('drv_201', activeShiftId, new Date(baseTime.getTime() + 1000));

      const batch: DriverLocationsBatchDto = {
        shift_id: activeShiftId,
        app_version: '1.2.0',
        device_model: 'Pixel 8',
        samples: [
          {
            seq: 10,
            recorded_at: baseTime.toISOString(),
            lat: 12.9716,
            lng: 77.5946,
            accuracy_m: 10,
            speed_mps: 5,
            heading_deg: 0,
            provider: 'GPS',
            is_mock: false,
          },
        ],
      };

      await expect(driverService.ingestLocations('drv_201', batch, baseTime)).rejects.toThrow(
        'Shift is no longer active',
      );
    });

    it('records driver status diagnostics (SW-MVP section 11.7)', async () => {
      const statusDto: DriverStatusDto = {
        app_version: '1.2.0',
        os: 'ANDROID',
        os_version: '14.0',
        location_permission: 'ALWAYS',
        notifications_permission: 'GRANTED',
        battery_percent: 88,
        battery_optimisation_exempt: true,
        background_running: true,
        gps_enabled: true,
        network: 'CELLULAR',
      };

      const res = await driverService.recordDriverStatus(
        'drv_201',
        statusDto,
        activeShiftId,
        baseTime,
      );
      expect(res.status).toBe('RECORDED');

      const saved = driverService.getDriverStatus('drv_201');
      expect(saved).toBeDefined();
      expect(saved?.battery_percent).toBe(88);
      expect(saved?.location_permission).toBe('ALWAYS');
    });

    it('P3-T1 / AC-DRV-01: retrieves roster with only assigned buses, rejecting unrostered bus with 403', async () => {
      shiftService.addRosterEntry({
        id: 'roster_10',
        driver_id: 'drv_301',
        bus_id: 'bus_01',
        valid_from: new Date('2026-10-01T00:00:00Z'),
        valid_to: null,
      });
      shiftService.addRosterEntry({
        id: 'roster_11',
        driver_id: 'drv_301',
        bus_id: 'bus_03',
        valid_from: new Date('2026-10-01T00:00:00Z'),
        valid_to: null,
      });

      driverService.registerBusMetadata('bus_01', {
        bus_number: 'Bus 01',
        registration_number: 'KA-01-EA-1001',
        route_id: 'route_north',
        route_name: 'North Campus Express',
      });
      driverService.registerBusMetadata('bus_03', {
        bus_number: 'Bus 03',
        registration_number: 'KA-01-EA-1003',
        route_id: 'route_east',
        route_name: 'East Campus Shuttle',
      });

      // 1. Roster query returns only assigned buses
      const roster = driverService.getRoster('drv_301', baseTime);
      expect(roster.driver_id).toBe('drv_301');
      expect(roster.buses.length).toBe(2);
      expect(roster.buses.map((b) => b.bus_id)).toEqual(['bus_01', 'bus_03']);
      expect(roster.buses.some((b) => b.bus_id === 'bus_07')).toBe(false);

      // 2. Direct detail query on rostered bus succeeds
      const busDetail = driverService.getBusDetail('drv_301', 'bus_01', baseTime);
      expect(busDetail.bus_id).toBe('bus_01');
      expect(busDetail.bus_number).toBe('Bus 01');

      // 3. Direct query on unrostered Bus 07 throws 403 Forbidden (AC-DRV-01)
      expect(() => driverService.getBusDetail('drv_301', 'bus_07', baseTime)).toThrowError(
        'Driver is not rostered on bus bus_07',
      );
    });

    it('P3-T1: registers driver phone device label and metadata', async () => {
      const reg = driverService.registerDevice(
        'drv_301',
        {
          device_label: 'Pixel 8 - Ramesh Driver Phone',
          device_model: 'Google Pixel 8',
          os: 'ANDROID',
          os_version: '14.0',
          app_version: '1.0.0',
        },
        baseTime,
      );

      expect(reg.registered).toBe(true);
      expect(reg.device_label).toBe('Pixel 8 - Ramesh Driver Phone');

      const saved = driverService.getDeviceRegistration('drv_301');
      expect(saved).toBeDefined();
      expect(saved?.device_label).toBe('Pixel 8 - Ramesh Driver Phone');
      expect(saved?.device_model).toBe('Google Pixel 8');
    });

    it('P3-T5: switches tracking mode with optional note (§16.3 #6 & D-13)', async () => {
      shiftService.addRosterEntry({
        id: 'roster_mode',
        driver_id: 'drv_mode',
        bus_id: 'bus_mode',
        valid_from: new Date('2026-10-01T00:00:00Z'),
        valid_to: new Date('2026-11-01T00:00:00Z'),
      });

      const claim = await shiftService.startShift(
        'drv_mode',
        { bus_id: 'bus_mode', route_id: 'route_1', trip_type: 'MORNING' },
        baseTime,
      );

      // Default mode before switch
      expect(driverService.getTrackingMode('bus_mode')).toBe('AUTO');

      // Switch to PHONE mode
      const result = driverService.switchMode(
        'drv_mode',
        {
          mode: 'PHONE',
          shift_id: claim.shift_id,
          note: 'Hardware GPS antenna fault observed',
        },
        baseTime,
      );

      expect(result.mode).toBe('PHONE');
      expect(result.note).toBe('Hardware GPS antenna fault observed');
      expect(driverService.getTrackingMode('bus_mode')).toBe('PHONE');
    });

    it('P3-T5: triggers driver SOS emergency, blocks shift end, and tracks progression', async () => {
      shiftService.addRosterEntry({
        id: 'roster_sos',
        driver_id: 'drv_sos',
        bus_id: 'bus_sos',
        valid_from: new Date('2026-10-01T00:00:00Z'),
        valid_to: new Date('2026-11-01T00:00:00Z'),
      });

      const claim = await shiftService.startShift(
        'drv_sos',
        { bus_id: 'bus_sos', route_id: 'route_1', trip_type: 'MORNING' },
        baseTime,
      );

      // 1. Trigger SOS
      const triggerRes = driverService.triggerSos(
        'drv_sos',
        claim.shift_id,
        {
          category: 'MEDICAL',
          lat: 12.9716,
          lng: 77.5946,
          accuracy_m: 10,
          note: 'Driver medical assistance needed',
        },
        baseTime,
      );

      expect(triggerRes.incident_id).toBeDefined();
      expect(triggerRes.status).toBe('OPEN');
      expect(triggerRes.category).toBe('MEDICAL');

      // 2. SW-MVP-1.0 §15.4: Driver cannot end shift while SOS incident is OPEN
      await expect(shiftService.endShift('drv_sos', claim.shift_id, 'MANUAL')).rejects.toThrowError(
        'Driver cannot end shift while an SOS incident is open',
      );

      // 3. Status progression
      const incident = driverService.getSosIncident(triggerRes.incident_id);
      expect(incident.step).toBe('RECEIVED');

      // Acknowledgment
      const acknowledged = driverService.acknowledgeSos(
        triggerRes.incident_id,
        'Coordinator Sharma',
        new Date(baseTime.getTime() + 15000),
      );
      expect(acknowledged.step).toBe('ACKNOWLEDGED');
      expect(acknowledged.acknowledged_by).toBe('Coordinator Sharma');
      expect(acknowledged.status).toBe('RESPONDING');
    });
  });
});
