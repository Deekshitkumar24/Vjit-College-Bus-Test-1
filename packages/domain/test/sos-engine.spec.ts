import { describe, it, expect } from 'vitest';
import {
  resolveSosBus,
  evaluateSosCreateOrJoin,
  checkDeviceDelay,
  generateTier0OutboxPayload,
  SosIncidentCore,
} from '../src/sos-engine.js';

describe('P3-T16 / P6-T1: SOS Create-or-Join Core & Tier-0 Outbox (AC-SOS-02, AC-SOS-03, T-CON-03)', () => {
  const baseTime = new Date('2026-10-22T10:00:00.000Z');

  describe('Bus Resolution Rules (Part 11.1 §1)', () => {
    it('resolves bus for driver from active shift', () => {
      const busId = resolveSosBus({
        source: 'DRIVER',
        shiftBusId: 'bus-123',
      });
      expect(busId).toBe('bus-123');
    });

    it('resolves bus for hardware tracker from valid device link', () => {
      const busId = resolveSosBus({
        source: 'DEVICE',
        deviceLinkBusId: 'bus-456',
      });
      expect(busId).toBe('bus-456');
    });

    it('resolves bus for student from active trip route', () => {
      const busId = resolveSosBus({
        source: 'STUDENT',
        studentRouteBusId: 'bus-789',
      });
      expect(busId).toBe('bus-789');
    });

    it('allows security personnel to trigger SOS with no bus', () => {
      const busId = resolveSosBus({
        source: 'SECURITY',
      });
      expect(busId).toBeNull();
    });
  });

  describe('AC-SOS-02: Incident Deduplication & Join within 60s Window', () => {
    it('creates a new incident on initial trigger and adds TRIGGERED event', () => {
      const result = evaluateSosCreateOrJoin([], {
        busId: 'bus-101',
        senderId: 'driver-01',
        senderRole: 'DRIVER',
        category: 'EMERGENCY',
        now: baseTime,
        dedupeWindowSec: 60,
      });

      expect(result.action).toBe('CREATE');
      expect(result.incident.bus_id).toBe('bus-101');
      expect(result.incident.status).toBe('OPEN');
      expect(result.incident.category).toBe('EMERGENCY');
      expect(result.event.type).toBe('TRIGGERED');
      expect(result.event.actor_id).toBe('driver-01');
    });

    it('joins an existing OPEN incident if triggered within 60s for the same bus', () => {
      const existing: SosIncidentCore = {
        id: 'inc-existing-1',
        bus_id: 'bus-101',
        status: 'OPEN',
        category: 'EMERGENCY',
        received_at: baseTime,
        device_delayed: false,
      };

      const triggerTimeLater = new Date(baseTime.getTime() + 25000); // 25s later
      const result = evaluateSosCreateOrJoin([existing], {
        busId: 'bus-101',
        senderId: 'faculty-01',
        senderRole: 'FACULTY',
        category: 'EMERGENCY',
        now: triggerTimeLater,
        dedupeWindowSec: 60,
      });

      expect(result.action).toBe('JOIN');
      expect(result.incident.id).toBe('inc-existing-1');
      expect(result.event.type).toBe('JOINED');
      expect(result.event.incident_id).toBe('inc-existing-1');
      expect(result.event.actor_id).toBe('faculty-01');
    });

    it('creates a new incident if prior incident is older than 60s (dedupe window expired)', () => {
      const existing: SosIncidentCore = {
        id: 'inc-old-1',
        bus_id: 'bus-101',
        status: 'OPEN',
        category: 'EMERGENCY',
        received_at: baseTime,
        device_delayed: false,
      };

      const triggerTimeLater = new Date(baseTime.getTime() + 65000); // 65s later
      const result = evaluateSosCreateOrJoin([existing], {
        busId: 'bus-101',
        senderId: 'student-02',
        senderRole: 'STUDENT',
        category: 'EMERGENCY',
        now: triggerTimeLater,
        dedupeWindowSec: 60,
      });

      expect(result.action).toBe('CREATE');
      expect(result.incident.id).not.toBe('inc-old-1');
      expect(result.event.type).toBe('TRIGGERED');
    });

    it('creates a new incident if prior incident is already RESOLVED or CANCELLED', () => {
      const existing: SosIncidentCore = {
        id: 'inc-closed-1',
        bus_id: 'bus-101',
        status: 'RESOLVED',
        category: 'EMERGENCY',
        received_at: baseTime,
        device_delayed: false,
      };

      const result = evaluateSosCreateOrJoin([existing], {
        busId: 'bus-101',
        senderId: 'driver-01',
        senderRole: 'DRIVER',
        category: 'EMERGENCY',
        now: new Date(baseTime.getTime() + 10000),
        dedupeWindowSec: 60,
      });

      expect(result.action).toBe('CREATE');
      expect(result.incident.id).not.toBe('inc-closed-1');
    });
  });

  describe('AC-SOS-03: Multi-Bus Isolation', () => {
    it('always creates separate incidents for different buses even at identical timestamps', () => {
      const existingBusA: SosIncidentCore = {
        id: 'inc-bus-A',
        bus_id: 'bus-A',
        status: 'OPEN',
        category: 'MEDICAL',
        received_at: baseTime,
        device_delayed: false,
      };

      const resultBusB = evaluateSosCreateOrJoin([existingBusA], {
        busId: 'bus-B',
        senderId: 'driver-B',
        senderRole: 'DRIVER',
        category: 'BREAKDOWN',
        now: baseTime,
        dedupeWindowSec: 60,
      });

      expect(resultBusB.action).toBe('CREATE');
      expect(resultBusB.incident.id).not.toBe('inc-bus-A');
      expect(resultBusB.incident.bus_id).toBe('bus-B');
    });
  });

  describe('Device Delay Flagging (Part 11.1 §4)', () => {
    it('flags DEVICE_DELAYED when received_at minus device_triggered_at > 60s', () => {
      const deviceTime = new Date('2026-10-22T10:00:00.000Z');
      const receivedTime = new Date('2026-10-22T10:01:15.000Z'); // 75s later (> 60s)

      const isDelayed = checkDeviceDelay(deviceTime, receivedTime, 60);
      expect(isDelayed).toBe(true);
    });

    it('does not flag delay when device latency is within 60s', () => {
      const deviceTime = new Date('2026-10-22T10:00:00.000Z');
      const receivedTime = new Date('2026-10-22T10:00:15.000Z'); // 15s later (< 60s)

      const isDelayed = checkDeviceDelay(deviceTime, receivedTime, 60);
      expect(isDelayed).toBe(false);
    });
  });

  describe('Tier-0 Outbox Generation & Notification Core (Part 11.1 §5)', () => {
    it('generates an outbox record with kind SOS_TIER_0 and high priority payload', () => {
      const incident: SosIncidentCore = {
        id: 'inc-outbox-1',
        bus_id: 'bus-101',
        status: 'OPEN',
        category: 'EMERGENCY',
        received_at: baseTime,
        device_delayed: false,
      };

      const outbox = generateTier0OutboxPayload(incident, {
        facultyIds: ['fac-1'],
        securityIds: ['sec-1', 'sec-2'],
        coordinatorIds: ['cor-1'],
        senderId: 'drv-1',
      });

      expect(outbox.kind).toBe('SOS_TIER_0');
      expect(outbox.status).toBe('PENDING');
      expect(outbox.payload.incident_id).toBe('inc-outbox-1');
      expect(outbox.payload.bus_id).toBe('bus-101');
      expect(outbox.payload.priority).toBe('HIGH');
      expect(outbox.payload.recipients).toEqual(
        expect.arrayContaining(['fac-1', 'sec-1', 'sec-2', 'cor-1', 'drv-1']),
      );
    });
  });
});
