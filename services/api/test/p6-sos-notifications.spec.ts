import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { createTransientTestDatabase, TestDatabaseHandle } from '../../../packages/db/src/native-test-db.js';
import { SosManagementService } from '../src/modules/sos/sos.service.js';
import { NotificationDispatcherService } from '../src/modules/notifications/notification-dispatcher.service.js';
import { StopRequestsService } from '../src/modules/stop-requests/stop-requests.service.js';

describe('Phase P6: SOS, Stop Requests, and Notifications (Real DB & API)', () => {
  let dbHandle: TestDatabaseHandle | null = null;
  let pool: Pool;
  let sosService: SosManagementService;
  let notificationDispatcher: NotificationDispatcherService;
  let stopRequestsService: StopRequestsService;

  const collegeId = '00000000-0000-0000-0000-000000000601';
  const driverUser1 = '00000000-0000-0000-0000-000000000602';
  const driverUser2 = '00000000-0000-0000-0000-000000000603';
  const studentUser1 = '00000000-0000-0000-0000-000000000604';
  const studentUser2 = '00000000-0000-0000-0000-000000000605';
  const bus1 = '00000000-0000-0000-0000-000000000606';
  const bus2 = '00000000-0000-0000-0000-000000000607';
  const route1 = '00000000-0000-0000-0000-000000000608';

  beforeAll(async () => {
    dbHandle = await createTransientTestDatabase();
    pool = dbHandle.superuserPool;

    sosService = new SosManagementService(pool);
    notificationDispatcher = new NotificationDispatcherService();
    stopRequestsService = new StopRequestsService(pool);

    // Seed database
    await pool.query(
      `INSERT INTO colleges (id, name, email_domains, timezone, created_at, updated_at)
       VALUES ($1, 'SOS Engineering College', ARRAY['college.edu'], 'Asia/Kolkata', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [collegeId],
    );

    for (const [uid, email, name] of [
      [driverUser1, 'driver1@college.edu', 'Driver One'],
      [driverUser2, 'driver2@college.edu', 'Driver Two'],
      [studentUser1, 'student1@college.edu', 'Student One'],
      [studentUser2, 'student2@college.edu', 'Student Two'],
    ]) {
      await pool.query(
        `INSERT INTO users (id, college_id, email, full_name, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING;`,
        [uid, collegeId, email, name],
      );
    }

    for (const [bid, bnum, reg] of [
      [bus1, 'BUS-P6-1', 'KA-01-SOS-0001'],
      [bus2, 'BUS-P6-2', 'KA-01-SOS-0002'],
    ]) {
      await pool.query(
        `INSERT INTO buses (id, bus_number, registration_number, capacity, status, insurance_expiry, fitness_expiry, pollution_expiry, permit_expiry, created_at, updated_at)
         VALUES ($1, $2, $3, 40, 'ACTIVE', '2028-01-01', '2028-01-01', '2028-01-01', '2028-01-01', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING;`,
        [bid, bnum, reg],
      );
    }

    await pool.query(
      `INSERT INTO routes (id, code, name, status, created_at, updated_at)
       VALUES ($1, 'RT-P6', 'Route P6 Express', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [route1],
    );
  }, 45000);

  afterAll(async () => {
    if (dbHandle) {
      await dbHandle.destroy();
    }
  });

  beforeEach(() => {
    notificationDispatcher.resetRateLimits();
  });

  it('T-SOS-02: two triggers 20 seconds apart on same bus give one incident (deduplicated / joined)', async () => {
    const baseTime = new Date('2026-10-22T10:00:00Z');
    const trigger1Time = baseTime;
    const trigger2Time = new Date(baseTime.getTime() + 20 * 1000); // 20s later

    // First trigger creates incident
    const res1 = await sosService.triggerOrJoin({
      busId: bus1,
      senderId: driverUser1,
      senderRole: 'DRV',
      category: 'EMERGENCY',
      source: 'DRIVER_APP',
      now: trigger1Time,
    });

    expect(res1.action).toBe('CREATE');
    expect(res1.status).toBe('OPEN');

    // Second trigger within 20s joins same incident
    const res2 = await sosService.triggerOrJoin({
      busId: bus1,
      senderId: studentUser1,
      senderRole: 'STU',
      category: 'EMERGENCY',
      source: 'STUDENT_APP',
      now: trigger2Time,
    });

    expect(res2.action).toBe('JOIN');
    expect(res2.incidentId).toBe(res1.incidentId);

    // Verify events: 1 TRIGGERED and 1 JOINED
    const events = await pool.query(
      `SELECT type FROM sos_events WHERE incident_id = $1 ORDER BY at ASC;`,
      [res1.incidentId],
    );
    expect(events.rows.map((r) => r.type)).toEqual(['TRIGGERED', 'JOINED']);
  });

  it('T-SOS-03: two buses in the same second create two distinct incidents', async () => {
    const triggerTime = new Date('2026-10-22T10:05:00Z');

    const [resBus1, resBus2] = await Promise.all([
      sosService.triggerOrJoin({
        busId: bus1,
        senderId: driverUser1,
        senderRole: 'DRV',
        category: 'BREAKDOWN',
        source: 'DRIVER_APP',
        now: triggerTime,
      }),
      sosService.triggerOrJoin({
        busId: bus2,
        senderId: driverUser2,
        senderRole: 'DRV',
        category: 'MEDICAL',
        source: 'DRIVER_APP',
        now: triggerTime,
      }),
    ]);

    expect(resBus1.incidentId).not.toBe(resBus2.incidentId);
    expect(resBus1.busId).toBe(bus1);
    expect(resBus2.busId).toBe(bus2);
  });

  it('T-CON-03: two parallel SOS triggers on the same bus create exactly one incident', async () => {
    const triggerTime = new Date('2026-10-22T10:10:00Z');
    const newBusId = '00000000-0000-0000-0000-000000000699';

    await pool.query(
      `INSERT INTO buses (id, bus_number, registration_number, capacity, status, insurance_expiry, fitness_expiry, pollution_expiry, permit_expiry, created_at, updated_at)
       VALUES ($1, 'BUS-CON', 'KA-01-CON-9999', 40, 'ACTIVE', '2028-01-01', '2028-01-01', '2028-01-01', '2028-01-01', NOW(), NOW());`,
      [newBusId],
    );

    const [resA, resB] = await Promise.all([
      sosService.triggerOrJoin({
        busId: newBusId,
        senderId: driverUser1,
        senderRole: 'DRV',
        category: 'EMERGENCY',
        source: 'DRIVER_APP',
        now: triggerTime,
      }),
      sosService.triggerOrJoin({
        busId: newBusId,
        senderId: studentUser1,
        senderRole: 'STU',
        category: 'EMERGENCY',
        source: 'STUDENT_APP',
        now: triggerTime,
      }),
    ]);

    // One creates, one joins, both share the same incident ID
    expect(resA.incidentId).toBe(resB.incidentId);
    const actions = [resA.action, resB.action].sort();
    expect(actions).toEqual(['CREATE', 'JOIN']);

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM sos_incidents WHERE bus_id = $1 AND status = 'OPEN';`,
      [newBusId],
    );
    expect(parseInt(countRes.rows[0].count, 10)).toBe(1);
  });

  it('T-SOS-04: tier 1 escalation triggers after 2 minutes without acknowledgement', async () => {
    const createTime = new Date('2026-10-22T11:00:00Z');
    const evalTime = new Date('2026-10-22T11:02:05Z'); // 2m 5s later

    const res = await sosService.triggerOrJoin({
      busId: bus1,
      senderId: driverUser1,
      senderRole: 'DRV',
      category: 'EMERGENCY',
      source: 'DRIVER_APP',
      now: createTime,
    });

    expect(res.currentTier).toBe(0);

    const escalatedCount = await sosService.evaluateEscalations(evalTime);
    expect(escalatedCount).toBeGreaterThanOrEqual(1);

    const updatedRes = await pool.query(
      `SELECT current_tier FROM sos_incidents WHERE id = $1;`,
      [res.incidentId],
    );
    expect(updatedRes.rows[0].current_tier).toBe(1);
  });

  it('T-SOS-05: cancellation is refused once incident has been acknowledged', async () => {
    const res = await sosService.triggerOrJoin({
      busId: bus2,
      senderId: driverUser2,
      senderRole: 'DRV',
      category: 'MEDICAL',
      source: 'DRIVER_APP',
      now: new Date('2026-10-22T11:30:00Z'),
    });

    // Security/coordinator acknowledges incident
    await sosService.acknowledgeSos(res.incidentId, '00000000-0000-0000-0000-000000000688');

    // Attempted cancellation must fail
    await expect(
      sosService.cancelSos(res.incidentId, driverUser2, 'Driver says false alarm'),
    ).rejects.toThrowError('CANNOT_CANCEL_ACKNOWLEDGED_INCIDENT');
  });

  it('T-SOS-06: missing recipient list raises setup alert', async () => {
    let alertRaised = false;
    let alertType = '';

    const res = await sosService.resolveRecipientsWithFallback([], async (alert) => {
      alertRaised = true;
      alertType = alert.type;
    });

    expect(res.setupAlertRaised).toBe(true);
    expect(alertRaised).toBe(true);
    expect(alertType).toBe('SETUP_ALERT_MISSING_SOS_RECIPIENTS');
  });

  it('T-NTF-01: quiet hours applied at dispatch (non-SAFETY suppressed, SAFETY allowed)', async () => {
    // 23:30 (11:30 PM) is inside quiet hours (22:00 to 06:00)
    const nightTime = new Date('2026-10-22T23:30:00');

    // 1. Non-SAFETY notification (TRIP) during quiet hours should be suppressed
    const tripNotif = await notificationDispatcher.dispatch({
      recipientId: studentUser1,
      category: 'TRIP',
      title: 'Bus Approaching',
      body: 'Your bus is 5 minutes away.',
      channel: 'PUSH',
      sendTime: nightTime,
    });
    expect(tripNotif.success).toBe(false);
    expect(tripNotif.suppressed).toBe(true);
    expect(tripNotif.suppressReason).toBe('QUIET_HOURS_SUPPRESSED');

    // 2. SAFETY notification during quiet hours MUST NOT be suppressed
    const safetyNotif = await notificationDispatcher.dispatch({
      recipientId: studentUser1,
      category: 'SAFETY',
      title: 'EMERGENCY SOS',
      body: 'Emergency reported on your assigned route bus.',
      channel: 'PUSH',
      sendTime: nightTime,
    });
    expect(safetyNotif.success).toBe(true);
    expect(safetyNotif.deliveryId).toBeDefined();
  });

  it('T-NTF-02: rate limits (max 5/min) applied at dispatch', async () => {
    const dayTime = new Date('2026-10-22T14:00:00');

    // Dispatch 5 notifications in the same minute -> all succeed
    for (let i = 1; i <= 5; i++) {
      const res = await notificationDispatcher.dispatch({
        recipientId: studentUser2,
        category: 'SAFETY',
        title: `Alert ${i}`,
        body: `Body ${i}`,
        channel: 'PUSH',
        sendTime: dayTime,
      });
      expect(res.success).toBe(true);
    }

    // 6th notification in the same minute -> rejected with RATE_LIMIT_EXCEEDED
    const res6 = await notificationDispatcher.dispatch({
      recipientId: studentUser2,
      category: 'SAFETY',
      title: 'Alert 6',
      body: 'Body 6',
      channel: 'PUSH',
      sendTime: dayTime,
    });
    expect(res6.success).toBe(false);
    expect(res6.error).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('T-NTF-03: SMS template mismatch is blocked', async () => {
    // 1. Unregistered template
    const invalidTemplateRes = await notificationDispatcher.dispatch({
      recipientId: driverUser1,
      category: 'SAFETY',
      title: 'SMS Alert',
      body: 'Some unregistered message text',
      channel: 'SMS',
      templateId: 'DLT_UNAPPROVED_PROMOTIONAL',
    });
    expect(invalidTemplateRes.success).toBe(false);
    expect(invalidTemplateRes.error).toBe('DLT_TEMPLATE_MISMATCH');

    // 2. Approved DLT template
    const validTemplateRes = await notificationDispatcher.dispatch({
      recipientId: driverUser1,
      category: 'SAFETY',
      title: 'Emergency Alert',
      body: 'Emergency Alert: SOS reported on Bus 42.',
      channel: 'SMS',
      templateId: 'DLT_SOS_ALERT',
    });
    expect(validTemplateRes.success).toBe(true);
  });

  it('P6-T7: stop requests submission and voting lifecycle', async () => {
    // 1. Student 1 submits stop request
    const sub = await stopRequestsService.submitRequest({
      requestedBy: studentUser1,
      routeId: route1,
      proposedName: 'North Gate Pharmacy Stop',
      latitude: 12.9716,
      longitude: 77.5946,
    });

    expect(sub.id).toBeDefined();
    expect(sub.status).toBe('PENDING');
    expect(sub.voteCount).toBe(1);

    // 2. Student 2 upvotes
    const voteRes = await stopRequestsService.vote(sub.id, studentUser2);
    expect(voteRes.voteCount).toBe(2);

    // 3. Duplicate vote rejected
    await expect(stopRequestsService.vote(sub.id, studentUser2)).rejects.toThrowError('DUPLICATE_VOTE');
  });
});
