import {
  FleetBusStatusDto,
  FleetBusStatusSchema,
  SourceSwitchLogItemDto,
  SourceSwitchLogItemSchema,
  DualTrackComparisonDto,
  GpsPointDto,
} from '@collegebus/contracts';

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // meters
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class FleetMapManager {
  private buses: Map<string, FleetBusStatusDto> = new Map();
  private switches: SourceSwitchLogItemDto[] = [];

  updateBusStatus(status: FleetBusStatusDto): void {
    const validated = FleetBusStatusSchema.parse(status);
    this.buses.set(validated.bus_id, validated);
  }

  getFleetOverview(now: Date = new Date()): FleetBusStatusDto[] {
    const list: FleetBusStatusDto[] = [];
    const nowMs = now.getTime();

    for (const bus of this.buses.values()) {
      let ageSeconds: number | null = null;
      if (bus.last_sample_at) {
        const sampleMs = new Date(bus.last_sample_at).getTime();
        ageSeconds = Math.max(0, Math.floor((nowMs - sampleMs) / 1000));
      }
      list.push({
        ...bus,
        age_seconds: ageSeconds,
      });
    }

    return list;
  }

  recordSourceSwitch(item: SourceSwitchLogItemDto): void {
    const validated = SourceSwitchLogItemSchema.parse(item);
    this.switches.push(validated);
  }

  getSourceSwitches(busId?: string): SourceSwitchLogItemDto[] {
    if (!busId) {
      return [...this.switches].sort(
        (a, b) =>
          new Date(b.switched_at).getTime() - new Date(a.switched_at).getTime(),
      );
    }
    return this.switches
      .filter((s) => s.bus_id === busId)
      .sort(
        (a, b) =>
          new Date(b.switched_at).getTime() - new Date(a.switched_at).getTime(),
      );
  }
}

export class DualTrackAnalyzer {
  private readonly thresholdMeters = 200;

  compareTracks(input: {
    bus_id: string;
    window_start: string;
    window_end: string;
    primary_track: GpsPointDto[];
    phone_track: GpsPointDto[];
  }): DualTrackComparisonDto {
    const primary = [...input.primary_track].sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
    const phone = [...input.phone_track].sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );

    const divergences: number[] = [];
    const disagreementIntervals: Array<{
      start: string;
      end: string;
      divergence_m: number;
      reason: string;
    }> = [];

    // Compare points matching by closest timestamps within a 60s window
    for (const pPoint of primary) {
      const pMs = new Date(pPoint.recorded_at).getTime();
      // Find closest phone point
      let closestPhone: GpsPointDto | null = null;
      let minDeltaMs = Infinity;

      for (const phPoint of phone) {
        const delta = Math.abs(new Date(phPoint.recorded_at).getTime() - pMs);
        if (delta < minDeltaMs && delta <= 60000) {
          minDeltaMs = delta;
          closestPhone = phPoint;
        }
      }

      if (closestPhone) {
        const dist = haversineDistanceMeters(
          pPoint.lat,
          pPoint.lng,
          closestPhone.lat,
          closestPhone.lng,
        );
        divergences.push(dist);

        if (dist > this.thresholdMeters) {
          disagreementIntervals.push({
            start: pPoint.recorded_at,
            end: closestPhone.recorded_at,
            divergence_m: Math.round(dist),
            reason: `Divergence exceeded 200m threshold (${Math.round(dist)}m)`,
          });
        }
      }
    }

    const maxDivergence = divergences.length > 0 ? Math.max(...divergences) : 0;
    const avgDivergence =
      divergences.length > 0
        ? divergences.reduce((a, b) => a + b, 0) / divergences.length
        : 0;

    return {
      bus_id: input.bus_id,
      window_start: input.window_start,
      window_end: input.window_end,
      primary_track: primary,
      phone_track: phone,
      max_divergence_m: Math.round(maxDivergence),
      average_divergence_m: Math.round(avgDivergence),
      disagreement_intervals: disagreementIntervals,
    };
  }
}
