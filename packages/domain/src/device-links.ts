import { DeviceRecord } from './device-tokens.js';

export interface DeviceLink {
  id: string;
  device_id: string;
  bus_id: string;
  linked_at: Date;
  unlinked_at: Date | null;
}

export interface LinkValidationResult {
  valid: boolean;
  reason?: string;
  code?: string;
}

export function validateDeviceLinkCreation(
  device: DeviceRecord,
  busId: string,
  existingActiveLinks: DeviceLink[],
): LinkValidationResult {
  if (device.status === 'REVOKED' || device.status === 'RETIRED') {
    return {
      valid: false,
      code: 'DEVICE_INACTIVE',
      reason: `Cannot link device with status ${device.status}`,
    };
  }

  // Check if this device is already actively linked to another bus
  const deviceAlreadyLinked = existingActiveLinks.some(
    (l) => l.device_id === device.id && l.unlinked_at === null && l.bus_id !== busId,
  );
  if (deviceAlreadyLinked) {
    return {
      valid: false,
      code: 'DEVICE_ALREADY_LINKED',
      reason: 'Device is already actively linked to another bus. Unlink it first.',
    };
  }

  // Check if target bus already has another active device linked
  const busAlreadyLinked = existingActiveLinks.some(
    (l) => l.bus_id === busId && l.unlinked_at === null && l.device_id !== device.id,
  );
  if (busAlreadyLinked) {
    return {
      valid: false,
      code: 'BUS_ALREADY_LINKED',
      reason: 'Bus already has an active hardware tracker linked.',
    };
  }

  return { valid: true };
}

/**
 * Attribution Rule (Part 6.6):
 * Attributes a recorded telemetry sample to the bus that was linked to the device
 * at the exact moment the sample was recorded.
 */
export function resolveSampleBusAttribution(
  sampleRecordedAt: Date,
  linkHistory: DeviceLink[],
): string | null {
  const sampleTime = sampleRecordedAt.getTime();

  for (const link of linkHistory) {
    const start = link.linked_at.getTime();
    const end = link.unlinked_at ? link.unlinked_at.getTime() : Infinity;

    if (sampleTime >= start && sampleTime <= end) {
      return link.bus_id;
    }
  }

  return null;
}
