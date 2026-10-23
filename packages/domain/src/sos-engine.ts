/**
 * SOS Emergency Create-or-Join Core Engine (AG-MASTER-1.0 §11.1, P3-T16, P6-T1)
 *
 * Implements:
 * 1. Bus resolution per actor role and device link
 * 2. 60-second deduplication and incident joining (AC-SOS-02)
 * 3. Multi-bus isolation (AC-SOS-03)
 * 4. Device delay detection (>60s)
 * 5. Tier-0 outbox notification generation
 */

export type SosSource = 'DEVICE' | 'DRIVER' | 'FACULTY' | 'STUDENT' | 'SECURITY';
export type SosCategory = 'EMERGENCY' | 'MEDICAL' | 'BREAKDOWN' | 'OTHER' | 'UNKNOWN';
export type SosIncidentStatus = 'OPEN' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED' | 'DRILL_CLOSED';
export type SosEventType =
  'TRIGGERED' | 'JOINED' | 'ACKNOWLEDGED' | 'RESPONDING' | 'ESCALATED' | 'CANCELLED' | 'RESOLVED';

export interface SosIncidentCore {
  id: string;
  bus_id: string | null;
  status: SosIncidentStatus;
  category: SosCategory;
  received_at: Date;
  device_delayed: boolean;
  trip_id?: string | null;
}

export interface SosEventCore {
  id: string;
  incident_id: string;
  type: SosEventType;
  actor_id: string;
  actor_role: string;
  at: Date;
  detail?: Record<string, unknown>;
}

export interface ResolveSosBusParams {
  source: SosSource;
  busId?: string | null;
  shiftBusId?: string | null;
  deviceLinkBusId?: string | null;
  studentRouteBusId?: string | null;
}

/**
 * 1. Work out the bus (Part 11.1 §1):
 * - Device trigger: device link valid at triggered_at
 * - Driver trigger: active shift's bus
 * - Faculty trigger: bus on screen (in scope)
 * - Student trigger: active trip on student's route
 * - Security trigger: may send with no bus (null)
 */
export function resolveSosBus(params: ResolveSosBusParams): string | null {
  switch (params.source) {
    case 'DEVICE':
      return params.deviceLinkBusId ?? params.busId ?? null;
    case 'DRIVER':
      return params.shiftBusId ?? params.busId ?? null;
    case 'FACULTY':
      return params.busId ?? null;
    case 'STUDENT':
      return params.studentRouteBusId ?? params.busId ?? null;
    case 'SECURITY':
      return params.busId ?? null;
    default:
      return params.busId ?? null;
  }
}

export interface EvaluateSosParams {
  busId: string | null;
  senderId: string;
  senderRole: string;
  category: SosCategory;
  now: Date;
  dedupeWindowSec?: number;
  deviceTriggeredAt?: Date;
  tripId?: string | null;
}

export interface EvaluateSosResult {
  action: 'CREATE' | 'JOIN';
  incident: SosIncidentCore;
  event: SosEventCore;
}

/**
 * 2 & 3. Create or join incident with deduplication window (Part 11.1 §2, §3, AC-SOS-02, AC-SOS-03)
 */
export function evaluateSosCreateOrJoin(
  existingIncidents: SosIncidentCore[],
  params: EvaluateSosParams,
): EvaluateSosResult {
  const dedupeWindowSec = params.dedupeWindowSec ?? 60;
  const dedupeWindowMs = dedupeWindowSec * 1000;

  // Find existing OPEN incident for this bus (or for this sender if bus is null) within dedupe window
  const matchingIncident = existingIncidents.find((inc) => {
    if (inc.status !== 'OPEN') return false;

    const matchesBus = params.busId !== null ? inc.bus_id === params.busId : inc.bus_id === null;
    if (!matchesBus) return false;

    const ageMs = params.now.getTime() - inc.received_at.getTime();
    return ageMs >= 0 && ageMs <= dedupeWindowMs;
  });

  const deviceDelayed = params.deviceTriggeredAt
    ? checkDeviceDelay(params.deviceTriggeredAt, params.now)
    : false;

  if (matchingIncident) {
    // JOIN existing incident
    const event: SosEventCore = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      incident_id: matchingIncident.id,
      type: 'JOINED',
      actor_id: params.senderId,
      actor_role: params.senderRole,
      at: params.now,
      detail: {
        category: params.category,
        bus_id: params.busId,
      },
    };

    return {
      action: 'JOIN',
      incident: matchingIncident,
      event,
    };
  }

  // CREATE new incident
  const newIncidentId = `sos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newIncident: SosIncidentCore = {
    id: newIncidentId,
    bus_id: params.busId,
    status: 'OPEN',
    category: params.category,
    received_at: params.now,
    device_delayed: deviceDelayed,
    trip_id: params.tripId ?? null,
  };

  const event: SosEventCore = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    incident_id: newIncidentId,
    type: 'TRIGGERED',
    actor_id: params.senderId,
    actor_role: params.senderRole,
    at: params.now,
    detail: {
      category: params.category,
      bus_id: params.busId,
      device_delayed: deviceDelayed,
    },
  };

  return {
    action: 'CREATE',
    incident: newIncident,
    event,
  };
}

/**
 * 4. Check device delay (Part 11.1 §4)
 * If received_at - device_triggered_at > 60s (sos.device_delay_flag_s), flag DEVICE_DELAYED
 */
export function checkDeviceDelay(
  deviceTriggeredAt: Date,
  receivedAt: Date,
  delayFlagSec = 60,
): boolean {
  const diffSec = (receivedAt.getTime() - deviceTriggeredAt.getTime()) / 1000;
  return diffSec > delayFlagSec;
}

export interface Tier0Recipients {
  facultyIds?: string[];
  securityIds?: string[];
  coordinatorIds?: string[];
  senderId?: string;
}

export interface OutboxRecordCore {
  id: string;
  kind: 'SOS_TIER_0';
  status: 'PENDING';
  created_at: Date;
  payload: {
    incident_id: string;
    bus_id: string | null;
    category: SosCategory;
    priority: 'HIGH';
    sound: string;
    recipients: string[];
  };
}

/**
 * 5. Write outbox rows for tier 0 recipients (Part 11.1 §5)
 */
export function generateTier0OutboxPayload(
  incident: SosIncidentCore,
  recipients: Tier0Recipients,
): OutboxRecordCore {
  const allRecipients = Array.from(
    new Set([
      ...(recipients.facultyIds || []),
      ...(recipients.securityIds || []),
      ...(recipients.coordinatorIds || []),
      ...(recipients.senderId ? [recipients.senderId] : []),
    ]),
  );

  return {
    id: `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    kind: 'SOS_TIER_0',
    status: 'PENDING',
    created_at: new Date(),
    payload: {
      incident_id: incident.id,
      bus_id: incident.bus_id,
      category: incident.category,
      priority: 'HIGH',
      sound: 'emergency_alert',
      recipients: allRecipients,
    },
  };
}
