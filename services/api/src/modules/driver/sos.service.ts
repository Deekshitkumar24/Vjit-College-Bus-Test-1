import { Injectable, NotFoundException } from '@nestjs/common';
import {
  evaluateSosCreateOrJoin,
  generateTier0OutboxPayload,
  SosIncidentCore,
  SosEventCore,
  SosCategory,
  SosSource,
  OutboxRecordCore,
  Tier0Recipients,
} from '@collegebus/domain';

export interface TriggerOrJoinParams {
  busId: string | null;
  senderId: string;
  senderRole: string;
  source: SosSource;
  category: SosCategory;
  now?: Date;
  lat?: number | null;
  lng?: number | null;
  accuracy_m?: number | null;
  deviceTriggeredAt?: Date;
  tripId?: string | null;
}

export interface StoredSosIncidentWithEvents extends SosIncidentCore {
  lat?: number | null;
  lng?: number | null;
  accuracy_m?: number | null;
  first_trigger_type: SosSource;
  events: SosEventCore[];
  outbox_id?: string;
}

@Injectable()
export class SosService {
  private incidents = new Map<string, StoredSosIncidentWithEvents>();
  private outboxRows: OutboxRecordCore[] = [];
  private lockQueues = new Map<string, Promise<void>>();

  /**
   * Acquire a transaction/advisory lock keyed on the bus (or sender if no bus)
   * Simulates pg_advisory_xact_lock on bus hash for concurrent execution.
   */
  private async acquireAdvisoryLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prevLock = this.lockQueues.get(key) || Promise.resolve();

    let releaseLock: () => void;
    const currentLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.lockQueues.set(key, prevLock.then(() => currentLock));

    await prevLock;
    try {
      return await task();
    } finally {
      releaseLock!();
      if (this.lockQueues.get(key) === currentLock) {
        this.lockQueues.delete(key);
      }
    }
  }

  /**
   * P3-T16 / P6-T1: SOS Create-or-Join Core
   */
  async triggerOrJoin(params: TriggerOrJoinParams): Promise<{
    action: 'CREATE' | 'JOIN';
    incidentId: string;
    status: string;
    category: SosCategory;
    busId: string | null;
  }> {
    const now = params.now || new Date();
    const lockKey = params.busId ? `bus_${params.busId}` : `sender_${params.senderId}`;

    return this.acquireAdvisoryLock(lockKey, async () => {
      // Gather all existing OPEN incidents
      const openIncidents = Array.from(this.incidents.values()).filter(
        (inc) => inc.status === 'OPEN',
      );

      const evalResult = evaluateSosCreateOrJoin(openIncidents, {
        busId: params.busId,
        senderId: params.senderId,
        senderRole: params.senderRole,
        category: params.category,
        now,
        deviceTriggeredAt: params.deviceTriggeredAt,
        tripId: params.tripId,
      });

      if (evalResult.action === 'CREATE') {
        const storedIncident: StoredSosIncidentWithEvents = {
          ...evalResult.incident,
          first_trigger_type: params.source,
          lat: params.lat ?? null,
          lng: params.lng ?? null,
          accuracy_m: params.accuracy_m ?? null,
          events: [evalResult.event],
        };

        // Write outbox row for Tier 0 recipients (Part 11.1 §5)
        const recipients: Tier0Recipients = {
          senderId: params.senderId,
          // In real production, query duty list from database:
          coordinatorIds: ['cor_duty_list'],
          securityIds: ['sec_on_duty'],
          facultyIds: params.busId ? [`fac_assigned_${params.busId}`] : [],
        };

        const outboxRecord = generateTier0OutboxPayload(evalResult.incident, recipients);
        this.outboxRows.push(outboxRecord);
        storedIncident.outbox_id = outboxRecord.id;

        this.incidents.set(evalResult.incident.id, storedIncident);

        return {
          action: 'CREATE',
          incidentId: evalResult.incident.id,
          status: storedIncident.status,
          category: storedIncident.category,
          busId: storedIncident.bus_id,
        };
      } else {
        // JOIN existing incident
        const existing = this.incidents.get(evalResult.incident.id)!;
        existing.events.push(evalResult.event);

        return {
          action: 'JOIN',
          incidentId: existing.id,
          status: existing.status,
          category: existing.category,
          busId: existing.bus_id,
        };
      }
    });
  }

  async getIncident(incidentId: string): Promise<StoredSosIncidentWithEvents> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new NotFoundException({
        code: 'SOS_INCIDENT_NOT_FOUND',
        message: `SOS incident with ID ${incidentId} not found`,
      });
    }
    return incident;
  }

  async getPendingOutbox(): Promise<OutboxRecordCore[]> {
    return this.outboxRows.filter((r) => r.status === 'PENDING');
  }
}
