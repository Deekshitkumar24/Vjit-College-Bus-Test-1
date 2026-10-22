import { describe, it, expect, beforeEach } from 'vitest';
import { SosService } from '../src/modules/driver/sos.service.js';
import { SosCategory } from '@collegebus/contracts';

describe('P3-T16: SOS Create-or-Join Service & Tier-0 Outbox Core (AC-SOS-02, AC-SOS-03, T-CON-03)', () => {
  let sosService: SosService;

  beforeEach(() => {
    sosService = new SosService();
  });

  describe('AC-SOS-02: Single-Bus Deduplication and Joining within 60 Seconds', () => {
    it('creates a new incident on initial trigger and emits TRIGGERED event and Tier-0 Outbox row', async () => {
      const now = new Date('2026-10-22T12:00:00.000Z');

      const result = await sosService.triggerOrJoin({
        busId: 'bus-alpha',
        senderId: 'driver-001',
        senderRole: 'DRIVER',
        source: 'DRIVER',
        category: 'EMERGENCY',
        lat: 12.9716,
        lng: 77.5946,
        now,
      });

      expect(result.action).toBe('CREATE');
      expect(result.incidentId).toBeDefined();
      expect(result.status).toBe('OPEN');

      // Verify incident details
      const incident = await sosService.getIncident(result.incidentId);
      expect(incident.bus_id).toBe('bus-alpha');
      expect(incident.category).toBe('EMERGENCY');
      expect(incident.status).toBe('OPEN');
      expect(incident.events).toHaveLength(1);
      expect(incident.events[0]?.type).toBe('TRIGGERED');
      expect(incident.events[0]?.actor_id).toBe('driver-001');

      // Verify Outbox Tier-0 record was generated
      const outbox = await sosService.getPendingOutbox();
      expect(outbox).toHaveLength(1);
      expect(outbox[0]?.kind).toBe('SOS_TIER_0');
      expect(outbox[0]?.payload.incident_id).toBe(result.incidentId);
      expect(outbox[0]?.payload.priority).toBe('HIGH');
    });

    it('joins existing OPEN incident when triggered within 60s for the same bus (AC-SOS-02)', async () => {
      const t0 = new Date('2026-10-22T12:00:00.000Z');
      const t1 = new Date('2026-10-22T12:00:30.000Z'); // 30 seconds later

      // First trigger: driver triggers SOS
      const firstResult = await sosService.triggerOrJoin({
        busId: 'bus-alpha',
        senderId: 'driver-001',
        senderRole: 'DRIVER',
        source: 'DRIVER',
        category: 'EMERGENCY',
        now: t0,
      });

      // Second trigger: student on the same bus triggers SOS 30s later
      const secondResult = await sosService.triggerOrJoin({
        busId: 'bus-alpha',
        senderId: 'student-999',
        senderRole: 'STUDENT',
        source: 'STUDENT',
        category: 'MEDICAL',
        now: t1,
      });

      // Assert they joined the exact same incident ID
      expect(secondResult.action).toBe('JOIN');
      expect(secondResult.incidentId).toBe(firstResult.incidentId);

      // Verify incident now has two events: TRIGGERED then JOINED
      const incident = await sosService.getIncident(firstResult.incidentId);
      expect(incident.events).toHaveLength(2);
      expect(incident.events[0]?.type).toBe('TRIGGERED');
      expect(incident.events[1]?.type).toBe('JOINED');
      expect(incident.events[1]?.actor_id).toBe('student-999');
    });

    it('creates a new incident if prior incident is older than 60s', async () => {
      const t0 = new Date('2026-10-22T12:00:00.000Z');
      const tLater = new Date('2026-10-22T12:01:05.000Z'); // 65 seconds later

      const first = await sosService.triggerOrJoin({
        busId: 'bus-alpha',
        senderId: 'driver-001',
        senderRole: 'DRIVER',
        source: 'DRIVER',
        category: 'EMERGENCY',
        now: t0,
      });

      const second = await sosService.triggerOrJoin({
        busId: 'bus-alpha',
        senderId: 'driver-001',
        senderRole: 'DRIVER',
        source: 'DRIVER',
        category: 'EMERGENCY',
        now: tLater,
      });

      expect(second.action).toBe('CREATE');
      expect(second.incidentId).not.toBe(first.incidentId);
    });
  });

  describe('AC-SOS-03: Two different buses always produce two incidents', () => {
    it('creates distinct incidents for different buses simultaneously', async () => {
      const now = new Date('2026-10-22T12:00:00.000Z');

      const resultBus1 = await sosService.triggerOrJoin({
        busId: 'bus-001',
        senderId: 'driver-001',
        senderRole: 'DRIVER',
        source: 'DRIVER',
        category: 'BREAKDOWN',
        now,
      });

      const resultBus2 = await sosService.triggerOrJoin({
        busId: 'bus-002',
        senderId: 'driver-002',
        senderRole: 'DRIVER',
        source: 'DRIVER',
        category: 'MEDICAL',
        now,
      });

      expect(resultBus1.action).toBe('CREATE');
      expect(resultBus2.action).toBe('CREATE');
      expect(resultBus1.incidentId).not.toBe(resultBus2.incidentId);

      const inc1 = await sosService.getIncident(resultBus1.incidentId);
      const inc2 = await sosService.getIncident(resultBus2.incidentId);
      expect(inc1.bus_id).toBe('bus-001');
      expect(inc2.bus_id).toBe('bus-002');
    });
  });

  describe('T-CON-03: Concurrency & Transaction Advisory Lock', () => {
    it('serializes parallel triggers for the same bus to avoid duplicate incidents', async () => {
      const now = new Date('2026-10-22T12:00:00.000Z');

      // 5 concurrent triggers for the same bus at the exact same millisecond
      const triggers = Array.from({ length: 5 }, (_, i) =>
        sosService.triggerOrJoin({
          busId: 'bus-parallel',
          senderId: `user-${i}`,
          senderRole: i === 0 ? 'DRIVER' : 'STUDENT',
          source: i === 0 ? 'DRIVER' : 'STUDENT',
          category: 'EMERGENCY' as SosCategory,
          now,
        }),
      );

      const results = await Promise.all(triggers);

      const createCount = results.filter((r) => r.action === 'CREATE').length;
      const joinCount = results.filter((r) => r.action === 'JOIN').length;

      // Exactly 1 CREATE and 4 JOINs
      expect(createCount).toBe(1);
      expect(joinCount).toBe(4);

      // All returned the exact same incident ID
      const targetId = results[0]?.incidentId;
      for (const r of results) {
        expect(r.incidentId).toBe(targetId);
      }

      const incident = await sosService.getIncident(targetId!);
      expect(incident.events).toHaveLength(5);
    });
  });
});
