import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

export interface TriggerSosParams {
  busId: string | null;
  senderId: string;
  senderRole: string;
  category: 'EMERGENCY' | 'MEDICAL' | 'BREAKDOWN' | 'OTHER' | 'UNKNOWN';
  source: 'DRIVER_APP' | 'HW_BUTTON' | 'STUDENT_APP' | 'FACULTY_APP' | 'SECURITY_APP';
  now?: Date;
  tripId?: string | null;
}

export interface SosIncidentResult {
  action: 'CREATE' | 'JOIN';
  incidentId: string;
  busId: string | null;
  status: string;
  category: string;
  currentTier: number;
}

@Injectable()
export class SosManagementService {
  constructor(private readonly pool: Pool) {}

  /**
   * T-SOS-02, T-SOS-03, T-CON-03: Create or join SOS incident.
   * - 60s deduplication per bus (T-SOS-02: two triggers 20s apart join same incident).
   * - Two buses in same second create 2 distinct incidents (T-SOS-03).
   * - Concurrency: Uses database transaction with row-level advisory lock per busId (T-CON-03).
   */
  public async triggerOrJoin(params: TriggerSosParams): Promise<SosIncidentResult> {
    const now = params.now ?? new Date();
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Advisory lock per busId to prevent race conditions during concurrent triggers (T-CON-03)
      if (params.busId) {
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1));`, [params.busId]);
      }

      // Check for an existing OPEN incident for this bus within the 60-second window
      let existingQuery = `
        SELECT id, bus_id, status, category, current_tier, received_at
        FROM sos_incidents
        WHERE status = 'OPEN' AND received_at >= $1::timestamptz - INTERVAL '60 seconds'
      `;
      const queryParams: any[] = [now];


      if (params.busId) {
        existingQuery += ` AND bus_id = $2 ORDER BY received_at DESC LIMIT 1`;
        queryParams.push(params.busId);
      } else {
        existingQuery += ` AND bus_id IS NULL ORDER BY received_at DESC LIMIT 1`;
      }

      const existingRes = await client.query(existingQuery, queryParams);

      if (existingRes.rows.length > 0) {
        // JOIN existing incident
        const incident = existingRes.rows[0];
        await client.query(
          `INSERT INTO sos_events (id, incident_id, type, actor_id, at, detail, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, 'JOINED', $2, $3, $4, NOW(), NOW());`,
          [incident.id, params.senderId, now, JSON.stringify({ source: params.source, category: params.category })],
        );

        await client.query('COMMIT');
        return {
          action: 'JOIN',
          incidentId: incident.id,
          busId: incident.bus_id,
          status: incident.status,
          category: incident.category,
          currentTier: incident.current_tier,
        };
      }

      // CREATE new incident
      const insertRes = await client.query(
        `INSERT INTO sos_incidents (
          id, bus_id, trip_id, category, first_trigger_type, first_triggered_at,
          received_at, status, current_tier, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          $5, 'OPEN', 0, NOW(), NOW()
        ) RETURNING id, bus_id, status, category, current_tier;`,
        [params.busId, params.tripId ?? null, params.category, params.source, now],
      );

      const newIncident = insertRes.rows[0];

      await client.query(
        `INSERT INTO sos_events (id, incident_id, type, actor_id, at, detail, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 'TRIGGERED', $2, $3, $4, NOW(), NOW());`,
        [newIncident.id, params.senderId, now, JSON.stringify({ source: params.source, category: params.category })],
      );

      await client.query('COMMIT');
      return {
        action: 'CREATE',
        incidentId: newIncident.id,
        busId: newIncident.bus_id,
        status: newIncident.status,
        category: newIncident.category,
        currentTier: newIncident.current_tier,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * T-SOS-05: Cancellation is refused once incident is acknowledged or responding.
   */
  public async cancelSos(incidentId: string, actorId: string, note?: string): Promise<{ success: boolean }> {
    const res = await this.pool.query(
      `SELECT status FROM sos_incidents WHERE id = $1;`,
      [incidentId],
    );

    if (res.rows.length === 0) {
      throw new Error('INCIDENT_NOT_FOUND');
    }

    const currentStatus = res.rows[0].status;
    if (currentStatus === 'ACKNOWLEDGED' || currentStatus === 'RESPONDING') {
      throw new Error('CANNOT_CANCEL_ACKNOWLEDGED_INCIDENT');
    }

    await this.pool.query(
      `UPDATE sos_incidents SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1;`,
      [incidentId],
    );

    await this.pool.query(
      `INSERT INTO sos_events (id, incident_id, type, actor_id, at, detail, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'CANCELLED', $2, NOW(), $3, NOW(), NOW());`,
      [incidentId, actorId, JSON.stringify({ note })],
    );

    return { success: true };
  }

  /**
   * Acknowledges an incident and moves status to RESPONDING.
   */
  public async acknowledgeSos(incidentId: string, actorId: string): Promise<void> {
    await this.pool.query(
      `UPDATE sos_incidents SET status = 'RESPONDING', updated_at = NOW() WHERE id = $1;`,
      [incidentId],
    );

    await this.pool.query(
      `INSERT INTO sos_events (id, incident_id, type, actor_id, at, detail, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'ACKNOWLEDGED', $2, NOW(), '{}', NOW(), NOW());`,
      [incidentId, actorId],
    );
  }

  /**
   * T-SOS-04: Multi-channel escalation ladder.
   * If incident remains OPEN without acknowledgement after 2 minutes, escalate to Tier 1.
   */
  public async evaluateEscalations(now: Date = new Date()): Promise<number> {
    const cutoff2m = new Date(now.getTime() - 2 * 60 * 1000);

    const candidates = await this.pool.query(
      `SELECT id, current_tier, received_at FROM sos_incidents
       WHERE status = 'OPEN' AND current_tier = 0 AND received_at <= $1;`,
      [cutoff2m],
    );

    let escalatedCount = 0;
    for (const incident of candidates.rows) {
      await this.pool.query(
        `UPDATE sos_incidents SET current_tier = 1, updated_at = NOW() WHERE id = $1;`,
        [incident.id],
      );

      await this.pool.query(
        `INSERT INTO sos_events (id, incident_id, type, at, detail, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 'ESCALATED', NOW(), '{"tier": 1, "reason": "UNACKNOWLEDGED_2M"}', NOW(), NOW());`,
        [incident.id],
      );
      escalatedCount++;
    }

    return escalatedCount;
  }

  /**
   * T-SOS-06: Resolve recipients. If recipient list is empty, raise setup alert.
   */
  public async resolveRecipientsWithFallback(
    recipients: string[],
    raiseSystemAlert: (alert: { type: string; message: string }) => Promise<void>,
  ): Promise<{ recipients: string[]; setupAlertRaised: boolean }> {
    if (!recipients || recipients.length === 0) {
      await raiseSystemAlert({
        type: 'SETUP_ALERT_MISSING_SOS_RECIPIENTS',
        message: 'No emergency escalation contacts configured. Immediate administrative configuration required.',
      });
      return { recipients: [], setupAlertRaised: true };
    }

    return { recipients, setupAlertRaised: false };
  }
}
