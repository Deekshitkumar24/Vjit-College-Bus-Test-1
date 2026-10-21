import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  DeviceRecord,
  KeyRing,
  authenticateDevice,
  DeviceLink,
  resolveSampleBusAttribution,
} from '@collegebus/domain';
import {
  TelemetryBatchDto,
  TelemetryIngestResponseDto,
  SampleRejectionItem,
  LocationSampleDto,
} from '@collegebus/contracts';

export interface StoredSampleRecord {
  device_id: string;
  boot_id: string;
  seq: number;
  bus_id: string | null;
  recorded_at: Date;
  lat: number;
  lng: number;
  speed_kmh: number;
  heading_deg: number;
  ignition: string;
  payloadHash: string;
}

@Injectable()
export class TelemetryService {
  // In-memory sample cache / registry for deduplication & idempotency verification
  private sampleRegistry = new Map<string, StoredSampleRecord>();

  // In-memory device & link state for ingestion pipeline
  private devices = new Map<string, DeviceRecord>();
  private linkHistories = new Map<string, DeviceLink[]>();

  registerDevice(device: DeviceRecord) {
    this.devices.set(device.device_id, device);
  }

  setDeviceLinks(deviceId: string, links: DeviceLink[]) {
    this.linkHistories.set(deviceId, links);
  }

  getDevice(deviceId: string): DeviceRecord | undefined {
    return this.devices.get(deviceId);
  }

  getStoredSamples(): StoredSampleRecord[] {
    return Array.from(this.sampleRegistry.values());
  }

  clear() {
    this.sampleRegistry.clear();
    this.devices.clear();
    this.linkHistories.clear();
  }

  private computeSampleContentSignature(s: LocationSampleDto): string {
    return `${s.lat.toFixed(6)}|${s.lng.toFixed(6)}|${s.speed_kmh}|${s.heading_deg}|${s.ignition}`;
  }

  async ingestBatch(
    deviceId: string,
    rawBearerToken: string,
    batch: TelemetryBatchDto,
    keyring: KeyRing,
    now: Date = new Date(),
  ): Promise<TelemetryIngestResponseDto> {
    // Stage S4: Device Authentication & C-01 First-Use Activation
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new UnauthorizedException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Unknown device identifier',
      });
    }

    const authResult = authenticateDevice(device, rawBearerToken, keyring, now);
    if (!authResult.allowed) {
      throw new UnauthorizedException({
        code: authResult.code || 'UNAUTHORIZED',
        message: authResult.reason || 'Device authentication failed',
      });
    }

    // If first-use activation is required (Conflict C-01)
    if (authResult.shouldActivate) {
      device.status = 'ACTIVE';
      device.first_used_at = now;
    }

    // Stage S6: Device link resolution
    const links = this.linkHistories.get(device.id) || [];

    const rejections: SampleRejectionItem[] = [];
    let acceptedCount = 0;

    // Process each sample through Stages S7, S8, S9
    for (const sample of batch.samples) {
      const sampleRecordedAt = new Date(sample.recorded_at);
      const registryKey = `${device.device_id}:${batch.boot_id}:${sample.seq}`;
      const currentSignature = this.computeSampleContentSignature(sample);

      // Stage S7: Deduplication check
      const existing = this.sampleRegistry.get(registryKey);
      if (existing) {
        if (existing.payloadHash === currentSignature) {
          // Idempotent duplicate: accepted without re-insertion
          acceptedCount++;
          continue;
        } else {
          // Conflict: Same (device, boot, seq) with DIFFERENT content (OV-1 / C-09)
          rejections.push({ seq: sample.seq, reason: 'CONFLICT' });
          continue;
        }
      }

      // Stage S8: Domain Validation Rules
      // 1. Future timestamp check (> 30 seconds ahead of server clock)
      if (sampleRecordedAt.getTime() > now.getTime() + 30000) {
        rejections.push({ seq: sample.seq, reason: 'FUTURE_TIMESTAMP' });
        continue;
      }

      // 2. Valid coordinates check (non-zero fix requirement)
      if (sample.lat === 0 && sample.lng === 0) {
        rejections.push({ seq: sample.seq, reason: 'INVALID_COORDINATES' });
        continue;
      }

      // 3. Speed plausibility check (< 160 km/h)
      if (sample.speed_kmh > 150) {
        rejections.push({ seq: sample.seq, reason: 'EXCESSIVE_SPEED' });
        continue;
      }

      // Stage S6 attribution: resolve bus linked at sample timestamp
      const busId = resolveSampleBusAttribution(sampleRecordedAt, links);

      // Stage S9: Database persistence simulation
      this.sampleRegistry.set(registryKey, {
        device_id: device.device_id,
        boot_id: batch.boot_id,
        seq: sample.seq,
        bus_id: busId,
        recorded_at: sampleRecordedAt,
        lat: sample.lat,
        lng: sample.lng,
        speed_kmh: sample.speed_kmh,
        heading_deg: sample.heading_deg,
        ignition: sample.ignition,
        payloadHash: currentSignature,
      });

      acceptedCount++;
    }

    // Stage S13: Response
    return {
      accepted_count: acceptedCount,
      rejected_count: rejections.length,
      rejections,
      server_time: now.toISOString(),
    };
  }
}
