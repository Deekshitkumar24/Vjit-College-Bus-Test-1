import { describe, it, expect, beforeEach } from 'vitest';
import { ShiftService } from '../src/modules/shift/shift.service.js';
import { DriverService } from '../src/modules/driver/driver.service.js';
import { SelectorService } from '../src/modules/selector/selector.service.js';
import { DriverRosterEntry } from '@collegebus/domain';

describe('Source Selector Pipeline (P1-T7, Part 9.3 to 9.7)', () => {
  let shiftService: ShiftService;
  let driverService: DriverService;
  let selectorService: SelectorService;
  const baseTime = new Date('2026-10-21T08:00:00Z');

  beforeEach(() => {
    shiftService = new ShiftService();
    driverService = new DriverService(shiftService);
    selectorService = new SelectorService(shiftService, driverService);
  });

  const setupActiveShift = async (busId = 'bus_01', driverId = 'drv_01') => {
    const roster: DriverRosterEntry = {
      id: `roster_${driverId}`,
      driver_id: driverId,
      bus_id: busId,
      valid_from: new Date('2026-10-01T00:00:00Z'),
      valid_to: new Date('2026-11-01T00:00:00Z'),
    };
    shiftService.addRosterEntry(roster);
    return shiftService.startShift(
      driverId,
      {
        bus_id: busId,
        route_id: 'route_01',
        trip_type: 'MORNING',
      },
      baseTime,
    );
  };

  describe('Initial State & Hardware Precedence', () => {
    it('initializes in NOT_RUNNING with NONE source before shift begins', () => {
      const state = selectorService.evaluateBus('bus_01', baseTime);
      expect(state.state).toBe('NOT_RUNNING');
      expect(state.active_source).toBe('NONE');
    });

    it('selects HW as active source when hardware sends valid fix during active shift', async () => {
      await setupActiveShift('bus_01');

      // Valid HW fix at t = 0
      selectorService.updateHardwareLocation('bus_01', 13.0827, 80.2707, 42.5, 180, baseTime, true);

      const state = selectorService.getBusState('bus_01');
      expect(state).toBeDefined();
      expect(state?.active_source).toBe('HW');
      expect(state?.state).toBe('LIVE');
      expect(state?.lat).toBe(13.0827);
      expect(state?.lng).toBe(80.2707);
      expect(state?.speed_kmh).toBe(42.5);

      // Verify source switch audit record
      const switches = selectorService.getSourceSwitches('bus_01');
      expect(switches.length).toBe(1);
      expect(switches[0].from_source).toBe('NONE');
      expect(switches[0].to_source).toBe('HW');
      expect(switches[0].reason_code).toBe('INITIAL');

      // Outbox triggers
      const outbox = selectorService.getOutboxRecords();
      expect(outbox.some((o) => o.kind === 'SOURCE_SWITCHED')).toBe(true);
      expect(outbox.some((o) => o.kind === 'BUS_STATE_CHANGED')).toBe(true);
    });
  });

  describe('Fallback to Driver Phone (Part 9.4)', () => {
    it('switches to PHONE when HW is stale (> 60s) and phone is fresh, updating cadence to 10s', async () => {
      await setupActiveShift('bus_01', 'drv_01');

      // Initial HW fix at t = 0
      selectorService.updateHardwareLocation('bus_01', 13.0827, 80.2707, 30, 90, baseTime, true);
      expect(selectorService.getBusState('bus_01')?.active_source).toBe('HW');

      // 65 seconds later: HW is stale (> 60s), phone sends fresh fix
      const t65 = new Date(baseTime.getTime() + 65000);
      selectorService.updatePhoneLocation('bus_01', 13.0835, 80.2715, 28, 92, t65);

      const state = selectorService.getBusState('bus_01');
      expect(state?.active_source).toBe('PHONE');
      expect(state?.state).toBe('LIVE');
      expect(state?.lat).toBe(13.0835);

      const switches = selectorService.getSourceSwitches('bus_01');
      expect(switches.length).toBe(2);
      expect(switches[1].from_source).toBe('HW');
      expect(switches[1].to_source).toBe('PHONE');
      expect(switches[1].reason_code).toBe('HW_STALE');

      // Verify cadence adaptation in DriverService (Fallback = 10s)
      const claim = shiftService.getActiveShiftForBus('bus_01');
      expect(claim).toBeDefined();
      const phoneBatch = {
        shift_id: claim!.id,
        samples: [
          {
            seq: 1,
            recorded_at: t65.toISOString(),
            lat: 13.0835,
            lng: 80.2715,
            accuracy_m: 10,
            provider: 'FUSED',
          },
        ],
      };
      const response = await driverService.ingestLocations('drv_01', phoneBatch, t65);
      expect(response.phone_interval_s).toBe(10);
      expect(response.active_source).toBe('PHONE');
    });
  });

  describe('Return to Hardware Requirements (Part 9.5)', () => {
    it('requires 3 consecutive valid HW fixes within 30s to return from PHONE to HW', async () => {
      await setupActiveShift('bus_01', 'drv_01');

      // t=0: HW active
      selectorService.updateHardwareLocation('bus_01', 13.0, 80.0, 20, 0, baseTime, true);
      // t=65s: switch to PHONE (cooldown satisfied)
      const t65 = new Date(baseTime.getTime() + 65000);
      selectorService.updatePhoneLocation('bus_01', 13.001, 80.001, 20, 0, t65);
      expect(selectorService.getBusState('bus_01')?.active_source).toBe('PHONE');

      // t=100s (cooldown > 30s passed): first valid HW fix (1 of 3)
      const t100 = new Date(baseTime.getTime() + 100000);
      selectorService.updateHardwareLocation('bus_01', 13.002, 80.002, 22, 0, t100, true);
      expect(selectorService.getBusState('bus_01')?.active_source).toBe('PHONE');

      // t=110s: second valid HW fix (2 of 3)
      const t110 = new Date(baseTime.getTime() + 110000);
      selectorService.updateHardwareLocation('bus_01', 13.003, 80.003, 23, 0, t110, true);
      expect(selectorService.getBusState('bus_01')?.active_source).toBe('PHONE');

      // t=120s: third valid HW fix (3 of 3 within 30s) -> fails back to HW!
      const t120 = new Date(baseTime.getTime() + 120000);
      selectorService.updateHardwareLocation('bus_01', 13.004, 80.004, 25, 0, t120, true);
      expect(selectorService.getBusState('bus_01')?.active_source).toBe('HW');

      const switches = selectorService.getSourceSwitches('bus_01');
      const lastSwitch = switches[switches.length - 1];
      expect(lastSwitch.from_source).toBe('PHONE');
      expect(lastSwitch.to_source).toBe('HW');
      expect(lastSwitch.reason_code).toBe('HW_RECOVERED');
    });

    it('resets consecutive HW count if an invalid HW sample arrives', async () => {
      await setupActiveShift('bus_01', 'drv_01');

      // t=0: HW active
      selectorService.updateHardwareLocation('bus_01', 13.0, 80.0, 20, 0, baseTime, true);
      // t=65s: switch to PHONE
      const t65 = new Date(baseTime.getTime() + 65000);
      selectorService.updatePhoneLocation('bus_01', 13.001, 80.001, 20, 0, t65);

      // t=100s: 1st valid HW fix
      const t100 = new Date(baseTime.getTime() + 100000);
      selectorService.updateHardwareLocation('bus_01', 13.002, 80.002, 22, 0, t100, true);

      // t=110s: invalid HW fix (GPS lost)
      const t110 = new Date(baseTime.getTime() + 110000);
      selectorService.updateHardwareLocation('bus_01', 13.003, 80.003, 22, 0, t110, false);
      expect(selectorService.getBusState('bus_01')?.consecutive_hw_valid).toBe(0);
      expect(selectorService.getBusState('bus_01')?.active_source).toBe('PHONE');
    });
  });

  describe('Anti-Flapping & Availability (Part 9.6 & 9.7)', () => {
    it('triggers flapHold (300s) and SOURCE_FLAPPING alert when > 6 switches occur within 10 minutes', async () => {
      await setupActiveShift('bus_01', 'drv_01');

      let curTime = baseTime;
      // Perform 6 switches (each > 35s apart to respect cooldown)
      for (let i = 0; i < 3; i++) {
        // HW active
        curTime = new Date(curTime.getTime() + 35000);
        for (let k = 0; k < 3; k++) {
          selectorService.updateHardwareLocation('bus_01', 13.0, 80.0, 20, 0, curTime, true);
        }
        // PHONE active
        curTime = new Date(curTime.getTime() + 65000);
        selectorService.updatePhoneLocation('bus_01', 13.0, 80.0, 20, 0, curTime);
      }

      // 7th switch attempt within 600s
      curTime = new Date(curTime.getTime() + 35000);
      for (let k = 0; k < 3; k++) {
        selectorService.updateHardwareLocation('bus_01', 13.0, 80.0, 20, 0, curTime, true);
      }

      const state = selectorService.getBusState('bus_01');
      expect(state?.flap_hold_until).toBeDefined();
      expect(state!.flap_hold_until!.getTime()).toBeGreaterThan(curTime.getTime());

      // Operational alert raised
      const alerts = selectorService.getOperationalAlerts();
      const flapAlert = alerts.find((a) => a.type === 'SOURCE_FLAPPING');
      expect(flapAlert).toBeDefined();
      expect(flapAlert?.severity).toBe(3);
    });

    it('transitions to UNAVAILABLE and raises BUS_UNAVAILABLE alert when both sources are down for 120s during shift', async () => {
      await setupActiveShift('bus_01', 'drv_01');

      // t=0: initial fix
      selectorService.updateHardwareLocation('bus_01', 13.0, 80.0, 20, 0, baseTime, true);

      // t=125s without fresh data from either source
      const t125 = new Date(baseTime.getTime() + 125000);
      const state = selectorService.evaluateBus('bus_01', t125);

      expect(state.state).toBe('UNAVAILABLE');
      const alerts = selectorService.getOperationalAlerts();
      const unavailAlert = alerts.find((a) => a.type === 'BUS_UNAVAILABLE');
      expect(unavailAlert).toBeDefined();
      expect(unavailAlert?.severity).toBe(2);
    });
  });

  describe('Manual Tracking Modes & Shift Termination (Part 9.3 & 15.4)', () => {
    it('locks source in MANUAL_HW mode and ignores phone data', async () => {
      await setupActiveShift('bus_01', 'drv_01');
      selectorService.setMode('bus_01', 'MANUAL_HW');

      // Phone sends fresh fix, HW is stale
      const t65 = new Date(baseTime.getTime() + 65000);
      selectorService.updatePhoneLocation('bus_01', 13.0, 80.0, 20, 0, t65);

      const state = selectorService.getBusState('bus_01');
      expect(state?.mode).toBe('MANUAL_HW');
      expect(state?.active_source).toBe('HW');
    });

    it('transitions to NOT_RUNNING and NONE source when active shift ends', async () => {
      const claim = await setupActiveShift('bus_01', 'drv_01');
      selectorService.updateHardwareLocation('bus_01', 13.0, 80.0, 20, 0, baseTime, true);
      expect(selectorService.getBusState('bus_01')?.state).toBe('LIVE');

      // End shift
      const tEnd = new Date(baseTime.getTime() + 3600000);
      await shiftService.endShift('drv_01', claim.shift_id, 'NORMAL', tEnd);

      const state = selectorService.evaluateBus('bus_01', tEnd);
      expect(state.state).toBe('NOT_RUNNING');
      expect(state.active_source).toBe('NONE');

      const switches = selectorService.getSourceSwitches('bus_01');
      const lastSwitch = switches[switches.length - 1];
      expect(lastSwitch.reason_code).toBe('SHIFT_ENDED');
    });
  });
});
