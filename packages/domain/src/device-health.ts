export type DeviceHealthState = 'ONLINE' | 'DELAYED' | 'OFFLINE';

export interface ComputeHealthParams {
  lastHeartbeatAt: Date | null;
  ignition: 'ON' | 'OFF' | 'UNKNOWN';
  now?: Date;
  hasActiveShift?: boolean;
}

/**
 * Computes device health state according to AG-MASTER Part 9.13 and SW-MVP section 11.6:
 * - ONLINE: Last heartbeat within twice the expected interval (60 s while ignition ON or during a shift, 600 s while parked).
 * - DELAYED: Older than ONLINE, but within 10 minutes while ignition ON or during a shift, and within 24 hours while parked.
 * - OFFLINE: Older than 10 minutes while ignition ON or during a shift, or older than 24 hours while parked.
 */
export function computeDeviceHealthState(params: ComputeHealthParams): DeviceHealthState {
  const { lastHeartbeatAt, ignition, now = new Date(), hasActiveShift = false } = params;

  if (!lastHeartbeatAt) {
    return 'OFFLINE';
  }

  const elapsedSeconds = Math.max(0, (now.getTime() - lastHeartbeatAt.getTime()) / 1000);
  const isIgnitionOnOrShift = ignition === 'ON' || hasActiveShift;
  const expectedIntervalSeconds = isIgnitionOnOrShift ? 60 : 600;
  const onlineThresholdSeconds = 2 * expectedIntervalSeconds;

  if (elapsedSeconds <= onlineThresholdSeconds) {
    return 'ONLINE';
  }

  const delayedMaxSeconds = isIgnitionOnOrShift ? 600 : 86400; // 10 minutes vs 24 hours

  if (elapsedSeconds <= delayedMaxSeconds) {
    return 'DELAYED';
  }

  return 'OFFLINE';
}

export interface BatteryEvaluationResult {
  isLow: boolean;
  thresholdMv: number;
}

/**
 * Evaluates vehicle battery threshold according to Part B.3 D-02 and SW-MVP section 12:
 * - 12 V class: 11,800 mV (11.8 V)
 * - 24 V class: 23,500 mV (23.5 V)
 */
export function evaluateVehicleBatteryThreshold(
  vehicleBatteryMv: number | null | undefined,
  vehicleClass: 'V12' | 'V24' = 'V12',
): BatteryEvaluationResult {
  const thresholdMv = vehicleClass === 'V24' ? 23500 : 11800;
  if (vehicleBatteryMv === null || vehicleBatteryMv === undefined) {
    return { isLow: false, thresholdMv };
  }
  return {
    isLow: vehicleBatteryMv < thresholdMv,
    thresholdMv,
  };
}

/**
 * Evaluates device internal backup battery threshold:
 * Under 3,400 mV is low.
 */
export function evaluateDeviceBatteryThreshold(deviceBatteryMv: number | null | undefined): {
  isLow: boolean;
  thresholdMv: number;
} {
  const thresholdMv = 3400;
  if (deviceBatteryMv === null || deviceBatteryMv === undefined) {
    return { isLow: false, thresholdMv };
  }
  return {
    isLow: deviceBatteryMv < thresholdMv,
    thresholdMv,
  };
}

export interface EventEvaluationContext {
  recentWatchdogCount?: number;
  recentModuleErrorCount?: number;
  isShiftActive?: boolean;
}

export interface TicketAction {
  category: string;
  source: 'SYSTEM_ALERT';
  description: string;
}

export interface EventEvaluationResult {
  status: 'RECORDED' | 'PROCESSED' | 'IGNORED';
  action:
    | 'OPEN_TICKET'
    | 'START_IDLE_TIMER'
    | 'END_PARKED_STATE'
    | 'UPDATE_HEALTH'
    | 'PAUSE_ROLLOUT'
    | 'NONE';
  ticket?: TicketAction;
  incident_id: string | null;
}

/**
 * Evaluates hardware and phone events per Part 5.5 and SW-MVP section 12.
 */
export function evaluateHardwareEvent(
  eventType: string,
  eventData: Record<string, unknown> = {},
  context: EventEvaluationContext = {},
): EventEvaluationResult {
  switch (eventType) {
    case 'SOS':
      // Raw event recorded in P1 per Conflict C-08; incident joining / fan-out built in P3-T16
      return {
        status: 'RECORDED',
        action: 'NONE',
        incident_id: null,
      };

    case 'BOOT': {
      const resetReason = String(eventData['reset_reason'] || 'UNKNOWN').toUpperCase();
      const watchdogCount =
        (context.recentWatchdogCount || 0) +
        (resetReason === 'WATCHDOG' || resetReason === 'BROWNOUT' ? 1 : 0);
      if ((resetReason === 'WATCHDOG' || resetReason === 'BROWNOUT') && watchdogCount >= 3) {
        return {
          status: 'PROCESSED',
          action: 'OPEN_TICKET',
          incident_id: null,
          ticket: {
            category: 'REPEATED_BOOT_FAILURE',
            source: 'SYSTEM_ALERT',
            description: `Three or more ${resetReason} resets detected within 24 hours`,
          },
        };
      }
      return { status: 'RECORDED', action: 'NONE', incident_id: null };
    }

    case 'IGNITION_ON':
      return {
        status: 'PROCESSED',
        action: 'END_PARKED_STATE',
        incident_id: null,
      };

    case 'IGNITION_OFF':
      return {
        status: 'PROCESSED',
        action: context.isShiftActive ? 'START_IDLE_TIMER' : 'NONE',
        incident_id: null,
      };

    case 'GPS_LOST':
      return {
        status: 'PROCESSED',
        action: 'UPDATE_HEALTH',
        incident_id: null,
      };

    case 'GPS_RECOVERED':
      return {
        status: 'PROCESSED',
        action: 'UPDATE_HEALTH',
        incident_id: null,
      };

    case 'LOW_VEHICLE_BATTERY':
      return {
        status: 'PROCESSED',
        action: 'OPEN_TICKET',
        incident_id: null,
        ticket: {
          category: 'LOW_VEHICLE_BATTERY',
          source: 'SYSTEM_ALERT',
          description: `Vehicle battery voltage dropped below critical operating threshold (${eventData['mv'] || 'low'} mV)`,
        },
      };

    case 'LOW_DEVICE_BATTERY':
      return {
        status: 'PROCESSED',
        action: 'OPEN_TICKET',
        incident_id: null,
        ticket: {
          category: 'LOW_DEVICE_BATTERY',
          source: 'SYSTEM_ALERT',
          description: `Internal tracker battery voltage dropped below threshold (${eventData['mv'] || 'low'} mV)`,
        },
      };

    case 'MODULE_ERROR': {
      const errorCount = (context.recentModuleErrorCount || 0) + 1;
      if (errorCount >= 3) {
        return {
          status: 'PROCESSED',
          action: 'OPEN_TICKET',
          incident_id: null,
          ticket: {
            category: 'MODULE_ERROR',
            source: 'SYSTEM_ALERT',
            description: `Cellular module reported repeated errors (3 in 24 hours): code ${eventData['error_code'] || 'UNKNOWN'}`,
          },
        };
      }
      return { status: 'RECORDED', action: 'NONE', incident_id: null };
    }

    case 'FIRMWARE_FAILED':
      return {
        status: 'PROCESSED',
        action: 'PAUSE_ROLLOUT',
        incident_id: null,
        ticket: {
          category: 'FIRMWARE_FAILED',
          source: 'SYSTEM_ALERT',
          description: `Firmware update to version ${eventData['attempted_version'] || 'UNKNOWN'} failed: ${eventData['reason'] || 'unspecified failure'}`,
        },
      };

    case 'TAMPER':
      return {
        status: 'PROCESSED',
        action: 'OPEN_TICKET',
        incident_id: null,
        ticket: {
          category: 'TAMPER_ALERT',
          source: 'SYSTEM_ALERT',
          description: 'Physical tamper switch trigger detected on tracker enclosure',
        },
      };

    case 'NETWORK_RESTORED':
    case 'BUFFER_OVERFLOW':
    case 'CONFIG_APPLIED':
    case 'FIRMWARE_UPDATED':
    case 'DOOR_OPEN':
    case 'DOOR_CLOSE':
      return { status: 'RECORDED', action: 'NONE', incident_id: null };

    default:
      // Unknown event type stored with status IGNORED per Part 5.5
      return { status: 'IGNORED', action: 'NONE', incident_id: null };
  }
}
