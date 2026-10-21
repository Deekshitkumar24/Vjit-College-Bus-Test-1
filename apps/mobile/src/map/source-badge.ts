import { BusSnapshot } from '@collegebus/contracts';

export type SourceBadgeTone = 'GREEN' | 'BLUE' | 'AMBER' | 'GRAY';

export interface SourceBadgeViewModel {
  labelText: string;
  tone: SourceBadgeTone;
  isPulsing: boolean;
  accessibleDescription: string;
}

/**
 * Resolves authoritative plain-language source badge per SW-MVP-1.0 §13.7 & §17.3.
 */
export function resolveSourceBadge(bus: BusSnapshot): SourceBadgeViewModel {
  if (bus.state === 'NOT_RUNNING') {
    return {
      labelText: 'Not running',
      tone: 'GRAY',
      isPulsing: false,
      accessibleDescription: 'Bus is not currently running scheduled route',
    };
  }

  if (bus.state === 'UNAVAILABLE') {
    return {
      labelText: 'Offline',
      tone: 'GRAY',
      isPulsing: false,
      accessibleDescription: 'Bus location is offline; no signal received for over 2 minutes',
    };
  }

  if (bus.state === 'STALE') {
    return {
      labelText: 'Delayed',
      tone: 'AMBER',
      isPulsing: false,
      accessibleDescription: 'Bus location signal is delayed; awaiting update',
    };
  }

  // LIVE state: authoritative source distinction
  if (bus.active_source === 'HW') {
    return {
      labelText: 'Live · bus tracker',
      tone: 'GREEN',
      isPulsing: true,
      accessibleDescription: 'Live location provided by dedicated on-vehicle hardware tracker',
    };
  }

  if (bus.active_source === 'PHONE') {
    return {
      labelText: "Live · driver's phone",
      tone: 'BLUE',
      isPulsing: true,
      accessibleDescription: "Live location provided by driver's smartphone GPS",
    };
  }

  return {
    labelText: bus.source_label || 'Offline',
    tone: 'GRAY',
    isPulsing: false,
    accessibleDescription: 'Bus location is unavailable',
  };
}
